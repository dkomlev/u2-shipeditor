# U2 — ТЗ FlightTest v0.6

  

# U2 — ТЗ FlightTest v0.6

 

## 0. Цель и состав

 

ТЗ фиксирует поведение стенда **FlightTest v0.6**: физика полёта с параметром скорости света из AppConfig, режимы ассистов **Coupled/Decoupled** с пресетами из ShipConfig v0.6, управление (ПК/мобайл), HUD/логирование, астероиды, коллизии, перезапуск, приёмочные тесты. Конфиг‑архитектура раздельная: **AppConfig** (мир/рендер/ввод/коллизии/лог/отладка/пути), **ShipConfig** (ТТХ корабля, ассист, пресет).

 

---

 

## 1. Базис симуляции

 

- Интегратор: semi‑implicit Euler.
- Временной шаг: dt = 1 / tick_rate_hz (дефолт 60 Гц из AppConfig).
- «Медленный свет»: c = physics.c_mps (AppConfig). Ограничение скорости: |v| ≤ 0.999·c.
- Пространство: тороидальная карта world.bounds с wrap‑around. Единицы — СИ: м, м/с, рад, кг.

 

### 1.1 SR‑клампы (приближение СТО)

 

- Лоренц‑фактор: γ = 1 / sqrt(1 − (|v|/c)^2).
- Ослабление ускорений: продольное a_fwd/γ^3, поперечное a_lat/γ.
- Итоговое ускорение по осям: a = clamp_by(thrust/mass, SR_clamps, g_limits, assist_caps).

 

### 1.2 Система координат

 

- Оси: +X вправо, +Y вверх.
- Угол курса θ от +X, CCW положителен. Угловая скорость ω > 0 — CCW.

 

---

 

## 2. Управление по умолчанию

 

### ПК

 

- Поворот: **Q / E**
- Стрейф: **A / D**
- Тяга вперёд/назад: **W / S**
- Brake: **Space**
- Coupled⇄Decoupled: **C**
- Переключить модель коллизий: **F2** (AABB⇄Alpha)
- Показ/скрытие рамки/маски: **F3**
- Зум: **+ / −** (или колёсико)
- Экспорт логов/скриншота: **F12**

 

### Мобайл

 

- Схема **Dual‑stick (Coupled‑friendly)**: левый — «куда и как быстро» (вектор желаемой скорости); правый — «квик‑нос».
- Отпускание левого стика → Brake‑ассист; правый «квик‑нос» отпущен → возврат носа к v в Coupled.
- Временный Decoupled: удержание «квик‑носа» ≥ 700 мс; фиксация Decoupled: двойной тап по «квик‑носу».

 

---

 

## 3. Физика корабля

 

### 3.1 Источники данных

 

- **ShipConfig v0.6:** performance.{scm_mps,vmax_mps,accel_fwd_mps2,strafe_mps2{xyz},angular_dps{pitch,yaw,roll}}, propulsion.{main_thrust_MN,rcs_budget_MN}, mass.dry_t, assist.* (preset).
- **ShipConfig v0.5.3 (совместимость):** читать mass_kg, rcs.*, g_limits.*, assist.coupled_*, sprite.*. При загрузке маппировать на поля v0.6.

 

### 3.2 Линейная кинематика

 

- Командное ускорение a_cmd формируется из входа пилота и тяг propulsion с учётом:
  1. капа на общую продольную перегрузку g_limits или, если нет, assist.brake_g_* при торможении;
  2. **SR‑клампов** (см. §1.1);
  3. режима ассиста (см. §4): лимитер скорости и доля тяги в Coupled.

 

### 3.3 Угловая кинематика

 

- Угловая скорость ограничивается angular_dps и SR‑устойчивостью интегратора. Допустимая угловая перегрузка — по конфигу корабля или безопасным дефолтам.

 

---

 

## 4. Ассист пилота: Coupled / Decoupled (v0.6)

 

### 4.1 Поля ShipConfig v0.6 (assist)

 

- preset: имя пресета (например, Sport, Muscle, Industrial, Recon).
- slip_lim_deg: допустимый скольжений угол между носом и v.
- stab_gain: коэффициент стабилизации носа.
- oversteer_bias: смещение к «перекруту» при наведении цели.
- cap_main_coupled: доля доступной продольной тяги в Coupled (0..1).
- speed_limiter_ratio: лимит |v| в Coupled как доля performance.vmax_mps.
- brake_g_sustain, brake_g_boost, boost_duration_s, boost_cooldown_s — параметры тормозного ассиста и кратковременного буста.

 

### 4.2 Поведение

 

- **Coupled**: ассист старается выровнять нос к v с stab_gain, соблюдая slip_lim_deg. Продольная тяга ограничена cap_main_coupled; целевая скорость ограничена v_lim = speed_limiter_ratio · vmax_mps. При Brake действует brake_g_sustain, по нажатию Boost — временно brake_g_boost на boost_duration_s с кулдауном.
- **Decoupled**: нос управляется независимо от v. Тяговые/угловые капы корабля и SR‑ограничения остаются активны. Возврат в Coupled не должен давать рывков.

 

---

 

## 5. Коллизии и визуализация

 

