/**
 * Simple test/demo for package manager detection
 * Run with: tsx packages/cli/test-pm.ts
 */

import { detectPM } from './src/pm.js';

async function test() {
  console.log('🧪 Testing Package Manager Detection\n');

  // Test 1: Detect from current directory (should find pnpm-lock.yaml)
  console.log('Test 1: Auto-detect from lockfile');
  console.log('────────────────────────────────────');
  const pm1 = await detectPM(process.cwd());
  console.log('Result:', pm1);
  console.log('');

  // Test 2: Force npm
  console.log('Test 2: Force npm override');
  console.log('────────────────────────────────────');
  const pm2 = await detectPM(process.cwd(), 'npm');
  console.log('Result:', pm2);
  console.log('');

  // Test 3: Force pnpm
  console.log('Test 3: Force pnpm override');
  console.log('────────────────────────────────────');
  const pm3 = await detectPM(process.cwd(), 'pnpm');
  console.log('Result:', pm3);
  console.log('');

  // Test 4: Detect from directory with no lockfile
  console.log('Test 4: Directory with no lockfile (fallback)');
  console.log('────────────────────────────────────');
  const tempDir = process.env.TEMP || '/tmp';
  const pm4 = await detectPM(tempDir);
  console.log('Result:', pm4);
  console.log('');

  console.log('✅ All tests completed!');
}

test().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
