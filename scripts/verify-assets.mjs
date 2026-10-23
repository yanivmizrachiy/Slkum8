#!/usr/bin/env node
// Offline Lovable media manifest integrity. Does not fetch or duplicate images.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('../assets/lovable-selected.json', import.meta.url), 'utf8'));
const origin = 'https://jerusalem-geometry-garden.lovable.app';
const used = [...html.matchAll(/<img\b[^>]*\bsrc="(https:\/\/jerusalem-geometry-garden\.lovable\.app\/[^"]+)"/g)].map(m => m[1]);
const listed = manifest.assets.map(a => a.url);
assert.ok(used.length >= 6, 'Expected six original images across journal pages');
assert.equal(new Set(used).size, used.length, 'Duplicate image URL in journal');
assert.equal(new Set(listed).size, listed.length, 'Duplicate image URL in manifest');
assert.deepEqual(new Set(used), new Set(listed), 'Journal images differ from tracked originals');
for (const asset of manifest.assets) {
  assert.ok(asset.asset_id && asset.file && asset.used_at, 'Missing original asset metadata');
  assert.ok(asset.url.startsWith(origin + '/__l5e/assets-v1/' + asset.asset_id + '/'), 'Noncanonical Lovable URL: ' + asset.file);
  assert.ok(asset.url.endsWith('/' + asset.file), 'Filename mismatch: ' + asset.file);
}
console.log('PASS: ' + used.length + ' unique Lovable originals tracked; no image duplication.');
console.log('NOTE: live image availability and mobile appearance require separate browser QA.');
