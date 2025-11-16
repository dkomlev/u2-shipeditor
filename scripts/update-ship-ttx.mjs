#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getNominals } from "../js/nominals.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const SHIPS_DIR = path.join(ROOT, "ships");

const RCS_RATIO = {
  snub: 0.3,
  small: 0.3,
  medium: 0.3,
  heavy: 0.2,
  capital: 0.2
};

function collectShipConfigs(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectShipConfigs(fullPath);
    }
    if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith("-config.json") &&
      !entry.name.toLowerCase().includes("manifest")
    ) {
      return [fullPath];
    }
    return [];
  });
}

function getRcsRatio(size) {
  return RCS_RATIO[size?.toLowerCase()] ?? 0.25;
}

function round(value, digits = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : value;
}

function resolveTemplate(size, type, isStealth) {
  const direct = getNominals(size, type, isStealth);
  if (direct) return direct;
  if (size === "snub") {
    const fallback = getNominals("small", type, isStealth);
    if (fallback) return fallback;
  }
  return null;
}

function updateShipConfig(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  const cls = data.classification || {};
  const size = (cls.size || "").toLowerCase();
  const type = (cls.type || "").toLowerCase();
  const isStealth = (cls.stealth || "").toLowerCase() === "stealth";

  const tpl = resolveTemplate(size, type, isStealth);
  if (!tpl) {
    console.warn(`WARN: No nominal found for ${size} ${type} (${filePath})`);
    return false;
  }

  data.performance = data.performance || {};
  data.performance.accel_fwd_mps2 = tpl.performance?.accel_fwd_mps2 ?? data.performance.accel_fwd_mps2;
  data.performance.strafe_mps2 = tpl.performance?.strafe_mps2 ?? data.performance.strafe_mps2;

  if (tpl.performance?.omega_cap_dps) {
    data.performance.omega_cap_dps = {
      pitch: tpl.performance.omega_cap_dps.pitch,
      yaw: tpl.performance.omega_cap_dps.yaw,
      roll: tpl.performance.omega_cap_dps.roll
    };
  }

  const mass_t = data.mass?.dry_t ?? tpl.mass?.dry_t;
  const accelFwd = data.performance.accel_fwd_mps2;
  if (mass_t && accelFwd) {
    const mainThrustMN = (mass_t * accelFwd) / 1000;
    data.propulsion = data.propulsion || {};
    data.propulsion.main_thrust_MN = round(mainThrustMN);
    const rcsRatio = getRcsRatio(size);
    data.propulsion.rcs_budget_MN = round(mainThrustMN * rcsRatio);
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
  return true;
}

function main() {
  const files = collectShipConfigs(SHIPS_DIR);
  let updated = 0;
  files.forEach((file) => {
    if (updateShipConfig(file)) {
      updated += 1;
    }
  });
  console.log(`Updated ${updated} ship configs with v0.7.4 nominal TTX.`);
}

main();
