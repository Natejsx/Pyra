export type PyraConfig = {
  entry?: string;        // default: src/index.ts
  outDir?: string;       // default: dist
  port?: number;         // default: 3000
  plugins?: any[];       // Pyra plugin instances (see basic plugin below)
};

// export type PyraPlugin = {
//   name: string;
//   // Called once when build pipeline is constructed
//   setup: (api: {
//     addEsbuildPlugin: (p: import('esbuild').Plugin) => void;
//   }) => void;
// };
