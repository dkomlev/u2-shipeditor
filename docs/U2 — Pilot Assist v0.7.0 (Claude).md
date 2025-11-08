# U2 — Pilot Assist v0.7.0 (Claude)

  

# U2 — Pilot Assist v0.7.0

 

## 0. Назначение и границы

 

Модуль управления кораблём, отвечающий за режимы **Coupled**, **Decoupled** и независимый **Brake**, стабилизацию, лимит скорости, распределение тяги и RCS. Модуль **не реализует SR‑физику** и интегрирование движения — это канонично в FlightTest (§1). Pilot Assist выдаёт команды ускорений/моментов в рамках рантайм‑кэпов, предоставляемых движком.

 

**v0.7 изменения:** Параметризуемое поведение Coupled режима через характеристики управляемости (handling characteristics) — от агрессивного drift-стиля истребителей до стабильного grip-стиля гоночных кораблей.

 

---

 

## 1. Контракты и интерфейсы

 

### 1.1 Вход (из FlightTest и AppConfig)

 

- dt_sec — шаг симуляции.
- Кинематика: pos{x,y}, vel{vx,vy}, speed=|v|, theta, omega.
- Оси корпуса: fwd_axis, right_axis.
- Ввод пилота (с учётом AppConfig.input.bindings): 
  - ПК: каналы thrust/strafe/turn; кнопки toggle_coupled, brake, boost.
  - Мобайл: v_cmd_2d (левый стик), aim_axis (правый), кнопки brake, boost.
- Рантайм‑кэпы от движка (с учётом SR и конфигов): 
  - caps.long_mps2, caps.lat_mps2, caps.ang_radps2.
  - caps.vmax_runtime (≤ 0.999·c).
- Из AppConfig: physics.c_mps (для HUD/лимитера), отладочные флаги.

 

### 1.2 Вход (из ShipConfig v0.7)

 

- performance: scm_mps, vmax_mps, accel_fwd_mps2, strafe_mps2{xyz}, angular_dps{pitch,yaw,roll}.
- propulsion: main_thrust_MN, rcs_budget_MN.
- **assist** (см. §2): пресет, handling_style и параметры управляемости.

 

### 1.3 Выход (в FlightTest)

 

- Команды ускорений в СК корпуса: a_body = {ax_fwd, ay_right} (м/с²), alpha (рад/с²).
- Флаги/состояния: mode ∈ {Coupled, Decoupled}, brake_active, boost_active.
- Индикаторы HUD: limiter_active, slip_deg, handling_mode, stab_gain_eff.

 

---

 

## 2. Поля ShipConfig.assist (v0.7)

 

```javascript
// Базовые параметры
preset: "Sport"|"Muscle"|"Industrial"|"Recon"
speed_limiter_ratio: 0..1      // лимит скорости как доля performance.vmax_mps

// === НОВОЕ В v0.7: Handling Characteristics ===
handling_style: "Drift"|"Balanced"|"Grip"

// Параметры управляемости Coupled режима
handling: {
  // Стабилизация носа
  stab_gain: number           // базовая скорость возврата носа (0.3-1.5)
  stab_damping: number        // демпфирование вращения (0.5-3.0)
  
  // Контроль скольжения
  slip_threshold_deg: number  // начало активной коррекции (5-20°)
  slip_limit_deg: number      // критический угол (8-30°)
  slip_correction_gain: number // агрессивность гашения скольжения (0.1-2.0)
  
  // Распределение управления
  nose_follow_input: 0..1     // 0=нос к vel, 1=нос к v_cmd
  anticipation_gain: 0..1     // упреждающий поворот носа (0-0.5)
  oversteer_bias: number      // тенденция к избыточной поворачиваемости (-0.3..0.3)
  
  // Ограничения тяги
  cap_main_coupled: 0..1      // доля продольной тяги в Coupled
  lat_authority: 0..1         // доля поперечной тяги для коррекции (0.5-1.0)
}

// Торможение
brake: {
  g_sustain: number           // g-лимит устойчивого торможения
  g_boost: number             // g-лимит буста торможения
  boost_duration_s: number
  boost_cooldown_s: number
}
```

 

---

 

## 3. Машина состояний

 

- **Coupled** ↔ **Decoupled**: по toggle_coupled.
- **Brake** — независимый режим: 
  - Вход: удержание brake (ПК) или кнопка Brake (мобайл).
  - Выход: отпускание brake или достижение порогов ε_v, ε_ω → возврат в предыдущее состояние.
  - boost: ПК — boost (дефолт Left Shift); мобайл — двойной тап по Brake или отдельная кнопка Boost.
- Таймеры: boost_active ∈ [0; boost_duration_s] с паузой boost_cooldown_s.

 

---

 

## 4. Алгоритмы

 

### 4.1 Общие помощники

 

```javascript
// Константы
ε_v = 0.05      // м/с, порог нулевой скорости
ε_ω = 0.01      // рад/с, порог нулевой угловой скорости
g0 = 9.81       // м/с², стандартное ускорение

// Лимит скорости
v_lim = min(assist.speed_limiter_ratio * performance.vmax_mps, caps.vmax_runtime)

// Угол скольжения (slip angle)
slip_deg = |v| > ε_v ? angle_between(fwd_axis, normalize(vel)) : 0

// Нормализация угла к [-π, π]
normalize_angle(a) = atan2(sin(a), cos(a))

// PD-регулятор угла с ограничением
function align_pd(current_angle, target_angle, omega, kp, kd, max_alpha) {
  error = normalize_angle(target_angle - current_angle)
  alpha_p = kp * error
  alpha_d = -kd * omega
  return clamp(alpha_p + alpha_d, -max_alpha, max_alpha)
}
```

 

