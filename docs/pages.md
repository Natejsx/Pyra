# Pages

Define your app's routes and UI using components — no configuration needed.

---

## What is a Page?

A page is a component that Pyra renders when a user visits a specific URL. You create a page by adding a `page.tsx` file to your `src/routes/` directory. Pyra automatically discovers it, maps it to a URL, and renders it on the server when requested.

There's no route registration, no `routes.config.ts`, and no imports to maintain. The file's location in the directory tree is the route.

---

## Creating a Page

Create a file at `src/routes/page.tsx` for the root route, or in any subdirectory for a nested route:

```
src/routes/
├── page.tsx          →  /
├── about/
│   └── page.tsx      →  /about
└── blog/
    └── page.tsx      →  /blog
```

Each `page.tsx` must `export default` a component:

```tsx
// src/routes/about/page.tsx

export default function About() {
  return (
    <div>
      <h1>About Us</h1>
      <p>We build great things.</p>
    </div>
  );
}
```

That's all you need. Visit `/about` and Pyra renders this component inside your layout.

---

## Dynamic Routes

For URLs with variable segments (like `/blog/hello-world` or `/users/42`), use square brackets in the directory name:

```
src/routes/
└── blog/
    └── [slug]/
        └── page.tsx   →  /blog/:slug
```

The variable part (`slug`) is available in your `load()` function via `context.params`:

```tsx
// src/routes/blog/[slug]/page.tsx

export async function load(context) {
  const post = await db.getPost(context.params.slug);
  return { post };
}

export default function BlogPost({ post }) {
  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
    </article>
  );
}
```

You can have multiple dynamic segments in the same route:

```
src/routes/
└── shop/
    └── [category]/
        └── [productId]/
            └── page.tsx   →  /shop/:category/:productId
```

Both `context.params.category` and `context.params.productId` are available.

---

## Catch-All Routes

To match any URL under a prefix (including unknown depths), use `[...name]` in the directory name:

```
src/routes/
└── docs/
    └── [...path]/
        └── page.tsx   →  /docs, /docs/getting-started, /docs/api/reference, etc.
```

`context.params.path` will be the full remaining path as a string (e.g., `"api/reference"`).

---

## The `load()` Function

If your page needs data — from a database, an API, or anywhere else — export a `load()` function. It runs on the server before the component renders, and its return value becomes the component's props.

```tsx
// src/routes/blog/page.tsx

export async function load(context) {
  const posts = await db.getPosts();
  return { posts };
}

export default function Blog({ posts }) {
  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

`load()` only ever runs on the server — never in the browser. This means you can safely query databases, use secret API keys, and read from the filesystem inside `load()`. None of that code is included in the client bundle.

### What `load()` Receives

The `load()` function receives a `RequestContext` with everything about the current request:

| Field | What it is |
|-------|------------|
| `context.params` | URL parameters — e.g., `{ slug: 'hello-world' }` |
| `context.url` | Parsed URL with `pathname`, `searchParams`, etc. |
| `context.request` | The Web standard [Request](https://developer.mozilla.org/en-US/docs/Web/API/Request) object |
| `context.headers` | Request headers |
| `context.cookies` | Cookie jar — `get()`, `set()`, `delete()`, `getAll()` |
| `context.env` | Environment variables prefixed with `PYRA_` (prefix stripped) |
| `context.mode` | `'development'` or `'production'` |
| `context.routeId` | The matched route ID (e.g., `/blog/[slug]`) |

### What `load()` Returns

Return a plain object. Its keys become your component's props. Route params are also always available as a `params` prop.

```tsx
export async function load(context) {
  return { title: 'Hello', count: 42 };
}

// Component receives: { title, count, params }
export default function MyPage({ title, count }) {
  return <h1>{title} — {count} items</h1>;
}
```

### Redirecting from `load()`

Return a `Response` from `load()` to short-circuit rendering and redirect the user:

```tsx
export async function load(context) {
  const session = context.cookies.get('session');
  if (!session) {
    return context.redirect('/login');
  }

  const user = await getUser(session);
  return { user };
}
```

The redirect happens before any rendering — the user is sent to `/login` immediately.

---

## Reading Query Parameters

Use `context.url.searchParams` inside `load()` to read query string values:

```tsx
// URL: /search?q=pyra&page=2

export async function load(context) {
  const query = context.url.searchParams.get('q') ?? '';
  const page = parseInt(context.url.searchParams.get('page') ?? '1');

  const results = await search(query, page);
  return { results, query, page };
}
```

---

## Static Prerendering

For pages that don't change between requests — blog posts, documentation, about pages — export `prerender = true` to have Pyra render the page once at build time instead of on every request:

```tsx
// src/routes/about/page.tsx

export const prerender = true;

