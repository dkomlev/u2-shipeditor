# U2 Nominals v0.7.4 (decoupled)

Changes vs 0.6:
- Removed `SCM_mps` and `Vmax_mps` (no speed caps in U2).
- Performance now: `accel_fwd_mps2`, `strafe_mps2 {x,y,z}`, `omega_cap_dps {pitch,yaw,roll}`.
- Propulsion delivered explicitly as `propulsion { main_thrust_MN, rcs_budget_MN }` (derived from dry mass and forward accel).
- Signatures remain `IR/EM/CS` on 1–5 scale (reference).
- Includes `preset` per archetype for editor quick-fill.

### Integration (ShipEditor ≥ 0.7.4)
1. Replace `js/nominals.js` with `nominals.v0.7.4.js` (or import it as a module and wire in `applyNominals`).
2. Ensure schema omits `performance.scm_mps` and `performance.vmax_mps` fields (keep accel/strafe/omega caps).
3. Decoupled-only: brake/coupled assist parameters to be added in a later patch (0.7.5+).

Artifacts:
- `nominals.v0.7.4.js` — drop-in module export { NOMINALS_VERSION, NOMINALS_MODE, NOMINALS, finalizeNominals, getNominals, applyNominals }
- `U2_Nominals_v0.7.4_decoupled.json` — data payload for offline use
- `U2_Nominals_v0.7.4_decoupled.csv` — tabular view for quick editing
