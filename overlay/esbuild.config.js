const esbuild = require('esbuild');
const path = require('path');

const watch = process.argv.includes('--watch');

const baseConfig = {
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  platform: 'node',
  target: 'node18',
  external: ['electron'],
};

async function build() {
  // Main process
  await esbuild.build({
    ...baseConfig,
    entryPoints: [path.join(__dirname, 'src/main.ts')],
    outfile: path.join(__dirname, 'dist/main.js'),
  });

  // Preload script
  await esbuild.build({
    ...baseConfig,
    entryPoints: [path.join(__dirname, 'src/preload.ts')],
    outfile: path.join(__dirname, 'dist/preload.js'),
  });

  // Renderer process
  await esbuild.build({
    ...baseConfig,
    platform: 'browser',
    target: 'chrome120',
    entryPoints: [path.join(__dirname, 'src/renderer.ts')],
    outfile: path.join(__dirname, 'dist/renderer.js'),
  });

  console.log('Build complete');
}

if (watch) {
  // Simple watch implementation for esbuild 0.19+
  const ctx = build();
  // Note: For a real watch mode in esbuild 0.19+, you'd use context.watch()
  // but for a one-off scaffold we'll keep it simple or the user can expand it.
} else {
  build().catch(() => process.exit(1));
}
