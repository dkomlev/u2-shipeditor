# U2 Pilot Assist v0.6 — режимы, алгоритмы, параметры

## Режимы
- **Decoupled.** Базовый 6DOF. Ассистенты выключены. Входы пилота напрямую в тягу main/RCS.
- **Break.** Авто-остановка до |v| ≤ ε. Использует все оси тяги. Есть «boost-тормоз» с повышенной перегрузкой.
- **Coupled.** «Автомобильная» динамика. Выравнивание вектора скорости по носу, подавление вращений, ограничение тяги и бокового увода, лимитер скорости.

## Контуры управления
Каждый кадр:
1) Входы пилота `u_trans, u_rot`.
2) Состояние: `v` (м/с), `ω` (рад/с), ориентация `R`, курс носа `f = R·ex`.
3) Цели и команды:
   - **Decoupled:** `a_cmd = map(u_trans)`, `α_cmd = map(u_rot)`.
   - **Break:** `a_cap = min(accel_fwd_mps2, g_target·g)`; `a_cmd = -a_cap·normalize(v)`; `rcs_cmd = -Kω·ω`.
   - **Coupled:** `ψ = ∠(v, f)`; ограничение продольной тяги и латеральной демпфирующей с учётом ψ; `α_cmd = -stab_gain·ω + Kalign·heading_error`; `a_cmd = throttle_cap·f - Klat·lateral(v,f) + a_drag`.
4) Распределение тяги по main/RCS и осям X/Y/Z.
5) Клампы по физическим пределам и лимитам ассиста.
6) Обработка буста по длительности и кулдауну.

## Параметры из ShipConfig
Из `assist`:
- `preset` — базовый набор коэффициентов.
- `slip_lim_deg` — допустимый угол скольжения в **Coupled**.
- `stab_gain` — демпфирование угловых скоростей.
- `oversteer_bias` ∈ [−1…+1] — склонность к избыточной/недостаточной поворачиваемости.
- `cap_main_coupled` ∈ [0…1] — верхняя доля маршевой тяги в **Coupled**.
- `speed_limiter_ratio` ∈ [0…1] — лимитер скорости относительно `performance.scm_mps`.
- `brake_g_sustain`, `brake_g_boost` — целевые перегрузки **Break**.
- `boost_duration_s`, `boost_cooldown_s` — длительность и кулдаун буста **Break**.

Из других разделов:
- `performance.scm_mps`, `vmax_mps` — базовые и предельные скорости.
- `performance.accel_fwd_mps2`, `strafe_mps2.{x,y,z}` — достижимые ускорения.
- `performance.angular_dps.{pitch,yaw,roll}` — предельные угловые скорости.
- `propulsion.main_thrust_MN`, `propulsion.rcs_budget_MN` — веса main vs RCS.
- `signatures.{IR,EM,CS}` — для стелс-логики в архетипах Recon, stealth bomber/dropship (bearing-control).

## Псевдокод

### Break
```pseudo
g = 9.80665
g_target = boost_active ? brake_g_boost : brake_g_sustain
a_cap = min(performance.accel_fwd_mps2, g_target * g)

if |v| > eps:
  a_cmd = -a_cap * normalize(v)
  rcs_cmd = -Kω * ω
else:
  a_cmd = 0; rcs_cmd = 0
```

### Coupled
```pseudo
v_lim = speed_limiter_ratio * performance.scm_mps
if |v| > v_lim: a_drag = -Klim * (|v|-v_lim) * normalize(v)

ψ = angle_between(v, fwd)
ψ_lim = slip_lim_deg in rad
Kslip = clamp(ψ/ψ_lim, 0..1)

main_cap = cap_main_coupled * performance.accel_fwd_mps2
lat_cap  = (1 - Kslip) * min(strafe_mps2.{x,y})

a_cmd = throttle * main_cap * fwd - Klat * lateral(v,fwd) * lat_cap + a_drag
α_cmd = -stab_gain * ω + Kalign * heading_error()
α_cmd += oversteer_bias * steer_feedforward()
```

### Decoupled
```pseudo
a_cmd = map_axis(u_trans) * { accel_fwd_mps2, strafe_mps2 }
α_cmd = map_axis(u_rot)    * angular_dps
```

## Предустановки и архетипы
- Размеры: `snub, small, medium, heavy, capital`.
- Типы: `shuttle, fighter, interceptor, gunship, bomber, dropship, courier, freighter, exploration, passenger, miner, tanker, salvager, repair, recon, corvette, frigate, destroyer, carrier, dreadnought`.
- Recon всегда stealth; bomber/dropship — могут иметь stealth-варианты.
- Маппинг архетип → пресет ассиста задаётся в редакторе и в спецификации.
