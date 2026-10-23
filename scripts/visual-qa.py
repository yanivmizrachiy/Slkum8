#!/usr/bin/env python3
"""Visual smoke test for the real journal. Run on CI; never changes site content.

Requires: pip install playwright pypdf; python -m playwright install chromium.
Screenshots and an A4 PDF are QA artifacts, not approved publication files.
"""
from __future__ import annotations

import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "qa-artifacts"
OUT.mkdir(exist_ok=True)
WIDTHS = (320, 360, 375, 390, 412, 430, 768, 1280)
SAMPLES = ("cover", "community-yaniv-idan", "cinematic", "course-201590",
           "world-report", "event-203587", "catalog-summary", "shabat")
report = {"viewport_results": [], "print": {}, "errors": [], "limitations": [
    "This tests a local file copy, not the public deployment or live registration forms.",
    "Pixel screenshots require human review; geometric tests cannot certify visual design.",
    "External Google Fonts may fall back when unavailable on the CI runner."
]}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    for width in WIDTHS:
        page = browser.new_page(viewport={"width": width, "height": 900},
                                device_scale_factor=1, reduced_motion="reduce",
                                locale="he-IL")
        page.goto((ROOT / "index.html").as_uri(), wait_until="domcontentloaded",
                  timeout=45000)
        page.wait_for_timeout(400)
        # Eagerly decode local images before taking screenshots or printing. A
        # screenshot of an off-screen lazy image can otherwise capture only the
        # CSS gradient placeholder even when the image itself is valid.
        if width in (375, 1280):
            image_check = page.evaluate("""async () => {
              const imgs = [...document.querySelectorAll('img[src^="assets/"]')];
              imgs.forEach(img => { img.loading = 'eager'; });
              const decoded = await Promise.all(imgs.map(img => Promise.race([
                img.decode().then(() => true, () => false),
                new Promise(resolve => setTimeout(() => resolve(false), 15000))
              ])));
              return {total: imgs.length, broken: imgs
                .filter((img, i) => !decoded[i] || img.naturalWidth === 0)
                .map(img => img.getAttribute('src'))};
            }""")
            report.setdefault("local_image_decoding", []).append(
                {"width": width, **image_check})
            if image_check["broken"]:
                report["errors"].append(
                    f"{width}px: local images failed to decode: {image_check['broken']}")
        metrics = page.evaluate("""() => {
          const pages = [...document.querySelectorAll('section.folio')];
          const doc = document.documentElement;
          const viewport = doc.clientWidth;
          const outside = pages.filter(el => {
            const r = el.getBoundingClientRect();
            return r.left < -2 || r.right > viewport + 2;
          }).map(el => el.id);
          const key = [...document.querySelectorAll(
            '.course-opening time, .event-datebox time, .shabat-name, .table-links a'
          )];
          const clipped = key.filter(el => {
            const folio = el.closest('.folio');
            if (!folio || getComputedStyle(el).display === 'none') return false;
            const r = el.getBoundingClientRect(), f = folio.getBoundingClientRect();
            return r.left < f.left - 2 || r.right > f.right + 2 ||
                   r.top < f.top - 2 || r.bottom > f.bottom + 2;
          }).map(el => (el.closest('.folio')?.id || '?') + ': ' +
                             (el.textContent || '').trim().slice(0, 35));
          // Inspect real rendered links/dates/touch targets, not just HTML text.
          const catalogRows = [...document.querySelectorAll('#catalog-summary tbody tr')];
          const catalogLinkIssues = catalogRows.flatMap((row, i) => {
            const links = [...row.querySelectorAll('.table-links a')];
            return links.length === 2 &&
              links.filter(a => a.getAttribute('href')?.startsWith('#')).length === 1 &&
              links.filter(a => /^https:\/\//.test(a.getAttribute('href') || '')).length === 1
              ? [] : ['row ' + (i + 1) + ': expected one page link and one HTTPS source link'];
          });
          const externalLinkIssues = [...document.querySelectorAll('a[target="_blank"]')]
            .filter(a => !/^https:\/\//.test(a.href) ||
              !a.relList.contains('noopener') || !a.relList.contains('noreferrer'))
            .map(a => a.getAttribute('href'));
          const dateMismatches = [...document.querySelectorAll('time[datetime]')]
            .filter(el => {
              const d = el.getAttribute('datetime');
              return !/^\\d{4}-\\d{2}-\\d{2}$/.test(d) ||
                el.textContent.trim() !== d.slice(8, 10) + '.' +
                  d.slice(5, 7) + '.' + d.slice(0, 4);
            }).map(el => (el.closest('.folio')?.id || '?') + ': ' + el.textContent.trim());
          const touchTargets = viewport <= 430 ? [...document.querySelectorAll(
            '#catalog-summary .table-links a, .catalog-sheet .catalog-actions > a, .event-registration a'
          )].filter(el => {
            const r = el.getBoundingClientRect();
            return r.width < 44 || r.height < 44;
          }).map(el => (el.closest('.folio')?.id || '?') + ': ' +
            (el.textContent || '').trim().slice(0, 30)) : [];
          return {width: viewport, scrollWidth: doc.scrollWidth,
                  folios: pages.length, outside, clipped, catalogRows: catalogRows.length,
                  catalogLinkIssues, externalLinkIssues, dateMismatches, touchTargets};
        }""")
        report["viewport_results"].append(metrics)
        if metrics["scrollWidth"] > metrics["width"] + 2:
            report["errors"].append(f"{width}px: horizontal scroll {metrics['scrollWidth']}px")
        if metrics["folios"] != 28:
            report["errors"].append(f"{width}px: expected 28 folios, got {metrics['folios']}")
        if metrics["outside"]:
            report["errors"].append(f"{width}px: folios outside viewport: {metrics['outside']}")
        if metrics["clipped"]:
            report["errors"].append(f"{width}px: key content outside folio: {metrics['clipped']}")
        if metrics["catalogRows"] != 9:
            report["errors"].append(f"{width}px: expected 9 catalog rows, got {metrics['catalogRows']}")
        for field in ("catalogLinkIssues", "externalLinkIssues", "dateMismatches", "touchTargets"):
            if metrics[field]:
                report["errors"].append(f"{width}px: {field}: {metrics[field]}")
        if width in (375, 1280):
            # Save all 28 mobile folios for a complete human review; desktop
            # retains the representative 8-page sample to bound artifact size.
            screenshot_ids = ([el["id"] for el in page.locator("section.folio").evaluate_all(
                "(els) => els.map(el => ({id: el.id}))")] if width == 375 else SAMPLES)
            report.setdefault("screenshots", {})[str(width)] = len(screenshot_ids)
            for section in screenshot_ids:
                loc = page.locator("#" + section)
                if loc.count() != 1:
                    report["errors"].append(f"{width}px: missing sample #{section}")
                    continue
                loc.screenshot(path=str(OUT / f"{width}-{section}.png"),
                               animations="disabled", timeout=30000)
        if width == 1280:
            page.emulate_media(media="print")
            pdf_path = OUT / "journal-a4-qa.pdf"
            page.pdf(path=str(pdf_path), print_background=True,
                     prefer_css_page_size=True, format="A4")
            count = len(PdfReader(str(pdf_path)).pages)
            report["print"] = {"pdf_pages": count, "expected_pages": 28,
                               "file": pdf_path.name}
            if count != 28:
                report["errors"].append(f"A4 PDF page count {count}, expected 28")
        page.close()
    browser.close()

(OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2),
                                  encoding="utf-8")
print(json.dumps({"widths": WIDTHS, "print": report["print"],
                  "errors": report["errors"]}, ensure_ascii=False, indent=2))
if report["errors"]:
    raise SystemExit(1)
