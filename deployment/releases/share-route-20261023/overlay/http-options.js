"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTP_OPTIONS = void 0;
// Share tokens are encrypted URL-safe values validated up to 4096 characters.
// Both the social card and preview routes must accept the same bounded size.
exports.HTTP_OPTIONS = { logger: true, maxParamLength: 4096 };
//# sourceMappingURL=http-options.js.map