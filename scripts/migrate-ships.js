// Migrate all ship configs in ships/ to v0.6.4
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { migrateToV06 } from '../js/migrate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const shipsDir = join(__dirname, '..', 'ships');

function walkDir(dir, callback) {
  const files = readdirSync(dir);
  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (file.endsWith('.json') && file !== 'manifest.json') {
      callback(filePath);
    }
  });
}

let migratedCount = 0;
let skippedCount = 0;

walkDir(shipsDir, (filePath) => {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const config = JSON.parse(content);
    
    // Skip if already v0.6.4
    if (config.meta?.version === '0.6.4') {
      console.log(`⏭  Skipping ${filePath} (already v0.6.4)`);
      skippedCount++;
      return;
    }
    
    // Migrate
    const migrated = migrateToV06(config);
    
    // Write back
    writeFileSync(filePath, JSON.stringify(migrated, null, 2) + '\n', 'utf-8');
    console.log(`✓ Migrated ${filePath} (${config.meta?.version || 'unknown'} → 0.6.4)`);
    migratedCount++;
  } catch (error) {
    console.error(`✗ Failed to migrate ${filePath}:`, error.message);
  }
});

console.log(`\n--- Migration Summary ---`);
console.log(`Migrated: ${migratedCount}`);
console.log(`Skipped: ${skippedCount}`);
console.log(`Total: ${migratedCount + skippedCount}`);
