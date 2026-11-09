import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildPage, renderProtocol } from '../deploy/render_protocol.mjs';

const page = readFileSync(new URL('../web/protocol/index.html', import.meta.url), 'utf8');
const pin = JSON.parse(readFileSync(new URL('../docs/protocol/SOURCE.json', import.meta.url), 'utf8'));
const sourceUrl = `${pin.repository}/blob/${pin.commit}/${pin.path}`;

test('committed page reproduces the pinned source and template without network access', () => {
  assert.equal(page, buildPage());
  assert.ok(page.includes(`href="${sourceUrl}"`));
  assert.ok(page.includes('script-src &#39;none&#39;') || page.includes("script-src 'none'"));
  assert.doesNotMatch(page, /<script\b/i);
  assert.ok(page.indexOf('View protocol specification on GitHub') < page.indexOf('<h1 id="sci">'));
  assert.match(page, /<details>\s*<summary>Contents<\/summary>/);
  for (const href of ['../style.css', './protocol.css']) {
    assert.ok(page.includes(`href="${href}"`));
    assert.ok(readFileSync(new URL(`../web/protocol/${href}`, import.meta.url)).length);
  }
});

test('all contents and document fragments resolve to unique local targets', () => {
  const ids = [...page.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, id] of page.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id), `Missing target: ${id}`);
  const nav = page.match(/<nav class="protocol-contents"[\s\S]*?<\/nav>/)[0];
  const sectionCount = [...page.matchAll(/<h[2-6] id=/g)].length;
  assert.ok(sectionCount > 35);
  assert.equal([...nav.matchAll(/<a href=/g)].length, sectionCount);
  assert.match(nav, /<li><a href="#52-external-identity-claims">[^<]+<\/a><ol><li><a href="#521-signed-claim">/);
  assert.ok(page.includes(`href="${new URL('sci-baseline-LICENSE.txt', sourceUrl)}"`));
});

test('renderer escapes source HTML, rejects unsafe links and retains table line breaks', () => {
  const { body, contents } = renderProtocol('## Safe & <script>alert(1)</script>\n\n<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n![x](https://example.org/x.png)\n\n| a | b |\n| --- | --- |\n| a | b<br><br>c |', sourceUrl);
  assert.doesNotMatch(body + contents, /<script\b|<img\b|href="javascript:/i);
  assert.ok(body.includes('&lt;script&gt;'));
  assert.ok(body.includes('b<br><br>c'));
});

test('heading hierarchy and duplicate IDs stay aligned with the contents', () => {
  const rendered = renderProtocol('# Title\n\n## Same\n\n### Subsection\n\n#### Detail\n\n## Same', sourceUrl);
  assert.deepEqual(rendered.sections, [
    { id: 'same', text: 'Same', children: [{ id: 'subsection', text: 'Subsection', children: [{ id: 'detail', text: 'Detail', children: [] }] }] },
    { id: 'same-1', text: 'Same', children: [] },
  ]);
  assert.ok(rendered.body.includes('<h2 id="same-1">'));
  assert.ok(rendered.contents.includes('href="#same-1"'));
});
