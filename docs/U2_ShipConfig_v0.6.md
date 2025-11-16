# U2 ShipConfig v0.6.3 — структура и проверки

**Версия:** 0.6.3  
**Дата:** 2025‑11‑09  
**Назначение:** единый формат ТТХ корабля для Ship Architect, лаунчера и стенда FlightTest. Документ описывает новую модель «честной» физики: вместо искусственных ограничителей скорости мы задаём реальные тяги, массы и бюджеты RCS. Симулятор рассчитывает ускорения самостоятельно и ограничивает скорость только скоростью света `c`.

---

## 1. Что изменилось по сравнению с 0.6.0

| Область | Изменение |
| --- | --- |
| **Performance** | Поля `scm_mps` и `vmax_mps` удалены. Добавлен блок `performance.accel_profile` с документальными ускорениями по осям. |
| **Propulsion** | Разделён на `main_drive` (макс./длительная тяга, мощность) и `rcs` (бюджеты линейных и угловых ускорений). Эти значения напрямую используются ядром симуляции. |
| **Assist** | Полностью описывает Coupled‑профиль: `handling`, `jerk`, `brake`. Ограничители скорости задаются через `cap_main_coupled` и тягу, а не через «SCM». |
| **Tags / manifest** | Каждый конфиг обязан иметь `tags`. Manifest хранит превью, ускорения, мощность и краткую сводку ассиста, чтобы Ship Picker не открывал JSON. |

---

## 2. Структура JSON

```jsonc
{
  "meta": { "id": "uuid", "name": "Stingray", "version": "0.6.3", "author": "U2 Labs" },
  "classification": {
    "size": "small",
    "type": "fighter",
    "size_type": "small fighter",
    "stealth": "standard",
    "variant": "Block A"
  },
  "geometry": { "length_m": 24, "width_m": 18, "height_m": 6, "hull_radius_m": 15.6 },
  "mass": { "dry_t": 72 },
  "inertia_opt": { "Ixx": null, "Iyy": null, "Izz": null },
  "signatures": { "IR": 3, "EM": 4, "CS": 2 },
  "performance": {
    "accel_profile": {
      "forward_mps2": 78,
      "backward_mps2": 34,
      "lateral_mps2": 52,
      "vertical_mps2": 38
    },
    "angular_dps": { "pitch": 95, "yaw": 82, "roll": 140 },
    "angular_accel_opt": { "pitch": 220, "yaw": 190, "roll": 280 }
  },
  "propulsion": {
    "main_drive": {
      "max_thrust_kN": 5400,
      "sustained_thrust_kN": 3600,
      "max_power_MW": 28
    },
    "rcs": {
      "forward_kN": 1400,
      "backward_kN": 900,
      "lateral_kN": 1600,
      "vertical_kN": 1200,
      "pitch_kNm": 420,
      "yaw_kNm": 390,
      "roll_kNm": 660
    }
  },
  "power_opt": { "reactor_MW": 34, "cooling_MW": 30 },
  "payload": { "cargo_scu": 4, "crew": "1" },
  "hardpoints_opt": { "fixed": [], "gimbals": [], "turrets": [], "missiles": [] },
  "weapons": { "summary": "2×S3 laser, 2×S2 missile rack" },
  "assist": { /* см. §3 */ },
  "tags": ["small","fighter","sport","stealth"],
  "media": { "sprite": { "name": "stingray", "path": "asstets/fighters/stingray.png" } },
  "notes_opt": "Комментарий конструктора",
  "legacy_v053": {}
}
```

### 2.1 Расчёт ускорений

- Симулятор преобразует тягу в ускорение формулой `a = thrust_kN * 1000 / mass_kg`.
- Документальные значения `performance.accel_profile.*` нужны UI и тестам, чтобы обнаруживать регрессии. Они должны совпадать с расчётами от `propulsion`.
- Максимальная скорость ограничена физикой SR в ядре (`|v| < 0.999·c`), поэтому искусственные лимитеры не нужны.

---

## 3. Блок assist

```jsonc
"assist": {
  "preset": "Balanced",
  "handling_style": "Grip",
  "speed_limiter_ratio": 0.82,
  "handling": {
    "stab_gain": 0.8,
    "stab_damping": 1.4,
    "slip_threshold_deg": 5,
    "slip_limit_deg": 10,
    "slip_target_max": 14,
    "slip_correction_gain": 1.4,
    "nose_follow_input": 0.4,
    "anticipation_gain": 0.09,
    "oversteer_bias": -0.1,
    "bias": -0.1,
    "responsiveness": 0.85,
    "traction_control": 0.7,
    "traction_floor": 0.35,
    "traction_speed_ref": 300,
    "cap_main_coupled": 0.82,
    "lat_authority": 0.9,
    "turn_authority": 0.95,
    "turn_assist": 0.3,
    "strafe_to_slip_gain": 0.4,
    "nose_align_gain": 0.3
  },
  "jerk": { "forward_mps3": 150, "lateral_mps3": 120 },
  "brake": { "g_sustain": 5.5, "g_boost": 7.8, "boost_duration_s": 3.2, "boost_cooldown_s": 15 }
}
```

