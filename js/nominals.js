// Typicals derived from SC/ED averages, adjusted to U2 envelopes (SI units)
// main_thrust_MN ~= mass_t * accel_fwd_mps2 / 1000

export const RCS_RATIO = { small:0.30, medium:0.30, heavy:0.20, capital:0.20, snub:0.30 };
export const computeHullRadius = (length, width) => {
  if (!(length > 0) || !(width > 0)) return null;
  return Number((Math.hypot(length, width) / 2).toFixed(2));
};
const tier = s => (s==='snub'||s==='small')?'small':(s==='medium'?'medium':(s==='heavy'?'heavy':'capital'));

export const NOMINALS = {
  "snub shuttle": {
    size:"snub", type:"shuttle", preset:"Balanced", stealth:"standard",
    geometry:{length_m:9, width_m:7, height_m:3}, mass:{dry_t:8},
    signatures:{IR:2,EM:2,CS:2},
    performance:{scm_mps:180, vmax_mps:800, accel_fwd_mps2:50,
      strafe_mps2:{x:45,y:45,z:45}, angular_dps:{pitch:80,yaw:80,roll:120}},
    payload:{cargo_scu:0, crew:"1"}, weapons:{summary:"2×S1"}
  },
  "small fighter": {
    size:"small", type:"fighter", preset:"Sport", stealth:"standard",
    geometry:{length_m:18, width_m:13, height_m:4}, mass:{dry_t:55},
    signatures:{IR:2,EM:2,CS:2},
    performance:{scm_mps:230, vmax_mps:1200, accel_fwd_mps2:80,
      strafe_mps2:{x:80,y:80,z:80}, angular_dps:{pitch:90,yaw:75,roll:120}},
    payload:{cargo_scu:0, crew:"1"}, weapons:{summary:"2–3×S3 + missiles"}
  },
  "medium fighter": {
    size:"medium", type:"fighter", preset:"Muscle", stealth:"standard",
    geometry:{length_m:24, width_m:16, height_m:5}, mass:{dry_t:80},
    signatures:{IR:3,EM:3,CS:3},
    performance:{scm_mps:250, vmax_mps:1230, accel_fwd_mps2:70,
      strafe_mps2:{x:70,y:70,z:70}, angular_dps:{pitch:105,yaw:95,roll:140}},
    payload:{cargo_scu:0, crew:"1"}, weapons:{summary:"3–4×S3/4, missiles"}
  },
  "heavy fighter": {
    size:"heavy", type:"fighter", preset:"Muscle", stealth:"standard",
    geometry:{length_m:38, width_m:25, height_m:8}, mass:{dry_t:110},
    signatures:{IR:3,EM:3,CS:3},
    performance:{scm_mps:210, vmax_mps:1075, accel_fwd_mps2:50,
      strafe_mps2:{x:55,y:55,z:55}, angular_dps:{pitch:44,yaw:38,roll:124}},
    payload:{cargo_scu:0, crew:"1–2"}, weapons:{summary:"nose S5 + turrets"}
  },
  "small interceptor": {
    size:"small", type:"interceptor", preset:"Rally", stealth:"standard",
    geometry:{length_m:20, width_m:14, height_m:4}, mass:{dry_t:45},
    signatures:{IR:2,EM:2,CS:2},
    performance:{scm_mps:260, vmax_mps:1400, accel_fwd_mps2:90,
      strafe_mps2:{x:85,y:85,z:85}, angular_dps:{pitch:95,yaw:80,roll:130}},
    payload:{cargo_scu:0, crew:"1"}, weapons:{summary:"2×S3 + 6×S1–S2 missiles"}
  },
  "medium gunship": {
    size:"medium", type:"gunship", preset:"Warship", stealth:"standard",
    geometry:{length_m:45, width_m:30, height_m:10}, mass:{dry_t:180},
    signatures:{IR:3,EM:3,CS:3},
    performance:{scm_mps:190, vmax_mps:950, accel_fwd_mps2:40,
      strafe_mps2:{x:45,y:45,z:45}, angular_dps:{pitch:40,yaw:35,roll:75}},
    payload:{cargo_scu:8, crew:"2–4"}, weapons:{summary:"1–2×S4–S5 turrets, missiles"}
  },
  "medium bomber": {
    size:"medium", type:"bomber", preset:"Warship", stealth:"standard",
    geometry:{length_m:70, width_m:35, height_m:14}, mass:{dry_t:200},
    signatures:{IR:3,EM:2,CS:3},
    performance:{scm_mps:140, vmax_mps:900, accel_fwd_mps2:35,
      strafe_mps2:{x:35,y:35,z:35}, angular_dps:{pitch:30,yaw:25,roll:60}},
    payload:{cargo_scu:8, crew:"2–6"}, weapons:{summary:"torpedoes S7–S9 + turrets"}
  },
  "medium stealth bomber": { inherit:"medium bomber", stealth:"stealth", adjust:{ signatures:{IR:-1,EM:-1,CS:-1} } },
  "medium dropship": {
    size:"medium", type:"dropship", preset:"Truck", stealth:"standard",
    geometry:{length_m:38, width_m:28, height_m:10}, mass:{dry_t:160},
    signatures:{IR:3,EM:3,CS:3},
    performance:{scm_mps:180, vmax_mps:950, accel_fwd_mps2:40,
      strafe_mps2:{x:45,y:45,z:45}, angular_dps:{pitch:45,yaw:40,roll:80}},
    payload:{cargo_scu:20, crew:"2–4"}, weapons:{summary:"1–2×S3–S4 turrets"}
  },
  "medium stealth dropship": { inherit:"medium dropship", stealth:"stealth", adjust:{ signatures:{IR:-1,EM:-1,CS:-1} } },
  "small courier": {
    size:"small", type:"courier", preset:"F1", stealth:"standard",
    geometry:{length_m:24, width_m:16, height_m:6}, mass:{dry_t:70},
    signatures:{IR:2,EM:2,CS:2},
    performance:{scm_mps:260, vmax_mps:1200, accel_fwd_mps2:70,
      strafe_mps2:{x:70,y:70,z:70}, angular_dps:{pitch:85,yaw:70,roll:110}},
    payload:{cargo_scu:16, crew:"1–2"}, weapons:{summary:"light defensive"}
  },
  "small freighter": {
    size:"small", type:"freighter", preset:"Truck", stealth:"standard",
    geometry:{length_m:24, width_m:16, height_m:8}, mass:{dry_t:80},
    signatures:{IR:3,EM:3,CS:3},
    performance:{scm_mps:200, vmax_mps:1000, accel_fwd_mps2:35,
      strafe_mps2:{x:35,y:35,z:35}, angular_dps:{pitch:40,yaw:35,roll:75}},
    payload:{cargo_scu:60, crew:"2–3"}, weapons:{summary:"2×S2–S3 defense"}
  },
  "medium freighter": {
    size:"medium", type:"freighter", preset:"Truck", stealth:"standard",
    geometry:{length_m:50, width_m:32, height_m:14}, mass:{dry_t:200},
    signatures:{IR:3,EM:3,CS:3},
    performance:{scm_mps:190, vmax_mps:950, accel_fwd_mps2:30,
      strafe_mps2:{x:30,y:30,z:30}, angular_dps:{pitch:35,yaw:30,roll:65}},
    payload:{cargo_scu:120, crew:"3–4"}, weapons:{summary:"2–3 turrets S2–S3"}
  },
  "heavy freighter": {
    size:"heavy", type:"freighter", preset:"Truck", stealth:"standard",
    geometry:{length_m:110, width_m:50, height_m:20}, mass:{dry_t:450},
    signatures:{IR:4,EM:4,CS:4},
    performance:{scm_mps:170, vmax_mps:900, accel_fwd_mps2:25,
      strafe_mps2:{x:25,y:25,z:25}, angular_dps:{pitch:25,yaw:16,roll:25}},
    payload:{cargo_scu:500, crew:"4–6"}, weapons:{summary:"4–6 turrets"}
  },
  "capital freighter": {
    size:"capital", type:"freighter", preset:"Truck", stealth:"standard",
    geometry:{length_m:180, width_m:60, height_m:30}, mass:{dry_t:1200},
    signatures:{IR:4,EM:4,CS:5},
    performance:{scm_mps:120, vmax_mps:800, accel_fwd_mps2:15,
      strafe_mps2:{x:15,y:15,z:15}, angular_dps:{pitch:20,yaw:12,roll:20}},
    payload:{cargo_scu:2000, crew:"6–12"}, weapons:{summary:"defense batteries"}
  },
  "small exploration": {
    size:"small", type:"exploration", preset:"Balanced", stealth:"standard",
    geometry:{length_m:24, width_m:16, height_m:6}, mass:{dry_t:70},
    signatures:{IR:2,EM:2,CS:2},
    performance:{scm_mps:250, vmax_mps:1200, accel_fwd_mps2:65,
      strafe_mps2:{x:65,y:65,z:65}, angular_dps:{pitch:85,yaw:70,roll:110}},
    payload:{cargo_scu:16, crew:"1–2"}, weapons:{summary:"light, sensors"}
  },
  "medium exploration": {
    size:"medium", type:"exploration", preset:"Balanced", stealth:"standard",
    geometry:{length_m:55, width_m:32, height_m:14}, mass:{dry_t:180},
    signatures:{IR:3,EM:3,CS:3},
    performance:{scm_mps:220, vmax_mps:1050, accel_fwd_mps2:45,
      strafe_mps2:{x:50,y:50,z:50}, angular_dps:{pitch:70,yaw:55,roll:95}},
    payload:{cargo_scu:100, crew:"2–4"}, weapons:{summary:"1–2 turrets, drones"}
  },
  "heavy exploration": {
    size:"heavy", type:"exploration", preset:"Balanced", stealth:"standard",
    geometry:{length_m:110, width_m:50, height_m:28}, mass:{dry_t:480},
    signatures:{IR:3,EM:3,CS:3},
    performance:{scm_mps:165, vmax_mps:900, accel_fwd_mps2:28,
      strafe_mps2:{x:30,y:30,z:30}, angular_dps:{pitch:30,yaw:16,roll:30}},
    payload:{cargo_scu:456, crew:"4–6"}, weapons:{summary:"3–5 turrets, medbay"}
  },
  "small passenger": { size:"small", type:"passenger", preset:"Liner", stealth:"standard",
    geometry:{length_m:24,width_m:16,height_m:10}, mass:{dry_t:150}, signatures:{IR:3,EM:3,CS:4},
    performance:{scm_mps:130,vmax_mps:900,accel_fwd_mps2:20, strafe_mps2:{x:20,y:20,z:20}, angular_dps:{pitch:20,yaw:15,roll:25}},
    payload:{cargo_scu:50, crew:"6–10"}, weapons:{summary:"defense"} },
  "medium passenger": { size:"medium", type:"passenger", preset:"Liner", stealth:"standard",
    geometry:{length_m:60,width_m:25,height_m:15}, mass:{dry_t:300}, signatures:{IR:3,EM:3,CS:4},
    performance:{scm_mps:120,vmax_mps:915,accel_fwd_mps2:18, strafe_mps2:{x:18,y:18,z:18}, angular_dps:{pitch:18,yaw:12,roll:20}},
    payload:{cargo_scu:120, crew:"8–20"}, weapons:{summary:"defense"} },
  "heavy passenger": { size:"heavy", type:"passenger", preset:"Liner", stealth:"standard",
    geometry:{length_m:110,width_m:35,height_m:20}, mass:{dry_t:900}, signatures:{IR:3,EM:3,CS:4},
    performance:{scm_mps:110,vmax_mps:915,accel_fwd_mps2:15, strafe_mps2:{x:15,y:15,z:15}, angular_dps:{pitch:10,yaw:10,roll:15}},
    payload:{cargo_scu:200, crew:"12–30"}, weapons:{summary:"defense batteries"} },
  "small miner":   { size:"small",  type:"miner",   preset:"Industrial", stealth:"standard", geometry:{length_m:24,width_m:18,height_m:7}, mass:{dry_t:60},  signatures:{IR:3,EM:3,CS:3}, performance:{scm_mps:170,vmax_mps:900,accel_fwd_mps2:40, strafe_mps2:{x:45,y:45,z:45}, angular_dps:{pitch:55,yaw:45,roll:85}}, payload:{cargo_scu:32, crew:"1"},   weapons:{summary:"mining S1"} },
  "medium miner":  { size:"medium", type:"miner",  preset:"Industrial", stealth:"standard", geometry:{length_m:38,width_m:30,height_m:12},mass:{dry_t:160}, signatures:{IR:3,EM:3,CS:3}, performance:{scm_mps:160,vmax_mps:900,accel_fwd_mps2:35, strafe_mps2:{x:40,y:40,z:40}, angular_dps:{pitch:45,yaw:40,roll:75}}, payload:{cargo_scu:96, crew:"2–3"}, weapons:{summary:"3×mining S2"} },
  "heavy miner":   { size:"heavy",  type:"miner",   preset:"Industrial", stealth:"standard", geometry:{length_m:100,width_m:50,height_m:30},mass:{dry_t:600}, signatures:{IR:4,EM:4,CS:4}, performance:{scm_mps:130,vmax_mps:800,accel_fwd_mps2:22, strafe_mps2:{x:22,y:22,z:22}, angular_dps:{pitch:20,yaw:12,roll:20}}, payload:{cargo_scu:600, crew:"6–12"}, weapons:{summary:"industrial RIO"} },
  "capital miner": { size:"capital",type:"miner",  preset:"Industrial", stealth:"standard", geometry:{length_m:180,width_m:70,height_m:40},mass:{dry_t:1200},signatures:{IR:4,EM:4,CS:4}, performance:{scm_mps:120,vmax_mps:800,accel_fwd_mps2:20, strafe_mps2:{x:20,y:20,z:20}, angular_dps:{pitch:20,yaw:12,roll:20}}, payload:{cargo_scu:1200,crew:"12–24"}, weapons:{summary:"industrial RIO"} },
  "small tanker":  { size:"small", type:"tanker",  preset:"Truck", stealth:"standard", geometry:{length_m:24,width_m:14,height_m:9}, mass:{dry_t:120},signatures:{IR:4,EM:5,CS:4}, performance:{scm_mps:160,vmax_mps:850,accel_fwd_mps2:22, strafe_mps2:{x:22,y:22,z:22}, angular_dps:{pitch:25,yaw:18,roll:30}}, payload:{cargo_scu:200,crew:"4–6"}, weapons:{summary:"defense"} },
  "medium tanker": { size:"medium",type:"tanker", preset:"Truck", stealth:"standard", geometry:{length_m:60,width_m:30,height_m:15}, mass:{dry_t:400},signatures:{IR:4,EM:5,CS:4}, performance:{scm_mps:150,vmax_mps:850,accel_fwd_mps2:22, strafe_mps2:{x:22,y:22,z:22}, angular_dps:{pitch:25,yaw:18,roll:30}}, payload:{cargo_scu:400,crew:"6–10"}, weapons:{summary:"defense"} },
  "heavy tanker":  { size:"heavy", type:"tanker",  preset:"Truck", stealth:"standard", geometry:{length_m:110,width_m:50,height_m:25},mass:{dry_t:800}, signatures:{IR:4,EM:5,CS:4}, performance:{scm_mps:150,vmax_mps:850,accel_fwd_mps2:22, strafe_mps2:{x:22,y:22,z:22}, angular_dps:{pitch:25,yaw:18,roll:30}}, payload:{cargo_scu:800,crew:"8–14"}, weapons:{summary:"defense"} },
  "capital tanker":{ size:"capital",type:"tanker", preset:"Truck", stealth:"standard", geometry:{length_m:180,width_m:70,height_m:30},mass:{dry_t:1200},signatures:{IR:4,EM:5,CS:4}, performance:{scm_mps:150,vmax_mps:850,accel_fwd_mps2:22, strafe_mps2:{x:22,y:22,z:22}, angular_dps:{pitch:25,yaw:18,roll:30}}, payload:{cargo_scu:1600,crew:"12–20"}, weapons:{summary:"defense"} },
  "small salvager": { size:"small", type:"salvager", preset:"Industrial", stealth:"standard", geometry:{length_m:24,width_m:16,height_m:9}, mass:{dry_t:120},signatures:{IR:3,EM:3,CS:3}, performance:{scm_mps:150,vmax_mps:800,accel_fwd_mps2:24, strafe_mps2:{x:24,y:24,z:24}, angular_dps:{pitch:28,yaw:20,roll:30}}, payload:{cargo_scu:60, crew:"3–4"}, weapons:{summary:"beams + defense"} },
  "medium salvager":{ size:"medium",type:"salvager",preset:"Industrial", stealth:"standard", geometry:{length_m:60,width_m:30,height_m:15}, mass:{dry_t:300},signatures:{IR:4,EM:4,CS:4}, performance:{scm_mps:140,vmax_mps:800,accel_fwd_mps2:22, strafe_mps2:{x:22,y:22,z:22}, angular_dps:{pitch:24,yaw:18,roll:28}}, payload:{cargo_scu:200,crew:"4–8"}, weapons:{summary:"beams + defense"} },
  "heavy salvager": { size:"heavy", type:"salvager", preset:"Industrial", stealth:"standard", geometry:{length_m:100,width_m:60,height_m:30},mass:{dry_t:600}, signatures:{IR:4,EM:4,CS:4}, performance:{scm_mps:130,vmax_mps:800,accel_fwd_mps2:22, strafe_mps2:{x:22,y:22,z:22}, angular_dps:{pitch:22,yaw:15,roll:28}}, payload:{cargo_scu:400,crew:"6–12"}, weapons:{summary:"beams + defense"} },
  "capital salvager":{ size:"capital",type:"salvager",preset:"Industrial", stealth:"standard", geometry:{length_m:155,width_m:120,height_m:45},mass:{dry_t:1000},signatures:{IR:4,EM:4,CS:4}, performance:{scm_mps:130,vmax_mps:800,accel_fwd_mps2:22, strafe_mps2:{x:22,y:22,z:22}, angular_dps:{pitch:22,yaw:15,roll:28}}, payload:{cargo_scu:400,crew:"6–12"}, weapons:{summary:"beams + defense"} },
  "small repair":  { size:"small",  type:"repair",  preset:"Industrial", stealth:"standard", geometry:{length_m:24,width_m:16,height_m:9}, mass:{dry_t:100},signatures:{IR:3,EM:3,CS:3}, performance:{scm_mps:160,vmax_mps:900,accel_fwd_mps2:30, strafe_mps2:{x:40,y:40,z:40}, angular_dps:{pitch:55,yaw:45,roll:85}}, payload:{cargo_scu:40, crew:"2–3"}, weapons:{summary:"drones + defense"} },
  "medium repair": { size:"medium", type:"repair", preset:"Industrial", stealth:"standard", geometry:{length_m:40,width_m:28,height_m:12},mass:{dry_t:150},signatures:{IR:3,EM:3,CS:3}, performance:{scm_mps:160,vmax_mps:900,accel_fwd_mps2:32, strafe_mps2:{x:48,y:48,z:48}, angular_dps:{pitch:55,yaw:45,roll:85}}, payload:{cargo_scu:80, crew:"2–4"}, weapons:{summary:"drones + defense"} },
  "heavy repair":  { size:"heavy",  type:"repair",  preset:"Industrial", stealth:"standard", geometry:{length_m:90,width_m:40,height_m:18},mass:{dry_t:500},signatures:{IR:4,EM:4,CS:4}, performance:{scm_mps:150,vmax_mps:850,accel_fwd_mps2:24, strafe_mps2:{x:30,y:30,z:30}, angular_dps:{pitch:35,yaw:25,roll:40}}, payload:{cargo_scu:150,crew:"4–8"}, weapons:{summary:"drones + defense"} },
  "small recon": {
    size:"small", type:"recon", preset:"Recon", stealth:"stealth",
    geometry:{length_m:26, width_m:17, height_m:6}, mass:{dry_t:65},
    signatures:{IR:1,EM:1,CS:1},
    performance:{scm_mps:250, vmax_mps:1200, accel_fwd_mps2:60,
      strafe_mps2:{x:65,y:65,z:65}, angular_dps:{pitch:90,yaw:75,roll:110}},
    payload:{cargo_scu:8, crew:"1–2"}, weapons:{summary:"light recon fit"}
  },
  "medium recon": {
    size:"medium", type:"recon", preset:"Recon", stealth:"stealth",
    geometry:{length_m:35, width_m:22, height_m:7}, mass:{dry_t:90},
    signatures:{IR:1,EM:1,CS:1},
    performance:{scm_mps:240, vmax_mps:1150, accel_fwd_mps2:58,
      strafe_mps2:{x:60,y:60,z:60}, angular_dps:{pitch:85,yaw:70,roll:105}},
    payload:{cargo_scu:12, crew:"1–2"}, weapons:{summary:"light recon fit"}
  },
  "capital corvette": {
    size:"capital", type:"corvette", preset:"Warship", stealth:"standard",
    geometry:{length_m:155, width_m:82, height_m:35}, mass:{dry_t:2000},
    signatures:{IR:4,EM:4,CS:4},
    performance:{scm_mps:140, vmax_mps:850, accel_fwd_mps2:10,
      strafe_mps2:{x:10,y:10,z:15}, angular_dps:{pitch:18,yaw:18,roll:28}},
    payload:{cargo_scu:500, crew:"12–24"}, weapons:{summary:"torpedoes + batteries"}
  },
  "capital frigate": {
    size:"capital", type:"frigate", preset:"Warship", stealth:"standard",
    geometry:{length_m:245, width_m:116, height_m:40}, mass:{dry_t:8000},
    signatures:{IR:4,EM:4,CS:5},
    performance:{scm_mps:110, vmax_mps:800, accel_fwd_mps2:6,
      strafe_mps2:{x:6,y:6,z:10}, angular_dps:{pitch:12,yaw:12,roll:18}},
    payload:{cargo_scu:1200, crew:"30–80"}, weapons:{summary:"6–10 turrets, S10 gun"}
  },
  "capital destroyer": {
    size:"capital", type:"destroyer", preset:"Warship", stealth:"standard",
    geometry:{length_m:345, width_m:148, height_m:65}, mass:{dry_t:16000},
    signatures:{IR:5,EM:5,CS:5},
    performance:{scm_mps:100, vmax_mps:750, accel_fwd_mps2:5,
      strafe_mps2:{x:5,y:5,z:8}, angular_dps:{pitch:10,yaw:10,roll:15}},
    payload:{cargo_scu:3000, crew:"60–200"}, weapons:{summary:"heavy batteries + torpedoes"}
  },
  "capital carrier": {
    size:"capital", type:"carrier", preset:"Warship", stealth:"standard",
    geometry:{length_m:270, width_m:104, height_m:64}, mass:{dry_t:12000},
    signatures:{IR:5,EM:5,CS:5},
    performance:{scm_mps:95, vmax_mps:730, accel_fwd_mps2:5,
      strafe_mps2:{x:5,y:5,z:8}, angular_dps:{pitch:9,yaw:9,roll:14}},
    payload:{cargo_scu:4000, crew:"50–150"}, weapons:{summary:"6–10 turrets, hangars"}
  },
  "capital dreadnought": {
    size:"capital", type:"dreadnought", preset:"Warship", stealth:"standard",
    geometry:{length_m:600, width_m:200, height_m:100}, mass:{dry_t:50000},
    signatures:{IR:5,EM:5,CS:5},
    performance:{scm_mps:80, vmax_mps:700, accel_fwd_mps2:4,
      strafe_mps2:{x:4,y:4,z:6}, angular_dps:{pitch:6,yaw:6,roll:10}},
    payload:{cargo_scu:10000, crew:"200–800"}, weapons:{summary:"capital batteries"}
  }
};

