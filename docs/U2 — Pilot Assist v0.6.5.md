# U2 — Pilot Assist v0.6.5

**Версия:** 0.6.5  
**Дата:** 2025‑11‑09  
**Статус:** Draft / Ready for implementation  
**Совместимость:** ShipConfig ≥ 0.6 (с расширениями assist.handling v0.6.5), AppConfig ≥ 0.5.3  

---

## 0. Changelog (0.6.4 → 0.6.5)

- Режим **Coupled** выделен в отдельный модуль `CoupledController` (документ описывает API и зависимости). Это позволяет менять алгоритм независимо от остального Pilot Assist.
- Алгоритм Coupled объединяет сильные стороны версий 0.6.4 (целевой слип β*, yaw lead, jerk‑лимиты) и 0.7.0 (handling characteristics). Добавлены параметризуемые профили управляемости.
- Пересчитаны профили **Balanced / Grip / Drift**: возвращён прямой стрейф в Coupled (lat_authority ≥ 0.85), добавлены коэффициенты `turn_assist`, `strafe_to_slip_gain`, `nose_align_gain`, `traction_floor`, чтобы даже Grip не «залипал» при манёвре > 90°.
- Расширены поля `ShipConfig.assist.handling`: поддерживаются bias/responsiveness/slip_target_max/traction_control, а также набор параметров стабилизации (stab_gain, slip_threshold_deg, cap_main_coupled и т.д.). Все значения имеют дефолты и верифицированные диапазоны.
- Обновлён контракт ввода/вывода Pilot Assist. Ввод включает caps.* от ядра, вывод — телеметрию для HUD (режим, β, β* и текущий профиль). Coupled модуль принимает только нормализованные данные и возвращает команду в системе корабля.
- Добавлены новые сценарии тестирования (PA‑12…PA‑15): steady‑slip drift, grip профиль, Brake→Coupled переход и регрессия по jerk‑лимиту.

---

## 1. Назначение и границы

Pilot Assist выдает команды ускорений и моментов для кораблей в режимах **Decoupled**, **Coupled** и **Brake**. Сама физика интегрируется ядром FlightTest/u2-sim. В 0.6.5 логика Coupled вынесена в отдельный модуль и описана здесь как самостоятельный блок.

> **CoupledController**  
> - Принимает нормализованный state (pos/vel/orientation), ввод пилота и таблицу параметров handling.  
> - Вычисляет целевой угол скольжения β*, yaw lead и jerk‑лимиты.  
> - Возвращает команду `{thrustForward, thrustRight, torque}` и телеметрию `{beta, betaTarget, profile}`.  

Decoupled и Brake остаются внутри Pilot Assist, но взаимодействуют с CoupledController через простой интерфейс «активен/неактивен».

---

## 2. Контракты и интерфейсы

### 2.1 Вход из FlightTest / AppConfig

| Поле | Тип | Описание |
| --- | --- | --- |
| `dt_sec` | float | длительность шага симуляции |
| `state.position`, `state.velocity` | vec2 | положение и скорость в мировой СК |
| `state.orientation`, `state.angularVelocity` | float | курс (рад) и угл.скорость (рад/с) |
| `axes.fwd`, `axes.right` | vec2 | нормализованные оси корпуса |
| `input.thrustForward`, `input.thrustRight`, `input.torque` | ‑1…1 | нормализованные каналы пилота |
| `input.brake`, `input.modeCoupled`, `input.autopilot` | bool | кнопки управления |
| `caps.long_mps2`, `caps.lat_mps2`, `caps.ang_radps2` | float | доступные ускорения/моменты |
| `caps.vmax_runtime` | float | текущий лимит скорости (≤ 0.999·c) |
| `physics.c_mps` | float | скорость света для ограничителя |

### 2.2 Вход из ShipConfig (расширения v0.6.5)

