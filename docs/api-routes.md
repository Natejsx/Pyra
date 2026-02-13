# API Routes

Build backend endpoints right alongside your pages.

---

## What are API Routes?

API routes let you create backend endpoints — REST APIs, webhooks, health checks, form handlers — inside the same project as your pages. No separate backend server needed.

If you've ever built a frontend that talks to a separate API server, you know the hassle: two repos, two deploys, CORS headers, environment syncing. With Pyra, your API lives in the same directory tree as your pages. Create a `route.ts` file, export some handler functions, and you have a working endpoint.

---

## Creating an API Route

Create a `route.ts` (or `route.js`) file in any directory under `src/routes/`. The directory path becomes the URL, just like page routes.

```ts
// src/routes/api/hello/route.ts

export function GET(context) {
  return context.json({ message: 'Hello, world!' });
}
```

That's it. You now have a `GET /api/hello` endpoint that returns JSON.

The directory structure determines the URL:

| File | Endpoint |
|------|----------|
| `src/routes/api/hello/route.ts` | `/api/hello` |
| `src/routes/api/users/route.ts` | `/api/users` |
| `src/routes/api/users/[id]/route.ts` | `/api/users/:id` |
| `src/routes/api/auth/[...path]/route.ts` | `/api/auth/*` |

---

## HTTP Method Handlers

Export a named function for each HTTP method you want to handle. The function name must match the method exactly:

```ts
// src/routes/api/users/route.ts

export function GET(context) {
  // Handle GET /api/users
}

export function POST(context) {
  // Handle POST /api/users
}
```

Supported methods: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`.

Any method you don't export automatically returns a `405 Method Not Allowed` response. If your endpoint only handles `GET` and `POST`, a `PUT` request will get a 405 without you writing any code for it.

---

## The Request Context

Every handler receives a `context` object with information about the request and helpers for building responses.

### Request Information

| Field | What it is | Example |
|-------|-----------|---------|
| `context.request` | The Web standard [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) | Reading the body, checking method |
| `context.url` | Parsed URL object | `context.url.searchParams.get('page')` |
| `context.params` | Route parameters | `{ id: '123' }` for `/api/users/123` |
| `context.headers` | Request headers | `context.headers.get('authorization')` |
| `context.cookies` | Cookie jar | `context.cookies.get('session')` |
| `context.env` | Environment variables | `context.env.API_KEY` (from `PYRA_API_KEY`) |
| `context.mode` | Current mode | `'development'` or `'production'` |
| `context.routeId` | Matched route ID | `'/api/users/[id]'` |

### Response Helpers

Instead of manually constructing `Response` objects, use these shortcuts:

| Helper | What it does |
|--------|-------------|
| `context.json(data, init?)` | Returns a JSON response with `Content-Type: application/json` |
| `context.text(body, init?)` | Returns a plain text response |
| `context.html(body, init?)` | Returns an HTML response |
| `context.redirect(url, status?)` | Returns a redirect response (default 302) |

The optional `init` parameter lets you set the status code and additional headers:

```ts
return context.json({ error: 'Not found' }, { status: 404 });

return context.json(data, {
  status: 200,
  headers: { 'X-Custom-Header': 'value' },
});
```

---

## Examples

### A Simple CRUD API

```ts
// src/routes/api/users/route.ts

export async function GET(context) {
  const users = await db.users.findAll();
  return context.json(users);
}

export async function POST(context) {
  const body = await context.request.json();
  const user = await db.users.create(body);
  return context.json(user, { status: 201 });
}
```

```ts
// src/routes/api/users/[id]/route.ts

export async function GET(context) {
  const user = await db.users.findById(context.params.id);

  if (!user) {
    return context.json({ error: 'User not found' }, { status: 404 });
  }

  return context.json(user);
}

export async function PUT(context) {
  const body = await context.request.json();
  const updated = await db.users.update(context.params.id, body);
  return context.json(updated);
}

export async function DELETE(context) {
  await db.users.delete(context.params.id);
  return context.json({ deleted: true });
}
```

### Reading Query Parameters

Use `context.url.searchParams` for query string values:

```ts
// GET /api/users?page=2&limit=20

export function GET(context) {
  const page = parseInt(context.url.searchParams.get('page') || '1');
  const limit = parseInt(context.url.searchParams.get('limit') || '10');

  const users = await db.users.paginate({ page, limit });
  return context.json({ users, page, limit });
}
```

### Reading the Request Body

The `context.request` is a standard Web [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) object. Use its built-in methods to read the body:

```ts
// JSON body
export async function POST(context) {
  const data = await context.request.json();
  return context.json({ received: data });
}