### 4.2 Coupled (НОВАЯ ЛОГИКА v0.7)

 

Режим Coupled адаптируется под handling_style корабля через параметры в handling.*.

 

#### Фаза 1: Целеполагание

 

```javascript
// 1. Формирование желаемой скорости из ввода
// ПК: thrust/strafe → v_cmd; Мобайл: левый стик → v_cmd
v_cmd = get_pilot_velocity_command()  // из ввода
v_cmd_mag = min(|v_cmd|, v_lim)
v_cmd_dir = |v_cmd| > ε_v ? normalize(v_cmd) : fwd_axis

// 2. Определение целевого направления носа (КЛЮЧЕВАЯ ЛОГИКА)
if (|vel| < ε_v) {
  // Стоим на месте - нос к команде
  target_nose_dir = v_cmd_dir
  slip_deg = 0
} else {
  // Интерполяция между vel и v_cmd
  vel_dir = normalize(vel)
  
  // nose_follow_input: 0=нос всегда к vel, 1=нос всегда к v_cmd
  base_target = slerp(vel_dir, v_cmd_dir, handling.nose_follow_input)
  
  // Добавляем упреждение (anticipation) при активном вводе
  if (|v_cmd| > ε_v && dot(v_cmd_dir, vel_dir) > 0.5) {
    // Пилот активно маневрирует в согласованном направлении
    turn_intent = cross_2d(vel_dir, v_cmd_dir)  // скаляр, направление поворота
    anticipation_angle = handling.anticipation_gain * turn_intent * dt_sec
    target_nose_dir = rotate(base_target, anticipation_angle)
  } else {
    target_nose_dir = base_target
  }
  
  // Вычисляем скольжение
  slip_deg = angle_between(fwd_axis, vel_dir) * sign(dot(right_axis, vel_dir))
}
```

 

#### Фаза 2: Контроль скольжения

 

```javascript
// Адаптивная стабилизация в зависимости от slip
abs_slip = abs(slip_deg)

if (abs_slip < handling.slip_threshold_deg) {
  // === ЗОНА СВОБОДНОГО УПРАВЛЕНИЯ ===
  // Минимальная коррекция, позволяем drift
  stab_gain_eff = handling.stab_gain * 0.8
  slip_correction_factor = 0
  
} else if (abs_slip < handling.slip_limit_deg) {
  // === ЗОНА ПРОГРЕССИВНОЙ КОРРЕКЦИИ ===
  // Линейное нарастание коррекции
  progress = (abs_slip - handling.slip_threshold_deg) / 
             (handling.slip_limit_deg - handling.slip_threshold_deg)
  
  stab_gain_eff = handling.stab_gain * lerp(0.8, 1.5, progress)
  slip_correction_factor = handling.slip_correction_gain * progress
  
  // Смещаем target_nose_dir ближе к vel_dir для гашения заноса
  if (|vel| > ε_v) {
    vel_dir = normalize(vel)
    target_nose_dir = slerp(target_nose_dir, vel_dir, progress * 0.5)
  }
  
} else {
  // === АВАРИЙНОЕ ГАШЕНИЕ ЗАНОСА ===
  // Критический угол превышен - принудительное выравнивание
  stab_gain_eff = handling.stab_gain * 2.0
  slip_correction_factor = handling.slip_correction_gain * 2.0
  
  // Форсированно направляем нос к скорости
  if (|vel| > ε_v) {
    target_nose_dir = normalize(vel)
  }
}

// Учёт oversteer_bias (смещение для RWD/FWD характеристик)
// Положительный bias = избыточная поворачиваемость (RWD/истребители)
// Отрицательный bias = недостаточная поворачиваемость (FWD/грузовые)
if (handling.oversteer_bias != 0 && abs_slip > 1.0) {
  bias_angle = handling.oversteer_bias * (abs_slip / handling.slip_limit_deg)
  target_nose_dir = rotate(target_nose_dir, bias_angle * sign(slip_deg))
}
```

 

#### Фаза 3: Вычисление команд

 

```javascript
// 1. УСКОРЕНИЕ К ЦЕЛЕВОЙ СКОРОСТИ
Δv = v_cmd - vel

// Продольная компонента
kp_long = 1.5  // коэффициент пропорциональности
ax_target = kp_long * dot(Δv, fwd_axis)
cap_long = handling.cap_main_coupled * caps.long_mps2
ax_fwd = clamp(ax_target, -cap_long, cap_long)

// Поперечная компонента (с учётом lat_authority)
kp_lat = 2.0
ay_target = kp_lat * dot(Δv, right_axis)

// Добавляем коррекцию скольжения через RCS
if (slip_correction_factor > 0 && |vel| > ε_v) {
  lat_vel_body = dot(vel, right_axis)
  ay_slip_correction = -slip_correction_factor * lat_vel_body
  ay_target += ay_slip_correction
}

cap_lat = handling.lat_authority * caps.lat_mps2
ay_right = clamp(ay_target, -cap_lat, cap_lat)

// 2. МОМЕНТ ДЛЯ СТАБИЛИЗАЦИИ НОСА
target_angle = atan2(target_nose_dir.y, target_nose_dir.x)
alpha = align_pd(
  theta, 
  target_angle, 
  omega,
  stab_gain_eff,           // kp
  handling.stab_damping,   // kd
  caps.ang_radps2
)

// 3. ИНДИКАЦИЯ АКТИВНОГО ЛИМИТЕРА
limiter_active = (v_cmd_mag >= v_lim * 0.98)
```

 

