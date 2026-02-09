/**
 * v0.2 SSR Verification Script
 *
 * Starts the DevServer with the React adapter, makes HTTP requests,
 * and verifies SSR output.
 *
 * Run from repo root: node test-app/verify-ssr.mjs
 */
import { DevServer } from "../packages/core/dist/index.js";
import { createReactAdapter } from "../packages/adapter-react/dist/index.js";
import { resolve } from "node:path";
import http from "node:http";

const root = resolve(import.meta.dirname);
const routesDir = resolve(root, "src/routes");
const PORT = 3456; // Use non-standard port to avoid conflicts

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    failed++;
  }
}

/** Make an HTTP GET request and return { status, body } */
function get(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}${urlPath}`, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body, headers: res.headers }));
    }).on("error", reject);
  });
}

// ── Start server ──────────────────────────────────────────────────────────────

console.log("\n=== v0.2 SSR Verification ===\n");
console.log(`Starting dev server on port ${PORT}...`);

const adapter = createReactAdapter();
const server = new DevServer({ port: PORT, root, adapter, routesDir });
await server.start();

console.log("Server started. Running tests...\n");

try {
  // ── Test 1: Home page SSR ─────────────────────────────────────────────────

  console.log("--- Test: Home page (/) ---");
  const home = await get("/");
  assert(home.status === 200, `GET / returns 200 (got ${home.status})`);
  assert(home.body.includes("<h1>Welcome to Pyra</h1>"), "SSR rendered <h1>Welcome to Pyra</h1>");
  assert(home.body.includes("<!DOCTYPE html>"), "Response is a full HTML document");
  assert(home.body.includes("__pyra/modules"), "Contains hydration script (client module URL)");
  assert(home.body.includes("__pyra_hmr_client"), "Contains HMR client script");
  assert(home.headers["content-type"]?.includes("text/html"), "Content-Type is text/html");

  // ── Test 2: About page SSR ────────────────────────────────────────────────

  console.log("\n--- Test: About page (/about) ---");
  const about = await get("/about");
  assert(about.status === 200, `GET /about returns 200 (got ${about.status})`);
  assert(about.body.includes("<h1>About Pyra</h1>"), "SSR rendered <h1>About Pyra</h1>");

  // ── Test 3: Dynamic route with params ─────────────────────────────────────

  console.log("\n--- Test: Blog post (/blog/hello-world) ---");
  const blog = await get("/blog/hello-world");
  assert(blog.status === 200, `GET /blog/hello-world returns 200 (got ${blog.status})`);
  assert(blog.body.includes("hello-world"), "SSR rendered slug 'hello-world' in page body");
  assert(blog.body.includes("__pyra_data"), "Contains serialized data script for hydration");

  // Verify the data script contains the correct params
  const dataMatch = blog.body.match(/<script id="__pyra_data"[^>]*>(.*?)<\/script>/);
  if (dataMatch) {
    const data = JSON.parse(dataMatch[1]);
    assert(data.params?.slug === "hello-world", `Serialized params has slug='hello-world' (got ${JSON.stringify(data.params)})`);
  } else {
    assert(false, "Could not find __pyra_data script tag");
  }

  // ── Test 4: Another dynamic slug ──────────────────────────────────────────

  console.log("\n--- Test: Blog post (/blog/pyra-is-awesome) ---");
  const blog2 = await get("/blog/pyra-is-awesome");
  assert(blog2.status === 200, `GET /blog/pyra-is-awesome returns 200`);
  assert(blog2.body.includes("pyra-is-awesome"), "SSR rendered different slug");

  // ── Test 5: API route returns 501 ─────────────────────────────────────────

  console.log("\n--- Test: API route (/api/health) ---");
  const api = await get("/api/health");
  assert(api.status === 501, `GET /api/health returns 501 (got ${api.status})`);

  // ── Test 6: 404 for unknown paths ─────────────────────────────────────────

  console.log("\n--- Test: Unknown path (/nonexistent) ---");
  const notFound = await get("/nonexistent");
  assert(notFound.status === 404, `GET /nonexistent returns 404 (got ${notFound.status})`);

  // ── Test 7: Client module serving ─────────────────────────────────────────

  console.log("\n--- Test: Client module serving ---");
  const clientModule = await get("/__pyra/modules/src/routes/page.tsx");
  assert(clientModule.status === 200, `GET /__pyra/modules/src/routes/page.tsx returns 200`);
  assert(
    clientModule.headers["content-type"]?.includes("application/javascript"),
    "Client module served as JavaScript",
  );
  assert(clientModule.body.length > 100, `Client module has content (${clientModule.body.length} bytes)`);

  // ── Test 8: Trailing slash ────────────────────────────────────────────────

  console.log("\n--- Test: Trailing slash normalization ---");
  const trailing = await get("/about/");
  assert(trailing.status === 200, `GET /about/ returns 200 (got ${trailing.status})`);
  assert(trailing.body.includes("About Pyra"), "Trailing slash serves same page");

} finally {
  // ── Cleanup ─────────────────────────────────────────────────────────────────
  await server.stop();
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