```jsonc
assist: {
  preset: "Sport" | "Muscle" | "Industrial" | "Recon" | null,
  handling_style: "Drift" | "Balanced" | "Grip",
  speed_limiter_ratio: 0.2..1.0,
  handling: {
    // Базовый контур стабилизации
    stab_gain: 0.3..1.6,            // скорость выравнивания носа
    stab_damping: 0.5..3.0,         // демпфирование вращения
    slip_threshold_deg: 3..15,      // β, при котором Coupled ещё «мягкий»
    slip_limit_deg: 6..25,          // абсолютный максимум β
    slip_correction_gain: 0.4..2.2, // PD по Δβ
    nose_follow_input: 0..0.6,      // доля ручного yaw в целевом курсе
    anticipation_gain: 0..0.3,      // yaw lead на основе ω
    oversteer_bias: -0.3..0.3,      // смещение таргета вправо/влево
    // Расширения из DeepSeek-профиля
    bias: -1.0..1.0,                // недо-/избыточная поворачиваемость
    responsiveness: 0.1..2.0,       // скорость реакции на ввод
    slip_target_max: 2..20,         // β* на полном отклонении
    traction_control: 0..1.0,       // подавление бокового проскальзывания
    cap_main_coupled: 0.3..1.0,     // относительный лимит thrustForward
    lat_authority: 0.3..1.0         // доля доступной боковой тяги
  },
  jerk: {
    forward_mps3: 10..400,          // лимит jerk для продольной тяги
    lateral_mps3: 10..300
  }
}
```

### 2.3 Выход (в FlightTest и HUD)

| Поле | Описание |
| --- | --- |
| `command.thrustForward`, `command.thrustRight`, `command.torque` | команды в СК корпуса (‑1…1), готовые к умножению на бюджет тяги |
| `mode` | `"Coupled" | "Decoupled" | "Brake"` |
| `telemetry.slip_deg` | фактический β |
| `telemetry.slip_target_deg` | β* из CoupledController |
| `telemetry.profile` | `"Drift" / "Balanced" / "Grip"` |
| `telemetry.limiter_active` | bool, активен ли speed limiter |

---

## 3. Модульная структура

```
PilotAssist
 ├─ CoupledController (новый модуль js/sim/coupled-controller.js)
 │   ├─ calcSlip(state, axes)
 │   ├─ solveSlipTarget(input, handling)
 │   ├─ solveYawLead(state, handling)
 │   ├─ applyLateralControl(beta, betaTarget, handling)
 │   ├─ applyLongitudinalControl(input, handling, caps, jerk)
 │   └─ outputs command + telemetry
 ├─ DecoupledController (существующий простейший passthrough)
 └─ BrakeController (как в 0.6.4, использует бюджеты thrust/torque)
```

CoupledController должен быть независим от DOM/ресурсов: на вход подаются только числа, на выход — объект команд. Это позволит быстро менять Coupled, не затрагивая остальные режимы.

---

## 4. Алгоритм Coupled

### 4.1 Скользящий таргет β*

1. Вычисляем фактический угол скольжения:
   ```
   beta = atan2(dot(v, right), dot(v, fwd))
   ```
2. Задаём целевой угол:
   ```
   beta_target = clamp(slip_target_max * responsiveness * |input.turn|, ±slip_limit)
   beta_target *= sign(input.turn) + oversteer_bias
   beta_target *= (1 - traction_control * min(|v| / v_ref, 1))
   ```
3. В зоне `|beta| < slip_threshold` Coupled ведёт себя как «grip»: усиливается стабилизация носа (stab_gain↑).

### 4.2 Yaw lead и стабилизация

```
yaw_lead = anticipation_gain * ω_yaw + nose_follow_input * input.turn
dir_course = LPF(normalize(v), tau_course)
dir_steer  = rotate(fwd, yaw_lead)
dir_target = slerp(dir_course, dir_steer, w_steer(|input.turn|, |v|))
```

`dir_target` и `beta_target` совместно определяют угловую команду:
```
alpha_cmd = stab_gain * angle_error(theta, dir_target) 
          + slip_correction_gain * (beta_target - beta)
          - stab_damping * ω_yaw
```

### 4.3 Латеральный и продольный каналы

- **Латеральный thrust** складывает два сигнала: прямой ввод пилота (стрейф) и коррекцию Coupled, гасящую нецелевой слип. Стрейф проходит напрямую через полный бюджет боковой тяги, а коррекция ограничена `lat_authority * caps.lat_mps2` и сглаживается jerk‑лимитом. Это позволяет в Coupled свободно парковаться боком, не жертвуя стабилизацией носа.
- **Продольный thrust** определяется целевым ускорением и jerk‑лимитом:
  ```
  a_fwd_cmd = clamp(input.thrustForward * caps.long_mps2, ±cap_main_coupled)
  a_fwd_cmd = jerkLimit(a_fwd_prev, a_fwd_cmd, jerk.forward_mps3, dt)
  ```
- **Torque** нормируется по `caps.ang_radps2` и передается в ядро.

### 4.4 Скоростной лимитер

