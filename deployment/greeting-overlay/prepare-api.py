from pathlib import Path
import shutil
d=Path(__file__).resolve().parent;r=d.parents[1];out=d/'output/api';out.mkdir(parents=True,exist_ok=True)
shutil.copytree(r/'backend/apps/api/dist/modules/daily-greetings',out/'daily-greetings',dirs_exist_ok=True)
shutil.copytree(r/'backend/apps/api/src/modules/daily-greetings/assets',out/'daily-greetings/assets',dirs_exist_ok=True)
for name in ['daily-greeting-job.js']:shutil.copy(r/'backend/apps/api/dist'/name,out)
shutil.copy(d/'register-api.cjs',out);shutil.copy(d/'Dockerfile.api',out/'Dockerfile')
