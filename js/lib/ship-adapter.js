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

  const HANDLING_STYLE_DEFAULTS = {
    drift: {
      handling_style: "Drift",
      speed_limiter_ratio: 0.9,
      handling: {
        stab_gain: 1.1,
        stab_damping: 0.9,
        slip_threshold_deg: 6,
        slip_limit_deg: 18,
        slip_correction_gain: 1.6,
        nose_follow_input: 0.2,
        anticipation_gain: 0.12,
        oversteer_bias: 0.12,
        bias: 0.15,
        responsiveness: 1.3,
        slip_target_max: 18,
        traction_control: 0.15,
        cap_main_coupled: 0.6,
        lat_authority: 0.95,
        turn_authority: 0.9,
        turn_assist: 0.5,
        traction_floor: 0.35,
        traction_speed_ref: 520,
        strafe_to_slip_gain: 0.55,
        nose_align_gain: 0.08
      },
      jerk: { forward_mps3: 220, lateral_mps3: 180, angular_rps3: 0.25 }
    },
    balanced: {
      handling_style: "Balanced",
      speed_limiter_ratio: 0.85,
      handling: {
        stab_gain: 0.9,
        stab_damping: 1.2,
        slip_threshold_deg: 8,
        slip_limit_deg: 12,
        slip_correction_gain: 1.1,
        nose_follow_input: 0.35,
        anticipation_gain: 0.1,
        oversteer_bias: 0,
        bias: 0,
        responsiveness: 0.9,
        slip_target_max: 12,
        traction_control: 0.4,
        cap_main_coupled: 0.78,
        lat_authority: 0.9,
        turn_authority: 0.85,
        turn_assist: 0.35,
        traction_floor: 0.3,
        traction_speed_ref: 360,
        strafe_to_slip_gain: 0.4,
        nose_align_gain: 0.18
      },
      jerk: { forward_mps3: 160, lateral_mps3: 130, angular_rps3: 0.12 }
    },
    grip: {
      handling_style: "Grip",
      speed_limiter_ratio: 0.8,
      handling: {
        stab_gain: 0.7,
        stab_damping: 1.6,
        slip_threshold_deg: 4,
        slip_limit_deg: 8,
        slip_correction_gain: 1.4,
        nose_follow_input: 0.5,
        anticipation_gain: 0.08,
        oversteer_bias: -0.12,
        bias: -0.15,
        responsiveness: 0.7,
        slip_target_max: 8,
        traction_control: 0.75,
        cap_main_coupled: 0.82,
        lat_authority: 0.9,
        turn_authority: 0.95,
        turn_assist: 0.25,
        traction_floor: 0.4,
        traction_speed_ref: 280,
        strafe_to_slip_gain: 0.35,
        nose_align_gain: 0.32
      },
      jerk: { forward_mps3: 140, lateral_mps3: 120, angular_rps3: 0.08 }
    }
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
    const assistProfile = buildAssistProfile(config, preset);

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
        : `Файл: ${sourcePath || "—"}`,
      assist: assistProfile,
      assist_profile: assistProfile.handling_style,
      assist_slip_limit_deg: assistProfile.handling?.slip_limit_deg ?? null,
      assist_slip_target_max_deg: assistProfile.handling?.slip_target_max ?? null,
      assist_traction_control: assistProfile.handling?.traction_control ?? null,
      assist_cap_main_coupled: assistProfile.handling?.cap_main_coupled ?? null,
      assist_speed_limiter_ratio: assistProfile.speed_limiter_ratio ?? null,
      assist_turn_authority: assistProfile.handling?.turn_authority ?? null
    };
  }

  function mapV053(config, sourcePath) {
    const className = (config.meta?.class || config.meta?.name || "medium freighter").toLowerCase();
    const parts = className.split(/\s+/);
    const size = parts[0] || "medium";
    const typePhrase = parts.slice(1).join(" ") || "freighter";
    const sizeType = `${size} ${typePhrase}`.trim();
    const preset = recommendPreset(sizeType);
    const assistProfile = buildAssistProfile(config, preset);

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
        : `Legacy: ${sourcePath || "—"}`,
      assist: assistProfile,
      assist_profile: assistProfile.handling_style,
      assist_slip_limit_deg: assistProfile.handling?.slip_limit_deg ?? null,
      assist_slip_target_max_deg: assistProfile.handling?.slip_target_max ?? null,
      assist_traction_control: assistProfile.handling?.traction_control ?? null,
      assist_cap_main_coupled: assistProfile.handling?.cap_main_coupled ?? null,
      assist_speed_limiter_ratio: assistProfile.speed_limiter_ratio ?? null,
      assist_turn_authority: assistProfile.handling?.turn_authority ?? null
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

  function buildAssistProfile(config, fallbackPreset) {
    const assist = config.assist || {};
    const styleKey = (assist.handling_style || assist.handlingStyle || "Balanced").toLowerCase();
    const base = HANDLING_STYLE_DEFAULTS[styleKey] || HANDLING_STYLE_DEFAULTS.balanced;
    const handling = {
      stab_gain: clampNumber(assist.handling?.stab_gain ?? base.handling.stab_gain, 0.3, 1.6),
      stab_damping: clampNumber(assist.handling?.stab_damping ?? base.handling.stab_damping, 0.5, 3),
      slip_threshold_deg: clampNumber(assist.handling?.slip_threshold_deg ?? base.handling.slip_threshold_deg, 2, 25),
      slip_limit_deg: clampNumber(assist.handling?.slip_limit_deg ?? base.handling.slip_limit_deg, 4, 30),
      slip_correction_gain: clampNumber(assist.handling?.slip_correction_gain ?? base.handling.slip_correction_gain, 0.2, 3),
      nose_follow_input: clampNumber(assist.handling?.nose_follow_input ?? base.handling.nose_follow_input, 0, 1),
      anticipation_gain: clampNumber(assist.handling?.anticipation_gain ?? base.handling.anticipation_gain, 0, 0.5),
      oversteer_bias: clampNumber(assist.handling?.oversteer_bias ?? base.handling.oversteer_bias, -0.5, 0.5),
      bias: clampNumber(assist.handling?.bias ?? base.handling.bias, -1, 1),
      responsiveness: clampNumber(assist.handling?.responsiveness ?? base.handling.responsiveness, 0.1, 2.5),
      slip_target_max: clampNumber(
        assist.handling?.slip_target_max ?? base.handling.slip_target_max ?? base.handling.slip_limit_deg,
        2,
        40
      ),
      traction_control: clampNumber(assist.handling?.traction_control ?? base.handling.traction_control, 0, 1),
      cap_main_coupled: clampNumber(assist.handling?.cap_main_coupled ?? base.handling.cap_main_coupled, 0.2, 1),
      lat_authority: clampNumber(assist.handling?.lat_authority ?? base.handling.lat_authority, 0.2, 1),
      turn_authority: clampNumber(assist.handling?.turn_authority ?? base.handling.turn_authority ?? 0.7, 0, 2),
      turn_assist: clampNumber(assist.handling?.turn_assist ?? base.handling.turn_assist ?? 0.3, 0, 1),
      traction_floor: clampNumber(assist.handling?.traction_floor ?? base.handling.traction_floor ?? 0.25, 0, 1),
      traction_speed_ref: clampNumber(assist.handling?.traction_speed_ref ?? base.handling.traction_speed_ref ?? 320, 50, 1200),
      strafe_to_slip_gain: clampNumber(assist.handling?.strafe_to_slip_gain ?? base.handling.strafe_to_slip_gain ?? 0.3, 0, 2),
      nose_align_gain: clampNumber(assist.handling?.nose_align_gain ?? base.handling.nose_align_gain ?? 0.1, 0, 1)
    };
    const jerkDefaults = base.jerk || { forward_mps3: 160, lateral_mps3: 120, angular_rps3: 0.8 };
    const jerk = {
      forward_mps3: clampNumber(assist.jerk?.forward_mps3 ?? jerkDefaults.forward_mps3, 10, 800),
      lateral_mps3: clampNumber(assist.jerk?.lateral_mps3 ?? jerkDefaults.lateral_mps3, 10, 600),
      angular_rps3: clampNumber(assist.jerk?.angular_rps3 ?? jerkDefaults.angular_rps3, 0.01, 5)
    };
    return {
      preset: assist.preset || fallbackPreset,
      handling_style: capitalize(base.handling_style),
      speed_limiter_ratio: clampNumber(
        assist.speed_limiter_ratio ?? assist.speed_limiter ?? base.speed_limiter_ratio ?? 0.85,
        0.2,
        1
      ),
      handling,
      jerk
    };
  }

  function clampNumber(value, min, max) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return min;
    }
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }

  function capitalize(value) {
    if (!value) {
      return "";
    }
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }

  return {
    parseShipConfig,
    detectVersion,
    recommendPreset
  };
});
