#!/usr/bin/env node
const fs = require('node:fs');
const readline = require('node:readline');
const directory = process.argv[process.argv.indexOf('--dir') + 1];
fs.writeFileSync(directory + '/helper-started.json', JSON.stringify({ pid: process.pid }));
console.log(JSON.stringify({ event: 'ready', width: 1920, height: 1080, displayCount: 1, displays: [{ index: 0 }], queueDepth: 3, segmentSeconds: 30 }));
readline.createInterface({ input: process.stdin }).on('line', line => {
  if (JSON.parse(line).action === 'quit') {
    // Model asynchronous ScreenCaptureKit stopCapture completion.
    setTimeout(() => {
      fs.writeFileSync(directory + '/helper-stopped.json', JSON.stringify({ pid: process.pid }));
      process.exit(0);
    }, 200);
  }
});
