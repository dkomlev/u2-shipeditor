export const SIZE = ["snub","small","medium","heavy","capital"];
export const TYPE = [
  "shuttle","fighter","interceptor","gunship","bomber","dropship","courier",
  "freighter","exploration","passenger","miner","tanker","salvager","repair",
  "recon","corvette","frigate","destroyer","carrier","dreadnought"
];
export const STEALTH = ["standard","stealth"];
export const PRESET = ["Balanced","Sport","Rally","Muscle","F1","Industrial","Truck","Warship","Liner","Recon"];

export const sizeType = (size, type) => `${size} ${type}`;

export function buildEmptyConfig({
  id = (crypto?.randomUUID?.() || String(Date.now())),
  name = "New Ship",
  version = "0.6.0",
  author = ""
} = {}) {
  return {
    meta: { id, name, version, author },
    classification: { size: "small", type: "fighter", size_type: "small fighter", stealth: "standard", variant: "" },
    geometry: {
      length_m: 20,
      width_m: 14,
      height_m: 5,
      hull_radius_m: Number((Math.hypot(20, 14) / 2).toFixed(2))
    },
    mass: { dry_t: 60 },
    inertia_opt: { Ixx: null, Iyy: null, Izz: null },
    signatures: { IR: 3, EM: 3, CS: 3 },
    performance: {
      scm_mps: 200, vmax_mps: 1100, accel_fwd_mps2: 60,
      strafe_mps2: { x: 60, y: 60, z: 60 },
      angular_dps: { pitch: 80, yaw: 70, roll: 110 },
      angular_accel_opt: { pitch: null, yaw: null, roll: null }
    },
    propulsion: { main_thrust_MN: (60*60)/1e6, rcs_budget_MN: 1.0 },
    power_opt: { reactor_MW: null, cooling_MW: null },
    payload: { cargo_scu: 0, crew: "1" },
    hardpoints_opt: { fixed: [], gimbals: [], turrets: [], missiles: [] },
    weapons: { summary: "" },
    assist: {
      preset: "Sport", slip_lim_deg: 15, stab_gain: 0.75, oversteer_bias: 0.2,
      cap_main_coupled: 0.85, speed_limiter_ratio: 0.8,
      brake_g_sustain: 7.0, brake_g_boost: 10.0,
      boost_duration_s: 3.0, boost_cooldown_s: 12
    },
    media: {
      sprite: { name: "", dataUrl: "", path: "", width: null, height: null }
    },
    notes_opt: ""
  };
}
