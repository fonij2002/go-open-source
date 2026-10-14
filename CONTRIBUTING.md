# Contributing

Thanks for helping people discover open-source software.

## Data model

The catalog deliberately separates **mappings** from **project metadata**:

- `data/alternatives.yml` — “Proprietary product → open-source project” mappings.
- `data/projects.yml` — one canonical record per open-source project: upstream URL, install/use URL, model, platforms, and limitation tags.
- `data/categories.yml` — stable focused category IDs.
- `data/locales/*.yml` — all translatable UI/category/platform/limitation/note text.

This means Kdenlive's install/platform metadata is edited once even though Kdenlive appears in several mappings.

## Adding an alternative

1. If the open-source project is new, add it to `data/projects.yml` with:
   - a stable `id`;
   - official `url`;
   - official `setup_url` pointing to installation, download, quick-start, or usage docs;
   - `model` (`open-source` or `open-core`);
   - one or more `platforms`;
   - one or more concise `limitations` / things-to-know tags.
2. Add the mapping to `data/alternatives.yml`.
3. Add the mapping note to **every** file in `data/locales/` using the mapping's `note_key`.
4. If you add a new platform, limitation tag, or category, translate that key in every locale.
5. Run the checks below.

## Adding a language

See [docs/i18n.md](docs/i18n.md). In normal cases you add one locale YML file and its language code; no HTML or JavaScript changes are required.

## Verify locally

```bash
python scripts/validate.py
python scripts/generate_catalog.py
python scripts/build_site.py
node --check website/assets/app.js
```

The validator intentionally fails when a project has no setup link, no platform information, no limitation tag, an unknown category, or incomplete translations.

## Pull-request checklist

- [ ] I checked the official upstream source and current license.
- [ ] `setup_url` points to useful official installation/download/usage documentation.
- [ ] Platform tags describe realistic supported ways to run/access the project.
- [ ] Limitation tags are short, neutral, and useful to someone evaluating a switch.
- [ ] Open-core/mixed licensing is clearly labeled.
- [ ] All enabled locales contain the required translations.
- [ ] `python scripts/validate.py` passes.
- [ ] `python scripts/generate.py` leaves no unexpected diff.
- [ ] `python scripts/build_site.py` succeeds.

## Style

Prefer factual language. Avoid “best”, “perfect”, “drop-in replacement”, and marketing claims. Limitations should help users make a decision, not discourage them from trying a project.
