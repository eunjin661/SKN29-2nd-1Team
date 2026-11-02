import numpy as np
from sklearn.metrics import roc_auc_score, average_precision_score, f1_score
import pytest

from ml.diagnostics import weighted_metrics, paired_bootstrap, seed_summary


def test_cluster_multiplicity_matches_explicitly_repeated_event_rows():
    y = np.array([0, 1, 0, 1]); score = np.array([.1, .7, .4, .8]); weights = np.array([2, 2, 1, 0])
    indices = np.repeat(np.arange(len(y)), weights)
    actual = weighted_metrics(y, score, .5, weights)
    assert actual["auc"] == pytest.approx(roc_auc_score(y[indices], score[indices]))
    assert actual["pr_auc"] == pytest.approx(average_precision_score(y[indices], score[indices]))
    assert actual["f1"] == pytest.approx(f1_score(y[indices], score[indices] >= .5))


def test_paired_bootstrap_is_deterministic_and_identical_models_have_zero_difference():
    y = np.array([0, 1, 0, 1, 0, 1]); groups = np.array(["a", "a", "b", "b", "c", "c"]); scores = np.array([.1, .6, .4, .9, .7, .8])
    arguments = (y, groups, {"logistic": scores, "embedding_mlp": scores}, {"logistic": .5, "embedding_mlp": .5})
    first = paired_bootstrap(*arguments, repeats=20, seed=12)
    assert first == paired_bootstrap(*arguments, repeats=20, seed=12)
    assert first["valid"] == 20 and first["videos"] == 3 and first["events"] == 6
    assert all(bounds == {"lower": 0., "upper": 0.} for bounds in first["intervals"]["embedding_minus_logistic"].values())


def test_seed_summary_uses_sample_standard_deviation_and_all_runs():
    rows = [{"test": {name: value for name in ["auc", "pr_auc", "f1", "precision", "recall"]}} for value in [.6, .8]]
    assert seed_summary(rows)["auc"]["mean"] == pytest.approx(.7)
    assert seed_summary(rows)["auc"]["std_sample"] == pytest.approx(np.std([.6, .8], ddof=1))
    with pytest.raises(ValueError): seed_summary(rows[:1])


def test_invalid_bootstrap_inputs_fail_instead_of_publishing_undefined_intervals():
    with pytest.raises(ValueError): paired_bootstrap(np.array([1, 1]), np.array(["a", "b"]), {}, {}, repeats=2)
