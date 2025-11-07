# U2 — ShipConfig v0.5.3

  

# U2 — ShipConfig v0.5.3 (ТЗ + Presets)

 

Единый каноничный файл, который заменяет разрознённые «Тз U2 ShipConfig v0.5» и «U2 ShipConfig Presets v0.5». Содержит:

 

- **ТЗ ShipConfig (v0.5.3)** — правила и структура ship.json;
- **ShipConfig Presets (v0.5.3)** — готовые ships/<class>/*.json.

 

---

 

## 1) ТЗ ShipConfig — v0.5.3

 

### 0. Назначение и область действия

 

Конфиг корабля (ship.json) — **единственный источник правды** по ТТХ: масса, геометрия, спрайт, движители, RCS‑капы, g‑лимиты, ассистенты. Конфиги читаются **только при запуске**. Смена корабля = заменить ship_config_path в AppConfig и перезапустить.

 

### 1. Формат и расположение

 

```javascript
/config/app.json                   # общий конфиг (хранит ship_config_path)
/ships/<class>/<id>.json           # один файл на корабль (пример: ships/fighter/fighter_v01.json)
/assets/ships/...                  # спрайты
```

 

Формат JSON (рекомендуется), UTF‑8.

 

### 2. Жизненный цикл

 

1. Прочитать app.json → ship_config_path.
2. Прочитать ship.json → валидировать → вычислить производные (маска, bbox, Izz если нужно).
3. При ошибке — отказ старта с понятным сообщением; при успехе — лог «эффективных» ТТХ (СИ).

 

### 3. Схема ship.json (ключи)

 

- meta: { id, class, name?, version?, author?, notes? }
- mass: { mass_kg>0, inertia_override?:{Izz_kg_m2≥0}|null }
- geometry: { bbox_m:{ width>0, length>0 }, hull_radius_m?:number|null }
  - Оси для orientation:"nose_right": **length ≡ X (вдоль носа)**, **width ≡ Y (поперёк)**.
- sprite: { path, size_px{w,h}, pivot_px{x,y}, orientation, alpha_thr∈[0..255], m_per_px>0 }
- propulsion: { main_engine_thrust_max_N≥0 }
- rcs: { strafe_thrust_N≥0, turn_alpha_max_radps2>0, turn_omega_max_radps>0 }
- g_limits: профили перегрузок: longitudinal/lateral {sustained_g,burst_g,burst_duration_s,recovery_cooldown_s} + behavior.smoothing_tau_s, blackout_model.
- assist: { coupled_enabled, coupled_omega_cap_radps, coupled_alpha_cap_radps2, coupled_align_gain, coupled_deadzone_deg, autobrake_eps_mps }
- spawn: { spawn_grace_seconds }
- tags: string[]

 

**Инварианты:**

 

- assist.coupled_* ≤ rcs.turn_* (покомпонентно).
- burst_g ≥ sustained_g; burst_duration_s > 0; recovery_cooldown_s ≥ burst_duration_s для обеих осей.
- Применение ускорений: вдоль v → кламп /γ³, поперёк → /γ; итоговое a = min(тяга/м, g‑лимиты).
- tight‑bbox по маске (alpha ≥ alpha_thr) в метрах через m_per_px совпадает с geometry.bbox_m в допуске.

 

### 4. Профили g‑лимитов (ориентиры)

 

| Профиль | Long. sustained / burst (s) | Lat. sustained / burst (s) |
|----|----|----|
| sport | 9g / 12g (2.0s) | 7g / 9g (1.5s) |
| courier | 8g / 11g (1.8s) | 6g / 8g (1.3s) |
| interceptor | 7g / 9g (2.0s) | 5g / 7g (1.5s) |
| fighter | 6g / 8g (2.0s) | 4g / 6g (1.5s) |
| military.medium | 4g / 6g (2.2s) | 3g / 5g (2.0s) |
| military.heavy | 3g / 5g (3.0s) | 2g / 4g (2.5s) |
| freighter | 2.5g / 3.5g (2.5s) | 2.0g / 3.0g (2.0s) |
| passenger | 1.5g / 2.5g (3.0s) | 1.2g / 2.0g (2.0s) |
| drone | 12g / 18g (1.0s) | 9g / 14g (0.8s) |
| Рекомендации ```javascript
behavior.smoothing_tau_s
```: sport≈0.12–0.16; courier≈0.14; interceptor≈0.14–0.18; fighter≈0.15–0.20; military.medium≈0.20–0.22; military.heavy≈0.24–0.30; freighter≈0.24–0.28; passenger≈0.25–0.30; drone≈0.10–0.14. |    |    |

 

### 5. Тесты приёмки (CFG)

 

CFG‑1…CFG‑5 без изменений (валидность путей, инварианты, сверка bbox vs маска, корректность единиц СИ, лог «эффективных» ТТХ).

 

### 6. Версии и совместимость

 

- meta.version — версия файла корабля; сокращение проекта — **U2**.
- Устаревшее propulsion.accel_cap_g поддерживается как fallback, но при наличии g_limits игнорируется с предупреждением.

 

### 7. Контракт совместимости (выжимка)

 

Каноника — в «U2 — ТЗ AppConfig v0.5.3». Коротко: в AppConfig нет ship.*/assist.*/g_limits.*; порог альфы берём из ship.sprite.alpha_thr; горячей смены нет.

 

