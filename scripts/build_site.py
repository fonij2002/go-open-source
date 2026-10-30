from __future__ import annotations

import hashlib
import html
import json
import os
import shutil
from pathlib import Path

from catalog import (
    ROOT,
    load_categories,
    load_locale_codes,
    load_locales,
    load_mappings,
    load_projects,
)

SOURCE = ROOT / "website"
DEST = ROOT / "dist"
DEFAULT_REPO_URL = "https://github.com/fonij2002/go-open-source"
SCHEMA_VERSION = 2


def repo_url() -> str:
    repository = os.getenv("GITHUB_REPOSITORY", "").strip()
    if repository and "/" in repository:
        return f"https://github.com/{repository}"
    return os.getenv("REPO_URL", DEFAULT_REPO_URL).rstrip("/")


def canonical_json(value: object) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")


def short_hash(*parts: bytes) -> str:
    digest = hashlib.sha256()
    for part in parts:
        digest.update(part)
        digest.update(b"\0")
    return digest.hexdigest()[:12]


def build_records(mappings: list[dict], projects: dict[str, dict]) -> list[dict]:
    records = []
    for mapping in mappings:
        project = projects[mapping["project_id"]]
        records.append(
            {
                "mapping_id": mapping["id"],
                "category": mapping["category"],
                "proprietary": mapping["proprietary"],
                "project_id": mapping["project_id"],
                "note_key": mapping["note_key"],
                **{key: value for key, value in project.items() if key != "id"},
            }
        )
    return records


def build_legacy_payload(
    records: list[dict], english: dict, categories: list[str]
) -> dict:
    """Keep v1 clients functional while browsers age out cached pre-i18n JavaScript.

    The first website release fetched catalog.json and expected project/category_title/notes.
    New clients use catalog.v2.json. Keeping this compatibility payload prevents a cached
    v1 app.js from rendering blank cards against the v2 schema after a Pages deployment.
    """
    category_labels = english.get("categories", {})
    note_labels = english.get("notes", {})
    legacy_records = []
    for record in records:
        legacy_records.append(
            {
                "category": record["category"],
                "category_title": category_labels.get(
                    record["category"], record["category"]
                ),
                "proprietary": record["proprietary"],
                "project": record["name"],
                "url": record["url"],
                "notes": note_labels.get(record["note_key"], ""),
            }
        )
    return {
        "records": legacy_records,
        "categories": {key: category_labels.get(key, key) for key in categories},
    }


def fingerprint_asset(path: Path, stem: str) -> str:
    content = path.read_bytes()
    digest = hashlib.sha256(content).hexdigest()[:12]
    name = f"{stem}.{digest}{path.suffix}"
    target = path.with_name(name)
    path.rename(target)
    return f"assets/{name}"


def main() -> None:
    mappings = load_mappings()
    projects = {project["id"]: project for project in load_projects()}
    categories = load_categories()
    locales = load_locales()
    records = build_records(mappings, projects)

    if DEST.exists():
        shutil.rmtree(DEST)
    shutil.copytree(SOURCE, DEST)

    # Locales are source data, copied verbatim so a new translation needs no frontend changes.
    locale_dest = DEST / "locales"
    locale_dest.mkdir(exist_ok=True)

    locale_bytes: list[bytes] = []

    for code in load_locale_codes():
        locale = locales[code]

        data = canonical_json(locale)

        locale_bytes.append(data)

        (locale_dest / f"{code}.json").write_bytes(data)

    payload = {
        "schema_version": SCHEMA_VERSION,
        "records": records,
        "categories": categories,
        "platforms": sorted(
            {p for project in projects.values() for p in project["platforms"]}
        ),
        "locales": [locales[code]["meta"] for code in load_locale_codes()],
        "stats": {
            "mappings": len(mappings),
            "projects": len(projects),
            "categories": len(categories),
        },
    }
    payload_bytes = canonical_json(payload)
    (DEST / "catalog.v2.json").write_bytes(payload_bytes)

    # Backward compatibility for the original cached app.js schema.
    english = locales["en"]
    legacy_payload = build_legacy_payload(records, english, categories)
    (DEST / "catalog.json").write_bytes(canonical_json(legacy_payload))

    # Fingerprinted assets prevent GitHub Pages/CDN/browser caches from mixing releases.
    app_source = (DEST / "assets" / "app.js").read_bytes()
    css_source = (DEST / "assets" / "styles.css").read_bytes()
    build_id = short_hash(payload_bytes, app_source, css_source, *locale_bytes)
    app_asset = fingerprint_asset(DEST / "assets" / "app.js", "app")
    styles_asset = fingerprint_asset(DEST / "assets" / "styles.css", "styles")

    index = (DEST / "index.html").read_text(encoding="utf-8")
    replacements = {
        "{{COUNT}}": str(payload["stats"]["mappings"]),
        "{{PROJECT_COUNT}}": str(payload["stats"]["projects"]),
        "{{CATEGORY_COUNT}}": str(payload["stats"]["categories"]),
        "{{REPO_URL}}": html.escape(repo_url(), quote=True),
        "{{BUILD_ID}}": build_id,
        "{{APP_ASSET}}": app_asset,
        "{{STYLES_ASSET}}": styles_asset,
    }
    for token, value in replacements.items():
        index = index.replace(token, value)
    if "{{" in index or "}}" in index:
        raise RuntimeError("Unresolved template token remains in dist/index.html")
    (DEST / "index.html").write_text(index, encoding="utf-8")
    (DEST / ".nojekyll").write_text("", encoding="utf-8")

    # Defensive build assertions: v2 and legacy v1 must both be internally usable.
    assert payload["schema_version"] == 2
    assert all(
        record.get("name") and record.get("category") for record in payload["records"]
    )
    assert all(
        record.get("project") and record.get("category_title")
        for record in legacy_payload["records"]
    )
    assert (DEST / app_asset).is_file()
    assert (DEST / styles_asset).is_file()

    print(
        f"Built static site: {len(mappings)} mappings, {len(projects)} projects, "
        f"{len(categories)} categories, {len(locales)} locales, build {build_id} -> {DEST}"
    )


if __name__ == "__main__":
    main()
