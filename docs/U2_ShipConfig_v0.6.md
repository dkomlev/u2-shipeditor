# U2 ShipConfig v0.6 — формат, архетипы, ассистенты

## Назначение
Единый формат ТТХ корабля для редактора и игры. Включает классификацию по архетипу и параметры ассистентов пилота.

## Классификация
- Размеры: `snub, small, medium, heavy, capital`.
- Типы: `shuttle, fighter, interceptor, gunship, bomber, dropship, courier, freighter, exploration, passenger, miner, tanker, salvager, repair, recon, corvette, frigate, destroyer, carrier, dreadnought`.
- `size_type` = `"<size> <type>"`.
- Режим стелса: `standard|stealth` (recon — всегда `stealth`; bomber/dropship — могут быть `stealth`).

## Структура (ключевые поля)
```json
{
  "meta": { "id": "string", "name": "string", "version": "0.6.x" },
  "classification": {
    "size": "snub|small|medium|heavy|capital",
    "type": "fighter|...|dreadnought",
    "size_type": "small fighter",
    "stealth": "standard|stealth",
    "variant": null
  },
  "geometry": { "length_m": 0, "width_m": 0, "height_m": 0 },
  "mass": { "dry_t": 0 },
  "inertia_opt": { "Ixx": null, "Iyy": null, "Izz": null },
  "signatures": { "IR": 1, "EM": 1, "CS": 1 },
  "performance": {
    "scm_mps": 0, "vmax_mps": 0, "accel_fwd_mps2": 0,
    "strafe_mps2": { "x": 0, "y": 0, "z": 0 },
    "angular_dps": { "pitch": 0, "yaw": 0, "roll": 0 },
    "angular_accel_opt": { "pitch": null, "yaw": null, "roll": null }
  },
  "propulsion": { "main_thrust_MN": 0, "rcs_budget_MN": 0 },
  "power_opt": { "reactor_MW": null, "cooling_MW": null },
  "payload": { "cargo_scu": 0, "crew": "string" },
  "hardpoints_opt": { "fixed": [], "gimbals": [], "turrets": [], "missiles": [] },
  "weapons": { "summary": "string" },
  "assist": {
    "preset": "Balanced|Sport|Rally|Muscle|F1|Industrial|Truck|Warship|Liner|Recon",
    "slip_lim_deg": 0, "stab_gain": 0, "oversteer_bias": 0,
    "cap_main_coupled": 0, "speed_limiter_ratio": 0,
    "brake_g_sustain": 0, "brake_g_boost": 0,
    "boost_duration_s": 0, "boost_cooldown_s": 0
  },
  "notes_opt": ""
}
```

## Инварианты и проверки
- `size_type` синхронизирован с `size` и `type`.
- Геометрия и масса попадают в конверт размеров; при отклонении редактор предупреждает и предлагает изменить размер.
- Пределы ассиста клампятся физикой корабля: `brake_g_*` ≤ `accel_fwd_mps2`, стабилизация ≤ `angular_dps`.
- Номиналы (рекомендуемые ТТХ) подставляются по архетипу и стелсу; разрешена ручная правка.

## Примеры
- `small stealth recon` — Recon, stealth, bearing-control.
- `medium miner` — Industrial, усиленные точные микроманёвры.


## Совместимость с ShipConfig v0.5.3 — сохранение всей информации

Гарантии:
1) **Переименование без потерь.** Старые поля автоматически маппятся на новые имена:
   - `thrust_main` → `propulsion.main_thrust_MN`
   - `rcs_MN` → `propulsion.rcs_budget_MN`
   - `SCM|scm` → `performance.scm_mps`
   - `Vmax|vmax` → `performance.vmax_mps`
   - `a_fwd` → `performance.accel_fwd_mps2`
   - `ax, ay, az` → `performance.strafe_mps2.{x,y,z}`
   - `pitch, yaw, roll` → `performance.angular_dps.{pitch,yaw,roll}`
   - `weapons_summary` → `weapons.summary`
   - `mass_t` → `mass.dry_t`
   - `length_m|width_m|height_m` → `geometry.length_m|width_m|height_m`
   - `IR|EM|CS` → `signatures.IR|EM|CS`
2) **Сумка совместимости.** Любые поля, не распознанные конвертером, помещаются в объект `legacy_v053` на верхнем уровне файла без модификаций. Это гарантирует, что **вся** информация из 0.5.3 присутствует в 0.6.
3) **Обратная выгрузка.** При необходимости `legacy_v053` может использоваться внешними инструментами для реконструкции исходных 0.5.3-файлов.

### Расширение схемы v0.6
В корень добавлен необязательный объект:
```json
{
  "legacy_v053": {}
}
```
Редактор и импортер игнорируют содержимое `legacy_v053` на симуляции, но сохраняют его при экспорте.
