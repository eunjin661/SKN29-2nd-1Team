import json

import joblib
import pytest

from ml.data_contract import FEATURES, PROTOCOL_VERSION, sha256_file


@pytest.fixture
def saved_run(tmp_path):
    directory = tmp_path / "test-run"
    directory.mkdir()
    # Contents intentionally are not deserialized by status/negative tests.
    model = directory / "sklearn_models.joblib"
    joblib.dump({"pipelines": {}}, model)
    report = {
        "run_id": directory.name, "status": "OFFLINE_EVALUATION_COMPLETE",
        "protocol": PROTOCOL_VERSION, "selected_model": "dummy", "selected_threshold": .5,
        "data": {"feature_columns": list(FEATURES), "target": {"name": "tdi_v2", "category_q95_train_only": {"Entertainment": 48.}}},
        "artifact_sha256": {model.name: sha256_file(model)},
    }
    (directory / "report.json").write_text(json.dumps(report))
    return directory, report
