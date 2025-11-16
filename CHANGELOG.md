# Changelog

Все значимые изменения в проекте U2 Ship Editor документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
и проект следует [Semantic Versioning](https://semver.org/lang/ru/).

## [Unreleased]

### Документация
- Проведён аудит документации на полноту и согласованность
- Создан README.md в папке docs/ с навигацией
- Создан файл AUDIT_RESULTS.md с результатами аудита
- Удалён дублирующий файл "U2 Архетипы кораблей v0.6.md"
- Добавлен CHANGELOG.md

## [0.6.0] - 2024-2025

### Добавлено
- **ShipConfig v0.6** - новый формат конфигурации кораблей
  - Структурированный формат с секциями meta, classification, geometry, mass, performance
  - Поддержка архетипов (size + type)
  - Система пресетов ассистов (Balanced, Sport, Muscle, Industrial, Truck, Recon и др.)
  - Поддержка режима stealth
  - Номинальные характеристики для всех архетипов
  
- **Редактор кораблей** (ship-architect.html)
  - Визуальное редактирование всех параметров корабля
  - Валидация размеров по архетипу
  - Применение номинальных характеристик
  - Применение пресетов ассистов
  - Экспорт/импорт JSON
  
- **Редактор AppConfig** (app-config.html)
  - Настройка параметров мира (world)
  - Настройка физики (скорость света)
  - Настройка рендеринга (сетка)
  - Настройка астероидов
  - Настройка управления
  
- **Главная страница** (index.html)
  - Выбор корабля из каталога
  - Отображение характеристик
  - Переходы в редакторы
  
- **Модули данных**
  - `js/schema.js` - определения констант и типов
  - `js/presets.js` - данные пресетов
  - `js/nominals.js` - номинальные характеристики архетипов
  - `js/validator.js` - валидация конфигов
  - `js/migrate.js` - миграция v0.5.3 → v0.6
  
- **Конфигурационные файлы**
  - `config/shipconfig.schema.json` - JSON Schema v0.6
  - `config/u2-appconfig.json` - пример AppConfig
  - `configs/small_stealth_recon.json` - пример разведчика
  - `configs/medium_miner.json` - пример майнера

### Изменено
- Переход с ShipConfig v0.5.3 на v0.6
  - Реструктуризация полей
  - Новая система классификации
  - Унификация единиц измерения
  
### Миграция v0.5.3 → v0.6
- Автоматическое переименование полей
  - `mass_t` → `mass.dry_t`
  - `thrust_main` → `propulsion.main_thrust_MN`
  - `SCM/scm` → `performance.scm_mps`
  - `Vmax/vmax` → `performance.vmax_mps`
  - И другие...
- Сохранение legacy-данных в поле `legacy_v053`
- Применение пресетов по архетипу

## [0.5.3] - Предыдущая версия

### Особенности старого формата
- Плоская структура полей
- Отсутствие системы архетипов
- Параметры coupled-режима без именованных пресетов
- Путь к спрайту в `sprite.path`

---

## Соответствие версий документации и реализации

### ShipConfig
- **v0.5.3** - старый формат (поддерживается миграция)
- **v0.6.0** - текущий формат (реализован)

### FlightTest
- **v0.6.3** - только спецификация, НЕ реализовано

### Pilot Assist
- **v0.6.3** - только спецификация, НЕ реализовано

### AppConfig Editor
- **v0.6.3** - частично реализовано (редактор существует)

### Документация
- **v1.0** - текущая версия документации (2025-11-10)

---

## Планируемые версии

### [0.7.0] - Планируется
- [ ] FlightTest - симулятор полёта
- [ ] Pilot Assist - система управления
- [ ] Физический движок с SR-эффектами
- [ ] Canvas-рендеринг
- [ ] Система коллизий
- [ ] Астероиды

### Идеи для будущих версий
- [ ] Редактор спрайтов
- [ ] Библиотека готовых кораблей
- [ ] Экспорт в различные форматы
- [ ] Онлайн-каталог кораблей
- [ ] Мультиплеерный редактор

---

## Семантическое версионирование

Проект следует принципам SemVer:
- **MAJOR** (X.0.0) - несовместимые изменения API/формата
- **MINOR** (0.X.0) - новый функционал с обратной совместимостью
- **PATCH** (0.0.X) - исправление ошибок

### Текущая версия: 0.6.0

- **0** - ранняя разработка, API не стабилизирован
- **6** - шестая минорная версия, добавлены архетипы и пресеты
- **0** - базовая версия без патчей

---

[Unreleased]: https://github.com/dkomlev/u2-shipeditor/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/dkomlev/u2-shipeditor/releases/tag/v0.6.0
[0.5.3]: https://github.com/dkomlev/u2-shipeditor/releases/tag/v0.5.3
# Universe Unlimited - Changelog

## Version 0.7.3 Build 001 (Current)

### Build & Telemetry

- Added `build-info.json` + `js/lib/build-info.js` as the single source of truth for version/build metadata across browser and Node targets.
- New `scripts/bump-build.cjs` hooked into `npm run build` automatically increments the build number (resetting on version bumps) and regenerates the runtime module.
- FlightTest HUD + Diagnostics overlay now read the build label dynamically and update document titles, loading states, and on-screen badges.
- Introduced `npm run bump` helper for ad-hoc build increments when a full manifest rebuild is unnecessary.

### Versioning

- Package version bumped to `0.7.3`; manifests and diagnostics pick up the value from the shared build module.

---

## Version 0.7.2 Build 003

### Physics Improvements

- Refactor: extracted SR helpers to `js/sim/relativity.js`; `core.js` now calls the helpers in both Node and browser.
- Rotation: yaw inertia now scales with γ_rot computed from rim speed v_rim = |ω|·R_yaw; Izz_rel = Izz · γ_rot; numerical guard keeps v_rim < c.
- Diagnostics: `diagnostics/fastest-stand.html` now plots γ_rot and v_rim/c; includes relativity.js.
- Verified linear SR tests pass; rotation change is physically motivated and numerically stable.

**Corrected Relativistic Velocity Calculation**
- Fixed velocity update in `core.js` to use proper Special Relativity formula
- Changed from: `v = p / (γm)` with separate gamma calculation and artificial clamping
- Changed to: `v = p / sqrt(m² + p²/c²)` - mathematically equivalent but more numerically stable
- **Removed artificial velocity clamping** - velocity now naturally stays below c without any hard limits
- Formula ensures v → c as p → ∞ (asymptotic approach), correctly implementing SR physics

**Key Formula:**
```
F = dp/dt  where p = γmv
v = p / sqrt(m² + p²/c²)
γ = sqrt(1 + (p/mc)²)
```

This ensures:
- At low momentum (p << mc): v ≈ p/m (classical Newtonian limit)
- At high momentum (p >> mc): v → c (relativistic limit)
- Velocity never exceeds or equals c for finite momentum
- No artificial speed limiters needed - pure physics!

### Testing
- Added `test/verify-relativity.cjs` - validates SR formula across momentum range
- Verified formula maintains v < c for momenta up to 1000mc
- All physics tests pass ✓

### Files Modified
- `js/sim/core.js` - Lines 95-117: Relativistic velocity calculation
- `flight-test.html` - Lines 128, 167: Version 0.7.2 build 001
- `test/verify-relativity.cjs` - New verification test

---

## Version 0.7.1 Build 006

### Unwanted Precession Fix (Completed in Build 006)
- Fixed ships rotating counter-clockwise with no input
- Modified `solveYawCommand()` in `coupled-controller.js`
- Bias, anticipation, and nose alignment terms now only apply when |turnInput| > 0.05
- Damping term always applies (velocity-based stabilization)
- Ships now remain stable with zero control input ✓

---

## Version 0.7.0

### Major Physics Overhaul
- Implemented full inertia tensor (Ixx, Iyy, Izz) replacing simplified I=k·m
- Removed traction control (arcade simplifications)
- Angular jerk now calculated from RCS characteristics: jerk = (dτ/dt)/I
- Replaced magic constants with physical parameters

### Pilot Assist System
- Removed artificial speed limiters
- Pure Newtonian/relativistic physics with intelligent assistance
- Coupled mode respects ship's technical specifications and physical laws

### Version Display
- App version now visible in FlightTest HUD (bottom-right panel)
- Format: "v0.7.1 build 007"

---

## Design Principles

1. **No Arcade Simplifications** - честная физика (honest physics)
2. **Newtonian + Relativistic** - proper SR for high velocities
3. **No Artificial Limits** - speed limited only by thrust/mass and c
4. **Physical Accuracy** - all parameters derived from ship specifications
5. **Intelligent Assistance** - pilot aids work within physical constraints