Ключевые требования:

- `handling_style` определяет базовые коэффициенты (Balanced / Grip / Drift). Значения можно перезаписывать, но редактор подсвечивает выход за диапазон.
- Стрейф в Coupled не душится: `lat_authority` ≥ 0.7, `strafe_to_slip_gain` > 0.25 для всех профилей.
- `speed_limiter_ratio` управляет мягким ограничителем только через Pilot Assist (можно оставить `0.8…0.9` или вообще убрать).

---

## 4. Теги и manifest

- Обязательные теги: `size`, `type`.
- Рекомендуемые: геймплейная роль (`sport`, `balanced`, `hauler`, `military`), назначение (`recon`, `courier`, `miner`) и особые режимы (`stealth`, `vtol`).
- Manifest (`ships/manifest.json`) должен содержать:
  - `path`, `name`, `size`, `type`, `tags`, `preview`.
  - `forward_accel_mps2`, `lateral_accel_mps2`, `thrust_to_weight`, `power_MW`.
  - Краткую сводку ассиста: `assist_profile`, `assist_slip_limit_deg`, `assist_speed_limiter_ratio`, `assist_turn_authority`.
  Это позволяет лаунчеру показывать характеристики и профиль ассиста без чтения ShipConfig.

---

## 5. Инварианты и проверки

1. `size_type` синхронизирован с `size` + `type`.
2. Геометрия и масса попадают в коридоры архетипа (см. `docs/U2 — Архетипы кораблей v0.6.3.md`). При отклонении редактор предлагает изменить размер.
3. `propulsion.main_drive.max_thrust_kN / mass_t` ≈ `performance.accel_profile.forward_mps2`.
4. `rcs.forward_kN` ≥ `accel_profile.backward_mps2 * mass_t / 1000`.
5. `assist.brake.g_*` не превышают фактические ускорения (`forward_mps2`).
6. Все числовые поля проходят через схему `js/schema.js` (клампы, типы, единицы).
7. `legacy_v053` присутствует, если нужно сохранить произвольные поля старого формата.

---

## 6. Миграция 0.5.3 → 0.6.3

1. Обновить `meta.version` на `"0.6.3"`.
2. Перенести `mass_t`, `length/width/height`, `SCM/Vmax`, `a_fwd`, `ax/ay/az`, `pitch/yaw/roll` в новые блоки (см. таблицу ниже).
3. Вычислить `propulsion.main_drive.max_thrust_kN = accel_forward_mps2 * mass_t`.
4. Разбить старый `rcs_MN` на отдельные направления (см. архетипы, либо распределить 60/40/30%).
5. Удалить `scm_mps`, `vmax_mps`, `speed_limiter_ratio`.
6. Добавить `tags`, превью и описания.
7. Перегенерировать manifest (скрипт или ручное редактирование).
8. Прогнать `node tests/ship-adapter.test.js`.

| 0.5.3 поле | 0.6.3 поле |
| --- | --- |
| `mass_t` | `mass.dry_t` |
| `length_m`, `width_m`, `height_m` | `geometry.*` |
| `SCM`, `Vmax` | удалены (SR‑физика сама ограничит скорость) |
| `a_fwd`, `ax/ay/az` | `performance.accel_profile.forward/lateral/vertical` |
| `pitch/yaw/roll` | `performance.angular_dps` |
| `thrust_main` | `propulsion.main_drive.max_thrust_kN` |
| `rcs_MN` | `propulsion.rcs.*` |
| `assist.speed_limiter_ratio` | по желанию, но рекомендуется `0.8…0.9` |

---

## 7. Пример минимального конфига

```jsonc
{
  "meta": { "id": "demo", "name": "Demo Ship", "version": "0.6.3" },
  "classification": { "size": "small", "type": "fighter", "size_type": "small fighter", "stealth": "standard" },
  "mass": { "dry_t": 70 },
  "performance": {
    "accel_profile": { "forward_mps2": 70, "backward_mps2": 30, "lateral_mps2": 45, "vertical_mps2": 35 },
    "angular_dps": { "pitch": 90, "yaw": 75, "roll": 130 }
  },
  "propulsion": {
    "main_drive": { "max_thrust_kN": 4900, "sustained_thrust_kN": 3300, "max_power_MW": 24 },
    "rcs": { "forward_kN": 1200, "backward_kN": 800, "lateral_kN": 1500, "vertical_kN": 1100, "pitch_kNm": 380, "yaw_kNm": 360, "roll_kNm": 600 }
  },
  "assist": { "preset": "Balanced" },
  "tags": ["small","fighter","balanced"]
}
```

Этого достаточно, чтобы Ship Architect и симулятор корректно загрузили корабль и автоматически подсказали остальные значения.
