// Drives headless Edge via CDP: seeds localStorage (legal acceptance), then
// navigates to a page and captures a screenshot.
// Usage: node scripts/cdp-shot.mjs <url> <out.png> [extraEval]
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333;
const [url, out, extraEval] = process.argv.slice(2);

const browser = spawn(EDGE, [
  '--headless',
  '--disable-gpu',
  '--no-first-run',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.env.TEMP}/edge-cdp-profile`,
  '--window-size=420,900',
  'about:blank',
], { stdio: 'ignore' });

process.on('exit', () => browser.kill());

async function getTarget() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/json`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('no CDP target');
}

const target = await getTarget();
const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

const events = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id).resolve(msg.result ?? msg);
    pending.delete(msg.id);
  } else {
    events.push(msg);
  }
};

await new Promise((r) => (ws.onopen = r));

const origin = new URL(url).origin;
await send('Page.enable');
await send('Runtime.enable');
// Seed legal acceptance so the app doesn't bounce to /legal.
await send('Page.navigate', { url: origin });
await new Promise((r) => setTimeout(r, 4000));
await send('Runtime.evaluate', {
  expression: `localStorage.setItem('lr.mobile.legalAccepted', JSON.stringify({accepted:true,at:new Date().toISOString(),recorded:true}))`,
});
if (extraEval) {
  await send('Runtime.evaluate', { expression: extraEval });
}
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, 9000));
// Measure the search input and Search button geometry.
const measure = await send('Runtime.evaluate', {
  returnByValue: true,
  expression: `(() => {
    const input = document.querySelector('input');
    const leaf = [...document.querySelectorAll('div')].find((d) => d.textContent.trim() === 'Search' && d.children.length <= 1);
    const btn = leaf ? (leaf.closest('[role=button]') ?? leaf.parentElement) : null;
    const row = input ? input.parentElement.parentElement : null;
    const card = row ? row.parentElement : null;
    const stopLeaf = [...document.querySelectorAll('div')].find((d) => d.textContent.trim().startsWith('Jump to a stop'));
    const picker = stopLeaf ? (stopLeaf.closest('[role=button]') ?? stopLeaf.parentElement) : null;
    const r = (el) => el ? JSON.parse(JSON.stringify(el.getBoundingClientRect())) : null;
    return JSON.stringify({ input: r(input), button: r(btn), searchRow: r(row), picker: r(picker), card: r(card) });
  })()`,
});
console.log('measure:', measure.result?.value);
// Log console errors for debugging.
const logs = await send('Runtime.evaluate', { expression: 'document.title' });
// Clip to the search card region (measured input ~x40,y230,w415,h140), 3x zoom.
const clip = process.env.SHOT_CLIP ? JSON.parse(process.env.SHOT_CLIP) : undefined;
const shot = await send('Page.captureScreenshot', clip ? { format: 'png', clip: { ...clip, scale: clip.scale ?? 3 } } : { format: 'png' });
writeFileSync(out, shot.data, 'base64');
console.log('title:', logs.result?.value);
console.log('wrote', out);
ws.close();
browser.kill();
process.exit(0);
