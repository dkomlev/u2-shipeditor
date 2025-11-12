# U2 Ship Editor - Architecture Documentation v0.6.4

## Overview

U2 Ship Editor is a web-based ship configuration editor and flight simulator for space ships. The project consists of three main applications:
1. **Ship Editor** (`index.html`) - Ship configuration editor with visual UI
2. **Flight Test** (`flight-test.html`) - Physics simulation sandbox with realistic SR (Special Relativity) physics
3. **App Config Editor** (`app-config.html`) - Application configuration editor

The project uses vanilla JavaScript ES6 modules with no build system or external dependencies (except dev tools for testing).

---

## Project Structure

```
u2-shipeditor/
├── index.html              # Ship Editor entry point
├── flight-test.html        # Flight Test simulation entry point
├── app-config.html         # App Config editor entry point
├── js/
│   ├── app.js             # Ship Editor UI controller
│   ├── app-config.js      # App Config editor UI controller
│   ├── schema.js          # Ship config schema & factory
│   ├── presets.js         # Assist presets & handling styles
│   ├── nominals.js        # Nominal values for ship archetypes
│   ├── validator.js       # Ship config validation
│   ├── migrate.js         # Legacy config migration
│   ├── lib/               # Shared libraries
│   │   ├── ship-adapter.js       # Ship config -> simulation adapter
│   │   ├── resources.js          # Ship manifest & resource loader
│   │   ├── app-config-loader.js  # App config loader
│   │   └── appconfig.js          # App config schema
│   └── sim/               # Flight simulation modules
│       ├── core.js               # Physics engine (SR + Newtonian)
│       ├── pilot-assist.js       # Pilot assist modes (Coupled/Decoupled/Brake)
│       ├── coupled-controller.js # Coupled mode flight controller
│       ├── input.js              # Input handling (keyboard/touch)
│       ├── asteroids.js          # Asteroid field generation
│       └── collision.js          # Collision detection (AABB/Alpha)
├── config/
│   └── shipconfig.schema.json    # JSON Schema for ship configs
├── ships/                 # Ship configuration library
│   ├── manifest.json      # Ship catalog
│   ├── fighters/          # Fighter ship configs
│   ├── freighters/        # Freighter ship configs
│   ├── frigates/          # Frigate ship configs
│   └── interceptor/       # Interceptor ship configs
├── configs/               # Example ship configs
├── scripts/               # Utility scripts
│   ├── build-manifest.cjs        # Generate ship manifest
│   ├── migrate-ships.js          # Batch migrate configs
│   └── validate-ships.js         # Validate all configs
├── test/                  # Test suites
└── docs/                  # Technical specifications
    ├── U2 — ТЗ FlightTest v0.6.3.md
    ├── U2 — Pilot Assist v0.6.5.md
    └── U2_ShipConfig_v0.6.md
```

---

## Core Architecture

### 1. Ship Editor (index.html + js/app.js)

**Purpose**: Visual editor for creating and editing ship configurations.

**Key Components**:
- **UI Binding System**: Two-way data binding between DOM elements and ship config object
- **Preset System**: Quick-fill ship parameters based on size/type archetypes
- **Validation**: Real-time validation against physics constraints
- **Export/Import**: JSON serialization with migration support

**Data Flow**:
```
User Input → DOM Events → app.js → ship object → Validation → JSON Export
                           ↓
                    schema.js (factory)
                    presets.js (archetypes)
                    nominals.js (default values)
                    validator.js (checks)
```

**Key Files**:
- `js/app.js` - Main controller, UI binding, export/import
- `js/schema.js` - Ship config schema, factory function `buildEmptyConfig()`
- `js/presets.js` - Assist presets (Sport, Muscle, Truck, Rally, etc.)
- `js/nominals.js` - Nominal values by ship class (fighters, freighters, etc.)
- `js/validator.js` - Envelope validation, size constraints

---

### 2. Flight Test (flight-test.html)

**Purpose**: Real-time physics simulation sandbox for testing ship configs.

