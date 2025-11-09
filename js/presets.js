export const HANDLING_STYLES = ["Balanced", "Drift", "Grip"];

const STYLE_TEMPLATES = {
  Balanced: {
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
      cap_main_coupled: 0.75,
      lat_authority: 0.85,
      turn_authority: 0.75,
      turn_assist: 0.35,
      traction_floor: 0.3,
      traction_speed_ref: 320,
      nose_align_gain: 0.15
    },
    jerk: { forward_mps3: 160, lateral_mps3: 130 },
    brake: { g_sustain: 4.5, g_boost: 6.5, boost_duration_s: 3.5, boost_cooldown_s: 15 }
  },
  Drift: {
    handling_style: "Drift",
    speed_limiter_ratio: 0.9,
    handling: {
      stab_gain: 1.0,
      stab_damping: 0.9,
      slip_threshold_deg: 8,
      slip_limit_deg: 18,
      slip_correction_gain: 1.5,
      nose_follow_input: 0.25,
      anticipation_gain: 0.14,
      oversteer_bias: 0.15,
      bias: 0.2,
      responsiveness: 1.2,
      slip_target_max: 18,
      traction_control: 0.2,
      cap_main_coupled: 0.8,
      lat_authority: 0.95,
      turn_authority: 0.95,
      turn_assist: 0.55,
      traction_floor: 0.2,
      traction_speed_ref: 350,
      nose_align_gain: 0.05
    },
    jerk: { forward_mps3: 220, lateral_mps3: 180 },
    brake: { g_sustain: 6.5, g_boost: 9.5, boost_duration_s: 3.0, boost_cooldown_s: 12 }
  },
  Grip: {
    handling_style: "Grip",
    speed_limiter_ratio: 0.8,
    handling: {
      stab_gain: 0.8,
      stab_damping: 1.6,
      slip_threshold_deg: 5,
      slip_limit_deg: 9,
      slip_correction_gain: 1.3,
      nose_follow_input: 0.5,
      anticipation_gain: 0.08,
      oversteer_bias: -0.12,
      bias: -0.15,
      responsiveness: 0.7,
      slip_target_max: 8,
      traction_control: 0.75,
      cap_main_coupled: 0.7,
      lat_authority: 0.75,
      turn_authority: 0.5,
      turn_assist: 0.25,
      traction_floor: 0.45,
      traction_speed_ref: 280,
      nose_align_gain: 0.25
    },
    jerk: { forward_mps3: 140, lateral_mps3: 110 },
    brake: { g_sustain: 3.2, g_boost: 5.0, boost_duration_s: 3.5, boost_cooldown_s: 18 }
  }
};

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const deepMerge = (target, source) => {
  const output = Array.isArray(target) ? [...target] : { ...target };
  if (!source || typeof source !== "object") {
    return output;
  }
  Object.keys(source).forEach((key) => {
    const srcVal = source[key];
    if (Array.isArray(srcVal)) {
      output[key] = srcVal.map((item) => (typeof item === "object" ? deepMerge({}, item) : item));
    } else if (srcVal && typeof srcVal === "object") {
      output[key] = deepMerge(output[key] || {}, srcVal);
    } else {
      output[key] = srcVal;
    }
  });
  return output;
};

const createPreset = (style, overrides = {}) => {
  const base = deepClone(STYLE_TEMPLATES[style] || STYLE_TEMPLATES.Balanced);
  return deepMerge(base, overrides);
};

export const ASSIST = {
  Balanced: createPreset("Balanced"),
  Sport: createPreset("Drift", {
    speed_limiter_ratio: 0.82,
    handling: {
      oversteer_bias: 0.2,
      cap_main_coupled: 0.85,
      slip_target_max: 19
    },
    brake: { g_sustain: 7.0, g_boost: 10.0 }
  }),
  Rally: createPreset("Drift", {
    speed_limiter_ratio: 0.85,
    handling: {
      slip_limit_deg: 20,
      slip_target_max: 20,
      oversteer_bias: 0.25,
      responsiveness: 1.3
    },
    brake: { g_sustain: 7.5, g_boost: 10.2 }
  }),
  Muscle: createPreset("Drift", {
    speed_limiter_ratio: 0.78,
    handling: {
      responsiveness: 1.1,
      cap_main_coupled: 0.7,
      traction_control: 0.25,
      slip_limit_deg: 16
    },
    brake: { g_sustain: 5.5, g_boost: 8.0, boost_cooldown_s: 14 }
  }),
  F1: createPreset("Grip", {
    speed_limiter_ratio: 0.9,
    handling: {
      stab_gain: 0.95,
      cap_main_coupled: 0.82,
      traction_control: 0.65,
      slip_limit_deg: 10,
      slip_target_max: 10
    },
    brake: { g_sustain: 6.5, g_boost: 9.0, boost_duration_s: 3.0, boost_cooldown_s: 12 }
  }),
  Industrial: createPreset("Balanced", {
    speed_limiter_ratio: 0.7,
    handling: {
      cap_main_coupled: 0.6,
      traction_control: 0.55,
      responsiveness: 0.8
    },
    brake: { g_sustain: 4.0, g_boost: 6.0, boost_duration_s: 3.5, boost_cooldown_s: 18 }
  }),
  Truck: createPreset("Grip", {
    speed_limiter_ratio: 0.65,
    handling: {
      cap_main_coupled: 0.55,
      traction_control: 0.85,
      slip_limit_deg: 8,
      slip_target_max: 8,
      lat_authority: 0.7
    },
    jerk: { forward_mps3: 120, lateral_mps3: 90 },
    brake: { g_sustain: 2.5, g_boost: 3.5, boost_duration_s: 5.0, boost_cooldown_s: 25 }
  }),
  Warship: createPreset("Grip", {
    speed_limiter_ratio: 0.62,
    handling: {
      stab_gain: 0.85,
      stab_damping: 1.8,
      traction_control: 0.8,
      cap_main_coupled: 0.6
    },
    brake: { g_sustain: 2.2, g_boost: 3.6, boost_duration_s: 6.0, boost_cooldown_s: 35 }
  }),
  Liner: createPreset("Grip", {
    speed_limiter_ratio: 0.66,
    handling: {
      traction_control: 0.78,
      responsiveness: 0.65,
      oversteer_bias: -0.2
    },
    brake: { g_sustain: 2.6, g_boost: 3.6, boost_duration_s: 5.0, boost_cooldown_s: 22 }
  }),
  Recon: createPreset("Balanced", {
    speed_limiter_ratio: 0.7,
    handling: {
      slip_limit_deg: 10,
      slip_target_max: 10,
      traction_control: 0.55,
      cap_main_coupled: 0.6
    },
    brake: { g_sustain: 3.5, g_boost: 5.0, boost_duration_s: 3.0, boost_cooldown_s: 12 }
  })
};


