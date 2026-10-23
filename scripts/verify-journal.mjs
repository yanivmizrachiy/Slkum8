#!/usr/bin/env node
// SSOT-aligned structural smoke check. This does not replace visual/mobile or external-link QA.
import { existsSync, readFileSync } from 'node:fs';
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
for (const page of ['gallery-digital','gallery-online','gallery-origami','gallery-hybrid','gallery-jerusalem','gallery-workshop','gallery-mosaic']) {
  assert(unique.has(page), 'Missing Lovable gallery page: ' + page);
}
const isTraining = id => /^(course|community|event)-/.test(id);
for (let i = 1; i < sections.length; i++) {
  assert(!(isTraining(sections[i - 1]) && isTraining(sections[i])), 'Two training pages are adjacent (put a design page between them): ' + sections[i - 1] + ' → ' + sections[i]);
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
{
  const start = source.indexOf('id="course-201020"');
  const page = source.slice(start, source.indexOf('</section>', start));
  assert(!page.includes('יניב רז') && !page.includes('עידן'), 'Compass 201020 is not the Yaniv/Idan coordinators community: do not name them on #course-201020');
}
for (const [id, name] of [['201590','בינה מלאכותית ו־MOODLE'],['201530','בכיתתו וחנ״מ'],['201041','הוראת המתמטיקה בכיתות ט׳'],['204781','גיאומטריה מהשטח'],['2014777','עדכון תוכנית הלימודים במתמטיקה']]) {
  const start = source.indexOf('id="course-' + id + '"');
  assert(source.slice(start, source.indexOf('</section>', start)).includes(name), 'Course ' + id + ' must use the official flyer title: ' + name);
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
  for (const fact of ['״עדכון תוכנית הלימודים״', 'מדריך מחוזי חט״ב בעיר ירושלים', 'מדריך בית ספרי בעיר ירושלים', '30 שעות לגמול (24 שעות בזום, 6 שעות א־סינכרוניות)', 'בימי רביעי בין השעות 19:00–21:30', 'יום ראשון הקרוב']) {
    assert(community.replace(/<[^>]+>/g, '').includes(fact), 'Yaniv-Idan coordinators community must follow its flyer: ' + fact);
  }
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
  const firstRow = summary.slice(summary.indexOf('<tbody>'), summary.indexOf('</tr>', summary.indexOf('<tbody>')));
  assert(firstRow.includes('#community-yaniv-idan') && firstRow.includes('25.10.2026') && firstRow.includes('יום ראשון הקרוב'), 'First summary row must be the Yaniv/Idan coordinators community, starting this Sunday 25.10.2026');
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
assert(researchNotes.every(n => !n.includes('מן המחקר') && /<p>[^<]+<\/p><cite>על פי מחקר של /.test(n)), 'Research notes: the finding first, then a small "על פי מחקר של…" attribution; no "מן המחקר" label');
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
assert(/<link rel="icon" href="data:image\/svg\+xml,/.test(source), 'Missing inline favicon (avoids a /favicon.ico 404)');
{
  const og = source.match(/<meta property="og:image" content="https:\/\/slkum8\.vercel\.app\/([^"]+)"/);
  assert(og && existsSync(new URL('../' + og[1], import.meta.url)), 'og:image must point to a file committed in this repo');
}
assert(!/lovable\.app/.test(source),'No external temp image URLs (lovable.app) allowed — use local binaries in assets/selected');
warnings.push('Three distinct communities: Yaniv/Idan coordinators (no Compass number yet, 25 Oct), Yaniv/Idan teachers (no Compass number yet, started 7 Oct), numbered coordinators 201020 (13 Oct). Dates from separate written sources.');
warnings.push('The six Compass courses follow the official flyer PDF (השתלמויות תשפ״ז - חט״ב) and jerusalem2 /hishtalmuyot; its hidden text-layer codes (200123, 201298, 201757, 203678) are not visible courses and are not used.');
warnings.push('External syllabus and image URLs require live browser checks; this script only tests structure.');
console.log(JSON.stringify({ status: errors.length ? 'FAIL' : 'PASS', pages: sections.length, courses: 6, summaryRows: 9, heroImages: artwork.length, errors, warnings }, null, 2));
if (errors.length) exit(1);
