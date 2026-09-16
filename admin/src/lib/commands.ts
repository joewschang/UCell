/** Preserve an unsuccessful command key and coalesce concurrent identical submissions.
 * The cache is scoped to this authenticated page session and cleared on sign-out.
 */
export function createCommandClient(send:(path:string,data:unknown,key:string)=>Promise<unknown>,identity:()=>string,newKey:()=>string=()=>crypto.randomUUID()) {
  const attempts=new Map<string,{key:string;pending?:Promise<unknown>}>();
  let actor='';
  return {
    clear(){attempts.clear();actor='';},
    execute<T>(path:string,data?:unknown,key?:string):Promise<T>{
      const nextActor=identity();if(actor!==nextActor){attempts.clear();actor=nextActor;}
      const signature=JSON.stringify([path,data??null,key??null]);
      const attempt=attempts.get(signature)??{key:key??newKey()};
      if(attempt.pending)return attempt.pending as Promise<T>;
      attempts.set(signature,attempt);
      attempt.pending=Promise.resolve().then(()=>{
        if(identity()!==nextActor)throw new Error('管理員工作階段已變更，請重新確認操作。');
        return send(path,data,attempt.key);
      }).then(result=>{
        if(attempts.get(signature)===attempt)attempts.delete(signature);
        return result;
      }).finally(()=>{attempt.pending=undefined;});
      return attempt.pending as Promise<T>;
    }
  };
}
