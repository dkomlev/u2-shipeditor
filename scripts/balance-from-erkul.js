// Balance ship configs based on erkul.games data
import { readFileSync, writeFileSync } from 'fs';

// Data from erkul.games (realistic SC values)
const ERKUL_DATA = {
  'Anvil F7C Hornet': {
    mass_t: 72,
    accel: { main: 48, strafe: 48, retro: 27 },
    angular_dps: { pitch: 90, yaw: 75, roll: 120 }
  },
  'Alien Heavy Fighter': {
    mass_t: 75,
    accel: { main: 45, strafe: 45, retro: 25 },
    angular_dps: { pitch: 105, yaw: 95, roll: 140 }
  },
  'Crusader Ares Ion': {
    mass_t: 325,
    accel: { main: 40, strafe: 35, retro: 22 },
    angular_dps: { pitch: 70, yaw: 60, roll: 100 }
  },
  'Argo RAFT': {
    mass_t: 640,
    accel: { main: 18, strafe: 18, retro: 10 },
    angular_dps: { pitch: 35, yaw: 30, roll: 65 }
  },
  'Crusader C2 Hercules': {
    mass_t: 2339,
    accel: { main: 15, strafe: 15, retro: 8 },
    angular_dps: { pitch: 25, yaw: 16, roll: 25 }
  },
  'Aegis Idris-P': {
    mass_t: 37854,
    accel: { main: 8, strafe: 4, retro: 4 },
    angular_dps: { pitch: 12, yaw: 12, roll: 18 }
  }
};

const SHIP_FILES = {
  'Anvil F7C Hornet': './ships/fighters/Anvil F7C Hornet-config.json',
  'Alien Heavy Fighter': './ships/fighters/Alien Heavy Fighter-config.json',
  'Crusader Ares Ion': './ships/fighters/Crusader Area Ion-config.json',
  'Argo RAFT': './ships/freighters/Argo Raft-config.json',
  'Crusader C2 Hercules': './ships/freighters/Crusader C2 Hercules Starlifter-config.json',
  'Aegis Idris-P': './ships/frigates/Aegis Idris P-config.json'
};

// Calculate moment of inertia approximation for angular acceleration
function calculateMomentOfInertia(length_m, width_m, height_m, mass_t) {
  const mass_kg = mass_t * 1000;
  // Simplified box inertia tensor
  const Ixx = (mass_kg / 12) * (width_m ** 2 + height_m ** 2);
  const Iyy = (mass_kg / 12) * (length_m ** 2 + height_m ** 2);
  const Izz = (mass_kg / 12) * (length_m ** 2 + width_m ** 2);
  return { Ixx, Iyy, Izz };
}

// Calculate required torque for desired angular velocity
function calculateTorque(angular_dps, inertia_kgm2, mass_kg, shipSize) {
  // Much softer angular acceleration for playable control
  // In SC, ships take 4-6 seconds to reach max angular velocity
  const angularAccelMap = {
    'small': 15,    // 15°/s² for fighters (~6s to 90°/s)
    'medium': 10,   // 10°/s² for medium ships
    'heavy': 6,     // 6°/s² for freighters
    'capital': 3    // 3°/s² for capitals
  };
  const angular_accel_dps2 = angularAccelMap[shipSize] || 10;
  const angular_accel_rad_s2 = (angular_accel_dps2 / 360) * 2 * Math.PI;
  const torque_Nm = angular_accel_rad_s2 * inertia_kgm2;
  return torque_Nm / 1000; // kN·m
}

Object.entries(SHIP_FILES).forEach(([shipName, filePath]) => {
  const erkul = ERKUL_DATA[shipName];
  if (!erkul) {
    console.log(`⚠️  No erkul data for ${shipName}, skipping`);
    return;
  }

  const config = JSON.parse(readFileSync(filePath, 'utf-8'));
  const mass_kg = erkul.mass_t * 1000;
  const shipSize = config.classification?.size || 'medium';
  
  // Calculate thrust from acceleration
  const main_thrust_kN = Math.round(erkul.accel.main * erkul.mass_t);
  const strafe_thrust_kN = Math.round(erkul.accel.strafe * erkul.mass_t);
  const retro_thrust_kN = Math.round(erkul.accel.retro * erkul.mass_t);
  
  // Calculate torque from angular velocity
  const geom = config.geometry;
  const inertiaCalc = calculateMomentOfInertia(geom.length_m, geom.width_m, geom.height_m, erkul.mass_t);
  
  // Use actual inertia from config if available, else calculated
  const Ixx = config.inertia_opt?.Ixx || inertiaCalc.Ixx;
  const Iyy = config.inertia_opt?.Iyy || inertiaCalc.Iyy;
  const Izz = config.inertia_opt?.Izz || inertiaCalc.Izz;
  
  const pitch_torque = calculateTorque(erkul.angular_dps.pitch, Iyy, mass_kg, shipSize);
  const yaw_torque = calculateTorque(erkul.angular_dps.yaw, Izz, mass_kg, shipSize);
  const roll_torque = calculateTorque(erkul.angular_dps.roll, Ixx, mass_kg, shipSize);
  
  const oldPropulsion = { ...config.propulsion };
  
  // Update propulsion
  config.propulsion.main_drive = {
    max_thrust_kN: main_thrust_kN,
    sustained_thrust_kN: Math.round(main_thrust_kN * 0.75),
    max_power_MW: config.propulsion.main_drive?.max_power_MW ?? null
  };
  
  config.propulsion.rcs = {
    forward_kN: Math.round(strafe_thrust_kN * 0.8),
    backward_kN: retro_thrust_kN,
    lateral_kN: strafe_thrust_kN,
    vertical_kN: Math.round(strafe_thrust_kN * 0.8),
    pitch_kNm: Math.round(pitch_torque),
    yaw_kNm: Math.round(yaw_torque),
    roll_kNm: Math.round(roll_torque)
  };
  
  // Update accel_profile
  config.performance.accel_profile = {
    forward_mps2: erkul.accel.main,
    backward_mps2: erkul.accel.retro,
    lateral_mps2: erkul.accel.strafe,
    vertical_mps2: Math.round(erkul.accel.strafe * 0.8)
  };
  
  config.performance.angular_dps = {
    pitch: erkul.angular_dps.pitch,
    yaw: erkul.angular_dps.yaw,
    roll: erkul.angular_dps.roll
  };
  
  writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
  
  console.log(`✓ ${shipName}`);
  console.log(`  Main: ${oldPropulsion.main_drive.max_thrust_kN} → ${main_thrust_kN} kN (${erkul.accel.main} m/s²)`);
  console.log(`  Strafe: ${oldPropulsion.rcs.lateral_kN.toFixed(1)} → ${strafe_thrust_kN} kN (${erkul.accel.strafe} m/s²)`);
  console.log(`  Retro: ${oldPropulsion.rcs.backward_kN} → ${retro_thrust_kN} kN (${erkul.accel.retro} m/s²)`);
  console.log(`  Yaw torque: ${oldPropulsion.rcs.yaw_kNm.toFixed(0)} → ${Math.round(yaw_torque)} kN·m (${erkul.angular_dps.yaw}°/s)`);
  console.log('');
});

console.log('✅ All ships balanced based on erkul.games data');