**Key Components**:
- **Physics Engine** (`sim/core.js`) - SR + Newtonian mechanics
- **Pilot Assist** (`sim/pilot-assist.js`) - Flight modes and automation
- **Input System** (`sim/input.js`) - Keyboard/touch controls
- **Rendering** - Canvas 2D with camera follow
- **Collision System** (`sim/collision.js`) - AABB and pixel-perfect detection

**Simulation Loop**:
```
Input → Pilot Assist → Physics Step → Collision Check → Render → HUD Update
  ↓         ↓              ↓              ↓              ↓         ↓
input.js  pilot-   →    core.js    →  collision.js → Canvas → HUD panel
          assist.js       (SR)          (AABB/Alpha)
                           ↓
                    coupled-controller.js
                    (coupled mode logic)
```

**Physics Pipeline**:
1. **Input Processing** (`input.js`) - Raw input → normalized commands
2. **Pilot Assist** (`pilot-assist.js`) - Apply flight mode logic (Coupled/Decoupled/Brake)
3. **Coupled Controller** (`coupled-controller.js`) - Advanced flight assistance (if coupled)
4. **Physics Step** (`core.js`) - Apply forces, integrate motion, SR effects
5. **Collision Detection** (`collision.js`) - Check asteroid collisions
6. **State Update** - Update ship state, camera position, HUD

---

## Module Documentation

### js/schema.js

**Purpose**: Defines the canonical ship configuration schema and provides factory functions.

**Exports**:
- `SIZE` - Array of ship sizes: `['snub', 'small', 'medium', 'heavy', 'capital']`
- `TYPE` - Array of ship types: `['fighter', 'freighter', 'interceptor', 'frigate', ...]`
- `PRESET` - Array of assist presets: `['Sport', 'Muscle', 'Truck', 'Rally', ...]`
- `sizeType(size, type)` - Concatenate size+type (e.g., "heavy freighter")
- `buildEmptyConfig(opts)` - Factory function to create empty ship config

**Ship Config Structure**:
```javascript
{
  meta: { id, name, version: "0.6.4", author },
  classification: { size, type, size_type, stealth, variant },
  geometry: { length_m, width_m, height_m, hull_radius_m },
  mass: { dry_t },
  inertia_opt: { Ixx, Iyy, Izz },
  performance: {
    accel_profile: { forward_mps2, backward_mps2, lateral_mps2, vertical_mps2 },
    angular_dps: { pitch, yaw, roll },
    angular_accel_opt: { pitch, yaw, roll }
  },
  propulsion: {
    main_drive: { max_thrust_kN, sustained_thrust_kN, max_power_MW },
    rcs: { forward_kN, backward_kN, lateral_kN, vertical_kN,
           pitch_kNm, yaw_kNm, roll_kNm }
  },
  assist: { preset, handling_style, speed_limiter_ratio, handling: {...}, jerk: {...}, brake: {...} },
  sprite: { kind, value }
}
```

---

### js/presets.js

**Purpose**: Defines assist presets and handling styles for different ship classes.

**Exports**:
- `PRESET` - List of preset names
- `HANDLING_STYLES` - Handling style names: `['drift', 'balanced', 'grip']`
- `ARCH_PRESET` - Mapping of (size, type) → preset name
- `cloneAssistPreset(presetName)` - Get assist preset by name
- `applyStealthMode(assist, shipType)` - Modify assist for stealth ships

**Preset Categories**:
- **Sport** - Snub fighters, agile and responsive
- **Muscle** - Medium/heavy fighters, powerful acceleration
- **Rally** - Interceptors, high speed and maneuverability
- **Truck** - Freighters, stable cargo hauling
- **Hauler** - Capital freighters, heavy and slow
- **Warship** - Capital combat ships, balanced power
- **Recon** - Stealth ships, precise control

**Handling Parameters**:
- `stab_gain` - Stability factor (0.3-1.6)
- `stab_damping` - Damping coefficient (0.5-3.0)
- `slip_threshold_deg` - Slip angle threshold (3-10°)
- `slip_limit_deg` - Maximum slip angle (9-25°)
- `traction_control` - TC strength (0.0-0.8)
- `cap_main_coupled` - Main thrust limit in coupled mode
- `speed_limiter_ratio` - Speed limiter ratio (0.5-1.0)

