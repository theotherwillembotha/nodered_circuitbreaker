const esbuild = require('esbuild');
const path = require('path');

// Packages that must remain as require() calls at runtime in the container.
const external = [
    // Real Node-RED runtime dep — installed in the container
    'node-red',
    // Plugincore is a peer dep — volume-mounted in Docker, or installed via npm dependencies.
    // Keeping it external avoids bundling winston, express, and all their transitive deps.
    '@theotherwillembotha/node-red-plugincore',
    // plugincore build-time deps — lazy require()s, only needed during node generation
    'jsdom', 'js-beautify', 'markdown-it',
];

const sharedConfig = {
    bundle: true,
    platform: 'node',
    target: 'node18',
    external,
    format: 'cjs',
    // Nodes.js does require("@theotherwillembotha/node-red-circuitbreaker") (self-reference).
    // Alias it to the local build output so esbuild can bundle it inline.
    alias: {
        '@theotherwillembotha/node-red-circuitbreaker': path.resolve('./build/index.js'),
    },
};

async function build() {
    await esbuild.build({
        ...sharedConfig,
        entryPoints: ['build/Nodes.js'],
        outfile: 'build/Nodes.js',
        allowOverwrite: true,
    });
    console.log('Bundled Nodes.js');

    await esbuild.build({
        ...sharedConfig,
        entryPoints: ['build/Plugins.js'],
        outfile: 'build/Plugins.js',
        allowOverwrite: true,
    });
    console.log('Bundled Plugins.js');
}

build().catch(err => {
    console.error(err);
    process.exit(1);
});
