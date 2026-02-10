import { existsSync } from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';
import { loadConfig, findConfigFile, getEntry } from 'pyrajs-shared';
import { scanRoutes } from 'pyrajs-core';
import type { ScanResult } from 'pyrajs-core';
import { getVersion } from '../utils/reporter.js';
import { detectCapabilities } from '../utils/dev-banner.js';

// ─── Types ──────────────────────────────────────────────────────────────

type ProjectMode = 'static' | 'ssr' | 'misconfigured';

interface DiagnosticCheck {
  level: 'ok' | 'warn' | 'info';
  message: string;
}

interface DoctorDiagnosis {
  mode: ProjectMode;
  modeLabel: string;
  modeNote?: string;
  explanation: string[];
  checks: DiagnosticCheck[];
  nextSteps?: string[];
  routeStats?: {
    pages: number;
    apiRoutes: number;
    layouts: number;
    middlewares: number;
  };
}

export interface DoctorOptions {
  config?: string;
  silent: boolean;
  color: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────

const DEFAULT_ROUTES_DIR = 'src/routes';

// ─── Main Entry Point ───────────────────────────────────────────────────

export async function doctorCommand(options: DoctorOptions): Promise<void> {
  if (options.silent) return;

  const root = process.cwd();
  const caps = detectCapabilities();
  const version = getVersion();

  const diagnosis = await diagnose(root, options.config);

  renderDiagnosis(diagnosis, {
    version,
    color: options.color,
    silent: options.silent,
    unicode: caps.supportsUnicode,
  });
}

// ─── Diagnosis Logic ────────────────────────────────────────────────────

async function diagnose(
  root: string,
  configFile?: string,
): Promise<DoctorDiagnosis> {
  const checks: DiagnosticCheck[] = [];

  // Step 1: Find config file
  const configPath = configFile || findConfigFile(root);
  if (configPath) {
    const relPath = path.relative(root, configPath);
    checks.push({ level: 'ok', message: `Config file found: ${relPath}` });
  } else {
    checks.push({ level: 'info', message: 'No config file (using defaults)' });
  }

  // Step 2: Load config
  let config;
  try {
    config = await loadConfig({ root, configFile, silent: true });
  } catch (err) {
    checks.push({
      level: 'warn',
      message: `Could not load config: ${err instanceof Error ? err.message : String(err)}`,
    });
    return {
      mode: 'static',
      modeLabel: 'Static (SPA)',
      modeNote: 'config error',
      explanation: [
        'Pyra could not read your config file. It will fall back',
        'to default settings and serve files statically.',
      ],
      checks,
      nextSteps: [
        'Check your config file for syntax errors or missing imports.',
      ],
    };
  }

  // Step 3: Check entry point
  const entry = getEntry(config);
  const primaryEntry =
    typeof entry === 'string'
      ? entry
      : Array.isArray(entry)
        ? entry[0]
        : typeof entry === 'object' && entry !== null
          ? Object.values(entry)[0]
          : undefined;

  if (primaryEntry) {
    const entryPath = path.resolve(root, primaryEntry);
    if (existsSync(entryPath)) {
      checks.push({ level: 'ok', message: `Entry point: ${primaryEntry}` });
    } else {
      checks.push({
        level: 'warn',
        message: `Entry point not found: ${primaryEntry}`,
      });
    }
  }

  // Step 4: Resolve routes directory
  const routesDirRel = config.routesDir || DEFAULT_ROUTES_DIR;
  const routesDirAbs = path.resolve(root, routesDirRel);
  const routesDirExists = existsSync(routesDirAbs);
  const routesDirExplicitlySet =
    config.routesDir !== undefined && config.routesDir !== DEFAULT_ROUTES_DIR;

  // Step 5: Scan routes if directory exists
  let scanResult: ScanResult | null = null;
  if (routesDirExists) {
    try {
      scanResult = await scanRoutes(routesDirAbs, [
        '.tsx',
        '.jsx',
        '.ts',
        '.js',
      ]);
    } catch {
      checks.push({
        level: 'warn',
        message: `Could not scan routes directory: ${routesDirRel}/`,
      });
    }
  }

  // Step 6: Check adapter config
  const adapterDisabled = config.adapter === false;

  // Step 7: Check index.html
  const hasIndexHtml = existsSync(path.join(root, 'index.html'));

  // Step 8: Compute route stats
  const pageCount =
    scanResult?.routes.filter((r) => r.type === 'page').length ?? 0;
  const apiCount =
    scanResult?.routes.filter((r) => r.type === 'api').length ?? 0;
  const layoutCount = scanResult?.layouts.length ?? 0;
  const middlewareCount = scanResult?.middlewares.length ?? 0;
  const hasRoutes = pageCount > 0 || apiCount > 0;

  // Step 9: Decision tree
  if (routesDirExists && !adapterDisabled && hasRoutes) {
    // ── SSR MODE ──
    checks.push({ level: 'ok', message: `Routes directory: ${routesDirRel}/` });

    const parts: string[] = [];
    if (pageCount > 0)
      parts.push(
        `${pageCount} page${pageCount !== 1 ? 's' : ''} found`,
      );
    if (apiCount > 0)
      parts.push(
        `${apiCount} API endpoint${apiCount !== 1 ? 's' : ''}`,
      );
    checks.push({ level: 'ok', message: parts.join(', ') });

    if (layoutCount > 0) {
      checks.push({
        level: 'ok',
        message: `${layoutCount} layout${layoutCount !== 1 ? 's' : ''}`,
      });
    }
    if (middlewareCount > 0) {
      checks.push({
        level: 'ok',
        message: `${middlewareCount} middleware file${middlewareCount !== 1 ? 's' : ''}`,
      });
    }

    const adapterName =
      typeof config.adapter === 'object' && config.adapter
        ? (config.adapter as { name: string }).name
        : 'react';
    checks.push({ level: 'ok', message: `Adapter: ${adapterName}` });

    return {
      mode: 'ssr',
      modeLabel: 'Full-Stack (SSR)',
      explanation: [
        'Your project uses file-based routing. When someone visits',
        'a page, Pyra renders it on the server first and sends',
        'ready-made HTML to the browser. This means faster page',
        'loads and better SEO.',
      ],
      checks,
      routeStats: {
        pages: pageCount,
        apiRoutes: apiCount,
        layouts: layoutCount,
        middlewares: middlewareCount,
      },
    };
  }

  if (!routesDirExists && routesDirExplicitlySet) {
    // ── MISCONFIGURED ──
    checks.push({
      level: 'warn',
      message: `routesDir is set to "${routesDirRel}" but that folder doesn't exist.`,
    });

    return {
      mode: 'misconfigured',
      modeLabel: 'Static (SPA)',
      modeNote: 'with a note',
      explanation: [
        "Your config points to a routes directory that doesn't",
        'exist yet. Pyra is falling back to static file serving.',
      ],
      checks,
      nextSteps: [
        'To fix this, either:',
        `  \u2022 Create the folder: mkdir ${routesDirRel}`,
        '  \u2022 Or remove routesDir from your config to use the default',
      ],
    };
  }

  // ── STATIC MODE ──
  if (!hasIndexHtml) {
    checks.push({
      level: 'warn',
      message: 'No index.html found in project root',
    });
  }

  if (routesDirExists && adapterDisabled) {
    checks.push({
      level: 'warn',
      message:
        'Routes directory exists but adapter is disabled (adapter: false)',
    });
  }

  if (routesDirExists && !hasRoutes) {
    checks.push({
      level: 'info',
      message: `Routes directory exists (${routesDirRel}/) but contains no page or API routes`,
    });
  }

  return {
    mode: 'static',
    modeLabel: 'Static (SPA)',
    explanation: [
      'Your project is running as a single-page app. Pyra serves',
      'your files (HTML, CSS, TypeScript) directly to the browser',
      'and compiles them on the fly.',
      '',
      "This is the default setup \u2014 it's how most scaffolded Pyra",
      'projects start. Everything runs in the browser, no server',
      'rendering involved.',
    ],
    checks,
    nextSteps: [
      'Want to add server-side rendering?',
      '  Create a src/routes/ directory and add a page.tsx file.',
    ],
  };
}

// ─── Rendering ──────────────────────────────────────────────────────────

function renderDiagnosis(
  diagnosis: DoctorDiagnosis,
  opts: {
    version: string;
    color: boolean;
    silent: boolean;
    unicode: boolean;
  },
): void {
  if (opts.silent) return;

  const { color, unicode, version } = opts;
  const arrow = unicode ? '\u279C' : '>';
  const checkmark = unicode ? '\u2713' : '+';
  const warnIcon = '!';
  const infoIcon = '-';

  const lines: string[] = [];

  // Header
  if (color) {
    lines.push(
      `  ${pc.bold(pc.green('PYRA'))} ${pc.green(`v${version}`)}  ${pc.dim('doctor')}`,
    );
  } else {
    lines.push(`  PYRA v${version}  doctor`);
  }

  lines.push('');

  // Mode line
  const modeStr = diagnosis.modeNote
    ? `${diagnosis.modeLabel} \u2014 ${diagnosis.modeNote}`
    : diagnosis.modeLabel;

  if (color) {
    lines.push(
      `  ${pc.green(arrow)}  ${pc.bold('Mode:')} ${modeStr}`,
    );
  } else {
    lines.push(`  ${arrow}  Mode: ${modeStr}`);
  }

  lines.push('');

  // Explanation prose
  for (const line of diagnosis.explanation) {
    lines.push(line ? `  ${line}` : '');
  }

  lines.push('');

  // Check results
  for (const c of diagnosis.checks) {
    const icon =
      c.level === 'ok'
        ? checkmark
        : c.level === 'warn'
          ? warnIcon
          : infoIcon;

    if (color) {
      const coloredIcon =
        c.level === 'ok'
          ? pc.green(icon)
          : c.level === 'warn'
            ? pc.yellow(icon)
            : pc.dim(icon);
      lines.push(`  ${coloredIcon}  ${c.message}`);
    } else {
      lines.push(`  ${icon}  ${c.message}`);
    }
  }

  // Next steps
  if (diagnosis.nextSteps && diagnosis.nextSteps.length > 0) {
    lines.push('');
    for (const step of diagnosis.nextSteps) {
      if (color) {
        lines.push(`  ${pc.dim(step)}`);
      } else {
        lines.push(`  ${step}`);
      }
    }
  }

  console.log('');
  console.log(lines.join('\n'));
  console.log('');
}
