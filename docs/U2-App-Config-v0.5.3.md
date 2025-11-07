# U2 — App Config v0.5.3

# U2 — AppConfig v0.5.3

## 0. Назначение и границы

Этот документ задаёт **каноничную структуру ****app.json** для FlightTest v0.5.3 проекта **U2**: мир, рендер, HUD, управление (клава/тач), коллизии, логирование, отладка и **автопилот Random**. Все ТТХ корабля находятся в **ship.json** (см. «U2 — ТЗ ShipConfig v0.5.3»).

> Конфиги читаются **только при запуске**. Горячая смена корабля и параметров не поддерживается. Сокращение проекта — **U2**.

---

## 1. Топ‑уровень app.json

```javascript
{
  "meta": { "version": "0.5.3", "schema_version": 1 },
  "paths": { "ship_config_path": "./configs/ship_fighter.json" },
  "world": { /* время/пространство/seed */ },
  "render": { /* масштаб/цели производительности/цвета */ },
  "hud": { /* safe area/темы */ },
  "input": { "keys": { }, "touch": { } },
  "collision": { /* AABB/Alpha/оверлей/фоллбек */ },
  "asteroids": { /* генерация/ρ/распределение */ },
  "logging": { /* телеметрия */ },
  "autopilot": { /* Random */ },
  "debug": { /* стенд/оверлеи/прочее */ }
}
```

---

## 2. paths

```javascript
{
  "paths": { "ship_config_path": "./configs/ship_fighter.json" }
}
```

- Абсолютный или относительный путь до ship.json.
- Любые ключи ship.* внутри app.json **игнорируются с лог‑предупреждением** (см. FlightTest §10).

---

## 3. world

```javascript
{
  "world": {
    "tick_rate_hz": 60,
    "c_prime": 1000,
    "bounds_rect_m": { "w": 10000, "h": 10000 },
    "wrap": true,
    "seed": 123456
  }
}
```

- tick_rate_hz — базовый шаг симуляции (СИ).
- c_prime — скорость «медленного света» в м/с (для первых тестов 1000).
- bounds_rect_m — размеры тороидального поля.
- seed — детерминированность генерации.

---

## 4. render

```javascript
{
  "render": {
    "zoom": { "min": 0.5, "max": 3.0, "start": 1.0 },
    "target_fps": 60,
    "background": { "color_rgba": [9, 12, 20, 255] },
    "grid": { "enabled": false, "meters_per_cell": 100 }
  }
}
```

- Масштаб ограничивается [min,max], старт — start.
- grid.enabled полезен для QA, не обязан включаться по умолчанию.

---

## 5. hud

```javascript
{
  "hud": {
    "safe_insets_px": { "top": 12, "bottom": 12, "left": 12, "right": 12 },
    "theme": "dark"
  }
}
```

- Safe area пересчитывается при смене ориентации (см. FlightTest §3).

---

## 6. input.keys (ПК)

```javascript
{
  "input": {
    "keys": {
      "thrust_forward": "W",
      "thrust_backward": "S",
      "strafe_left": "A",
      "strafe_right": "D",
      "turn_left": "Q",
      "turn_right": "E",
      "stop": "Space",
      "coupling_toggle": "C",
      "autopilot_random_toggle": "R",
      "zoom_in": "+",
      "zoom_out": "-",
      "collision_mode_toggle": "F2",
      "collision_overlay_toggle": "F3",
      "screenshot_export": "F12"
    }
  }
}
```

- autopilot_random_toggle = R. По умолчанию **автопилот включён** (см. §10 autopilot). Любой ручной ввод или повторное R отключает.
- **Deprecated в v0.5.3:** randomize и debug.randomize_enabled_default — удалены. Функция «seed++/перегенерация астероидов» не привязана к клавишам.

---

## 7. input.touch (мобайл)

```javascript
{
  "input": {
    "touch": {
      "deadzone_px": 12,
      "stick_radius_px": 96,
      "brake_on_release": false,
      "gestures": { "hold_to_enable_ms": 700, "double_tap_threshold_ms": 250 },
      "layout": {
        "left_stick": { "anchor": "bl", "x_pct": 12, "y_pct": 16 },
        "quick_nose_pad": { "anchor": "br", "x_pct": 12, "y_pct": 18 },
        "brake_button": { "anchor": "tr", "x_pct": 10, "y_pct": 14 },
        "zoom_plus": { "anchor": "tr", "x_pct": 10, "y_pct": 28 },
        "zoom_minus": { "anchor": "tr", "x_pct": 10, "y_pct": 40 }
      }
    }
  }
}
```