- Модель: **AABB (дефолт)** и **Alpha‑mask**. Переключение — F2. Оверлей рамки/маски — F3.
- Коарс‑фильтр: круг по hull_radius.
- Пиксель‑перфект: маска по alpha_thr спрайта.
- Авто‑фоллбек на AABB при экстремальном zoom или «tainted canvas».

 

---

 

## 6. Астероиды

 

- Источник: AppConfig asteroids (enabled, count/coverage, r_min/r_max, плотность, распределение, margin).
- Столкновение: корабль уничтожается; масса астероида M' = max(M − m_ship, 0), радиус r' = r · (M'/M)^(1/3); при M' ≤ 0 астероид удаляется.

 

---

 

## 7. Перезапуск и смерть

 

- Game Over при столкновении. Restart возвращает state к началу: позиция/скорость/угол/ω, режимы по умолчанию: **Coupled=ON**, коллизии=AABB, оверлей скрыт, зум=стартовый.
- Грейс после спавна: spawn_grace_seconds из ShipConfig.
- Логировать момент Restart: collision_mode, overlay_visible, coupled.

 

---

 

## 8. HUD и телеметрия

 

- HUD: версия, режимы (Coupled/Decoupled, Brake/Boost), скорость |v| и доля |v|/c, γ, |a|/g, ω, масштаб.
- Телеметрия/лог (если включено): t,x,y,vx,vy,|v|,|v|/c,gamma,ax,ay,|a|/g,theta,omega,zoom,assist_preset,coupled.
- Единицы: СИ. g0 = 9.80665 м/с².

 

---

 

## 9. Конфигурация (ключи v0.6)

 

### AppConfig

 

- physics: { c_mps:number, dt_sec?, max_time_scale? }.
- world: { seed, bounds{width,height} }.
- render: { background, grid{enabled,cell,thickness,alpha}, sprites{antialias} }.
- collision: { mode: "AABB"|"ALPHA", debug_draw }.
- asteroids: { enabled, count|coverage_fraction, radius_min, radius_max, field{w,h}, density_kg_m3, radius_dist, radius_dist_params, margin_m }.
- autopilot: { enabled_on_start, mode: "Random"|"Hold"|"Orbit" }.
- input, hud, logging, debug, paths.ship_config_path — без изменений по смыслу.

 

### ShipConfig v0.6 (минимум для стенда)

 

- mass.dry_t, geometry{length_m,width_m,height_m}, performance{scm_mps,vmax_mps,accel_fwd_mps2,strafe_mps2{xyz},angular_dps{pitch,yaw,roll}}.
- propulsion{main_thrust_MN,rcs_budget_MN}.
- assist{preset,slip_lim_deg,stab_gain,oversteer_bias,cap_main_coupled,speed_limiter_ratio,brake_g_sustain,brake_g_boost,boost_duration_s,boost_cooldown_s}.
- media.sprite или sprite.path (совместимость).

 

### Совместимость v0.5.3 → v0.6

 

- Если загружен старый ship.json, применить маппинг полей на performance и assist v0.6. При отсутствии явных g‑лимитов — использовать безопасные дефолты и assist.brake_g_* для торможения.

 

---

 

## 10. Тест‑набор (приёмка v0.6)

 

**FF‑серия (функциональные):**

 

1. Переключение Coupled⇄Decoupled на 0…0.9·c без рывков; HUD отражает режим.
2. Лимитер скорости в Coupled: при speed_limiter_ratio=0.65 корабль не превышает 0.65·vmax_mps при удержании W.
3. Кап продольной тяги в Coupled: при cap_main_coupled=0.4 ускорение вперёд ≤ 40% от доступного.
4. Slip‑контроль: средняя угловая ошибка носа к v ≤ slip_lim_deg на интервале 10 с при |v|>SCM.
5. Brake/Boost: удержание Brake даёт |a|≈brake_g_sustain·g0, нажатие Boost — ≈brake_g_boost·g0 в течение boost_duration_s c кулдауном.
6. Коллизии: F2 переключает AABB/Alpha; F3 — оверлей маски; поведение соответствует факту столкновений.
7. Restart: state/режимы/зум сбрасываются к дефолту; лог содержит запись.
8. Астероиды: формулы массы/радиуса выполняются; удаление при M'≤0.

 

**NP‑серия (численные):**
 9. SR‑клампы: при |v|≈0.8·c проверка a_fwd/γ^3 и a_lat/γ.
 10. Производительность: при count≤1000, target_fps=60 медианный FPS ≥55; инициализация маски 512×512 ≤50 мс.

 

---

 

## 11. Производительность и стабильность

 

- Цель: ≥60 FPS; просадки ниже 50 FPS не дольше 100 мс подряд на эталонном пресете.
- При Brake — «мёртвые зоны»: ε_v≈0.05 м/с, ε_ω≈0.01 рад/с.
- Диагностика: авто‑фоллбек коллизий, ограничение zoom, предупреждения по CORS.

 

---

 

## 12. Совместимость и границы ответственности

 

- Все ключи мира/рендера/ввода/коллизий/логов/отладки — **AppConfig**; любые ship.* в AppConfig игнорируются с предупреждением.
- Все ТТХ корабля и ассист — **ShipConfig**. При загрузке v0.5.3 применяется слой совместимости в рантайме.

 

---

 

## 13. Версионирование

 

U2 FlightTest v0.6.<build> — отображать в меню и HUD. Стабильный референс отката — v0.5.3.

  


