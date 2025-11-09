#!/usr/bin/env node
// Add angular_rps3 to all ship configs for smooth Decoupled rotation

import fs from 'fs';
import path from 'path';

const shipsDir = 'ships';
const angularJerk = 0.3;  // ~17°/s³ - very smooth Elite Dangerous-style ramp (3-4s to full command)

function processShip(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const ship = JSON.parse(raw);
  
  if (!ship.assist) {
    ship.assist = {};
  }
  if (!ship.assist.jerk) {
    ship.assist.jerk = { forward_mps3: 160, lateral_mps3: 130 };
  }
  
  ship.assist.jerk.angular_rps3 = angularJerk;
  
  fs.writeFileSync(filePath, JSON.stringify(ship, null, 2) + '\n', 'utf8');
  console.log(`✓ ${path.basename(filePath)}: angular_jerk=${angularJerk} rad/s³`);
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

console.log('Adding angular jerk limiting to all ships...\n');
walkDir(shipsDir);
console.log('\nDone! Decoupled rotation will now ramp very smoothly (Elite Dangerous style).');
