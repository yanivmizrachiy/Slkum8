# AGENTS.md — Slkum8

Start with [SOURCE_OF_TRUTH.md](SOURCE_OF_TRUTH.md). It is the **only source of truth** for user requirements, course identities, statuses and verified evidence. This file only supplies review/verification guardrails; do not copy mutable requirements into it.

## High-signal code-review rules for Codex / Claude Code

1. **Never invent course identifiers, dates or syllabus URLs.** Two distinct middle-school mathematics coordinator communities are now grounded in **different primary sources**: (a) Yaniv Raz + Idan Ahvan, **no Compass code**, first meeting **2026-10-25 at 19:00**, registration via the *dedicated Google Form* from the 2026-09-09 invitation; page `#community-yaniv-idan`; (b) Compass-listed community, code **201020**, first meeting **2026-10-13 at 19:00**, syllabus from district JSON; page `#course-201020`. Keep BOTH independent A4 pages and BOTH catalog rows. Never copy code 201020 onto the no-Compass community. For full provenance read top of SOURCE_OF_TRUTH.md and COURSE_VERIFICATION.md. All other course data require source verification.
2. **Maintain existing working sections:** `#cover`, `#opening`, `#community-yaniv-idan`, `#manifesto`, `#cinematic`, `#world-report`, `#event-203587`, `#catalog-summary`, `#shabat` and all course pages. The final page must say "שבת שלום" and "יניב רז" and must not mention the parasha.
3. **Real assets only, no duplicates or demo placeholders.** Use existing user-owned Lovable/Canva images. Record exact provenance in `assets/lovable-selected.json`; prefer robust published/local sources. Never confuse Vercel READY with successful image loading.
4. **A4 + mobile + RTL:** every page should print on one A4 portrait page and remain readable on 320/360/375/390/412/430px devices, with **no horizontal page scrolling**, text overlap or unclippable controls. Prefer semantic links and large enough touch targets; honor `prefers-reduced-motion`.
5. **Correct journal content:** all professional development recommendations are for middle-school math unless explicitly verified otherwise. Keep info pages legible dark-on-light; do not restore the excluded full salary-reforms article. The brief pay-rise mention is allowed and qualified.
6. **Check real interactions:** all in-page anchors, external syllabi, dates and event registration links need honest validation; if a source cannot be opened externally, mark it **unverified**. Do not automatically publish, send messages or delete external files.

For each PR, run `node scripts/verify-journal.mjs` and inspect a representative mobile screenshot and A4 print view. Report only evidenced pass/fail; a script cannot prove visual quality.
