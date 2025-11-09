import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import { buildEmptyConfig } from '../js/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemaPath = path.join(__dirname, '../config/shipconfig.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
// Remove $schema reference to avoid Ajv trying to load external meta-schema
if (schema && schema.$schema) delete schema.$schema;

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

const ship = buildEmptyConfig();
const valid = validate(ship);
if (valid) {
  console.log('SMOKE TEST: PASS — buildEmptyConfig() validates against schema');
  process.exit(0);
} else {
  console.error('SMOKE TEST: FAIL — validation errors:');
  console.error(validate.errors);
  process.exit(2);
}
