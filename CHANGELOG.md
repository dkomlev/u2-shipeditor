# Universe Unlimited - Changelog

## Version 0.7.3 Build 001 (Current)

### Build & Telemetry

- Added `build-info.json` + `js/lib/build-info.js` as the single source of truth for version/build metadata across browser and Node targets.
- New `scripts/bump-build.cjs` hooked into `npm run build` automatically increments the build number (resetting on version bumps) and regenerates the runtime module.
- FlightTest HUD + Diagnostics overlay now read the build label dynamically and update document titles, loading states, and on-screen badges.
- Introduced `npm run bump` helper for ad-hoc build increments when a full manifest rebuild is unnecessary.

### Versioning

- Package version bumped to `0.7.3`; manifests and diagnostics pick up the value from the shared build module.

---

## Version 0.7.2 Build 003

### Physics Improvements

- Refactor: extracted SR helpers to `js/sim/relativity.js`; `core.js` now calls the helpers in both Node and browser.
- Rotation: yaw inertia now scales with γ_rot computed from rim speed v_rim = |ω|·R_yaw; Izz_rel = Izz · γ_rot; numerical guard keeps v_rim < c.
- Diagnostics: `diagnostics/fastest-stand.html` now plots γ_rot and v_rim/c; includes relativity.js.
- Verified linear SR tests pass; rotation change is physically motivated and numerically stable.

**Corrected Relativistic Velocity Calculation**
- Fixed velocity update in `core.js` to use proper Special Relativity formula
- Changed from: `v = p / (γm)` with separate gamma calculation and artificial clamping
- Changed to: `v = p / sqrt(m² + p²/c²)` - mathematically equivalent but more numerically stable
- **Removed artificial velocity clamping** - velocity now naturally stays below c without any hard limits
- Formula ensures v → c as p → ∞ (asymptotic approach), correctly implementing SR physics

**Key Formula:**
```
F = dp/dt  where p = γmv
v = p / sqrt(m² + p²/c²)
γ = sqrt(1 + (p/mc)²)
```

This ensures:
- At low momentum (p << mc): v ≈ p/m (classical Newtonian limit)
- At high momentum (p >> mc): v → c (relativistic limit)
- Velocity never exceeds or equals c for finite momentum
- No artificial speed limiters needed - pure physics!

### Testing
- Added `test/verify-relativity.cjs` - validates SR formula across momentum range
- Verified formula maintains v < c for momenta up to 1000mc
- All physics tests pass ✓

### Files Modified
- `js/sim/core.js` - Lines 95-117: Relativistic velocity calculation
- `flight-test.html` - Lines 128, 167: Version 0.7.2 build 001
- `test/verify-relativity.cjs` - New verification test

---

## Version 0.7.1 Build 006

### Unwanted Precession Fix (Completed in Build 006)
- Fixed ships rotating counter-clockwise with no input
- Modified `solveYawCommand()` in `coupled-controller.js`
- Bias, anticipation, and nose alignment terms now only apply when |turnInput| > 0.05
- Damping term always applies (velocity-based stabilization)
- Ships now remain stable with zero control input ✓

---

## Version 0.7.0

### Major Physics Overhaul
- Implemented full inertia tensor (Ixx, Iyy, Izz) replacing simplified I=k·m
- Removed traction control (arcade simplifications)
- Angular jerk now calculated from RCS characteristics: jerk = (dτ/dt)/I
- Replaced magic constants with physical parameters

### Pilot Assist System
- Removed artificial speed limiters
- Pure Newtonian/relativistic physics with intelligent assistance
- Coupled mode respects ship's technical specifications and physical laws

### Version Display
- App version now visible in FlightTest HUD (bottom-right panel)
- Format: "v0.7.1 build 007"

---

## Design Principles

1. **No Arcade Simplifications** - честная физика (honest physics)
2. **Newtonian + Relativistic** - proper SR for high velocities
3. **No Artificial Limits** - speed limited only by thrust/mass and c
4. **Physical Accuracy** - all parameters derived from ship specifications
5. **Intelligent Assistance** - pilot aids work within physical constraints

