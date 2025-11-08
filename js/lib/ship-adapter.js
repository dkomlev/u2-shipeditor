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

    const accel = extractAccel(config.performance);
    const mainDrive = config.propulsion?.main_drive;
    const thrustToWeight = computeThrustToWeight(mainDrive?.max_thrust_kN, config.mass?.dry_t);
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
      forward_accel_mps2: accel.forward,
      lateral_accel_mps2: accel.lateral,
      thrust_to_weight: thrustToWeight,
      angular_dps: config.performance?.angular_dps ?? null,
      performanceHint: buildPerformanceHint(accel),
      sprite: resolveSprite(config.media?.sprite, sourcePath),
      power_MW: mainDrive?.max_power_MW ?? config.power_opt?.reactor_MW ?? null,
      tags: Array.isArray(config.tags) ? config.tags : [],
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
      forward_accel_mps2: config.performance?.accel_fwd_mps2 ?? null,
      lateral_accel_mps2: config.performance?.strafe_mps2?.x ?? null,
      thrust_to_weight: computeThrustToWeight(config.propulsion?.main_thrust_MN ? config.propulsion.main_thrust_MN * 1000 : null, config.mass?.dry_t),
      angular_dps: angular,
      performanceHint: buildPerformanceHint({
        forward: config.performance?.accel_fwd_mps2 ?? null,
        lateral: config.performance?.strafe_mps2?.x ?? null
      }),
      sprite,
      power_MW: config.power_opt?.reactor_MW ?? null,
      tags: Array.isArray(config.tags) ? config.tags : [size, typePhrase],
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

  function extractAccel(perf) {
    if (perf?.accel_profile) {
      return {
        forward: perf.accel_profile.forward_mps2 ?? null,
        lateral: perf.accel_profile.lateral_mps2 ?? null
      };
    }
    return {
      forward: perf?.accel_fwd_mps2 ?? null,
      lateral: perf?.strafe_mps2?.x ?? null
    };
  }

  function computeThrustToWeight(maxThrust_kN, mass_t) {
    if (!maxThrust_kN || !mass_t) {
      return null;
    }
    const thrustN = maxThrust_kN * 1000;
    const weightN = mass_t * 1000 * 9.80665;
    if (!weightN) {
      return null;
    }
    return thrustN / weightN;
  }

  function buildPerformanceHint(accel) {
    if (!accel) {
      return null;
    }
    const forward = typeof accel.forward === "number" ? `${accel.forward.toFixed(0)} м/с² fwd` : null;
    const lateral = typeof accel.lateral === "number" ? `${accel.lateral.toFixed(0)} м/с² lat` : null;
    return [forward, lateral].filter(Boolean).join(" · ") || null;
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
