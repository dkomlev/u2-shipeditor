"use strict";

(function () {
  const STORAGE_KEY = "u2.selectedShip";
  const MANIFEST_PATH = "ships/manifest.json";
  const SHIP_ADAPTER =
    (typeof window !== "undefined" && window.U2ShipAdapter) ||
    (typeof globalThis !== "undefined" && globalThis.U2ShipAdapter);
  if (!SHIP_ADAPTER) {
    console.error("U2ShipAdapter is not loaded. Ensure js/lib/ship-adapter.js is included.");
  }

  const state = {
    current: null,
    toastTimer: null,
    manifest: []
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
      if (!state.manifest.length) {
        showStatus("В каталоге ships нет конфигов.", true);
      }
    } catch (error) {
      console.error("manifest error", error);
      state.manifest = [];
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

  function summarizeShip(config, path) {
    if (!SHIP_ADAPTER) {
      throw new Error("Ship adapter is not available");
    }
    return SHIP_ADAPTER.parseShipConfig(config, path);
  }

  async function restoreSelection() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return loadRandomShip();
    }

    try {
      const stored = JSON.parse(raw);
      if (stored.sourceKind === "inline" && stored.inlineShip) {
        const summary = summarizeShip(stored.inlineShip, stored.path || "inline");
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
    const summary = summarizeShip(json, path);
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
    writeField("ship-forward-accel", formatNumber(summary.forward_accel_mps2, "м/с²"));
    writeField("ship-lateral-accel", formatNumber(summary.lateral_accel_mps2, "м/с²"));
    writeField("ship-angular", formatAngular(summary.angular_dps));
    writeField("ship-thrust-weight", formatRatio(summary.thrust_to_weight, "g"));
    writeField("ship-maneuver", summary.performanceHint || "—");
    writeField("ship-power", formatNumber(summary.power_MW, "МВт"));

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
      renderPicker();
    } else {
      dom.shipPickerModal.setAttribute("hidden", "hidden");
    }
  }

  function renderPicker() {
    if (!dom.pickerList) {
      return;
    }
    dom.pickerList.innerHTML = "";

    if (!state.manifest.length) {
      const empty = document.createElement("p");
      empty.className = "picker-empty";
      empty.textContent = "Каталог ships пуст или не загружен.";
      dom.pickerList.appendChild(empty);
      return;
    }

    state.manifest.forEach((entry) => {
      const cached = cache.get(entry.path);
      const summary = cached?.summary;

      const card = document.createElement("button");
      card.type = "button";
      card.className = "picker-card";
      card.dataset.path = entry.path;
      if (state.current?.sourcePath === entry.path) {
        card.classList.add("is-active");
      }

      const thumbSrc = summary?.sprite?.value
        ? summary.sprite.kind === "path"
          ? encodeURI(summary.sprite.value)
          : summary.sprite.value
        : "";

      card.innerHTML = `
        <div class="picker-card__preview">
          ${
            thumbSrc
              ? `<img src="${thumbSrc}" alt="Превью ${summary?.name ?? entry.path}" loading="lazy" />`
              : '<div class="picker-card__preview--placeholder">Нет превью</div>'
          }
        </div>
        <div class="picker-card__title">${summary?.name ?? entry.path.split("/").pop()}</div>
        <div class="picker-card__meta" data-role="meta">
          ${summary ? `${summary.size_type ?? "—"} · ${summary.preset ?? "—"}` : "Загрузка..."}
        </div>
        <span class="picker-card__badge">${summary?.version ?? "v0.x"}</span>
      `;

      card.addEventListener("click", async () => {
        try {
          const result = cached || (await fetchShip(entry.path));
          applySelection(result);
          togglePicker(false);
          showStatus(`Выбран ${result.summary.name}`, false);
        } catch (error) {
          console.error(error);
          showStatus("Не удалось загрузить конфиг.", true);
        }
      });

      dom.pickerList.appendChild(card);

      if (!summary) {
        fetchShip(entry.path)
          .then(({ summary: fresh }) => {
            const meta = card.querySelector('[data-role="meta"]');
            if (meta) {
              meta.textContent = `${fresh.size_type ?? "—"} · ${fresh.preset ?? "—"}`;
            }
            const img = card.querySelector("img");
            if (img && fresh.sprite?.value) {
              img.src = fresh.sprite.kind === "path" ? encodeURI(fresh.sprite.value) : fresh.sprite.value;
            }
          })
          .catch(() => {
            const meta = card.querySelector('[data-role="meta"]');
            if (meta) {
              meta.textContent = "Ошибка чтения файла";
            }
          });
      }
    });
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const summary = summarizeShip(json, `local:${file.name}`);
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

  function formatNumber(value, suffix) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "—";
    }
    const formatted = value.toLocaleString("ru-RU", {
      maximumFractionDigits: value >= 10 ? 0 : 1
    });
    return suffix ? `${formatted} ${suffix}` : formatted;
  }

  function formatRatio(value, suffix) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "—";
    }
    const formatted = value >= 10 ? value.toFixed(1) : value.toFixed(2);
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
