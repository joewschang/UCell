"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const idempotency_module_1 = require("../../common/idempotency/idempotency.module");
const marketing_service_1 = require("./marketing.service");
const marketing_controller_1 = require("./marketing.controller");
let MarketingModule = class MarketingModule {
};
exports.MarketingModule = MarketingModule;
exports.MarketingModule = MarketingModule = __decorate([
    (0, common_1.Module)({ imports: [auth_module_1.AuthModule, idempotency_module_1.IdempotencyModule], providers: [marketing_service_1.MarketingService], controllers: [marketing_controller_1.AdminMarketingController, marketing_controller_1.MemberMarketingController] })
], MarketingModule);
//# sourceMappingURL=marketing.module.js.map