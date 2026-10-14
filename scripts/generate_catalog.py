from __future__ import annotations

import shutil

from catalog import (
    ROOT,
    load_categories,
    load_locale_codes,
    load_locales,
    load_mappings,
    load_projects,
)

mappings = load_mappings()
projects = {project["id"]: project for project in load_projects()}
categories = load_categories()
locales = load_locales()

CATEGORY_ROOT = ROOT / "categories"
if CATEGORY_ROOT.exists():
    shutil.rmtree(CATEGORY_ROOT)
CATEGORY_ROOT.mkdir(parents=True)


def render_category(category: str, code: str) -> str:
    locale = locales[code]
    ui = locale["ui"]
    title = locale["categories"][category]
    rows = sorted(
        (m for m in mappings if m["category"] == category),
        key=lambda m: (
            m["proprietary"].casefold(),
            projects[m["project_id"]]["name"].casefold(),
        ),
    )
    out = [
        f"# {title}",
        "",
        f"| {ui['proprietary_product']} | {ui['open_source_alternative']} | {ui['runs_on']} | {ui['install_use']} | {ui['limitations']} | {ui['notes']} |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for mapping in rows:
        project = projects[mapping["project_id"]]
        platforms = ", ".join(locale["platforms"][key] for key in project["platforms"])
        limitations = "; ".join(
            locale["limitations"][key] for key in project["limitations"]
        )
        note = locale["notes"][mapping["note_key"]]
        project_link = f"[{project['name']}]({project['url']})"
        setup_link = f"[{ui['install_use']}]({project['setup_url']})"
        out.append(
            f"| {mapping['proprietary']} | {project_link} | {platforms} | {setup_link} | {limitations} | {note} |"
        )
    back = "../../README.fa.md" if code == "fa" else "../../README.md"
    out += ["", f"[← {ui['back_to_catalog']}]({back})", ""]
    return "\n".join(out)


for category in categories:
    target = CATEGORY_ROOT / category
    target.mkdir(parents=True, exist_ok=True)
    for code in load_locale_codes():
        filename = "README.md" if code == "en" else f"README.{code}.md"
        (target / filename).write_text(
            render_category(category, code), encoding="utf-8"
        )


def render_index(code: str) -> str:
    locale = locales[code]
    title = locale["ui"]["category_index_title"]
    items = []
    for category in sorted(
        categories, key=lambda c: locale["categories"][c].casefold()
    ):
        readme = "README.md" if code == "en" else f"README.{code}.md"
        items.append(f"- [{locale['categories'][category]}]({category}/{readme})")
    back = "../README.fa.md" if code == "fa" else "../README.md"
    return "\n".join(
        [
            f"# {title}",
            "",
            *items,
            "",
            f"[← {locale['ui']['back_to_catalog']}]({back})",
            "",
        ]
    )


(CATEGORY_ROOT / "README.md").write_text(render_index("en"), encoding="utf-8")
if "fa" in locales:
    (CATEGORY_ROOT / "README.fa.md").write_text(render_index("fa"), encoding="utf-8")

print(f"Generated {len(categories)} category directories in {len(locales)} languages.")