export const ARCH_PRESET = [
  { size:"snub",    type:"shuttle",     preset:"Balanced" },
  { size:"small",   type:"fighter",     preset:"Sport" },
  { size:"medium",  type:"fighter",     preset:"Muscle" },
  { size:"heavy",   type:"fighter",     preset:"Muscle" },
  { size:"small",   type:"interceptor", preset:"Rally" },
  { size:"medium",  type:"gunship",     preset:"Warship" },
  { size:"medium",  type:"bomber",      preset:"Warship" },
  { size:"medium",  type:"dropship",    preset:"Truck" },
  { size:"small",   type:"courier",     preset:"F1" },
  { size:"small",   type:"freighter",   preset:"Truck" },
  { size:"medium",  type:"freighter",   preset:"Truck" },
  { size:"heavy",   type:"freighter",   preset:"Truck" },
  { size:"capital", type:"freighter",   preset:"Truck" },
  { size:"small",   type:"exploration", preset:"Balanced" },
  { size:"medium",  type:"exploration", preset:"Balanced" },
  { size:"heavy",   type:"exploration", preset:"Balanced" },
  { size:"small",   type:"passenger",   preset:"Liner" },
  { size:"medium",  type:"passenger",   preset:"Liner" },
  { size:"heavy",   type:"passenger",   preset:"Liner" },
  { size:"small",   type:"miner",       preset:"Industrial" },
  { size:"medium",  type:"miner",       preset:"Industrial" },
  { size:"heavy",   type:"miner",       preset:"Industrial" },
  { size:"capital", type:"miner",       preset:"Industrial" },
  { size:"small",   type:"tanker",      preset:"Truck" },
  { size:"medium",  type:"tanker",      preset:"Truck" },
  { size:"heavy",   type:"tanker",      preset:"Truck" },
  { size:"capital", type:"tanker",      preset:"Truck" },
  { size:"small",   type:"salvager",    preset:"Industrial" },
  { size:"medium",  type:"salvager",    preset:"Industrial" },
  { size:"heavy",   type:"salvager",    preset:"Industrial" },
  { size:"capital", type:"salvager",    preset:"Industrial" },
  { size:"small",   type:"repair",      preset:"Industrial" },
  { size:"medium",  type:"repair",      preset:"Industrial" },
  { size:"heavy",   type:"repair",      preset:"Industrial" },
  { size:"small",   type:"recon",       preset:"Recon" },
  { size:"medium",  type:"recon",       preset:"Recon" },
  { size:"capital", type:"corvette",    preset:"Warship" },
  { size:"capital", type:"frigate",     preset:"Warship" },
  { size:"capital", type:"destroyer",   preset:"Warship" },
  { size:"capital", type:"carrier",     preset:"Warship" },
  { size:"capital", type:"dreadnought", preset:"Warship" }
];

const clamp01 = (value) => Math.max(0, Math.min(1, value));

export function cloneAssistPreset(name = "Balanced") {
  return deepClone(ASSIST[name] || ASSIST.Balanced);
}

export function applyStealthMode(assist, type) {
  const tuned = deepClone(assist);
  if (type === "recon") {
    return tuned;
  }
  tuned.handling.cap_main_coupled = Number((tuned.handling.cap_main_coupled * 0.85).toFixed(3));
  tuned.speed_limiter_ratio = Number((tuned.speed_limiter_ratio * 0.9).toFixed(3));
  tuned.handling.slip_limit_deg = Number((tuned.handling.slip_limit_deg * 0.92).toFixed(2));
  tuned.handling.slip_target_max = Number((tuned.handling.slip_target_max * 0.92).toFixed(2));
  tuned.handling.traction_control = Number(clamp01(tuned.handling.traction_control + 0.05).toFixed(3));
  return tuned;
}
