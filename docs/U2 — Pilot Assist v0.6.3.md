# U2 — Pilot Assist v0.6.2

  

# U2 — Pilot Assist v0.6.3

 

## 0. Назначение и границы

 

Модуль управления кораблём, отвечающий за режимы **Coupled**, **Decoupled** и независимый **Brake**, стабилизацию, лимит скорости, распределение тяги и RCS. Модуль **не реализует SR‑физику** и интегрирование движения — это канонично в FlightTest (§1). Pilot Assist выдаёт команды ускорений/моментов в рамках рантайм‑кэпов, предоставляемых движком.

 

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

 

### 1.2 Вход (из ShipConfig v0.6)

 

- performance: scm_mps, vmax_mps, accel_fwd_mps2, strafe_mps2{xyz}, angular_dps{pitch,yaw,roll}.
- propulsion: main_thrust_MN, rcs_budget_MN.
- assist (см. §2): пресет и параметры.

 

### 1.3 Выход (в FlightTest)

 

- Команды ускорений в СК корпуса: a_body = {ax_fwd, ay_right} (м/с²), alpha (рад/с²).
- Флаги/состояния: mode ∈ {Coupled, Decoupled}, brake_active, boost_active.
- Индикаторы HUD: limiter_active, slip_deg, stab_gain_eff.

 

## 2. Поля ShipConfig.assist (v0.6)

 

```javascript
preset: "Sport"|"Muscle"|"Industrial"|"Recon"
slip_lim_deg: number        // предел угла между носом и вектором скорости
stab_gain: number           // коэффициент стабилизации носа
oversteer_bias: number      // прицеливание с небольшим перекрутом
cap_main_coupled: 0..1      // доля продольной тяги в Coupled
speed_limiter_ratio: 0..1   // лимит скорости как доля performance.vmax_mps
brake_g_sustain: number     // g-лимит устойчивого торможения
brake_g_boost: number       // g-лимит буста торможения
boost_duration_s: number
boost_cooldown_s: number
```

 

## 3. Машина состояний

 

- **Coupled** ↔ **Decoupled**: по toggle_coupled.
- **Brake** — независимый режим:
  - Вход: удержание brake (ПК) или кнопка Brake (мобайл).
  - Выход: отпускание brake или достижение порогов ε_v, ε_ω → возврат в предыдущее состояние.
  - boost: ПК — boost (дефолт Left Shift); мобайл — двойной тап по Brake или отдельная кнопка Boost.
- Таймеры: boost_active ∈ [0; boost_duration_s] с паузой boost_cooldown_s.

 

## 4. Алгоритмы

 

### 4.1 Общие помощники

 

```javascript
v_lim = min(assist.speed_limiter_ratio * performance.vmax_mps, caps.vmax_runtime)
// PD-стабилизатор носа к цели target_dir
align(theta, target_dir, stab_gain, oversteer_bias) -> alpha_cmd
slip_deg = angle_between(fwd_axis, normalize(vel))
ε_v≈0.05 м/с; ε_ω≈0.01 рад/с
```

 

### 4.2 Coupled

 

1. **Скоростная цель.** ПК: из W/S/A/D; мобайл: левый стик → v_cmd, ограничить |v_cmd|≤v_lim.
2. **Ускорение к цели.** Δv = v_cmd - vel.

 

- Продольная: ax = clamp(kp_long * dot(Δv, fwd_axis), ±cap_main); cap_main = assist.cap_main_coupled * caps.long_mps2.
- Поперечная: ay = clamp(kp_lat * dot(Δv, right_axis), ±caps.lat_mps2).

 

3. **Стабилизация носа.** Цель — направление vel (если |v|>ε_v), иначе — v_cmd. alpha = align(...).
4. **Контроль скольжения.** Если slip_deg > slip_lim_deg — добавить корректирующую поперечную компоненту и/или повысить stab_gain до stab_gain_eff.

 

### 4.3 Decoupled

 

- Ориентация носа управляется напрямую (ПК Q/E, мобайл правый стик).
- Демпферы вращения при нулевом вводе: alpha = -k_damp * omega, где k_damp = stab_gain * default_damping, default_damping ≈ 2.0.
- Продольные и поперечные ускорения ограничены caps.long/lat_mps2 (без cap_main_coupled).

 

### 4.4 Brake (независимый)

 

**Приоритеты:** 1) гашение |v|, 2) гашение |ω|, 3) слип.
 **Ресурсы:** main‑thrust — продольная; RCS — поперечная и момент; бюджет rcs_budget_MN.

 

