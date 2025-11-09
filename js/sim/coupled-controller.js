"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.U2CoupledController = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const DEG2RAD = Math.PI / 180;
  const RAD2DEG = 180 / Math.PI;

  function createCoupledController(options = {}) {
    let handling = sanitizeHandling(options.handling || {}, options.profileName);
    let jerk = sanitizeJerk(options.jerk || {});
    let limiterRatio = clamp(options.speedLimiterRatio ?? 0.85, 0.2, 1);
    let profileName = handling.profileName || options.profileName || "Balanced";
    let prevForwardAccel = 0;
    let prevSlipAccel = 0;

    function configure(next = {}) {
      if (next.handling) {
        handling = sanitizeHandling(next.handling, next.profileName || handling.profileName);
      }
      if (next.jerk) {
        jerk = sanitizeJerk(next.jerk);
      }
      if (typeof next.speedLimiterRatio === "number") {
        limiterRatio = clamp(next.speedLimiterRatio, 0.2, 1);
      }
      if (next.profileName) {
        profileName = next.profileName;
      }
    }

    function update(state, input, env = {}) {
      const dt = env.dt_sec ?? 1 / 60;
      const c = env.c_mps ?? 10000;
      const vmaxRuntime = env.vmax_runtime ?? c;

      const mass = Math.max(state.mass_t ?? 1, 0.1) * 1000;
      const thrustBudget = state.thrustBudget || {};
      const forwardCap = accelFromBudget(thrustBudget.forward_kN, mass);
      const backwardCap = accelFromBudget(thrustBudget.backward_kN ?? thrustBudget.forward_kN, mass);
      const lateralCap = accelFromBudget(thrustBudget.lateral_kN, mass);
      const yawAccelCap = angularAccelFromBudget(thrustBudget.yaw_kNm, mass, env.inertia ?? 1);

      const beta = calcSlip(state);
      const speed = Math.hypot(state.velocity?.x ?? 0, state.velocity?.y ?? 0);
      const turnInput = clamp(input.turn ?? input.torque ?? 0, -1, 1);
      const throttleInput = clamp(input.thrustForward ?? 0, -1, 1);
      const strafeInput = clamp(input.thrustRight ?? 0, -1, 1);

      const betaTarget = solveSlipTarget(strafeInput, speed, handling);
      const slipError = betaTarget - beta;

      const manualLatAccel = strafeInput * lateralCap;
      const turnAssistAccel = turnInput * lateralCap * (handling.turn_assist || 0);
      const slipCorrection = computeSlipCorrection(slipError, handling, lateralCap);
      const smoothedSlip = applyJerk(prevSlipAccel, slipCorrection, jerk.lateral_mps3, dt);
      prevSlipAccel = smoothedSlip;
      const combinedLatAccel = clamp(manualLatAccel + turnAssistAccel + smoothedSlip, -lateralCap, lateralCap);
      const thrustRight = lateralCap > 0 ? clamp(combinedLatAccel / lateralCap, -1, 1) : 0;

      let forwardAccelTarget = solveForwardAccel(throttleInput, forwardCap, backwardCap, handling);
      forwardAccelTarget = applySpeedLimiter(forwardAccelTarget, speed, vmaxRuntime, c, limiterRatio);
      const smoothedFwdAccel = applyJerk(prevForwardAccel, forwardAccelTarget, jerk.forward_mps3, dt);
      prevForwardAccel = smoothedFwdAccel;
      const forwardDivisor = smoothedFwdAccel >= 0 ? forwardCap : backwardCap;
      const thrustForward = forwardDivisor > 0 ? clamp(smoothedFwdAccel / forwardDivisor, -1, 1) : 0;

      const torque = solveYawCommand(turnInput, slipError, state.angularVelocity ?? 0, yawAccelCap, handling);

      return {
        command: {
          thrustForward,
          thrustRight: clamp(thrustRight, -1, 1),
          torque
        },
        telemetry: {
          slip_deg: beta * RAD2DEG,
          slip_target_deg: betaTarget * RAD2DEG,
          profile: profileName || handling.profileName || "Balanced",
          limiter_active: speed > Math.min(vmaxRuntime, c) * limiterRatio
        }
      };
    }

    return {
      update,
      configure
    };
  }

  function sanitizeHandling(raw = {}, profileName = "Balanced") {
    const profile = profileName || raw.profileName || "Balanced";
    return {
      profileName: profile,
      stab_gain: clamp(raw.stab_gain ?? 0.9, 0.3, 1.6),
      stab_damping: clamp(raw.stab_damping ?? 1.1, 0.4, 3),
      slip_threshold_deg: clamp(raw.slip_threshold_deg ?? 8, 2, 25),
      slip_limit_deg: clamp(raw.slip_limit_deg ?? 12, 4, 30),
      slip_correction_gain: clamp(raw.slip_correction_gain ?? 1.2, 0.2, 3),
      nose_follow_input: clamp(raw.nose_follow_input ?? 0.35, 0, 1),
      anticipation_gain: clamp(raw.anticipation_gain ?? 0.08, 0, 0.5),
      oversteer_bias: clamp(raw.oversteer_bias ?? 0, -0.5, 0.5),
      bias: clamp(raw.bias ?? 0, -1, 1),
      responsiveness: clamp(raw.responsiveness ?? 0.9, 0.1, 2.5),
      slip_target_max: clamp(raw.slip_target_max ?? raw.slip_limit_deg ?? 12, 2, 40),
      traction_control: clamp(raw.traction_control ?? 0.4, 0, 1),
      cap_main_coupled: clamp(raw.cap_main_coupled ?? 0.7, 0.2, 1),
      lat_authority: clamp(raw.lat_authority ?? 0.85, 0.2, 1),
      turn_authority: clamp(raw.turn_authority ?? 0.7, 0, 2),
      turn_assist: clamp(raw.turn_assist ?? 0.3, 0, 1),
      traction_floor: clamp(raw.traction_floor ?? 0.25, 0, 1),
      traction_speed_ref: clamp(raw.traction_speed_ref ?? 320, 50, 1000),
      nose_align_gain: clamp(raw.nose_align_gain ?? 0.1, 0, 1)
    };
  }

  function sanitizeJerk(raw = {}) {
    return {
      forward_mps3: clamp(raw.forward_mps3 ?? 160, 10, 800),
      lateral_mps3: clamp(raw.lateral_mps3 ?? 120, 10, 600)
    };
  }