### 4.3 Decoupled

 

Логика без изменений:

 

```javascript
// Ориентация носа управляется напрямую (ПК Q/E, мобайл правый стик)
turn_input = get_pilot_turn_command()  // -1..1
alpha_cmd = turn_input * caps.ang_radps2

// Демпферы вращения при нулевом вводе
if (abs(turn_input) < 0.05) {
  k_damp = handling.stab_gain * handling.stab_damping
  alpha_cmd = -k_damp * omega
}
alpha = clamp(alpha_cmd, -caps.ang_radps2, caps.ang_radps2)

// Продольные и поперечные ускорения без ограничений cap_main_coupled
ax_fwd = clamp(thrust_input * caps.long_mps2, -caps.long_mps2, caps.long_mps2)
ay_right = clamp(strafe_input * caps.lat_mps2, -caps.lat_mps2, caps.lat_mps2)
```

 

### 4.4 Brake (независимый)

 

Логика без изменений:

 

```javascript
prev_mode = mode  // Coupled|Decoupled
mode = "Brake"
boost_active = (boost_key || double_tap_brake_mobile) && cooldown_ok

g_target = (boost_active ? brake.g_boost : brake.g_sustain) * g0
cap_long = min(caps.long_mps2, g_target)
cap_lat = min(caps.lat_mps2, g_target)
cap_ang = caps.ang_radps2

// Приоритеты: 1) гашение |v|, 2) гашение |ω|, 3) поперечная скорость

// 1) Продольное торможение (main thrust)
if (|vel| > ε_v) {
  vel_dir = normalize(vel)
  brake_direction_long = -dot(vel_dir, fwd_axis)
  ax_fwd = cap_long * brake_direction_long
} else {
  ax_fwd = 0
}

// 2) Ротационное торможение (RCS torque)
if (abs(omega) > ε_ω) {
  alpha = -sign(omega) * min(abs(omega) * 5.0, cap_ang)
} else {
  alpha = 0
}

// 3) Поперечное торможение (RCS linear)
if (|vel| > ε_v) {
  lat_vel = vel - dot(vel, fwd_axis) * fwd_axis
  if (|lat_vel| > ε_v) {
    lat_vel_body = dot(lat_vel, right_axis)
    ay_right = -sign(lat_vel_body) * cap_lat
  } else {
    ay_right = 0
  }
} else {
  ay_right = 0
}

// Выход из режима Brake
if (|vel| < ε_v && abs(omega) < ε_ω) {
  mode = prev_mode
  brake_active = false
}
```

 

---

 

## 5. Пресеты Handling Styles

 

### 5.1 Drift (истребители, перехватчики)

 

**Характеристика:** Заднеприводная избыточная поворачиваемость, агрессивные манёвры с контролируемым заносом.

 

**Применение:** Истребители, перехватчики, лёгкие разведчики.

 

```javascript
handling_style: "Drift"
handling: {
  stab_gain: 0.5              // низкая, нос медленно возвращается
  stab_damping: 1.2           // умеренное демпфирование
  
  slip_threshold_deg: 15      // широкая зона свободы
  slip_limit_deg: 30          // терпим большие углы
  slip_correction_gain: 0.3   // мягкая коррекция
  
  nose_follow_input: 0.8      // нос активно следует за командой
  anticipation_gain: 0.3      // сильное упреждение
  oversteer_bias: 0.15        // избыточная поворачиваемость
  
  cap_main_coupled: 0.50      // умеренное ограничение продольной тяги
  lat_authority: 0.85         // высокий контроль RCS
}
```

 

**Поведение:** Нос активно "ловит" направление ввода, корабль легко срывается в занос при резких манёврах. Требует постоянной корректировки пилотом. Идеален для dogfight.

 

### 5.2 Balanced (универсалы, мультироль)

 

**Характеристика:** Полноприводная нейтральная управляемость, баланс стабильности и маневренности.

 

**Применение:** Универсалы, разведчики, средние корабли, майнеры, ремонтные, строительные.

 

```javascript
handling_style: "Balanced"
handling: {
  stab_gain: 0.8              // средняя стабилизация
  stab_damping: 2.0           // хорошее демпфирование
  
  slip_threshold_deg: 10      // умеренная зона свободы
  slip_limit_deg: 18          // средний лимит
  slip_correction_gain: 0.8   // активная коррекция
  
  nose_follow_input: 0.5      // баланс между vel и v_cmd
  anticipation_gain: 0.15     // умеренное упреждение
  oversteer_bias: 0.0         // нейтральная поворачиваемость
  
  cap_main_coupled: 0.60      // сбалансированная тяга
  lat_authority: 0.75         // средний контроль RCS
}
```

 

**Поведение:** Предсказуемое управление, корабль помогает пилоту, но позволяет манёвры. Универсальный стиль для большинства задач. Подходит для кораблей, требующих баланса точности и манёвренности.

 

### 5.3 Grip (гонщики, курьеры, прецизионный стиль)

 

**Характеристика:** Минимальное скольжение, максимальная стабильность и контроль траектории.

 

**Применение:** Гонщики, курьеры, лёгкие транспорты, корабли требующие точного пилотирования.

 

