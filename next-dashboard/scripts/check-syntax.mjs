import { readFileSync } from 'fs';
const html = readFileSync('legacy-assets/Index.html', 'utf8');
const matches = [...html.matchAll(/<script(?:\s[^>]*)?>[\s\S]*?<\/script>/g)];
const inlineScript = matches.find(m => !/<script[^>]+src=/.test(m[0]));
const content = inlineScript[0].replace(/<script[^>]*>/, '').replace(/<\/script>$/, '');
const lines = content.split('\n');
console.log('Total lines:', lines.length);

// Check with vm
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const vm = require('vm');
try {
  new vm.Script(content, { filename: 'Index.html', lineOffset: 0 });
  console.log('vm.Script: OK');
} catch(e) {
  console.log('vm.Script error:', e.message);
  if (e.stack) console.log(e.stack.split('\n').slice(0, 5).join('\n'));
}

// Also try new Function for comparison
try {
  new Function(content);
  console.log('new Function: OK');
} catch(e) {
  console.log('new Function error:', e.message);
  if (e.stack) console.log(e.stack.split('\n').slice(0, 5).join('\n'));
}

// Count braces (naive, ignores strings)
let depth = 0;
let maxNegDepth = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (const c of line) {
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth < maxNegDepth) {
        maxNegDepth = depth;
        console.log('Low depth', depth, 'at line', i + 1, ':', line.trim().slice(0, 100));
      }
    }
  }
}
console.log('Final brace depth (naive):', depth);
