# U2 — Pilot Assist v0.8.0 (DeepSeek)

Отлично! Я полностью обновил документ с учётом специализации кораблей. Вот готовая версия:

```markdown
# U2 — Pilot Assist v0.8.0

## 0. Назначение и границы

Модуль управления кораблём с расширенной системой параметризации управляемости, оптимизированной под различные классы кораблей. Реализует специализированные режимы для истребителей, грузовых, промышленных и спортивных кораблей с физически обоснованным поведением.

## 1. Контракты и интерфейсы

### 1.1 Вход (из FlightTest и AppConfig)

- dt_sec — шаг симуляции.
- Кинематика: pos{x,y}, vel{vx,vy}, speed=|v|, theta, omega.
- Оси корпуса: fwd_axis, right_axis.
- Ввод пилота (с учётом AppConfig.input.bindings):
  - ПК: каналы thrust/strafe/turn; кнопки toggle_coupled, brake, boost.
  - Мобайл: v_cmd_2d (левый стик), aim_axis (правый), кнопки brake, boost.
- Рантайм‑кэпы от движка:
  - caps.long_mps2, caps.lat_mps2, caps.ang_radps2.
  - caps.vmax_runtime (≤ 0.999·c).
- Из AppConfig: physics.c_mps, отладочные флаги.

### 1.2 Вход (из ShipConfig v0.8)

```javascript
performance: {
    scm_mps, vmax_mps, 
    accel_fwd_mps2, strafe_mps2{xyz}, 
    angular_dps{pitch,yaw,roll},
    cruise_efficiency: 0.5..2.0 // Эффективность крейсерского режима
}
propulsion: {
    main_thrust_MN, rcs_budget_MN,
    weight_distribution: 0.0..1.0, // 0.0=передневес, 1.0=задневес
    engine_response: 0.5..2.0 // Скорость отклика двигателей
}
assist: { /* см. §2 */ }
```

### 1.3 Выход (в FlightTest)

- Команды ускорений в СК корпуса: a_body = {ax_fwd, ay_right} (м/с²), alpha (рад/с²).
- Флаги/состояния: mode ∈ {Coupled, Decoupled}, brake_active, boost_active.
- Индикаторы HUD: limiter_active, slip_deg, stab_gain_eff, handling_type, traction_ratio.
- Экономичные режимы: cruise_active, efficiency_boost.

## 2. Поля ShipConfig.assist (v0.8)

```javascript
preset: "Sport"|"Muscle"|"Industrial"|"Truck"|"Recon"|"Rally"|"Precision"

// Базовая стабилизация
stab_gain: number
speed_limiter_ratio: 0..1
cap_main_coupled: 0..1

// Система управляемости
handling_profile: {
    bias: -1.0..1.0          // -1=недостаточная, 0=нейтральная, +1=избыточная
    responsiveness: 0.1..2.0  // скорость реакции на руление
    slip_target_max: number   // максимальный целевой угол скольжения
    traction_control: 0.0..1.0 // система контроля тяги
    precision_boost: 0.0..1.0 // коэффициент точности позиционирования
    cruise_optimized: boolean // оптимизация для крейсерских режимов
}

// Торможение и буст
brake_g_sustain: number
brake_g_boost: number
boost_duration_s: number
boost_cooldown_s: number
```

## 3. Машина состояний

- **Coupled** ↔ **Decoupled**: по toggle_coupled.
- **Brake** — независимый режим (как в v0.6.3).
- **Cruise Assist** (опционально): автоматическое поддержание скорости с оптимизацией расхода топлива.

## 4. Алгоритмы (специализированные)

### 4.1 Общие помощники

```javascript
// Расширенный стабилизатор с учётом специализации
align_specialized(theta, target_dir, handling_profile, ship_type) -> {alpha_cmd, slip_target}

// Калькулятор эффективности для грузовых кораблей
calculate_efficiency(speed, performance.cruise_efficiency) -> efficiency_multiplier

