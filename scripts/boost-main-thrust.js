// Boost main_drive.max_thrust_kN and sustained_thrust_kN by multiplier
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MULTIPLIER = 4; // Increase main thrust by 4x
const SHIPS_DIRS = [
  './ships/fighters',
  './ships/freighters',
  './ships/frigates'
];

let totalUpdated = 0;

SHIPS_DIRS.forEach(dir => {
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  
  files.forEach(file => {
    const path = join(dir, file);
    const config = JSON.parse(readFileSync(path, 'utf-8'));
    
    if (config.propulsion?.main_drive) {
      const oldMax = config.propulsion.main_drive.max_thrust_kN;
      const oldSustained = config.propulsion.main_drive.sustained_thrust_kN;
      
      config.propulsion.main_drive.max_thrust_kN = Math.round(oldMax * MULTIPLIER);
      config.propulsion.main_drive.sustained_thrust_kN = Math.round(oldSustained * MULTIPLIER);
      
      writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8');
      
      console.log(`✓ ${file}`);
      console.log(`  max_thrust: ${oldMax} → ${config.propulsion.main_drive.max_thrust_kN} kN`);
      console.log(`  sustained: ${oldSustained} → ${config.propulsion.main_drive.sustained_thrust_kN} kN`);
      totalUpdated++;
    }
  });
});

console.log(`\n${totalUpdated} ships updated with ${MULTIPLIER}x main thrust boost`);
