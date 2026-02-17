# api-crud

Tests Pyra's API route system: HTTP method dispatch, 405 Method Not Allowed, and catch-all API routes.

## What it covers

| Method | Path | Handler |
|---|---|---|
| GET | `/api/items` | List all items |
| POST | `/api/items` | Create an item |
| GET | `/api/items/:id` | Get one item |
| PUT | `/api/items/:id` | Update one item |
| DELETE | `/api/items/:id` | Delete one item |
| GET | `/api/echo/*` | Catch-all echo |

## Key concepts

- Each exported function name (`GET`, `POST`, `PUT`, `DELETE`) maps to an HTTP method.
- Requesting an unsupported method returns **405 Method Not Allowed** with an `Allow` header.
- Catch-all `[...path]` works on API routes just like on pages.
- `ctx.request.json()` parses the request body (Web standard `Request`).
- In-memory store (`src/data/store.ts`) simulates a database.

## Run

```bash
pnpm dev
```

Then exercise the API:

```bash
curl http://localhost:3000/api/items
curl -X POST http://localhost:3000/api/items \
     -H 'Content-Type: application/json' \
     -d '{"name":"Delta","value":400}'
curl http://localhost:3000/api/echo/foo/bar/baz
```
