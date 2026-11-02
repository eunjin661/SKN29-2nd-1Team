from pathlib import Path
import subprocess
import time
import urllib.request

root = Path('/home/eunjin/repos/SKNETWORKS-FAMILY-AICAMP/SKN29-2nd-1Team')
stage = Path(__file__).resolve().parent
evidence = root / 'backend/artifacts/followup-20261023'
node = '/home/eunjin/.nvm/versions/node/v24.20.0/bin/node'
with (evidence / 'production-server.log').open('w') as log:
    process = subprocess.Popen([node, 'node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '15174', '--strictPort'], cwd=root / 'frontend', stdout=log, stderr=subprocess.STDOUT)
    try:
        for _ in range(50):
            if process.poll() is not None: raise RuntimeError('Preview exited early')
            try:
                urllib.request.urlopen('http://127.0.0.1:15174', timeout=1).close()
                break
            except OSError: time.sleep(.1)
        else: raise RuntimeError('Preview unavailable')
        result = subprocess.run([node, str(stage / 'verify-production.mjs'), str(root), str(evidence)], cwd=root / 'frontend', text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        (evidence / 'production-verification.log').write_text(result.stdout)
        print(result.stdout, flush=True)
        raise SystemExit(result.returncode)
    finally:
        process.terminate()
        try: process.wait(timeout=5)
        except subprocess.TimeoutExpired: process.kill(); process.wait(timeout=5)
