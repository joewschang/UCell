// Share tokens are encrypted URL-safe values validated up to 4096 characters.
// Both the social card and preview routes must accept the same bounded size.
export const HTTP_OPTIONS = { logger: true, maxParamLength: 4096 } as const;
