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
    let jerk = sanitizeJerk(options.jerk || {}, options.config || {});
    let profileName = handling.profileName || options.profileName || "Balanced";
    let angularDps = options.angular_dps || null;
    let prevForwardAccel = 0;
    let prevSlipAccel = 0;

    function configure(next = {}) {
      if (next.handling) {
        handling = sanitizeHandling(next.handling, next.profileName || handling.profileName);
      }
      if (next.jerk) {
        jerk = sanitizeJerk(next.jerk, next.config || options.config || {});
      }
      // speedLimiterRatio removed - no artificial limits
      if (next.profileName) {
        profileName = next.profileName;
      }
      if (next.angular_dps !== undefined) {
        angularDps = next.angular_dps;
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
      const Izz = state.inertiaTensor?.Izz ?? (0.15 * mass * 20 * 20);
      const yawAccelCap = angularAccelFromBudget(thrustBudget.yaw_kNm, Izz);

      const beta = calcSlip(state);
      const speed = Math.hypot(state.velocity?.x ?? 0, state.velocity?.y ?? 0);
      const turnInput = clamp(input.turn ?? input.torque ?? 0, -1, 1);
      const throttleInput = clamp(input.thrustForward ?? 0, -1, 1);
      const strafeInput = clamp(input.thrustRight ?? 0, -1, 1);

      const betaTarget = solveSlipTarget(turnInput, strafeInput, speed, handling);
      const slipError = betaTarget - beta;

      const manualLatAccel = strafeInput * lateralCap;
      const turnAssistAccel = turnInput * lateralCap * (handling.turn_assist || 0);
      const slipCorrection = computeSlipCorrection(slipError, handling, lateralCap);
      const slipJerk = applyJerk(prevSlipAccel, slipCorrection, jerk.lateral_mps3, dt);
      prevSlipAccel = slipJerk.value;
      const combinedLatAccel = clamp(manualLatAccel + turnAssistAccel + slipJerk.value, -lateralCap, lateralCap);
      const thrustRight = lateralCap > 0 ? clamp(combinedLatAccel / lateralCap, -1, 1) : 0;

      let forwardAccelTarget = solveForwardAccel(throttleInput, forwardCap, backwardCap, handling);
      // No artificial speed limiting - pure physics only
      const forwardJerk = applyJerk(prevForwardAccel, forwardAccelTarget, jerk.forward_mps3, dt);
      prevForwardAccel = forwardJerk.value;
      const forwardDivisor = forwardJerk.value >= 0 ? forwardCap : backwardCap;
      const thrustForward = forwardDivisor > 0 ? clamp(forwardJerk.value / forwardDivisor, -1, 1) : 0;

      // Limit angular velocity to ship specifications
      const maxAngularVelRps = angularDps ? (angularDps.yaw ?? angularDps.pitch ?? 60) * Math.PI / 180 : Math.PI;
      const currentAngularVel = Math.abs(state.angularVelocity ?? 0);
      let torqueModifier = 1;

      // If max angular velocity is 0, completely disable rotation
      if (maxAngularVelRps === 0) {
        torqueModifier = 0;
      } else if (currentAngularVel >= maxAngularVelRps * 0.95) {
        const velDirection = (state.angularVelocity ?? 0) >= 0 ? 1 : -1;
        const turnDirection = turnInput >= 0 ? 1 : -1;
        // Only allow torque that opposes current rotation
        if (turnDirection === velDirection && Math.abs(turnInput) > 0.1) {
          torqueModifier = 0;
        }
      }

      const rawTorque = solveYawCommand(turnInput, slipError, state.angularVelocity ?? 0, yawAccelCap, handling);
      
      // Limit torque by angular velocity specifications
      const maxTorqueFromDps = yawAccelCap > 0 ? (maxAngularVelRps / 0.2) / yawAccelCap : 1;
      const limitedRawTorque = clamp(rawTorque, -maxTorqueFromDps, maxTorqueFromDps);
      
      const torque = limitedRawTorque * torqueModifier;

      // SR telemetry (§8 ТЗ v0.6.3)
      const vOverC = Math.min(speed / c, 0.999);
      const gamma = 1 / Math.sqrt(1 - vOverC * vOverC);
      const a_fwd_eff = forwardJerk.value / Math.pow(gamma, 3);
      const a_lat_eff = combinedLatAccel / gamma;

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
          limiter_active: false,  // No artificial speed limiter
          jerk_clamped_forward: forwardJerk.clamped,
          jerk_clamped_lateral: slipJerk.clamped,
          gamma: gamma,
          v_over_c: vOverC,
          sr_active: vOverC >= 0.5,
          a_fwd_eff_mps2: a_fwd_eff,
          a_lat_eff_mps2: a_lat_eff
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
      slip_target_max: clamp(raw.slip_target_max ?? raw.slip_limit_deg ?? 12, 2, 90),
      // traction_control, traction_floor, traction_speed_ref REMOVED - no friction in space!
      cap_main_coupled: clamp(raw.cap_main_coupled ?? 0.7, 0.2, 1),
      lat_authority: clamp(raw.lat_authority ?? 0.85, 0.2, 1),
      turn_authority: clamp(raw.turn_authority ?? 0.7, 0, 2),
      turn_assist: clamp(raw.turn_assist ?? 0.3, 0, 1),
      strafe_to_slip_gain: clamp(raw.strafe_to_slip_gain ?? 0.3, 0, 2),
      nose_align_gain: clamp(raw.nose_align_gain ?? 0.1, 0, 1)
    };
  }

  function sanitizeJerk(raw = {}, config = {}) {
    // Calculate angular jerk from RCS characteristics if not provided
    // Jerk = dτ/dt / I  (rate of change of torque divided by moment of inertia)
    // For RCS thrusters, assume they can ramp up in ~0.1s (typical servo response)
    const mass_kg = (config.mass_t ?? 1) * 1000;
    const length_m = config.geometry?.length_m ?? 20;
    const Izz = config.inertia_opt?.Izz ?? (0.15 * mass_kg * length_m * length_m);
    const yaw_kNm = config.propulsion?.rcs?.yaw_kNm ?? 300;
    const torque_Nm = yaw_kNm * 1000;
    
    // Torque ramp time (how fast RCS can change thrust)
    const rampTime = 0.1; // 100ms typical for spacecraft RCS valves
    const defaultAngularJerk = (torque_Nm / rampTime) / Izz;
    
    return {
      forward_mps3: clamp(raw.forward_mps3 ?? 160, 10, 800),
      lateral_mps3: clamp(raw.lateral_mps3 ?? 120, 10, 600),
      angular_rps3: clamp(raw.angular_rps3 ?? defaultAngularJerk, 0.1, 50)  // Physical RCS response
    };
  }

