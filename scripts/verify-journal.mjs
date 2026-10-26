#!/usr/bin/env node
// SSOT-aligned structural smoke check. This does not replace visual/mobile or external-link QA.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { exit } from 'node:process';

const source = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const errors = [];
const warnings = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
// Unverified registration availability and relative dates must not reappear in
// this fixed-date issue. A working link does not prove that a form accepts responses.
// The precise first-meeting dates remain in the individual course pages.
for (const unsupportedClaim of [
  'ניתן עדיין להירשם',
  'ההרשמה עדיין פתוחה',
  'ההרשמה פתוחה',
  'יום ראשון הקרוב',
  'יפורסם בהמשך',
  'מספר מצפן בהמשך'
]) {
  assert(!source.includes(unsupportedClaim),
    'Unverified registration/Compass promises or stale relative dates must not reappear: ' + unsupportedClaim);
}

const sections = [...source.matchAll(/<section\b[^>]*class="[^"]*\bfolio\b[^"]*"[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
const unique = new Set(sections);
assert(unique.size === sections.length, 'Duplicate folio IDs');

// Accessibility regression guard: Hebrew reading direction and descriptive
// image alternatives are required in the actual publication markup.
// This is static validation; it does not certify screen-reader usability.
assert(/<html\s+lang="he"\s+dir="rtl">/.test(source),
  'Journal root must declare Hebrew language and right-to-left reading direction');
const allImageTags = [...source.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
assert(allImageTags.length >= 16, 'Expected the journal artwork and cover logo');
for (const tag of allImageTags) {
  const src = tag.match(/\bsrc="([^"]+)"/)?.[1] ?? '(missing src)';
  assert(/\balt="[^"]+"/.test(tag), 'Image missing a descriptive alt attribute: ' + src);
  if (src.startsWith('assets/selected/')) {
    assert(/\bloading="(?:lazy|eager)"/.test(tag) && /\bdecoding="async"/.test(tag),
      'Local journal artwork must declare loading and decoding behavior: ' + src);
  }
}

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
// The 2014777 linked syllabus is image-based. Its title names "Motivation and Mathematics",
// while the district flyer uses a different headline. Keep that distinction visible.
{
  const start = source.indexOf('id="course-2014777"');
  const page = start >= 0 ? source.slice(start, source.indexOf('</section>', start)) : '';
  assert(page.includes('2014777 מוטיבציה ומתמטיקה')
    && page.includes('שמו שונה מכותרת העלון')
    && page.includes('זמינות ההרשמה במצפן טרם אומתה'),
    'Course 2014777 must disclose the syllabus/flyer title mismatch and unverified Compass registration');
}
// First-session hours are distinct from the recurring schedule. Guard only hours
// confirmed in the course records; do not invent a first-session hour for 201590.
for (const [id, firstHours] of [
  ['community-yaniv-idan', '19:00–21:30'],
  ['course-201020', '19:00–21:30'],
  ['course-201530', '19:00–21:30'],
  ['course-201041', '19:00–21:30'],
  ['course-204781', '15:00–19:00'],
  ['course-2014777', '16:00–18:30']
]) {
  const page = source.slice(source.indexOf('id="' + id + '"'));
  const openingStart = page.indexOf('class="course-opening"');
  const opening = openingStart >= 0 ? page.slice(openingStart, page.indexOf('</div>', openingStart)) : '';
  assert(opening.includes(firstHours), 'Missing verified first-session hours for ' + id + ': ' + firstHours);
}
{
  const page = source.slice(source.indexOf('id="course-201590"'));
  const openingStart = page.indexOf('class="course-opening"');
  const opening = openingStart >= 0 ? page.slice(openingStart, page.indexOf('</div>', openingStart)) : '';
  assert(opening.includes('פתיחה בפסג״ה מודיעין') && opening.includes('בהמשך יום א׳'),
    '201590 must distinguish the opening session from later Sunday sessions; opening hour is not verified');
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
  for (const fact of ['״עדכון תוכנית הלימודים״', 'מדריך מחוזי חט״ב בעיר ירושלים', 'מדריך בית ספרי בעיר ירושלים', '30 שעות לגמול (24 שעות בזום, 6 שעות א־סינכרוניות)', 'בימי רביעי בין השעות 19:00–21:30', 'יום ראשון']) {
    assert(community.replace(/<[^>]+>/g, '').includes(fact), 'Yaniv-Idan coordinators community must follow its flyer: ' + fact);
  }
}
// A form link does not establish that it currently accepts submissions.
assert(!source.includes('ניתן עדיין להירשם') && !source.includes('ההרשמה כעת בטופס הקהילה'), 'Do not promise unverified community registration availability');
assert(source.slice(communityStart, communityEnd).includes('זמינות ההרשמה טעונה בדיקה'), 'Coordinator community must qualify registration availability');
for (const formId of ['1bnZ2j8x9UpR4l-2R5dr6-z0eg0Ai6EO1qpPkGnFm8fk','12akaEX5eVHsHTWZ59IPKLrboP7TFZRTPEulUQ6lSUbc']) {
  const tableStart = source.indexOf('id="catalog-summary"');
  const formLink = 'href="https://docs.google.com/forms/d/' + formId + '/viewform"';
  const at = source.indexOf(formLink, tableStart);
  assert(at >= 0 && source.slice(at, source.indexOf('</a>', at) + 4).includes('>טופס ↗</a>'), 'Unverified community link must be labeled as a form, not open registration: ' + formId);
}
const teachersStart = source.indexOf('id="community-teachers-jerusalem"');
const teachersEnd = source.indexOf('</section>', teachersStart);
assert(teachersStart >= 0 && teachersEnd > teachersStart, 'Missing Jerusalem district teachers community page');
if (teachersEnd > teachersStart) {
  const teachers = source.slice(teachersStart, teachersEnd);
  assert(teachers.includes('<time datetime="2026-10-07">07.10.2026</time>') && teachers.includes('תאריך הפתיחה אינו מאומת: 07.10 מול 24.10'), 'Teachers community must disclose the disputed 07.10/24.10 opening date');
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
  assert(firstRow.includes('#community-yaniv-idan') && firstRow.includes('25.10.2026') && firstRow.includes('יום ראשון') && !firstRow.includes('יום ראשון הקרוב'), 'First summary row must be the Yaniv/Idan coordinators community, first meeting 25.10.2026');
  assert(summary.includes('#community-teachers-jerusalem'), 'Missing teachers community table row');
  assert(!source.includes('יום ראשון הקרוב'), 'Relative date language must not become stale after 25 Oct 2026');
  for (const id of ['201020','201590','201530','201041','204781','2014777']) {
    assert(summary.includes('#course-' + id), 'Missing summary-to-course link: ' + id);
  }
  // Each of the nine catalog dates must match the corresponding detail page.
  // This catches silent first-meeting drift without inferring dates from weekday labels.
  const summaryRows = [...summary.matchAll(/<tr(?:\s[^>]*)?>[\s\S]*?<\/tr>/g)].map(m => m[0]);
  // Pin source-confirmed dates, not merely page/table agreement. The teachers
  // community date is disputed (07.10 vs 24.10), so it is NOT source-confirmed.
  const expectedFirstDates = {
    'community-yaniv-idan': '2026-10-25',
    'course-201020': '2026-10-13',
    'course-201590': '2026-10-28',
    'course-201530': '2026-10-28',
    'course-201041': '2026-10-13',
    'course-204781': '2026-10-28',
    'course-2014777': '2026-10-28',
    'event-203587': '2026-10-28'
  };
  for (const id of ['community-yaniv-idan','community-teachers-jerusalem','course-201020','course-201590','course-201530','course-201041','course-204781','course-2014777','event-203587']) {
    const start = source.indexOf('id="' + id + '"');
    const end = source.indexOf('</section>', start);
    assert(start >= 0 && end > start, 'Missing detail page for catalog date: ' + id);
    const page = start >= 0 && end > start ? source.slice(start, end) : '';
    const pageDate = page.match(/<time\b[^>]*datetime="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const matchingRows = summaryRows.filter(row => row.includes('href="#' + id + '"'));
    const tableDate = matchingRows[0]?.match(/<time\b[^>]*datetime="(\d{4}-\d{2}-\d{2})"/)?.[1];
    assert(matchingRows.length === 1, 'Expected exactly one catalog row for: ' + id);
    assert(Boolean(pageDate) && Boolean(tableDate) && pageDate === tableDate,
      'First-meeting date mismatch or missing semantic date: ' + id + ' (detail ' + (pageDate ?? 'missing') + ', table ' + (tableDate ?? 'missing') + ')');
    if (id === 'community-teachers-jerusalem') {
      assert(page.includes('תאריך הפתיחה אינו מאומת: 07.10 מול 24.10')
        && matchingRows[0]?.includes('תאריך פתיחה בבדיקה')
        && pageDate === '2026-10-07',
        'Disputed teachers-community date must be visibly qualified in both views, without silently changing the displayed provisional date');
    } else {
      assert(pageDate === expectedFirstDates[id] && tableDate === expectedFirstDates[id],
        'First-meeting date differs from the verified source for ' + id + ': expected ' + expectedFirstDates[id]);
    }
    // A catalog link must open the same source as its detail page.
    // In particular, this prevents swapping the two community registration forms.
    const rowLinks = [...(matchingRows[0] ?? '').matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].map(m => m[1]);
    const detailLinks = [...page.matchAll(/<a\b[^>]*href="(https:\/\/[^"]+)"[^>]*>/g)].map(m => m[1]);
    assert(rowLinks.length === 2 && rowLinks[0] === '#' + id,
      'Catalog row must have its own page link followed by one external source: ' + id);
    assert(rowLinks[1]?.startsWith('https://') && detailLinks.includes(rowLinks[1]),
      'Catalog external link differs from the detail-page source: ' + id);
  }
}
// Canonical external source links (recorded in SSOT and independently checked
// previously). Matching the table to the detail page is insufficient: if both
// are changed to the same wrong URL, that weaker consistency test still passes.
// This guard detects accidental swaps or edits, not current link availability.
const canonicalSourceLinks = {
  'community-yaniv-idan': 'https://docs.google.com/forms/d/1bnZ2j8x9UpR4l-2R5dr6-z0eg0Ai6EO1qpPkGnFm8fk/viewform',
  'community-teachers-jerusalem': 'https://docs.google.com/forms/d/12akaEX5eVHsHTWZ59IPKLrboP7TFZRTPEulUQ6lSUbc/viewform',
  'course-201020': 'https://drive.google.com/file/d/1QHYojSXEUtFHHtRDhhAb9guiXE4tF-oR/view',
  'course-201590': 'https://drive.google.com/file/d/1MPTDPrM6no1dOwKkayU4RSEpfFDbijTH/view',
  'course-201530': 'https://drive.google.com/file/d/1aVlPA5UMQfbSIAmPs0bhoCsPJ86VStGe/view',
  'course-201041': 'https://drive.google.com/file/d/14ybA9ao125SbMv4yqwa_u0inSpCcMQh-/view',
  'course-204781': 'https://drive.google.com/file/d/1FTEh4Lt5sBqd1kHF_riunRx6m4IjdxlS/view',
  'course-2014777': 'https://docs.google.com/document/d/1-FTftCvxTF0v1HiR4p8eUg464LUVHlfU3dd_-kuCbB4/edit',
  'event-203587': 'https://forms.gle/aekTYoPvQtMYmxGA8'
};
for (const [id, expected] of Object.entries(canonicalSourceLinks)) {
  const detailStart = source.indexOf('id="' + id + '"');
  const detailEnd = source.indexOf('</section>', detailStart);
  const detail = detailStart >= 0 && detailEnd > detailStart
    ? source.slice(detailStart, detailEnd) : '';
  const detailUrls = [...detail.matchAll(/<a\b[^>]*href="(https:\/\/[^"]+)"/g)].map(m => m[1]);
  assert(detailUrls.length === 1 && detailUrls[0] === expected,
    'External source link changed from the documented original: ' + id);
  const tableStart = source.indexOf('id="catalog-summary"');
  const tableEnd = source.indexOf('</section>', tableStart);
  const table = tableStart >= 0 && tableEnd > tableStart
    ? source.slice(tableStart, tableEnd) : '';
  const row = [...table.matchAll(/<tr(?:\s[^>]*)?>[\s\S]*?<\/tr>/g)]
    .map(m => m[0]).find(html => html.includes('href="#' + id + '"'));
  assert(row?.includes('href="' + expected + '"'),
    'Catalog source link changed from the documented original: ' + id);
}

// The symposium ends at 19:15; its final workshop ends at 19:00.
// Protect each value in its proper context (both numbers merely appearing is insufficient).
{
  const event = source.slice(source.indexOf('id="event-203587"'), source.indexOf('</section>', source.indexOf('id="event-203587"')));
  assert(/class="event-datebox"[\s\S]*?14:30–19:15[\s\S]*?<\/div>/.test(event),
    'Symposium datebox must show 14:30–19:15');
  assert(/<li><time[^>]*>[^<]*<span class="nw">17:50–19:00<\/span>[\s\S]*?סדנה שנייה<\/span><\/li>/.test(event),
    'Final symposium workshop must end at 19:00, not 19:15');
}
assert(sections.indexOf('know-ofek') + 1 === sections.indexOf('know-oz'), 'The two "חשוב לדעת" pages (Ofek Hadash, Oz LaTmura) must be consecutive');
const researchNotes = [...source.matchAll(/<aside class="research-note"[\s\S]*?<\/aside>/g)].map(m => m[0]);
assert(researchNotes.length === 3, 'Expected exactly 3 cited research notes, found ' + researchNotes.length);
for (const [author, year] of [['Darling-Hammond', '2017'], ['Yoon', '2007'], ['Garet', '2001']]) {
  assert(researchNotes.some(n => n.includes(author) && n.includes('(' + year + ')') && n.includes('<cite')), 'Missing cited research note: ' + author + ' ' + year);
}
assert(researchNotes.every(n => !n.includes('מן המחקר') && /<p>[^<]+<\/p><cite>על פי מחקר של /.test(n)), 'Research notes: the finding first, then a small "על פי מחקר של…" attribution; no "מן המחקר" label');
// External course/syllabus/form links open in a new tab. Protect the existing
// secure HTTPS + rel=noopener noreferrer behavior against future edits.
// This does not prove that the external forms currently accept submissions.
const externalAnchors = [...source.matchAll(/<a\b[^>]*\bhref="(https?:\/\/[^\"]+)"[^>]*>/g)];
assert(externalAnchors.length >= 9, 'Expected external course and registration source links');
for (const match of externalAnchors) {
  const [tag, url] = match;
  const rel = tag.match(/\brel="([^"]+)"/)?.[1]?.split(/\s+/) ?? [];
  assert(url.startsWith('https://'), 'External journal link must use HTTPS: ' + url);
  assert(/\btarget="_blank"/.test(tag) && rel.includes('noopener') && rel.includes('noreferrer'),
    'External journal link must open safely in a new tab: ' + url);
}
for (const href of [...source.matchAll(/href="#([^"]+)"/g)].map(m => m[1])) {
  assert(source.includes('id="' + href + '"'), 'Broken internal anchor: #' + href);
}
const finalPage = source.slice(source.indexOf('id="shabat"'));
assert(!finalPage.includes('פרשת'), 'Shabbat closing page must not mention weekly parasha');
assert(finalPage.includes('יניב רז'), 'Closing page must contain יניב רז');

// Editorial invariants: protect the user's exact words and journal identity.
// These are structural/text checks, not a substitute for human visual approval.
const folioHtml = id => {
  const start = source.indexOf('id="' + id + '"');
  return start < 0 ? '' : source.slice(start, source.indexOf('</section>', start));
};
const coverPage = folioHtml('cover');
for (const fact of ['סיכום שבועי', 'מספר 8', '23.10.2026', 'יום שישי', 'איילת קריספין', 'יניב רז']) {
  assert(coverPage.includes(fact), 'Cover lost required issue identity or credit: ' + fact);
}
const cinematicPage = folioHtml('cinematic');
for (const originalQuote of [
  'המורים שנכנסים לכיתה אחרי שישתתפו בהשתלמות, משדרים בשיעורים שקורה עכשיו משהו חדש.',
  'אם אתה חושב שאתה צריך להירשם להשתלמות, כנראה שההורים שלך זוכים ללמוד אצל הטוב ביותר.'
]) {
  assert(cinematicPage.includes(originalQuote), 'Cinematic section changed an exact user-authored quote');
}
const israelPage = folioHtml('world-report');
assert(israelPage.includes('לישראל מגיע') && israelPage.includes('מורים לומדים.')
  && israelPage.includes('class="feature-flag"'), 'Israel newspaper page lost its headline or flag');
assert(israelPage.includes('למידת עמיתים. זה משהו שלא לומדים במכללות להוראה. היא ממקצעת אותנו, ואין דרך טובה יותר להתפתח כדי להיות מורים טובים.'),
  'Israel newspaper page changed the original peer-learning quote');
assert(finalPage.includes('שבת') && finalPage.includes('שלום'), 'Final page lost Shabbat greeting');

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

// Real-image integrity: references must match actual files and provenance metadata.
// This is a binary/static check, not proof of image quality or live HTTP delivery.
const imageManifest = JSON.parse(readFileSync(new URL('../assets/selected/manifest.json', import.meta.url), 'utf8'));
const trackedImages = imageManifest.images ?? [];
const usedNames = artwork.map(p => p.slice('assets/selected/'.length));
assert(new Set(trackedImages.map(a => a.file)).size === trackedImages.length, 'Duplicate image filename in manifest');
assert(new Set(trackedImages.map(a => a.concept)).size === trackedImages.length, 'Duplicate image concept in manifest');
assert(usedNames.length === trackedImages.length
  && usedNames.every(f => trackedImages.some(a => a.file === f))
  && trackedImages.every(a => usedNames.includes(a.file)),
  'Manifest must match exactly the images used in the journal');
const imageHashes = new Map();
for (const path of artwork) {
  const file = new URL('../' + path, import.meta.url);
  assert(existsSync(file), 'Referenced image missing: ' + path);
  if (!existsSync(file)) continue;
  assert(statSync(file).size > 1024, 'Referenced image too small: ' + path);
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
  assert(!imageHashes.has(hash), 'Duplicate image content: ' + imageHashes.get(hash) + ' and ' + path);
  imageHashes.set(hash, path);
}
for (const asset of trackedImages) {
  assert(asset.file && asset.concept && asset.used, 'Incomplete image provenance entry');
  if (asset.file?.startsWith('lovable-')) {
    const assetId = asset.concept?.split('(asset ')[1]?.split(')')[0];
    assert(assetId && /^[0-9a-f-]{36}$/.test(assetId)
      && asset.source?.startsWith('https://jerusalem-geometry-garden.lovable.app/__l5e/assets-v1/' + assetId + '/')
      && asset.source.endsWith('.jpg'),
      'Lovable source ID/URL mismatch: ' + asset.file);
  }
}


 // Cross-check the independent Lovable provenance catalog against the image manifest.
 // This guards against a plausible-looking but misattributed/reused local Lovable image.
{
  const catalog = JSON.parse(readFileSync(new URL('../assets/lovable-selected.json', import.meta.url), 'utf8'));
  const selected = (catalog.assets ?? []).filter(asset => asset.local_copy);
  const lovable = trackedImages.filter(asset => asset.file?.startsWith('lovable-'));
  assert(new Set(selected.map(asset => asset.asset_id)).size === selected.length,
    'Duplicate original Lovable asset ID in provenance catalog');
  assert(new Set(selected.map(asset => asset.local_copy)).size === selected.length,
    'Duplicate local Lovable file in provenance catalog');
  assert(selected.length === lovable.length,
    'Selected Lovable provenance count must equal Lovable images in manifest');
  for (const asset of selected) {
    const localPath = 'assets/selected/' + asset.local_copy?.split('/').at(-1);
    const matching = lovable.filter(entry => entry.file === asset.local_copy?.split('/').at(-1));
    assert(asset.local_copy === localPath && matching.length === 1,
      'Lovable local file missing or mismatched in image manifest: ' + asset.local_copy);
    assert(/^[0-9a-f-]{36}$/.test(asset.asset_id ?? '')
      && asset.url?.includes('/__l5e/assets-v1/' + asset.asset_id + '/')
      && matching[0]?.source === asset.url,
      'Lovable original asset ID/URL differs between provenance files: ' + asset.local_copy);
  }
  for (const entry of lovable) {
    assert(selected.some(asset => asset.local_copy === 'assets/selected/' + entry.file),
      'Lovable image has no original-source record: ' + entry.file);
  }
}

warnings.push('Three distinct communities: Yaniv/Idan coordinators (no Compass number yet, 25 Oct), Yaniv/Idan teachers (no Compass number yet, started 7 Oct), numbered coordinators 201020 (13 Oct). Dates from separate written sources.');
warnings.push('The six Compass courses follow the official flyer PDF (השתלמויות תשפ״ז - חט״ב) and jerusalem2 /hishtalmuyot; its hidden text-layer codes (200123, 201298, 201757, 203678) are not visible courses and are not used.');
warnings.push('External syllabus and image URLs require live browser checks; this script only tests structure.');
console.log(JSON.stringify({ status: errors.length ? 'FAIL' : 'PASS', pages: sections.length, courses: 6, summaryRows: 9, heroImages: artwork.length, errors, warnings }, null, 2));
if (errors.length) exit(1);
