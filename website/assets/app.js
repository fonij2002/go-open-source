(() => {
  "use strict";

  const BUILD_ID =
    document.querySelector('meta[name="go-open-source-build"]')?.content ||
    "dev";

  const els = {
    search: document.querySelector("#search"),
    category: document.querySelector("#category-filter"),
    platform: document.querySelector("#platform-filter"),
    language: document.querySelector("#language-select"),
    results: document.querySelector("#results"),
    resultSummary: document.querySelector("#result-summary"),
    clear: document.querySelector("#clear-filters"),
    empty: document.querySelector("#empty-state"),
    emptyClear: document.querySelector("#empty-clear"),
    query: document.querySelector("#active-query"),
    template: document.querySelector("#result-template"),
    theme: document.querySelector("#theme-toggle"),
    comparison: document.querySelector("#comparison-section"),
    comparisonTitle: document.querySelector("#comparison-title"),
    comparisonIntro: document.querySelector("#comparison-intro"),
    comparisonCount: document.querySelector("#comparison-count"),
    comparisonBody: document.querySelector("#comparison-body"),
    comparisonCards: document.querySelector("#comparison-cards"),
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

  const normalize = (value) =>
    String(value || "")
      .toLocaleLowerCase(currentLang)
      .trim();
  const t = (key) =>
    currentLocale?.ui?.[key] ?? englishLocale?.ui?.[key] ?? key;
  const tf = (key, values = {}) =>
    Object.entries(values).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      t(key),
    );
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

  function assertRequiredElements() {
    for (const [name, element] of Object.entries(els)) {
      if (!element) throw new Error(`Missing required DOM element: ${name}`);
    }
  }

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
    select.value = [...select.options].some(
      (option) => option.value === selected,
    )
      ? selected
      : "";
  }

  function staticTranslations() {
    document.documentElement.lang = currentLocale.meta.code;
    document.documentElement.dir = currentLocale.meta.direction;
    document.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
      node.placeholder = t(node.dataset.i18nPlaceholder);
    });
    document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
      node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
    });

    const translatedTitle = t("site_title");
    const siteTitle =
      translatedTitle === "site_title" ? "Go Open Source" : translatedTitle;
    document.title = siteTitle;
    const description = t("hero_copy");
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", description);
    document
      .querySelector('meta[property="og:title"]')
      ?.setAttribute("content", siteTitle);
    document
      .querySelector('meta[property="og:description"]')
      ?.setAttribute("content", description);
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
    const platforms = normalize(
      (record.platforms || []).map(platformLabel).join(" "),
    );
    const limitations = normalize(
      (record.limitations || []).map(limitationLabel).join(" "),
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

  // Resolve a query to one proprietary product only when the intent is unambiguous.
  // "Photoshop" -> Adobe Photoshop; "Adobe" -> no comparison because several products match.
  function resolveProprietaryProduct(query) {
    const q = normalize(query);
    if (q.length < 3) return null;

    const names = [...new Set(catalog.map((record) => record.proprietary))];
    const exact = names.find((name) => normalize(name) === q);
    if (exact) return exact;

    const contains = names.filter((name) => normalize(name).includes(q));
    if (contains.length === 1) return contains[0];

    const queryContains = names.filter((name) => q.includes(normalize(name)));
    if (queryContains.length === 1) return queryContains[0];

    return null;
  }

  function rowsForState(state) {
    const query = state.q.trim();
    return catalog
      .map((record) => ({ record, relevance: score(record, query) }))
      .filter(({ record, relevance }) => {
        if (query && relevance === 0) return false;
        if (state.category && record.category !== state.category) return false;
        if (
          state.platform &&
          !(record.platforms || []).includes(state.platform)
        )
          return false;
        return true;
      });
  }

  function comparisonForState(state) {
    if (!state.q.trim()) return null;
    const proprietary = resolveProprietaryProduct(state.q);
    if (!proprietary) return null;

    const records = catalog.filter((record) => {
      if (record.proprietary !== proprietary) return false;
      if (state.category && record.category !== state.category) return false;
      if (state.platform && !(record.platforms || []).includes(state.platform))
        return false;
      return true;
    });

    const unique = [
      ...new Map(
        records.map((record) => [record.project_id || record.name, record]),
      ).values(),
    ];
    return unique.length >= 2 ? { proprietary, records: unique } : null;
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

  function addBadges(container, keys, labeler, extraClass = "") {
    container.replaceChildren();
    (keys || []).forEach((key) => {
      const badge = document.createElement("span");
      badge.className =
        `badge rounded-pill border text-body-secondary fw-semibold ${extraClass}`.trim();
      badge.textContent = labeler(key);
      container.append(badge);
    });
  }

  function badgeNodes(keys, labeler, className = "") {
    return (keys || []).map((key) => {
      const badge = document.createElement("span");
      badge.className =
        `badge rounded-pill border fw-semibold ${className}`.trim();
      badge.textContent = labeler(key);
      return badge;
    });
  }

  function actionLink(record, kind) {
    const link = document.createElement("a");
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    if (kind === "setup") {
      link.href = record.setup_url;
      link.className = "btn btn-sm btn-success";
      link.textContent = `${t("install_use")} ↗`;
    } else {
      link.href = record.url;
      link.className = "btn btn-sm btn-outline-secondary";
      link.textContent = `${t("visit_project")} ↗`;
    }
    return link;
  }

  function renderComparison(comparison) {
    if (!comparison) {
      els.comparison.hidden = true;
      els.comparisonBody.replaceChildren();
      els.comparisonCards.replaceChildren();
      return;
    }

    const { proprietary, records } = comparison;
    els.comparison.hidden = false;
    els.comparisonTitle.textContent = tf("comparison_title", {
      product: proprietary,
    });
    els.comparisonIntro.textContent = t("comparison_intro");
    els.comparisonCount.textContent = tf("comparison_count", {
      count: new Intl.NumberFormat(currentLang).format(records.length),
    });

    const tableRows = records.map((record) => {
      const tr = document.createElement("tr");

      const projectCell = document.createElement("td");
      const projectLink = document.createElement("a");
      projectLink.href = record.url;
      projectLink.target = "_blank";
      projectLink.rel = "noopener noreferrer";
      projectLink.className =
        "comparison-project fw-bold text-success-emphasis text-decoration-none";
      projectLink.textContent = record.name;
      const category = document.createElement("div");
      category.className = "small text-body-secondary mt-1";
      category.textContent = categoryLabel(record.category);
      projectCell.append(projectLink, category);

      const bestForCell = document.createElement("td");
      bestForCell.className = "comparison-best-for";
      bestForCell.textContent = noteLabel(record.note_key) || "—";

      const platformCell = document.createElement("td");
      const platformWrap = document.createElement("div");
      platformWrap.className = "d-flex flex-wrap gap-1";
      platformWrap.append(
        ...badgeNodes(
          record.platforms,
          platformLabel,
          "text-body-secondary bg-body-tertiary",
        ),
      );
      platformCell.append(platformWrap);

      const limitationCell = document.createElement("td");
      const limitationWrap = document.createElement("div");
      limitationWrap.className = "d-flex flex-wrap gap-1";
      limitationWrap.append(
        ...badgeNodes(
          record.limitations,
          limitationLabel,
          "comparison-limitation",
        ),
      );
      limitationCell.append(limitationWrap);

      const actionsCell = document.createElement("td");
      actionsCell.className = "text-end";
      const actions = document.createElement("div");
      actions.className = "d-inline-flex flex-column gap-2 align-items-stretch";
      actions.append(actionLink(record, "setup"), actionLink(record, "visit"));
      actionsCell.append(actions);

      tr.append(
        projectCell,
        bestForCell,
        platformCell,
        limitationCell,
        actionsCell,
      );
      return tr;
    });
    els.comparisonBody.replaceChildren(...tableRows);

    const cards = records.map((record) => {
      const article = document.createElement("article");
      article.className = "comparison-mobile-card p-4 border-bottom";

      const top = document.createElement("div");
      top.className =
        "d-flex align-items-start justify-content-between gap-3 mb-3";
      const identity = document.createElement("div");
      const title = document.createElement("a");
      title.href = record.url;
      title.target = "_blank";
      title.rel = "noopener noreferrer";
      title.className =
        "h5 fw-bold text-success-emphasis text-decoration-none mb-1 d-block";
      title.textContent = record.name;
      const cat = document.createElement("div");
      cat.className = "small text-body-secondary";
      cat.textContent = categoryLabel(record.category);
      identity.append(title, cat);
      top.append(identity);

      const bestFor = document.createElement("div");
      bestFor.className = "mb-3";
      bestFor.innerHTML = `<div class="small fw-semibold text-body-secondary mb-1">${t("best_for")}</div>`;
      const bestText = document.createElement("p");
      bestText.className = "mb-0";
      bestText.textContent = noteLabel(record.note_key) || "—";
      bestFor.append(bestText);

      const platforms = document.createElement("div");
      platforms.className = "mb-3";
      const platformLabelNode = document.createElement("div");
      platformLabelNode.className =
        "small fw-semibold text-body-secondary mb-2";
      platformLabelNode.textContent = t("runs_on");
      const platformWrap = document.createElement("div");
      platformWrap.className = "d-flex flex-wrap gap-2";
      platformWrap.append(
        ...badgeNodes(
          record.platforms,
          platformLabel,
          "text-body-secondary bg-body-tertiary",
        ),
      );
      platforms.append(platformLabelNode, platformWrap);

      const limits = document.createElement("div");
      limits.className = "mb-3";
      const limitsLabel = document.createElement("div");
      limitsLabel.className = "small fw-semibold text-body-secondary mb-2";
      limitsLabel.textContent = t("limitations");
      const limitsWrap = document.createElement("div");
      limitsWrap.className = "d-flex flex-wrap gap-2";
      limitsWrap.append(
        ...badgeNodes(
          record.limitations,
          limitationLabel,
          "comparison-limitation",
        ),
      );
      limits.append(limitsLabel, limitsWrap);

      const actions = document.createElement("div");
      actions.className = "d-flex flex-wrap gap-2";
      actions.append(actionLink(record, "setup"), actionLink(record, "visit"));

      article.append(top, bestFor, platforms, limits, actions);
      return article;
    });
    els.comparisonCards.replaceChildren(...cards);
  }

  function renderCard(record) {
    const wrapper = els.template.content.firstElementChild.cloneNode(true);
    wrapper.querySelector(".category-pill").textContent = categoryLabel(
      record.category,
    );
    wrapper.querySelector(".mapping-label").textContent = t("instead_of");
    wrapper.querySelector(".mapping-try").textContent = t("try");
    wrapper.querySelector(".proprietary").textContent = record.proprietary;
    wrapper.querySelector(".mapping-arrow").textContent =
      currentLocale.meta.direction === "rtl" ? "←" : "→";
    const project = wrapper.querySelector(".project");
    project.textContent = record.name;
    project.href = record.url;
    wrapper.querySelector(".notes").textContent = noteLabel(record.note_key);
    wrapper.querySelector(".runs-on-label").textContent = t("runs_on");
    wrapper.querySelector(".limitations-label").textContent = t("limitations");
    addBadges(
      wrapper.querySelector(".platforms"),
      record.platforms,
      platformLabel,
    );
    addBadges(
      wrapper.querySelector(".limitation-tags"),
      record.limitations,
      limitationLabel,
    );
    const setup = wrapper.querySelector(".setup-link");
    setup.href = record.setup_url;
    setup.textContent = `${t("install_use")} ↗`;
    const visit = wrapper.querySelector(".visit");
    visit.href = record.url;
    visit.textContent = `${t("visit_project")} ↗`;
    return wrapper;
  }

  function render() {
    const state = getState();
    const query = state.q.trim();
    const c = collator();
    const comparison = comparisonForState(state);

    if (comparison) {
      renderComparison(comparison);
      els.results.replaceChildren();
      els.results.hidden = true;
      els.empty.hidden = true;
      els.resultSummary.textContent = tf("comparison_summary", {
        count: new Intl.NumberFormat(currentLang).format(
          comparison.records.length,
        ),
        product: comparison.proprietary,
      });
    } else {
      renderComparison(null);
      const rows = rowsForState(state).sort(
        (a, b) =>
          b.relevance - a.relevance ||
          c.compare(a.record.proprietary, b.record.proprietary),
      );
      els.results.replaceChildren(
        ...rows.map(({ record }) => renderCard(record)),
      );
      els.results.hidden = rows.length === 0;
      els.empty.hidden = rows.length !== 0;
      els.resultSummary.textContent = tf("results_summary", {
        count: new Intl.NumberFormat(currentLang).format(rows.length),
      });
    }

    const filtered = Boolean(query || state.category || state.platform);
    els.clear.hidden = !filtered;

    if (query) {
      els.query.hidden = false;
      els.query.replaceChildren(
        document.createTextNode(`${t("showing_matches")} `),
      );
      const strong = document.createElement("strong");
      strong.className = "text-body";
      strong.textContent = `“${query}”`;
      els.query.append(strong);
    } else {
      els.query.hidden = true;
      els.query.textContent = "";
    }

    syncUrl(state);
  }

  function scheduleRender() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 80);
  }

  function clearFilters() {
    els.search.value = "";
    els.category.value = "";
    els.platform.value = "";
    render();
    els.search.focus();
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-bs-theme", theme);
    localStorage.setItem("go-open-source-theme", theme);
    updateThemeLabel();
  }

  function initTheme() {
    const saved = localStorage.getItem("go-open-source-theme");
    const preferredDark = matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute(
      "data-bs-theme",
      saved || (preferredDark ? "dark" : "light"),
    );
  }

  function updateThemeLabel() {
    if (!els.theme) return;
    const isDark =
      document.documentElement.getAttribute("data-bs-theme") === "dark";
    const label = currentLocale
      ? t(isDark ? "use_light" : "use_dark")
      : isDark
        ? "Use light theme"
        : "Use dark theme";
    els.theme.setAttribute("aria-label", label);
    els.theme.setAttribute("title", label);
  }

  function toggleTheme() {
    const isDark =
      document.documentElement.getAttribute("data-bs-theme") === "dark";
    applyTheme(isDark ? "light" : "dark");
  }

  async function changeLanguage(code, preserveState = true) {
    const state = preserveState ? getState() : urlState();
    const query = els.search.value;
    currentLang = code;
    currentLocale = await loadLocale(code);
    localStorage.setItem("go-open-source-language", code);
    staticTranslations();
    populateControls(state);
    els.search.value = preserveState ? query : state.q;
    render();
  }

  async function init() {
    assertRequiredElements();
    initTheme();

    try {
      const response = await fetch(
        `catalog.v2.json?v=${encodeURIComponent(BUILD_ID)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.schema_version !== 2)
        throw new Error(
          `Unsupported catalog schema: ${payload.schema_version ?? "missing"}`,
        );
      if (
        !Array.isArray(payload.records) ||
        !Array.isArray(payload.categories) ||
        !Array.isArray(payload.platforms) ||
        !Array.isArray(payload.locales)
      )
        throw new Error("Catalog payload is malformed");
      if (
        payload.records.some(
          (record) => !record.name || !record.category || !record.url,
        )
      )
        throw new Error("Catalog contains an invalid project record");

      catalog = payload.records;
      categoryKeys = payload.categories;
      platformKeys = payload.platforms;
      localeMetas = payload.locales;
      englishLocale = await loadLocale("en");

      const params = new URLSearchParams(location.search);
      const requested = params.get("lang");
      const saved = localStorage.getItem("go-open-source-language");
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
      els.empty.querySelector("h3").textContent = currentLocale
        ? t("catalog_unavailable")
        : "Catalog unavailable";
      els.empty.querySelector("p").textContent = currentLocale
        ? t("catalog_unavailable_help")
        : "Refresh the page or try again later.";
      els.emptyClear.hidden = true;
      return;
    }

    const initial = urlState();
    staticTranslations();
    populateControls(initial);
    els.search.value = initial.q;
    render();

    els.search.addEventListener("input", scheduleRender);
    els.category.addEventListener("change", render);
    els.platform.addEventListener("change", render);
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
