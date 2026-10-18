import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaService } from '@ucell/database';
import { writeFileSync } from 'node:fs';

const url = process.env.PHASE2_TEST_DATABASE_URL;
if (!url || !/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1))) throw Error('ISOLATED_DATABASE_REQUIRED');
describe('Institution registered admin HTTP routes', () => {
  const db = new PrismaService();
  let app: NestFastifyApplication;
  const routes: Array<{ method: string; url: string }> = [];
  beforeAll(async () => {
    process.env.ADMIN_AUTH_BYPASS = 'false';
    const { AppModule } = await import('../src/app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(db).compile();
    module.get(ConfigService).set('ADMIN_AUTH_BYPASS', 'false');
    const adapter = new FastifyAdapter();
    adapter.getInstance().addHook('onRoute', route => {
      if (route.url.startsWith('/api/v1/admin/')) {
        for (const method of Array.isArray(route.method) ? route.method : [route.method]) routes.push({ method, url: route.url });
      }
    });
    app = module.createNestApplication<NestFastifyApplication>(adapter, { logger: false });
    app.setGlobalPrefix('api/v1');
    await app.init();
    await adapter.getInstance().ready();
  }, 120000);
  afterAll(async () => { await app?.close(); await db.$disconnect(); });
  it('every registered admin method rejects an anonymous caller before reaching business writes', async () => {
    expect(routes.length).toBeGreaterThan(0);
    const evidence: Array<{ method: string; url: string; status: number }> = [];
    for (const route of routes) {
      const result = await app.inject({ method: route.method as any,
        url: route.url.replace(/:[^/]+/g, '00000000-0000-4000-8000-000000000001'),
      });
      evidence.push({ ...route, status: result.statusCode });
    }
    if (process.env.INSTITUTION_ROUTE_EVIDENCE_PATH) writeFileSync(process.env.INSTITUTION_ROUTE_EVIDENCE_PATH,
      JSON.stringify({ scope: 'REGISTERED_ADMIN_ROUTES_ANONYMOUS_ONLY', bypass: false, routes: evidence }, null, 2));
    expect(evidence.filter(row => row.status !== 401)).toEqual([]);
    console.log(`ADMIN_ROUTE_ANONYMOUS_PASS ${evidence.length} registered HTTP methods; not authorized functional acceptance`);
  }, 120000);
});