---

 

## 2) ShipConfig Presets — v0.5.3

 

> Внимание: пример app.json **не дублируется** здесь (см. «U2 — App Config Presets (v0.5.3)»).

 

### ships/fighter/fighter_v01.json

 

```javascript
{
  "meta": { "id": "fighter_v01", "class": "fighter", "name": "U2 Test Fighter", "version": "0.5.3", "author": "U2 Team" },
  "mass": { "mass_kg": 10000, "inertia_override": null },
  "geometry": { "bbox_m": { "width": 25.0, "length": 20.5 }, "hull_radius_m": 16.17 },
  "sprite": { "path": "assets/ships/fighter_top.png", "size_px": { "w": 512, "h": 512 }, "pivot_px": { "x": 256, "y": 256 }, "orientation": "nose_right", "alpha_thr": 16, "m_per_px": 0.05 },
  "propulsion": { "main_engine_thrust_max_N": 1100000 },
  "rcs": { "strafe_thrust_N": 160000, "turn_alpha_max_radps2": 1.8, "turn_omega_max_radps": 2.0 },
  "g_limits": { "profile": "fighter", "longitudinal": { "sustained_g": 6.0, "burst_g": 8.0, "burst_duration_s": 2.0, "recovery_cooldown_s": 5.0 }, "lateral": { "sustained_g": 4.0, "burst_g": 6.0, "burst_duration_s": 1.5, "recovery_cooldown_s": 4.0 }, "behavior": { "smoothing_tau_s": 0.16, "blackout_model": "none" } },
  "assist": { "coupled_enabled": true, "coupled_omega_cap_radps": 1.2, "coupled_alpha_cap_radps2": 0.9, "coupled_align_gain": 0.6, "coupled_deadzone_deg": 3, "autobrake_eps_mps": 0.1 },
  "spawn": { "spawn_grace_seconds": 2.0 },
  "tags": ["fighter", "balanced", "test"]
}
```

 

### ships/courier/courier_v01.json

 

```javascript
{
  "meta": { "id": "courier_v01", "class": "courier", "name": "U2 Courier Mk.I", "version": "0.5.3", "author": "U2 Team" },
  "mass": { "mass_kg": 8000 },
  "geometry": { "bbox_m": { "width": 16.0, "length": 30.0 }, "hull_radius_m": 17.0 },
  "sprite": { "path": "assets/ships/courier_top.png", "size_px": { "w": 512, "h": 512 }, "pivot_px": { "x": 256, "y": 256 }, "orientation": "nose_right", "alpha_thr": 16, "m_per_px": 0.058 },
  "propulsion": { "main_engine_thrust_max_N": 700000 },
  "rcs": { "strafe_thrust_N": 140000, "turn_alpha_max_radps2": 2.0, "turn_omega_max_radps": 2.2 },
  "g_limits": { "profile": "courier", "longitudinal": { "sustained_g": 8.0, "burst_g": 11.0, "burst_duration_s": 1.8, "recovery_cooldown_s": 5.0 }, "lateral": { "sustained_g": 6.0, "burst_g": 8.0, "burst_duration_s": 1.3, "recovery_cooldown_s": 4.0 }, "behavior": { "smoothing_tau_s": 0.14, "blackout_model": "none" } },
  "assist": { "coupled_enabled": true, "coupled_omega_cap_radps": 1.3, "coupled_alpha_cap_radps2": 1.0, "coupled_align_gain": 0.62, "coupled_deadzone_deg": 3, "autobrake_eps_mps": 0.1 },
  "spawn": { "spawn_grace_seconds": 2.0 },
  "tags": ["courier", "fast", "civilian"]
}
```

 

### ships/freighter/freighter_v01.json

 

