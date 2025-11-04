# pyrajs-cli

> 🔥 **Pyra.js** - Next-gen build tool for blazing-fast web development

A modern, TypeScript-first build tool with zero-config defaults, instant dev server, and lightning-fast builds.

## ✨ Features

- 🚀 **Blazing Fast** - Powered by esbuild for instant builds and dev server startup
- 🔥 **Hot Module Replacement** - See changes instantly without losing state
- 📦 **Zero Config** - Sensible defaults, works out of the box
- 🎯 **TypeScript First** - Full TypeScript support with type checking
- 🔌 **Plugin System** - Extend functionality with a powerful plugin API
- 🎨 **Framework Agnostic** - Works with React, Vue, Svelte, or vanilla JS/TS
- 📱 **Modern Bundling** - ESM-first with automatic code splitting
- 🛠️ **Smart Package Manager Detection** - Auto-detects npm, pnpm, yarn, or bun

## 📦 Installation

```bash
# npm
npm install -D pyrajs-cli

# pnpm
pnpm add -D pyrajs-cli

# yarn
yarn add -D pyrajs-cli

# bun
bun add -D pyrajs-cli
```

## 🚀 Quick Start

### Create a New Project

```bash
# Auto-detects your package manager
npx pyrajs-cli create my-app

# Or specify package manager
npx pyrajs-cli create my-app --pm pnpm

# Or use a template
npx pyrajs-cli init my-app --template react
```

### Use in Existing Project

```bash
# Install
npm install -D pyrajs-cli

# Add scripts to package.json
{
  "scripts": {
    "dev": "pyra dev",
    "build": "pyra build"
  }
}

# Start developing
npm run dev
```

## 📖 Usage

### Development Server

```bash
# Start dev server (default: http://localhost:3000)
pyra dev

# Custom port
pyra dev --port 8080

# Open browser automatically
pyra dev --open
```

### Production Build

```bash
# Build for production
pyra build

# Custom output directory
pyra build --out-dir build

# With sourcemaps
pyra build --sourcemap
```

### Create Projects

```bash
# Simple setup (recommended for quick start)
pyra create my-app

# Template-based setup (for frameworks)
pyra init my-react-app --template react --language typescript

# Skip dependency installation
pyra create my-app --skip-install

# Force specific package manager
pyra create my-app --pm yarn
```

## ⚙️ Configuration

Create a `pyra.config.js` or `pyra.config.ts` in your project root:

```typescript
import { defineConfig } from 'pyrajs-cli';

export default defineConfig({
  // Entry point (default: 'src/index.ts')
  entry: 'src/main.ts',

  // Output directory (default: 'dist')
  outDir: 'build',

  // Dev server configuration
  server: {
    port: 3000,
    open: true,
    hmr: true,
  },

  // Build configuration
  build: {
    sourcemap: true,
    minify: true,
    target: 'es2020',
  },

  // Path aliases
  resolve: {
    alias: {
      '@': './src',
      '@components': './src/components',
    },
  },
});
```

## 🎯 Zero Config

Pyra works out of the box with sensible defaults:

- **Entry**: `src/index.ts` or `src/index.js`
- **Output**: `dist/`
- **Port**: `3000`
- **HMR**: Enabled
- **TypeScript**: Auto-detected and supported

## 🔌 Package Manager Detection

Pyra automatically detects your preferred package manager:

1. **Lockfiles** - Checks for `pnpm-lock.yaml`, `yarn.lock`, `bun.lockb`, `package-lock.json`
2. **Environment** - Reads `npm_config_user_agent`
3. **PATH** - Detects available package managers
4. **Override** - Use `--pm <npm|pnpm|yarn|bun>` to force a specific manager

## 🏗️ Project Structure

A typical Pyra project:

```
my-app/
├── src/
│   └── index.ts          # Your application entry
├── index.html            # HTML entry point
├── pyra.config.js        # Configuration (optional)
├── package.json
└── tsconfig.json         # TypeScript config (optional)
```

## 📚 Examples

### React Project

```typescript
// pyra.config.ts
import { defineConfig } from 'pyrajs-cli';

export default defineConfig({
  entry: 'src/main.tsx',
  framework: {
    name: 'react',
    options: {
      refresh: true, // Fast Refresh
    },
  },
  resolve: {
    alias: {
      '@': './src',
    },
  },
});
```

### Multi-Page Application

```typescript
export default defineConfig({
  entry: {
    main: 'src/main.ts',
    admin: 'src/admin.ts',
  },
  build: {
    splitting: true,
  },
});
```

### Library/Package

```typescript
export default defineConfig({
  entry: 'src/index.ts',
  build: {
    external: ['react', 'react-dom'],
    splitting: false,
    sourcemap: 'external',
  },
});
```

## 🎨 Framework Support

Pyra supports all major frameworks:

- ✅ **React** - With Fast Refresh
- ✅ **Vue** - Full SFC support
- ✅ **Svelte** - With HMR
- ✅ **Preact** - Optimized builds
- ✅ **Solid** - Modern reactive UI
- ✅ **Vanilla** - No framework needed

## 📦 API

### `defineConfig(config)`

Type-safe configuration helper:

```typescript
import { defineConfig } from 'pyrajs-cli';

export default defineConfig({
  // Your config with full TypeScript autocomplete
});
```

### Available Types

```typescript
import type {
  PyraConfig,
  PyraPlugin,
  DevServerConfig,
  BuildConfig,
} from 'pyrajs-cli';
```

## 🤝 Contributing

Contributions are welcome! Please check out our [GitHub repository](https://github.com/Simpleboi/Pyra).

## 📄 License

MIT © [Nathaniel Paz](https://github.com/Simpleboi)

## 🔗 Links

- [Documentation](https://github.com/Simpleboi/Pyra#readme)
- [GitHub](https://github.com/Simpleboi/Pyra)
- [Issues](https://github.com/Simpleboi/Pyra/issues)
- [Changelog](https://github.com/Simpleboi/Pyra/releases)

## ⚡ Philosophy

> "Speed creates flow, and flow creates creativity."

Pyra is built on the principle that developer tools should be fast, simple, and get out of your way. We believe that instant feedback and zero configuration enable developers to focus on what matters: building great products.

---

**Made with 🔥 by the Pyra team**
