import {expect,it} from 'vitest';
import {memberEntryCors} from '../../backend/apps/api/src/member-entry-cors';
it('uses exact configured Stage origins even in production mode and permits Member edits',()=>{
 const options=memberEntryCors({NODE_ENV:'production',CORS_ALLOWED_ORIGINS:'https://admin.stage.test, https://member.stage.test'});
 expect(options.origin).toEqual(['https://admin.stage.test','https://member.stage.test']);
 expect(options.methods).toContain('PATCH');expect(options.methods).toContain('PUT');expect(options.credentials).toBe(true);
});
it('retains default production origins and rejects wildcard/path configuration',()=>{
 expect(memberEntryCors({NODE_ENV:'production'}).origin).toEqual(['https://admin.ucell.life','https://app.ucell.life']);
 for(const value of ['*','https://member.stage.test/login','https://member.stage.test/'])expect(()=>memberEntryCors({CORS_ALLOWED_ORIGINS:value})).toThrow('exact');
});