// Система точного позиционирования для промышленных кораблей
precision_assist(pos_error, vel_error, precision_boost) -> {ax_correct, ay_correct}
```

### 4.2 Coupled (специализированные режимы)

#### 2.1 Расчёт параметров управляемости по классу корабля

```javascript
// Определение целевого поведения на основе пресета
switch(preset):
    case "Truck":
        // Грузовые корабли - устойчивость и экономичность
        target_slip = 0.0 // Минимальное скольжение
        stability_priority = 0.9
        efficiency_mode = true
        
    case "Industrial":  
        // Промышленные корабли - точность позиционирования
        target_slip = handling_profile.slip_target_max * 0.3
        stability_priority = 0.7
        precision_mode = true
        
    case "Rally":
        // Истребители - агрессивная маневренность
        target_slip = handling_profile.slip_target_max * turn_intensity
        stability_priority = 0.3
        agility_mode = true
        
    case "Precision":
        // Спортивные/курьерские - максимальный контроль
        target_slip = handling_profile.slip_target_max * 0.1
        stability_priority = 0.8
        control_mode = true
```

#### 2.2 Специализированные коррекции ускорений

```javascript
// Базовые ускорения
ax_base = clamp(kp_long * dot(Δv, fwd_axis), ±cap_main)
ay_base = clamp(kp_lat * dot(Δv, right_axis), ±caps.lat_mps2)

// Класс-специфичные модификации
if preset == "Truck":
    // Усиление маршевой тяги, ослабление маневровых
    ax_final = ax_base * (1.0 + performance.cruise_efficiency * 0.5)
    ay_final = ay_base * 0.6 // Сниженная боковая маневренность
    cruise_efficiency = calculate_efficiency(speed, performance.cruise_efficiency)
    
elif preset == "Industrial":
    // Точное позиционирование с компенсацией ошибок
    pos_error = target_position - current_position
    vel_error = target_velocity - current_velocity
    precision_correction = precision_assist(pos_error, vel_error, handling_profile.precision_boost)
    ax_final = ax_base + precision_correction.ax
    ay_final = ay_base + precision_correction.ay
    
elif preset == "Rally":
    // Агрессивная маневренность с контролем заноса
    slip_compensation = calculate_slip_compensation(slip_deg, target_slip)
    ax_final = ax_base * (1.2 + handling_profile.bias * 0.3)
    ay_final = (ay_base + slip_compensation) * (1.1 - handling_profile.traction_control * 0.2)
    
elif preset == "Precision":
    // Идеальное следование траектории
    trajectory_correction = calculate_trajectory_correction(desired_path)
    ax_final = (ax_base + trajectory_correction.ax) * handling_profile.precision_boost
    ay_final = (ay_base + trajectory_correction.ay) * handling_profile.precision_boost
```

#### 2.3 Система экономии топлива для грузовых кораблей

```javascript
if preset == "Truck" && handling_profile.cruise_optimized:
    // Плавные ускорения для экономии топлива
    ax_smoothed = low_pass_filter(ax_final, engine_response * 0.7)
    ay_smoothed = low_pass_filter(ay_final, engine_response * 0.7)
    
    // Автоматический крейсерский режим
    if abs(turn_input) < 0.1 && abs(strafe_input) < 0.1:
        cruise_active = true
        efficiency_multiplier = 1.0 + performance.cruise_efficiency * 0.3
```

### 4.3 Decoupled & Brake

*Специализированные демпферы для разных классов:*

- **Truck**: усиленное демпфирование вращения
- **Industrial**: точная остановка по осям
- **Rally**: минимальное демпфирование для продолжения вращения

## 5. Пресеты управляемости (v0.8)

| Preset | Назначение | handling.bias | responsiveness | slip_target_max | traction_control | precision_boost | Особенности |
|----|----|----|----|----|----|----|----|
| **Rally** | Истребители, перехватчики | +0.8 | 1.4 | 25° | 0.2 | 0.3 | Агрессивные заносы, быстрая реакция |
| **Muscle** | Штурмовики, ударные | +0.5 | 1.1 | 18° | 0.4 | 0.5 | Баланс мощи и контроля |
| **Precision** | Спортивные, курьерские | 0.0 | 1.5 | 8° | 0.9 | 0.8 | Максимальная точность траектории |
| **Industrial** | Майнеры, ремонтники, строители | -0.3 | 1.2 | 10° | 0.6 | 0.9 | Высокая точность позиционирования |
| **Truck** | Грузовые, танкеры | -0.7 | 0.7 | 5° | 0.8 | 0.4 | Экономичность, устойчивость |
| **Recon** | Разведчики, исследователи | -0.2 | 1.3 | 12° | 0.7 | 0.7 | Универсальная сбалансированность |

## 6. Физическая модель для специализированных кораблей

### 6.1 Модель инерции для грузовых кораблей

```javascript
// Грузовые корабли имеют повышенную инерционность
function calculate_truck_inertia(mass, cargo_mass):
    effective_mass = mass + cargo_mass * 0.8
    rotational_inertia = effective_mass * 2.0 // Повышенная инерция вращения
    return rotational_inertia
