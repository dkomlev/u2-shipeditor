#!/usr/bin/env node
// Add angular_rps3 to all ship configs for smooth Decoupled rotation
// Adaptive jerk by ship mass for realistic heavy ship behavior

import fs from 'fs';
import path from 'path';

const shipsDir = 'ships';

// Adaptive angular jerk based on mass (heavier = slower ramp)
function getAngularJerkForMass(mass_t) {
  if (mass_t < 150) return 0.25;   // Light fighter: 0.25 rad/s³ (~14°/s³, 4s ramp)
  if (mass_t < 300) return 0.20;   // Heavy fighter: 0.20 rad/s³ (~11°/s³, 5s ramp)
  if (mass_t < 600) return 0.12;   // Medium: 0.12 rad/s³ (~7°/s³, 7s ramp)
  if (mass_t < 1500) return 0.05;  // Freighter: 0.05 rad/s³ (~3°/s³, very slow 10s+ ramp)
  return 0.03;                     // Capital: 0.03 rad/s³ (~2°/s³, ultra slow 15s+ ramp)
}

function processShip(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const ship = JSON.parse(raw);
  
  const mass_t = ship.mass?.dry_t || ship.mass_t || 100;
  const angularJerk = getAngularJerkForMass(mass_t);
  
  if (!ship.assist) {
    ship.assist = {};
  }
  if (!ship.assist.jerk) {
    ship.assist.jerk = { forward_mps3: 160, lateral_mps3: 130 };
  }
  
  ship.assist.jerk.angular_rps3 = angularJerk;
  
  fs.writeFileSync(filePath, JSON.stringify(ship, null, 2) + '\n', 'utf8');
  console.log(`✓ ${path.basename(filePath).padEnd(50)} | ${mass_t.toString().padStart(6)}t | jerk=${angularJerk.toFixed(2)} rad/s³`);
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.name.endsWith('.json')) {
      processShip(fullPath);
    }
  }
}

console.log('Adding adaptive angular jerk limiting to all ships...\n');
walkDir(shipsDir);
console.log('\nDone! Heavy ships will now turn MUCH slower (realistic).');
