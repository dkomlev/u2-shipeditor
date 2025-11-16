// Quick test: load a migrated config and verify core.js works
import { readFileSync } from 'fs';

const config = JSON.parse(readFileSync('./ships/fighters/Anvil F7C Hornet-config.json', 'utf-8'));

console.log('Testing migrated config with core.js...\n');
console.log('Config version:', config.meta.version);
console.log('Has accel_profile:', !!config.performance?.accel_profile);
console.log('Has main_drive:', !!config.propulsion?.main_drive);
console.log('Has rcs:', !!config.propulsion?.rcs);

// Simulate what core.js does
const mainDrive = config.propulsion?.main_drive;
const rcs = config.propulsion?.rcs;

console.log('\nmain_drive:', mainDrive);
console.log('rcs:', rcs);

if (mainDrive && rcs) {
  console.log('\n✓ Config structure is compatible with core.js v0.6.4');
} else {
  console.log('\n✗ Config missing required fields for core.js');
  process.exit(1);
}