```javascript
handling_style: "Grip"
handling: {
  stab_gain: 1.2              // высокая стабилизация
  stab_damping: 2.8           // сильное демпфирование
  
  slip_threshold_deg: 5       // узкая зона свободы
  slip_limit_deg: 12          // жёсткий лимит
  slip_correction_gain: 1.5   // агрессивное гашение заноса
  
  nose_follow_input: 0.2      // нос преимущественно к vel
  anticipation_gain: 0.05     // минимальное упреждение
  oversteer_bias: -0.1        // лёгкая недостаточная поворачиваемость
  
  cap_main_coupled: 0.70      // высокая продольная тяга
  lat_authority: 1.0          // полный контроль RCS
}
```

 

**Поведение:** Корабль "прилипает" к траектории, минимальное скольжение. Нос следует за вектором скорости, обеспечивая максимальную точность. Идеален для гонок и точных манёвров.

 

### 5.4 Heavy (грузовые, крупнотоннажные)

 

**Характеристика:** Сильная недостаточная поворачиваемость, инертное управление, приоритет прямолинейного движения.

 

**Применение:** Грузовые корабли, крупнотоннажные транспорты, танкеры.

 

```javascript
handling_style: "Heavy"
handling: {
  stab_gain: 0.9              // умеренная стабилизация
  stab_damping: 3.5           // очень сильное демпфирование
  
  slip_threshold_deg: 6       // узкая зона свободы
  slip_limit_deg: 12          // не терпим больших углов
  slip_correction_gain: 1.0   // активная коррекция
  
  nose_follow_input: 0.1      // нос жёстко следует за vel
  anticipation_gain: 0.0      // нет упреждения
  oversteer_bias: -0.25       // сильная недостаточная поворачиваемость
  
  cap_main_coupled: 0.35      // сильное ограничение продольной тяги
  lat_authority: 0.55         // ограниченный контроль RCS
}
```

 

**Поведение:** Медленные, инертные реакции. Корабль сопротивляется резким манёврам и стремится к прямолинейному движению. Требует упреждающего управления и плавных вводов. Нос "запаздывает" за командами, создавая ощущение массивности. Подходит для длинных перелётов по прямой с редкими манёврами.

 

---

 

## 6. Таблица пресетов (сводная)

 

| Preset | Архетип | handling_style | slip_limit_deg | nose_follow_input | oversteer_bias | cap_main | lat_authority |
|----|----|----|----|----|----|----|----|
| **Sport** | Истребитель | Drift | 30 | 0.8 | +0.15 | 0.50 | 0.85 |
| **Muscle** | Перехватчик | Drift | 25 | 0.7 | +0.10 | 0.45 | 0.80 |
| **Recon** | Разведчик | Balanced | 18 | 0.5 | 0.0 | 0.60 | 0.75 |
| **Industrial** | Грузовой | Grip (modified) | 12 | 0.1 | -0.20 | 0.35 | 0.60 |
| **Racer** | Гонщик | Grip | 12 | 0.2 | -0.10 | 0.70 | 1.0 |

 

**Дополнительные настройки brake (для всех):**

 

- g_sustain: 2.0-3.0g
- g_boost: 3.5-5.0g
- boost_duration_s: 1.0-1.5s
- boost_cooldown_s: 3.0-4.0s

 

---

 

## 7. Совместимость v0.6 → v0.7

 

### Автоматическая миграция конфига

 

```javascript
// При загрузке ShipConfig v0.6.x
if (!assist.handling_style) {
  // Определяем handling_style по старым параметрам
  if (assist.slip_lim_deg > 20) {
    assist.handling_style = "Drift"
  } else if (assist.slip_lim_deg < 10) {
    assist.handling_style = "Grip"
  } else {
    assist.handling_style = "Balanced"
  }
  
  // Маппинг старых полей
  assist.handling = {
    stab_gain: assist.stab_gain || 0.8,
    stab_damping: 2.0,  // новое поле, дефолт
    
    slip_threshold_deg: assist.slip_lim_deg * 0.7,  // 70% от лимита
    slip_limit_deg: assist.slip_lim_deg || 15,
    slip_correction_gain: 0.8,  // дефолт
    
    nose_follow_input: 0.5,     // дефолт Balanced
    anticipation_gain: 0.15,
    oversteer_bias: assist.oversteer_bias || 0.0,
    
    cap_main_coupled: assist.cap_main_coupled || 0.5,
    lat_authority: 0.75  // дефолт
  }
  
  // Brake в отдельную секцию
  assist.brake = {
    g_sustain: assist.brake_g_sustain || 2.5,
    g_boost: assist.brake_g_boost || 4.0,
    boost_duration_s: assist.boost_duration_s || 1.0,
    boost_cooldown_s: assist.boost_cooldown_s || 3.0
  }
  
  delete assist.slip_lim_deg
  delete assist.stab_gain  // теперь в handling.*
  delete assist.oversteer_bias
  delete assist.cap_main_coupled
  delete assist.brake_g_sustain
  // ...
}
```

 

---

 

## 8. Валидация и дефолты

 

### Проверки при загрузке конфига

 

