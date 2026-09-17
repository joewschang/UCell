import {expect,it} from 'vitest';
import {backendRoutes,backendRouteSnapshot} from './routes';

it('labels the UI route list as a dated, scoped snapshot',()=>{
  expect(backendRouteSnapshot.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(backendRouteSnapshot.scope).toContain('Selected');
  expect(backendRouteSnapshot.authoritativeSource).toBe('backend/openapi.generated.json');
});

it('keeps duplicate operation keys out of the curated snapshot',()=>{
  const keys=backendRoutes.map(({method,path})=>`${method} ${path}`);
  expect(new Set(keys).size).toBe(keys.length);
});

it('records the audited OpenAPI drift without treating the snapshot as authoritative',()=>{
  expect(backendRouteSnapshot.knownOpenApiPathCountAtAudit).toBe(123);
  expect(backendRouteSnapshot.knownOpenApiOperationCountAtAudit).toBe(134);
  expect(backendRouteSnapshot.knownOpenApiOperationCountAtAudit).toBeGreaterThan(backendRoutes.length);
});
