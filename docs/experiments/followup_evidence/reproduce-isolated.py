"""Local clean-checkout replay of the prepared CI commands, without publishing."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import time

root = Path('/home/eunjin/repos/SKNETWORKS-FAMILY-AICAMP/SKN29-2nd-1Team')
evidence = root / 'backend/artifacts/followup-20261023'
checkout = evidence / 'isolated-checkout'
assert not checkout.exists()
result = subprocess.run(['git', 'clone', '--shared', '--no-hardlinks', str(root), str(checkout)], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
(evidence / 'isolated-clone.log').write_text(result.stdout)
assert result.returncode == 0, result.stdout

# Overlay the approved working tree, since it is deliberately not committed yet.
# This clone has its own files and fresh runtimes, but shares the local Git object
# store. It is not presented as a fresh download of published GitHub changes.
allowed = ['backend/api', 'backend/ml', 'backend/tests', 'backend/examples', 'frontend/src', 'frontend/tests', '.github/workflows', '.vscode', 'docs']
for folder in allowed:
    source = root / folder
    if not source.exists(): continue
    for path in source.rglob('*'):
        if path.is_file() and '__pycache__' not in path.parts:
            destination = checkout / path.relative_to(root)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, destination)
for name in ['backend/requirements-cpu.lock', 'backend/requirements_ensemble.txt', 'backend/.env.example', 'frontend/index.html', 'frontend/package.json', 'frontend/package-lock.json', 'frontend/vite.config.js', 'frontend/eslint.config.js', 'frontend/playwright.config.js', 'frontend/.gitignore', 'pytest.ini', '.gitignore', 'README.md']:
    shutil.copyfile(root / name, checkout / name)
removed = subprocess.check_output(['git', 'diff', '--name-only', '--diff-filter=D', 'HEAD', '-z'], cwd=root).decode().split('\0')
for name in removed:
    if not name: continue
    path = checkout / name
    assert path.resolve().is_relative_to(checkout.resolve())
    if path.is_file(): path.unlink()
for folder in [checkout, checkout / 'backend', checkout / 'frontend']:
    for name in ['.env', '.env.local', '.env.production', '.env.development']:
        path = folder / name
        if path.is_file(): path.unlink()
assert hashlib.sha256((checkout / 'backend/data/video_trending_events_analysis.parquet').read_bytes()).hexdigest() == 'cb9a13ea1c4d60ffe72046c6c23f9aed3ca846a2409ef5038b2a872eda8d164e'

node_bin = '/home/eunjin/.nvm/versions/node/v24.20.0/bin'
uv = '/home/eunjin/.local/bin/uv'
env = dict(os.environ, PATH=node_bin + ':' + os.environ['PATH'], PYTHONPATH=str(checkout / 'backend'),
           OMP_NUM_THREADS='4', OPENBLAS_NUM_THREADS='4', MKL_NUM_THREADS='4',
           DB_HOST='127.0.0.1', DB_PORT='1', DB_USER='offline', DB_PASSWORD='offline', DB_NAME='offline', DB_DATABASE='offline', YOUTUBE_API_KEY='',
           TRENDIT_TEST_RUN_ID='t0-v2-ci', TRENDIT_TEST_DIAGNOSTICS_ID='', TRENDIT_BROWSER_REPORT=str(evidence / 'isolated-browser-results.json'))
commands = [
    ('venv', [uv, 'venv', '--python', '3.10.21', '.venv'], checkout),
    ('python-sync', [uv, 'pip', 'sync', '--python', '.venv/bin/python', 'backend/requirements-cpu.lock', '--index-strategy', 'unsafe-best-match'], checkout),
    ('backend', ['.venv/bin/python', '-B', '-m', 'pytest', '-q'], checkout),
    ('training', ['.venv/bin/python', '-B', '-u', '-m', 'ml.train_weighted_ensemble', '--include-deep', '--include-tabnet', '--run-id', 't0-v2-ci'], checkout),
    ('inference', ['.venv/bin/python', '-B', '-m', 'ml.inference', '--run-dir', 'backend/artifacts/t0-v2-ci', '--input', 'backend/examples/t0_request.json'], checkout),
    ('npm-ci', ['npm', 'ci', '--ignore-scripts'], checkout / 'frontend'),
    ('quality', ['npm', 'run', 'check'], checkout / 'frontend'),
    ('browser', ['npm', 'run', 'test:e2e', '--', '--grep-invert', 'REAL diagnostic'], checkout / 'frontend'),
]
summary = {'status': 'RUNNING', 'scope': 'Fresh local checkout with approved source overlay; own venv and node_modules; shared local Git objects; no remote CI execution', 'commands': {}}
for name, command, cwd in commands:
    start = time.monotonic()
    with (evidence / f'isolated-{name}.log').open('w') as log:
        process = subprocess.Popen(command, cwd=cwd, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        for line in process.stdout:
            log.write(line); log.flush()
            if name in ['training', 'browser']: print(line, end='', flush=True)
        code = process.wait()
    summary['commands'][name] = {'exit_code': code, 'seconds': round(time.monotonic() - start, 3)}
    print(name, summary['commands'][name], flush=True)
    (evidence / 'isolated-reproduction.json').write_text(json.dumps(summary, indent=2))
    if code:
        summary['status'] = 'FAIL'
        (evidence / 'isolated-reproduction.json').write_text(json.dumps(summary, indent=2))
        raise SystemExit(code)
summary['status'] = 'PASS'
reference = json.loads((root / 'backend/artifacts/t0-v2-cpu-20261022-audit/report.json').read_text())
reproduced = json.loads((checkout / 'backend/artifacts/t0-v2-ci/report.json').read_text())
summary['selected_model_matches'] = reference['selected_model'] == reproduced['selected_model']
summary['selected_threshold_matches'] = reference['selected_threshold'] == reproduced['selected_threshold']
summary['test_metrics_match_all_models'] = {name: value['test'] == reproduced['results'][name]['test'] for name, value in reference['results'].items()}
assert summary['selected_model_matches'] and summary['selected_threshold_matches'] and all(summary['test_metrics_match_all_models'].values())
(evidence / 'isolated-reproduction.json').write_text(json.dumps(summary, indent=2))
print(json.dumps(summary), flush=True)
