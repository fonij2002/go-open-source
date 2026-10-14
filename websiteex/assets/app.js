(() => {
  "use strict";

  const BUILD_ID =
    document.querySelector('meta[name="kudos-build"]')?.content || "dev";

  const els = {
    search: document.querySelector("#search"),
    category: document.querySelector("#category-filter"),
    platform: document.querySelector("#platform-filter"),
    language: document.querySelector("#language-select"),
    results: document.querySelector("#results"),
    resultCount: document.querySelector("#result-count"),
    clear: document.querySelector("#clear-filters"),
    empty: document.querySelector("#empty-state"),
    emptyClear: document.querySelector("#empty-clear"),
    query: document.querySelector("#active-query"),
    template: document.querySelector("#result-template"),
    theme: document.querySelector("#theme-toggle"),
    heroApplause: document.querySelector("#hero-applause"),
  };

  let catalog = [];
  let categoryKeys = [];
  let platformKeys = [];
  let localeMetas = [];
  let currentLocale = null;
  let englishLocale = null;
  let currentLang = "en";
  let renderTimer = 0;
  const localeCache = new Map();

  const applauseLayout = [
    { x: 4, y: 8, size: 82, rotate: -18 },
    { x: 13, y: 4, size: 66, rotate: 18 },
    { x: 25, y: 12, size: 56, rotate: -14 },
    { x: 42, y: 8, size: 72, rotate: 15 },
    { x: 57, y: 5, size: 48, rotate: -10 },
    { x: 72, y: 10, size: 58, rotate: 15 },
    { x: 85, y: 5, size: 80, rotate: 16 },
    { x: 96, y: 9, size: 68, rotate: -13 },
    { x: 3, y: 34, size: 88, rotate: -16 },
    { x: 14, y: 28, size: 44, rotate: 18 },
    { x: 29, y: 19, size: 58, rotate: -12 },
    { x: 52, y: 20, size: 42, rotate: 11 },
    { x: 70, y: 22, size: 50, rotate: -14 },
    { x: 87, y: 19, size: 44, rotate: 14 },
    { x: 98, y: 35, size: 60, rotate: -16 },
    { x: 7, y: 64, size: 68, rotate: 14 },
    { x: 20, y: 57, size: 40, rotate: -16 },
    { x: 63, y: 62, size: 66, rotate: 13 },
    { x: 78, y: 53, size: 42, rotate: -12 },
    { x: 92, y: 68, size: 62, rotate: 16 },
    { x: 4, y: 93, size: 62, rotate: -13 },
    { x: 14, y: 87, size: 78, rotate: 17 },
    { x: 27, y: 94, size: 45, rotate: -12 },
    { x: 39, y: 97, size: 54, rotate: 13 },
    { x: 53, y: 90, size: 72, rotate: -17 },
    { x: 67, y: 95, size: 50, rotate: 15 },
    { x: 82, y: 91, size: 64, rotate: -14 },
    { x: 96, y: 85, size: 54, rotate: 13 },
  ];

  function seededRange(seed, min, max) {
    const raw = Math.sin(seed * 971.37) * 10000;
    const unit = raw - Math.floor(raw);
    return min + unit * (max - min);
  }

  function buildHeroApplause() {
    if (!els.heroApplause) return;
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const nodes = applauseLayout.map((item, index) => {
      const clap = document.createElement("span");
      clap.className = "clap";
      clap.style.setProperty("--x", item.x);
      clap.style.setProperty("--y", item.y);
      clap.style.setProperty("--size", item.size);
      clap.style.setProperty("--rotate", item.rotate);
      clap.style.setProperty(
        "--delay",
        ((index % 7) * 0.46 + seededRange(index + 1, 0.1, 0.75)).toFixed(2),
      );
      clap.style.setProperty(
        "--duration",
        (reduceMotion ? 0 : seededRange(index + 5, 5.8, 9.2)).toFixed(2),
      );
      clap.style.setProperty(
        "--pulse-duration",
        (reduceMotion ? 0 : seededRange(index + 11, 2.5, 4.5)).toFixed(2),
      );
      clap.style.setProperty(
        "--dx",
        seededRange(index + 17, -11, 11).toFixed(2),
      );
      clap.style.setProperty(
        "--dy",
        seededRange(index + 23, -14, 14).toFixed(2),
      );
      clap.style.setProperty(
        "--turn",
        seededRange(index + 29, -6, 6).toFixed(2),
      );
      clap.style.setProperty(
        "--opacity",
        seededRange(index + 31, 0.82, 1).toFixed(2),
      );

      const emoji = document.createElement("span");
      emoji.className = "clap-emoji";
      emoji.textContent = "👏";
      clap.append(emoji);
      return clap;
    });
    els.heroApplause.replaceChildren(...nodes);
  }

  const normalize = (value) =>
    String(value || "")
      .toLocaleLowerCase(currentLang)
      .trim();
  const t = (key) =>
    currentLocale?.ui?.[key] ?? englishLocale?.ui?.[key] ?? key;
  const categoryLabel = (key) =>
    currentLocale?.categories?.[key] ?? englishLocale?.categories?.[key] ?? key;
  const platformLabel = (key) =>
    currentLocale?.platforms?.[key] ?? englishLocale?.platforms?.[key] ?? key;
  const limitationLabel = (key) =>
    currentLocale?.limitations?.[key] ??
    englishLocale?.limitations?.[key] ??
    key;
  const noteLabel = (key) =>
    currentLocale?.notes?.[key] ?? englishLocale?.notes?.[key] ?? "";
  const collator = () =>
    new Intl.Collator(currentLang, { sensitivity: "base", numeric: true });

  async function loadLocale(code) {
    if (localeCache.has(code)) return localeCache.get(code);
    const response = await fetch(
      `locales/${code}.json?v=${encodeURIComponent(BUILD_ID)}`,
      { cache: "no-store" },
    );
    if (!response.ok)
      throw new Error(`Could not load locale ${code}: HTTP ${response.status}`);
    const locale = await response.json();
    localeCache.set(code, locale);
    return locale;
  }

  function setSelectOptions(select, options, selected) {
    select.replaceChildren(
      ...options.map(({ value, label }) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        return option;
      }),
    );
    if ([...select.options].some((option) => option.value === selected))
      select.value = selected;
  }

  function staticTranslations() {
    document.documentElement.lang = currentLocale.meta.code;
    document.documentElement.dir = currentLocale.meta.direction;
    document.body.dataset.locale = currentLocale.meta.code;

    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      node.placeholder = t(node.dataset.i18nPlaceholder);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
      node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
    });
    document.querySelectorAll("[data-i18n-title]").forEach((node) => {
      node.setAttribute("title", t(node.dataset.i18nTitle));
    });
    document.querySelector('meta[name="description"]').content = t("hero_copy");
    document.querySelector('meta[property="og:description"]').content =
      t("hero_copy");
    updateThemeLabel();
  }

  function populateControls(preserve = {}) {
    const c = collator();
    setSelectOptions(
      els.category,
      [
        { value: "", label: t("all_categories") },
        ...categoryKeys
          .map((key) => ({ value: key, label: categoryLabel(key) }))
          .sort((a, b) => c.compare(a.label, b.label)),
      ],
      preserve.category || "",
    );

    setSelectOptions(
      els.platform,
      [
        { value: "", label: t("all_platforms") },
        ...platformKeys
          .map((key) => ({ value: key, label: platformLabel(key) }))
          .sort((a, b) => c.compare(a.label, b.label)),
      ],
      preserve.platform || "",
    );

    setSelectOptions(
      els.language,
      localeMetas.map((meta) => ({
        value: meta.code,
        label: meta.native_name,
      })),
      currentLang,
    );
  }

  function getState() {
    return {
      q: els.search.value.trim(),
      category: els.category.value,
      platform: els.platform.value,
    };
  }

  function score(record, query) {
    if (!query) return 1;
    const q = normalize(query);
    const proprietary = normalize(record.proprietary);
    const project = normalize(record.name);
    const notes = normalize(noteLabel(record.note_key));
    const category = normalize(categoryLabel(record.category));
    const platforms = normalize(record.platforms.map(platformLabel).join(" "));
    const limitations = normalize(
      record.limitations.map(limitationLabel).join(" "),
    );

    let points = 0;
    if (proprietary === q || project === q) points += 100;
    if (proprietary.startsWith(q) || project.startsWith(q)) points += 50;
    if (proprietary.includes(q)) points += 30;
    if (project.includes(q)) points += 28;
    if (category.includes(q)) points += 16;
    if (notes.includes(q)) points += 10;
    if (platforms.includes(q)) points += 8;
    if (limitations.includes(q)) points += 6;

    const tokens = q.split(/\s+/).filter(Boolean);
    const haystack = `${proprietary} ${project} ${category} ${notes} ${platforms} ${limitations}`;
    if (tokens.length > 1 && tokens.every((token) => haystack.includes(token)))
      points += 20;
    return points;
  }

  function syncUrl(state) {
    const params = new URLSearchParams();
    if (currentLang !== "en") params.set("lang", currentLang);
    if (state.q) params.set("q", state.q);
    if (state.category) params.set("category", state.category);
    if (state.platform) params.set("platform", state.platform);
    const next = `${location.pathname}${params.size ? `?${params}` : ""}${location.hash}`;
    history.replaceState(null, "", next);
  }

  function urlState() {
    const params = new URLSearchParams(location.search);
    return {
      q: params.get("q") || "",
      category: params.get("category") || "",
      platform: params.get("platform") || "",
    };
  }

  function addTags(container, keys, labeler, className) {
    keys.forEach((key) => {
      const tag = document.createElement("span");
      tag.className = `tag ${className || ""}`.trim();
      tag.textContent = labeler(key);
      container.append(tag);
    });
  }

  function renderCard(record) {
    const card = els.template.content.firstElementChild.cloneNode(true);
    card.querySelector(".category-pill").textContent = categoryLabel(
      record.category,
    );
    card.querySelector(".mapping-instead").textContent = t("instead_of");
    card.querySelector(".mapping-try").textContent = t("try");
    card.querySelector(".proprietary").textContent = record.proprietary;
    card.querySelector(".arrow").textContent =
      currentLocale.meta.direction === "rtl" ? "←" : "→";

    const project = card.querySelector(".project");
    project.textContent = record.name;
    project.href = record.url;

    card.querySelector(".notes").textContent = noteLabel(record.note_key);
    card.querySelector(".runs-on-label").textContent = t("runs_on");
    card.querySelector(".limitations-label").textContent = t("limitations");
    addTags(
      card.querySelector(".platforms"),
      record.platforms,
      platformLabel,
      "platform-tag",
    );
    addTags(
      card.querySelector(".limitation-tags"),
      record.limitations,
      limitationLabel,
      "limitation-tag",
    );

    const setup = card.querySelector(".setup-link");
    setup.href = record.setup_url;
    setup.textContent = `${t("install_use")} ↗`;
    const visit = card.querySelector(".visit");
    visit.href = record.url;
    visit.textContent = `${t("visit_project")} ↗`;
    return card;
  }

  function render() {
    const state = getState();
    const query = state.q.trim();
    const c = collator();

    let rows = catalog
      .map((record) => ({ record, relevance: score(record, query) }))
      .filter(({ record, relevance }) => {
        if (query && relevance === 0) return false;
        if (state.category && record.category !== state.category) return false;
        if (state.platform && !record.platforms.includes(state.platform))
          return false;
        return true;
      });

    rows.sort(
      (a, b) =>
        b.relevance - a.relevance ||
        c.compare(a.record.proprietary, b.record.proprietary),
    );

    els.results.replaceChildren(
      ...rows.map(({ record }) => renderCard(record)),
    );

    const filtered = Boolean(query || state.category || state.platform);
    els.clear.hidden = !filtered;
    els.empty.hidden = rows.length !== 0;
    els.results.hidden = rows.length === 0;

    if (query) {
      els.query.hidden = false;
      els.query.replaceChildren(
        document.createTextNode(`${t("showing_matches")} `),
      );
      const strong = document.createElement("strong");
      strong.textContent = `“${query}”`;
      els.query.append(strong);
    } else {
      els.query.hidden = true;
      els.query.textContent = "";
    }
    syncUrl(state);
  }

  function scheduleRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(render, 80);
  }

  function clearFilters() {
    els.search.value = "";
    els.category.value = "";
    els.platform.value = "";
    render();
    els.search.focus();
  }

  function initTheme() {
    const saved = localStorage.getItem("kudos-theme");
    const preferredDark = matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme =
      saved || (preferredDark ? "dark" : "light");
  }

  function updateThemeLabel() {
    if (!currentLocale) return;
    const useLight = document.documentElement.dataset.theme === "dark";
    const label = t(useLight ? "use_light" : "use_dark");
    els.theme.setAttribute("aria-label", label);
    els.theme.setAttribute("title", label);
  }

  function toggleTheme() {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("kudos-theme", next);
    updateThemeLabel();
  }

  async function changeLanguage(code, preserveState = true) {
    const state = preserveState ? getState() : urlState();
    const query = els.search.value;
    currentLang = code;
    currentLocale = await loadLocale(code);
    localStorage.setItem("kudos-language", code);
    staticTranslations();
    populateControls(state);
    els.search.value = preserveState ? query : state.q;
    render();
  }

  async function init() {
    initTheme();
    try {
      const response = await fetch(
        `catalog.v2.json?v=${encodeURIComponent(BUILD_ID)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.schema_version !== 2) {
        throw new Error(
          `Unsupported catalog schema: ${payload.schema_version ?? "missing"}`,
        );
      }
      if (
        !Array.isArray(payload.records) ||
        !Array.isArray(payload.categories) ||
        !Array.isArray(payload.platforms) ||
        !Array.isArray(payload.locales)
      ) {
        throw new Error("Catalog payload is malformed");
      }
      if (
        payload.records.some(
          (record) => !record.name || !record.category || !record.url,
        )
      ) {
        throw new Error("Catalog contains an invalid project record");
      }
      catalog = payload.records;
      categoryKeys = payload.categories;
      platformKeys = payload.platforms;
      localeMetas = payload.locales;
      englishLocale = await loadLocale("en");

      const params = new URLSearchParams(location.search);
      const requested = params.get("lang");
      const saved = localStorage.getItem("kudos-language");
      const browser = navigator.language?.toLowerCase().startsWith("fa")
        ? "fa"
        : "en";
      const supported = new Set(localeMetas.map((meta) => meta.code));
      currentLang =
        [requested, saved, browser, "en"].find(
          (code) => code && supported.has(code),
        ) || "en";
      currentLocale = await loadLocale(currentLang);
    } catch (error) {
      console.error("Could not load catalog", error);
      els.empty.hidden = false;
      els.emptyClear.hidden = true;
      return;
    }

    buildHeroApplause();

    const initial = urlState();
    staticTranslations();
    populateControls(initial);
    els.search.value = initial.q;
    render();

    [els.search, els.category, els.platform].forEach((el) => {
      el.addEventListener(
        el === els.search ? "input" : "change",
        scheduleRender,
      );
    });
    els.language.addEventListener("change", () =>
      changeLanguage(els.language.value),
    );
    els.clear.addEventListener("click", clearFilters);
    els.emptyClear.addEventListener("click", clearFilters);
    els.theme.addEventListener("click", toggleTheme);

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement.tagName,
        )
      ) {
        event.preventDefault();
        els.search.focus();
      }
      if (
        event.key === "Escape" &&
        document.activeElement === els.search &&
        els.search.value
      ) {
        els.search.value = "";
        render();
      }
    });
  }

  init();
})();
