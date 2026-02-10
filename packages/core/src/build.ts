import * as esbuild from 'esbuild';
import { builtinModules } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  log,
  type PyraConfig,
  type PyraAdapter,
  type RouteManifest,
  type ManifestRouteEntry,
  type ManifestAsset,
  type RouteGraph,
  type RenderContext,
  type CacheConfig,
  type PrerenderConfig,
  HTTP_METHODS,
  getOutDir,
} from 'pyrajs-shared';
import { scanRoutes } from './scanner.js';
import { createRouter } from './router.js';
import {
  createBuildTimeRequestContext,
  escapeJsonForScript,
} from './request-context.js';

// ─── Public API ──────────────────────────────────────────────────────────────

export interface BuildOrchestratorOptions {
  config: PyraConfig;
  adapter: PyraAdapter;
  root?: string;
  outDir?: string;
  minify?: boolean;
  sourcemap?: boolean | 'inline' | 'external';
  /** Suppress the build report table. */
  silent?: boolean;
}

export interface BuildResult {
  manifest: RouteManifest;
  clientOutputCount: number;
  serverOutputCount: number;
  totalDurationMs: number;
}

/**
 * Build for production.
 *
 * Scans the routes directory, runs separate client and server esbuild passes,
 * generates dist/manifest.json mapping routes to assets, and prints a build
 * report table.
 */
