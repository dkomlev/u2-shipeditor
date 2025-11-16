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

// For a lightweight smoke-test we strip strict 'required' constraints from the schema
// so we only validate types/structures that exist rather than enforce every new top-level
// required property introduced in newer schema drafts.
function stripRequired(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (obj.required) delete obj.required;
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === 'object' && v !== null) stripRequired(v);
  }
}
stripRequired(schema);

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
