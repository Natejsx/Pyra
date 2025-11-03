#!/usr/bin/env node
import { Command } from 'commander';
import { log } from '@pyra/shared';

const program = new Command();

program
  .name('pyra')
  .description('🔥 Pyra.js - Ignite your frontend\nA next-gen build tool for blazing-fast web development')
  .version('0.0.1');

program
  .command('dev')
  .description('Start development server with hot module replacement')
  .option('-p, --port <number>', 'Port to run dev server on', '3000')
  .option('-o, --open', 'Open browser on server start')
  .action((options) => {
    log.info(`Starting dev server on port ${options.port}...`);
    log.warn('Dev server not implemented yet - coming soon');
    // TODO: Import and call dev server from @pyra/core
  });

program
  .command('build')
  .description('Build for production with optimizations')
  .option('-o, --out-dir <path>', 'Output directory', 'dist')
  .option('--minify', 'Minify output', true)
  .option('--sourcemap', 'Generate sourcemaps', false)
  .action((options) => {
    log.info(`Building for production...`);
    log.info(`Output directory: ${options.outDir}`);
    log.warn('Build not implemented yet - coming soon');
    // TODO: Import and call build from @pyra/core
  });

program
  .command('init')
  .description('Initialize a new Pyra.js project')
  .option('-t, --template <name>', 'Project template (react, vue, svelte, vanilla)', 'vanilla')
  .action((options) => {
    log.info(`Initializing new Pyra.js project with ${options.template} template...`);
    log.warn('Init not implemented yet - coming soon');
    // TODO: Implement project scaffolding
  });

// Show help by default if no command is provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

program.parse();
