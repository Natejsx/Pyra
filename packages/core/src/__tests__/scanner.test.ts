import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scanRoutes } from '../scanner.js';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ─── Helpers ──────────────────────────────────────────────────────────────────

let routesDir: string;

function createFile(relativePath: string): void {
  const fullPath = join(routesDir, relativePath);
  const dir = fullPath.substring(0, fullPath.lastIndexOf(/[/\\]/.test(fullPath) ? (fullPath.includes('\\') ? '\\' : '/') : '/'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, '');
}

/**
 * Create a temp routes directory and populate it with files.
 * Keys are relative paths like 'page.tsx' or 'about/page.tsx'.
 */
function setupRoutes(files: string[]): void {
  routesDir = mkdtempSync(join(tmpdir(), 'pyra-test-'));
  for (const file of files) {
    const fullPath = join(routesDir, file);
    // Create parent directories
    const parts = file.split('/');
    if (parts.length > 1) {
      mkdirSync(join(routesDir, ...parts.slice(0, -1)), { recursive: true });
    }
    writeFileSync(fullPath, '');
  }
}

beforeEach(() => {
  routesDir = '';
});

afterEach(() => {
  if (routesDir) {
    rmSync(routesDir, { recursive: true, force: true });
  }
});

// ─── Static page routes ──────────────────────────────────────────────────────

describe('scanRoutes — static page discovery', () => {
  it('discovers a root page', async () => {
    setupRoutes(['page.tsx']);
    const result = await scanRoutes(routesDir);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].id).toBe('/');
    expect(result.routes[0].type).toBe('page');
  });

  it('discovers nested static pages', async () => {
    setupRoutes([
      'page.tsx',
      'about/page.tsx',
      'about/team/page.tsx',
    ]);
    const result = await scanRoutes(routesDir);
    const ids = result.routes.map(r => r.id).sort();
    expect(ids).toEqual(['/', '/about', '/about/team']);
  });
});

// ─── API routes ──────────────────────────────────────────────────────────────

describe('scanRoutes — API routes', () => {
  it('discovers an API route', async () => {
    setupRoutes(['api/health/route.ts']);
    const result = await scanRoutes(routesDir);
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].type).toBe('api');
    expect(result.routes[0].id).toBe('/api/health');
  });
});

// ─── Dynamic routes ──────────────────────────────────────────────────────────

describe('scanRoutes — dynamic routes', () => {
  it('discovers a dynamic page route and extracts params', async () => {
    setupRoutes(['blog/[slug]/page.tsx']);
    const result = await scanRoutes(routesDir);
    const route = result.routes[0];
    expect(route.id).toBe('/blog/[slug]');
    expect(route.pattern).toBe('/blog/:slug');
    expect(route.params).toEqual(['slug']);
    expect(route.catchAll).toBe(false);
  });

  it('discovers a catch-all route', async () => {
    setupRoutes(['docs/[...path]/page.tsx']);
    const result = await scanRoutes(routesDir);
    const route = result.routes[0];
    expect(route.id).toBe('/docs/[...path]');
    expect(route.pattern).toBe('/docs/*path');
    expect(route.catchAll).toBe(true);
    expect(route.params).toEqual(['path']);
  });
});

// ─── Route groups ────────────────────────────────────────────────────────────

describe('scanRoutes — route groups', () => {
  it('strips route group segment from route IDs', async () => {
    setupRoutes(['(marketing)/pricing/page.tsx']);
    const result = await scanRoutes(routesDir);
    expect(result.routes[0].id).toBe('/pricing');
  });
});

// ─── Layouts ─────────────────────────────────────────────────────────────────

describe('scanRoutes — layouts', () => {
  it('discovers a root layout', async () => {
    setupRoutes(['layout.tsx', 'page.tsx']);
    const result = await scanRoutes(routesDir);
    expect(result.layouts).toHaveLength(1);
    expect(result.layouts[0].id).toBe('/');
  });

  it('assigns layoutId to routes under a layout', async () => {
    setupRoutes([
      'layout.tsx',
      'page.tsx',
      'about/page.tsx',
    ]);
    const result = await scanRoutes(routesDir);
    const about = result.routes.find(r => r.id === '/about')!;
    expect(about.layoutId).toBe('/');
  });

  it('assigns the nearest layout', async () => {
    setupRoutes([
      'layout.tsx',
      'blog/layout.tsx',
      'blog/page.tsx',
    ]);
    const result = await scanRoutes(routesDir);
    const blog = result.routes.find(r => r.id === '/blog')!;
    expect(blog.layoutId).toBe('/blog');
  });
});

// ─── Middleware ───────────────────────────────────────────────────────────────

describe('scanRoutes — middleware accumulation', () => {
  it('accumulates middleware from root to route', async () => {
    setupRoutes([
      'middleware.ts',
      'dashboard/middleware.ts',
      'dashboard/page.tsx',
    ]);
    const result = await scanRoutes(routesDir);
    const dash = result.routes.find(r => r.id === '/dashboard')!;
    expect(dash.middlewarePaths).toHaveLength(2);
  });

  it('only collects middleware in ancestor directories, not siblings', async () => {
    setupRoutes([
      'middleware.ts',
      'about/page.tsx',
      'blog/middleware.ts',
      'blog/page.tsx',
    ]);
    const result = await scanRoutes(routesDir);
    const about = result.routes.find(r => r.id === '/about')!;
    expect(about.middlewarePaths).toHaveLength(1);
  });
});

// ─── 404 page ────────────────────────────────────────────────────────────────

describe('scanRoutes — 404 page', () => {
  it('discovers a 404 page at the root', async () => {
    setupRoutes(['404.tsx']);
    const result = await scanRoutes(routesDir);
    expect(result.notFoundPage).toBeDefined();
  });
});

// ─── Collision detection ─────────────────────────────────────────────────────

describe('scanRoutes — collision detection', () => {
  it('throws when page.tsx and route.ts coexist in the same directory', async () => {
    setupRoutes([
      'api/users/page.tsx',
      'api/users/route.ts',
    ]);
    await expect(scanRoutes(routesDir)).rejects.toThrow(/both a page route.*and an API route/);
  });

  it('throws on route ID collision from route groups', async () => {
    setupRoutes([
      '(groupA)/pricing/page.tsx',
      '(groupB)/pricing/page.tsx',
    ]);
    await expect(scanRoutes(routesDir)).rejects.toThrow(/collision/i);
  });
});

// ─── Parent-child relationships ──────────────────────────────────────────────

describe('scanRoutes — parent-child relationships', () => {
  it('sets children on parent routes', async () => {
    setupRoutes([
      'page.tsx',
      'blog/page.tsx',
    ]);
    const result = await scanRoutes(routesDir);
    const root = result.routes.find(r => r.id === '/')!;
    expect(root.children).toContain('/blog');
  });
});