---

### js/nominals.js

**Purpose**: Provides nominal (typical) values for ship archetypes based on size and type.

**Exports**:
- `NOMINALS` - Object with nominal values for each ship class
- `getNominals(size, type, stealth)` - Get nominals for specific ship
- `applyNominals(ship, mode)` - Apply nominals to ship config
- `RCS_RATIO` - RCS thrust ratio by size tier
- `computeHullRadius(length, width)` - Calculate hull radius

**Nominal Data Includes**:
- Geometry (length, width, height)
- Mass (dry_t)
- Performance (scm_mps, vmax_mps, accel_fwd_mps2, strafe_mps2, angular_dps)
- Signatures (IR, EM, CS)
- Payload (cargo_scu, crew)
- Weapons (summary)

**Apply Modes**:
- `'fill-empty'` - Only fill undefined/null/empty values (default)
- `'overwrite'` - Overwrite all values with nominals

---

### js/validator.js

**Purpose**: Validates ship configurations against physics constraints and envelope limits.

**Exports**:
- `validateSize(length, width, height, size)` - Check geometry vs size class
- `suggestSize(length, width, height)` - Suggest appropriate size class
- `clampAssistToPhysics(assist, performance)` - Clamp assist values to physics limits

**Validation Rules**:
- **Size Envelopes**: Each size class has min/max dimensions
  - Snub: 6-12m length
  - Small: 12-25m
  - Medium: 25-60m
  - Heavy: 60-150m
  - Capital: 150m+
- **Mass Constraints**: Mass must match size class
- **Thrust Limits**: Thrust-to-weight ratios must be realistic
- **Angular Limits**: Angular acceleration must match ship size

---

### js/migrate.js

**Purpose**: Migrates legacy ship configs (v0.5.x, v0.6.0-0.6.3) to current schema (v0.6.4).

**Exports**:
- `migrateToV06(oldConfig)` - Migrate old config to v0.6.4 format
- `needsMigration(config)` - Check if config needs migration

**Migration Tasks**:
- Convert old `scm_mps`, `vmax_mps` to `accel_profile`
- Convert old `angular_dps: {pitch, yaw, roll}` to new format
- Convert old `propulsion.main_thrust_MN` to `main_drive.max_thrust_kN`
- Convert old `propulsion.rcs_budget_MN` to RCS component values
- Add missing fields with defaults
- Update version to `0.6.4`

---

### js/lib/ship-adapter.js

**Purpose**: Adapts ship configs to simulation-ready format for Flight Test.

**Exports**:
- `adaptConfig(shipConfig)` - Convert ship config to simulation summary

**Conversion Tasks**:
- Extract performance values (forward/lateral accel, angular velocity limits)
- Calculate thrust budgets from propulsion
- Build assist profile from preset + overrides
- Compute derived values (thrust-to-weight, power requirements)
- Prepare sprite/media data

**Output Format** (summary):
```javascript
{
  meta: { id, name, version, author },
  classification: { size, type, size_type, stealth, variant, tags },
  mass_t: number,
  performance: { accel_profile, angular_dps },
  propulsion: { main_drive, rcs },
  assist: { preset, handling, jerk, brake },
  sprite: { kind, value },
  forward_accel_mps2, lateral_accel_mps2, thrust_to_weight, power_MW
}
```

---

### js/lib/resources.js

**Purpose**: Manages ship catalog and resource loading for Flight Test.

**Exports**:
- `loadManifest()` - Load ship manifest from `ships/manifest.json`
- `getManifestSync()` - Get cached manifest data
- `getShipConfig(path)` - Load and adapt ship config from path
- `clearCache()` - Clear ship config cache

**Manifest Format**:
```javascript
[
  {
    path: "ships/fighters/Anvil F7C Hornet-config.json",
    name: "Anvil F7C Hornet",
    size: "medium",
    type: "fighter",
    tags: [],
    preview: null,
    summary: { /* derived values */ }
  }
]
```

---

### js/sim/core.js

**Purpose**: Physics engine implementing Special Relativity + Newtonian mechanics.

**Exports**:
- `createState(config)` - Initialize ship state from config
- `step(state, input, env)` - Perform one physics timestep

