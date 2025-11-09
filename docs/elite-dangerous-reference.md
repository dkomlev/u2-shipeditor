# Elite Dangerous Flight Model Reference

Этот документ содержит справочные данные по управлению кораблями в Elite Dangerous для балансировки U2 Ship Editor.

## Ключевые принципы Elite Dangerous

1. **Реалистичная инерция**: Корабли имеют инерцию и требуют времени для изменения курса
2. **Дифференцированные оси**: Pitch (тангаж) > Yaw (рыскание), Roll (крен) >> Pitch
3. **Плавные рампы**: Угловое ускорение накапливается постепенно, нет мгновенных рывков
4. **Ограничения по массе**: Чем тяжелее корабль, тем медленнее он вращается

## Референсные корабли (приблизительные значения)

### Лёгкие истребители (< 150t)

**Viper Mk III** (140t)
- Max rotation: 400°/s (pitch 70, yaw 60, roll 140)
- Angular accel: ~10°/s²
- Time to max: ~6-7 секунд
- Аналог SC: Gladius, Arrow

**Imperial Eagle** (50t)
- Max rotation: 450°/s (очень лёгкий)
- Angular accel: ~12°/s²
- Самый маневренный класс

### Средние истребители (150-300t)

**Vulture** (230t)
- Max rotation: 360°/s (pitch 60, yaw 50, roll 120)
- Angular accel: ~8°/s²
- Time to max: ~7-8 секунд
- Аналог SC: Hornet, Sabre

**Federal Assault Ship** (300t)
- Max rotation: 240°/s (pitch 40, yaw 35, roll 80)
- Angular accel: ~6°/s²
- Аналог SC: Vanguard

### Средние многоцелевые (300-600t)

**Python** (350t)
- Max rotation: 120°/s (pitch 25, yaw 20, roll 50)
- Angular accel: ~4°/s²
- Time to max: ~30 секунд
- Аналог SC: Freelancer, Constellation

**Krait Mk II** (320t)
- Max rotation: 180°/s (pitch 35, yaw 30, roll 70)
- Angular accel: ~5°/s²
- Более маневренный чем Python

### Тяжёлые грузовые (600-1500t)

**Type-9 Heavy** (1000t)
- Max rotation: 60°/s (pitch 12, yaw 10, roll 25)
- Angular accel: ~2°/s²
- Time to max: ~30 секунд
- Аналог SC: C2 Hercules, Caterpillar

**Type-7 Transporter** (350t, большой объём)
- Max rotation: 90°/s (pitch 18, yaw 15, roll 35)
- Angular accel: ~3°/s²

### Боевые капиталы (900-2000t)

**Federal Corvette** (900t)
- Max rotation: 50°/s (pitch 10, yaw 8, roll 20)
- Angular accel: ~1.5°/s²
- Time to max: ~35-40 секунд
- Аналог SC: Hammerhead, Polaris

**Imperial Cutter** (1100t)
- Max rotation: 45°/s (pitch 9, yaw 7, roll 18)
- Angular accel: ~1.2°/s²
- Самый массивный игровой корабль

## Формулы балансировки

### Угловое ускорение по массе (используется в balance-realistic.js)

```javascript
function getAngularAccelForMass(mass_t) {
  if (mass_t < 150) return 8;   // Лёгкие истребители
  if (mass_t < 300) return 6;   // Средние истребители
  if (mass_t < 600) return 4;   // Средние корабли
  if (mass_t < 1500) return 2;  // Тяжёлые грузовые
  return 1.2;                   // Капиталы
}
```

### Момент инерции (rod approximation для космических кораблей)

```javascript
// I = coefficient × m × L²
const coefficients = {
  yaw: 0.15,    // Vertical axis (самый большой)
  pitch: 0.12,  // Lateral axis
  roll: 0.08    // Longitudinal axis (самый маленький)
};
```

### Соотношение осей вращения

Типичные соотношения для истребителя:
- Roll : Pitch : Yaw ≈ 2.0 : 1.25 : 1.0
- Пример Hornet: roll 642 : pitch 963 : yaw 1203 kN·m

## Текущие настройки U2 (v0.6.3)

### Angular jerk limiting
- `angular_rps3 = 0.3` (≈17°/s³)
- Полная команда достигается за ~3.3 секунды
- Elite-style плавный S-образный профиль

### Main thrust boost
- +50% к erkul.games значениям для динамичного геймплея
- Hornet: 3456kN → 5184kN (72m/s² вместо 48m/s²)

### Angular acceleration
- Fighters: 8°/s² (Hornet: yaw 1203kN·m → 8°/s max accel)
- Medium: 4°/s² (Ares Ion)
- Heavy: 2°/s² (RAFT, C2)
- Capital: 1.2°/s² (Idris)

## Источники

- Elite Dangerous Wiki: https://elite-dangerous.fandom.com/wiki/Ships
- Coriolis ship builder: https://coriolis.io/
- erkul.games (Star Citizen): https://www.erkul.games/
- Личный опыт игры в Elite Dangerous (1000+ часов)

## Примечания

Elite Dangerous использует boost-режим для линейного ускорения (аналог afterburner в SC), но угловые скорости остаются постоянными независимо от boost. В U2 мы применяем эту философию - boost влияет на brake G-force, но не на rotation.