```javascript
// Кламп значений handling.*
handling.stab_gain = clamp(handling.stab_gain, 0.3, 1.5)
handling.stab_damping = clamp(handling.stab_damping, 0.5, 3.5)
handling.slip_threshold_deg = clamp(handling.slip_threshold_deg, 3, 20)
handling.slip_limit_deg = clamp(handling.slip_limit_deg, 8, 35)
handling.slip_correction_gain = clamp(handling.slip_correction_gain, 0.1, 2.5)
handling.nose_follow_input = clamp(handling.nose_follow_input, 0.0, 1.0)
handling.anticipation_gain = clamp(handling.anticipation_gain, 0.0, 0.5)
handling.oversteer_bias = clamp(handling.oversteer_bias, -0.3, 0.3)
handling.cap_main_coupled = clamp(handling.cap_main_coupled, 0.2, 0.8)
handling.lat_authority = clamp(handling.lat_authority, 0.3, 1.0)

// Логические проверки
if (handling.slip_threshold_deg >= handling.slip_limit_deg) {
  console.warn("slip_threshold_deg должен быть < slip_limit_deg")
  handling.slip_threshold_deg = handling.slip_limit_deg * 0.7
}

// Скорость
v_lim = min(
  assist.speed_limiter_ratio * performance.vmax_mps,
  caps.vmax_runtime
)
if (v_lim <= 0) {
  console.warn("speed_limiter_ratio приведёт к нулевой скорости")
}

// SCM vs vmax
if (performance.scm_mps > performance.vmax_mps) {
  console.warn("scm_mps > vmax_mps, кламп scm к vmax")
  performance.scm_mps = performance.vmax_mps
}
```

 

---

 

## 9. Интеграция с вводом и мобильным UI

 

### ПК (без изменений)

 

- Дефолтные биндинги: Brake=Space, Boost=LeftShift, ToggleCoupled=C
- Respect AppConfig.input.bindings

 

### Мобайл

 

- Левый стик → v_cmd (скорость)
- Правый стик → aim_axis (только Decoupled)
- Кнопка Brake (отдельная)
- **Кнопка Boost:** 
  - Если задан отдельный биндинг → отдельная кнопка
  - Иначе → двойной тап по Brake = Boost

 

**НОВОЕ:** Индикатор handling_mode на HUD:

 

```javascript
[DRIFT] | [BALANCED] | [GRIP]
```

 

---

 

## 10. Телеметрия и HUD

 

### Обязательные индикаторы

 

```javascript
// Режим
mode: "Coupled" | "Decoupled" | "Brake"
handling_mode: "Drift" | "Balanced" | "Grip"

// Флаги
brake_active: boolean
boost_active: boolean
limiter_active: boolean  // скорость ограничена speed_limiter_ratio

// Числовые
speed_mps: number
speed_fraction_c: number  // |v|/c
lorentz_gamma: number     // из FlightTest SR
slip_deg: number          // -180..180
stab_gain_eff: number     // текущий коэффициент стабилизации

// Дополнительные (отладка)
nose_follow_input: number
anticipation_active: boolean
```

 

### Логируемые события

 

- "coupled_entered", "decoupled_entered"
- "brake_engaged", "brake_released"
- "boost_activated", "boost_expired", "boost_cooldown_complete"
- "speed_limiter_active", "speed_limiter_released"
- "slip_threshold_exceeded", "slip_limit_exceeded", "slip_emergency_correction"
- "handling_style_loaded: {style}"

 

---

 

## 11. Приёмочные тесты (PA‑серия v0.7)

 

### Базовые (v0.6 совместимость)

 

1. **PA-01:** Переключения Coupled⇄Decoupled без рывков на 0…0.9·c.
2. **PA-02:** Coupled: при cap_main_coupled=0.4 продольная ax ≤ 40% от caps.long_mps2.
3. **PA-03:** Coupled: при speed_limiter_ratio=0.65 — |v|≤0.65·vmax_mps и limiter_active=ON.
4. **PA-04:** Decoupled: при нулевом вводе omega→0 с экспоненциальным демпфированием.
5. **PA-05:** Brake: удержание Brake — |a|≈brake.g_sustain·g0; Boost — ≈brake.g_boost·g0.
6. **PA-06:** Brake: выход при |v|<ε_v && |ω|<ε_ω → возврат в prev_mode.
7. **PA-07:** Кламп лимитера: v_lim ≤ caps.vmax_runtime при любых конфигурациях.

 

### НОВЫЕ тесты v0.7: Handling Characteristics

 

#### Drift режим

 

 8. **PA-08-D:** При nose_follow_input=0.8 и активном вводе v_cmd — нос поворачивается к v_cmd_dir (не к vel).
 9. **PA-09-D:** При slip_deg=20° (< slip_limit=30°) — коррекция мягкая, slip_correction_factor < 0.5.
10. **PA-10-D:** При oversteer_bias=+0.15 и заносе — нос "переворачивает" дальше целевого угла на \~bias·slip_deg.
11. **PA-11-D:** При anticipation_gain=0.3 и резком повороте v_cmd — нос опережает vel на 5-15° в начале манёвра.

 

#### Grip режим

 

12. **PA-12-G:** При nose_follow_input=0.2 и |vel|>5 м/с — нос следует за vel_dir, игнорируя v_cmd.
13. **PA-13-G:** При slip_deg=10° (< slip_limit=12°) — stab_gain_eff возрастает до 1.5-2.0× базового.
14. **PA-14-G:** При slip_deg=13° (> slip_limit=12°) — аварийное гашение: target_nose_dir=vel_dir, slip_correction_gain×2.
15. **PA-15-G:** При oversteer_bias=-0.1 — нос "недокручивает" до целевого угла, стабилизируется раньше.
16. **PA-16-G:** lat_authority=1.0 — поперечная тяга ay использует 100% caps.lat_mps2 для коррекции.

 

#### Balanced режим

 

