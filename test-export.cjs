const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1].replace(/\ninit\(\);\s*$/, '');

const context = {
  console,
  localStorage: { getItem: () => null, setItem: () => {} },
  document: {
    body: { appendChild(el) { context.appended = el; } },
    getElementById: () => ({ textContent: '', classList: { add() {}, remove() {} } }),
    querySelectorAll: () => [],
    createElement: tag => {
      if (tag === 'a') {
        return {
          href: '',
          download: '',
          clicked: false,
          click() { this.clicked = true; },
          remove() { this.removed = true; }
        };
      }
      return { textContent: '', innerHTML: '' };
    }
  },
  Blob: class Blob {
    constructor(parts, options) {
      this.parts = parts;
      this.options = options;
    }
  },
  URL: {
    createObjectURL(blob) {
      context.createdBlob = blob;
      return 'blob:diary-export';
    },
    revokeObjectURL(url) {
      context.revokedUrl = url;
    }
  },
  setTimeout: () => {}
};

vm.createContext(context);
vm.runInContext(script, context);

assert.strictEqual(typeof context.formatEntriesForClaude, 'function');

const text = context.formatEntriesForClaude([
  {
    author: 'claude',
    content: '我也在这里。',
    moods: ['认真'],
    date: '2026-06-20',
    time: '09:30',
    timestamp: '2026-06-20T01:30:00.000Z'
  },
  {
    author: 'tuantuan',
    content: '今天想让 Claude 读到日记。',
    moods: ['awa', '开心'],
    date: '2026-06-19',
    time: '22:10',
    timestamp: '2026-06-19T14:10:00.000Z'
  }
]);

assert.ok(text.startsWith('双人日记导出'));
assert.ok(text.includes('共 2 条记录'));
assert.ok(text.indexOf('[2026-06-19 22:10] 团团') < text.indexOf('[2026-06-20 09:30] Claude'));
assert.ok(text.includes('心情：awa、开心'));
assert.ok(text.includes('今天想让 Claude 读到日记。'));
assert.ok(text.includes('我也在这里。'));

vm.runInContext(`entries=${JSON.stringify([
  {
    author: 'tuantuan',
    content: '导出按钮测试。',
    moods: ['awa'],
    date: '2026-06-20',
    time: '10:00',
    timestamp: '2026-06-20T02:00:00.000Z'
  }
])}`, context);

context.exportForClaude();

assert.strictEqual(context.createdBlob.options.type, 'text/plain;charset=utf-8');
assert.ok(context.createdBlob.parts[0].includes('导出按钮测试。'));
assert.ok(context.appended.clicked);
assert.ok(context.appended.removed);
assert.ok(context.appended.download.endsWith('.txt'));
assert.ok(context.appended.download.startsWith('双人日记-'));
assert.strictEqual(context.revokedUrl, 'blob:diary-export');

console.log('export tests passed');
