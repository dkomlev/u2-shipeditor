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
  const GAMMA_MIN_SPEED = 0.0001;

  function createState(config) {
    return {
      time: 0,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      orientation: 0,
      angularVelocity: 0,
      mass_t: config.mass_t ?? 1,
      thrustBudget: resolveThrust(config),
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
    const maxSpeed = c * 0.999;
    const mass_kg = state.mass_t * 1000;

    // body accelerations
    const forwardAccel =
      ((input.thrustForward ?? 0) *
        (input.thrustForward >= 0 ? state.thrustBudget.forward_kN : state.thrustBudget.backward_kN)) /
      mass_kg;
    const lateralAccel = ((input.thrustRight ?? 0) * state.thrustBudget.lateral_kN) / mass_kg;

    const bodyAx = forwardAccel;
    const bodyAy = lateralAccel;
    const worldAx = (bodyAx * Math.cos(state.orientation) - bodyAy * Math.sin(state.orientation)) * 10;
    const worldAy = (bodyAx * Math.sin(state.orientation) + bodyAy * Math.cos(state.orientation)) * 10;

    let vx = state.velocity.x + worldAx * dt;
    let vy = state.velocity.y + worldAy * dt;
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      vx *= scale;
      vy *= scale;
    }

    const newOrientation = wrapAngle(state.orientation + state.angularVelocity * dt);
    const torque = (input.torque ?? 0) * state.thrustBudget.yaw_kNm;
    const angularAcceleration = torque / (mass_kg * (env.inertia ?? 1));
    const newAngularVelocity = state.angularVelocity + angularAcceleration * dt;

    return {
      ...state,
      time: state.time + dt,
      position: {
        x: state.position.x + vx * dt,
        y: state.position.y + vy * dt
      },
      velocity: { x: vx, y: vy },
      orientation: newOrientation,
      angularVelocity: newAngularVelocity
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

  return {
    createState,
    step,
    clamp01
  };
});
