"use strict";

const assert = require("assert");
const CoupledController = require("../js/sim/coupled-controller.js");

function makeState(overrides = {}) {
  return {
    mass_t: 85,
    thrustBudget: {
      forward_kN: 4500,
      backward_kN: 2200,
      lateral_kN: 1800,
      yaw_kNm: 320,
      ...overrides.thrustBudget
    },
    velocity: overrides.velocity || { x: 0, y: 0 },
    orientation: overrides.orientation ?? 0,
    angularVelocity: overrides.angularVelocity ?? 0
  };
}

function testTurnAllowsTorque() {
  const controller = CoupledController.createCoupledController({
    handling: {
      turn_authority: 0.8,
      turn_assist: 0.4
    },
    profileName: "Drift"
  });
  const result = controller.update(
    makeState(),
    { thrustForward: 0.5, turn: 0.8 },
    { dt_sec: 1 / 60, c_mps: 10000, vmax_runtime: 10000, inertia: 1 }
  );

  assert.ok(result.command.torque > 0.05, "controller should generate torque when turn input is applied");
  assert.ok(Math.abs(result.telemetry.slip_target_deg) < 0.01, "default slip target should stay near zero without manual strafe");
}

function testLimiterReducesForward() {
  const controller = CoupledController.createCoupledController({
    handling: {
      cap_main_coupled: 0.5,
      lat_authority: 0.8
    },
    speedLimiterRatio: 0.6,
    profileName: "Grip"
  });
  const state = makeState({
    velocity: { x: 5000, y: 0 } // заведомо выше лимита
  });
  const result = controller.update(
    state,
    { thrustForward: 1, turn: 0 },
    { dt_sec: 1 / 60, c_mps: 10000, vmax_runtime: 10000, inertia: 1 }
  );
  assert.ok(result.command.thrustForward < 0.6, "limiter should clamp forward thrust when speed is high");
}

function testManualStrafePassThrough() {
  const controller = CoupledController.createCoupledController({
    handling: {
      lat_authority: 0.8,
      cap_main_coupled: 0.6
    },
    profileName: "Balanced"
  });
  const state = makeState();
  const result = controller.update(
    state,
    { thrustForward: 0, thrustRight: 1, turn: 0 },
    { dt_sec: 1 / 60, c_mps: 10000, vmax_runtime: 10000, inertia: 1 }
  );
  assert.ok(result.command.thrustRight > 0.9, "manual strafe input should pass through in Coupled mode");
  assert.ok(result.telemetry.slip_target_deg > 5, "positive strafe should request positive slip");
}

function run() {
  testTurnAllowsTorque();
  testLimiterReducesForward();
  testManualStrafePassThrough();
  console.log("coupled-controller.test.js: OK");
}

run();
