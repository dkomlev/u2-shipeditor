(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.U2ShipAdapter = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PRESET_RECOMMENDATIONS = {
    "snub fighter": "Sport",
    "small fighter": "Sport",
    "medium fighter": "Muscle",
    "heavy fighter": "Muscle",
    "medium freighter": "Truck",
    "heavy freighter": "Truck",
    "capital freighter": "Hauler",
    default: "Sport"
  };

  function parseShipConfig(config, sourcePath = "unknown") {
    const version = detectVersion(config);
    return version.startsWith("0.6") ? mapV06(config, sourcePath) : mapV053(config, sourcePath);
  }

  function detectVersion(config) {
    const metaVersion = String(config?.meta?.version || "").trim();
    if (metaVersion) {
      return metaVersion;
    }
    if (config.classification) {
      return "0.6";
    }
    return "0.5.3";
  }

  function mapV06(config, sourcePath) {
    const size = config.classification?.size || "small";
    const type = config.classification?.type || "fighter";
    const sizeType = config.classification?.size_type || `${size} ${type}`.trim();
    const preset = config.assist?.preset || recommendPreset(sizeType);

    return {
      id: config.meta?.id || config.meta?.name || "ship",
      name: config.meta?.name || "Без имени",
      version: config.meta?.version || "0.6",
      size,
      type,
      size_type: sizeType,
      preset,
      presetSource: config.assist?.preset ? "config" : "recommended",
      mass_t: config.mass?.dry_t ?? null,
      scm_mps: config.performance?.scm_mps ?? null,
      vmax_mps: config.performance?.vmax_mps ?? null,
      accel_fwd_mps2: config.performance?.accel_fwd_mps2 ?? null,
      strafe_mps2: config.performance?.strafe_mps2 ?? null,
      angular_dps: config.performance?.angular_dps ?? null,
      performanceHint: buildPerformanceHint(config.performance),
      sprite: resolveSprite(config.media?.sprite, sourcePath),
      sourceLabel: sourcePath?.startsWith("local:")
        ? "Импортированный JSON"
        : `Файл: ${sourcePath || "—"}`
    };
  }

  function mapV053(config, sourcePath) {
    const className = (config.meta?.class || config.meta?.name || "medium freighter").toLowerCase();
    const parts = className.split(/\s+/);
    const size = parts[0] || "medium";
    const typePhrase = parts.slice(1).join(" ") || "freighter";
    const sizeType = `${size} ${typePhrase}`.trim();
    const preset = recommendPreset(sizeType);

    const angular = toAngularFromRcs(config.rcs);
    const sprite =
      config.sprite?.path && config.sprite.path.startsWith("assets")
        ? { kind: "path", value: config.sprite.path.replace(/^assets/, "asstets"), alt: config.meta?.name }
        : null;

    return {
      id: config.meta?.id || config.meta?.name || "ship-legacy",
      name: config.meta?.name || config.meta?.class || "Legacy ship",
      version: config.meta?.version || "0.5.3",
      size,
      type: typePhrase || "fighter",
      size_type: sizeType,
      preset,
      presetSource: "recommended",
      mass_t: config.mass?.mass_kg ? config.mass.mass_kg / 1000 : null,
      scm_mps: null,
      vmax_mps: null,
      accel_fwd_mps2: null,
      strafe_mps2: null,
      angular_dps: angular,
      performanceHint: config.g_limits?.profile ? `G-profile: ${config.g_limits.profile}` : null,
      sprite,
      sourceLabel: sourcePath?.startsWith("local:")
        ? "Импортированный JSON (v0.5.3)"
        : `Legacy: ${sourcePath || "—"}`
    };
  }

  function recommendPreset(sizeTypeRaw) {
    const key = (sizeTypeRaw || "").toLowerCase();
    const match = Object.keys(PRESET_RECOMMENDATIONS).find(
      (entry) => entry !== "default" && key.includes(entry)
    );
    return PRESET_RECOMMENDATIONS[match || "default"];
  }

  function resolveSprite(sprite, sourcePath) {
    if (!sprite) {
      return null;
    }
    if (sprite.dataUrl) {
      return { kind: "dataUrl", value: sprite.dataUrl, alt: sprite.name || "ship sprite" };
    }
    if (sprite.path) {
      const normalized =
        sprite.path.startsWith("assets") || sprite.path.startsWith("asstets")
          ? sprite.path.replace(/^assets/, "asstets")
          : sprite.path;
      return { kind: "path", value: normalized, alt: sprite.name || sourcePath };
    }
    return null;
  }

  function buildPerformanceHint(perf) {
    if (!perf) {
      return null;
    }
    const accel = perf.accel_fwd_mps2 ? `${perf.accel_fwd_mps2.toFixed(0)} м/с² accel` : null;
    const strafe = perf.strafe_mps2?.x ? `Strafe ${perf.strafe_mps2.x.toFixed(0)} м/с²` : null;
    return [accel, strafe].filter(Boolean).join(" · ") || null;
  }

  function toAngularFromRcs(rcs) {
    if (!rcs) {
      return null;
    }
    const omega = rcs.turn_omega_max_radps;
    if (!omega) {
      return null;
    }
    const deg = (omega * 180) / Math.PI;
    return { pitch: deg, yaw: deg, roll: deg };
  }

  return {
    parseShipConfig,
    detectVersion,
    recommendPreset
  };
});
