#!/usr/bin/env node
// Realistic ship balancing based on Elite Dangerous and erkul.games
// References:
// - Elite Dangerous: realistic flight model with inertia, Vulture ~360°/s, Python ~120°/s, Corvette ~50°/s
// - Star Citizen erkul.games: Hornet 48m/s² main, 48 strafe, 27 retro
// 
// Strategy:
// 1. Increase main thrust by 1.5x (boost acceleration for more dynamic gameplay)
// 2. Reduce angular acceleration to Elite Dangerous-like levels (5-8°/s² for fighters)
// 3. Use proper inertia tensor ratios for realistic pitch/yaw/roll differentiation

import fs from 'fs';
import path from 'path';

const shipsDir = 'ships';

// Elite Dangerous reference data (approximate values for similar mass ships)
// Ship class mapping: small fighter (~70-100t), medium (~300-500t), large freighter (~1000-2000t), capital (>5000t)
const ED_REFERENCE = {
  // Vulture: 230t, very agile fighter - 360°/s max rotation, ~6s to max
  vulture: { mass_t: 230, pitch_dps: 60, yaw_dps: 50, roll_dps: 120, angular_accel_dps2: 8 },
  // Viper Mk3: 140t, fast interceptor - 400°/s max rotation
  viper: { mass_t: 140, pitch_dps: 70, yaw_dps: 60, roll_dps: 140, angular_accel_dps2: 10 },
  // Python: 350t, medium multipurpose - 120°/s max rotation
  python: { mass_t: 350, pitch_dps: 25, yaw_dps: 20, roll_dps: 50, angular_accel_dps2: 4 },
  // Type-9: 1000t, heavy freighter - 60°/s max rotation
  type9: { mass_t: 1000, pitch_dps: 12, yaw_dps: 10, roll_dps: 25, angular_accel_dps2: 2 },
  // Corvette: 900t, combat capital - 50°/s max rotation
  corvette: { mass_t: 900, pitch_dps: 10, yaw_dps: 8, roll_dps: 20, angular_accel_dps2: 1.5 }
};

// Adaptive angular acceleration based on ship mass (Elite Dangerous style, realistic)
function getAngularAccelForMass(mass_t) {
  if (mass_t < 150) return 4;    // Light fighter: 4°/s² (reduced 2x for realism)
  if (mass_t < 300) return 3;    // Heavy fighter: 3°/s²
  if (mass_t < 600) return 1.5;  // Medium: 1.5°/s²
  if (mass_t < 1500) return 0.5; // Freighter: 0.5°/s² (10x slower, very slow turn)
  return 0.3;                    // Capital: 0.3°/s² (order of magnitude slower)
}

// Calculate torque needed for target angular acceleration
function calculateTorque(mass_t, length_m, angularAccel_dps2) {
  const angularAccel_rps2 = angularAccel_dps2 * (Math.PI / 180);
  
  // Realistic inertia estimation (rod approximation for spacecraft)
  // I = (1/12) * m * L² for thin rod, use 0.15 for spacecraft (more distributed mass)
  const inertiaCoefficientYaw = 0.15;  // Yaw around vertical axis
  const inertiaCoefficientPitch = 0.12; // Pitch around lateral axis (slightly less)
  const inertiaCoefficientRoll = 0.08;  // Roll around longitudinal axis (much less)
  
  const mass_kg = mass_t * 1000;
  const Iyy = inertiaCoefficientPitch * mass_kg * length_m * length_m;
  const Izz = inertiaCoefficientYaw * mass_kg * length_m * length_m;
  const Ixx = inertiaCoefficientRoll * mass_kg * length_m * length_m;
  
  // Torque = I * α (in N·m)
  const pitchTorque_Nm = Iyy * angularAccel_rps2;
  const yawTorque_Nm = Izz * angularAccel_rps2;
  const rollTorque_Nm = Ixx * angularAccel_rps2;
  
  return {
    pitch_kNm: pitchTorque_Nm / 1000,
    yaw_kNm: yawTorque_Nm / 1000,
    roll_kNm: rollTorque_Nm / 1000
  };
}

function processShip(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const ship = JSON.parse(raw);
  
  const mass_t = ship.mass?.dry_t || ship.mass_t || 100;
  const length_m = ship.geometry?.length_m || 50;
  
  // Get adaptive angular acceleration for this mass
  const angularAccel = getAngularAccelForMass(mass_t);
  
  // Calculate new torques
  const torques = calculateTorque(mass_t, length_m, angularAccel);
  
  // Increase main thrust by 1.5x for more dynamic gameplay
  const mainBoost = 1.5;
  
  if (ship.propulsion?.main_drive) {
    ship.propulsion.main_drive.max_thrust_kN = Math.round(ship.propulsion.main_drive.max_thrust_kN * mainBoost);
    ship.propulsion.main_drive.sustained_thrust_kN = Math.round(ship.propulsion.main_drive.sustained_thrust_kN * mainBoost);
  }
  
  // Update RCS torques with Elite Dangerous-style values
  if (ship.propulsion?.rcs) {
    ship.propulsion.rcs.pitch_kNm = Math.round(torques.pitch_kNm);
    ship.propulsion.rcs.yaw_kNm = Math.round(torques.yaw_kNm);
    ship.propulsion.rcs.roll_kNm = Math.round(torques.roll_kNm);
  }
  
  // Calculate expected max rotation speeds (for verification)
  const maxPitch = torques.pitch_kNm * 1000 / (0.12 * mass_t * 1000 * length_m * length_m) * (180 / Math.PI);
  const maxYaw = torques.yaw_kNm * 1000 / (0.15 * mass_t * 1000 * length_m * length_m) * (180 / Math.PI);
  const maxRoll = torques.roll_kNm * 1000 / (0.08 * mass_t * 1000 * length_m * length_m) * (180 / Math.PI);
  
  fs.writeFileSync(filePath, JSON.stringify(ship, null, 2) + '\n', 'utf8');
  
  console.log(`✓ ${path.basename(filePath).padEnd(50)} | ${mass_t.toString().padStart(6)}t | α=${angularAccel}°/s²`);
  console.log(`  Main thrust: ${ship.propulsion.main_drive.max_thrust_kN}kN (+${((mainBoost-1)*100).toFixed(0)}%)`);
  console.log(`  Torque: pitch ${torques.pitch_kNm.toFixed(0)}kN·m (${maxPitch.toFixed(0)}°/s) | yaw ${torques.yaw_kNm.toFixed(0)}kN·m (${maxYaw.toFixed(0)}°/s) | roll ${torques.roll_kNm.toFixed(0)}kN·m (${maxRoll.toFixed(0)}°/s)`);
  console.log();
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.json') && !entry.name.includes('manifest')) {
      processShip(fullPath);
    }
  }
}

console.log('Realistic ship balancing (Elite Dangerous + erkul.games reference)');
console.log('Strategy: +50% main thrust, Elite-style angular accel (8/6/4/2/1.2°/s²)\n');
walkDir(shipsDir);
console.log('Done! Ships now balanced for realistic flight dynamics.');
