# assets/selected — curated hero images (drop-in)

Interface for the cinematic interlude (`#cinematic`) and future hero spots.

**How it works**
- Add images with the exact filenames listed in [`manifest.json`](./manifest.json)
  (`cinematic-01.jpg`, `cinematic-02.jpg`, `cinematic-03.jpg`).
- `index.html` references them directly. When a file is **missing**, that scene
  degrades to the journal gradient + `assets/cover-art.svg` (via `onerror`), so the
  layout never breaks and nothing looks empty.
- No code change is needed when the images arrive — just drop the files in.

**Rules (per `SOURCE_OF_TRUTH.md`)**
- Only rights-cleared assets; one quality master per image; no duplicates; no private data.
- Record `credit` / `source` for each image in `manifest.json`.
- Image import/curation is handled separately (GPT / Canva / Lovable). This folder is
  only the interface — do not bulk-copy the full archive here.