```

### 6.2 Система точного позиционирования для промышленных кораблей

```javascript
function precision_assist(pos_error, vel_error, precision_boost):
    // ПИД-регулятор для точного позиционирования
    kp = 2.0 * precision_boost
    kd = 1.5 * precision_boost
    ki = 0.1 * precision_boost
    
    integral_error += pos_error * dt
    correction = kp * pos_error + kd * vel_error + ki * integral_error
    return clamp(correction, ±max_correction)
```

### 6.3 Экономичный крейсерский режим

```javascript
function calculate_efficiency(speed, cruise_efficiency):
    optimal_speed_ratio = 0.6 // Оптимальная скорость для экономии
    speed_error = abs(speed - optimal_speed_ratio * performance.vmax_mps)
    efficiency = 1.0 - (speed_error / (optimal_speed_ratio * performance.vmax_mps))
    return clamp(efficiency * cruise_efficiency, 0.5, 2.0)
```

## 7. Валидация и миграция

### 7.1 Совместимость v0.7 → v0.8

- Добавлены новые пресеты "Truck" и "Industrial"
- Параметр `cruise_efficiency` для экономичных кораблей
- Система точного позиционирования для промышленных кораблей

### 7.2 Автоматическое определение пресета

```javascript
// Резервный алгоритм определения по характеристикам
if performance.accel_fwd_mps2 > 50 && angular_dps.yaw > 30:
    auto_preset = "Rally"
elif performance.cruise_efficiency > 1.5 && accel_fwd_mps2 > 30:
    auto_preset = "Truck" 
elif angular_dps.yaw < 15 && strafe_mps2xyz.y > 20:
    auto_preset = "Industrial"
else:
    auto_preset = "Precision"
```

## 8. Индикация и HUD для специализированных кораблей

### 8.1 Специализированные элементы HUD

- **Грузовые**: индикатор экономии топлива, оптимальная крейсерская скорость
- **Промышленные**: сетка точного позиционирования, векторы коррекции
- **Истребители**: индикатор угла атаки, предсказание траектории заноса
- **Все классы**: цветовая кодировка режимов (синий=экономичный, зелёный=точный, красный=агрессивный)

## 9. Тесты (PA-серия v0.8)

1. **Truck Preset**: проверка экономичного крейсерского режима и устойчивости
2. **Industrial Preset**: точное позиционирование у астероида/станции
3. **Rally Preset**: агрессивные манёвры уклонения и перехвата
4. **Эффективность**: измерение расхода топлива в разных режимах
5. **Точность**: ошибка позиционирования промышленного корабля < 0.1м

## 10. Версионирование

**Pilot Assist v0.8.0** — система специализированной управляемости с учётом класса корабля и оптимизацией под конкретные задачи.

---

*Документ готов к реализации. Скачайте полную версию для использования в разработке.*

```

### Ключевые особенности v0.8.0:

1. **Специализированные пресеты** для конкретных классов кораблей
2. **Truck** - экономичные грузовые перевозки с усиленной маршевой тягой
3. **Industrial** - прецизионное позиционирование для добычи и строительства
4. **Физически обоснованные модели** инерции и эффективности
5. **Система экономии топлива** для грузовых кораблей
6. **Точное позиционирование** для промышленных операций
7. **Специализированные HUD-элементы** для каждого класса

Система теперь обеспечивает уникальное "ощущение" управления для каждого типа корабля, соответствующее его назначению в игровой вселенной.
```


