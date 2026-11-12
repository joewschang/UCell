'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');

const appDir = process.argv[2] || '/app/apps/api/dist';
const load = createRequire(path.join(appDir, 'main.js'));
load('reflect-metadata');
const { PATH_METADATA, MODULE_METADATA } = load('@nestjs/common/constants');
const { EnrollmentBundleController } = load('./modules/member-bundle/enrollment-bundle.controller');
const { OrderModule } = load('./modules/order/order.module');
const { OrderController } = load('./modules/order/order.controller');
const { PaperIntakeController } = load('./modules/order/paper-intake.controller');
const { OrderService } = load('./modules/order/order.service');
const { adminEnrollmentReview } = load('./modules/member-bundle/admin-bundle-review');
const { activateEnrollmentBundleIfReady } = load('./modules/member-bundle/excellence-activation');
const { preparePackageMonthlySchedule } = load('@ucell/database');
assert(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, OrderModule).includes(EnrollmentBundleController));
assert(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, OrderModule).includes(PaperIntakeController));
assert.equal(Reflect.getMetadata(PATH_METADATA, EnrollmentBundleController), 'member/formal-enrollment/applications/:applicationId/bundle');
assert.equal(Reflect.getMetadata(PATH_METADATA, OrderController.prototype.confirmBundle), ':orderId/bundle-payment-confirmations');
for (const method of [OrderService.applyEnrollmentAllocation, preparePackageMonthlySchedule, adminEnrollmentReview, activateEnrollmentBundleIfReady]) assert.equal(typeof method, 'function');
for (const entry of require('./runtime-delta.json').files) load('./' + entry.file);
console.log('Verified member and admin routes, paper enrollment, allocation and monthly scheduling in the runtime image');

