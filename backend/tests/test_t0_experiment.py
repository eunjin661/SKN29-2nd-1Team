import json

import numpy as np
import pandas as pd
import pytest

from ml.data_contract import FEATURES, make_features, make_preprocessor, prepare_data
from ml.inference import predict
from ml.train_weighted_ensemble import choose_threshold, metrics


@pytest.fixture
def events():
    count = 120
    start = pd.date_range("2023-01-01", periods=count, freq="D")
    duration = np.where(np.arange(count) % 2, 48., 6.)
    return pd.DataFrame({
        "video_id": [f"video-{i}" for i in range(count)], "event_id": 1,
        "T0": start, "T_end": start + pd.to_timedelta(duration, unit="h"),
        "published_at": start - pd.Timedelta(hours=12), "trending_duration_h": duration,
        "best_rank": 10, "entry_rank": 30, "T0_view": np.arange(count) + 100,
        "T0_comment": 10, "category_group": "Entertainment",
    })


def prepare(tmp_path, frame):
    path = tmp_path / "events.parquet"
    frame.to_parquet(path, index=False)
    return prepare_data(path)


def test_future_and_target_columns_never_enter_features(events):
    expected = make_features(events)
    injected = events.assign(tdi_label=1, long_label_48h=1, view_growth_24h_log=99999,
                             trending_duration_log=99999, saturation_index_30d_mean_prev=99999)
    pd.testing.assert_frame_equal(expected, make_features(injected))
    assert tuple(expected.columns) == FEATURES


def test_stored_derived_values_are_recomputed(events):
    actual = make_features(events.assign(T0_view_log=-999, weekday_sin=999))
    assert actual.T0_view_log.iloc[0] == pytest.approx(np.log1p(100))
    assert actual.weekday_sin.between(-1, 1).all()


def test_timezones_share_kst_hour_semantics(events):
    naive = make_features(events)
    aware = events.copy()
    for column in ["T0", "published_at"]:
        aware[column] = aware[column].dt.tz_localize("Asia/Seoul").dt.tz_convert("UTC")
    pd.testing.assert_frame_equal(naive, make_features(aware))


def test_group_disjoint_temporal_splits_and_mature_labels(tmp_path, events):
    events.loc[90, "video_id"] = "video-0"
    events.loc[90, "event_id"] = 2
    result = prepare(tmp_path, events)
    train, val, test = (result.frames[name] for name in ["train", "validation", "test"])
    assert train.T0.max() < val.T0.min() < test.T0.min()
    assert not set(train.video_id) & set(val.video_id)
    assert not set(train.video_id) & set(test.video_id)
    assert not set(val.video_id) & set(test.video_id)
    assert train.label_available_at.max() <= pd.Timestamp(result.manifest["train_boundary"])
    assert val.label_available_at.max() <= pd.Timestamp(result.manifest["test_boundary"])
    assert test.label_available_at.max() <= pd.Timestamp(result.manifest["observation_end"])
    assert result.manifest["splits"]["validation"]["seen_video_rows_removed"] > 0
    assert result.manifest["splits"]["train"]["unresolved_label_rows_removed"] > 0


def test_future_outcomes_do_not_change_training_label_reference(tmp_path, events):
    before = prepare(tmp_path, events)
    changed = events.copy()
    changed.loc[changed.T0 >= pd.Timestamp(before.manifest["train_boundary"]), "trending_duration_h"] *= 1.1
    after = prepare(tmp_path, changed)
    assert before.manifest["target"] == after.manifest["target"]
    np.testing.assert_array_equal(before.targets["train"], after.targets["train"])


def test_unseen_categories_do_not_refit_preprocessor(events):
    train = make_features(events.iloc[:80])
    future = make_features(events.iloc[80:].assign(category_group="UNSEEN"))
    preprocessor = make_preprocessor().fit(train)
    vocabulary = preprocessor.named_transformers_["category"].categories_[0].copy()
    transformed = preprocessor.transform(future)
    assert np.isfinite(transformed).all()
    np.testing.assert_array_equal(vocabulary, preprocessor.named_transformers_["category"].categories_[0])


def test_invalid_publication_time_is_excluded_and_counted(tmp_path, events):
    events.loc[0, "published_at"] = events.loc[0, "T0"] + pd.Timedelta(hours=1)
    result = prepare(tmp_path, events)
    assert result.manifest["invalid_publication_time_rows_removed"] == 1
    assert len(result.assignments) == len(events)
    assert result.assignments.loc[result.assignments.video_id == "video-0", "split"].item() == "excluded_invalid_publication_time"


@pytest.mark.parametrize("mutation", ["duplicate", "missing", "infinity"])
def test_invalid_data_fails_loudly(tmp_path, events, mutation):
    if mutation == "duplicate":
        events.loc[1, "video_id"] = events.loc[0, "video_id"]
    elif mutation == "missing":
        events.loc[0, "T0_view"] = np.nan
    else:
        events.loc[0, "trending_duration_h"] = np.inf
    with pytest.raises(ValueError):
        prepare(tmp_path, events)


def test_undefined_auc_does_not_become_zero():
    with pytest.raises(ValueError):
        metrics(np.array([1, 1]), np.array([.8, .9]))


def test_threshold_uses_validation_f1():
    y = np.array([0, 0, 1, 1])
    proba = np.array([.1, .2, .35, .4])
    threshold = choose_threshold(y, proba)
    assert metrics(y, proba, threshold)["f1"] == 1.


def test_artifact_tampering_is_rejected_before_model_loading(saved_run):
    directory, _ = saved_run
    (directory / "sklearn_models.joblib").write_bytes(b"changed model")
    with pytest.raises(ValueError, match="checksum"):
        predict(directory, [])


def test_embedding_unknown_category_has_own_bucket(events):
    from ml.torch_models import encode
    from sklearn.pipeline import Pipeline
    from sklearn.impute import SimpleImputer
    from sklearn.preprocessing import StandardScaler
    from ml.data_contract import NUMERIC_FEATURES
    features = make_features(events)
    numeric = Pipeline([("impute", SimpleImputer()), ("scale", StandardScaler())]).fit(features[list(NUMERIC_FEATURES)])
    state = {"vocabulary": {"Entertainment": 1}, "numeric": numeric}
    known, _ = encode(features, state)
    unknown, _ = encode(features.assign(category_group="unseen"), state)
    assert known.eq(1).all() and unknown.eq(0).all()


def test_small_embedding_dataset_performs_actual_training(events):
    from ml.torch_models import train_embedding
    features = make_features(events)
    inputs = {"train": features.iloc[:20], "validation": features.iloc[20:40]}
    targets = {"train": np.arange(20) % 2, "validation": np.arange(20) % 2}
    _, state = train_embedding(inputs, targets, seed=42, epochs=1, threads=1)
    loss = state["training"]["history"][0]["train_loss"]
    assert np.isfinite(loss) and loss > 0
