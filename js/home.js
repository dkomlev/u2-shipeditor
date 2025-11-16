"use strict";

(function () {
  const STORAGE_KEY = "u2.selectedShip";
  const PRESETS = ["Balanced", "Sport", "Rally", "Muscle", "F1", "Industrial", "Truck", "Warship", "Liner", "Recon"];
  const SHIP_ADAPTER =
    (typeof window !== "undefined" && window.U2ShipAdapter) ||
    (typeof globalThis !== "undefined" && globalThis.U2ShipAdapter);
  if (!SHIP_ADAPTER) {
    console.error("U2ShipAdapter is not loaded. Ensure js/lib/ship-adapter.js is included.");
  }
  const RESOURCE_SERVICE =
    (typeof window !== "undefined" && window.U2Resources) ||
    (typeof globalThis !== "undefined" && globalThis.U2Resources);
  if (!RESOURCE_SERVICE) {
    console.error("U2Resources is not loaded. Ensure js/lib/resources.js is included.");
  }

  const state = {
    current: null,
    toastTimer: null,
    manifest: [],
    assistOverride: null
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
    try {
      await restoreSelection();
    } catch (error) {
      console.error(error);
      showStatus("Не удалось восстановить выбор. Загружаем случайный корабль.", true);
      await loadRandomShip();
    }
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
    dom.assistOverrideSelect = document.getElementById("assistOverrideSelect");
    dom.assistOverrideStatus = document.querySelector('[data-field="assist-override-status"]');
    if (dom.assistOverrideSelect && dom.assistOverrideSelect.options.length <= 1) {
      PRESETS.forEach((preset) => dom.assistOverrideSelect.add(new Option(preset, preset)));
    }
    setAssistOverride(state.assistOverride);
  }

  function bindEvents() {
    dom.chooseShipBtn?.addEventListener("click", () => togglePicker(true));
    dom.launchBtn?.addEventListener("click", onLaunchFlightTest);
    dom.openArchitectBtn?.addEventListener("click", () => (window.location.href = "ship-architect.html"));
    dom.openAppConfigBtn?.addEventListener("click", () => (window.location.href = "app-config.html"));
    dom.assistOverrideSelect?.addEventListener("change", (event) => {
      const value = event.target.value || null;
      setAssistOverride(value);
    });

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

  function setAssistOverride(value) {
    state.assistOverride = value || null;
    if (dom.assistOverrideSelect && dom.assistOverrideSelect.value !== (value || "")) {
      dom.assistOverrideSelect.value = value || "";
    }
    const hint = value ? `Перекрыт на ${value}` : "Из ShipConfig";
    writeField("assist-override-status", hint);
    if (state.current) {
      persistSelection(state.current);
    }
  }

  async function loadManifest() {
    if (!RESOURCE_SERVICE) {
      state.manifest = [];
      showStatus("Не удалось загрузить список кораблей.", true);
      return;
    }
    try {
      const list = await RESOURCE_SERVICE.loadManifest();
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
        setAssistOverride(stored.assistOverride ?? null);
        showStatus("Загружен корабль из localStorage", false);
        return;
      }

      if (stored.path) {
        const result = await fetchShip(stored.path);
        applySelection(result, false);
        setAssistOverride(stored.assistOverride ?? null);
        showStatus("Восстановлен последний выбранный корабль", false);
        return;
      }
    } catch (error) {
      console.warn("Не удалось распарсить localStorage", error);
    }

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
    const json = RESOURCE_SERVICE
      ? await RESOURCE_SERVICE.getShipConfig(path)
      : await fetch(path, { cache: "no-store" }).then((response) => {
          if (!response.ok) {
            throw new Error(`Не удалось загрузить ${path}: ${response.status}`);
          }
          return response.json();
        });
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
      assistOverride: state.assistOverride,
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
    writeField("assist-profile", summary.assist_profile || summary.assist?.handling_style || summary.preset || "—");
    writeField("assist-slip-limit", formatNumber(summary.assist_slip_limit_deg, "°"));
    writeField("assist-traction", formatFraction(summary.assist_traction_control));
    writeField("assist-speed-limiter", formatPercent(summary.assist_speed_limiter_ratio));

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
      const card = document.createElement("button");
      card.type = "button";
      card.className = "picker-card";
      card.dataset.path = entry.path;
      if (state.current?.sourcePath === entry.path) {
        card.classList.add("is-active");
      }

      const summary = getEntrySummary(entry);
      const thumbSrc = summary?.sprite?.value
        ? summary.sprite.kind === "path"
          ? encodeURI(summary.sprite.value)
          : summary.sprite.value
        : "";
      const stats = renderPickerStats(summary);
      const tags = renderTags(summary?.tags || entry.tags);

      card.innerHTML = `
        <div class="picker-card__preview">
          ${
            thumbSrc
              ? `<img src="${thumbSrc}" alt="Превью ${summary?.name ?? entry.path}" loading="lazy" />`
              : '<div class="picker-card__preview--placeholder">Нет превью</div>'
          }
        </div>
        <div class="picker-card__title">${summary?.name ?? entry.path.split("/").pop()}</div>
        <div class="picker-card__meta">
          ${summary?.size_type ?? "—"} · ${summary?.assist_profile ?? summary?.preset ?? "—"}
        </div>
        ${stats}
        ${tags}
        <span class="picker-card__badge">${summary?.version ?? "v0.x"}</span>
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
      forward_accel_mps2: summary.forward_accel_mps2,
      lateral_accel_mps2: summary.lateral_accel_mps2,
      angular_dps: summary.angular_dps,
      sprite: summary.sprite,
      assist_profile: summary.assist_profile,
      assist_slip_limit_deg: summary.assist_slip_limit_deg,
      assist_traction_control: summary.assist_traction_control,
      assist_speed_limiter_ratio: summary.assist_speed_limiter_ratio
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
    const autopPreset = state.assistOverride || summary.preset;
    const autopSource = state.assistOverride ? "launcher" : summary.presetSource || "config";

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
        preset: autopPreset,
        source: autopSource,
        profile: summary.assist_profile || summary.preset,
        slip_limit_deg: summary.assist_slip_limit_deg ?? null,
        traction_control: summary.assist_traction_control ?? null,
        speed_limiter_ratio: summary.assist_speed_limiter_ratio ?? null
      },
      pilot_assist: {
        preset: autopPreset,
        override: state.assistOverride || null,
        summary: {
          profile: summary.assist_profile || summary.preset,
          slip_limit_deg: summary.assist_slip_limit_deg ?? null,
          traction_control: summary.assist_traction_control ?? null,
          speed_limiter_ratio: summary.assist_speed_limiter_ratio ?? null,
          turn_authority: summary.assist_turn_authority ?? null
        }
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

  function summarizeShip(config, sourcePath) {
    if (!SHIP_ADAPTER) {
      throw new Error("Ship adapter is not available");
    }
    return SHIP_ADAPTER.parseShipConfig(config, sourcePath);
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

  function formatFraction(value, digits = 2) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "—";
    }
    return value.toFixed(digits);
  }

  function formatPercent(value) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "—";
    }
    return `${Math.round(value * 100)}%`;
  }

  function getEntrySummary(entry) {
    if (!entry) {
      return null;
    }
    if (entry.summary) {
      return entry.summary;
    }
    return {
      name: entry.name,
      size: entry.size,
      type: entry.type,
      size_type: entry.size && entry.type ? `${entry.size} ${entry.type}` : entry.size || entry.type || "",
      preset: entry.preset,
      presetSource: entry.presetSource,
      version: entry.version,
      sprite: entry.preview || null,
      forward_accel_mps2: entry.forward_accel_mps2 ?? null,
      lateral_accel_mps2: entry.lateral_accel_mps2 ?? null,
      thrust_to_weight: entry.thrust_to_weight ?? null,
      power_MW: entry.power_MW ?? null,
      tags: entry.tags || [],
      assist_profile: entry.assist_profile ?? null,
      assist_slip_limit_deg: entry.assist_slip_limit_deg ?? null,
      assist_traction_control: entry.assist_traction_control ?? null,
      assist_speed_limiter_ratio: entry.assist_speed_limiter_ratio ?? null,
      assist_turn_authority: entry.assist_turn_authority ?? null,
      assist: entry.assist ?? null
    };
  }

  function renderPickerStats(summary) {
    if (!summary) {
      return "";
    }
    const forward = typeof summary.forward_accel_mps2 === "number" ? `${summary.forward_accel_mps2.toFixed(0)} м/с²` : "—";
    const lateral = typeof summary.lateral_accel_mps2 === "number" ? `${summary.lateral_accel_mps2.toFixed(0)} м/с²` : "—";
    const ratio =
      typeof summary.thrust_to_weight === "number"
        ? summary.thrust_to_weight >= 10
          ? summary.thrust_to_weight.toFixed(1)
          : summary.thrust_to_weight.toFixed(2)
        : "—";
    const assistProfile = summary.assist_profile || summary.preset || "—";
    const slipLimit = typeof summary.assist_slip_limit_deg === "number" ? `${summary.assist_slip_limit_deg.toFixed(0)}°` : "—";
    const traction =
      typeof summary.assist_traction_control === "number" ? summary.assist_traction_control.toFixed(2) : "—";
    return `
      <div class="picker-card__stats">
        <span title="Forward accel">↗ ${forward}</span>
        <span title="Lateral accel">⇆ ${lateral}</span>
        <span title="Thrust to weight">T/W ${ratio}</span>
      </div>
      <div class="picker-card__assist" title="Сводка Coupled ассиста">
        Assist: ${assistProfile} · β≤${slipLimit} · TC ${traction}
      </div>
    `;
  }

  function renderTags(tags) {
    if (!tags || !tags.length) {
      return "";
    }
    return `
      <div class="tag-list">
        ${tags
          .slice(0, 6)
          .map((tag) => `<span class="tag">${tag}</span>`)
          .join("")}
      </div>
    `;
  }
})();
