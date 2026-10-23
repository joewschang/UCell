"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const kyc_upload_transport_1 = require("./modules/member/kyc-upload-transport");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = require("@fastify/helmet");
const cors_1 = require("@fastify/cors");
const member_entry_cors_1 = require("./member-entry-cors");
const app_module_1 = require("./app.module");
const api_exception_filter_1 = require("./common/filters/api-exception.filter");
const envelope_interceptor_1 = require("./common/interceptors/envelope.interceptor");
const request_context_interceptor_1 = require("./common/interceptors/request-context.interceptor");
const line_webhook_transport_1 = require("./modules/auth/line-webhook-transport");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter(require("./http-options").HTTP_OPTIONS));
    const config = app.get(config_1.ConfigService);
    (0, line_webhook_transport_1.configureLineWebhookTransport)(app);
    (0, kyc_upload_transport_1.configureKycUploadTransport)(app.getHttpAdapter().getInstance());
    await app.register(helmet_1.default);
    await app.register(cors_1.default, (0, member_entry_cors_1.memberEntryCors)(process.env));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    app.useGlobalFilters(new api_exception_filter_1.ApiExceptionFilter());
    app.useGlobalInterceptors(new request_context_interceptor_1.RequestContextInterceptor(), new envelope_interceptor_1.EnvelopeInterceptor());
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('UCell R1.0B API')
        .setDescription('UCell Core API. API version and Rule Version are independent.')
        .setVersion('1.0.0')
        .addBearerAuth(undefined, 'adminBearer')
        .addBearerAuth(undefined, 'memberBearer')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    if (config.get('SWAGGER_ENABLED') === 'true') {
        swagger_1.SwaggerModule.setup('docs', app, document);
    }
    await app.listen(Number(config.get('PORT') ?? 3000), '0.0.0.0');
}
bootstrap();
//# sourceMappingURL=main.js.map