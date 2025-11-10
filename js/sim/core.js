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
    return {
      time: 0,
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      orientation: 0,
      angularVelocity: 0,
      mass_t: config.mass_t ?? 1,
      thrustBudget: resolveThrust(config),
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
    const maxSpeed = c * 0.999;
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

    let vx = state.velocity.x + worldAx * dt;
    let vy = state.velocity.y + worldAy * dt;
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      vx *= scale;
      vy *= scale;
    }

    const newOrientation = wrapAngle(state.orientation + state.angularVelocity * dt);
    const torqueNm = torqueInput * (state.thrustBudget.yaw_kNm ?? 0) * KNM_TO_NM;
    const moment = Math.max(env.inertia ?? 1, 0.1) * mass_kg;
    const angularAcceleration = torqueNm / moment;
    let newAngularVelocity = state.angularVelocity + angularAcceleration * dt;
    
    // Safety clamp: prevent excessive angular velocities (emergency limit)
    const maxSafeAngularVel = 4 * Math.PI; // 2 rotations per second max
    newAngularVelocity = Math.max(-maxSafeAngularVel, Math.min(maxSafeAngularVel, newAngularVelocity));

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
