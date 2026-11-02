from pathlib import Path
import subprocess
import os
import time
import urllib.request

root = Path('/home/eunjin/repos/SKNETWORKS-FAMILY-AICAMP/SKN29-2nd-1Team')
stage = Path('/mnt/c/Users/ddttl/OneDrive/문서/취업준비/tmp/trendit-quality')
evidence = root / 'backend/artifacts/quality-security-20261022'
node = '/home/eunjin/.nvm/versions/node/v24.20.0/bin/node'
with (evidence / 'production-preview-server.log').open('w') as log:
    preview = subprocess.Popen([node, 'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '15174', '--strictPort'], cwd=root / 'frontend', stdout=log, stderr=subprocess.STDOUT)
    try:
        for _ in range(50):
            if preview.poll() is not None:
                raise RuntimeError('Production preview exited early')
            try:
                urllib.request.urlopen('http://127.0.0.1:15174', timeout=1).close()
                break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError('Production preview did not start')
        result = subprocess.run([node, str(stage / 'verify-production.mjs'), str(root), str(evidence)], cwd=root / 'frontend', text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        (evidence / 'production-browser.log').write_text(result.stdout)
        print(result.stdout, flush=True)
        raise SystemExit(result.returncode)
    finally:
        preview.terminate()
        try:
            preview.wait(timeout=5)
        except subprocess.TimeoutExpired:
            preview.kill()
            preview.wait(timeout=5)