**Physics Features**:
- **SR Effects**: Lorentz factor γ, time dilation, length contraction
- **SR Clamps**: 
  - Longitudinal: `a_fwd_eff = a_fwd / γ³`
  - Transverse: `a_lat_eff = a_lat / γ`
- **Speed Limit**: `|v| ≤ 0.999c` where c = physics.c_mps
- **Angular Motion**: Torque-based rotation with inertia
- **Angular Limits**: Enforce `angular_dps` limits from config

**Input Format**:
```javascript
{
  thrustForward: -1.0 to 1.0,  // Forward/backward thrust
  thrustRight: -1.0 to 1.0,    // Right/left strafe
  torque: -1.0 to 1.0          // Yaw rotation
}
```

**State Format**:
```javascript
{
  time, position: {x, y}, velocity: {x, y},
  orientation, angularVelocity,
  mass_t, thrustBudget: {forward_kN, lateral_kN, yaw_kNm, ...},
  angular_dps: {pitch, yaw, roll},
  camera: {position, velocity}
}
```

---

### js/sim/pilot-assist.js

**Purpose**: Implements pilot assist modes (Coupled, Decoupled, Brake).

**Exports**:
- `createPilotAssist(summary)` - Create pilot assist instance
- `update(state, input, env)` - Process input and apply assist logic

**Flight Modes**:
1. **Coupled** - Flight assist ON, heading matches velocity direction
   - Uses `coupled-controller.js` for advanced logic
   - Limits speed to `speed_limiter_ratio * vmax`
   - Applies slip control and traction control
   
2. **Decoupled** - Flight assist OFF, independent heading and velocity
   - Direct thrust control
   - No automatic stabilization
   - Angular limits still enforced
   
3. **Brake** - Emergency stop mode
   - Active while Space is held
   - Applies maximum deceleration (linear + angular)
   - Supports Boost (Shift) for extra braking force
   - Returns to previous mode when released

**Brake Algorithm**:
```javascript
// Linear deceleration
desiredAccel = -velocity / stopTime
thrust = clamp(desiredAccel, -maxAccel, maxAccel)

// Angular deceleration
desiredAngularAccel = -angularVelocity / rotStop
torque = clamp(desiredAngularAccel / maxAngularAccel, -1, 1)
```

**Output Format**:
```javascript
{
  command: { thrustForward, thrustRight, torque },
  mode: "Coupled" | "Decoupled" | "Brake",
  autopilot: boolean,
  brake: boolean,
  telemetry: { /* debug data */ }
}
```

---

### js/sim/coupled-controller.js

**Purpose**: Advanced flight controller for Coupled mode.

**Exports**:
- `applyCoupledMode(state, input, handling, env)` - Apply coupled flight logic

**Features**:
- **Slip Control**: Maintains ship heading aligned with velocity
- **Traction Control**: Prevents excessive lateral slip
- **Anticipatory Damping**: Smooths rotational response
- **Speed Limiting**: Enforces speed limiter ratio
- **Main Thrust Capping**: Limits forward thrust in coupled mode

**Key Functions**:
- `solveSlipTarget(vel, fwd, handling)` - Calculate target slip angle
- `solveYawCommand(turnInput, slipError, angularVel, accel, handling)` - Calculate yaw torque
- `applyTractionControl(lateralThrust, TC, mainThrust, handling)` - Apply TC to lateral thrust

**Handling Parameters**:
- `slip_threshold_deg` - When to start slip correction
- `slip_limit_deg` - Maximum allowed slip angle
- `stab_gain` - Proportional gain for slip correction
- `stab_damping` - Damping for angular velocity
- `traction_control` - TC strength (0.0-0.8)
- `anticipation_gain` - Lead compensation
- `oversteer_bias` - Oversteer tendency

---

### js/sim/input.js

**Purpose**: Handles keyboard and touch input, normalizes to command format.

**Exports**:
- `createInputController()` - Create input controller instance
- `getInput()` - Get current normalized input
- `toggleCoupled()` / `toggleAutopilot()` - Mode switching

