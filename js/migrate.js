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
  const size = inferSize(rawLength, massDry);
  const type = mapType(old.role || old.type || old.classification?.type || old.meta?.class);
  const stealth = type === 'recon' ? 'stealth' : (old.stealth ? 'stealth' : 'standard');
  const variant = old.variant ?? old.meta?.variant ?? '';

  const length_m = Number(rawLength ?? 0) || 0;
  const width_m = Number(rawWidth ?? 0) || 0;
  const height_m = Number(rawHeight ?? 0) || 0;
  const hull_radius_m = old.geometry?.hull_radius_m ?? old.hull_radius_m ?? hullRadiusFrom(length_m, width_m);

  const perf = {
    scm_mps: old.SCM ?? old.scm ?? old.performance?.scm_mps ?? 0,
    vmax_mps: old.Vmax ?? old.vmax ?? old.performance?.vmax_mps ?? 0,
    accel_fwd_mps2: old.a_fwd ?? old.performance?.accel_fwd_mps2 ?? 0,
    strafe_mps2: {
      x: old.ax ?? old.performance?.strafe_mps2?.x ?? 0,
      y: old.ay ?? old.performance?.strafe_mps2?.y ?? 0,
      z: old.az ?? old.performance?.strafe_mps2?.z ?? 0
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

  const thrustMN =
    old.propulsion?.main_thrust_MN ??
    (old.propulsion?.main_engine_thrust_max_N ? old.propulsion.main_engine_thrust_max_N / 1e6 : undefined) ??
    old.thrust_main ??
    (((massDry ?? 0) * (old.a_fwd ?? 0)) / 1e6) ??
    0;
  const rcsMN =
    old.propulsion?.rcs_budget_MN ??
    (old.rcs?.strafe_thrust_N ? old.rcs.strafe_thrust_N / 1e6 : undefined) ??
    old.rcs_MN ??
    0;

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

  return {
    meta: {
      id: old.id || old.meta?.id || (crypto?.randomUUID?.() || String(Date.now())),
      name: old.name || old.meta?.name || 'Unnamed',
      version: old.version || old.meta?.version || '0.6.0',
      author: old.meta?.author || old.author || ''
    },
    classification: { size, type, size_type: sizeType(size,type), stealth, variant },
    geometry: { length_m, width_m, height_m, hull_radius_m },
    mass: { dry_t: massDry || 0 },
    inertia_opt: old.inertia_opt ?? old.mass?.inertia_override ?? { Ixx:null, Iyy:null, Izz:null },
    signatures: { IR: old.IR ?? old.signatures?.IR ?? 3, EM: old.EM ?? old.signatures?.EM ?? 3, CS: old.CS ?? old.signatures?.CS ?? 3 },
    performance: perf,
    propulsion: {
      main_thrust_MN: Number(thrustMN ?? 0),
      rcs_budget_MN:  Number(rcsMN ?? 0)
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
    media: { sprite },
    notes_opt: old.notes ?? old.meta?.notes ?? old.description ?? ''
  };
}
