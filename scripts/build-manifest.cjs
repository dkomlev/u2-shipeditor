"use strict";

const fs = require("fs");
const path = require("path");
let shipAdapter = require("../js/lib/ship-adapter.js");
if (!shipAdapter || typeof shipAdapter.parseShipConfig !== "function") {
  shipAdapter = (globalThis && globalThis.U2ShipAdapter) || shipAdapter || {};
}

const ROOT = path.resolve(__dirname, "..");
const SHIPS_DIR = path.join(ROOT, "ships");
const MANIFEST_PATH = path.join(SHIPS_DIR, "manifest.json");

function collectShipFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return collectShipFiles(fullPath);
    }
    if (!entry.isFile()) {
      return [];
    }
    if (!entry.name.toLowerCase().endsWith(".json")) {
      return [];
    }
    if (entry.name.toLowerCase() === "manifest.json") {
      return [];
    }
    return [fullPath];
  });
}

function toPosix(relPath) {
  return relPath.split(path.sep).join("/");
}

function buildEntry(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const relPath = toPosix(path.relative(ROOT, filePath));
  const summary = shipAdapter.parseShipConfig(raw, relPath);
  return {
    path: relPath,
    name: summary.name,
    size: summary.size,
    type: summary.type,
    tags: raw.tags || summary.tags || [],
    preview: summary.sprite || null,
    forward_accel_mps2: summary.forward_accel_mps2 ?? null,
    lateral_accel_mps2: summary.lateral_accel_mps2 ?? null,
    thrust_to_weight: summary.thrust_to_weight ?? null,
    power_MW: summary.power_MW ?? null,
    assist_profile: summary.assist_profile,
    assist_slip_limit_deg: summary.assist_slip_limit_deg,
    assist_speed_limiter_ratio: summary.assist_speed_limiter_ratio,
    assist_traction_control: summary.assist_traction_control,
    assist_turn_authority: summary.assist_turn_authority,
    summary
  };
}

function main() {
  const files = collectShipFiles(SHIPS_DIR);
  if (!files.length) {
    throw new Error("В каталоге ships не найдено ShipConfig JSON.");
  }
  const manifest = files.map(buildEntry).sort((a, b) => a.name.localeCompare(b.name, "ru-RU"));
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Manifest rebuilt (${manifest.length} entries) → ${path.relative(ROOT, MANIFEST_PATH)}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  buildManifest: () => {
    const files = collectShipFiles(SHIPS_DIR);
    return files.map(buildEntry);
  }
};