**Key Bindings (Keyboard)**:
- **WASD** - Forward/Left/Back/Right strafe
- **Q/E** - Rotate left/right
- **Space** - Brake (hold)
- **Shift** - Boost (with Brake)
- **C** - Toggle Coupled/Decoupled
- **V** - Toggle Autopilot

**Touch Controls**:
- **Left Joystick** - Movement (forward/strafe)
- **Right Joystick** - Rotation
- **Brake Button** - Emergency stop
- **Boost** - Double-tap brake or separate button

**Output Format**:
```javascript
{
  forward: -1.0 to 1.0,
  right: -1.0 to 1.0,
  turn: -1.0 to 1.0,
  brake: boolean,
  boost: boolean,
  coupled: boolean,
  autopilot: boolean
}
```

---

### js/sim/asteroids.js

**Purpose**: Generates procedural asteroid fields for Flight Test.

**Exports**:
- `generateAsteroids(appConfig)` - Generate asteroid field

**Generation Parameters** (from AppConfig):
- `count` - Number of asteroids
- `min_radius_m` / `max_radius_m` - Size range
- `density_per_km2` - Spatial density
- `spawn_margin_m` - Safe zone around spawn

**Asteroid Properties**:
- Position (x, y)
- Radius
- Velocity (optional drift)
- Rotation (optional spin)

---

### js/sim/collision.js

**Purpose**: Collision detection between ship and asteroids.

**Exports**:
- `checkCollisions(state, asteroids, sprite, mode)` - Check all collisions

**Detection Modes**:
1. **AABB** (Axis-Aligned Bounding Box)
   - Fast, conservative
   - Uses `hull_radius_m` for ship bounds
   - Circle-to-circle test
   
2. **Alpha** (Pixel-Perfect)
   - Accurate, slower
   - Reads sprite alpha channel
   - Checks actual ship silhouette vs asteroid
   - Requires sprite image loaded

**Collision Response**:
- Returns array of colliding asteroids
- No physics response (instant game over in Flight Test)
- Overlay rendering for debugging

---

## Data Flow Diagrams

### Ship Editor Flow

```
User → UI (index.html)
       ↓
    app.js (controller)
       ↓
    ┌──────────────────┐
    │  ship object     │
    │  (in-memory)     │
    └──────────────────┘
       ↓        ↓
    schema.js  validator.js
    presets.js nominals.js
       ↓
    Export → shipconfig.json
```

### Flight Test Flow

```
User Input (Keyboard/Touch)
       ↓
    input.js → normalized input
       ↓
    pilot-assist.js
       ↓ (mode: Coupled/Decoupled/Brake)
    coupled-controller.js (if coupled)
       ↓
    command {thrust, torque}
       ↓
    core.js (physics step)
       ↓
    state {position, velocity, orientation, ...}
       ↓
    collision.js → check asteroids
       ↓
    Render (Canvas) + HUD Update
```

### Config Loading Flow

```
Flight Test startup
       ↓
    resources.js → loadManifest()
       ↓
    ships/manifest.json
       ↓
    Select ship → getShipConfig(path)
       ↓
    Load ships/fighters/Hornet-config.json
       ↓
    migrate.js (if needed)
       ↓
    ship-adapter.js → adaptConfig()
       ↓
    summary (simulation-ready)
       ↓
    core.createState(summary)
```

---

## Configuration Files

### ShipConfig (ships/*.json)

Defines a ship's physical properties, performance, and flight characteristics.

**Key Sections**:
- `meta` - Metadata (id, name, version, author)
- `classification` - Size, type, stealth, variant
- `geometry` - Dimensions (length, width, height, hull_radius)
- `mass` - Dry mass in metric tons
- `performance` - Acceleration and angular velocity limits
- `propulsion` - Main drive and RCS thrust/torque values
- `assist` - Flight assist preset and overrides
- `sprite` - Visual representation (PNG data URL or path)

**Version**: Current schema is v0.6.4

---

### AppConfig (appconfig.json)

Defines Flight Test simulation parameters.

