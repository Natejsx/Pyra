import { describe, it, expect } from 'vitest';
import {
  buildCacheControlHeader,
  getCacheControl,
  getContentType,
  buildAssetTags,
} from '../prod/prod-assets.js';
import type { ManifestRouteEntry } from '@pyra-js/shared';

// ─── buildCacheControlHeader ─────────────────────────────────────────────────

describe('buildCacheControlHeader', () => {
  it('returns "no-cache" when cache is undefined', () => {
    expect(buildCacheControlHeader(undefined)).toBe('no-cache');
  });

  it('returns "no-cache" when cache is an empty object', () => {
    expect(buildCacheControlHeader({})).toBe('no-cache');
  });

  it('builds a header with maxAge', () => {
    expect(buildCacheControlHeader({ maxAge: 3600 })).toBe('public, max-age=3600');
  });

  it('builds a header with sMaxAge', () => {
    expect(buildCacheControlHeader({ sMaxAge: 86400 })).toBe('public, s-maxage=86400');
  });

  it('builds a header with staleWhileRevalidate', () => {
    expect(buildCacheControlHeader({ staleWhileRevalidate: 60 })).toBe(
      'public, stale-while-revalidate=60',
    );
  });

  it('combines all three directives', () => {
    const header = buildCacheControlHeader({
      maxAge: 300,
      sMaxAge: 3600,
      staleWhileRevalidate: 60,
    });
    expect(header).toBe('public, max-age=300, s-maxage=3600, stale-while-revalidate=60');
  });

  it('handles maxAge of 0', () => {
    expect(buildCacheControlHeader({ maxAge: 0 })).toBe('public, max-age=0');
  });
});

// ─── getCacheControl ─────────────────────────────────────────────────────────

describe('getCacheControl', () => {
  it('returns immutable for a hashed file in /assets/', () => {
    expect(getCacheControl('/assets/app-Ab1C2d3E4f.js')).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it('returns immutable for a hashed CSS file in /assets/', () => {
    expect(getCacheControl('/assets/index-abc123.css')).toBe(
      'public, max-age=31536000, immutable',
    );
  });

  it('returns "no-cache" for an unhashed file in /assets/', () => {
    expect(getCacheControl('/assets/logo.png')).toBe('no-cache');
  });

  it('returns "no-cache" for a root-level file', () => {
    expect(getCacheControl('/favicon.svg')).toBe('no-cache');
  });

  it('returns "no-cache" for an HTML page path', () => {
    expect(getCacheControl('/about')).toBe('no-cache');
  });

  it('returns "no-cache" for a path that contains "assets" in the segment name but is not /assets/', () => {
    expect(getCacheControl('/my-assets/file-abc123.js')).toBe('no-cache');
  });
});

// ─── getContentType ──────────────────────────────────────────────────────────

describe('getContentType', () => {
  const cases: [string, string][] = [
    ['.js',   'application/javascript'],
    ['.mjs',  'application/javascript'],
    ['.css',  'text/css'],
    ['.html', 'text/html'],
    ['.json', 'application/json'],
    ['.png',  'image/png'],
    ['.jpg',  'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.gif',  'image/gif'],
    ['.svg',  'image/svg+xml'],
    ['.ico',  'image/x-icon'],
    ['.woff', 'font/woff'],
    ['.woff2','font/woff2'],
    ['.ttf',  'font/ttf'],
    ['.map',  'application/json'],
  ];

  for (const [ext, expected] of cases) {
    it(`maps ${ext} → ${expected}`, () => {
      expect(getContentType(ext)).toBe(expected);
    });
  }

  it('returns "application/octet-stream" for an unknown extension', () => {
    expect(getContentType('.xyz')).toBe('application/octet-stream');
  });

  it('returns "application/octet-stream" for an empty string', () => {
    expect(getContentType('')).toBe('application/octet-stream');
  });
});

// ─── buildAssetTags ──────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<ManifestRouteEntry> = {}): ManifestRouteEntry {
  return {
    id: '/page',
    pattern: '/page',
    type: 'page',
    ...overrides,
  };
}

describe('buildAssetTags', () => {
  it('returns empty strings when entry has no assets', () => {
    const tags = buildAssetTags(makeEntry(), '/');
    expect(tags.head).toBe('');
    expect(tags.body).toBe('');
  });

  it('generates a <link rel="stylesheet"> for each CSS file', () => {
    const tags = buildAssetTags(
      makeEntry({ css: ['assets/index-abc.css'] }),
      '/',
    );
    expect(tags.head).toContain('<link rel="stylesheet" href="/assets/index-abc.css">');
  });

  it('generates a modulepreload for the client entry', () => {
    const tags = buildAssetTags(
      makeEntry({ clientEntry: 'assets/page-abc.js' }),
      '/',
    );
    expect(tags.head).toContain('<link rel="modulepreload" href="/assets/page-abc.js">');
  });

  it('generates modulepreloads for shared chunks', () => {
    const tags = buildAssetTags(
      makeEntry({ clientChunks: ['assets/shared-abc.js', 'assets/vendor-def.js'] }),
      '/',
    );
    expect(tags.head).toContain('href="/assets/shared-abc.js"');
    expect(tags.head).toContain('href="/assets/vendor-def.js"');
  });

  it('prepends the base path to all href values', () => {
    const tags = buildAssetTags(
      makeEntry({ css: ['assets/index.css'], clientEntry: 'assets/page.js' }),
      '/app/',
    );
    expect(tags.head).toContain('href="/app/assets/index.css"');
    expect(tags.head).toContain('href="/app/assets/page.js"');
  });

  it('body is always empty (scripts are injected inline by the pipeline)', () => {
    const tags = buildAssetTags(
      makeEntry({ clientEntry: 'assets/page.js', css: ['assets/style.css'] }),
      '/',
    );
    expect(tags.body).toBe('');
  });
});
