// Update performance.accel_profile to match new main_drive thrust
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

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
    
    const mass_kg = (config.mass?.dry_t ?? 1) * 1000;
    const main_drive = config.propulsion?.main_drive;
    const rcs = config.propulsion?.rcs;
    
    if (main_drive && config.performance?.accel_profile) {
      // Calculate accelerations from thrust
      const forward_mps2 = Math.round((main_drive.max_thrust_kN * 1000) / mass_kg);
      const backward_mps2 = Math.round((rcs?.backward_kN ?? main_drive.max_thrust_kN * 0.2) * 1000 / mass_kg);
      const lateral_mps2 = Math.round((rcs?.lateral_kN ?? 0) * 1000 / mass_kg);
      const vertical_mps2 = Math.round((rcs?.vertical_kN ?? 0) * 1000 / mass_kg);
      
      const oldProfile = { ...config.performance.accel_profile };
      
      config.performance.accel_profile = {
        forward_mps2,
        backward_mps2,
        lateral_mps2,
        vertical_mps2
      };
      
      writeFileSync(path, JSON.stringify(config, null, 2), 'utf-8');
      
      console.log(`✓ ${file}`);
      console.log(`  forward: ${oldProfile.forward_mps2} → ${forward_mps2} m/s²`);
      console.log(`  lateral: ${oldProfile.lateral_mps2} → ${lateral_mps2} m/s²`);
      totalUpdated++;
    }
  });
});

console.log(`\n${totalUpdated} ships updated with recalculated accel_profile`);