function solveSlipTarget(strafeInput, speed, handling) {
  const slipLimit = handling.slip_limit_deg * DEG2RAD;
  const slipThreshold = handling.slip_threshold_deg * DEG2RAD;
  let betaTarget = (handling.bias ?? 0) * slipLimit;
  betaTarget += (handling.responsiveness * strafeInput) * handling.slip_target_max * DEG2RAD;
  betaTarget = clamp(betaTarget, -slipLimit, slipLimit);

  const tractionRef = handling.traction_speed_ref || 300;
  const tractionFloor = handling.traction_floor ?? 0.2;
  const tractionFactor = Math.max(
    tractionFloor,
    1 - handling.traction_control * Math.min(speed / tractionRef, 1)
  );
  betaTarget *= tractionFactor;

  if (Math.abs(betaTarget) < slipThreshold && slipThreshold > 0) {
    const ratio = Math.abs(betaTarget) / slipThreshold;
    betaTarget *= 0.5 + 0.5 * ratio;
  }
  return betaTarget;
}

  function computeSlipCorrection(slipError, handling, lateralCap) {
    if (!lateralCap) {
      return 0;
    }
    const slipLimitRad = handling.slip_limit_deg * DEG2RAD || DEG2RAD;
    const normalized = slipError / slipLimitRad;
    const maxCorrection = lateralCap * handling.lat_authority;
    return clamp(normalized * maxCorrection, -maxCorrection, maxCorrection);
  }

  function solveForwardAccel(throttleInput, forwardCap, backwardCap, handling) {
    if (throttleInput >= 0) {
      const cap = forwardCap * handling.cap_main_coupled;
      return clamp(throttleInput * forwardCap, -cap, cap);
    }
    const cap = backwardCap * handling.cap_main_coupled;
    return clamp(throttleInput * backwardCap, -cap, cap);
  }

  function applySpeedLimiter(accel, speed, vmaxRuntime, c, ratio) {
    const limit = Math.min(vmaxRuntime, c) * ratio;
    if (limit <= 0) {
      return accel;
    }
    if (speed <= limit || accel <= 0) {
      return accel;
    }
    const over = clamp((speed - limit) / Math.max(limit * 0.25, 1), 0, 1);
    return accel * (1 - over);
  }

function solveYawCommand(turnInput, slipError, angularVelocity, yawAccelCap, handling) {
  const leadTerm = handling.anticipation_gain * angularVelocity;
  const manualTerm = (handling.turn_authority ?? handling.stab_gain ?? 1) * turnInput;
  const damping = -handling.stab_damping * angularVelocity;
  const biasTerm = handling.bias * 0.1;
  const alignGain = handling.nose_align_gain ?? 0;
  const alignScale = Math.abs(turnInput) < 0.2 ? 1 : 0.2;
  const alignTerm = alignGain * alignScale * slipError;
  const alphaCmd = leadTerm + manualTerm + damping + biasTerm + alignTerm;
  if (yawAccelCap <= 0) {
    return clamp(alphaCmd, -1, 1);
  }
  return clamp(alphaCmd / yawAccelCap, -1, 1);
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

  function accelFromBudget(thrust_kN = 0, mass_kg = 1) {
    if (!thrust_kN || !mass_kg) {
      return 0;
    }
    return (thrust_kN * 1000) / mass_kg;
  }

  function angularAccelFromBudget(yaw_kNm = 0, mass_kg = 1, inertia = 1) {
    if (!yaw_kNm) {
      return 0;
    }
    const torque = yaw_kNm * 1000;
    const moment = Math.max(inertia, 0.05) * mass_kg;
    if (!moment) {
      return 0;
    }
    return torque / moment;
  }

  function applyJerk(prev, target, jerkLimit, dt) {
    if (!jerkLimit || dt <= 0) {
      return target;
    }
    const delta = target - prev;
    const maxDelta = jerkLimit * dt;
    if (delta > maxDelta) {
      return prev + maxDelta;
    }
    if (delta < -maxDelta) {
      return prev - maxDelta;
    }
    return target;
  }

  function clamp(value, min, max) {
    if (value < min) {
      return min;
    }
    if (value > max) {
      return max;
    }
    return value;
  }

  return {
    createCoupledController
  };
});