**Key Sections**:
- `world` - World bounds, torus wrapping
- `physics` - dt, c_mps, inertia defaults
- `rendering` - Canvas size, camera zoom, trails
- `input` - Key bindings, deadzone, sensitivity
- `collision` - Mode (AABB/Alpha), alpha_threshold
- `asteroids` - Count, size, density, spawn margin
- `logging` - Enable console/file logging
- `debug` - Show telemetry, collision overlay
- `paths` - Ship config path, manifest path

---

## Development Workflow

### Adding a New Ship

1. **Create Config**: Use Ship Editor or copy template
2. **Edit Properties**: Set geometry, mass, performance, propulsion
3. **Apply Preset**: Choose assist preset (Sport, Muscle, Truck, etc.)
4. **Add Sprite** (optional): Upload PNG, crop, export as data URL
5. **Export**: Save as `ships/{category}/{Name}-config.json`
6. **Rebuild Manifest**: Run `node scripts/build-manifest.cjs`
7. **Test**: Load in Flight Test and verify physics

### Modifying Physics

1. **Edit**: Modify `js/sim/core.js` for physics changes
2. **Test**: Run Flight Test with various ships
3. **Validate**: Check SR effects, angular limits, thrust caps
4. **Document**: Update `docs/U2 — ТЗ FlightTest v0.6.3.md`

### Adding Assist Preset

1. **Edit**: Add preset to `js/presets.js` → `PRESET_DEFAULTS`
2. **Map**: Add to `ARCH_PRESET` mapping (size, type) → preset
3. **Test**: Apply preset in Ship Editor, test in Flight Test
4. **Tune**: Adjust handling parameters (slip, damping, TC)

---

## Testing

### Manual Testing
- **Ship Editor**: Test all UI fields, validation, export/import
- **Flight Test**: Test each flight mode, collision detection, SR effects
- **Config Migration**: Load legacy configs, verify migration

### Automated Tests
- `test/migrate.test.js` - Migration tests
- `test/config-compat.test.js` - Config compatibility tests
- `test/smoke.js` - Basic smoke tests

### Run Tests
```bash
npm test
```

---

## Build and Deployment

### No Build Step Required
The project uses ES6 modules directly in the browser. No webpack, rollup, or other bundler needed.

### Local Development
```bash
# Start local server
python -m http.server 8080

# Open browser
http://localhost:8080/index.html
http://localhost:8080/flight-test.html
```

### Production Deployment
1. Upload all files to web server
2. Serve as static site
3. Ensure CORS headers allow loading ship configs and sprites

### GitHub Pages
The project is configured for GitHub Pages deployment:
- CNAME file for custom domain
- All assets are relative paths
- No server-side processing required

---

## Version History

### v0.6.4 (Current - Stable)
- Fixed strafe-induced yaw in coupled mode
- Fixed Idris rotation with angular_dps=0
- Updated all ship configs to v0.6.4
- Added Origin M50 Interceptor
- Updated manifest with 8 ships
- Renamed build-manifest.js to .cjs for CommonJS

### v0.6.3
- Added SR physics effects
- Implemented Brake mode with Boost
- Added coupled/decoupled flight modes
- Implemented collision detection (AABB/Alpha)
- Added asteroid field generation

### v0.6.0
- Initial public release
- Ship Editor with preset system
- Basic physics simulation
- Export/import functionality

---

## Contributing

### Code Style
- ES6 modules (import/export)
- Functional programming where possible
- Descriptive variable names
- Comments for complex algorithms
- JSDoc for public APIs

### File Naming
- kebab-case for files: `ship-adapter.js`, `pilot-assist.js`
- PascalCase for classes (if used)
- camelCase for functions and variables

### Commit Messages
- Descriptive first line (<80 chars)
- Detailed explanation in body
- Reference issues/features

### Testing
- Test in multiple browsers (Chrome, Firefox, Safari)
- Test on mobile devices
- Verify CORS handling for sprites

---

## License

MIT License - See LICENSE file for details.

---

## Contact & Support

- **Repository**: https://github.com/dkomlev/u2-shipeditor
- **Issues**: https://github.com/dkomlev/u2-shipeditor/issues
- **Documentation**: See `docs/` folder for technical specifications

---

**Last Updated**: November 12, 2025
**Version**: 0.6.4