17. **PA-17-B:** При nose_follow_input=0.5 — target_nose_dir находится посередине между vel и v_cmd (slerp 50%).
18. **PA-18-B:** При slip_threshold_deg=10° — до 10° коррекция отсутствует (slip_correction_factor=0).
19. **PA-19-B:** Прогрессивная коррекция: slip_deg переход 10°→18° — линейное нарастание stab_gain_eff и slip_correction.

 

#### Edge cases

 

20. **PA-20-E:** При |vel|<ε_v — slip_deg=0, target_nose_dir=v_cmd_dir независимо от nose_follow_input.
21. **PA-21-E:** При |v_cmd|<ε_v и |vel|>ε_v — target_nose_dir=vel_dir (корабль выравнивается по инерции).
22. **PA-22-E:** При dot(v_cmd, vel)<0 (разворот на 180°) — anticipation не применяется.
23. **PA-23-E:** stab_damping влияет на демпфирование omega в align_pd (проверить затухание колебаний носа).

 

#### Кросс-режимные

 

24. **PA-24-X:** Переход Drift→Grip на скорости 100 м/с при slip_deg=20° — плавное изменение поведения без скачков alpha.
25. **PA-25-X:** Изменение handling.* в runtime — применяется на следующем кадре без перезагрузки корабля.
26. **PA-26-X:** Мобайл: двойной тап Brake включает boost независимо от handling_style.

 

---

 

## 12. Диагностика и отладка

 

### Debug UI (опционально через AppConfig.debug.pilot_assist)

 

```javascript
// Визуализация на HUD
if (debug.pilot_assist) {
  overlay.draw({
    // Векторы
    vel_vector: normalize(vel) * 50,           // синий
    v_cmd_vector: normalize(v_cmd) * 50,       // зелёный
    target_nose_vector: target_nose_dir * 50,  // жёлтый
    fwd_axis_vector: fwd_axis * 50,            // красный
    
    // Числа
    slip_deg: slip_deg.toFixed(1) + "°",
    stab_gain_eff: stab_gain_eff.toFixed(2),
    nose_follow: handling.nose_follow_input.toFixed(2),
    slip_correction: slip_correction_factor.toFixed(2),
    
    // Зоны
    slip_zone: slip_deg < slip_threshold ? "FREE" :
               slip_deg < slip_limit ? "CORRECTING" : "EMERGENCY",
    
    // Флаги
    anticipation_active: anticipation_applied,
    limiter_active: limiter_active
  })
}
```

 

### Логирование критических событий

 

```javascript
// При превышении slip_limit
if (abs_slip > handling.slip_limit_deg && !emergency_logged) {
  console.warn(`[PilotAssist] Emergency slip correction at ${abs_slip.toFixed(1)}° (limit: ${handling.slip_limit_deg}°)`)
  emergency_logged = true
}

// При активации anticipation
if (anticipation_angle != 0) {
  console.debug(`[PilotAssist] Anticipation: ${(anticipation_angle * 57.3).toFixed(1)}° ahead of vel`)
}

// При изменении handling_style
if (prev_handling_style != current_handling_style) {
  console.info(`[PilotAssist] Handling style changed: ${prev_handling_style} → ${current_handling_style}`)
}
```

 

---

 

## 13. Математические хелперы (дополнение к §4.1)

 

```javascript
// Сферическая линейная интерполяция 2D векторов
function slerp(v1, v2, t) {
  let dot = v1.x * v2.x + v1.y * v2.y
  dot = clamp(dot, -1, 1)
  
  let theta = acos(dot) * t
  let relative = {
    x: v2.x - v1.x * dot,
    y: v2.y - v1.y * dot
  }
  relative = normalize(relative)
  
  return {
    x: v1.x * cos(theta) + relative.x * sin(theta),
    y: v1.y * cos(theta) + relative.y * sin(theta)
  }
}

// 2D кросс-произведение (скаляр)
function cross_2d(v1, v2) {
  return v1.x * v2.y - v1.y * v2.x
}

// Поворот 2D вектора на угол
function rotate(v, angle_rad) {
  let c = cos(angle_rad)
  let s = sin(angle_rad)
  return {
    x: v.x * c - v.y * s,
    y: v.x * s + v.y * c
  }
}

// Линейная интерполяция
function lerp(a, b, t) {
  return a + (b - a) * t
}

// Clamp
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

// Angle between vectors (unsigned, 0..180°)
function angle_between(v1, v2) {
  let dot = v1.x * v2.x + v1.y * v2.y
  let det = v1.x * v2.y - v1.y * v2.x
  return atan2(abs(det), dot) * 57.2958  // to degrees
}

// Signed angle between vectors (-180..180°)
function signed_angle_between(v1, v2) {
  let det = v1.x * v2.y - v1.y * v2.x
  let dot = v1.x * v2.x + v1.y * v2.y
  return atan2(det, dot) * 57.2958
}
```

 

---

 

## 14. Рекомендации по настройке кораблей

 

### Истребители (Fighter/Interceptor)

 

**Цель:** Агрессивный drift, высокая манёвренность, требует навыка пилота.

 

```javascript
preset: "Sport"
handling_style: "Drift"
handling: {
  stab_gain: 0.5,
  stab_damping: 1.0,
  slip_threshold_deg: 15,
  slip_limit_deg: 30,
  slip_correction_gain: 0.3,
  nose_follow_input: 0.85,
  anticipation_gain: 0.35,
  oversteer_bias: 0.20,
  cap_main_coupled: 0.50,
  lat_authority: 0.90
}
performance: {
  angular_dps: { pitch: 120, yaw: 120, roll: 180 }
}
```

 