- **brake_button** эквивалентна Space (Brake ассист) и **не меняет** Coupled/Decoupled.
- zoom_plus/zoom_minus — изменение масштаба на **10%** диапазона за тап; удержание даёт авто‑повтор ≈100 мс.
- Якоря: bl/br/tl/tr — углы **safe‑area**.

---

## 8. collision

```javascript
{
  "collision": {
    "mode_default": "Alpha",          
    "overlay_visible_default": false,
    "alpha_thr": 20,
    "fallback_threshold": {
      "zoom_min": 0.6,
      "zoom_max": 2.5,
      "on_taint": "AABB"
    }
  }
}
```

- **AABB** понимается как мировая осевая bbox (см. FlightTest §4). При *tainted canvas* (см. глоссарий) — авто‑фоллбек в AABB.

---

## 9. asteroids

```javascript
{
  "asteroids": {
    "coverage_fraction": 0.015,
    "density_kg_m3": 2700,
    "radius_m": { "min": 3.0, "max": 120.0 },
    "distribution": {
      "type": "lognormal",
      "params": { "mu": 2.0, "sigma": 1.1 }
    },
    "margin_m": 50
  }
}
```

- density_kg_m3 — для каменных тел. Радиус меняется после столкновения по формуле FlightTest §6.

---

## 10. autopilot (Random)

```javascript
{
  "autopilot": {
    "random_enabled_default": true,
    "cmd_hold_ms_range": [400, 900],
    "thrust_range": [0.3, 1.0],
    "strafe_probability": 0.45,
    "turn_rate_scale": 1.0
  }
}
```

- При random_enabled_default: true автопилот **активен сразу после старта приложения** и выключается первым ручным вводом или клавишей R.
- Режим автопилота **не изменяет** Coupled/Decoupled, соблюдает SR‑клампы и g‑лимиты корабля.
- Параметры — ориентиры для генерации команд; реализация может менять распределения без изменения интерфейса.

---

## 11. logging

```javascript
{
  "logging": {
    "enabled": true,
    "fields": ["t","x","y","vx","vy","speed","gamma","ax","ay","a_g","theta","omega","zoom","coupled"],
    "filename": "telemetry.log",
    "flush_mode": "on_stop"
  }
}
```

- Единицы измерения — см. FlightTest §8. На Restart добавляется запись текущих флагов (см. FlightTest §7).

---

## 12. debug

```javascript
{
  "debug": {
    "overlay": { "grid_enabled": false, "colors": { "grid": [148,163,184,96] } },
    "spawn": { "safe_radius_m": 50 },
    "benchmark_profile": "i5-8250U"
  }
}
```

- **Нет** randomize_enabled_default (удалено в v0.5.3). Фича «seed++/перегенерация» не привязана к клавишам и не входит в публичный конфиг.

---

## 13. Инварианты и валидация

- Любые ship.* / assist.* / g_limits.* внутри app.json игнорируются и протоколируются как warning.
- render.zoom.min ≤ start ≤ max.
- Для мобайла все layout.*.x_pct/y_pct задаются в процентах **safe‑area**, а не полотна.
- При *tainted canvas* (см. глоссарий) движок обязан перейти в AABB и протоколировать событие в лог отладки.
- По Restart мировое состояние возвращается к начальному, **автопилот** следует autopilot.random_enabled_default (включается заново, если true).

---

## 14. Совместимость с FlightTest/ShipConfig

- Политика ключей и единицы измерения синхронизированы с «U2 — ТЗ FlightTest v0.5.3» (управление, HUD, коллизии, логирование).
- Геометрия/масса/ассисты/лимиты — в «U2 — ТЗ ShipConfig v0.5.3». AppConfig не содержит корабельных ТТХ.

---

## 15. Приложение А — Пресеты (готовые фрагменты)

### A.1 Полный пример app.json

