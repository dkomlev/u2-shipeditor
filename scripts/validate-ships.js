// Validate all ship configs against the latest schema
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, '..', 'config', 'shipconfig.schema.json');
const shipsDir = path.join(__dirname, '..', 'ships');

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
if (schema.$schema) delete schema.$schema;

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

function collectConfigs(dir) {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      return collectConfigs(fullPath);
    }
    if (entry.endsWith('-config.json')) {
      return [fullPath];
    }
    return [];
  });
}

const configs = collectConfigs(shipsDir);
let failures = 0;

configs.forEach((configPath) => {
  try {
    const data = JSON.parse(readFileSync(configPath, 'utf8'));
    const valid = validate(data);
    if (!valid) {
      failures++;
      console.error(`FAIL ${configPath}`);
      console.error(validate.errors);
    } else {
      console.log(`PASS ${configPath}`);
    }
  } catch (err) {
    failures++;
    console.error(`ERROR ${configPath}: ${err.message}`);
  }
});

if (failures) {
  console.error(`\nValidation failed for ${failures} config(s).`);
  process.exit(1);
}

console.log(`\nValidation succeeded for ${configs.length} configs.`);
