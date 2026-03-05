import type { Plugin } from "esbuild";
import path from "node:path";
import fs from "node:fs/promises";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);

/**
 * esbuild plugin that applies the React Fast Refresh babel transform to every
 * .tsx / .jsx / .ts / .js file outside node_modules.
 *
 * The transform inserts $RefreshReg$ and $RefreshSig$ calls so the RFR
 * runtime can perform component-level hot updates instead of full-page
 * reloads. JSX and TypeScript syntax are left untouched — esbuild handles
 * those transforms after this plugin returns the modified source.
 *
 * babel and react-refresh are loaded lazily so a missing installation degrades
 * gracefully (the plugin becomes a no-op and the dev server falls back to
 * full-page reloads).
 */
export function createFastRefreshPlugin(): Plugin {
  // Lazily resolved once per plugin instance.
  let transformSync: ((source: string, opts: object) => { code?: string | null } | null) | null | undefined = undefined;
  let reactRefreshBabel: unknown = undefined;

  async function getTransform() {
    if (transformSync !== undefined) return transformSync;
    try {
      const babel = await import("@babel/core");
      reactRefreshBabel = _require("react-refresh/babel");
      // babel may be a CJS default-export wrapper; handle both shapes.
      const fn = (babel as any).transformSync ?? (babel as any).default?.transformSync;
      transformSync = fn ?? null;
    } catch {
      transformSync = null;
    }
    return transformSync;
  }

  return {
    name: "pyra-react-fast-refresh",
    setup(build) {
      build.onLoad({ filter: /\.[jt]sx?$/ }, async (args) => {
        // Never transform node_modules — they don't need hot-reload registration.
        if (args.path.includes("node_modules")) return undefined;

        const transform = await getTransform();
        if (!transform || !reactRefreshBabel) return undefined;

        const ext = path.extname(args.path);
        const isTS = ext === ".ts" || ext === ".tsx";
        const isJSX = ext === ".tsx" || ext === ".jsx";

        const source = await fs.readFile(args.path, "utf8");

        // Tell babel which syntax plugins to activate for parsing.
        // These are SYNTAX-only — we do not transform JSX or TypeScript here;
        // esbuild will do that after receiving the returned source.
        const parserPlugins: string[] = ["importMeta"];
        if (isTS) parserPlugins.push("typescript");
        if (isJSX) parserPlugins.push("jsx");

        let result: { code?: string | null } | null = null;
        try {
          result = transform(source, {
            filename: args.path,
            plugins: [[reactRefreshBabel, { skipEnvCheck: true }]],
            parserOpts: { plugins: parserPlugins },
            ast: false,
            sourceMaps: "inline",
            configFile: false,
            babelrc: false,
          });
        } catch {
          // If babel fails (e.g. syntax error in user code) return undefined so
          // esbuild handles the file normally and surfaces its own error.
          return undefined;
        }

        if (!result?.code) return undefined;

        const loader = (
          isTS && isJSX ? "tsx" : isTS ? "ts" : isJSX ? "jsx" : "js"
        ) as "tsx" | "ts" | "jsx" | "js";

        return { contents: result.code, loader };
      });
    },
  };
}