export async function build(options: BuildOrchestratorOptions): Promise<BuildResult> {
  const startTime = performance.now();

  // ── 1. Resolve defaults ────────────────────────────────────────────────
  const root = options.root || options.config.root || process.cwd();
  const outDir = path.resolve(root, options.outDir || getOutDir(options.config) || 'dist');
  const base = options.config.build?.base || '/';
  const minify = options.minify ?? options.config.build?.minify ?? true;
  const sourcemap = options.sourcemap ?? options.config.build?.sourcemap ?? false;
  const routesDir = path.resolve(root, options.config.routesDir || 'src/routes');
  const containerId = options.config.appContainerId || 'app';
  const adapter = options.adapter;
  const silent = options.silent ?? false;

  const clientOutDir = path.join(outDir, 'client', 'assets');
  const serverOutDir = path.join(outDir, 'server');

  log.info('Building for production...');

  // ── 2. Clean output directory ──────────────────────────────────────────
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(clientOutDir, { recursive: true });
  fs.mkdirSync(serverOutDir, { recursive: true });

  // ── 3. Scan routes ─────────────────────────────────────────────────────
  const scanResult = await scanRoutes(routesDir, [...adapter.fileExtensions]);
  const router = createRouter(scanResult);
  const pageRoutes = router.pageRoutes();
  const apiRoutes = router.apiRoutes();

  log.info(`Discovered ${pageRoutes.length} page route(s), ${apiRoutes.length} API route(s)`);

  if (pageRoutes.length === 0 && apiRoutes.length === 0) {
    log.warn('No routes found. Nothing to build.');
    const manifest = buildEmptyManifest(adapter.name, base);
    fs.writeFileSync(
      path.join(outDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf-8',
    );
    return {
      manifest,
      clientOutputCount: 0,
      serverOutputCount: 0,
      totalDurationMs: performance.now() - startTime,
    };
  }

  // ── 4. Generate client entry wrappers ──────────────────────────────────
  const buildTmpDir = path.join(root, '.pyra', 'build', 'client-entries');
  fs.mkdirSync(buildTmpDir, { recursive: true });

  const clientEntryMap = new Map<string, string>(); // routeId → temp entry file path
  const clientEntryPoints: Record<string, string> = {};

  for (const route of pageRoutes) {
    const safeName = routeIdToSafeName(route.id);
    const entryPath = path.join(buildTmpDir, `${safeName}.tsx`);

    // Compute relative import path from temp entry to actual page file
    let relImport = path.relative(buildTmpDir, route.filePath)
      .split(path.sep).join('/');
    if (!relImport.startsWith('.')) {
      relImport = './' + relImport;
    }

    // Use adapter's getHydrationScript to generate the wrapper content.
    // This keeps React-specific code out of core.
    const code = adapter.getHydrationScript(relImport, containerId);
    fs.writeFileSync(entryPath, code, 'utf-8');

    clientEntryMap.set(route.id, entryPath);
    clientEntryPoints[safeName] = entryPath;
  }

  // ── 5. Client build ────────────────────────────────────────────────────
  log.info('Building client bundles...');

  const clientResult = await esbuild.build({
    entryPoints: clientEntryPoints,
    bundle: true,
    minify,
    sourcemap,
    outdir: clientOutDir,
    format: 'esm',
    platform: 'browser',
    target: options.config.build?.target || 'es2020',
    splitting: true,
    metafile: true,
    entryNames: '[name]-[hash]',
    chunkNames: 'chunk-[hash]',
    assetNames: '[name]-[hash]',
    jsx: 'automatic',
    jsxImportSource: 'react',
    plugins: [...adapter.esbuildPlugins()],
    absWorkingDir: root,
    logLevel: 'silent',
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
      '.jsx': 'jsx',
      '.js': 'js',
    },
  });

  // ── 6. Server build ────────────────────────────────────────────────────
  log.info('Building server bundles...');

  const serverEntryPoints: Record<string, string> = {};
  const serverEntryRouteMap = new Map<string, { routeId: string; type: 'page' | 'api' }>();

  for (const route of pageRoutes) {
    const key = 'page__' + routeIdToSafeName(route.id);
    serverEntryPoints[key] = route.filePath;
    serverEntryRouteMap.set(route.filePath, { routeId: route.id, type: 'page' });
  }
  for (const route of apiRoutes) {
    const key = 'api__' + routeIdToSafeName(route.id);
    serverEntryPoints[key] = route.filePath;
    serverEntryRouteMap.set(route.filePath, { routeId: route.id, type: 'api' });
  }

  // Build the externals list: React subpaths + Node builtins
  const serverExternals = [
    'react',
    'react-dom',
    'react-dom/server',
    'react-dom/client',
    'react/jsx-runtime',
    'react/jsx-dev-runtime',
    ...builtinModules,
    ...builtinModules.map(m => `node:${m}`),
    ...(options.config.build?.external || []),
  ];

  const serverResult = await esbuild.build({
    entryPoints: serverEntryPoints,
    bundle: true,
    minify: false,
    sourcemap: 'inline',
    outdir: serverOutDir,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    splitting: false,
    metafile: true,
    jsx: 'automatic',
    jsxImportSource: 'react',
    plugins: [...adapter.esbuildPlugins()],
    external: serverExternals,
    absWorkingDir: root,
    logLevel: 'silent',
    loader: {
      '.ts': 'ts',
      '.tsx': 'tsx',
      '.jsx': 'jsx',
      '.js': 'js',
    },
  });

  // ── 7. Detect exports (hasLoad, prerender, cache, API methods) ──────────
  const hasLoadMap = new Map<string, boolean>();
  const apiMethodsMap = new Map<string, string[]>();
  const prerenderMap = new Map<string, true | PrerenderConfig>();
  const cacheMap = new Map<string, CacheConfig>();

  // Build a map from routeId → server output path for import()
  const serverOutputPathMap = new Map<string, string>();

  for (const [outputPath, outputMeta] of Object.entries(serverResult.metafile!.outputs)) {
    if (!outputMeta.entryPoint) continue;

    // esbuild metafile uses posix paths relative to absWorkingDir
    const entryAbsolute = path.resolve(root, outputMeta.entryPoint);
    const routeInfo = serverEntryRouteMap.get(entryAbsolute);
    if (!routeInfo) continue;

    const exports = outputMeta.exports || [];

    if (routeInfo.type === 'page') {
      hasLoadMap.set(routeInfo.routeId, exports.includes('load'));
      // Track server output path for later import
      serverOutputPathMap.set(routeInfo.routeId, path.resolve(root, outputPath));

      // If prerender or cache is exported, we need to import to get the value
      if (exports.includes('prerender') || exports.includes('cache')) {
        const modUrl = pathToFileURL(path.resolve(root, outputPath)).href;
        const mod = await import(modUrl);

        if (mod.prerender) {
          if (mod.prerender === true) {
            prerenderMap.set(routeInfo.routeId, true);
          } else if (typeof mod.prerender === 'object' && typeof mod.prerender.paths === 'function') {
            prerenderMap.set(routeInfo.routeId, mod.prerender);
          }
        }

        if (mod.cache && typeof mod.cache === 'object') {
          cacheMap.set(routeInfo.routeId, mod.cache);
        }
      }
    } else {
      const methods = exports.filter(e =>
        (HTTP_METHODS as readonly string[]).includes(e),
      );
      if (methods.length > 0) {
        apiMethodsMap.set(routeInfo.routeId, methods);
      }
    }
  }

  // ── 8. Generate manifest ───────────────────────────────────────────────
  log.info('Generating manifest...');

  // Build client output map: routeId → { entry, chunks, css }
  const clientOutputMap = buildClientOutputMap(
    clientResult.metafile!,
    clientEntryMap,
    clientOutDir,
    root,
  );

  // Build server output map: routeId → relative server entry path
  const serverOutputMap = buildServerOutputMap(
    serverResult.metafile!,
    serverEntryRouteMap,
    serverOutDir,
    root,
  );

  // Assemble manifest
  const manifest = assembleManifest(
    adapter,
    base,
    router,
    clientOutputMap,
    serverOutputMap,
    hasLoadMap,
    apiMethodsMap,
    prerenderMap,
    cacheMap,
    clientResult.metafile!,
    clientOutDir,
  );

  // ── 9. Prerender static routes (SSG) ─────────────────────────────────
  if (prerenderMap.size > 0) {
    log.info(`Prerendering ${prerenderMap.size} route(s)...`);

    const shell = adapter.getDocumentShell?.() || DEFAULT_SHELL;
    const clientDir = path.join(outDir, 'client');

    for (const [routeId, prerenderConfig] of prerenderMap) {
      const entry = manifest.routes[routeId];
      if (!entry || entry.type !== 'page') continue;

      const serverModPath = serverOutputPathMap.get(routeId);
      if (!serverModPath) continue;

      const mod = await import(pathToFileURL(serverModPath).href);
      const component = mod.default;
      if (!component) {
        log.warn(`Route "${routeId}" has no default export — skipping prerender.`);
        continue;
      }

      // Determine parameter sets to prerender
      let paramSets: Record<string, string>[];
      if (prerenderConfig === true) {
        // Static route: single render with no params
        paramSets = [{}];
      } else {
        // Dynamic route: call paths() to get param sets
        paramSets = await prerenderConfig.paths();
      }

      let renderedCount = 0;
      for (const params of paramSets) {
        // Build the concrete pathname from the route pattern + params
        let pathname = entry.pattern;
        for (const [key, value] of Object.entries(params)) {
          pathname = pathname.replace(`:${key}`, value);
        }

        // Call load() if present
        let data: unknown = null;
        if (entry.hasLoad && typeof mod.load === 'function') {
          const ctx = createBuildTimeRequestContext({
            pathname,
            params,
            routeId,
          });
          const loadResult = await mod.load(ctx);
          // If load() returns a Response, skip this page (e.g., redirect)
          if (loadResult instanceof Response) continue;
          data = loadResult;
        }

        // Render via adapter
        const headTags: string[] = [];
        const renderContext: RenderContext = {
          url: new URL(pathname, 'http://localhost'),
          params,
          pushHead(tag: string) { headTags.push(tag); },
        };

        const bodyHtml = await adapter.renderToHTML(component, data, renderContext);

        // Build asset tags from manifest
        const assetTags = buildPrerenderAssetTags(entry, base);

        // Build hydration data
        const hydrationData: Record<string, unknown> = {};
        if (data && typeof data === 'object') {
          Object.assign(hydrationData, data);
        }
        hydrationData.params = params;
        const serializedData = escapeJsonForScript(JSON.stringify(hydrationData));
        const dataScript = `<script id="__pyra_data" type="application/json">${serializedData}</script>`;

        // Build hydration script
        const clientEntryUrl = base + entry.clientEntry;
        const hydrationScript = adapter.getHydrationScript(clientEntryUrl, containerId);

        // Assemble full HTML
        let html = shell;
        html = html.replace('__CONTAINER_ID__', containerId);
        html = html.replace('<!--pyra-outlet-->', bodyHtml);
        html = html.replace('<!--pyra-head-->', headTags.join('\n  ') +
          (headTags.length && assetTags.head ? '\n  ' : '') + assetTags.head);
        html = html.replace('</body>',
          `  ${dataScript}\n  <script type="module">${hydrationScript}</script>\n</body>`);

        // Write to dist/client/[path]/index.html
        const htmlRelPath = pathname === '/'
          ? 'index.html'
          : pathname.slice(1) + '/index.html';
        const htmlAbsPath = path.join(clientDir, htmlRelPath);
        fs.mkdirSync(path.dirname(htmlAbsPath), { recursive: true });
        fs.writeFileSync(htmlAbsPath, html, 'utf-8');

        renderedCount++;

        // Track the first prerendered file path in the manifest
        // (for static routes: the single file; for dynamic: the pattern-level file path)
        if (paramSets.length === 1) {
          entry.prerenderedFile = htmlRelPath;
        }
      }

      // Update manifest entry
      entry.prerendered = true;
      if (paramSets.length > 1) {
        entry.prerenderedCount = renderedCount;
      }

      log.info(`  Prerendered ${routeId} → ${renderedCount} page(s)`);
    }
  }

  // Write manifest (after prerender updates)
  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  // ── 10. Cleanup temp directory ─────────────────────────────────────────
  const pyraBuilDir = path.join(root, '.pyra', 'build');
  if (fs.existsSync(pyraBuilDir)) {
    fs.rmSync(pyraBuilDir, { recursive: true, force: true });
  }

  // ── 11. Print build report ─────────────────────────────────────────────
  const totalDurationMs = performance.now() - startTime;

  const clientOutputCount = Object.keys(clientResult.metafile!.outputs).length;
  const serverOutputCount = Object.keys(serverResult.metafile!.outputs).length;

  if (!silent) {
    printBuildReport(manifest, totalDurationMs, clientOutDir, serverOutDir);
  }

  log.success(`Build completed in ${(totalDurationMs / 1000).toFixed(2)}s`);

  return {
    manifest,
    clientOutputCount,
    serverOutputCount,
    totalDurationMs,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a route ID to a safe filename.
 * '/' → '_index', '/blog/[slug]' → 'blog__slug_'
 */
function routeIdToSafeName(routeId: string): string {
  if (routeId === '/') return '_index';
  return routeId
    .slice(1)                         // Remove leading /
    .replace(/\[/g, '')               // Remove [
    .replace(/\]/g, '_')              // Replace ] with _
    .replace(/\.\.\./g, '_rest')      // [...rest] → _rest
    .replace(/\//g, '__');             // / → __
}

/**
 * Build client output map by correlating esbuild metafile back to routes.
 */
function buildClientOutputMap(
  meta: esbuild.Metafile,
  clientEntryMap: Map<string, string>,
  clientOutDir: string,
  root: string,
): Map<string, { entry: string; chunks: string[]; css: string[] }> {
  // Invert entry map: normalized entry file path → routeId
  const pathToRouteId = new Map<string, string>();
  for (const [routeId, entryPath] of clientEntryMap) {
    const normalized = path.relative(root, entryPath).split(path.sep).join('/');
    pathToRouteId.set(normalized, routeId);
  }

  const result = new Map<string, { entry: string; chunks: string[]; css: string[] }>();

  for (const [outputPath, outputMeta] of Object.entries(meta.outputs)) {
    if (!outputMeta.entryPoint) continue;

    const routeId = pathToRouteId.get(outputMeta.entryPoint);
    if (!routeId) continue;

    // Path relative to dist/client/ (parent of assets/)
    const clientDir = path.dirname(clientOutDir);
    const relativeEntry = path.relative(clientDir, path.resolve(root, outputPath))
      .split(path.sep).join('/');

    // Collect CSS
    const css: string[] = [];
    if (outputMeta.cssBundle) {
      const cssRel = path.relative(clientDir, path.resolve(root, outputMeta.cssBundle))
        .split(path.sep).join('/');
      css.push(cssRel);
    }

    // Collect shared chunk imports
    const chunks: string[] = [];
    for (const imp of outputMeta.imports || []) {
      if (imp.kind === 'import-statement' && !imp.external) {
        const chunkRel = path.relative(clientDir, path.resolve(root, imp.path))
          .split(path.sep).join('/');
        // Don't include the entry itself as a chunk
        if (chunkRel !== relativeEntry) {
          chunks.push(chunkRel);
        }
      }
    }

    result.set(routeId, { entry: relativeEntry, chunks, css });
  }

  return result;
}

/**
 * Build server output map: routeId → relative path to server entry.
 */
function buildServerOutputMap(
  meta: esbuild.Metafile,
  entryRouteMap: Map<string, { routeId: string; type: 'page' | 'api' }>,
  serverOutDir: string,
  root: string,
): Map<string, string> {
  const result = new Map<string, string>();

  for (const [outputPath, outputMeta] of Object.entries(meta.outputs)) {
    if (!outputMeta.entryPoint) continue;

    const entryAbsolute = path.resolve(root, outputMeta.entryPoint);
    const routeInfo = entryRouteMap.get(entryAbsolute);
    if (!routeInfo) continue;

    const relativePath = path.relative(serverOutDir, path.resolve(root, outputPath))
      .split(path.sep).join('/');
    result.set(routeInfo.routeId, relativePath);
  }

  return result;
}

/**
 * Assemble the final RouteManifest from all collected data.
 */
function assembleManifest(
  adapter: PyraAdapter,
  base: string,
  router: RouteGraph,
  clientOutputMap: Map<string, { entry: string; chunks: string[]; css: string[] }>,
  serverOutputMap: Map<string, string>,
  hasLoadMap: Map<string, boolean>,
  apiMethodsMap: Map<string, string[]>,
  prerenderMap: Map<string, true | PrerenderConfig>,
  cacheMap: Map<string, CacheConfig>,
  clientMeta: esbuild.Metafile,
  clientOutDir: string,
): RouteManifest {
  const routes: Record<string, ManifestRouteEntry> = {};

  // Page routes
  for (const route of router.pageRoutes()) {
    const clientOutput = clientOutputMap.get(route.id);
    const serverEntry = serverOutputMap.get(route.id);

    const routeCache = cacheMap.get(route.id);
    routes[route.id] = {
      id: route.id,
      pattern: route.pattern,
      type: 'page',
      clientEntry: clientOutput?.entry,
      clientChunks: clientOutput?.chunks?.length ? clientOutput.chunks : undefined,
      css: clientOutput?.css?.length ? clientOutput.css : undefined,
      ssrEntry: serverEntry,
      hasLoad: hasLoadMap.get(route.id) || false,
      cache: routeCache,
      layouts: route.layoutId ? [route.layoutId] : undefined,
      middleware: route.middlewarePaths.length ? route.middlewarePaths : undefined,
    };
  }

  // API routes
  for (const route of router.apiRoutes()) {
    const serverEntry = serverOutputMap.get(route.id);
    routes[route.id] = {
      id: route.id,
      pattern: route.pattern,
      type: 'api',
      serverEntry,
      methods: apiMethodsMap.get(route.id),
      middleware: route.middlewarePaths.length ? route.middlewarePaths : undefined,
    };
  }

  // Asset inventory from client metafile
  const assets: Record<string, ManifestAsset> = {};
  const clientDir = path.dirname(clientOutDir); // dist/client/

  for (const [outputPath, outputMeta] of Object.entries(clientMeta.outputs)) {
    const absOutput = path.resolve(process.cwd(), outputPath);
    const relativePath = path.relative(clientDir, absOutput)
      .split(path.sep).join('/');
    const ext = path.extname(outputPath);

    // Extract hash from content-hashed filename (name-HASH.ext)
    const basename = path.basename(outputPath, ext);
    const hashMatch = basename.match(/-([A-Za-z0-9]+)$/);
    const hash = hashMatch ? hashMatch[1] : '';

    assets[relativePath] = {
      file: relativePath,
      hash,
      size: outputMeta.bytes,
      type: getMimeType(ext),
    };
  }

  return {
    version: 1,
    adapter: adapter.name,
    base,
    builtAt: new Date().toISOString(),
    routes,
    assets,
  };
}

/**
 * Build an empty manifest when no routes are found.
 */
function buildEmptyManifest(adapterName: string, base: string): RouteManifest {
  return {
    version: 1,
    adapter: adapterName,
    base,
    builtAt: new Date().toISOString(),
    routes: {},
    assets: {},
  };
}

/**
 * Print the build report table to the terminal.
 */
function printBuildReport(
  manifest: RouteManifest,
  totalDurationMs: number,
  clientOutDir: string,
  serverOutDir: string,
): void {
  const sortedRoutes = Object.values(manifest.routes)
    .sort((a, b) => a.pattern.localeCompare(b.pattern));

  let pageCount = 0;
  let apiCount = 0;
  let ssgCount = 0;
  let totalJS = 0;
  let totalCSS = 0;

  console.log('');
  console.log('  Route                     Type   Mode      JS        CSS      load()');
  console.log('  ' + '\u2500'.repeat(67));

  for (const entry of sortedRoutes) {
    const routeCol = entry.pattern.padEnd(26);

    if (entry.type === 'page') {
      pageCount++;
      const mode = entry.prerendered ? 'SSG' : 'SSR';
      if (entry.prerendered) ssgCount++;

      // Calculate JS size from manifest assets
      let jsSize = 0;
      if (entry.clientEntry) {
        const asset = manifest.assets[entry.clientEntry];
        if (asset) jsSize += asset.size;
      }
      for (const chunk of entry.clientChunks || []) {
        const asset = manifest.assets[chunk];
        if (asset) jsSize += asset.size;
      }
      totalJS += jsSize;

      let cssSize = 0;
      for (const css of entry.css || []) {
        const asset = manifest.assets[css];
        if (asset) cssSize += asset.size;
      }
      totalCSS += cssSize;

      const jsSizeStr = formatSize(jsSize).padStart(9);
      const cssSizeStr = cssSize > 0 ? formatSize(cssSize).padStart(9) : '        -';
      const hasLoad = entry.hasLoad ? 'yes' : 'no';

      console.log(`  ${routeCol} page   ${mode.padEnd(9)} ${jsSizeStr} ${cssSizeStr}   ${hasLoad}`);
    } else {
      apiCount++;
      console.log(`  ${routeCol} api    \u2014         \u2014         \u2014        \u2014`);
    }
  }

  console.log('  ' + '\u2500'.repeat(67));
  console.log(`  Totals                    ${pageCount} pg   ${ssgCount} SSG     ${formatSize(totalJS).padStart(9)} ${formatSize(totalCSS).padStart(9)}`);
  console.log(`                            ${apiCount} api`);
  console.log('');

  // Count output files
  const clientFiles = countFilesRecursive(path.dirname(clientOutDir)); // dist/client/
  const serverFiles = countFilesRecursive(serverOutDir);

  console.log(`  Output:   dist/client/ (${clientFiles} files)  dist/server/ (${serverFiles} files)`);
  console.log('  Manifest: dist/manifest.json');
}

/**
 * Format a byte count as a human-readable size string.
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '-';
  const kb = bytes / 1024;
  if (kb < 1) return `${bytes} B`;
  return `${kb.toFixed(1)} KB`;
}

/**
 * Count all files in a directory recursively.
 */
function countFilesRecursive(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFilesRecursive(fullPath);
    } else {
      count++;
    }
  }
  return count;
}

// Default document shell when the adapter doesn't provide one
const DEFAULT_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!--pyra-head-->
</head>
<body>
  <div id="__CONTAINER_ID__"><!--pyra-outlet--></div>
</body>
</html>`;

/**
 * Generate <link> and <script> tags for a prerendered page's manifest-declared assets.
 */
function buildPrerenderAssetTags(
  entry: ManifestRouteEntry,
  base: string,
): { head: string; body: string } {
  const headParts: string[] = [];

  for (const css of entry.css || []) {
    headParts.push(`<link rel="stylesheet" href="${base}${css}">`);
  }
  for (const chunk of entry.clientChunks || []) {
    headParts.push(`<link rel="modulepreload" href="${base}${chunk}">`);
  }
  if (entry.clientEntry) {
    headParts.push(`<link rel="modulepreload" href="${base}${entry.clientEntry}">`);
  }

  return { head: headParts.join('\n  '), body: '' };
}

/**
 * Get MIME type from file extension.
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.map': 'application/json',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
