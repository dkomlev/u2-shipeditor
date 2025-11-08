"use strict";

(function () {
  const STORAGE_KEY = "u2.selectedShip";
  const MANIFEST_PATH = "ships/manifest.json";

  const PRESET_RECOMMENDATIONS = {
    "snub fighter": "Sport",
    "small fighter": "Sport",
    "medium fighter": "Muscle",
    "heavy fighter": "Muscle",
    "medium freighter": "Truck",
    "heavy freighter": "Truck",
    "capital freighter": "Hauler",
    default: "Sport"
  };

  const state = {
    current: null,
    pickerReady: false,
    toastTimer: null,
    manifest: [],
    manifestReady: false
  };

  const cache = new Map();
  const fieldCache = new Map();
  const dom = {};

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((error) => {
      console.error(error);
      showStatus("Не удалось инициализировать лаунчер.", true);
    });
  });

  async function init() {
    cacheDom();
    bindEvents();
    await loadManifest();
    await prefetchManifestShips();
    try {
      await restoreSelection();
    } catch (error) {
      console.error(error);
      showStatus("Не удалось восстановить выбор. Загружаем случайный корабль.", true);
      await loadRandomShip();
    }
  }

  async function loadManifest() {
    try {
      const response = await fetch(MANIFEST_PATH, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`manifest status ${response.status}`);
      }
      const list = await response.json();
      state.manifest = Array.isArray(list) ? list : [];
      state.manifestReady = true;
      if (!state.manifest.length) {
        showStatus("В каталоге ships нет конфигов.", true);
      }
    } catch (error) {
      console.error("manifest error", error);
      state.manifest = [];
      state.manifestReady = false;
      showStatus("Не удалось загрузить список кораблей.", true);
    }
  }

  async function prefetchManifestShips() {
    if (!state.manifest.length) {
      return;
    }
    await Promise.all(
      state.manifest.map((entry) =>
        fetchShip(entry.path).catch((error) => {
          console.warn("prefetch failed", entry.path, error);
          return null;
        })
      )
    );
  }

  function cacheDom() {
    dom.shipImage = document.getElementById("shipImage");
    dom.previewPlaceholder = document.querySelector("[data-preview-placeholder]");
    dom.statusLine = document.querySelector('[data-field="status-line"]');
    dom.shipPresetEl = document.querySelector('[data-field="ship-preset"]');
    dom.toast = document.getElementById("statusToast");
    dom.chooseShipBtn = document.getElementById("chooseShipBtn");
    dom.launchBtn = document.getElementById("launchBtn");
    dom.openArchitectBtn = document.getElementById("openArchitectBtn");
    dom.openAppConfigBtn = document.getElementById("openAppConfigBtn");
    dom.shipPickerModal = document.getElementById("shipPickerModal");
    dom.pickerList = document.getElementById("pickerList");
    dom.pickerImport = document.getElementById("pickerImport");
  }

  function bindEvents() {
    dom.chooseShipBtn?.addEventListener("click", () => togglePicker(true));
    dom.launchBtn?.addEventListener("click", onLaunchFlightTest);
    dom.openArchitectBtn?.addEventListener("click", () => (window.location.href = "ship-architect.html"));
    dom.openAppConfigBtn?.addEventListener("click", () => (window.location.href = "app-config.html"));

    dom.shipImage?.addEventListener("error", () => {
      dom.shipImage?.setAttribute("hidden", "hidden");
      dom.previewPlaceholder?.removeAttribute("hidden");
    });

    dom.pickerImport?.addEventListener("change", handleImport);

    document.querySelectorAll('[data-modal-close="ship-picker"]').forEach((btn) => {
      btn.addEventListener("click", () => togglePicker(false));
    });

    dom.shipPickerModal?.addEventListener("click", (event) => {
      if (event.target === dom.shipPickerModal) {
        togglePicker(false);
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        togglePicker(false);
      }
    });
  }

  function writeField(name, value) {
    if (!fieldCache.has(name)) {
      fieldCache.set(name, Array.from(document.querySelectorAll(`[data-field="${name}"]`)));
    }
    fieldCache.get(name).forEach((node) => {
      node.textContent = value;
    });
  }

  async function restoreSelection() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return loadRandomShip();
    }

    try {
      const stored = JSON.parse(raw);
      if (stored.sourceKind === "inline" && stored.inlineShip) {
        const summary = mapShipConfig(stored.inlineShip, stored.path || "inline");
        if ((!summary.sprite || !summary.sprite.value) && stored.snapshot?.sprite?.value) {
          summary.sprite = stored.snapshot.sprite;
        }
        applySelection(
          {
            summary,
            raw: stored.inlineShip,
            sourceKind: "inline",
            sourcePath: stored.path || "inline"
          },
          false
        );
        showStatus("Загружен корабль из localStorage", false);
        return;
      }

      if (stored.path) {
        const result = await fetchShip(stored.path);
        applySelection(result, false);
        showStatus("Восстановлен последний выбранный корабль", false);
        return;
      }
    } catch (error) {
      console.warn("Не удалось распарсить localStorage", error);
    }

    return loadDefaultShip();
  }

  async function loadDefaultShip() {
    return loadRandomShip();
  }

  async function loadRandomShip() {
    if (!state.manifest.length) {
      showStatus("Каталог кораблей пуст.", true);
      return;
    }
    const pool = [...state.manifest];
    while (pool.length) {
      const index = Math.floor(Math.random() * pool.length);
      const candidate = pool.splice(index, 1)[0];
      try {
        const result = await fetchShip(candidate.path);
        applySelection(result);
        showStatus(`Загружен ${result.summary.name}`, false);
        return;
      } catch (error) {
        console.warn("random load failed", candidate.path, error);
      }
    }
    showStatus("Не удалось загрузить ни один ShipConfig.", true);
  }

  async function fetchShip(path) {
    const key = path;
    if (cache.has(key)) {
      return cache.get(key);
    }

    const encoded = encodeURI(path);
    const response = await fetch(encoded, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Не удалось загрузить ${path}: ${response.status}`);
    }
    const json = await response.json();
    const summary = mapShipConfig(json, path);
    const payload = {
      summary,
      raw: json,
      sourceKind: "path",
      sourcePath: path
    };
    cache.set(key, payload);
    return payload;
  }

  function applySelection(payload, persist = true) {
    state.current = payload;
    renderShip(payload.summary);
    updateLaunchState();
    if (persist) {
      persistSelection(payload);
    }
  }

  function persistSelection(payload) {
    const snapshot = buildSnapshot(payload.summary);
    const record = {
      path: payload.sourcePath,
      version: payload.summary.version,
      sourceKind: payload.sourceKind,
      snapshot,
      inlineShip: payload.sourceKind === "inline" ? stripSprite(payload.raw) : null,
      storedAt: new Date().toISOString()
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch (error) {
      console.warn("localStorage переполнен", error);
      showStatus("Не получилось сохранить выбор (хранилище).", true);
    }
  }

  function stripSprite(data) {
    if (!data) {
      return null;
    }
    const clone = JSON.parse(JSON.stringify(data));
    if (clone.media?.sprite?.dataUrl) {
      clone.media.sprite.dataUrl = null;
    }
    return clone;
  }

  function renderShip(summary) {
    const archetype = summary.size_type || `${summary.size ?? ""} ${summary.type ?? ""}`.trim();
    writeField("ship-name", summary.name || "Без имени");
    writeField("ship-archetype", archetype || "—");
    writeField("ship-source", summary.sourceLabel || "—");
    writeField("ship-version", summary.version || "0.6");

    writeField("ship-preset", summary.preset || "—");
    if (dom.shipPresetEl) {
      dom.shipPresetEl.dataset.origin = summary.presetSource || "config";
    }
    writeField(
      "ship-preset-hint",
      summary.presetSource === "recommended" ? "Рекомендованный пресет" : "Задан в конфиге"
    );

    writeField("ship-mass", formatNumber(summary.mass_t, "т"));
    writeField("ship-scm", formatNumber(summary.scm_mps, "м/с"));
    writeField("ship-vmax", formatNumber(summary.vmax_mps, "м/с"));
    writeField("ship-angular", formatAngular(summary.angular_dps));
    writeField("ship-maneuver", summary.performanceHint || "—");

    updatePreview(summary.sprite);
    updateStatusTimestamp();
  }

  function updatePreview(sprite) {
    if (sprite?.value) {
      dom.shipImage?.removeAttribute("hidden");
      dom.previewPlaceholder?.setAttribute("hidden", "hidden");
      dom.shipImage.src = sprite.kind === "path" ? encodeURI(sprite.value) : sprite.value;
      dom.shipImage.alt = sprite.alt || "Превью корабля";
      return;
    }

    dom.shipImage?.setAttribute("hidden", "hidden");
    dom.previewPlaceholder?.removeAttribute("hidden");
  }

  function updateStatusTimestamp() {
    const now = new Date();
    writeField(
      "status-timestamp",
      now.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit"
      })
    );
  }

  function updateLaunchState() {
    if (!dom.launchBtn) {
      return;
    }
    dom.launchBtn.disabled = !state.current;
  }

  function togglePicker(open) {
    if (!dom.shipPickerModal) {
      return;
    }
    if (open) {
      dom.shipPickerModal.removeAttribute("hidden");
      if (!state.pickerReady) {
        renderPicker();
      }
    } else {
      dom.shipPickerModal.setAttribute("hidden", "hidden");
    }
  }

  function renderPicker() {
    if (!dom.pickerList) {
      return;
    }
    dom.pickerList.innerHTML = "";

    BUILTIN_SHIPS.forEach((entry) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "picker-card";
      card.dataset.path = entry.path;
      if (state.current?.sourcePath === entry.path) {
        card.classList.add("is-active");
      }

      card.innerHTML = `
        <div class="picker-card__title">${entry.label}</div>
        <div class="picker-card__meta" data-role="meta">${entry.note || "Загрузка..."}</div>
        <span class="picker-card__badge">Встроенный</span>
      `;

      card.addEventListener("click", async () => {
        try {
          const result = await fetchShip(entry.path);
          applySelection(result);
          togglePicker(false);
          showStatus(`Выбран ${result.summary.name}`, false);
        } catch (error) {
          console.error(error);
          showStatus("Не удалось загрузить конфиг.", true);
        }
      });

      dom.pickerList.appendChild(card);

      fetchShip(entry.path)
        .then(({ summary }) => {
          const meta = card.querySelector('[data-role="meta"]');
          if (meta) {
            meta.textContent = `${summary.size_type ?? "—"} · ${summary.preset ?? "—"}`;
          }
        })
        .catch(() => {
          const meta = card.querySelector('[data-role="meta"]');
          if (meta) {
            meta.textContent = "Ошибка чтения файла";
          }
        });
    });

    state.pickerReady = true;
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const summary = mapShipConfig(json, `local:${file.name}`);
      const payload = {
        summary,
        raw: json,
        sourceKind: "inline",
        sourcePath: `local:${file.name}`
      };
      applySelection(payload);
      togglePicker(false);
      showStatus(`Импортирован ${summary.name}`, false);
    } catch (error) {
      console.error(error);
      showStatus("Не получилось импортировать JSON. Проверьте схему.", true);
    } finally {
      event.target.value = "";
    }
  }

  function buildSnapshot(summary) {
    return {
      id: summary.id,
      name: summary.name,
      size: summary.size,
      type: summary.type,
      size_type: summary.size_type,
      preset: summary.preset,
      presetSource: summary.presetSource,
      mass_t: summary.mass_t,
      scm_mps: summary.scm_mps,
      vmax_mps: summary.vmax_mps,
      angular_dps: summary.angular_dps,
      sprite: summary.sprite
    };
  }

  function onLaunchFlightTest() {
    if (!state.current) {
      showStatus("Сначала выберите корабль.", true);
      return;
    }

    dom.launchBtn?.classList.add("is-busy");

    try {
      const payload = buildFlightTestAppConfig(state.current);
      const filename = `u2-flight-test-${state.current.summary.id || "ship"}.json`;
      downloadJson(payload, filename);
      showStatus("AppConfig сформирован. Загрузите файл в Flight Test 2D.", false);
    } catch (error) {
      console.error(error);
      showStatus("Не удалось собрать AppConfig.", true);
    } finally {
      dom.launchBtn?.classList.remove("is-busy");
    }
  }

  function buildFlightTestAppConfig(selection) {
    const { summary, sourceKind, sourcePath, raw } = selection;
    const shipReference =
      sourceKind === "inline"
        ? { inline_ship: raw }
        : { ship_config_path: sourcePath };

    return {
      version: "0.5.3",
      build: "u2-test-launcher",
      generated_at: new Date().toISOString(),
      paths: {
        ship_config_path: sourceKind === "inline" ? "inline://local-storage" : sourcePath,
        app_config_path: "./config/appconfig.json"
      },
      world: {
        name: "U2 Flight Test Range",
        gravity_mps2: 0,
        atmosphere: "vacuum"
      },
      render: {
        hud: true,
        reticle: true
      },
      hud: {
        units: "metric",
        language: "ru-RU"
      },
      input: {
        profile: "kbm",
        master_mode: "space"
      },
      collision: {
        solver: "aabb",
        debug_draw: false
      },
      autopilot: {
        coupled: true,
        dampeners: true,
        preset: summary.preset
      },
      selected_ship: {
        id: summary.id,
        name: summary.name,
        size_type: summary.size_type
      },
      ...shipReference
    };
  }

  function downloadJson(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function showStatus(message, isError) {
    if (dom.statusLine) {
      dom.statusLine.dataset.variant = isError ? "error" : "ok";
    }
    writeField("status-message", message);

    if (!dom.toast) {
      return;
    }

    dom.toast.textContent = message;
    dom.toast.removeAttribute("hidden");
    dom.toast.dataset.variant = isError ? "error" : "ok";

    clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      dom.toast?.setAttribute("hidden", "hidden");
    }, 4200);
  }

  function mapShipConfig(config, sourcePath) {
    const version = detectVersion(config);
    return version.startsWith("0.6") ? mapV06(config, sourcePath) : mapV053(config, sourcePath);
  }

  function detectVersion(config) {
    const metaVersion = String(config?.meta?.version || "").trim();
    if (metaVersion) {
      return metaVersion;
    }
    if (config.classification) {
      return "0.6";
    }
    return "0.5.3";
  }

  function mapV06(config, sourcePath) {
    const size = config.classification?.size || "small";
    const type = config.classification?.type || "fighter";
    const sizeType = config.classification?.size_type || `${size} ${type}`.trim();
    const preset = config.assist?.preset || recommendPreset(sizeType);

    return {
      id: config.meta?.id || config.meta?.name || "ship",
      name: config.meta?.name || "Без имени",
      version: config.meta?.version || "0.6",
      size,
      type,
      size_type: sizeType,
      preset,
      presetSource: config.assist?.preset ? "config" : "recommended",
      mass_t: config.mass?.dry_t ?? null,
      scm_mps: config.performance?.scm_mps ?? null,
      vmax_mps: config.performance?.vmax_mps ?? null,
      angular_dps: config.performance?.angular_dps ?? null,
      performanceHint: buildPerformanceHint(config.performance),
      sprite: resolveSprite(config.media?.sprite, sourcePath),
      sourceLabel: sourcePath?.startsWith("local:")
        ? "Импортированный JSON"
        : `Файл: ${sourcePath || "—"}`
    };
  }

  function mapV053(config, sourcePath) {
    const className = (config.meta?.class || config.meta?.name || "medium freighter").toLowerCase();
    const [size = "medium", typePhrase = "freighter"] = className.split(/\s+/);
    const sizeType = `${size} ${typePhrase}`.trim();
    const preset = recommendPreset(sizeType);

    const angular = toAngularFromRcs(config.rcs);
    const sprite =
      config.sprite?.path && config.sprite.path.startsWith("assets")
        ? { kind: "path", value: config.sprite.path.replace(/^assets/, "asstets"), alt: config.meta?.name }
        : null;

    return {
      id: config.meta?.id || config.meta?.name || "ship-legacy",
      name: config.meta?.name || config.meta?.class || "Legacy ship",
      version: config.meta?.version || "0.5.3",
      size,
      type: typePhrase || "fighter",
      size_type: sizeType,
      preset,
      presetSource: "recommended",
      mass_t: config.mass?.mass_kg ? config.mass.mass_kg / 1000 : null,
      scm_mps: null,
      vmax_mps: null,
      angular_dps: angular,
      performanceHint: config.g_limits?.profile ? `G-profile: ${config.g_limits.profile}` : null,
      sprite,
      sourceLabel: sourcePath?.startsWith("local:")
        ? "Импортированный JSON (v0.5.3)"
        : `Legacy: ${sourcePath || "—"}`
    };
  }

  function recommendPreset(sizeTypeRaw) {
    const key = (sizeTypeRaw || "").toLowerCase();
    const match = Object.keys(PRESET_RECOMMENDATIONS).find(
      (entry) => entry !== "default" && key.includes(entry)
    );
    return PRESET_RECOMMENDATIONS[match || "default"];
  }

  function resolveSprite(sprite, sourcePath) {
    if (!sprite) {
      return null;
    }
    if (sprite.dataUrl) {
      return { kind: "dataUrl", value: sprite.dataUrl, alt: sprite.name || "ship sprite" };
    }
    if (sprite.path) {
      const normalized = sprite.path.replace(/^assets/, "asstets");
      return { kind: "path", value: normalized, alt: sprite.name || sourcePath };
    }
    return null;
  }

  function buildPerformanceHint(perf) {
    if (!perf) {
      return null;
    }
    const accel = perf.accel_fwd_mps2 ? `${perf.accel_fwd_mps2.toFixed(0)} м/с² accel` : null;
    const strafe = perf.strafe_mps2?.x ? `Strafe ${perf.strafe_mps2.x.toFixed(0)} м/с²` : null;
    return [accel, strafe].filter(Boolean).join(" · ") || null;
  }

  function toAngularFromRcs(rcs) {
    if (!rcs) {
      return null;
    }
    const omega = rcs.turn_omega_max_radps;
    if (!omega) {
      return null;
    }
    const deg = (omega * 180) / Math.PI;
    return { pitch: deg, yaw: deg, roll: deg };
  }

  function formatNumber(value, suffix) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "—";
    }
    const formatted = value.toLocaleString("ru-RU", {
      maximumFractionDigits: value >= 10 ? 0 : 1
    });
    return suffix ? `${formatted} ${suffix}` : formatted;
  }

  function formatAngular(angular) {
    if (!angular) {
      return "—";
    }
    const { pitch, yaw, roll } = angular;
    return `${formatAngle(pitch)}/${formatAngle(yaw)}/${formatAngle(roll)}`;
  }

  function formatAngle(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "—";
    }
    return `${value.toFixed(0)}°`;
  }
})();
