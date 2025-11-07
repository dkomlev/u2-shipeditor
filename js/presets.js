export const ASSIST = {
  Balanced:  { slip_lim_deg:12, stab_gain:0.90, oversteer_bias:0.00, cap_main_coupled:0.75, speed_limiter_ratio:0.75, brake_g_sustain:4.5, brake_g_boost:6.5,  boost_duration_s:3.5, boost_cooldown_s:15 },
  Sport:     { slip_lim_deg:15, stab_gain:0.75, oversteer_bias:0.20, cap_main_coupled:0.85, speed_limiter_ratio:0.80, brake_g_sustain:7.0, brake_g_boost:10.0, boost_duration_s:3.0, boost_cooldown_s:12 },
  Rally:     { slip_lim_deg:18, stab_gain:0.70, oversteer_bias:0.30, cap_main_coupled:0.90, speed_limiter_ratio:0.85, brake_g_sustain:7.5, brake_g_boost:10.0, boost_duration_s:3.0, boost_cooldown_s:12 },
  Muscle:    { slip_lim_deg:10, stab_gain:0.80, oversteer_bias:0.00, cap_main_coupled:0.75, speed_limiter_ratio:0.75, brake_g_sustain:5.5, brake_g_boost:8.0,  boost_duration_s:3.0, boost_cooldown_s:14 },
  F1:        { slip_lim_deg:8,  stab_gain:0.95, oversteer_bias:0.00, cap_main_coupled:0.80, speed_limiter_ratio:0.85, brake_g_sustain:6.5, brake_g_boost:9.0,  boost_duration_s:3.0, boost_cooldown_s:12 },
  Industrial:{ slip_lim_deg:10, stab_gain:0.96, oversteer_bias:-0.15,cap_main_coupled:0.60, speed_limiter_ratio:0.60, brake_g_sustain:4.0, brake_g_boost:6.0,  boost_duration_s:3.5, boost_cooldown_s:18 },
  Truck:     { slip_lim_deg:8,  stab_gain:0.95, oversteer_bias:-0.30,cap_main_coupled:0.55, speed_limiter_ratio:0.60, brake_g_sustain:2.5, brake_g_boost:3.5,  boost_duration_s:5.0, boost_cooldown_s:25 },
  Warship:   { slip_lim_deg:7,  stab_gain:0.95, oversteer_bias:-0.10,cap_main_coupled:0.60, speed_limiter_ratio:0.60, brake_g_sustain:2.0, brake_g_boost:3.5,  boost_duration_s:6.0, boost_cooldown_s:35 },
  Liner:     { slip_lim_deg:8,  stab_gain:0.95, oversteer_bias:-0.25,cap_main_coupled:0.55, speed_limiter_ratio:0.60, brake_g_sustain:2.5, brake_g_boost:3.5,  boost_duration_s:5.0, boost_cooldown_s:22 },
  Recon:     { slip_lim_deg:6,  stab_gain:0.98, oversteer_bias:0.00, cap_main_coupled:0.40, speed_limiter_ratio:0.65, brake_g_sustain:3.5, brake_g_boost:5.0,  boost_duration_s:3.0, boost_cooldown_s:12 }
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

export function applyStealthMode(assist, type) {
  const a = { ...assist };
  if (type === "recon") return a;
  a.cap_main_coupled *= 0.8;
  a.speed_limiter_ratio *= 0.9;
  return a;
}
