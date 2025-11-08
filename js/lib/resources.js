(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./ship-adapter.js"));
  } else {
    root.U2Resources = factory(
      (typeof root !== "undefined" && root.U2ShipAdapter) || (typeof globalThis !== "undefined" && globalThis.U2ShipAdapter)
    );
  }
})(typeof self !== "undefined" ? self : this, function (shipAdapter) {
  "use strict";

  const MANIFEST_PATH = "ships/manifest.json";
  const manifestState = {
    data: null,
    promise: null
  };
  const shipCache = new Map();

  async function loadManifest() {
    if (manifestState.data) {
      return manifestState.data;
    }
    if (!manifestState.promise) {
      manifestState.promise = fetch(MANIFEST_PATH, { cache: "no-store" })
        .then((resp) => {
          if (!resp.ok) {
            throw new Error(`Не удалось загрузить manifest: ${resp.status}`);
          }
          return resp.json();
        })
        .then((list) => {
          manifestState.data = Array.isArray(list) ? list.map(normalizeEntry) : [];
          return manifestState.data;
        })
        .finally(() => {
          manifestState.promise = null;
        });
    }
    return manifestState.promise;
  }

  function normalizeEntry(entry) {
    if (!entry) {
      return entry;
    }
    if (!entry.summary) {
      entry.summary = {
        name: entry.name,
        size: entry.size,
        type: entry.type,
        size_type: entry.size && entry.type ? `${entry.size} ${entry.type}` : entry.size || entry.type || "",
        tags: entry.tags || [],
        sprite: entry.preview || null,
        forward_accel_mps2: entry.forward_accel_mps2 ?? null,
        lateral_accel_mps2: entry.lateral_accel_mps2 ?? null,
        thrust_to_weight: entry.thrust_to_weight ?? null,
        power_MW: entry.power_MW ?? null
      };
    }
    return entry;
  }

  function getManifestSync() {
    return manifestState.data;
  }

  async function getShipConfig(path) {
    if (shipCache.has(path)) {
      return shipCache.get(path);
    }
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Не удалось загрузить ${path}: ${response.status}`);
    }
    const json = await response.json();
    shipCache.set(path, json);
    return json;
  }

  async function getShipSummary(path) {
    const manifest = manifestState.data || (await loadManifest());
    const entry = manifest?.find((item) => item.path === path);
    if (entry?.summary) {
      return entry.summary;
    }
    const json = await getShipConfig(path);
    return shipAdapter ? shipAdapter.parseShipConfig(json, path) : null;
  }

  function invalidateManifest() {
    manifestState.data = null;
  }

  return {
    loadManifest,
    getManifestSync,
    getShipConfig,
    getShipSummary,
    invalidateManifest
  };
});
