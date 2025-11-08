"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./core.js"));
  } else {
    root.U2PilotAssist = factory(
      (typeof root !== "undefined" && root.U2SimCore) || (typeof globalThis !== "undefined" && globalThis.U2SimCore)
    );
  }
})(typeof self !== "undefined" ? self : this, function (core) {
  const EPS_V = 0.05;

  function createPilotAssist(summary = {}, options = {}) {
    let mode = "Coupled";
    let autopilotEnabled = options.autopilot ?? true;
    let brakeActive = false;
    let randomVec = { x: 0, y: 0 };
    let randomTimer = 0;

    function update(state, input, env) {
      if (input.toggleCoupled) {
        mode = mode === "Coupled" ? "Decoupled" : "Coupled";
      }
      if (input.toggleAutopilot) {
        autopilotEnabled = !autopilotEnabled;
      }

      const command = {
        thrustForward: 0,
        thrustRight: 0,
        torque: clamp(input.torque ?? 0, -1, 1)
      };

      if (input.brake) {
        brakeActive = true;
      }

      if (brakeActive) {
        applyBrake(state, command);
        const speed = Math.hypot(state.velocity.x, state.velocity.y);
        if (speed < EPS_V && !input.brake) {
          brakeActive = false;
        }
        return { command, mode: "Brake", autopilot: false };
      }

      if (autopilotEnabled && !input.brake) {
        randomTimer -= env.dt_sec ?? 0.016;
        if (randomTimer <= 0) {
          randomVec = {
            x: (Math.random() * 2 - 1) * 0.4,
            y: (Math.random() * 2 - 1) * 0.4
          };
          randomTimer = 1.5;
        }
      } else {
        randomVec = { x: 0, y: 0 };
      }

      if (mode === "Coupled") {
        const desiredForward = clamp(input.thrustForward ?? 0, -1, 1);
        const desiredRight = clamp(input.thrustRight ?? 0, -1, 1);
        const slip = projectSlip(state);
        command.thrustForward = clamp(desiredForward - slip.forward * (summary.assist?.stab_gain ?? 0.8), -1, 1);
        command.thrustRight = clamp(desiredRight - slip.right * (summary.assist?.stab_gain ?? 0.8), -1, 1);
      } else {
        command.thrustForward = clamp(input.thrustForward ?? 0, -1, 1);
        command.thrustRight = clamp(input.thrustRight ?? 0, -1, 1);
      }

      command.thrustForward = clamp(command.thrustForward + randomVec.y, -1, 1);
      command.thrustRight = clamp(command.thrustRight + randomVec.x, -1, 1);

      return { command, mode, autopilot: autopilotEnabled };
    }

    return {
      update
    };
  }

  function applyBrake(state, command) {
    const vel = state.velocity;
    const fwdVec = { x: Math.cos(state.orientation), y: Math.sin(state.orientation) };
    const rightVec = { x: -Math.sin(state.orientation), y: Math.cos(state.orientation) };
    const forwardSpeed = vel.x * fwdVec.x + vel.y * fwdVec.y;
    const rightSpeed = vel.x * rightVec.x + vel.y * rightVec.y;
    command.thrustForward = clamp(-forwardSpeed, -1, 1);
    command.thrustRight = clamp(-rightSpeed, -1, 1);
    command.torque = clamp(-state.angularVelocity, -1, 1);
  }

  function projectSlip(state) {
    const vel = state.velocity;
    const fwdVec = { x: Math.cos(state.orientation), y: Math.sin(state.orientation) };
    const rightVec = { x: -Math.sin(state.orientation), y: Math.cos(state.orientation) };
    const forwardSpeed = vel.x * fwdVec.x + vel.y * fwdVec.y;
    const rightSpeed = vel.x * rightVec.x + vel.y * rightVec.y;
    return {
      forward: clamp(forwardSpeed / 50, -1, 1),
      right: clamp(rightSpeed / 50, -1, 1)
    };
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  return {
    createPilotAssist
  };
});
