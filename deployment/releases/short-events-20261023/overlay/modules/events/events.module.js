"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberEventsModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const idempotency_module_1 = require("../../common/idempotency/idempotency.module");
const events_service_1 = require("./events.service");
const events_controller_1 = require("./events.controller");
let MemberEventsModule = class MemberEventsModule {
};
exports.MemberEventsModule = MemberEventsModule;
exports.MemberEventsModule = MemberEventsModule = __decorate([
    (0, common_1.Module)({ imports: [auth_module_1.AuthModule, idempotency_module_1.IdempotencyModule], controllers: [events_controller_1.AdminEventsController, events_controller_1.MemberEventsController, events_controller_1.PublicEventImagesController], providers: [events_service_1.MemberEventsService] })
], MemberEventsModule);
//# sourceMappingURL=events.module.js.map