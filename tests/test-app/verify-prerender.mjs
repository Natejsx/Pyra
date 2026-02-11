/**
 * v0.7 SSG & Prerendering Verification Script
 *
 * Tests that prerendered pages are generated at build time and served
 * directly in production, plus CacheConfig support.
 *
 * Run from repo root: node test-app/verify-prerender.mjs
 */
import { ProdServer, build } from "../packages/core/dist/index.js";
import { createReactAdapter } from "../packages/adapter-react/dist/index.js";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";

const root = resolve(import.meta.dirname);
const PROD_PORT = 3460;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \u2713 ${message}`);
    passed++;
  } else {
    console.log(`  \u2717 ${message}`);
    failed++;
  }
}

function stripComments(html) {
  return html.replace(/<!-- -->/g, "");
}

function get(port, urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://localhost:${port}${urlPath}`, { headers: options.headers || {} }, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({ status: res.statusCode, body, headers: res.headers }),
        );
      })
      .on("error", reject);
  });
}

// ── Phase 1: Build ──────────────────────────────────────────────────────────

console.log("=== v0.7 SSG & Prerendering Verification ===\n");

const adapter = createReactAdapter();

console.log("── Building for production ──");
const result = await build({
  root,
  adapter,
  config: { outDir: "dist", appContainerId: "app", routesDir: "src/routes" },
  silent: true,
});
console.log("Build complete.\n");

// ── Phase 2: Verify build output (static files exist) ─────────────────────

console.log("── Build Output Verification ──\n");

const distDir = resolve(root, "dist");
const clientDir = resolve(distDir, "client");

// Static prerender: /about → dist/client/about/index.html
console.log("Static prerender (/about):");
{
  const aboutHtml = resolve(clientDir, "about/index.html");
  assert(existsSync(aboutHtml), `dist/client/about/index.html exists`);
  if (existsSync(aboutHtml)) {
    const content = readFileSync(aboutHtml, "utf-8");
    assert(content.includes("About Pyra"), "Prerendered HTML contains page content");
    assert(content.includes("__pyra_data"), "Prerendered HTML contains hydration data");
    assert(content.includes("<script type=\"module\">"), "Prerendered HTML contains hydration script");
  }
}

// Dynamic prerender: /posts/[slug] → 3 pages
console.log("\nDynamic prerender (/posts/[slug]):");
{
  for (const slug of ["hello", "world", "foo"]) {
    const htmlPath = resolve(clientDir, `posts/${slug}/index.html`);
    assert(existsSync(htmlPath), `dist/client/posts/${slug}/index.html exists`);
    if (existsSync(htmlPath)) {
      const content = readFileSync(htmlPath, "utf-8");
      assert(
        stripComments(content).includes(`Post: ${slug}`),
        `posts/${slug} contains correct title "Post: ${slug}"`,
      );
    }
  }
}

// Non-prerendered route should NOT have a static HTML file
console.log("\nNon-prerendered routes:");
{
  const cachedHtml = resolve(clientDir, "cached/index.html");
  assert(!existsSync(cachedHtml), "dist/client/cached/index.html does NOT exist (SSR-only)");
}

// ── Phase 3: Verify manifest ──────────────────────────────────────────────

console.log("\n── Manifest Verification ──\n");

const manifest = result.manifest;

console.log("About route manifest entry:");
{
  const entry = manifest.routes["/about"];
  assert(entry !== undefined, "/about exists in manifest");
  assert(entry?.prerendered === true, "/about has prerendered: true");
  assert(entry?.prerenderedFile === "about/index.html", "/about has correct prerenderedFile");
}

console.log("\nPosts/[slug] route manifest entry:");
{
  const entry = manifest.routes["/posts/[slug]"];
  assert(entry !== undefined, "/posts/[slug] exists in manifest");
  assert(entry?.prerendered === true, "/posts/[slug] has prerendered: true");
  assert(entry?.prerenderedCount === 3, `/posts/[slug] has prerenderedCount: 3 (got ${entry?.prerenderedCount})`);
}

