# Kudos to Open Source 👏

[English](README.md) · [فارسی](README.fa.md)

> “What do we build for, if not to lessen each other’s hardship?”

A community-maintained catalog of open-source alternatives to proprietary software, with practical information about **where each project runs, how to install/use it, and important limitations before you switch**.

## Website

The repository includes a dependency-free static website for GitHub Pages with:

- instant search across proprietary products and open-source alternatives;
- **English / Persian language switching** with LTR/RTL support;
- focused A–Z categories such as **Video Editing, Video Players, Image Editing, IDE & Code Editors, LLM Runtimes, API Clients, CAD, GIS, Password Managers** and more;
- filtering by **platform**, category, licensing model, and fit;
- per-project **Install / use** links;
- **Windows, macOS, Linux, Android, iOS, Web, Docker, CLI, VS Code, JetBrains** and other runtime tags;
- concise **Things to know / limitations** tags;
- shareable search/filter URLs, responsive design, and light/dark themes.

Build it locally:

```bash
python scripts/validate.py
python scripts/build_site.py
python -m http.server 8000 --directory dist
```

Then open `http://localhost:8000`.

See [Static website](docs/website.md) and [Internationalization](docs/i18n.md).

## Quick picks

| If you use…                   | Start with…                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Figma                         | [Penpot](https://github.com/penpot/penpot)                                                                                                            |
| CapCut / Premiere Pro         | [Kdenlive](https://kdenlive.org/), [Shotcut](https://shotcut.org/)                                                                                    |
| Photoshop                     | [GIMP](https://www.gimp.org/), [Krita](https://krita.org/)                                                                                            |
| Illustrator                   | [Inkscape](https://inkscape.org/)                                                                                                                     |
| Lightroom                     | [darktable](https://www.darktable.org/), [RawTherapee](https://rawtherapee.com/)                                                                      |
| PowerDVD / paid video players | [VLC](https://www.videolan.org/vlc/), [mpv](https://mpv.io/)                                                                                          |
| Maya / 3ds Max                | [Blender](https://www.blender.org/)                                                                                                                   |
| AutoCAD / SolidWorks          | [FreeCAD](https://www.freecad.org/)                                                                                                                   |
| Microsoft Office              | [LibreOffice](https://www.libreoffice.org/)                                                                                                           |
| Notion                        | [AppFlowy](https://github.com/AppFlowy-IO/AppFlowy)                                                                                                   |
| Slack                         | [Mattermost](https://github.com/mattermost/mattermost), [Zulip](https://github.com/zulip/zulip)                                                       |
| Zoom / Google Meet            | [Jitsi Meet](https://github.com/jitsi/jitsi-meet)                                                                                                     |
| Dropbox / Google Drive        | [Nextcloud](https://github.com/nextcloud/server)                                                                                                      |
| Google Photos                 | [Immich](https://github.com/immich-app/immich)                                                                                                        |
| 1Password / LastPass          | [KeePassXC](https://github.com/keepassxreboot/keepassxc), [Vaultwarden](https://github.com/dani-garcia/vaultwarden)                                   |
| TeamViewer / AnyDesk          | [RustDesk](https://github.com/rustdesk/rustdesk)                                                                                                      |
| Postman                       | [Bruno](https://github.com/usebruno/bruno), [Hoppscotch](https://github.com/hoppscotch/hoppscotch)                                                    |
| GitHub                        | [Forgejo](https://codeberg.org/forgejo/forgejo), [Gitea](https://github.com/go-gitea/gitea)                                                           |
| Docker Desktop                | [Podman](https://github.com/containers/podman), [Rancher Desktop](https://github.com/rancher-sandbox/rancher-desktop)                                 |
| Terraform                     | [OpenTofu](https://github.com/opentofu/opentofu)                                                                                                      |
| LM Studio                     | [Ollama](https://github.com/ollama/ollama)                                                                                                            |
| GitHub Copilot                | [Continue](https://github.com/continuedev/continue)                                                                                                   |
| Google Analytics              | [Matomo](https://github.com/matomo-org/matomo), [Plausible](https://github.com/plausible/analytics), [Umami](https://github.com/umami-software/umami) |
| Heroku                        | [Dokku](https://github.com/dokku/dokku), [CapRover](https://github.com/caprover/caprover)                                                             |
| MATLAB                        | [GNU Octave](https://octave.org/)                                                                                                                     |
| ArcGIS                        | [QGIS](https://github.com/qgis/QGIS)                                                                                                                  |

## Browse by category

The focused category index is generated from the catalog and kept alphabetically sorted:

- [Browse all categories A–Z](categories/README.md)
- [مرور دسته‌بندی‌ها](categories/README.fa.md)

## Data architecture

Project metadata is normalized so installation/platform information is defined once even when one open-source project replaces several proprietary products.

```text
data/
├── alternatives.yml       # mappings: proprietary product -> project
├── projects.yml           # project URL, setup URL, license, platforms, limitations
├── categories.json        # stable category IDs
├── locales.json           # enabled languages
└── locales/
    ├── en.json            # UI, categories, tags, mapping notes
    └── fa.json
          │
          ├── scripts/validate.py
          ├── scripts/generate.py ──→ categories/*/README*.md
          └── scripts/build_site.py ─→ dist/ → GitHub Pages
```

Adding another language does **not** require frontend changes. Add the locale file and register its language code; see [docs/i18n.md](docs/i18n.md).

## Contributing

Contributions are welcome: new alternatives, better setup links, platform corrections, license/model corrections, translation improvements, and clearer limitation tags are all valuable.

Read [CONTRIBUTING.md](CONTRIBUTING.md). CI validates that every project has a setup link, at least one platform, at least one constraint/limitation tag, and complete locale coverage.

## Important caveat

No catalog can literally contain every open-source alternative forever. Projects launch, archive, fork, change platforms, and relicense. The goal is a **high-quality, continuously maintained catalog**, not an unverifiable claim of completeness.

## License

The repository's original content and helper scripts are released under the [MIT License](LICENSE). Each linked project retains its own license, trademarks, and copyrights.