```javascript
prev := mode (Coupled|Decoupled)
mode_brake := true
boost := (boost_key || double_tap_brake_mobile) && cooldown_ok

g_target = (boost ? assist.brake_g_boost : assist.brake_g_sustain) * g0
cap_long = min(caps.long_mps2, g_target)
cap_lat  = min(caps.lat_mps2,  g_target)
cap_ang  = min(caps.ang_radps2, f(angular_dps))

// 1) Продольное (main)
if |v| > ε_v: ax = -cap_long * dot(normalize(vel), fwd_axis) else ax = 0

// 2) Ротационное (RCS torque)
if |omega| > ε_ω: alpha = -k_ω * clamp(|omega|, cap_ang) else alpha = 0

// 3) Поперечное (RCS linear)
lat_v = vel - dot(vel, fwd_axis)*fwd_axis
if |lat_v| > ε_v: ay = -cap_lat * sign(dot(lat_v, right_axis)) else ay = 0

if |v|<ε_v && |omega|<ε_ω: mode_brake=false; mode=prev
```

 

**Edge‑cases:**

 

- Если |v| < 1e-10 → пропустить линейное торможение.
- Если |ω| < 1e-10 → пропустить ротационное торможение.
- Если dot(dir_v, fwd_axis) дал NaN → fallback: гасить скорость по осям корпуса.

 

## 5. Пресеты (рекомендации)

 

| Preset | slip_lim_deg | stab_gain | oversteer_bias | cap_main_coupled | speed_limiter_ratio | brake_g_sustain | brake_g_boost |
|----|----|----|----|----|----|----|----|
| Sport | 10–15 | 0.6–0.9 | 0.05–0.15 | 0.45–0.60 | 0.60–0.75 | 2.5–3.0 | 4.0–5.0 |
| Muscle | 8–12 | 0.7–1.1 | 0.00–0.10 | 0.35–0.50 | 0.55–0.70 | 2.0–2.8 | 3.5–4.5 |
| Industrial | 5–9 | 0.9–1.3 | 0.00–0.05 | 0.25–0.40 | 0.45–0.60 | 1.5–2.2 | 3.0–4.0 |
| Recon | 12–18 | 0.5–0.8 | 0.10–0.20 | 0.50–0.70 | 0.70–0.85 | 2.2–2.8 | 4.0–5.0 |

 

## 6. Совместимость v0.5.3 → v0.6

 

Маппинг assist.coupled_*:

 

- coupled_cap_main → cap_main_coupled.
- coupled_speed_limit_ratio → speed_limiter_ratio.
- Отсутствующие slip_lim_deg, stab_gain, oversteer_bias — из дефолтов пресета по архетипу.
- brake_* при отсутствии — sustain≈2.0g, boost≈3.5g, boost_duration_s≈1.0, cooldown_s≈3.0.

 

## 7. Валидация и дефолты

 

- Кламп значений к диапазонам пресетов.
- speed_limiter_ratio·vmax_mps ≤ caps.vmax_runtime.
- При scm_mps > vmax_mps — предупреждение и кламп scm_mps.
- При stab_gain≈0 — форсировать минимум 0.3.
- При assist.speed_limiter_ratio≈0 — предупреждение: «скорость будет ограничена нулём».
- При assist.cap_main_coupled≈0 — предупреждение: «продольная тяга в Coupled отключена».

 

## 8. Интеграция с вводом и мобильным UI

 

- Respect AppConfig.input.bindings; дефолтные: Brake=Space, Boost=LeftShift, ToggleCoupled=C.
- Мобайл: отдельная кнопка Brake. **Приоритет:** если задан отдельный биндинг Boost — отдельная кнопка Boost; иначе — двойной тап по Brake = Boost.

 

## 9. Телеметрия и HUD

 

- HUD‑флаги: mode, brake_active, boost_active, limiter_active.
- Числа: |v|, |v|/c, γ (из FlightTest), slip_deg, stab_gain_eff.
- Лог‑ивенты: вход/выход Brake, начало/конец Boost, автоклампы лимитера.

 

## 10. Приёмочные тесты (PA‑серия)

 

1. Переключения Coupled⇄Decoupled без рывков на 0…0.9·c.
2. Coupled: при cap_main_coupled=0.4 продольная ax ≤ 40% от caps.long_mps2.
3. Coupled: при speed_limiter_ratio=0.65 — |v|≤0.65·vmax_mps и limiter_active=ON.
4. Decoupled: при нулевом вводе omega→0 с экспоненциальным демпфированием (k_damp).
5. Brake: удержание Brake — |a|≈brake_g_sustain·g0; Boost — ≈brake_g_boost·g0 на boost_duration_s, с кулдауном.
6. Мобайл: двойной тап по Brake включает Boost; отпускание Brake до порогов — немедленный выход в предыдущее состояние.
7. Кламп лимитера: v_lim ≤ caps.vmax_runtime при любых конфигурациях.

 

## 11. Версионирование

 

Отображать Pilot Assist v0.6.3 в диагностике и HUD‑отладке.

  