```javascript
{
  "meta": { "id": "freighter_v01", "class": "freighter", "name": "U2 Heavy Freighter", "version": "0.5.3", "author": "U2 Team" },
  "mass": { "mass_kg": 120000 },
  "geometry": { "bbox_m": { "width": 80.0, "length": 120.0 }, "hull_radius_m": 72.11 },
  "sprite": { "path": "assets/ships/freighter_top.png", "size_px": { "w": 1024, "h": 1024 }, "pivot_px": { "x": 512, "y": 512 }, "orientation": "nose_right", "alpha_thr": 24, "m_per_px": 0.12 },
  "propulsion": { "main_engine_thrust_max_N": 3300000 },
  "rcs": { "strafe_thrust_N": 100000, "turn_alpha_max_radps2": 0.8, "turn_omega_max_radps": 0.9 },
  "g_limits": { "profile": "freighter", "longitudinal": { "sustained_g": 2.5, "burst_g": 3.5, "burst_duration_s": 2.5, "recovery_cooldown_s": 8.0 }, "lateral": { "sustained_g": 2.0, "burst_g": 3.0, "burst_duration_s": 2.0, "recovery_cooldown_s": 6.0 }, "behavior": { "smoothing_tau_s": 0.26, "blackout_model": "none" } },
  "assist": { "coupled_enabled": true, "coupled_omega_cap_radps": 0.7, "coupled_alpha_cap_radps2": 0.5, "coupled_align_gain": 0.7, "coupled_deadzone_deg": 4, "autobrake_eps_mps": 0.1 },
  "spawn": { "spawn_grace_seconds": 2.0 },
  "tags": ["freighter", "cargo", "stable"]
}
```

 

### ships/military/military_medium_v01.json

 

```javascript
{
  "meta": { "id": "military_medium_v01", "class": "military.medium", "name": "U2 Corvette/Frigate", "version": "0.5.3", "author": "U2 Team" },
  "mass": { "mass_kg": 40000 },
  "geometry": { "bbox_m": { "width": 40.0, "length": 60.0 }, "hull_radius_m": 36.06 },
  "sprite": { "path": "assets/ships/military_medium_top.png", "size_px": { "w": 1024, "h": 1024 }, "pivot_px": { "x": 512, "y": 512 }, "orientation": "nose_right", "alpha_thr": 20, "m_per_px": 0.08 },
  "propulsion": { "main_engine_thrust_max_N": 1800000 },
  "rcs": { "strafe_thrust_N": 180000, "turn_alpha_max_radps2": 1.0, "turn_omega_max_radps": 1.2 },
  "g_limits": { "profile": "military.medium", "longitudinal": { "sustained_g": 4.0, "burst_g": 6.0, "burst_duration_s": 2.2, "recovery_cooldown_s": 6.0 }, "lateral": { "sustained_g": 3.0, "burst_g": 5.0, "burst_duration_s": 2.0, "recovery_cooldown_s": 5.0 }, "behavior": { "smoothing_tau_s": 0.21, "blackout_model": "none" } },
  "assist": { "coupled_enabled": true, "coupled_omega_cap_radps": 0.9, "coupled_alpha_cap_radps2": 0.7, "coupled_align_gain": 0.65, "coupled_deadzone_deg": 3, "autobrake_eps_mps": 0.1 },
  "spawn": { "spawn_grace_seconds": 2.0 },
  "tags": ["military", "medium", "crew-safe"]
}
```

 

### ships/military/military_heavy_v01.json

 

```javascript
{
  "meta": { "id": "military_heavy_v01", "class": "military.heavy", "name": "U2 Destroyer/Cruiser", "version": "0.5.3", "author": "U2 Team" },
  "mass": { "mass_kg": 200000 },
  "geometry": { "bbox_m": { "width": 70.0, "length": 110.0 }, "hull_radius_m": 65.19 },
  "sprite": { "path": "assets/ships/military_heavy_top.png", "size_px": { "w": 2048, "h": 2048 }, "pivot_px": { "x": 1024, "y": 1024 }, "orientation": "nose_right", "alpha_thr": 24, "m_per_px": 0.09 },
  "propulsion": { "main_engine_thrust_max_N": 6600000 },
  "rcs": { "strafe_thrust_N": 220000, "turn_alpha_max_radps2": 0.6, "turn_omega_max_radps": 0.8 },
  "g_limits": { "profile": "military.heavy", "longitudinal": { "sustained_g": 3.0, "burst_g": 5.0, "burst_duration_s": 3.0, "recovery_cooldown_s": 9.0 }, "lateral": { "sustained_g": 2.0, "burst_g": 4.0, "burst_duration_s": 2.5, "recovery_cooldown_s": 7.0 }, "behavior": { "smoothing_tau_s": 0.27, "blackout_model": "none" } },
  "assist": { "coupled_enabled": true, "coupled_omega_cap_radps": 0.6, "coupled_alpha_cap_radps2": 0.4, "coupled_align_gain": 0.7, "coupled_deadzone_deg": 4, "autobrake_eps_mps": 0.1 },
  "spawn": { "spawn_grace_seconds": 2.0 },
  "tags": ["military", "heavy", "crew-protect"]
}
```

 

---

 

**Готово.** Этот файл является каноническим источником как для **ТЗ ShipConfig v0.5.3**, так и для **Presets v0.5.3**. Для AppConfig используйте документ **«U2 — App Config Presets (v0.5.3)»**.

  