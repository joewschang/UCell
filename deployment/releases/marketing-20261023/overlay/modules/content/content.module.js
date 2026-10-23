"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentModule = void 0;
const member_share_link_service_1 = require("../member/member-share-link.service");
const content_insights_service_1 = require("./content-insights.service");
const content_insights_controller_1 = require("./content-insights.controller");
const marketing_module_1 = require('./marketing.module');
const common_1 = require("@nestjs/common");
const content_service_1 = require("./content.service");
const auth_module_1 = require("../auth/auth.module");
const content_controller_1 = require("./content.controller");
let ContentModule = class ContentModule {
};
exports.ContentModule = ContentModule;
exports.ContentModule = ContentModule = __decorate([
    (0, common_1.Module)({ imports: [auth_module_1.AuthModule, marketing_module_1.MarketingModule], controllers: [content_insights_controller_1.MemberContentInsightsController, content_insights_controller_1.AdminContentInsightsController, content_insights_controller_1.MemberContentShareController, content_controller_1.AdminContentController, content_controller_1.MemberContentController, content_controller_1.PublicContentController], providers: [content_service_1.ContentService, content_insights_service_1.ContentInsightsService, member_share_link_service_1.MemberShareLinkService] })
], ContentModule);
//# sourceMappingURL=content.module.js.map