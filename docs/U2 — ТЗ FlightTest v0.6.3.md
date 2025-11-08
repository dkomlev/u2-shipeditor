# U2 — ТЗ FlightTest v0.6.3

  

# U2 — ТЗ FlightTest v0.6.3

 

## 0. Цель и состав

 

Поведение стенда **FlightTest v0.6.3**: SR‑физика с параметром c из AppConfig, режимы **Coupled/Decoupled** и независимый **Brake**, управление (ПК/мобайл), HUD/логирование, астероиды, коллизии, перезапуск, приёмочные тесты. Конфиги: **AppConfig** — мир/физика/рендер/ввод/коллизии/лог/отладка/пути; **ShipConfig** — ТТХ корабля, ассист (preset), медиа.

 

---

 

## 1. Базис симуляции

 

- Интегратор: semi‑implicit Euler.
- Шаг: dt = 1 / tick_rate_hz (дефолт 60 Гц; может быть явным physics.dt_sec).
- Скорость света: c = physics.c_mps (AppConfig). Ограничение скорости: |v| ≤ 0.999·c.
- Пространство: тороидальные world.bounds с wrap‑around. Единицы: СИ (м, м/с, рад, кг).

 

### 1.1 SR‑клампы (аппроксимация СТО)

 

- Лоренц‑фактор: γ = 1 / sqrt(1 − (|v|/c)^2).
- Продольная компонента: a_fwd_eff = a_fwd/γ^3.
- Поперечная компонента: a_lat_eff = a_lat/γ.
- Итог: a = clamp(thrust/mass, SR_clamps, g_limits, assist_caps).

 

### 1.2 Система координат

 

- Оси: +X вправо, +Y вверх. Угол курса θ от +X против часовой.

 

### 1.3 Инициализация и кросс‑валидация

 

**Порядок загрузки:** (1) AppConfig → зафиксировать c_mps, dt_sec; (2) ShipConfig → маппинг v0.5.3→v0.6; (3) построить runtime‑caps ассистов.

 

**Кросс‑валидация:**

 

- Если performance.vmax_mps > 0.999·c_mps → vmax_runtime := 0.999·c_mps и предупреждение.
- Если assist.speed_limiter_ratio·vmax_mps > 0.999·c_mps → кламп speed_limiter_ratio_runtime.
- Отсутствующие/некорректные assist.* → безопасные дефолты пресета.

 

**Разграничение автопилота и ассиста:** autopilot.enabled_on_start не влияет на выбор Coupled/Decoupled/Brake; автопилот выключается при первом вводе.

 

---

 

## 2. Управление по умолчанию

 

**Дефолты.** Бинды ниже — только значения по умолчанию. Переопределяются AppConfig.input.bindings.

 

### ПК

 

- Поворот: **Q / E**
- Стрейф: **A / D**
- Тяга вперёд/назад: **W / S**
- **Brake**: **Space** (удержание включает, отпускание прерывает)
- **Boost**: **Left Shift** (усиление торможения в Brake)
- Coupled⇄Decoupled: **C**
- Переключить коллизии: **F2** (AABB⇄Alpha)
- Оверлей рамки/маски: **F3**
- Зум: **+ / −**
- Экспорт логов/скриншота: **F12**

 

### Мобайл

 

- Dual‑stick: левый — желаемый вектор скорости (Coupled‑friendly), правый — «квик‑нос».
- Временный Decoupled: удержание «квик‑носа» ≥700 мс; фиксированный — двойной тап.
- **Brake**: отдельная кнопка; удержание — активен; отпускание — прерывание.
- **Boost**: двойной тап по кнопке Brake. Если задан отдельный биндинг Boost — показывать отдельную кнопку Boost.

 

---

 

## 3. Физика корабля

 

### 3.1 Источники данных

 

- **ShipConfig v0.6:** mass.dry_t, performance{scm_mps,vmax_mps,accel_fwd_mps2,strafe_mps2{xyz},angular_dps{pitch,yaw,roll}}, propulsion{main_thrust_MN,rcs_budget_MN}, assist.*, media.sprite.
- **Совместимость v0.5.3:** mass_kg, rcs.*, g_limits.*, assist.coupled_*, sprite.* → маппинг на v0.6.

 

### 3.2 Линейная кинематика

 

- Командное ускорение a_cmd = функция входов пилота + тяг propulsion, с капами: g_limits, **SR‑клампы**, ассист‑кап (в Coupled) или Brake‑кап.

 