// Plain text body
export async function POST(context) {
  const text = await context.request.text();
  return context.text(`You sent: ${text}`);
}

// Form data
export async function POST(context) {
  const form = await context.request.formData();
  const name = form.get('name');
  return context.json({ name });
}
```

### Working with Cookies

The `context.cookies` object lets you read, set, and delete cookies:

```ts
// src/routes/api/auth/login/route.ts

export async function POST(context) {
  const { email, password } = await context.request.json();
  const session = await authenticate(email, password);

  if (!session) {
    return context.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Set a session cookie
  context.cookies.set('session', session.token, {
    httpOnly: true,     // Not accessible via JavaScript
    secure: true,       // Only sent over HTTPS
    sameSite: 'strict', // Not sent with cross-site requests
    maxAge: 60 * 60 * 24, // Expires in 1 day
    path: '/',
  });

  return context.json({ success: true });
}
```

```ts
// src/routes/api/auth/logout/route.ts

export function POST(context) {
  context.cookies.delete('session');
  return context.json({ loggedOut: true });
}
```

```ts
// Reading a cookie
export function GET(context) {
  const session = context.cookies.get('session');

  if (!session) {
    return context.json({ error: 'Not logged in' }, { status: 401 });
  }

  return context.json({ authenticated: true });
}
```

Cookie options:

| Option | Type | Description |
|--------|------|-------------|
| `maxAge` | `number` | Seconds until the cookie expires |
| `expires` | `Date` | Expiration date |
| `path` | `string` | URL path the cookie applies to |
| `domain` | `string` | Domain the cookie applies to |
| `secure` | `boolean` | Only send over HTTPS |
| `httpOnly` | `boolean` | Not accessible via `document.cookie` |
| `sameSite` | `'strict' \| 'lax' \| 'none'` | Cross-site request policy |

### Redirects

```ts
export function GET(context) {
  return context.redirect('/new-location');       // 302 temporary
  return context.redirect('/new-location', 301);  // 301 permanent
}
```

---

## Environment Variables

Pyra exposes environment variables through `context.env`, but only those prefixed with `PYRA_`. The prefix is stripped from the key name:

| Environment Variable | Accessible as |
|---------------------|---------------|
| `PYRA_API_KEY` | `context.env.API_KEY` |
| `PYRA_DATABASE_URL` | `context.env.DATABASE_URL` |
| `SECRET_KEY` | Not accessible (no `PYRA_` prefix) |

This filtering is a safety measure. It prevents you from accidentally exposing sensitive system variables. If you want a variable available in your routes, prefix it with `PYRA_`.

---

## Dynamic Segments and Catch-Alls

API routes support the same dynamic segments as page routes:

```
src/routes/api/users/[id]/route.ts          # /api/users/:id
src/routes/api/repos/[owner]/[repo]/route.ts # /api/repos/:owner/:repo
src/routes/api/files/[...path]/route.ts     # /api/files/* (any depth)
```

```ts
// src/routes/api/files/[...path]/route.ts

export function GET(context) {
  const filePath = context.params.path; // e.g., "docs/api/getting-started"
  return context.json({ path: filePath });
}
```

---

## Page vs. API Route Rule

A directory cannot contain both `page.tsx` and `route.ts`. A path is either a page or an API endpoint, not both. Pyra will throw an error if it finds both in the same directory.

If you need both a page and an API at similar paths, separate them:

```
src/routes/
├── users/
│   └── page.tsx            # /users (the page users see)
└── api/
    └── users/
        └── route.ts        # /api/users (the API the page calls)
```

---

## Middleware with API Routes

Middleware files in parent directories apply to API routes, just like they do with pages. This is useful for shared concerns like authentication or logging:

```
src/routes/
├── middleware.ts            # Runs on ALL requests (pages and API)
└── api/
    ├── middleware.ts        # Runs on all API requests
    ├── health/
    │   └── route.ts        # GET /api/health
    └── users/
        └── route.ts        # GET, POST /api/users
```

A request to `/api/users` runs the root middleware first, then the API middleware, then the route handler.

---

## Tips

- **Use the `api/` directory convention.** It's not enforced by Pyra, but keeping API routes under `api/` makes it obvious which paths are endpoints vs. pages.
- **Handlers can be async or sync.** If you need to await a database call, make the function `async`. If it's a simple response, sync is fine.
- **Always return a Response.** Every handler must return a `Response` object. Use the context helpers (`json()`, `text()`, etc.) for convenience.
- **Read the body only once.** The request body is a stream — you can only call `request.json()` or `request.text()` once per request. If you need the body in multiple places, read it once and pass it around.
- **Use route parameters for resource IDs.** `/api/users/[id]` is cleaner than `/api/users?id=123` for identifying specific resources.
