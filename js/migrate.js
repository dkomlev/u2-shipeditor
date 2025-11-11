import { sizeType } from './schema.js';
import { ARCH_PRESET, applyStealthMode, cloneAssistPreset } from './presets.js';
import { clampAssistToPhysics } from './validator.js';

const mapType = (s) => {
  const t = String(s || '').toLowerCase();
  const dict = new Map([
    ["fighter","fighter"], ["lf","fighter"], ["hf","fighter"],
    ["int","interceptor"], ["interceptor","interceptor"],
    ["gunship","gunship"], ["bomber","bomber"], ["torpedo","bomber"],
    ["dropship","dropship"], ["courier","courier"],
    ["freighter","freighter"], ["cargo","freighter"],
    ["exploration","exploration"], ["passenger","passenger"],
    ["miner","miner"], ["tanker","tanker"], ["salvage","salvager"], ["salvager","salvager"],
    ["repair","repair"],
    ["recon","recon"], ["stealth","recon"],
    ["shuttle","shuttle"],
    ["corvette","corvette"],["frigate","frigate"],["destroyer","destroyer"],["carrier","carrier"],["dreadnought","dreadnought"]
  ]);
  return dict.get(t) || 'fighter';
};

const inferSize = (L, M) => {
  if ((L ?? 0) >= 120 || (M ?? 0) >= 900) return 'capital';
  if ((L ?? 0) >= 60  || (M ?? 0) >= 250) return 'heavy';
  if ((L ?? 0) >= 25  || (M ?? 0) >= 80 ) return 'medium';
  if ((L ?? 0) >= 12  || (M ?? 0) >= 20 ) return 'small';
  return 'snub';
};

const pickPreset = (size, type) => (ARCH_PRESET.find(x => x.size===size && x.type===type)?.preset) || 'Balanced';
const hullRadiusFrom = (length, width) => {
  if (!(length > 0 && width > 0)) return null;
  return Number((Math.hypot(length, width) / 2).toFixed(2));
};

