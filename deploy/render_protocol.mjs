// Generate the static protocol page from a pinned SCI document.
// Uses the same Markdown library and rendering rules as Sciscape /api/protocol.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const markdownit = require('../web/vendor/markdown-it-15.0.3.min.js');
const root = new URL('../', import.meta.url);
const repository = 'https://github.com/azaho/sci-dev';
const sourcePath = 'protocol/README.md';
const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
const escapeHtml = (text) => text.replace(/[&<>"'`]/g, (c) => escapes[c]);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function renderProtocol(source, sourceUrl) {
  const markdown = markdownit({ html: true, linkify: false, typographer: false });
  markdown.disable('image');
  markdown.renderer.rules.html_inline = (tokens, index) => {
    const text = tokens[index].content;
    return /^<br\s*\/?\s*>$/i.test(text) ? '<br>' : escapeHtml(text);
  };
  markdown.renderer.rules.html_block = (tokens, index) => escapeHtml(tokens[index].content);
  const env = {};
  const tokens = markdown.parse(source, env);
  const ids = new Set();
  const sections = [];
  const parents = [];
  function rewriteLinks(tokens) {
    for (const token of tokens) {
      const href = token.type === 'link_open' ? token.attrGet('href') : null;
      if (href && !href.startsWith('#')) token.attrSet('href', new URL(href, sourceUrl).href);
      if (token.children) rewriteLinks(token.children);
    }
  }
  for (const [index, token] of tokens.entries()) {
    if (token.type !== 'heading_open') continue;
    const heading = tokens[index + 1];
    const text = heading?.children?.map((child) => child.content).join('') ?? heading?.content ?? '';
    const slug = text.toLowerCase().replace(/[^\p{L}\p{M}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
    let id = slug;
    for (let suffix = 1; ids.has(id); suffix++) id = `${slug}-${suffix}`;
    ids.add(id);
    token.attrSet('id', id);
    const level = Number(token.tag.slice(1));
    if (level === 1) { parents.length = 0; continue; }
    while (parents.length && parents.at(-1).level >= level) parents.pop();
    const section = { id, text, children: [] };
    (parents.at(-1)?.section.children ?? sections).push(section);
    parents.push({ level, section });
  }
  rewriteLinks(tokens);
  function contentsList(sections) {
    return `<ol>${sections.map((section) => `<li><a href="#${escapeHtml(section.id)}">${escapeHtml(section.text)}</a>${section.children.length ? contentsList(section.children) : ''}</li>`).join('')}</ol>`;
  }
  return { body: markdown.renderer.render(tokens, markdown.options, env), contents: contentsList(sections), sections };
}

export function buildPage() {
  const pin = JSON.parse(readFileSync(new URL('docs/protocol/SOURCE.json', root), 'utf8'));
  if (pin.repository !== repository || pin.path !== sourcePath || !/^[a-f0-9]{40}$/.test(pin.commit)) {
    throw new Error('Invalid protocol source pin');
  }
  const source = readFileSync(new URL('docs/protocol/README.md', root));
  if (digest(source) !== pin.sha256) throw new Error('Protocol source does not match its pinned SHA-256');
  const sourceUrl = `${repository}/blob/${pin.commit}/${sourcePath}`;
  const rendered = renderProtocol(source.toString('utf8'), sourceUrl);
  const values = { source_url: escapeHtml(sourceUrl), contents: rendered.contents, body: rendered.body };
  return readFileSync(new URL('docs/protocol/page.html', root), 'utf8')
    .replace(/\{\{(source_url|contents|body)\}\}/g, (_, key) => values[key]);
}

async function main(args) {
  if (args[0] === '--update' && args.length === 2 && /^[a-f0-9]{40}$/.test(args[1])) {
    const commit = args[1];
    const response = await fetch(`https://raw.githubusercontent.com/azaho/sci-dev/${commit}/${sourcePath}`);
    if (!response.ok) throw new Error(`Protocol download failed: HTTP ${response.status}`);
    const source = Buffer.from(await response.arrayBuffer());
    writeFileSync(new URL('docs/protocol/README.md', root), source);
    writeFileSync(new URL('docs/protocol/SOURCE.json', root), `${JSON.stringify({ repository, commit, path: sourcePath, sha256: digest(source) }, null, 2)}\n`);
  } else if (args.length && !(args.length === 1 && args[0] === '--check')) {
    throw new Error('Usage: node deploy/render_protocol.mjs [--check | --update SCI_COMMIT]');
  }
  const output = new URL('web/protocol/index.html', root);
  const page = buildPage();
  if (args[0] === '--check') {
    if (readFileSync(output, 'utf8') !== page) throw new Error('Protocol page is stale; run node deploy/render_protocol.mjs');
  } else {
    writeFileSync(output, page);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main(process.argv.slice(2));