`caps.vmax_runtime` и `speed_limiter_ratio` дают порог `v_limit`. Фактическая скорость фильтруется LPF с τ = `handling.responsiveness`. Если `|v| > v_limit`, CoupledController уменьшает thrustForward (не влияет на lateral, пока |β| не превышает `slip_limit_deg`).

---

## 5. Профили управляемости

| Профиль | Использование | Slip/traction | Стрейф и поворот |
| --- | --- | --- | --- |
| **Drift** | Лёгкие истребители, dogfight с большими β | `slip_limit=18°`, `responsiveness=1.35`, `oversteer_bias=+0.12`, `traction_control=0.12`, `traction_floor=0.35`, `speed_limiter_ratio=0.9` | `lat_authority=0.95`, `turn_authority=0.9`, `turn_assist=0.5`, `strafe_to_slip_gain=0.55`, `nose_align_gain=0.08` |
| **Balanced** | Универсальные суда, транспорт/мультироль | `slip_limit=12°`, `responsiveness=0.9`, `bias=0`, `traction_control=0.45`, `traction_floor=0.3`, `speed_limiter_ratio=0.85` | `lat_authority=0.9`, `turn_authority=0.85`, `turn_assist=0.35`, `strafe_to_slip_gain=0.4`, `nose_align_gain=0.18` |
| **Grip** | Гоночные, приземлённые VTOL, точные манёвры | `slip_limit=8°`, `responsiveness=0.75`, `bias=-0.15`, `traction_control=0.8`, `traction_floor=0.4`, `speed_limiter_ratio=0.8` | `lat_authority=0.9`, `turn_authority=0.95`, `turn_assist=0.25`, `strafe_to_slip_gain=0.35`, `nose_align_gain=0.32` |

Общее требование: **стрейф всегда проходит напрямую** (через `lat_authority`), а Coupled‑коррекция лишь добавляет ограниченный сигнал. Даже в Grip допустимы манёвры >90° относительно вектора скорости — ассист постепенно смещает сам вектор скорости, а не «разворачивает нос» в сторону движения пилота.

Конкретный корабль может переопределять любое поле в `assist.handling`; редактор подсветит выход за диапазон, но не запретит.

---

## 6. Brake и взаимодействие режимов

- Brake активен только пока удерживается Space. При отпускании CoupledController получает state с нулевыми интеграционными ошибками.  
- Во время Brake CoupledController не вызывается, но при переходе получает последнюю телеметрию (для HUD).  
- Decoupled режим остаётся «чистым» — команды пилота напрямую умножаются на бюджеты, CoupledController не участвует.

---

## 7. Телеметрия и HUD

HUD должен отображать:

| Поле | Описание |
| --- | --- |
| `Mode` | Coupled / Decoupled / Brake |
| `Autopilot` | On/Off |
| `Profile` | Drift/Balanced/Grip (выбранный стиль) |
| `β / β*` | фактический и целевой слип (°) |
| `Limiter` | активен/нет |
| `Jerk` | визуальный индикатор, если a_fwd ограничен jerkLimiter |

Добавлены события телеметрии: `pilotAssist:beta`, `pilotAssist:jerkClamp`.

---

## 8. Тесты приёмки (PA‑12…PA‑15)

| ID | Описание | Критерии |
| --- | --- | --- |
| **PA‑12 Drift Steady Slip** | Coupled=Drift, удержание Q+W на скорости 200 м/с | β удерживается 15°±1°, thrust не выходит за cap_main |
| **PA‑13 Grip Precision** | Coupled=Grip, ступенчатый ввод Q теряет управление? | β ≤ 6°, корабль возвращается к курсу <1.2с |
| **PA‑14 Brake Transition** | Разгон + Brake (Space) 1с → отпускание → Coupled | ω и β < 0.5° через 0.3с, jerk не превышен |
| **PA‑15 Limiter Regression** | Скорость ≈ лимиту, включается limiter | thrustForward снижается плавно, нет overshoot по β |

Все тесты выполняются в FlightTest + sim-demo с включённой телеметрией.

---

## 9. Дальнейшие шаги

1. Реализовать `js/sim/coupled-controller.js` + обновить Pilot Assist для использования нового модуля.  
2. Обновить ShipConfig parser и AppConfig UI, чтобы редактировать handling_profile.  
3. Добавить HUD-индикаторы и telemetries.  
4. Покрыть CoupledController unit-тестами и интеграционными сценариями PA‑12…PA‑15.