export function migrateToV06(old) {
  const rawLength = old.length_m ?? old.geometry?.length_m ?? old.geometry?.bbox_m?.length ?? old.geometry?.bbox?.length;
  const rawWidth = old.width_m ?? old.geometry?.width_m ?? old.geometry?.bbox_m?.width ?? old.geometry?.bbox?.width;
  const rawHeight = old.height_m ?? old.geometry?.height_m ?? old.geometry?.bbox_m?.height ?? old.geometry?.bbox?.height;
  const massDry = old.mass?.dry_t
    ?? old.mass_t
    ?? (old.mass?.mass_kg ? old.mass.mass_kg / 1000 : undefined)
    ?? (old.mass_kg ? old.mass_kg / 1000 : undefined)
    ?? 0;
  const size = old.classification?.size ?? inferSize(rawLength, massDry);
  const type = old.classification?.type ?? mapType(old.role || old.type || old.meta?.class);
  const stealth = old.classification?.stealth ?? (type === 'recon' ? 'stealth' : (old.stealth ? 'stealth' : 'standard'));
  const variant = old.classification?.variant ?? old.variant ?? old.meta?.variant ?? '';

  const length_m = Number(rawLength ?? 0) || 0;
  const width_m = Number(rawWidth ?? 0) || 0;
  const height_m = Number(rawHeight ?? 0) || 0;
  const hull_radius_m = old.geometry?.hull_radius_m ?? old.hull_radius_m ?? hullRadiusFrom(length_m, width_m);

  // v0.6.3: migrate from scm_mps/vmax_mps to accel_profile
  const a_fwd = old.a_fwd ?? old.performance?.accel_fwd_mps2 ?? old.performance?.accel_profile?.forward_mps2 ?? 0;
  const a_back = old.a_back ?? old.performance?.accel_profile?.backward_mps2 ?? (a_fwd * 0.4);
  const ax = old.ax ?? old.performance?.strafe_mps2?.x ?? old.performance?.accel_profile?.lateral_mps2 ?? 0;
  const ay = old.ay ?? old.performance?.strafe_mps2?.y ?? old.performance?.accel_profile?.vertical_mps2 ?? 0;
  
  const perf = {
    accel_profile: {
      forward_mps2: a_fwd,
      backward_mps2: a_back,
      lateral_mps2: ax,
      vertical_mps2: ay
    },
    angular_dps: {
      pitch: old.pitch ?? old.performance?.angular_dps?.pitch ?? 0,
      yaw:   old.yaw   ?? old.performance?.angular_dps?.yaw   ?? 0,
      roll:  old.roll  ?? old.performance?.angular_dps?.roll  ?? 0
    },
    angular_accel_opt: { pitch: null, yaw: null, roll: null }
  };

  const presetName = pickPreset(size, type);
  let assist = cloneAssistPreset(presetName);
  if (stealth === 'stealth' && type !== 'recon') assist = applyStealthMode(assist, type);
  assist.preset = presetName;
  assist = clampAssistToPhysics(assist, perf);

  // v0.6.3: split propulsion into main_drive and rcs
  const thrustMN =
    old.propulsion?.main_thrust_MN ??
    (old.propulsion?.main_drive?.max_thrust_kN ? old.propulsion.main_drive.max_thrust_kN / 1000 : undefined) ??
    (old.propulsion?.main_engine_thrust_max_N ? old.propulsion.main_engine_thrust_max_N / 1e6 : undefined) ??
    old.thrust_main ??
    (((massDry ?? 0) * a_fwd) / 1000) ??
    0;
  
  const sustainedThrust_kN = old.propulsion?.main_drive?.sustained_thrust_kN 
    ?? (thrustMN * 1000 * 0.75);
  const maxPower_MW = old.propulsion?.main_drive?.max_power_MW 
    ?? old.power_opt?.reactor_MW 
    ?? null;

  const rcsMN =
    old.propulsion?.rcs_budget_MN ??
    (old.rcs?.strafe_thrust_N ? old.rcs.strafe_thrust_N / 1e6 : undefined) ??
    old.rcs_MN ??
    0;

  // Distribute RCS budget across axes (if not already detailed)
  const rcs_fwd_kN = old.propulsion?.rcs?.forward_kN ?? (rcsMN * 1000 * 0.3);
  const rcs_back_kN = old.propulsion?.rcs?.backward_kN ?? (rcsMN * 1000 * 0.2);
  const rcs_lat_kN = old.propulsion?.rcs?.lateral_kN ?? (rcsMN * 1000 * 0.35);
  const rcs_vert_kN = old.propulsion?.rcs?.vertical_kN ?? (rcsMN * 1000 * 0.25);
  const rcs_pitch_kNm = old.propulsion?.rcs?.pitch_kNm ?? (rcsMN * 1000 * 0.3 * (length_m || 20) * 0.3);
  const rcs_yaw_kNm = old.propulsion?.rcs?.yaw_kNm ?? (rcsMN * 1000 * 0.28 * (length_m || 20) * 0.3);
  const rcs_roll_kNm = old.propulsion?.rcs?.roll_kNm ?? (rcsMN * 1000 * 0.42 * (width_m || 15) * 0.3);

  const spritePath = old.sprite?.path || old.media?.sprite?.path || '';
  const sprite = {
    name: spritePath ? spritePath.split(/[\\/]/).pop() : (old.sprite?.name || ''),
    dataUrl: old.media?.sprite?.dataUrl || '',
    path: spritePath,
    width: old.sprite?.size_px?.w ?? old.media?.sprite?.width ?? null,
    height: old.sprite?.size_px?.h ?? old.media?.sprite?.height ?? null
  };

  const crewValue = old.payload?.crew ?? old.crew ?? '1';
  const crew = typeof crewValue === 'number' ? String(crewValue) : String(crewValue || '1');

  const hardpoints = old.hardpoints_opt || old.hardpoints || {};

  // v0.6.3: generate tags from classification
  const tags = old.tags || [size, type, stealth === 'stealth' ? 'stealth' : 'standard'];

  return {
    meta: {
      id: old.id || old.meta?.id || (crypto?.randomUUID?.() || String(Date.now())),
      name: old.name || old.meta?.name || 'Unnamed',
      version: '0.6.4',
      author: old.meta?.author || old.author || ''
    },
    classification: { size, type, size_type: sizeType(size,type), stealth, variant },
    geometry: { length_m, width_m, height_m, hull_radius_m },
    mass: { dry_t: massDry || 0 },
    inertia_opt: old.inertia_opt ?? old.mass?.inertia_override ?? { Ixx:null, Iyy:null, Izz:null },
    signatures: { IR: old.IR ?? old.signatures?.IR ?? 3, EM: old.EM ?? old.signatures?.EM ?? 3, CS: old.CS ?? old.signatures?.CS ?? 3 },
    performance: perf,
    propulsion: {
      main_drive: {
        max_thrust_kN: Number(thrustMN * 1000),
        sustained_thrust_kN: Number(sustainedThrust_kN),
        max_power_MW: maxPower_MW
      },
      rcs: {
        forward_kN: Number(rcs_fwd_kN),
        backward_kN: Number(rcs_back_kN),
        lateral_kN: Number(rcs_lat_kN),
        vertical_kN: Number(rcs_vert_kN),
        pitch_kNm: Number(rcs_pitch_kNm),
        yaw_kNm: Number(rcs_yaw_kNm),
        roll_kNm: Number(rcs_roll_kNm)
      }
    },
    power_opt: {
      reactor_MW: old.power_opt?.reactor_MW ?? old.reactor_MW ?? old.power?.reactor_MW ?? null,
      cooling_MW: old.power_opt?.cooling_MW ?? old.cooling_MW ?? old.power?.cooling_MW ?? null
    },
    payload: { cargo_scu: old.cargo_scu ?? old.payload?.cargo_scu ?? 0, crew },
    hardpoints_opt: {
      fixed: hardpoints.fixed ?? [],
      gimbals: hardpoints.gimbals ?? [],
      turrets: hardpoints.turrets ?? [],
      missiles: hardpoints.missiles ?? []
    },
    weapons: { summary: old.weapons_summary ?? old.weapons?.summary ?? '' },
    assist,
    tags,
    media: { sprite },
    notes_opt: old.notes ?? old.meta?.notes ?? old.description ?? '',
    legacy_v053: old.legacy_v053 ?? {}
  };
}