function solveSlipTarget(turnInput, strafeInput, speed, handling) {
  const slipLimit = handling.slip_limit_deg * DEG2RAD;
  const slipThreshold = handling.slip_threshold_deg * DEG2RAD;
  const direction = turnInput !== 0 ? Math.sign(turnInput) : Math.sign(strafeInput || 1);
  const turnComponent = handling.slip_target_max * DEG2RAD * handling.responsiveness * Math.abs(turnInput);

  let betaTarget = direction * turnComponent;
  betaTarget += (handling.bias ?? 0) * slipLimit;
  betaTarget = clamp(betaTarget, -slipLimit, slipLimit);

  // Pure physics - no artificial "traction control" (no friction in space!)
  // Speed does not affect slip angle

  // Smooth out small inputs to prevent jitter (physical servo behavior)
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

  // REMOVED: applySpeedLimiter - artificial arcade limiter
  // Speed is now limited only by physics (thrust and mass)

function solveYawCommand(turnInput, slipError, angularVelocity, yawAccelCap, handling) {
  // Only apply damping when there's angular velocity
  const damping = -handling.stab_damping * angularVelocity;
  
  // Manual control term - main command from pilot
  const manualTerm = (handling.turn_authority ?? handling.stab_gain ?? 1) * turnInput;
  
  // Anticipation term - only when turning
  const leadTerm = Math.abs(turnInput) > 0.05 ? handling.anticipation_gain * angularVelocity : 0;
  
  // Bias term - only apply when actively turning
  const biasTerm = Math.abs(turnInput) > 0.05 ? handling.bias * 0.1 * Math.sign(turnInput) : 0;
  
  // Nose alignment - only when actively turning
  const alignGain = handling.nose_align_gain ?? 0;
  const alignScale = Math.abs(turnInput) < 0.2 ? 1 : 0.3;
  const alignTerm = Math.abs(turnInput) > 0.05 ? alignGain * alignScale * slipError : 0;
  
  const alphaCmd = manualTerm + damping + leadTerm + biasTerm + alignTerm;
  
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

  function angularAccelFromBudget(yaw_kNm = 0, Izz = 1) {
    if (!yaw_kNm || !Izz) {
      return 0;
    }
    const torque = yaw_kNm * 1000;
    return torque / Izz;
  }

function applyJerk(prev, target, jerkLimit, dt) {
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
