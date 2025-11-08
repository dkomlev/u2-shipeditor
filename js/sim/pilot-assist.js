"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.U2PilotAssist = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const EPS_V = 0.05;

  function createPilotAssist(summary = {}) {
    let randomVec = { x: 0, y: 0 };
    let randomTimer = 0;
    let randomTorque = 0;

    function update(state, input, env) {
      const dt = env.dt_sec ?? 1 / 60;
      const modeCoupled = !!input.modeCoupled;
      const autopilot = !!input.autopilot;
      const command = {
        thrustForward: clamp(input.thrustForward ?? 0, -1, 1),
        thrustRight: clamp(input.thrustRight ?? 0, -1, 1),
        torque: clamp(input.torque ?? 0, -1, 1)
      };

      if (input.brake) {
        const brakeResult = applyBrake(state, env);
        return {
          command: brakeResult.command,
          mode: "Brake",
          autopilot,
          brake: true
        };
      }

      if (autopilot) {
        randomTimer -= dt;
        if (randomTimer <= 0) {
          randomVec = {
            x: (Math.random() * 2 - 1) * 0.3,
            y: (Math.random() * 2 - 1) * 0.3
          };
          randomTorque = (Math.random() * 2 - 1) * 0.2;
          randomTimer = 1.0;
        }
      } else {
        randomVec = { x: 0, y: 0 };
        randomTorque = 0;
      }

      if (modeCoupled) {
        const slip = projectSlip(state);
        const gain = summary.assist?.stab_gain ?? 0.8;
        command.thrustForward = clamp(command.thrustForward - slip.forward * gain, -1, 1);
        command.thrustRight = clamp(command.thrustRight - slip.right * gain, -1, 1);
      }

      command.thrustForward = clamp(command.thrustForward + randomVec.y, -1, 1);
      command.thrustRight = clamp(command.thrustRight + randomVec.x, -1, 1);
      command.torque = clamp(command.torque + randomTorque, -1, 1);

      return {
        command,
        mode: modeCoupled ? "Coupled" : "Decoupled",
        autopilot,
        brake: false
      };
    }

    return { update };
  }

  function applyBrake(state, env) {
    const mass = Math.max(state.mass_t ?? 1, 0.1) * 1000;
    const stopTime = Math.max(env.brake_time ?? 0.25, 0.05);
    const rotStop = Math.max(env.brake_rot_time ?? 0.15, 0.03);
    const vel = state.velocity;
    const fwdVec = { x: Math.cos(state.orientation), y: Math.sin(state.orientation) };
    const rightVec = { x: Math.sin(state.orientation), y: -Math.cos(state.orientation) };
    const forwardSpeed = vel.x * fwdVec.x + vel.y * fwdVec.y;
    const rightSpeed = vel.x * rightVec.x + vel.y * rightVec.y;

    const forwardCap = toAccel(state.thrustBudget.forward_kN, mass);
    const backwardCap = toAccel(state.thrustBudget.backward_kN, mass);
    const lateralCap = toAccel(state.thrustBudget.lateral_kN, mass);

    const desiredForwardAccel = -forwardSpeed / stopTime;
    const desiredRightAccel = -rightSpeed / stopTime;

    const command = {
      thrustForward: normalizeAccel(desiredForwardAccel, forwardCap, backwardCap),
      thrustRight: normalizeAccel(desiredRightAccel, lateralCap, lateralCap),
      torque: 0
    };

    const inertia = Math.max(env.inertia ?? 1, 0.1);
    const yawTorqueNm = Math.max(state.thrustBudget.yaw_kNm ?? 0, 0) * 1000;
    const moment = inertia * mass;
    const maxAngularAccel = yawTorqueNm > 0 && moment > 0 ? yawTorqueNm / moment : 0;
    const desiredAngularAccel = -state.angularVelocity / rotStop;
    command.torque = maxAngularAccel > 0 ? clamp(desiredAngularAccel / maxAngularAccel, -1, 1) : 0;

    const speed = Math.hypot(vel.x, vel.y);
    const finished = speed < (env.brake_speed_epsilon ?? 0.3) && Math.abs(state.angularVelocity) < (env.brake_rot_epsilon ?? 0.02);
    return { command, finished };
  }

  function projectSlip(state) {
    const vel = state.velocity;
    const fwdVec = { x: Math.cos(state.orientation), y: Math.sin(state.orientation) };
    const rightVec = { x: Math.sin(state.orientation), y: -Math.cos(state.orientation) };
    const forwardSpeed = vel.x * fwdVec.x + vel.y * fwdVec.y;
    const rightSpeed = vel.x * rightVec.x + vel.y * rightVec.y;
    return {
      forward: clamp(forwardSpeed / 80, -1, 1),
      right: clamp(rightSpeed / 80, -1, 1)
    };
  }

  function toAccel(thrust_kN, mass_kg) {
    if (!thrust_kN || !mass_kg) {
      return 0;
    }
    return (thrust_kN * 1000) / mass_kg;
  }

  function normalizeAccel(accel, posCap, negCap) {
    if (accel >= 0) {
      if (!posCap) {
        return 0;
      }
      return clamp(accel / posCap, -1, 1);
    }
    const positiveNegCap = negCap || posCap || 1;
    return clamp(accel / positiveNegCap, -1, 1);
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  return {
    createPilotAssist
  };
});
