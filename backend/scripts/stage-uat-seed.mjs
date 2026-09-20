import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OPT_IN = 'SEED_STAGE_UAT_V1';
export const ALLOWED_DATABASE_NAMES = new Set(['ucell_stage']);

export function validateStageSeedEnvironment(env) {
  if (env.UCELL_ENVIRONMENT !== 'STAGE') throw new Error('Stage UAT seed requires UCELL_ENVIRONMENT=STAGE.');
  if (env.UCELL_STAGE_UAT_SEED_OPT_IN !== OPT_IN) throw new Error(`Stage UAT seed requires UCELL_STAGE_UAT_SEED_OPT_IN=${OPT_IN}.`);
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  let url;
  try { url = new URL(env.DATABASE_URL); } catch { throw new Error('DATABASE_URL must be a valid PostgreSQL URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Only PostgreSQL DATABASE_URL values are allowed.');
  const host = url.hostname.toLowerCase();
  const database = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') throw new Error('Localhost databases are forbidden.');
  if (!host.endsWith('.postgres.database.azure.com')) throw new Error('Database host is not in the Stage allowlist.');
  if (!ALLOWED_DATABASE_NAMES.has(database)) throw new Error('Database name is not in the Stage allowlist.');
  if (/prod(uction)?/i.test(`${host}/${database}`)) throw new Error('Production-like database targets are forbidden.');
  return { host, database };
}

export function assertSafeArguments(argv) {
  if (argv.some((value) => /(^|[-_:])(reset|drop|truncate|delete)([-_:]|$)/i.test(value))) throw new Error('Destructive seed arguments are forbidden.');
}

export async function seedStageUat(prisma, manifest, Decimal) {
  return prisma.$transaction(async (tx) => {
    const person = await tx.person.upsert({ where: { personId: manifest.person.personId }, update: { legalName: manifest.person.legalName, status: 'EFFECTIVE', membershipState: 'FORMAL_MEMBER' }, create: { ...manifest.person, status: 'EFFECTIVE', membershipState: 'FORMAL_MEMBER' } });
    const qualification = await tx.qualification.upsert({ where: { qualificationId: manifest.qualification.qualificationId }, update: { currentHolderPersonId: person.personId, planLevelCode: manifest.qualification.planLevelCode, status: 'EFFECTIVE' }, create: { ...manifest.qualification, currentHolderPersonId: person.personId, status: 'EFFECTIVE', effectiveAt: new Date('2026-09-01T00:00:00Z') } });
    const product = await tx.productReference.upsert({ where: { productId: manifest.product.productId }, update: { sku: manifest.product.sku, displayName: manifest.product.displayName, currentPrice: new Decimal(manifest.product.currentPrice), isActive: true }, create: { ...manifest.product, currentPrice: new Decimal(manifest.product.currentPrice), isActive: true } });
    const order = await tx.order.upsert({ where: { orderId: manifest.order.orderId }, update: { qualificationId: qualification.qualificationId, clientReference: manifest.order.clientReference }, create: { ...manifest.order, qualificationId: qualification.qualificationId, purpose: 'RETAIL', status: 'DRAFT', discountAmount: new Decimal(0), netAmount: new Decimal(manifest.order.grossAmount), grossAmount: new Decimal(manifest.order.grossAmount), ruleVersionCode: manifest.version } });
    await tx.orderLine.upsert({ where: { orderLineId: manifest.orderLine.orderLineId }, update: {}, create: { orderLineId: manifest.orderLine.orderLineId, orderId: order.orderId, productId: product.productId, skuSnapshot: product.sku, productNameSnapshot: product.displayName, quantity: new Decimal(1), unitPrice: new Decimal(manifest.product.currentPrice), lineAmount: new Decimal(manifest.order.grossAmount), gpvRateSnapshot: new Decimal(0), gpvAmountSnapshot: new Decimal(0), ruleProfileSnapshot: { seed: manifest.version, monetaryRecognition: false } } });
    const warehouse = await tx.warehouse.upsert({ where: { warehouseId: manifest.warehouse.warehouseId }, update: { code: manifest.warehouse.code, name: manifest.warehouse.name, status: 'EFFECTIVE' }, create: { ...manifest.warehouse, status: 'EFFECTIVE' } });
    const item = await tx.inventoryItem.upsert({ where: { inventoryItemId: manifest.inventoryItem.inventoryItemId }, update: { productId: product.productId, sku: manifest.inventoryItem.sku, status: 'EFFECTIVE' }, create: { ...manifest.inventoryItem, productId: product.productId, status: 'EFFECTIVE', trackingMode: 'NONE' } });
    await tx.inventoryBalance.upsert({ where: { warehouseId_inventoryItemId: { warehouseId: warehouse.warehouseId, inventoryItemId: item.inventoryItemId } }, update: {}, create: { warehouseId: warehouse.warehouseId, inventoryItemId: item.inventoryItemId, onHand: new Decimal(manifest.balance.onHand), reserved: new Decimal(manifest.balance.reserved) } });
    return { manifestVersion: manifest.version, personId: person.personId, qualificationId: qualification.qualificationId, productId: product.productId, orderId: order.orderId, warehouseId: warehouse.warehouseId, inventoryItemId: item.inventoryItemId };
  });
}

async function main() {
  assertSafeArguments(process.argv.slice(2));
  validateStageSeedEnvironment(process.env);
  const manifest = JSON.parse(readFileSync(new URL('./stage-uat-seed-manifest.json', import.meta.url), 'utf8'));
  const { PrismaClient, Prisma } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try { console.log(JSON.stringify(await seedStageUat(prisma, manifest, Prisma.Decimal))); } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main().catch((error) => { console.error(`STAGE_UAT_SEED_FAIL: ${error.message}`); process.exitCode = 1; });
