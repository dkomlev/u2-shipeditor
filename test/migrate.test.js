// Test migration from v0.6.0 to v0.6.4
import { migrateToV06 } from '../js/migrate.js';
import { readFileSync } from 'fs';

// Load v0.6.0 config
const oldConfig = JSON.parse(readFileSync('./configs/medium_miner.json', 'utf-8'));

console.log('Testing migration v0.6.0 → v0.6.4...\n');
console.log('Input version:', oldConfig.meta.version);
console.log('Input propulsion:', JSON.stringify(oldConfig.propulsion, null, 2));
console.log('Input performance:', JSON.stringify(oldConfig.performance, null, 2));

// Migrate
const migrated = migrateToV06(oldConfig);

console.log('\n--- Migrated Config ---');
console.log('Version:', migrated.meta.version);
console.log('Performance.accel_profile:', JSON.stringify(migrated.performance.accel_profile, null, 2));
console.log('Propulsion.main_drive:', JSON.stringify(migrated.propulsion.main_drive, null, 2));
console.log('Propulsion.rcs:', JSON.stringify(migrated.propulsion.rcs, null, 2));
console.log('Tags:', migrated.tags);
console.log('Legacy_v053:', migrated.legacy_v053);

// Verify critical fields
const tests = [
  { name: 'Version updated to 0.6.4', pass: migrated.meta.version === '0.6.4' },
  { name: 'Has accel_profile', pass: migrated.performance.accel_profile !== undefined },
  { name: 'No scm_mps', pass: migrated.performance.scm_mps === undefined },
  { name: 'No vmax_mps', pass: migrated.performance.vmax_mps === undefined },
  { name: 'Has main_drive', pass: migrated.propulsion.main_drive !== undefined },
  { name: 'Has rcs object', pass: migrated.propulsion.rcs !== undefined },
  { name: 'main_drive.max_thrust_kN > 0', pass: migrated.propulsion.main_drive.max_thrust_kN > 0 },
  { name: 'rcs.forward_kN > 0', pass: migrated.propulsion.rcs.forward_kN > 0 },
  { name: 'Has tags array', pass: Array.isArray(migrated.tags) },
  { name: 'Has legacy_v053', pass: migrated.legacy_v053 !== undefined },
  { name: 'accel_profile.forward matches old accel_fwd', pass: Math.abs(migrated.performance.accel_profile.forward_mps2 - oldConfig.performance.accel_fwd_mps2) < 0.1 },
  { name: 'accel_profile.lateral matches old strafe.x', pass: Math.abs(migrated.performance.accel_profile.lateral_mps2 - oldConfig.performance.strafe_mps2.x) < 0.1 }
];

console.log('\n--- Test Results ---');
let passed = 0;
tests.forEach(test => {
  const result = test.pass ? '✓' : '✗';
  console.log(`${result} ${test.name}`);
  if (test.pass) passed++;
});

console.log(`\n${passed}/${tests.length} tests passed`);
if (passed === tests.length) {
  console.log('\nMIGRATION TEST: PASS ✓');
} else {
  console.log('\nMIGRATION TEST: FAIL ✗');
  process.exit(1);
}