### Гоночные (Racer/Courier)

 

**Цель:** Максимальный grip, точность траектории, стабильность на высоких скоростях.

 

```javascript
preset: "Recon"
handling_style: "Grip"
handling: {
  stab_gain: 1.3,
  stab_damping: 2.8,
  slip_threshold_deg: 4,
  slip_limit_deg: 10,
  slip_correction_gain: 1.8,
  nose_follow_input: 0.15,
  anticipation_gain: 0.05,
  oversteer_bias: -0.08,
  cap_main_coupled: 0.75,
  lat_authority: 1.0
}
performance: {
  angular_dps: { pitch: 90, yaw: 90, roll: 150 }
}
```

 

### Универсалы (Multi-role)

 

**Цель:** Баланс для разных задач, прощающее управление.

 

```javascript
preset: "Recon"
handling_style: "Balanced"
handling: {
  stab_gain: 0.8,
  stab_damping: 2.0,
  slip_threshold_deg: 10,
  slip_limit_deg: 18,
  slip_correction_gain: 0.8,
  nose_follow_input: 0.5,
  anticipation_gain: 0.15,
  oversteer_bias: 0.0,
  cap_main_coupled: 0.60,
  lat_authority: 0.75
}
```

 

### Грузовые (Cargo/Industrial)

 

**Цель:** Стабильность, предсказуемость, помощь неопытным пилотам.

 

```javascript
preset: "Industrial"
handling_style: "Balanced"  // с модификациями к Grip
handling: {
  stab_gain: 1.0,
  stab_damping: 3.2,
  slip_threshold_deg: 6,
  slip_limit_deg: 12,
  slip_correction_gain: 1.2,
  nose_follow_input: 0.1,
  anticipation_gain: 0.0,
  oversteer_bias: -0.25,
  cap_main_coupled: 0.35,
  lat_authority: 0.55
}
performance: {
  angular_dps: { pitch: 40, yaw: 40, roll: 60 }
}
```

 

---

 

## 15. Версионирование и обратная совместимость

 

### Версия модуля

 

```javascript
Pilot Assist v0.7.0
```

 

Отображать в:

 

- HUD debug overlay
- Диагностических логах
- API версии ShipConfig

 

### Changelog v0.6 → v0.7

 

**Добавлено:**

 

- Параметризуемые handling characteristics
- Три стиля управления: Drift, Balanced, Grip
- Параметры nose_follow_input, anticipation_gain, oversteer_bias
- Зональный контроль скольжения (slip_threshold → slip_limit)
- Адаптивная стабилизация stab_gain_eff
- Упреждающее наведение носа
- Демпфирование вращения stab_damping
- Раздельный контроль lat_authority

 

**Изменено:**

 

- Алгоритм Coupled: target_nose_dir теперь interpolated между vel и v_cmd
- Коррекция скольжения: прогрессивная в 3 зоны (free, correcting, emergency)
- Структура assist: brake.* вынесен в отдельный объект
- slip_lim_deg → handling.slip_limit_deg (с добавлением slip_threshold_deg)

 

**Удалено:**

 

- Поля верхнего уровня: stab_gain, oversteer_bias, slip_lim_deg, cap_main_coupled (перенесены в handling.*)

 

**Обратная совместимость:**

 

- Автоматическая миграция ShipConfig v0.6.x → v0.7.0 (§7)
- Старые конфиги загружаются с дефолтами handling_style="Balanced"

 

---

 

## 16. Производительность и оптимизация

 

### Вычислительная сложность

 

**Per-frame операции Coupled:**

 

```javascript
1. Нормализация векторов: 2-3× (vel, v_cmd, fwd_axis)
2. Slerp интерполяция: 1× (только при |vel|>ε_v)
3. Angle calculations: 2× (target angle, slip_deg)
4. PD controller: 1×
5. Clamp operations: 3× (ax, ay, alpha)

Total: ~15-20 FLOPs, negligible overhead
```

 

### Оптимизации

 

```javascript
// Кэширование нормализованных векторов
if (|vel| > ε_v) {
  vel_dir_cached = normalize(vel)  // используется 3-4 раза
} else {
  vel_dir_cached = null
}

// Skip anticipation если нет активного ввода
if (|v_cmd| < ε_v || dot(v_cmd_dir, vel_dir) < 0.5) {
  // anticipation_angle = 0, пропускаем вычисления
}

// Slerp только при значимом различии углов
angle_diff = angle_between(vel_dir, v_cmd_dir)
if (angle_diff < 1.0) {  // < 1° - используем lerp
  target = lerp(vel_dir, v_cmd_dir, nose_follow_input)
} else {
  target = slerp(vel_dir, v_cmd_dir, nose_follow_input)
}
```

 

---

 

## 17. Интеграция с другими системами

 

### FlightTest (SR Physics)

 

```javascript
// FlightTest вызывает PilotAssist каждый кадр
let commands = PilotAssist.update({
  dt: dt_sec,
  kinematics: { pos, vel, theta, omega },
  input: pilot_input,
  caps: sr_adjusted_caps  // SR учитывает γ
})

// FlightTest применяет команды с учётом SR
apply_acceleration_sr(commands.ax_fwd, commands.ay_right, commands.alpha)
```

 

### HUD System

 

