import esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions[]} */
const configs = [
  {
    entryPoints: ['src/background.ts'],
    outfile: 'background.js',
    bundle: true,
    format: 'iife',
    target: 'chrome100',
  },
  {
    entryPoints: ['src/content/detector.ts'],
    outfile: 'content/detector.js',
    bundle: true,
    format: 'iife',
    target: 'chrome100',
  },
  {
    entryPoints: ['src/content/overlay.ts'],
    outfile: 'content/overlay.js',
    bundle: true,
    format: 'iife',
    target: 'chrome100',
  },
  {
    entryPoints: ['src/popup/popup.ts'],
    outfile: 'popup/popup.js',
    bundle: true,
    format: 'iife',
    target: 'chrome100',
  },
];

async function run() {
  try {
    for (const config of configs) {
      if (isWatch) {
        const ctx = await esbuild.context(config);
        await ctx.watch();
      } else {
        await esbuild.build(config);
      }
    }
    console.log(`✅ Build complete! Compiled TypeScript to background.js, content/*.js, and popup/*.js`);
  } catch (err) {
    console.error('❌ Build failed:', err);
    process.exit(1);
  }
}

run();
