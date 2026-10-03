const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const {createRequire} = require('node:module');
const apiRequire = createRequire(require.resolve('../apps/api/package.json'));
const cliRequire = createRequire(apiRequire.resolve('jest-cli', {paths: [apiRequire.resolve('jest')]}));
const configRequire = createRequire(cliRequire.resolve('jest-config'));
const {TestEnvironment} = configRequire('jest-environment-node');
const dbRequire = createRequire(require.resolve('../packages/database/package.json'));
const {PrismaClient} = dbRequire('@prisma/client');

/** Every suite starts from the same migrated baseline, never a prior suite's committed fixtures. */
module.exports = class IsolatedDatabaseEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();
    const source = new URL(process.env.API_JEST_TEMPLATE_DATABASE_URL);
    assert.ok(['localhost', '127.0.0.1'].includes(source.hostname));
    const template = source.pathname.slice(1);
    assert.match(template, /^ucell_jest_[a-f0-9]{32}$/);
    this.database = 'ucell_jest_' + randomUUID().replaceAll('-', '');
    const control = new URL(source); control.pathname = '/postgres';
    this.admin = new PrismaClient({datasources: {db: {url: control.href}}});
    try {
      await this.admin.$executeRawUnsafe('CREATE DATABASE "' + this.database + '" TEMPLATE "' + template + '"');
      this.created = true;
      const target = new URL(source); target.pathname = '/' + this.database;
      for (const [key, value] of Object.entries(this.global.process.env)) {
        if ((key === 'DATABASE_URL' || key.endsWith('_TEST_DATABASE_URL') || key === 'V3_GOLDEN_DATABASE_URL') && value === source.href) {
          this.global.process.env[key] = target.href;
        }
      }
    } catch (error) {
      await this.admin.$disconnect();
      throw error;
    }
  }
  async teardown() {
    try {
      if (this.created) {
        assert.match(this.database, /^ucell_jest_[a-f0-9]{32}$/);
        assert.notEqual(this.database, new URL(process.env.API_JEST_TEMPLATE_DATABASE_URL).pathname.slice(1));
        await this.admin.$executeRawUnsafe('DROP DATABASE "' + this.database + '" WITH (FORCE)');
      }
    } finally {
      await this.admin?.$disconnect();
      await super.teardown();
    }
  }
};
