import subprocess,json,pathlib
out=pathlib.Path(__file__).resolve().parents[1]/'evidence';out.mkdir(exist_ok=True)
bases={'api':'91271538f78d1e337bc980c2c6a32d567da868f91cb89a058b67b006e631a82e','member':'32d7287c3a00160cb98127c58c95584761c484b7db5adfe01135c30410c92218','admin':'88b859842d24b1aa7d3fe2ae3f77ffab93cfc54ed4181e6f84dc3ad85e45af4c'}
results={}
for kind,digest in bases.items():
 root='/app/apps/api/dist' if kind=='api' else '/usr/share/nginx/html'
 allowed=root+('/app.module.js' if kind=='api' else '/index.html')
 def hashes(image):
  raw=subprocess.check_output(['docker','run','--rm','--entrypoint','sh',image,'-c',f'find {root} -type f -exec sha256sum {{}} +'],text=True,encoding='utf-8')
  return {line[66:]:line[:64] for line in raw.splitlines()}
 old=hashes(f'ucellprodacrm3z2zx4ohqyui.azurecr.io/ucell-{kind}@sha256:{digest}')
 new=hashes(f'ucell-greeting-{kind}:261111')
 changed=[p for p,h in old.items() if new.get(p)!=h]
 assert changed==[allowed] or sorted(changed)==[allowed],changed
 results[kind]={'baseDigest':digest,'preservedFiles':len(old)-1,'changedExistingFiles':changed,'newFiles':[p for p in new if p not in old]}
(out/'preservation.json').write_text(json.dumps(results,indent=2))
print(json.dumps({k:{'preservedFiles':v['preservedFiles'],'changedExistingFiles':v['changedExistingFiles'],'newFiles':len(v['newFiles'])} for k,v in results.items()}))
