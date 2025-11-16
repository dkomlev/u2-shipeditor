"use strict";

(function () {
  const AppConfigLib =
    (typeof window !== "undefined" && window.U2AppConfig) ||
    (typeof globalThis !== "undefined" && globalThis.U2AppConfig);
  if (!AppConfigLib) {
    console.error("U2AppConfig is not loaded. Include js/lib/appconfig.js before js/app-config.js");
    return;
  }
  const clone =
    AppConfigLib.clone ||
    (typeof structuredClone === "function"
      ? (value) => structuredClone(value)
      : (value) => JSON.parse(JSON.stringify(value)));
  const mergeDeep =
    AppConfigLib.mergeDeep ||
    function mergeDeep(target, source) {
      if (typeof target !== "object" || typeof source !== "object" || !target || !source) {
        return source;
      }
      Object.keys(source).forEach((key) => {
        if (Array.isArray(source[key])) {
          target[key] = source[key].slice();
        } else if (typeof source[key] === "object" && source[key] !== null) {
          target[key] = mergeDeep(target[key] || {}, source[key]);
        } else {
          target[key] = source[key];
        }
      });
      return target;
    };
  let SECTION_DEFS = AppConfigLib.SECTION_DEFS;
  const DEFAULT_CONFIG = AppConfigLib.createDefaultConfig();
  const STORAGE_KEY = "u2.appConfig";
  const AUTOSAVE_DELAY = 1000;

  if (!SECTION_DEFS) {
    SECTION_DEFS = [
    {
      id: "paths",
      title: "Пути",
      description: "Откуда брать ShipConfig и куда сохранять AppConfig.",
      fields: [
        {
          path: "paths.ship_config_path",
          label: "ShipConfig path",
          type: "text",
          placeholder: "ships/example.json",
          helper: "Путь попадёт в Flight Test при запуске."
        },
        {
          path: "paths.app_config_path",
          label: "AppConfig path",
          type: "text",
          placeholder: "./config/appconfig.json",
          helper: "Относительный путь для сохранения."
        }
      ]
    },
    {
      id: "world",
      title: "Мир",
      description: "Сид симуляции и размеры арены.",
      fields: [
        {
          path: "world.seed",
          label: "Seed",
          type: "number",
          min: 0,
          step: 1
        },
        {
          path: "world.bounds.width",
          label: "Ширина (м)",
          type: "number",
          min: 1000,
          max: 5000000,
          step: 100
        },
        {
          path: "world.bounds.height",
          label: "Высота (м)",
          type: "number",
          min: 1000,
          max: 5000000,
          step: 100
        },
        {
          path: "world.environment",
          label: "Тип среды",
          type: "select",
          options: [
            { label: "Вакуум", value: "vacuum" },
            { label: "Атмосфера", value: "atmo" },
            { label: "Нейтральная", value: "neutral" }
          ]
        }
      ]
    },
    {
      id: "physics",
      title: "Физика",
      description: "Скорость света, шаг интегрирования, гравитация.",
      fields: [
        {
          path: "physics.c_mps",
          label: "Скорость света (м/с)",
          type: "number",
          min: 1000,
          max: 299792458,
          step: 100,
          helper: "Влияет на инерцию и визуальные индикаторы.",
          validate(value) {
            if (value < 1000 || value > 299792458) {
              return "Диапазон 1 000…299 792 458 м/с";
            }
            return null;
          }
        },
        {
          path: "physics.dt_sec",
          label: "Δt (сек)",
          type: "number",
          step: 0.0001,
          min: 0.001,
          max: 0.0333
        },
        {
          path: "physics.gravity_mps2",
          label: "Гравитация (м/с²)",
          type: "number",
          step: 0.1,
          min: -50,
          max: 50
        }
      ]
    },
    {
      id: "render",
      title: "Отрисовка",
      description: "Сетка, HUD, визуальные подсказки.",
      fields: [
        {
          path: "render.grid.enabled",
          label: "Показывать сетку",
          type: "switch"
        },
        {
          path: "render.grid.cell",
          label: "Размер ячейки (м)",
          type: "number",
          min: 10,
          max: 2000,
          step: 10
        },
        {
          path: "render.grid.alpha",
          label: "Прозрачность",
          type: "number",
          min: 0.05,
          max: 1,
          step: 0.05
        },
        {
          path: "render.axis",
          label: "Показывать оси",
          type: "switch"
        },
        {
          path: "render.hud",
          label: "HUD поверх сцены",
          type: "switch"
        }
      ]
    },
    {
      id: "hud",
      title: "HUD",
      description: "Локализация и единицы измерения.",
      fields: [
        {
          path: "hud.language",
          label: "Язык",
          type: "select",
          options: [
            { label: "Русский (ru-RU)", value: "ru-RU" },
            { label: "English (en-US)", value: "en-US" }
          ]
        },
        {
          path: "hud.units",
          label: "Единицы",
          type: "select",
          options: [
            { label: "Metric", value: "metric" },
            { label: "Imperial", value: "imperial" }
          ]
        },
        {
          path: "hud.show_debug",
          label: "Отладочные панели",
          type: "switch"
        }
      ]
    },
    {
      id: "input",
      title: "Управление",
      description: "Профиль ввода и бинды.",
      fields: [
        {
          path: "input.profile",
          label: "Профиль",
          type: "select",
          options: [
            { label: "Клавиатура+мышь", value: "kbm" },
            { label: "Геймпад", value: "gamepad" },
            { label: "HOTAS", value: "hotas" }
          ]
        },
        {
          path: "input.invert_y",
          label: "Инвертировать ось Y",
          type: "switch"
        },
        {
          path: "input.bindings",
          label: "Бинды (JSON)",
          type: "textarea",
          helper: "Пары команда→кнопка. Храним как JSON.",
          serialize(value) {
            return JSON.stringify(value, null, 2);
          },
          deserialize(value) {
            try {
              return JSON.parse(value);
            } catch {
              throw new Error("Некорректный JSON биндов");
            }
          }
        }
      ]
    },
    {
      id: "collision",
      title: "Столкновения",
      description: "Режим проверок и отладка.",
      fields: [
        {
          path: "collision.mode",
          label: "Режим",
          type: "select",
          options: [
            { label: "AABB", value: "AABB" },
            { label: "Alpha mask", value: "ALPHA" }
          ]
        },
        {
          path: "collision.debug",
          label: "Показать hitbox",
          type: "switch"
        }
      ]
    },
    {
      id: "asteroids",
      title: "Астероиды",
      description: "Поле препятствий.",
      fields: [
        {
          path: "asteroids.enabled",
          label: "Включить генератор",
          type: "switch"
        },
        {
          path: "asteroids.count",
          label: "Количество",
          type: "number",
          min: 0,
          max: 5000,
          step: 50
        },
        {
          path: "asteroids.density",
          label: "Плотность",
          type: "number",
          min: 0,
          max: 1,
          step: 0.05
        },
        {
          path: "asteroids.radius_min",
          label: "Мин. радиус (м)",
          type: "number",
          min: 1,
          step: 1
        },
        {
          path: "asteroids.radius_max",
          label: "Макс. радиус (м)",
          type: "number",
          min: 1,
          step: 1,
          validate(value, config) {
            if (value < config.asteroids.radius_min) {
              return "Макс. радиус должен быть ≥ мин.";
            }
            return null;
          }
        }
      ]
    },
    {
      id: "autopilot",
      title: "Автопилот",
      description: "Параметры Coupled/Decoupled.",
      fields: [
        {
          path: "autopilot.coupled",
          label: "Включать Coupled",
          type: "switch"
        },
        {
          path: "autopilot.dampeners",
          label: "Иннерциальные демпферы",
          type: "switch"
        },
        {
          path: "autopilot.default_speed_limit",
          label: "Лимит скорости (м/с)",
          type: "number",
          min: 50,
          max: 2000,
          step: 10
        }
      ]
    },
    {
      id: "debug",
      title: "Отладка",
      description: "Логи и сервисные маркеры.",
      fields: [
        {
          path: "debug.logging",
          label: "Вести лог в консоль",
          type: "switch"
        },
        {
          path: "debug.probes",
          label: "Показывать пробы",
          type: "switch"
        }
      ]
    }
    ];
  }

  const state = {
    config: clone(DEFAULT_CONFIG),
    selectedSection: SECTION_DEFS[0].id,
    autosaveTimer: null,
    dirty: false,
    lastSaved: null
  };

  const dom = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheDom();
    attachActionHandlers();
    loadFromStorage();
    renderSidebar();
    renderSection(state.selectedSection);
    updateSummary();
    renderPreview();
    updateStatusLine();
  }

  function cacheDom() {
    dom.nav = document.getElementById("sectionNav");
    dom.formContainer = document.getElementById("formContainer");
    dom.previewCanvas = document.getElementById("previewCanvas");
    dom.summaryGrid = document.getElementById("previewSummary");
    dom.status = document.getElementById("statusLine");
    dom.toast = document.getElementById("toast");
    dom.importInput = document.getElementById("importAppConfig");
    dom.btnSave = document.querySelector('[data-action="save"]');
    dom.btnExport = document.querySelector('[data-action="export"]');
    dom.btnResetSection = document.querySelector('[data-action="reset-section"]');
    dom.btnResetAll = document.querySelector('[data-action="reset-all"]');
    dom.btnLaunch = document.querySelector('[data-action="launch"]');
  }

  function attachActionHandlers() {
    dom.importInput?.addEventListener("change", handleImport);
    dom.btnSave?.addEventListener("click", () => {
      persistToStorage();
      showToast("Сохранено в localStorage");
    });
    dom.btnExport?.addEventListener("click", () => {
      downloadJson(state.config, "u2-appconfig.json");
      showToast("JSON выгружен");
    });
    dom.btnResetSection?.addEventListener("click", resetCurrentSection);
    dom.btnResetAll?.addEventListener("click", () => {
      state.config = clone(DEFAULT_CONFIG);
      state.dirty = true;
      state.selectedSection = SECTION_DEFS[0].id;
      renderSection(state.selectedSection);
      updateSummary();
      renderPreview();
      scheduleAutosave();
      showToast("Сброшены все настройки");
    });
    dom.btnLaunch?.addEventListener("click", () => {
      downloadJson(state.config, `u2-flight-test-appconfig-${Date.now()}.json`);
      showToast("AppConfig готов для Flight Test");
    });
  }

  function renderSidebar() {
    if (!dom.nav) return;
    dom.nav.innerHTML = "";
    SECTION_DEFS.forEach((section) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "section-link";
      if (section.id === state.selectedSection) {
        button.classList.add("is-active");
      }
      button.innerHTML = `${section.title}<span>${section.description}</span>`;
      button.addEventListener("click", () => {
        state.selectedSection = section.id;
        renderSection(section.id);
        dom.nav.querySelectorAll(".section-link").forEach((btn) =>
          btn.classList.toggle("is-active", btn === button)
        );
      });
      dom.nav.appendChild(button);
    });
  }

  function renderSection(sectionId) {
    if (!dom.formContainer) return;
    const section = SECTION_DEFS.find((item) => item.id === sectionId) || SECTION_DEFS[0];
    dom.formContainer.innerHTML = "";

    const header = document.createElement("div");
    header.className = "section-header";
    header.innerHTML = `<h2>${section.title}</h2><p>${section.description}</p>`;
    dom.formContainer.appendChild(header);

    const grid = document.createElement("div");
    grid.className = "fields-grid";
    section.fields.forEach((field) => {
      grid.appendChild(buildField(field));
    });
    dom.formContainer.appendChild(grid);
  }

  function buildField(field) {
    const wrapper = document.createElement("div");
    wrapper.className = "field";
    wrapper.dataset.path = field.path;

    const label = document.createElement("label");
    label.textContent = field.label;
    wrapper.appendChild(label);

    const value = getValue(field.path);
    let control;

    if (field.type === "switch") {
      control = document.createElement("label");
      control.className = "toggle";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = Boolean(value);
      input.addEventListener("change", () => {
        setValue(field, input.checked);
      });
      control.appendChild(input);
      const span = document.createElement("span");
      span.textContent = input.checked ? "Включено" : "Выключено";
      input.addEventListener("change", () => {
        span.textContent = input.checked ? "Включено" : "Выключено";
      });
      control.appendChild(span);
    } else if (field.type === "select") {
      control = document.createElement("select");
      field.options?.forEach((option) => {
        const opt = document.createElement("option");
        opt.value = option.value;
        opt.textContent = option.label;
        if (option.value === value) {
          opt.selected = true;
        }
        control.appendChild(opt);
      });
      control.addEventListener("change", () => {
        setValue(field, control.value);
      });
    } else if (field.type === "textarea") {
      control = document.createElement("textarea");
      control.value =
        typeof field.serialize === "function" ? field.serialize(value) : JSON.stringify(value, null, 2);
      control.addEventListener("change", () => {
        try {
          const parsed =
            typeof field.deserialize === "function" ? field.deserialize(control.value) : control.value;
          setValue(field, parsed);
          setFieldError(wrapper, null);
        } catch (error) {
          setFieldError(wrapper, error.message);
        }
      });
    } else {
      control = document.createElement("input");
      control.type = field.type === "number" ? "number" : "text";
      if (field.placeholder) {
        control.placeholder = field.placeholder;
      }
      if (field.step) control.step = String(field.step);
      if (field.min !== undefined) control.min = String(field.min);
      if (field.max !== undefined) control.max = String(field.max);
      control.value = value ?? "";
      control.addEventListener("input", () => {
        if (field.type === "number" && control.value !== "") {
          control.value = control.value.replace(",", ".");
        }
      });
      control.addEventListener("change", () => {
        const parsedValue =
          field.type === "number" ? parseFloat(control.value || "0") : control.value.trim();
        setValue(field, parsedValue);
      });
    }

    wrapper.appendChild(control);

    if (field.helper) {
      const helper = document.createElement("small");
      helper.textContent = field.helper;
      wrapper.appendChild(helper);
    }

    const errorEl = document.createElement("div");
    errorEl.className = "field-error";
    wrapper.appendChild(errorEl);

    return wrapper;
  }

  function setFieldError(wrapper, message) {
    wrapper.dataset.invalid = message ? "true" : "false";
    const error = wrapper.querySelector(".field-error");
    if (error) {
      error.textContent = message || "";
    }
  }

  function getValue(path) {
    return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), state.config);
  }

  function setValue(field, rawValue) {
    const path = field.path.split(".");
    const config = state.config;
    const lastKey = path.pop();
    const target = path.reduce((acc, key) => {
      if (acc[key] === undefined) {
        acc[key] = {};
      }
      return acc[key];
    }, config);

    let value = rawValue;
    if (field.type === "number") {
      value = Number(rawValue);
      if (Number.isNaN(value)) {
        value = 0;
      }
    }

    const validationMessage =
      typeof field.validate === "function" ? field.validate(value, state.config) : null;
    const fieldNode = dom.formContainer?.querySelector(`[data-path="${field.path}"]`);
    if (validationMessage) {
      if (fieldNode) {
        setFieldError(fieldNode, validationMessage);
      }
      return;
    }
    if (fieldNode) {
      setFieldError(fieldNode, null);
    }

    target[lastKey] = value;
    state.dirty = true;
    updateSummary();
    renderPreview();
    scheduleAutosave();
  }

  function scheduleAutosave() {
    if (state.autosaveTimer) {
      window.clearTimeout(state.autosaveTimer);
    }
    state.autosaveTimer = window.setTimeout(() => {
      persistToStorage();
    }, AUTOSAVE_DELAY);
  }

  function persistToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
      state.lastSaved = new Date();
      state.dirty = false;
      updateStatusLine();
    } catch (error) {
      console.warn("Не удалось записать AppConfig в localStorage", error);
      showToast("Ошибка сохранения в localStorage", true);
    }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state.config = mergeDeep(clone(DEFAULT_CONFIG), JSON.parse(raw));
        state.lastSaved = new Date();
      } else {
        state.config = clone(DEFAULT_CONFIG);
      }
    } catch (error) {
      console.warn("AppConfig поврежден, откат к дефолту", error);
      state.config = clone(DEFAULT_CONFIG);
    }
  }

  function resetCurrentSection() {
    const section = SECTION_DEFS.find((item) => item.id === state.selectedSection);
    if (!section) return;
    section.fields.forEach((field) => {
      const defaultValue = getPath(DEFAULT_CONFIG, field.path);
      setValue(field, clone(defaultValue));
      const control = dom.formContainer?.querySelector(`[data-path="${field.path}"]`);
      if (control) {
        const input = control.querySelector("input, select, textarea");
        if (input) {
          if (input.type === "checkbox") {
            input.checked = Boolean(defaultValue);
          } else if (input.tagName === "SELECT") {
            input.value = defaultValue;
          } else if (input.tagName === "TEXTAREA") {
            input.value =
              typeof field.serialize === "function"
                ? field.serialize(defaultValue)
                : JSON.stringify(defaultValue, null, 2);
          } else {
            input.value = defaultValue ?? "";
          }
        }
      }
    });
    showToast("Раздел сброшен к дефолту");
  }

  function getPath(obj, dotted) {
    return dotted.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj);
  }

  function updateSummary() {
    if (!dom.summaryGrid) return;
    const grid = state.config.render?.grid;
    const ast = state.config.asteroids;
    const physics = state.config.physics;

    dom.summaryGrid.innerHTML = "";
    appendSummary("Сетка", grid?.enabled ? `включена, ${grid.cell} м` : "выключена");
    appendSummary("Астероиды", ast?.enabled ? `${ast.count} шт · dens ${ast.density}` : "выключены");
    appendSummary("c (м/с)", formatNumber(physics?.c_mps || 0), physics?.c_mps > 50000 ? "warn" : "");
    appendSummary("ENV", state.config.world?.environment || "—");
  }

  function appendSummary(label, value, variant) {
    const item = document.createElement("div");
    item.className = "summary-chip";
    if (variant) {
      item.dataset.variant = variant;
    }
    item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    dom.summaryGrid.appendChild(item);
  }

  function renderPreview() {
    const canvas = dom.previewCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#03050d";
    ctx.fillRect(0, 0, width, height);

    const grid = state.config.render?.grid;
    if (grid?.enabled) {
      const cellPx = clamp((grid.cell || 100) / 5, 8, 80);
      ctx.strokeStyle = `rgba(142, 242, 255, ${grid.alpha ?? 0.2})`;
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += cellPx) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += cellPx) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    }

    const ast = state.config.asteroids;
    if (ast?.enabled) {
      const rng = createRng(state.config.world?.seed || 1);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      const count = Math.min(200, ast.count || 0);
      for (let i = 0; i < count; i += 1) {
        const x = rng() * width;
        const y = rng() * height;
        const radius = clamp(ast.radius_min + rng() * (ast.radius_max - ast.radius_min), 2, 16);
        ctx.beginPath();
        ctx.arc(x, y, radius / 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (state.config.render?.axis) {
      ctx.strokeStyle = "rgba(255, 93, 122, 0.8)";
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();
      ctx.strokeStyle = "rgba(111, 244, 193, 0.8)";
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    }

    ctx.fillStyle = "#8ef2ff";
    ctx.font = "14px 'Inter', sans-serif";
    ctx.fillText(`c = ${formatNumber(state.config.physics?.c_mps || 0)} м/с`, 12, height - 16);
  }

  function createRng(seed) {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return function () {
      value = (value * 16807) % 2147483647;
      return (value - 1) / 2147483646;
    };
  }

  function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        state.config = mergeDeep(clone(DEFAULT_CONFIG), json);
        renderSection(state.selectedSection);
        updateSummary();
        renderPreview();
        persistToStorage();
        showToast("AppConfig импортирован");
      } catch (error) {
        console.error(error);
        showToast("Не удалось импортировать JSON", true);
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function showToast(message, isError) {
    if (!dom.toast) return;
    dom.toast.textContent = message;
    dom.toast.dataset.variant = isError ? "error" : "ok";
    dom.toast.hidden = false;
    window.setTimeout(() => {
      dom.toast.hidden = true;
    }, 3200);
  }

  function updateStatusLine() {
    if (!dom.status) return;
    const timestamp = state.lastSaved
      ? state.lastSaved.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      : "—:—";
    dom.status.innerHTML = `Автосохранение каждую секунду · Последнее сохранение: <strong>${timestamp}</strong>`;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("ru-RU", {
      maximumFractionDigits: value >= 1000 ? 0 : 1
    });
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }
})();
