# U2 — ТЗ Редактор AppConfig v0.6.3

  

# U2 — ТЗ страницы «Редактор AppConfig» v0.6.3

 

## 1. Назначение

 

Единая страница для редактирования настроек симуляции и клиента: мир, отрисовка, HUD, ввод, столкновения, астероиды, автопилот, отладка, пути к ресурсам. Ключевые переключатели: **координатная сетка**, **астероиды**, **скорость света**.

 

## 2. Область действия и версии

 

- Поддерживаем **AppConfig v0.5.3+**. Допускается «расширенный» блок physics без нарушения обратной совместимости.
- Не изменяем формат ShipConfig. В поле paths.ship_config_path только читаем/редактируем путь.

 

## 3. Основные сценарии (MVP)

 

1. Включение/выключение **сетки координат** с Live Preview.
2. Включение/выключение **астероидов** и настройка параметров (количество/радиусы/поле) с предпросмотром.
3. Изменение **скорости света** с подсказками и валидацией. Значение сохраняется в physics.c_mps.
4. Импорт/экспорт AppConfig в JSON, откат к дефолтам, запуск Flight Test.

 

## 4. Архитектура страницы

 

- **Макет:** Sidebar (разделы), центр (форма), правая колонка (Live Preview + сводка).
- **Действия:** Сохранить, Сбросить раздел, Импорт, Экспорт, Поехали! (Flight Test).
- **Автосохранение:** в localStorage раз в 1 с при изменениях; явная кнопка «Сохранить в файл».

 

## 5. Структура AppConfig (v0.5.3+)

 

```javascript
{
  "version": "0.5.3",
  "paths": { "ship_config_path": "string" },
  "world": { "seed": 0, "bounds": {"width": 1000000, "height": 1000000} },
  "physics": { "c_mps": 10000, "dt_sec": 0.0166667, "max_time_scale": 1 },
  "render": { "background": "#000814", "grid": {"enabled": true, "cell": 1000, "thickness": 1, "alpha": 0.15}, "sprites": {"antialias": true} },
  "hud": { "show_fps": true, "show_coords": true, "show_velocity": true },
  "input": { "bindings": { "thrust_fwd": "W", "thrust_back": "S", "strafe_left": "A", "strafe_right": "D", "roll_left": "Q", "roll_right": "E", "brake": "Space", "boost": "LeftShift", "toggle_coupled": "C" }, "mouse_sensitivity": 1.0 },
  "collision": { "mode": "AABB", "debug_draw": false },
  "asteroids": { "enabled": true, "count": 250, "radius_min": 12, "radius_max": 60, "field": {"width": 120000, "height": 120000} },
  "autopilot": { "enabled_on_start": true, "mode": "Random" },
  "logging": {"level": "info"},
  "debug": {"developer_overlays": false}
}
```

 

> Если в существующем AppConfig нет physics, редактор добавляет его при сохранении. Неизвестные поля сохраняются без удаления.

 

## 6. Ключевые параметры и UI‑контролы

 

### 6.1 Скорость света (physics.c_mps)

 

- **Контролы:** числовое поле (м/с), лог‑слайдер, пресеты: 299792458 (реальная), 10000 (игровая), 1000 (экспериментальная).
- **Валидация:** 1000 ≤ c_mps ≤ 299792458.
- **Подсказки:** «макс. скорость < 0.99·c», «учитывать c в оружии и навигации».
- **Предпросмотр:** маркеры 0.1c/0.5c/0.9c, пересчёт γ и vmax_runtime.

 

### 6.2 Координатная сетка (render.grid.enabled)

 

- Тумблер On/Off, параметризация: клетка, толщина, альфа.

 

### 6.3 Астероиды (asteroids.enabled)

 

- Тумблер On/Off; параметры: count, radius_min/max, field; кнопка «Перегенерировать сид»; предупреждение при count>1000.

 

### 6.4 Столкновения (collision.mode)

 

- AABB/ALPHA; ALPHA требует валидные текстуры без CORS.

 

### 6.5 HUD

 

- Переключатели FPS/coords/velocity; предпросмотр иконок.

 

### 6.6 Ввод (input.bindings)

 

- Ребайндинг, сброс. Обязательные команды: thrust_fwd/back, strafe_left/right, roll_left/right, brake, boost, toggle_coupled.
- Дефолты (ПК): Brake=Space, Boost=LeftShift, ToggleCoupled=C.

 

### 6.7 Автопилот (autopilot)

 

- Режимы: Random, Hold, Orbit (цели — в будущих версиях).

 

### 6.8 Пути (paths.ship_config_path)

 

- Выбор файла/пути, проверка доступности.

 

## 7. Live Preview

 

- Мини‑сцена 2D: камера, сетка, точки астероидов, индикатор c и доли c (0.1/0.5/0.9).
- При изменении c_mps — мгновенный пересчёт шкал, γ, отображение vmax_runtime для выбранного ShipConfig (если путь задан и файл загружен).
- Если performance.vmax_mps > 0.999·c_mps, показать предупреждение и vmax_runtime = 0.999·c_mps.

 

## 8. Механика сохранения

 

- **Локально:** буфер в памяти и localStorage.
- **В файл:** экспорт JSON; импорт с валидацией по схеме.
- **Сброс:** дефолты раздела или всего документа.

 

## 9. Схема валидации

 

- physics.c_mps: число, [1e3; 299792458].
- render.grid.cell: целое ≥ 10.
- asteroids.count: целое [0; 5000].
- asteroids.radius_min ≤ radius_max.
- collision.mode ∈ {AABB, ALPHA}.
- input.bindings: все команды назначены; дубли — warning; обязательны brake, boost, toggle_coupled.
- **Кросс‑валидация с ShipConfig (если путь задан):**
  - vmax_runtime = min(performance.vmax_mps, 0.999·physics.c_mps).
  - При клампе — предупреждение.
  - Проверить assist.speed_limiter_ratio · performance.vmax_mps ≤ 0.999·physics.c_mps; иначе предложить авто‑исправление коэффициента.

 

## 10. Запуск Flight Test

 

- Кнопка **«Поехали!»** формирует in‑memory AppConfig и открывает стенд.
- Конфиг передаётся без потери неизвестных полей.

 

## 11. НФ‑требования

 

- Отзывчивость: ≤ 50 мс на изменение любого тумблера.
- Предпросмотр: ≤ 120 FPS при asteroids.count ≤ 1000.
- Доступность: таб‑навигация, контраст ≥ WCAG AA.
- i18n: RU/EN.

 

## 12. Критерии приёмки

 

1. Сетка — работает и сохраняется в render.grid.enabled.
2. Астероиды — управляются тумблером; параметры валидируются и применяются.
3. physics.c_mps — валидируется, подсвечивает SR‑эффекты, сохраняется в JSON.
4. Импорт/экспорт — без потери незнакомых полей.
5. **Поехали!** запускает Flight Test с текущим AppConfig.
6. В input.bindings есть brake, boost, toggle_coupled (Space/LeftShift/C по умолчанию).
7. При заданном пути к ShipConfig предпросмотр выводит vmax_runtime; при клампе — предупреждение.

 

## 13. Версионирование

 

Отображать AppConfig Editor v0.6.3. Референс для отката — предыдущая версия документа.

  