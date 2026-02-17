# middleware-auth

Tests Pyra's middleware system: stacked middleware, short-circuiting, and cookie-based auth.

## What it covers

| File | Applies to | Behaviour |
|---|---|---|
| `routes/middleware.ts` | All routes | Adds `X-Request-Id` and `X-Response-Time` headers |
| `routes/dashboard/middleware.ts` | `/dashboard/**` | Returns 401 if `session` cookie is absent |
| `routes/api/login/route.ts` | `POST /api/login` | Sets `session` cookie |
| `routes/api/logout/route.ts` | `GET /api/logout` | Clears `session` cookie, redirects home |
| `routes/api/login-demo/route.ts` | `GET /api/login-demo` | Convenience: sets cookie and redirects to `/dashboard` |

## Key concepts

- **Stacking**: root middleware runs first, then narrower middleware closer to the route.
- **Short-circuiting**: returning a `Response` from middleware without calling `next()` stops the chain — the route handler never runs.
- **Cookie mutations**: `ctx.cookies.set()` / `ctx.cookies.delete()` queue `Set-Cookie` response headers.
- **Middleware exports**: either `export default fn` or `export { middleware }` are accepted.

## Run

```bash
pnpm dev
```

1. Visit `http://localhost:3000` — you are not logged in.
2. Click **Log in** → **this demo link** to set the session cookie and land on `/dashboard`.
3. Inspect the response headers in DevTools to see `X-Request-Id` and `X-Authenticated-As`.
4. Click **Log out** to clear the cookie.
5. Navigate to `/dashboard` directly — you'll get a 401 JSON response.