```javascript
HUD.update({
  mode: PA.mode,
  handling_style: PA.handling_style,
  speed: PA.speed,
  slip_deg: PA.slip_deg,
  limiter_active: PA.limiter_active,
  boost_active: PA.boost_active,
  brake_active: PA.brake_active
})
```

 

### Input Manager

 

```javascript
// Приоритет ввода: Brake > Coupled/Decoupled
if (input.brake_held) {
  PA.enterBrake()
} else if (input.toggle_coupled) {
  PA.toggleCoupledDecoupled()
} else {
  PA.updateNormalFlight(input.thrust, input.strafe, input.turn)
}
```

 

---

 

## 18. Дальнейшее развитие (roadmap)

 

### v0.8 потенциальные фичи

 

- **Assist Profiles:** Пользовательские пресеты с сохранением
- **Dynamic Handling:** Изменение handling_style в полёте (кнопка или контекстное меню)
- **Atmospheric Flight:** Адаптация параметров в атмосфере (аэродинамическое демпфирование)
- **G-force Limiter:** Ограничение ускорений для комфорта пилота/пассажиров
- **Precision Mode:** Временное снижение скорости и увеличение stab_gain для стыковок

 

### v0.9 потенциальные фичи

 

- **AI Assist Advisor:** Подсказки по оптимальному handling_style для текущей задачи
- **Telemetry Recording:** Запись поведения корабля для анализа и шаринга настроек
- **Auto-Tune:** Автоматический подбор handling.* на основе стиля пилотирования

 

---

 

## Приложение A: Примеры конфигов

 

### A.1 Aegis Gladius (истребитель)

 

```javascript
{
  "ship": "Aegis Gladius",
  "version": "0.7.0",
  "performance": {
    "scm_mps": 220,
    "vmax_mps": 1200,
    "accel_fwd_mps2": 45.0,
    "angular_dps": {"pitch": 110, "yaw": 110, "roll": 170}
  },
  "assist": {
    "preset": "Sport",
    "handling_style": "Drift",
    "speed_limiter_ratio": 0.70,
    "handling": {
      "stab_gain": 0.5,
      "stab_damping": 1.1,
      "slip_threshold_deg": 15,
      "slip_limit_deg": 28,
      "slip_correction_gain": 0.35,
      "nose_follow_input": 0.80,
      "anticipation_gain": 0.30,
      "oversteer_bias": 0.18,
      "cap_main_coupled": 0.52,
      "lat_authority": 0.88
    },
    "brake": {
      "g_sustain": 3.0,
      "g_boost": 5.0,
      "boost_duration_s": 1.2,
      "boost_cooldown_s": 3.5
    }
  }
}
```

 

### A.2 Origin 350r (гонщик)

 

```javascript
{
  "ship": "Origin 350r",
  "version": "0.7.0",
  "performance": {
    "scm_mps": 280,
    "vmax_mps": 1400,
    "accel_fwd_mps2": 38.0,
    "angular_dps": {"pitch": 85, "yaw": 85, "roll": 140}
  },
  "assist": {
    "preset": "Recon",
    "handling_style": "Grip",
    "speed_limiter_ratio": 0.85,
    "handling": {
      "stab_gain": 1.4,
      "stab_damping": 3.0,
      "slip_threshold_deg": 4,
      "slip_limit_deg": 9,
      "slip_correction_gain": 2.0,
      "nose_follow_input": 0.12,
      "anticipation_gain": 0.03,
      "oversteer_bias": -0.12,
      "cap_main_coupled": 0.78,
      "lat_authority": 1.0
    },
    "brake": {
      "g_sustain": 2.8,
      "g_boost": 4.5,
      "boost_duration_s": 1.0,
      "boost_cooldown_s": 3.0
    }
  }
}
```

 

### A.3 MISC Freelancer (универсал)

 

```javascript
{
  "ship": "MISC Freelancer",
  "version": "0.7.0",
  "performance": {
    "scm_mps": 180,
    "vmax_mps": 950,
    "accel_fwd_mps2": 22.0,
    "angular_dps": {"pitch": 55, "yaw": 55, "roll": 85}
  },
  "assist": {
    "preset": "Industrial",
    "handling_style": "Balanced",
    "speed_limiter_ratio": 0.60,
    "handling": {
      "stab_gain": 0.85,
      "stab_damping": 2.2,
      "slip_threshold_deg": 8,
      "slip_limit_deg": 15,
      "slip_correction_gain": 0.95,
      "nose_follow_input": 0.45,
      "anticipation_gain": 0.12,
      "oversteer_bias": -0.05,
      "cap_main_coupled": 0.58,
      "lat_authority": 0.70
    },
    "brake": {
      "g_sustain": 2.2,
      "g_boost": 3.8,
      "boost_duration_s": 1.5,
      "boost_cooldown_s": 4.0
    }
  }
}
```

 

---

 

## Приложение B: Глоссарий терминов

 

- **Slip angle (угол скольжения):** Угол между продольной осью корабля и вектором скорости
- **Oversteer (избыточная поворачиваемость):** Нос поворачивается сильнее, чем ожидает пилот (RWD)
- **Understeer (недостаточная поворачиваемость):** Нос поворачивается слабее (FWD)
- **Anticipation (упреждение):** Поворот носа до изменения вектора скорости
- **Drift:** Контролируемое скольжение с большим slip angle
- **Grip:** Минимальное скольжение, максимальное сцепление с траекторией
- **Stab gain:** Скорость возврата носа к целевому направлению
- **Damping:** Гашение колебаний вращения

 

---

 

**Конец документа Pilot Assist v0.7.0**

  


