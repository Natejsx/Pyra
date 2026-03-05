# @pyra-js/cli

The Pyra.js command-line interface. Provides the `pyra` command for starting the dev server, building for production, scaffolding new projects, and diagnosing your setup.

```bash
npm install -D @pyra-js/cli
# or
pnpm add -D @pyra-js/cli
```

---

## Commands

| Command | Description |
|---|---|
| `pyra dev` | Start the dev server with HMR on `localhost:3000` |
| `pyra build` | Production build - outputs to `dist/` |
| `pyra start` | Serve the production build (run `pyra build` first) |
| `pyra init [name]` | Interactive project scaffolding |
| `pyra graph [path]` | Visualize the project dependency graph |
| `pyra doctor` | Diagnose your project configuration |

```bash
# Dev server on a custom port, open browser on start
pyra dev --port 8080 --open

# Production build with sourcemaps
pyra build --sourcemap

# Scaffold a new project interactively
pyra init my-app
```

---

## Configuration

Create `pyra.config.ts` in your project root. `defineConfig` and all user-facing types are exported from this package:

```ts
import { defineConfig } from '@pyra-js/cli';
import { createReactAdapter } from '@pyra-js/adapter-react';

export default defineConfig({
  adapter: createReactAdapter(),
  routesDir: 'src/routes',
  server: {
    port: 3000,
  },
});
```

---

## Full Documentation

[cli-reference](https://pyrajs.dev/docs/cli)

---

## License

MIT