export function finalizeNominals(entry){
  const m = entry.mass?.dry_t ?? 0; const a = entry.performance?.accel_fwd_mps2 ?? 0; 
  const main = Number(((m*a)/1000).toFixed(2));
  const tierKey = tier(entry.size);
  const rcs = Number((main * RCS_RATIO[tierKey]).toFixed(2));
  return {
    ...entry,
    geometry: {
      ...(entry.geometry || {}),
      hull_radius_m: entry.geometry?.hull_radius_m ?? computeHullRadius(entry.geometry?.length_m, entry.geometry?.width_m)
    },
    propulsion: entry.propulsion || { main_thrust_MN: main, rcs_budget_MN: rcs }
  };
}

export function getNominals(size, type, isStealth){
  const key = `${size} ${type}`;
  let base = NOMINALS[key] || null;
  if (!base && isStealth && NOMINALS[`${size} stealth ${type}`]) base = NOMINALS[`${size} stealth ${type}`];
  if (!base) return null;
  if (base.inherit){
    const parent = NOMINALS[base.inherit];
    base = { 
      ...parent, 
      ...base, 
      geometry: base.geometry || parent.geometry, 
      mass: base.mass || parent.mass, 
      performance: base.performance || parent.performance,
      signatures: {
        IR: Math.max(1,(parent.signatures.IR + (base.adjust?.signatures?.IR||0))),
        EM: Math.max(1,(parent.signatures.EM + (base.adjust?.signatures?.EM||0))),
        CS: Math.max(1,(parent.signatures.CS + (base.adjust?.signatures?.CS||0)))
      }
    };
  }
  base = finalizeNominals(base);
  if (isStealth && base.stealth==="standard" && (type === "bomber" || type === "dropship")) {
    base = JSON.parse(JSON.stringify(base));
    base.stealth = "stealth";
    base.signatures = {
      IR: Math.max(1, base.signatures.IR-1),
      EM: Math.max(1, base.signatures.EM-1),
      CS: Math.max(1, base.signatures.CS-1)
    };
  }
  return base;
}

export function applyNominals(ship, mode='fill-empty'){
  const n = getNominals(ship.classification.size, ship.classification.type, ship.classification.stealth==='stealth');
  if (!n) return ship;
  const merge = (dst, src) => {
    for (const k of Object.keys(src)){
      if (typeof src[k] === 'object' && src[k] && !Array.isArray(src[k])){
        dst[k] = merge(dst[k]||{}, src[k]);
      } else {
        if (mode==='overwrite' || dst[k]===undefined || dst[k]===null || dst[k]==='') dst[k] = src[k];
      }
    }
    return dst;
  };
  const out = JSON.parse(JSON.stringify(ship));
  merge(out, {
    geometry:n.geometry, mass:n.mass, signatures:n.signatures, performance:n.performance,
    propulsion:n.propulsion, payload:n.payload, weapons:n.weapons
  });
  if (!out.geometry.hull_radius_m) {
    out.geometry.hull_radius_m = computeHullRadius(out.geometry.length_m, out.geometry.width_m);
  }
  if (!out.assist?.preset) out.assist = { ...(out.assist||{}), preset: n.preset };
  return out;
}
