// Root middleware — runs before every request
export default async function rootMiddleware(context, next) {
  const response = await next();
  // Add header to the response
  const headers = new Headers(response.headers);
  headers.set("X-Root-Middleware", "true");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
