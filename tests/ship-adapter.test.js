"use strict";

const path = require("path");
const fs = require("fs");
let adapter = require("../js/lib/ship-adapter.js");
if (!adapter || typeof adapter.parseShipConfig !== "function") {
  adapter = (globalThis && globalThis.U2ShipAdapter) || adapter || {};
}

function loadJson(relPath) {
  const fullPath = path.join(__dirname, "..", relPath);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const samples = [
    {
      file: "ships/fighter/small fighter 06-config.json",
      expect: {
        version: "0.6",
        size_type: "small fighter"
      }
    },
    {
      file: "ships/freighters/medium freighter 2-config.json",
      expect: {
        size: "medium"
      }
    }
  ];

  samples.forEach((sample) => {
    const json = loadJson(sample.file);
    const summary = adapter.parseShipConfig(json, sample.file);
    assert(summary.name, `summary.name missing for ${sample.file}`);
    if (sample.expect.version) {
      assert(
        summary.version.startsWith(sample.expect.version),
        `version mismatch for ${sample.file}`
      );
    }
    if (sample.expect.size_type) {
      assert(
        summary.size_type === sample.expect.size_type,
        `size_type mismatch for ${sample.file}`
      );
    }
    if (sample.expect.size) {
      assert(summary.size === sample.expect.size, `size mismatch for ${sample.file}`);
    }
  });

  console.log("ship-adapter.test.js: OK");
}

if (require.main === module) {
  run();
}
