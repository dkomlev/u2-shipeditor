"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PACKAGE_PATH = path.join(ROOT, "package.json");
const BUILD_INFO_JSON = path.join(ROOT, "build-info.json");
const BUILD_INFO_JS = path.join(ROOT, "js", "lib", "build-info.js");

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function padBuild(num) {
  return num.toString().padStart(3, "0");
}

function renderBuildInfoModule(info) {
  const padded = padBuild(info.build);
  const label = `v${info.version} build ${padded}`;
  return `"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.U2BuildInfo = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const buildInfo = {
    version: "${info.version}",
    build: ${info.build},
    buildId: "${padded}",
    label: "${label}",
    updatedAt: "${info.updatedAt}"
  };

  buildInfo.toString = function toString() {
    return buildInfo.label;
  };

  buildInfo.valueOf = function valueOf() {
    return buildInfo.build;
  };

  buildInfo.asBadge = function asBadge() {
    return buildInfo.label;
  };

  return buildInfo;
});
`;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main() {
  const pkg = readJson(PACKAGE_PATH, { version: "0.0.0" });
  const now = new Date().toISOString();
  const existing = readJson(BUILD_INFO_JSON, {
    version: pkg.version,
    build: 0,
    updatedAt: now
  });

  if (existing.version !== pkg.version) {
    existing.version = pkg.version;
    existing.build = 0;
  }

  existing.build = typeof existing.build === "number"
    ? existing.build + 1
    : 1;
  existing.updatedAt = now;

  ensureDir(BUILD_INFO_JS);
  fs.writeFileSync(BUILD_INFO_JSON, JSON.stringify(existing, null, 2) + "\n");
  fs.writeFileSync(BUILD_INFO_JS, renderBuildInfoModule(existing));

  const padded = padBuild(existing.build);
  console.log(`Build bumped: v${existing.version} build ${padded}`);
}

main();