### 3.3 Угловая кинематика

 

- Ограничения angular_dps и устойчивость интегратора; мягкие демпферы для предотвращения дрожи на высоких γ.

 

---

 

## 4. Режимы управления и ассист

 

### 4.1 Поля ассиста (ShipConfig v0.6)

 

preset, slip_lim_deg, stab_gain, oversteer_bias, cap_main_coupled, speed_limiter_ratio, brake_g_sustain, brake_g_boost, boost_duration_s, boost_cooldown_s.

 

### 4.2 Состояния

 

- **Coupled**: стабилизация носа к v с stab_gain, ограничение тяги cap_main_coupled, лимитер скорости v_lim = speed_limiter_ratio·vmax_mps.
- **Decoupled**: ориентация независима от v. SR‑ и корабельные кэпы активны.
- **Brake** (независимый): активируется из любого состояния; форсирует торможение поступательного и вращательного движения до порогов ε_v, ε_ω. По завершении возвращает предыдущее состояние; может быть прерван.

 

### 4.3 Алгоритм Brake (с учётом SR)

 

**Хелперы:**

 

```javascript
// deg/s → рад/с² по постоянной времени
angular_dps_to_alpha(dps, time_constant = 0.2) {
  return (dps * Math.PI / 180) / time_constant;
}
// скалярный кламп для 2D
clamp_scalar(x, cap) { return Math.max(-cap, Math.min(cap, x)); }
```

 

**Распределение тяги (приоритеты):** 1) гашение |v| (main‑thrust), 2) гашение |ω| (RCS torque), 3) поперечный слип (RCS linear).

 

```javascript
prev := mode in {Coupled, Decoupled}
mode := Brake
boost := (boost_key || double_tap_brake_mobile) && cooldown_ok

g_target := boost ? assist.brake_g_boost : assist.brake_g_sustain
ax_cap := min(performance.accel_fwd_mps2 / γ^3, g_target*g0)
ay_cap := min(vec2len(performance.strafe_mps2.xy) / γ, g_target*g0)
ω_cap  := angular_dps_to_alpha(angular_dps)

// 1) Продольное торможение (main)
if |v| > ε_v:
  dir_v  := normalize(v)
  a_long := -ax_cap * dot(dir_v, fwd_axis)
  apply_main_thrust(a_long)

// 2) Ротационное гашение (RCS torque)
if |ω| > ε_ω:
  α := -k_ω * clamp_scalar(ω, ω_cap)
  apply_rcs_torque(α)

// 3) Поперечное гашение (RCS linear)
 v_lat := v - dot(v, fwd_axis)*fwd_axis
 if |v_lat| > ε_v:
   dir_lat := normalize(v_lat)
   a_lat   := -min(ay_cap, g_target*g0) * dir_lat
   apply_rcs_linear(a_lat)

// Завершение
if |v|<ε_v && |ω|<ε_ω: mode := prev
```

 

**Edge‑cases:**

 

- Если |v| < 1e-10 → только ротационное гашение.
- Если |ω| < 1e-10 → только линейное гашение.
- Если dot(dir_v, fwd_axis) = NaN → гасить скорость по осям корпуса без проекций.

 

---

 

## 5. Коллизии и визуализация

 

- Модель: **AABB** по умолчанию и **Alpha‑mask**. Переключение — F2. Оверлей — F3.
- Коарс‑фильтр: круг по hull_radius. Пиксель‑перфект: маска alpha_thr.
- Авто‑фоллбек на AABB при экстремальном zoom или CORS‑ошибках.

 

---

 

## 6. Астероиды

 

