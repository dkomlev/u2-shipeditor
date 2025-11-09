"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./coupled-controller.js"));
  } else {
    root.U2PilotAssist = factory(root.U2CoupledController);
  }
})(typeof self !== "undefined" ? self : this, function (CoupledController) {
  const EPS_V = 0.05;

  function createPilotAssist(summary = {}) {
    let randomVec = { x: 0, y: 0 };
    let randomTimer = 0;
    let randomTorque = 0;
    let boostCooldownTimer = 0;
    let prevAngularAccel = 0;  // Track angular acceleration for jerk limiting
    const coupled = CoupledController?.createCoupledController
      ? CoupledController.createCoupledController({
          handling: summary.assist?.handling,
          jerk: summary.assist?.jerk,
          speedLimiterRatio: summary.assist?.speed_limiter_ratio,
          profileName: summary.assist?.handling_style
        })
      : null;

    function update(state, input, env) {
      const dt = env.dt_sec ?? 1 / 60;
      const modeCoupled = !!input.modeCoupled;
      const autopilot = !!input.autopilot;
      const command = {
        thrustForward: clamp(input.thrustForward ?? 0, -1, 1),
        thrustRight: clamp(input.thrustRight ?? 0, -1, 1),
        torque: clamp(input.torque ?? 0, -1, 1)
      };

      // Update boost cooldown
      if (boostCooldownTimer > 0) {
        boostCooldownTimer -= dt;
      }

      if (input.brake) {
        const brakeResult = applyBrake(state, env, summary.assist?.brake, input.boost, boostCooldownTimer);
        // Start cooldown if boost was used
        if (input.boost && boostCooldownTimer <= 0 && summary.assist?.brake) {
          boostCooldownTimer = summary.assist.brake.boost_cooldown_s ?? 15;
        }
        return {
          command: brakeResult.command,
          mode: "Brake",
          autopilot: false,
          brake: true,
          telemetry: buildTelemetry(state, summary.assist)
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

      let telemetry = null;
      if (modeCoupled && coupled) {
        const coupledResult = coupled.update(
          state,
          {
            thrustForward: clamp(input.thrustForward ?? 0, -1, 1),
            thrustRight: clamp(input.thrustRight ?? 0, -1, 1),
            turn: clamp(input.torque ?? 0, -1, 1)
          },
          {
            dt_sec: dt,
            c_mps: env.c_mps ?? 10000,
            vmax_runtime: env.c_mps ?? 10000,
            inertia: env.inertia ?? 1
          }
        );
        command.thrustForward = coupledResult.command.thrustForward;
        command.thrustRight = coupledResult.command.thrustRight;
        command.torque = coupledResult.command.torque;
        telemetry = coupledResult.telemetry;
        prevAngularAccel = 0;  // Reset in Coupled mode
      } else {
        // Decoupled: apply angular jerk limiting for smooth rotation ramp
        const angularJerkLimit = summary.assist?.jerk?.angular_rps3 ?? 0.8;
        const targetAngularAccel = command.torque;  // Normalized -1..1
        const jerkResult = applyAngularJerk(prevAngularAccel, targetAngularAccel, angularJerkLimit, dt);
        prevAngularAccel = jerkResult.value;
        command.torque = jerkResult.value;
      }

      command.thrustForward = clamp(command.thrustForward + randomVec.y, -1, 1);
      command.thrustRight = clamp(command.thrustRight + randomVec.x, -1, 1);
      command.torque = clamp(command.torque + randomTorque, -1, 1);

      return {
        command,
        mode: modeCoupled ? "Coupled" : "Decoupled",
        autopilot,
        brake: false,
        telemetry: telemetry || buildTelemetry(state, summary.assist)
      };
    }

    return { update };
  }

  function applyBrake(state, env, assistBrake, boostRequested, cooldownRemaining) {
    const g0 = 9.80665;
    const mass = Math.max(state.mass_t ?? 1, 0.1) * 1000;
    
    // Use assist.brake settings if available, otherwise fallback to env
    const canBoost = boostRequested && cooldownRemaining <= 0;
    const gTarget = assistBrake 
      ? (canBoost ? assistBrake.g_boost : assistBrake.g_sustain)
      : (env.brake_g ?? 5);
    
    const stopTime = Math.max(env.brake_time ?? 0.25, 0.05);
    const rotStop = Math.max(env.brake_rot_time ?? 0.15, 0.03);
    
    const vel = state.velocity;
    const speed = Math.hypot(vel.x, vel.y);
    const fwdVec = { x: Math.cos(state.orientation), y: Math.sin(state.orientation) };
    const rightVec = { x: Math.sin(state.orientation), y: -Math.cos(state.orientation) };
    const forwardSpeed = vel.x * fwdVec.x + vel.y * fwdVec.y;
    const rightSpeed = vel.x * rightVec.x + vel.y * rightVec.y;

    // SR-клампы для Brake (§4.3 ТЗ)
    const c = env.c_mps ?? 10000;
    const vOverC = Math.min(speed / c, 0.999);
    const gamma = 1 / Math.sqrt(1 - vOverC * vOverC);

    const rawForwardCap = toAccel(state.thrustBudget.forward_kN, mass);
    const rawBackwardCap = toAccel(state.thrustBudget.backward_kN, mass);
    const rawLateralCap = toAccel(state.thrustBudget.lateral_kN, mass);

    // Apply SR clamps
    const forwardCap = Math.min(rawForwardCap / Math.pow(gamma, 3), gTarget * g0);
    const backwardCap = Math.min(rawBackwardCap / Math.pow(gamma, 3), gTarget * g0);
    const lateralCap = Math.min(rawLateralCap / gamma, gTarget * g0);

    const command = {
      thrustForward: 0,
      thrustRight: 0,
      torque: 0
    };

    // Edge case: very low speed (§4.3 ТЗ)
    if (speed < 1e-10) {
      // Only rotational damping
    } else {
      const desiredForwardAccel = -forwardSpeed / stopTime;
      const desiredRightAccel = -rightSpeed / stopTime;
      command.thrustForward = normalizeAccel(desiredForwardAccel, forwardCap, backwardCap);
      command.thrustRight = normalizeAccel(desiredRightAccel, lateralCap, lateralCap);
    }

    // Edge case: very low angular velocity
    if (Math.abs(state.angularVelocity) > 1e-10) {
      const inertia = Math.max(env.inertia ?? 1, 0.1);
      const yawTorqueNm = Math.max(state.thrustBudget.yaw_kNm ?? 0, 0) * 1000;
      const moment = inertia * mass;
      const maxAngularAccel = yawTorqueNm > 0 && moment > 0 ? yawTorqueNm / moment : 0;
      const desiredAngularAccel = -state.angularVelocity / rotStop;
      command.torque = maxAngularAccel > 0 ? clamp(desiredAngularAccel / maxAngularAccel, -1, 1) : 0;
    }

    const finished = speed < (env.brake_speed_epsilon ?? 0.3) && Math.abs(state.angularVelocity) < (env.brake_rot_epsilon ?? 0.02);
    return { command, finished };
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

  function buildTelemetry(state, assist = {}) {
    const beta = calcSlip(state) * (180 / Math.PI);
    const speed = Math.hypot(state.velocity?.x ?? 0, state.velocity?.y ?? 0);
    const c = 10000; // fallback, ideally from env
    const vOverC = Math.min(speed / c, 0.999);
    const gamma = 1 / Math.sqrt(1 - vOverC * vOverC);
    
    return {
      slip_deg: beta,
      slip_target_deg: 0,
      profile: assist?.handling_style || "Balanced",
      limiter_active: false,
      jerk_clamped_forward: false,
      jerk_clamped_lateral: false,
      gamma: gamma,
      v_over_c: vOverC,
      sr_active: vOverC >= 0.5,
      a_fwd_eff_mps2: 0,
      a_lat_eff_mps2: 0
    };
  }

  function calcSlip(state) {
    const vel = state.velocity || { x: 0, y: 0 };
    const orientation = state.orientation || 0;
    const fwd = { x: Math.cos(orientation), y: Math.sin(orientation) };
    const right = { x: Math.sin(orientation), y: -Math.cos(orientation) };
    const forwardSpeed = vel.x * fwd.x + vel.y * fwd.y;
    const rightSpeed = vel.x * right.x + vel.y * right.y;
    return Math.atan2(rightSpeed, forwardSpeed || 1e-6);
  }

  function applyAngularJerk(prev, target, jerkLimit, dt) {
    if (!jerkLimit || dt <= 0) {
      return { value: target, clamped: false };
    }
    const delta = target - prev;
    const maxDelta = jerkLimit * dt;
    if (delta > maxDelta) {
      return { value: prev + maxDelta, clamped: true };
    }
    if (delta < -maxDelta) {
      return { value: prev - maxDelta, clamped: true };
    }
    return { value: target, clamped: false };
  }

  return {
    createPilotAssist
  };
});
