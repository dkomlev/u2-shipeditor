# U2 Ship Editor

Веб‑инструменты для проектирования и тестирования кораблей U2 (ShipConfig / FlightTest / Pilot Assist).

*Текущая версия инструментов:* **v0.7.5** (см. `package.json`)  
*Версия схемы ShipConfig:* **v0.6.x** (`config/shipconfig.schema.json`)  
*Номиналы для баланса:* **U2_Nominals_v0.7.4_decoupled** (`docs/U2_Nominals_v0.7.4_decoupled.*`)

Онлайн‑версия доступна по адресу: **https://u2game.space**

## Быстрый старт (локально)

### Вариант 1: только открыть редактор

1. Клонировать репозиторий или скачать архив проекта.
2. Запустить любой простой HTTP‑сервер в корне репозитория.
3. Открыть в браузере нужную страницу, например `http://localhost:8080/index.html`.

Примеры команд для статического сервера:

```bash
# Python 3
python -m http.server 8080

# Node.js (если установлен http-server)
npx http-server -p 8080
```

### Вариант 2: установка зависимостей и тесты

```bash
npm install
npm test        # быстрый smoke‑тест схемы ShipConfig
npm run build   # обновить build‑info и manifest
```

Node.js используется только для тестов и вспомогательных скриптов; сам редактор работает как обычное статическое веб‑приложение.

## Основные страницы

| Файл                  | Назначение |
|-----------------------|-----------|
| `index.html`          | Главная страница Ship Editor: выбор и загрузка конфигов кораблей, базовая работа с ShipConfig. |
| `ship-architect.html` | Расширенный конструктор ShipConfig v0.6: автоматические рекомендации, номиналы, проверка целостности конфигурации. |
| `app-config.html`     | Редактор AppConfig: настройки пресетов, номиналов и параметров приложения для внешних инструментов. |
| `flight-test.html`    | Песочница FlightTest: визуальный тест полётной модели и настроек Pilot Assist. |
| `sim-demo.html`       | Небольшое демо симулятора, использующее то же физическое ядро, что и FlightTest. |

## Структура репозитория

Упрощённый обзор основных директорий:

```text
u2-shipeditor/
  index.html              # Ship Editor (домашняя страница)
  ship-architect.html     # конструктор ShipConfig
  app-config.html         # редактор AppConfig
  flight-test.html        # песочница FlightTest
  sim-demo.html           # демо симуляции

  js/                     # основной клиентский код
    app.js                # логика Ship Architect
    home.js               # логика главной страницы / загрузка конфигов
    app-config.js         # логика редактора AppConfig
    schema.js             # константы и перечисления ShipConfig
    presets.js            # пресеты и архетипы
    nominals.js           # номиналы баланса
    validator.js          # валидация и подбор размеров
    migrate.js            # миграция ShipConfig v0.5.3 → v0.6
    lib/                  # переиспользуемые модули (ship-adapter, appconfig, loader и др.)
    sim/                  # физика, контроллеры и HUD FlightTest / Pilot Assist

  config/
    shipconfig.schema.json  # JSON Schema для ShipConfig v0.6.x
    u2-appconfig.json       # базовый AppConfig

  configs/                 # примеры конфигов кораблей
  ships/                   # дополнительные наборы конфигов (если присутствуют)
  css/                     # стили приложения
  docs/                    # документация по схеме, физике и т.д.
  tests/                   # модульные тесты симулятора и адаптеров
  test/                    # вспомогательные smoke‑ и совместимые тесты
  scripts/                 # утилиты для пересчёта баланса и обновления данных

  CHANGELOG.md             # история изменений проекта
  README.md                # этот файл
```

## Скрипты npm

- `npm test` — smoke‑тест: проверка, что `buildEmptyConfig()` валидируется против `shipconfig.schema.json`.
- `npm run build` — обновление `build-info.json` и манифеста ресурсов (используется в HTML‑страницах).
- `npm run bump` — инкремент числа сборки в `build-info.json` (служебный скрипт).

## Документация

Более подробное описание проекта и формата ShipConfig см. в каталоге `docs/`:

- `docs/README.md` — навигация по документации (ShipConfig, FlightTest, Pilot Assist, AppConfig и др.).
- `docs/PROJECT_OVERVIEW.md` — общий обзор проекта и основных модулей.
- `docs/ARCHITECTURE.md` — архитектура кода и модулей симуляции.
- `docs/U2_ShipConfig_v0.6.md` — спецификация формата ShipConfig v0.6.x.
- `docs/RELATIVISTIC_PHYSICS.md` и `docs/PHYSICS_CORRECTIONS_REPORT.md` — заметки о физической модели и корректировках.
- `docs/AUDIT_SUMMARY.md`, `docs/AUDIT_RESULTS.md` — результаты предыдущих аудитов кода и документации.

Часть исторических файлов документации пока содержит проблемы с кодировкой (старые версии в CP1251). Новые документы и обновления рекомендуется хранить в UTF‑8.

## Лицензия

Проект распространяется по лицензии MIT (см. `LICENSE`).

## Как помочь проекту

- Сообщайте о багах и несовпадениях документации с текущим поведением симулятора через Issues.
- Предлагайте улучшения формата ShipConfig/AppConfig и интерфейса редактора.
- Помогайте постепенно переводить старые документы и UI‑подсказки в чистый UTF‑8 и актуальное состояние.