- Источник: AppConfig.asteroids (enabled, count, radius_min/max, field, density, dist).
- Столкновение: корабль уничтожается; деградация астероида M' = max(M − m_ship, 0), r' = r · (M'/M)^(1/3); при M' ≤ 0 — удаление.

 

---

 

## 7. Перезапуск и смерть

 

- Game Over при столкновении. Restart: позиция/скорость/угол/ω → стартовые. Режимы: **Coupled=ON** (если нет сохранённого явного выбора), **Brake=OFF**.
- Грейс после спавна: spawn_grace_seconds (ShipConfig).
- Лог: collision_mode, overlay_visible, mode{Coupled|Decoupled}, brake_active.

 

---

 

## 8. HUD и телеметрия

 

- HUD: версия, режимы (Coupled/Decoupled, Brake/Boost), |v|, доля |v|/c, γ, |a|/g, ω, масштаб.
- **SR‑индикаторы:**
  - Эффективные кэпы: выводить a_fwd_eff=a_fwd/γ^3, a_lat_eff=a_lat/γ.
  - Плашка **SR ACTIVE** при |v|/c ≥ 0.5.
- Лог (если включено): t,x,y,vx,vy,|v|,|v|/c,gamma,ax,ay,|a|/g,theta,omega,zoom,assist_preset,mode,brake_active.

 

---

 

## 9. Конфигурация (ключи)

 

**AppConfig:** physics{c_mps,dt_sec?,max_time_scale?}, world{seed,bounds}, render{background,grid{enabled,cell,thickness,alpha},sprites{antialias}}, collision{mode,debug_draw}, asteroids{enabled,count,radius_min,max,field{w,h}}, autopilot{enabled_on_start,mode}, input, hud, logging, debug, paths.ship_config_path.

 

**ShipConfig v0.6 (минимум):** mass.dry_t, geometry{length_m,width_m,height_m}, performance{scm_mps,vmax_mps,accel_fwd_mps2,strafe_mps2{xyz},angular_dps{pitch,yaw,roll}}, propulsion{main_thrust_MN,rcs_budget_MN}, assist{...}, media.sprite|sprite.path.

 

**Совместимость v0.5.3 → v0.6:** слой маппинга; при отсутствии g‑лимитов — безопасные дефолты; предупреждения в логе.

 

---

 

## 10. Тест‑набор (приёмка v0.6.3)

 

**FF‑серия:**

 

1. Coupled⇄Decoupled на 0…0.9·c без рывков; HUD корректен.
2. Coupled лимитер: speed_limiter_ratio=0.65 → |v|≤0.65·vmax_mps.
3. Coupled кап тяги: cap_main_coupled=0.4 → a_fwd≤0.4·a_max.
4. Slip‑контроль: средняя ошибка носа к v ≤ slip_lim_deg за 10 с при |v|>SCM.
5. **Brake:** Space → |a|≈brake_g_sustain·g0; Boost (Left Shift) → ≈brake_g_boost·g0 на boost_duration_s с кулдауном; отпускание — возврат в предыдущее состояние.
6. Коллизии: F2 AABB/Alpha; F3 — оверлей; точность соответствует фактам столкновений.
7. Restart: state/режимы/зум сброшены; лог содержит запись.
8. Астероиды: формулы массы/радиуса выполняются; удаление при M'≤0.
9. Мобайл: двойной тап по Brake активирует Boost; при отдельной кнопке Boost — аналогичный эффект.

 

**NP‑серия:**
 10) SR‑клампы при |v|≈0.8·c: проверка a_fwd/γ^3 и a_lat/γ.
 11) Производительность: count≤1000, target_fps=60 → медианный FPS ≥55; инициализация маски 512×512 ≤50 мс.

 

**CX‑серия:**
 12) Порядок загрузки AppConfig→ShipConfig: c_mps применяется до расчёта runtime‑лимитов; vmax_runtime ≤ 0.999·c_mps.
 13) Несогласованный speed_limiter_ratio клампится так, чтобы v_lim ≤ 0.999·c_mps.
 14) Отсутствующие assist.* заполняются дефолтами пресета; генерируются предупреждения.

 

---

 

## 11. Производительность и стабильность

 

- Цель: ≥60 FPS; просадки <50 FPS не длиннее 100 мс подряд.
- «Мёртвые зоны» торможения: ε_v≈0.05 м/с, ε_ω≈0.01 рад/с.
- Диагностика: авто‑фоллбек коллизий, ограничение zoom, предупреждения по CORS.

 

---

 

## 12. Совместимость и границы ответственности

 

- **AppConfig** управляет миром/рендером/вводом/коллизиями/логами/отладкой/путями. Любые ship.* в AppConfig игнорируются с предупреждением.
- **ShipConfig** — ТТХ корабля и ассист. Загрузка v0.5.3 через слой совместимости.
- Канонический раздел SR‑описаний — §1 настоящего ТЗ. Дубли в других документах недопустимы.

 

---

 

## 13. Версионирование

 

Отображать U2 FlightTest v0.6.3.<build> в меню и HUD. Референс для отката — v0.5.3/v0.6.2.

  