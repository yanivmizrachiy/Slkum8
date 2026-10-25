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
            # An A4 PDF with the right page count can still lose clickable
            # syllabus/form links. Verify the nine catalog source links survive
            # Chromium print as real URI annotations (not just visible text).
            expected_urls = set(page.locator(
                '#catalog-summary .table-links a[href^="https://"]'
            ).evaluate_all("(els) => els.map(a => a.href)"))
            reader = PdfReader(str(pdf_path))
            count = len(reader.pages)
            # Verify physical A4 portrait dimensions, not just the number of
            # pages. CSS @page can override Chromium's format="A4" setting.
            expected_a4_pt = (595.2756, 841.8898)
            non_a4_pages = [
                {"page": i, "width_pt": round(float(pdf_page.mediabox.width), 2),
                 "height_pt": round(float(pdf_page.mediabox.height), 2)}
                for i, pdf_page in enumerate(reader.pages, start=1)
                if abs(float(pdf_page.mediabox.width) - expected_a4_pt[0]) > 2
                or abs(float(pdf_page.mediabox.height) - expected_a4_pt[1]) > 2
            ]
            printed_urls = set()
            for pdf_page in reader.pages:
                for annotation in pdf_page.get("/Annots", []):
                    obj = annotation.get_object()
                    action = obj.get("/A")
                    if action and action.get("/S") == "/URI":
                        printed_urls.add(str(action.get("/URI")))
            missing_urls = sorted(expected_urls - printed_urls)
            # Print typography is a separate quality gate from geometry. Collect
            # measured PDF text sizes for the catalog page so a CSS improvement
            # cannot be called readable merely because pagination still passes.
            # These are diagnostics, not proof of legibility on physical paper.
            catalog_index = page.locator("section.folio").evaluate_all(
                "(els) => els.findIndex(el => el.id === 'catalog-summary')")
            catalog_sizes = []
            if 0 <= catalog_index < count:
                def collect_catalog_text(text, cm, tm, font_dict, font_size):
                    chars = len(text.strip())
                    if not chars:
                        return
                    # Chromium may place a scale in the PDF current transform.
                    # Account for it instead of trusting the raw font operand.
                    scale = max((cm[0] ** 2 + cm[1] ** 2) ** 0.5,
                                (cm[2] ** 2 + cm[3] ** 2) ** 0.5)
                    pt = float(font_size) * scale
                    if 2 <= pt <= 40:
                        catalog_sizes.append((pt, chars))
                reader.pages[catalog_index].extract_text(
                    visitor_text=collect_catalog_text)
            total_chars = sum(chars for _, chars in catalog_sizes)
            catalog_type = {
                "pdf_page": catalog_index + 1 if catalog_index >= 0 else None,
                "measured_characters": total_chars,
                "min_effective_pt": round(min((pt for pt, _ in catalog_sizes),
                                          default=0), 2),
                "percent_characters_below_7pt": round(
                    100 * sum(chars for pt, chars in catalog_sizes if pt < 7)
                    / total_chars, 1) if total_chars else None,
                "percent_characters_below_8pt": round(
                    100 * sum(chars for pt, chars in catalog_sizes if pt < 8)
                    / total_chars, 1) if total_chars else None,
                "status": "diagnostic only; human print legibility not certified"
            }
            if not total_chars:
                report["errors"].append(
                    "Catalog PDF text sizes could not be measured")
            elif any(pt < 7 for pt, _ in catalog_sizes):
                report["errors"].append(
                    "Catalog A4 PDF has text smaller than 7pt; inspect print typography")
            report["print"] = {
                "catalog_typography": catalog_type,
                "pdf_pages": count, "expected_pages": 28,
                "a4_portrait_size_verified": not non_a4_pages,
                "non_a4_pages": non_a4_pages,
                "file": pdf_path.name,
                "catalog_external_links_expected": len(expected_urls),
                "catalog_external_links_in_pdf": len(expected_urls & printed_urls),
                "catalog_external_links_missing": missing_urls,
            }
            if count != 28:
                report["errors"].append(f"A4 PDF page count {count}, expected 28")
            if non_a4_pages:
                report["errors"].append(
                    f"PDF has {len(non_a4_pages)} pages with non-A4 portrait dimensions")
            if len(expected_urls) != 9:
                report["errors"].append(
                    f"A4 catalog expected 9 distinct external links, got {len(expected_urls)}")
            if missing_urls:
                report["errors"].append(
                    f"A4 PDF lost {len(missing_urls)} clickable catalog source links")
        page.close()
    # The regular screenshot suite requests reduced motion, so it never exercises
    # the animated cinematic sequence. Check both accessible static fallback
    # and the real IntersectionObserver-triggered animation separately.
    for preference in ("reduce", "no-preference"):
        motion_page = browser.new_page(
            viewport={"width": 1280, "height": 1400},
            reduced_motion=preference, locale="he-IL")
        motion_page.goto((ROOT / "index.html").as_uri(),
                         wait_until="domcontentloaded", timeout=45000)
        motion_page.locator("#cinematic").scroll_into_view_if_needed()
        if preference == "no-preference":
            try:
                motion_page.wait_for_function(
                    "document.querySelector('#cinematic').classList.contains('is-playing')",
                    timeout=5000)
            except Exception:
                report["errors"].append(
                    "Cinematic animation did not start when scrolled into view")
        else:
            motion_page.wait_for_timeout(250)
        motion = motion_page.evaluate("""() => {
          const section = document.querySelector('#cinematic');
          const scene = section.querySelector('.cine-scene.s1');
          const finale = section.querySelector('.cine-scene.s3');
          return {
            preference_reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
            playing: section.classList.contains('is-playing'),
            animation_name: getComputedStyle(scene).animationName,
            final_opacity: getComputedStyle(finale).opacity
          };
        }""")
        report.setdefault("cinematic_motion", []).append(
            {"requested_preference": preference, **motion})
        if preference == "reduce":
            if (not motion["preference_reduced"] or motion["playing"]
                    or motion["animation_name"] != "none"
                    or motion["final_opacity"] != "1"):
                report["errors"].append(
                    "Reduced-motion cinematic must show a static final frame")
        elif (motion["preference_reduced"] or not motion["playing"]
              or motion["animation_name"] == "none"):
            report["errors"].append(
                "Normal-motion cinematic must run its animation in view")
        motion_page.close()
    browser.close()

(OUT / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2),
                                  encoding="utf-8")
print(json.dumps({"widths": WIDTHS, "print": report["print"],
                  "errors": report["errors"]}, ensure_ascii=False, indent=2))
if report["errors"]:
    raise SystemExit(1)