export default function About() {
  return <h1>About Us</h1>;
}
```

The page becomes a static HTML file in `dist/client/`. The server serves it directly, with no rendering overhead.

### Prerendering Dynamic Routes

For dynamic routes, export a `prerender` object with a `paths()` function that returns the parameter values to render:

```tsx
// src/routes/blog/[slug]/page.tsx

export const prerender = {
  paths() {
    return [
      { slug: 'hello-world' },
      { slug: 'getting-started' },
    ];
  },
};

export async function load(context) {
  const post = await getPost(context.params.slug);
  return { post };
}

export default function BlogPost({ post }) {
  return <article><h1>{post.title}</h1></article>;
}
```

Pyra renders `/blog/hello-world` and `/blog/getting-started` at build time and saves them as static files.

---

## Cache Control

Control how long browsers and CDNs cache your page's response using the `cache` export:

```tsx
export const cache = {
  maxAge: 3600,               // Browser caches for 1 hour
  sMaxAge: 86400,             // CDN caches for 1 day
  staleWhileRevalidate: 604800, // Serve stale while fetching fresh in background
};

export default function PricingPage() {
  return <div>...</div>;
}
```

| Field | What it does |
|-------|-------------|
| `maxAge` | Seconds the browser can use its cached copy |
| `sMaxAge` | Seconds a CDN can use its cached copy |
| `staleWhileRevalidate` | Seconds a stale entry can be served while a fresh one is fetched in the background |

Pyra converts this into a `Cache-Control` response header.

---

## Route Groups

Wrap directory names in parentheses to group routes without affecting the URL. The group name is stripped from all routes inside it:

```
src/routes/
├── (marketing)/
│   ├── about/
│   │   └── page.tsx    →  /about
│   └── pricing/
│       └── page.tsx    →  /pricing
└── (app)/
    └── dashboard/
        └── page.tsx    →  /dashboard
```

Route groups are useful when you want different layouts for different sections of your app without adding extra URL segments. See the [Layouts doc](./layouts.md) for details.

---

## Supported File Extensions

The file extensions Pyra recognises for pages depend on the adapter you're using. The adapter declares which extensions it handles — for example, the React adapter supports `.tsx` and `.jsx`.

Common page file names:

- `page.tsx` — TypeScript with JSX (recommended for React)
- `page.jsx` — JavaScript with JSX
- `page.ts` — TypeScript without JSX
- `page.js` — JavaScript without JSX

See your adapter's documentation for the full list of supported extensions.

---

## Pages vs. API Routes

Pages (`page.tsx`) return HTML — they're rendered by the server, wrapped in layouts, and hydrated in the browser.

API routes (`route.ts`) return data — they handle HTTP requests directly and return `Response` objects.

If you need both a page and an API endpoint at the same path, they live in separate files:

```
src/routes/
└── users/
    ├── page.tsx    →  GET /users  (returns HTML)
    └── route.ts    →  GET /users  (returns JSON)
```

The adapter renders pages. Your handler code runs API routes. Pyra distinguishes between them by file name.

---

## A Full Example

Here's a complete page with data loading, caching, and error handling:

```tsx
// src/routes/products/[id]/page.tsx

export const cache = {
  maxAge: 300,
  sMaxAge: 3600,
};

export async function load(context) {
  const product = await db.products.findById(context.params.id);

  if (!product) {
    return context.redirect('/products');
  }

  return { product };
}

export default function ProductPage({ product }) {
  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      <span>${product.price}</span>
      <button onClick={() => addToCart(product.id)}>Add to Cart</button>
    </div>
  );
}
```

What Pyra does with this page when a user visits `/products/abc123`:

1. Matches the URL to this route — `params.id` is `"abc123"`
2. Runs any middleware in the chain
3. Calls `load()` on the server — fetches the product from the database
4. If the product doesn't exist, issues a redirect to `/products`
5. Renders the component to HTML with `{ product, params }` as props
6. Wraps the result in any layouts
7. Sets `Cache-Control` headers from the `cache` export
8. Sends the complete HTML to the browser
9. The browser hydrates the page — the "Add to Cart" button becomes clickable

---

## Tips

- **One page per URL.** You can only have one `page.tsx` per directory. If you need multiple pages at similar paths, use subdirectories.
- **Keep components in the component, data in `load()`.** Don't fetch inside your component — fetch in `load()` so the data is ready before rendering. This avoids loading states and makes pages faster.
- **Use prerendering for static content.** Blogs, landing pages, documentation — anything that doesn't change per-user is a good candidate for `export const prerender = true`.
- **`load()` is your backend entry point.** Treat it like a controller function. Query the database, check auth, build the props object. Keep the component itself presentational.
- **Route params are always strings.** `context.params.id` is always a string, even if it looks like a number. Parse it if needed: `parseInt(context.params.id)`.