```javascript
{
  "meta": { "version": "0.5.3", "schema_version": 1 },
  "paths": { "ship_config_path": "./configs/ship_fighter.json" },
  "world": { "tick_rate_hz": 60, "c_prime": 1000, "bounds_rect_m": { "w": 10000, "h": 10000 }, "wrap": true, "seed": 123456 },
  "render": { "zoom": { "min": 0.5, "max": 3.0, "start": 1.0 }, "target_fps": 60, "background": { "color_rgba": [9,12,20,255] }, "grid": { "enabled": false, "meters_per_cell": 100 } },
  "hud": { "safe_insets_px": { "top": 12, "bottom": 12, "left": 12, "right": 12 }, "theme": "dark" },
  "input": {
    "keys": { "thrust_forward": "W", "thrust_backward": "S", "strafe_left": "A", "strafe_right": "D", "turn_left": "Q", "turn_right": "E", "stop": "Space", "coupling_toggle": "C", "autopilot_random_toggle": "R", "zoom_in": "+", "zoom_out": "-", "collision_mode_toggle": "F2", "collision_overlay_toggle": "F3", "screenshot_export": "F12" },
    "touch": { "deadzone_px": 12, "stick_radius_px": 96, "brake_on_release": false, "gestures": { "hold_to_enable_ms": 700, "double_tap_threshold_ms": 250 }, "layout": { "left_stick": { "anchor": "bl", "x_pct": 12, "y_pct": 16 }, "quick_nose_pad": { "anchor": "br", "x_pct": 12, "y_pct": 18 }, "brake_button": { "anchor": "tr", "x_pct": 10, "y_pct": 14 }, "zoom_plus": { "anchor": "tr", "x_pct": 10, "y_pct": 28 }, "zoom_minus": { "anchor": "tr", "x_pct": 10, "y_pct": 40 } } }
  },
  "collision": { "mode_default": "Alpha", "overlay_visible_default": false, "alpha_thr": 20, "fallback_threshold": { "zoom_min": 0.6, "zoom_max": 2.5, "on_taint": "AABB" } },
  "asteroids": { "coverage_fraction": 0.015, "density_kg_m3": 2700, "radius_m": { "min": 3.0, "max": 120.0 }, "distribution": { "type": "lognormal", "params": { "mu": 2.0, "sigma": 1.1 } }, "margin_m": 50 },
  "autopilot": { "random_enabled_default": true, "cmd_hold_ms_range": [400, 900], "thrust_range": [0.3, 1.0], "strafe_probability": 0.45, "turn_rate_scale": 1.0 },
  "logging": { "enabled": true, "fields": ["t","x","y","vx","vy","speed","gamma","ax","ay","a_g","theta","omega","zoom","coupled"], "filename": "telemetry.log", "flush_mode": "on_stop" },
  "debug": { "overlay": { "grid_enabled": false, "colors": { "grid": [148,163,184,96] } }, "spawn": { "safe_radius_m": 50 }, "benchmark_profile": "i5-8250U" }
}
```

### A.2 Модульные фрагменты

- input.keys.json

```javascript
{ "thrust_forward": "W", "thrust_backward": "S", "strafe_left": "A", "strafe_right": "D", "turn_left": "Q", "turn_right": "E", "stop": "Space", "coupling_toggle": "C", "autopilot_random_toggle": "R", "zoom_in": "+", "zoom_out": "-", "collision_mode_toggle": "F2", "collision_overlay_toggle": "F3", "screenshot_export": "F12" }
```

- input.touch.json

```javascript
{ "deadzone_px": 12, "stick_radius_px": 96, "brake_on_release": false, "gestures": { "hold_to_enable_ms": 700, "double_tap_threshold_ms": 250 }, "layout": { "left_stick": { "anchor": "bl", "x_pct": 12, "y_pct": 16 }, "quick_nose_pad": { "anchor": "br", "x_pct": 12, "y_pct": 18 }, "brake_button": { "anchor": "tr", "x_pct": 10, "y_pct": 14 }, "zoom_plus": { "anchor": "tr", "x_pct": 10, "y_pct": 28 }, "zoom_minus": { "anchor": "tr", "x_pct": 10, "y_pct": 40 } } }
```

- autopilot.json

```javascript
{ "random_enabled_default": true, "cmd_hold_ms_range": [400, 900], "thrust_range": [0.3, 1.0], "strafe_probability": 0.45, "turn_rate_scale": 1.0 }
```

---

## 16. Совместимость и LEGACY

- Совместим с «U2 — ТЗ FlightTest v0.5.3 (canonical)» и «U2 — ТЗ ShipConfig v0.5.3».
- **LEGACY, не использовать:** любые документы/пресеты, где есть ключ randomize или debug.randomize_enabled_default.


