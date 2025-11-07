export const ENVELOPE = {
  snub:    { Lmin: 0,  Lmax: 12,  Mmin: 0,  Mmax: 20  },
  small:   { Lmin: 12, Lmax: 25,  Mmin: 20, Mmax: 80  },
  medium:  { Lmin: 25, Lmax: 60,  Mmin: 80, Mmax: 250 },
  heavy:   { Lmin: 60, Lmax: 120, Mmin: 250, Mmax: 900 },
  capital: { Lmin: 120, Lmax: 1e9, Mmin: 900, Mmax: 1e9 }
};

const ratioOB = (x, min, max) => {
  if (x < min) return (min - x) / (min || 1);
  if (x > max) return (x - max) / (max || 1);
  return 0;
};

export function validateSize(hull) {
  const env = ENVELOPE[hull.classification.size];
  const rL = ratioOB(hull.geometry.length_m, env.Lmin, env.Lmax);
  const rM = ratioOB(hull.mass.dry_t,        env.Mmin, env.Mmax);
  const maxR = Math.max(rL, rM);
  if (maxR <= 0.15) return { level:"ok",   maxR };
  if (maxR <= 0.30) return { level:"warn", maxR, suggestion: suggestSize(hull) };
  return                 { level:"error",maxR, suggestion: suggestSize(hull) };
}

export function suggestSize(hull) {
  const L = hull.geometry.length_m;
  const M = hull.mass.dry_t;
  const tiers = Object.entries(ENVELOPE);
  let best = "small", bestScore = 1e9;
  for (const [k, e] of tiers) {
    const rL = ratioOB(L, e.Lmin, e.Lmax);
    const rM = ratioOB(M, e.Mmin, e.Mmax);
    const score = Math.max(rL, rM);
    if (score < bestScore) { bestScore = score; best = k; }
  }
  return best;
}

export function clampAssistToPhysics(assist, perf) {
  const g = 9.80665;
  const maxG = (perf.accel_fwd_mps2 || 0) / g;
  const out = { ...assist };
  if (Number.isFinite(maxG)) {
    out.brake_g_sustain = Math.min(out.brake_g_sustain, 0.85 * maxG);
    out.brake_g_boost   = Math.min(out.brake_g_boost,   1.20 * maxG);
  }
  return out;
}