console.log("\nCached route manifest entry:");
{
  const entry = manifest.routes["/cached"];
  assert(entry !== undefined, "/cached exists in manifest");
  assert(entry?.prerendered !== true, "/cached is NOT prerendered");
  assert(entry?.cache !== undefined, "/cached has cache config");
  assert(entry?.cache?.maxAge === 3600, `/cached has cache.maxAge: 3600 (got ${entry?.cache?.maxAge})`);
  assert(entry?.cache?.sMaxAge === 7200, `/cached has cache.sMaxAge: 7200`);
}

// ── Phase 4: Prod server tests ──────────────────────────────────────────────

console.log("\n── Production Server Tests ──\n");

const prod = new ProdServer({
  distDir,
  adapter,
  port: PROD_PORT,
  config: { appContainerId: "app" },
});

await prod.start();

// Prerendered static page
console.log("Prerendered page serving (/about):");
{
  const res = await get(PROD_PORT, "/about");
  assert(res.status === 200, `GET /about → 200 (got ${res.status})`);
  assert(res.body.includes("About Pyra"), "Response contains prerendered content");
  assert(res.headers["content-type"]?.includes("text/html"), "Content-Type is text/html");
}

// Prerendered dynamic pages
console.log("\nPrerendered dynamic pages (/posts/[slug]):");
for (const slug of ["hello", "world", "foo"]) {
  const res = await get(PROD_PORT, `/posts/${slug}`);
  assert(res.status === 200, `GET /posts/${slug} → 200 (got ${res.status})`);
  assert(
    stripComments(res.body).includes(`Post: ${slug}`),
    `/posts/${slug} contains correct title`,
  );
}

// Non-prerendered slug should 404 (wasn't pre-built)
console.log("\nNon-prerendered slug:");
{
  const res = await get(PROD_PORT, "/posts/not-prerendered");
  // This could be 404 or fall through to SSR depending on implementation
  // Since the route IS a page route but not prerendered for this slug,
  // and prerendered: true means ALL paths should be prerendered,
  // it should still serve via the prerender path but the HTML won't exist
  // Actually, the manifest says prerendered: true, so prod server will try
  // to serve the static file which doesn't exist → 404
  assert(res.status === 404, `GET /posts/not-prerendered → 404 (got ${res.status})`);
}

// SSR page with CacheConfig
console.log("\nSSR page with CacheConfig (/cached):");
{
  const res = await get(PROD_PORT, "/cached");
  assert(res.status === 200, `GET /cached → 200 (got ${res.status})`);
  assert(res.body.includes("Cached Page"), "Response contains SSR content");
  const cc = res.headers["cache-control"] || "";
  assert(cc.includes("max-age=3600"), `Cache-Control includes max-age=3600 (got: ${cc})`);
  assert(cc.includes("s-maxage=7200"), `Cache-Control includes s-maxage=7200 (got: ${cc})`);
  assert(
    cc.includes("stale-while-revalidate=300"),
    `Cache-Control includes stale-while-revalidate=300 (got: ${cc})`,
  );
  assert(cc.includes("public"), `Cache-Control includes "public" (got: ${cc})`);
}

// SSR page WITHOUT CacheConfig (default: no-cache)
console.log("\nSSR page without CacheConfig (/):");
{
  const res = await get(PROD_PORT, "/");
  assert(res.status === 200, `GET / → 200 (got ${res.status})`);
  const cc = res.headers["cache-control"] || "";
  assert(cc === "no-cache", `Cache-Control is "no-cache" (got: "${cc}")`);
}

// API routes still work
console.log("\nAPI routes still work:");
{
  const res = await get(PROD_PORT, "/api/health");
  assert(res.status === 200, `GET /api/health → 200 (got ${res.status})`);
}

await prod.stop();
console.log("\nProduction server stopped.");

// ── Summary ──────────────────────────────────────────────────────────────────

console.log("\n=== Results ===");
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);

if (failed > 0) {
  console.log("\nSOME TESTS FAILED");
  process.exit(1);
} else {
  console.log("\nALL TESTS PASSED");
}
