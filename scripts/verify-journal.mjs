#!/usr/bin/env node
// SSOT-aligned structural smoke check. This does not replace visual/mobile or external-link QA.
import { readFileSync } from 'node:fs';
import { exit } from 'node:process';

const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const errors = [];
const warnings = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const sections = [...source.matchAll(/<section\b[^>]*class="[^"]*\bfolio\b[^"]*"[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
const unique = new Set(sections);
assert(unique.size === sections.length, 'Duplicate folio IDs');
assert(sections.length >= 15, 'Expected 15+ folios including the two distinct coordinator community pages');
assert(sections[0] === 'cover', 'First folio must be the cover');
assert(sections.at(-1) === 'shabat', 'Last folio must be Shabbat greeting');
for (const page of ['opening','manifesto','inspiration','cinematic','world-report','seminar-invite','event-203587','catalog-summary','community-yaniv-idan','community-teachers-jerusalem','lesson-tomorrow','know-ofek','know-oz','shabat']) {
  assert(unique.has(page), 'Missing required page: ' + page);
}
for (const id of ['201020','201590','201530','201041','204781','2014777']) {
  const marker = 'id="course-' + id + '"';
  const start = source.indexOf(marker);
  const end = source.indexOf('</section>', start);
  assert(start !== -1 && end !== -1, 'Missing course page: ' + id);
  if (start >= 0 && end >= 0) {
    const content = source.slice(start, end);
    assert(content.includes('course-opening'), 'Missing first-meeting callout: ' + id);
    assert(/<time\s+datetime="\d{4}-\d{2}-\d{2}"/.test(content), 'Missing semantic first-meeting date: ' + id);
    assert(content.includes('href="https://drive.google.com/') || content.includes('href="https://docs.google.com/'), 'Missing syllabus link: ' + id);
  }
}
const communityStart = source.indexOf('id="community-yaniv-idan"');
const communityEnd = source.indexOf('</section>', communityStart);
assert(communityStart >= 0 && communityEnd > communityStart, 'Missing no-Compass coordinator community');
if (communityEnd > communityStart) {
  const community = source.slice(communityStart, communityEnd);
  assert(community.includes('<time datetime="2026-10-25">25.10.2026</time>'), 'Yaniv-Idan community first meeting must be 25 Oct');
  assert(community.includes('עידן אחוון') && community.includes('יניב רז'), 'Missing Yaniv Raz or Idan Ahvan');
  assert(community.includes('forms/d/1bnZ2j8x9UpR4l-2R5dr6-z0eg0Ai6EO1qpPkGnFm8fk'), 'Missing separate form');
  assert(!community.includes('<strong dir="ltr">201020</strong>'), 'Must not attribute Compass code 201020 to Yaniv-Idan community');
  assert(community.includes('אין עדיין מספר במצפן'), 'Yaniv-Idan coordinators community must state it has no Compass number yet');
}
const teachersStart = source.indexOf('id="community-teachers-jerusalem"');
const teachersEnd = source.indexOf('</section>', teachersStart);
assert(teachersStart >= 0 && teachersEnd > teachersStart, 'Missing Jerusalem district teachers community page');
if (teachersEnd > teachersStart) {
  const teachers = source.slice(teachersStart, teachersEnd);
  assert(teachers.includes('<time datetime="2026-10-07">07.10.2026</time>'), 'Teachers community started 7 Oct 2026');
  assert(teachers.includes('forms/d/12akaEX5eVHsHTWZ59IPKLrboP7TFZRTPEulUQ6lSUbc'), 'Missing teachers community form');
  assert(teachers.includes('אין עדיין מספר במצפן'), 'Teachers community must state it has no Compass number yet');
}
const summaryStart = source.indexOf('id="catalog-summary"');
const summaryEnd = source.indexOf('</section>', summaryStart);
assert(summaryStart >= 0 && summaryEnd > summaryStart, 'Missing summary page');
if (summaryEnd > summaryStart) {
  const summary = source.slice(summaryStart, summaryEnd);
  const rows = [...summary.matchAll(/<tr(?:\s|>)/g)].length - 1;
  assert(rows === 9, 'Expected 9 summary rows (2 no-Compass communities + 6 numbered courses + symposium), got ' + rows);
  assert([...summary.matchAll(/class="table-links"/g)].length === 9, 'Expected 2 action links for each summary row');
  assert(summary.includes('#community-yaniv-idan'), 'Missing distinct no-Compass community table row');
  assert(summary.includes('#community-teachers-jerusalem'), 'Missing teachers community table row');
  for (const id of ['201020','201590','201530','201041','204781','2014777']) {
    assert(summary.includes('#course-' + id), 'Missing summary-to-course link: ' + id);
  }
}
assert(sections.indexOf('know-ofek') + 1 === sections.indexOf('know-oz'), 'The two "חשוב לדעת" pages (Ofek Hadash, Oz LaTmura) must be consecutive');
const researchNotes = [...source.matchAll(/<aside class="research-note"[\s\S]*?<\/aside>/g)].map(m => m[0]);
assert(researchNotes.length === 3, 'Expected exactly 3 cited research notes, found ' + researchNotes.length);
for (const [author, year] of [['Darling-Hammond', '2017'], ['Yoon', '2007'], ['Garet', '2001']]) {
  assert(researchNotes.some(n => n.includes(author) && n.includes('(' + year + ')') && n.includes('<cite')), 'Missing cited research note: ' + author + ' ' + year);
}
for (const href of [...source.matchAll(/href="#([^"]+)"/g)].map(m => m[1])) {
  assert(source.includes('id="' + href + '"'), 'Broken internal anchor: #' + href);
}
const finalPage = source.slice(source.indexOf('id="shabat"'));
assert(!finalPage.includes('פרשת'), 'Shabbat closing page must not mention weekly parasha');
assert(finalPage.includes('יניב רז'), 'Closing page must contain יניב רז');
assert(source.includes('prefers-reduced-motion'), 'Missing reduced-motion support');
assert(source.includes('@media print'), 'Missing A4 print rules');
assert(source.includes('ישראל') && source.includes('feature-flag'), 'Missing Israel editorial motif');
const artwork = [...source.matchAll(/<img\s+[^>]*src="(assets\/selected\/[^"]+\.(?:jpg|jpeg|png|webp))"/g)].map(m => m[1]);
assert(artwork.length >= 6, 'Expected 6+ local hero images (assets/selected), found ' + artwork.length);
assert(new Set(artwork).size === artwork.length, 'Hero artwork duplicated across pages');
assert(!/lovable\.app/.test(source), 'No external temp image URLs (lovable.app) allowed — use local binaries in assets/selected');
warnings.push('Three distinct communities: Yaniv/Idan coordinators (no Compass number yet, 25 Oct), Yaniv/Idan teachers (no Compass number yet, started 7 Oct), numbered coordinators 201020 (13 Oct). Dates from separate written sources.');
warnings.push('Codes 2014777 and 202967 still require source validation before publishing their courses.');
warnings.push('External syllabus and image URLs require live browser checks; this script only tests structure.');
console.log(JSON.stringify({ status: errors.length ? 'FAIL' : 'PASS', pages: sections.length, courses: 6, summaryRows: 9, heroImages: artwork.length, errors, warnings }, null, 2));
if (errors.length) exit(1);
