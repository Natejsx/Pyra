// Dashboard middleware — checks for auth cookie, redirects if missing
export default async function dashboardMiddleware(context, next) {
  const authToken = context.cookies.get("auth_token");
  if (!authToken) {
    return context.redirect("/login", 302);
  }

  const response = await next();
  const headers = new Headers(response.headers);
  headers.set("X-Dashboard-Middleware", "true");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
