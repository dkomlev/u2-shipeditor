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

  async function fetchWithFallback(path) {
    const candidates = [
      path,
      (typeof location !== 'undefined' ? new URL(path, location.href).pathname.replace(/[^/]+\/[.]{0}/,'') : null),
      `../${path}`,
      `../../${path}`,
      `/${path}`
    ].filter(Boolean);
    let lastErr = null;
    for (const url of candidates) {
      try {
        const resp = await fetch(url, { cache: "no-store" });
        if (resp && resp.ok) return resp;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error(`Не удалось загрузить ${path}`);
  }
  const shipCache = new Map();

  async function loadManifest() {
    if (manifestState.data) {
      return manifestState.data;
    }
    if (!manifestState.promise) {
      manifestState.promise = fetchWithFallback(MANIFEST_PATH)
        .then((resp) => resp.json())
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
        power_MW: entry.power_MW ?? null,
        assist_profile: entry.assist_profile ?? null,
        assist_slip_limit_deg: entry.assist_slip_limit_deg ?? null,
        assist_traction_control: entry.assist_traction_control ?? null,
        assist_speed_limiter_ratio: entry.assist_speed_limiter_ratio ?? null,
        assist_turn_authority: entry.assist_turn_authority ?? null,
        assist: entry.assist ?? null
      };
    } else {
      const mappings = [
        "assist_profile",
        "assist_slip_limit_deg",
        "assist_traction_control",
        "assist_speed_limiter_ratio",
        "assist_turn_authority",
        "forward_accel_mps2",
        "lateral_accel_mps2",
        "thrust_to_weight",
        "power_MW"
      ];
      mappings.forEach((key) => {
        if (entry[key] !== undefined && entry.summary[key] == null) {
          entry.summary[key] = entry[key];
        }
      });
      if (!entry.summary.assist && entry.assist) {
        entry.summary.assist = entry.assist;
      }
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
    const response = await (async () => {
      try { return await fetch(path, { cache: "no-store" }); } catch (_) {}
      try { return await fetch(`../${path}`, { cache: "no-store" }); } catch (_) {}
      try { return await fetch(`../../${path}`, { cache: "no-store" }); } catch (_) {}
      try { return await fetch(`/${path}`, { cache: "no-store" }); } catch (e) { throw e; }
    })();
    if (!response || !response.ok) {
      throw new Error(`Не удалось загрузить ${path}: ${response ? response.status : 'fetch failed'}`);
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
