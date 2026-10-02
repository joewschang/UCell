// Member updates use PATCH and Admin package product pools use PUT.
// CORS transport does not replace route authentication, roles or idempotency guards.
export const corsMethods = ['GET', 'HEAD', 'POST', 'PATCH', 'PUT'];
