(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.U2AppConfig = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const baseConfig = {
    version: "0.5.3",
    build: "u2-universe-editor",
    paths: {
      ship_config_path: "ships/fighter/small fighter 05-config.json",
      app_config_path: "./config/appconfig.json"
    },
    world: {
      seed: 1337,
      bounds: {
        width: 1000000,
        height: 1000000
      },
      environment: "vacuum"
    },
    physics: {
      c_mps: 10000,
      dt_sec: 0.0166667,
      gravity_mps2: 0
    },
    render: {
      grid: {
        enabled: true,
        cell: 250,
        alpha: 0.25
      },
      axis: true,
      hud: true
    },
    hud: {
      language: "ru-RU",
      units: "metric",
      show_debug: false
    },
    input: {
      profile: "kbm",
      invert_y: false,
      bindings: {
        throttle_up: "W",
        throttle_down: "S",
        strafe_left: "A",
        strafe_right: "D",
        yaw_left: "Q",
        yaw_right: "E",
        brake: "Space",
        toggle_coupled: "C",
        toggle_random_autopilot: "R",
        boost: "LeftShift"
      }
    },
    collision: {
      mode: "AABB",
      debug: false
    },
    asteroids: {
      enabled: true,
      count: 500,
      density: 0.4,
      radius_min: 35,
      radius_max: 120
    },
    autopilot: {
      coupled: true,
      dampeners: true,
      default_speed_limit: 500
    },
    debug: {
      logging: false,
      probes: true
    }
  };

  const SECTION_DEFS = [
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
          helper: "Влияет на инерцию и визуальные индикаторы."
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
          helper: "Пары команда→кнопка. Храним как JSON."
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
          step: 1
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

  const clone =
    typeof structuredClone === "function"
      ? (value) => structuredClone(value)
      : (value) => JSON.parse(JSON.stringify(value));

  function createDefaultConfig() {
    return clone(baseConfig);
  }

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
  }

  function getDefaultValue(path) {
    const parts = path.split(".");
    let value = baseConfig;
    for (const key of parts) {
      if (value == null) {
        return undefined;
      }
      value = value[key];
    }
    return clone(value);
  }

  return {
    SECTION_DEFS,
    createDefaultConfig,
    mergeDeep,
    getDefaultValue,
    clone
  };
});
