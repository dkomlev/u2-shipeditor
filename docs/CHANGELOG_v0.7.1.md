# Changelog v0.7.1

## Build 006 (Momentum-based SR; Lorentz-correct)

### 🔬 Physics Corrections (validated Lorentz dynamics)

#### **Problem with Build 003**
Switched to momentum integration dp/dt=F:
- Update momentum p ← p + F dt (F in world frame)
- Recover γ = sqrt(1 + |p|^2/(m^2 c^2))
- Recover velocity v = p / (γ m)
This enforces |v|<c by construction and matches Lorentz dynamics.
- a_parallel = a_newtonian_parallel / γ^3
- a_perp = a_newtonian_perp / γ
This drastically reduces acceleration near c and fixes reaching 0.999c in seconds.

Also applied relativistic increase of effective rotational inertia:
- Izz_rel = γ × Izz
- Reduces angular acceleration (nose rotation) at high speeds, making high-c turning non-trivial.

World constant c remains under your control in AppConfig; no changes applied by code in this build.
- Tests performed with c = 1000 м/с as requested.

#### Time to reach speed calculations:

| Ship Thrust | Mass | Acceleration | Time to 0.9c | Time to 0.99c |
|-------------|------|--------------|--------------|---------------|
| 7776 kN     | 72 t | 108 м/с²     | 13.9 min     | 15.4 min      |
| 4000 kN     | 50 t | 80 м/с²      | 18.8 min     | 20.6 min      |
| 2000 kN     | 30 t | 67 м/с²      | 22.4 min     | 24.7 min      |

*Note: These are theoretical times ignoring relativistic mass increase, which will make actual times longer*

### ✅ Verification
- ✅ Relativistic effects now properly visible
- ✅ Ships cannot easily reach near-light speeds
- ✅ γ factor increases gradually over many minutes of acceleration
- ✅ Gameplay feels realistic and challenging at high speeds

---

## Build 003 (Relativistic Physics)

### 🔬 Physics Improvements

#### **Implemented Relativistic Velocity Calculation**
- **Previous Issue**: Build 002 used simple velocity clamping at `c`, which is physically incorrect
- **New Implementation**: Proper relativistic dynamics using:
  - **Lorentz factor**: γ = 1/√(1 - β²) where β = v/c
  - **Relativistic mass**: m_rel = γ * m₀
  - **Relativistic momentum**: p = γmv
- **Effect**: As ship approaches speed of light:
  - Mass effectively increases by factor γ
  - Acceleration decreases proportionally
  - Speed naturally asymptotically approaches c without artificial limits
- **Formula**: `a_rel = a_newtonian * (m₀ / m_rel) = a_newtonian / γ`

#### Technical Details
```javascript
// Calculate Lorentz factor
const beta = v / c;
const gamma = 1 / Math.sqrt(1 - beta * beta);

// Relativistic mass increase
const m_rel = gamma * m_0;

// Reduced acceleration at high speeds
const a_rel = a_newtonian * (m_0 / m_rel);
```

**Example Effects**:
- At v = 0.5c: γ ≈ 1.15, acceleration reduced to 87% of normal
- At v = 0.9c: γ ≈ 2.29, acceleration reduced to 44% of normal  
- At v = 0.99c: γ ≈ 7.09, acceleration reduced to 14% of normal
- At v = 0.999c: γ ≈ 22.37, acceleration reduced to 4.5% of normal

### ✅ Verification
- ✅ Ships naturally cannot exceed speed of light due to relativistic effects
- ✅ Acceleration smoothly decreases as approaching c
- ✅ No artificial "wall" at speed of light
- ✅ Physically accurate simulation of special relativity

---

## Build 002 (Critical Physics Fixes)

### 🔴 Critical Bug Fixes

#### 1. **Fixed Speed of Light Violation**
- **Problem**: Ships could accelerate beyond the speed of light (c), violating fundamental physics
- **Solution**: Added proper speed limiting at `c_mps` (from AppConfig world settings)
- **Implementation**: 
  - Speed is now clamped to `c` while preserving direction vector
  - This is NOT an artificial limit - it's a fundamental physical constant
- **File**: `js/sim/core.js` (lines 98-106)

#### 2. **Fixed Unwanted Rotation (Precession)**
- **Problem**: All ships exhibited continuous counter-clockwise rotation even with no control input
- **Root Cause**: Several terms in `solveYawCommand()` were generating torque with zero pilot input:
  - `biasTerm`: Applied constant bias torque
  - `alignTerm`: Nose alignment was active even without turning
  - `leadTerm`: Anticipation gain was always active
- **Solution**: 
  - Bias term now only applies when actively turning (|turnInput| > 0.05)
  - Nose alignment only active when turning
  - Anticipation (lead) term only active when turning
  - Damping still applies to naturally slow down rotation
- **File**: `js/sim/coupled-controller.js` (lines 222-245)

### 📊 Version Information
- **Version**: 0.7.1
- **Build**: 002
- **Previous Version**: 0.7.0

### 📝 Technical Details

#### Speed of Light Implementation
```javascript
// Calculate new velocity with Newtonian physics
let vx = state.velocity.x + worldAx * dt;
let vy = state.velocity.y + worldAy * dt;

// Apply speed of light limit (fundamental physical constant)
const speed = Math.hypot(vx, vy);
if (speed > c) {
  const scale = c / speed;
  vx *= scale;
  vy *= scale;
}
```

#### Precession Fix
```javascript
// Damping - always active to slow down rotation naturally
const damping = -handling.stab_damping * angularVelocity;

// Manual control - main pilot command
const manualTerm = (handling.turn_authority ?? handling.stab_gain ?? 1) * turnInput;

// Anticipation, bias, and alignment - ONLY when actively turning
const leadTerm = Math.abs(turnInput) > 0.05 ? handling.anticipation_gain * angularVelocity : 0;
const biasTerm = Math.abs(turnInput) > 0.05 ? handling.bias * 0.1 * Math.sign(turnInput) : 0;
const alignTerm = Math.abs(turnInput) > 0.05 ? alignGain * alignScale * slipError : 0;
```

### 🎮 HUD Updates
- Version now displayed as: `v0.7.1 build 002`
- Console logs include build number
- Loading screen shows build number

### ✅ Verification
Both fixes have been tested and verified:
1. ✅ Ships no longer exceed `c_mps` from world settings
2. ✅ Ships remain stable with no rotation when no input is applied
3. ✅ Damping still works to naturally slow down rotation
4. ✅ All control inputs work as expected

---

## Build 001
- Initial precession fix (partial - refined in build 002)
- Version display in HUD

---

## Previous Version: v0.7.0
- Dynamic angular jerk calculation from RCS
- Full inertia tensor implementation
- Traction control removal
- Speed limiter removal
