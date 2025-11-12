"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.U2SimCore = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  const TAU = Math.PI * 2;
  const KN_TO_N = 1000;
  const KNM_TO_NM = 1000;

  function createState(config) {
    // Calculate inertia tensor from geometry if not provided
    const length_m = config.geometry?.length_m ?? 20;
    const width_m = config.geometry?.width_m ?? 14;
    const mass_t = config.mass_t ?? config.mass?.dry_t ?? 1;
    const mass_kg = mass_t * 1000;
    
    // Rod approximation for spacecraft inertia tensor
    // I = k * m * L²  where k depends on mass distribution
    const defaultIxx = 0.08 * mass_kg * width_m * width_m;   // Roll (around longitudinal axis)
    const defaultIyy = 0.12 * mass_kg * length_m * length_m; // Pitch (around lateral axis)
    const defaultIzz = 0.15 * mass_kg * length_m * length_m; // Yaw (around vertical axis)
    
    return {
      time: 0,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      momentum: { x: 0, y: 0 },
      orientation: 0,
      angularVelocity: 0,
      mass_t: mass_t,
      thrustBudget: resolveThrust(config),
      angular_dps: config.performance?.angular_dps || config.angular_dps,
      inertiaTensor: {
        Ixx: config.inertia_opt?.Ixx ?? defaultIxx,
        Iyy: config.inertia_opt?.Iyy ?? defaultIyy,
        Izz: config.inertia_opt?.Izz ?? defaultIzz
      },
      camera: {
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 }
      },
      control: {
        thrustForward: 0,
        thrustRight: 0,
        torque: 0
      }
    };
  }

  function resolveThrust(config) {
    const mainDrive = config.propulsion?.main_drive;
    const rcs = config.propulsion?.rcs;
    return {
      forward_kN: mainDrive?.max_thrust_kN ?? 0,
      backward_kN: rcs?.backward_kN ?? mainDrive?.max_thrust_kN ?? 0,
      lateral_kN: rcs?.lateral_kN ?? 0,
      vertical_kN: rcs?.vertical_kN ?? 0,
      pitch_kNm: rcs?.pitch_kNm ?? 0,
      yaw_kNm: rcs?.yaw_kNm ?? 0,
      roll_kNm: rcs?.roll_kNm ?? 0
    };
  }

  function step(state, input, env) {
    const dt = env.dt_sec ?? 1 / 60;
    const c = env.c_mps ?? 10000;
    const mass_kg = state.mass_t * 1000;

    // body accelerations
    const thrustForwardInput = clamp(input.thrustForward ?? 0, -1, 1);
    const thrustRightInput = clamp(input.thrustRight ?? 0, -1, 1);
    const torqueInput = clamp(input.torque ?? 0, -1, 1);

    const forwardBudget = thrustForwardInput >= 0 ? state.thrustBudget.forward_kN : state.thrustBudget.backward_kN;
    const forwardAccel = (thrustForwardInput * forwardBudget * KN_TO_N) / mass_kg;
    const lateralAccel = (thrustRightInput * state.thrustBudget.lateral_kN * KN_TO_N) / mass_kg;

    const forwardVec = {
      x: Math.cos(state.orientation),
      y: Math.sin(state.orientation)
    };
    const rightVec = {
      x: Math.sin(state.orientation),
      y: -Math.cos(state.orientation)
    };

    const worldAx = forwardVec.x * forwardAccel + rightVec.x * lateralAccel;
    const worldAy = forwardVec.y * forwardAccel + rightVec.y * lateralAccel;

    // Relativistic momentum integration (Special Relativity)
    // F = dp/dt where p = γmv
    const Fx = worldAx * mass_kg; // N
    const Fy = worldAy * mass_kg; // N

    // Update momentum: p_new = p_old + F*dt
    const px = (state.momentum?.x ?? 0) + Fx * dt;
    const py = (state.momentum?.y ?? 0) + Fy * dt;

    // Recover velocity from momentum using SR formula
    // From p = γmv and γ = sqrt(1 + (p/mc)²), we get:
    // v = p / sqrt(m² + p²/c²)
    // This naturally ensures v < c without artificial clamping
    const p2 = px * px + py * py;
    const m2 = mass_kg * mass_kg;
    const c2 = c * c;
    const denominator = Math.sqrt(m2 + p2 / c2);
    
    const vx = px / denominator;
    const vy = py / denominator;
    
    // Calculate gamma for relativistic effects on rotation
    const gamma = Math.sqrt(1 + p2 / (m2 * c2));

    const newOrientation = wrapAngle(state.orientation + state.angularVelocity * dt);
    const torqueNm = torqueInput * (state.thrustBudget.yaw_kNm ?? 0) * KNM_TO_NM;
    
    // Use proper moment of inertia for yaw rotation (around vertical axis)
    // In 2D simulation, we only have yaw, so use Izz
    const Izz = state.inertiaTensor?.Izz ?? (0.15 * mass_kg * 20 * 20); // fallback
    // Approximate relativistic increase of rotational inertia
    const Izz_rel = Izz * gamma;
    const angularAcceleration = torqueNm / Izz_rel;
    let newAngularVelocity = state.angularVelocity + angularAcceleration * dt;
    
    // Pure physics - no artificial limits
    // Angular velocity is limited only by ship's physical capabilities (RCS thrust and inertia)
    const angularDps = state.angular_dps;
    if (angularDps && typeof angularDps.yaw === 'number') {
      const maxYawRps = (angularDps.yaw ?? angularDps.pitch ?? 60) * Math.PI / 180;
      if (maxYawRps === 0) {
        newAngularVelocity = 0;
      }
    }

    const nextPosition = {
      x: state.position.x + vx * dt,
      y: state.position.y + vy * dt
    };
    const newCamera = updateCamera(state.camera, nextPosition);

    return {
      ...state,
      time: state.time + dt,
      position: nextPosition,
      velocity: { x: vx, y: vy },
      momentum: { x: px, y: py },
      orientation: newOrientation,
      angularVelocity: newAngularVelocity,
      camera: newCamera
    };
  }

  function wrapAngle(angle) {
    if (!Number.isFinite(angle)) {
      return 0;
    }
    let a = angle % TAU;
    if (a < -Math.PI) a += TAU;
    if (a > Math.PI) a -= TAU;
    return a;
  }

  function updateCamera(camera, targetPosition) {
    return {
      position: { x: targetPosition.x, y: targetPosition.y },
      velocity: camera?.velocity ?? { x: 0, y: 0 }
    };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  return {
    createState,
    step,
    clamp01
  };
});
