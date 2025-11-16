"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const core = require("../js/sim/core.js");
const pilotAssist = require("../js/sim/pilot-assist.js");
let shipAdapter = require("../js/lib/ship-adapter.js");
if (!shipAdapter || typeof shipAdapter.parseShipConfig !== "function") {
  shipAdapter = (globalThis && globalThis.U2ShipAdapter) || shipAdapter || {};
}

const ROOT = path.resolve(__dirname, "..");
const SHIP_PATH = path.join(ROOT, "ships", "fighter", "small fighter 06-config.json");
const BASE_CONFIG = JSON.parse(fs.readFileSync(SHIP_PATH, "utf8"));
const SHIP_RELATIVE = toPosix(path.relative(ROOT, SHIP_PATH));

const SHIPS = {
  Drift: makeSummary("Drift"),
  Grip: makeSummary("Grip"),
  Balanced: makeSummary("Balanced")
};

function makeSummary(style) {
  const clone = JSON.parse(JSON.stringify(BASE_CONFIG));
  clone.assist = clone.assist || {};
  clone.assist.preset = style;
  clone.assist.handling_style = style;
  return {
    config: clone,
    summary: shipAdapter.parseShipConfig(clone, SHIP_RELATIVE)
  };
}

function simulateScenario({ config, summary, steps, env = {}, inputPlan }) {
  const envState = {
    dt_sec: 1 / 60,
    c_mps: 10000,
    inertia: 1,
    ...env
  };
  let state = core.createState({
    mass_t: summary.mass_t ?? config.mass?.dry_t ?? 1,
    propulsion: config.propulsion
  });
  const assist = pilotAssist.createPilotAssist(summary);
  const history = [];
  for (let i = 0; i < steps; i += 1) {
    const manual = (typeof inputPlan === "function" ? inputPlan(i, state) : null) || {};
    const assistInput = {
      thrustForward: manual.thrustForward ?? 0,
      thrustRight: manual.thrustRight ?? 0,
      torque: manual.torque ?? 0,
      brake: manual.brake ?? false,
      boost: manual.boost ?? false,
      modeCoupled: manual.modeCoupled ?? true,
      autopilot: manual.autopilot ?? false
    };
    const stateBefore = state;
    const result = assist.update(stateBefore, assistInput, envState);
    const nextState = core.step(stateBefore, result.command, envState);
    history.push({
      step: i,
      telemetry: result.telemetry,
      command: result.command,
      result,
      stateBefore,
      state: nextState
    });
    state = nextState;
  }
  return { state, history };
}

function average(values, selector) {
  if (!values.length) {
    return 0;
  }
  const total = values.reduce((sum, item) => sum + selector(item), 0);
  return total / values.length;
}

function tail(values, length) {
  return values.slice(-Math.max(length, 0));
}

function toPosix(relPath) {
  return relPath.split(path.sep).join("/");
}

function testPA12DriftSteadySlip() {
  const { summary, config } = SHIPS.Drift;
  const result = simulateScenario({
    summary,
    config,
    steps: 420,
    inputPlan: (step) => {
      if (step < 120) {
        return { thrustForward: 1, modeCoupled: true };
      }
      return { thrustForward: 1, thrustRight: 0.8, modeCoupled: true };
    }
  });

  const recent = tail(result.history, 120);
  const avgSlip = average(recent, (frame) => frame.telemetry.slip_deg || 0);
  const avgTarget = average(recent, (frame) => frame.telemetry.slip_target_deg || 0);
  const slipLimit = summary.assist_slip_limit_deg || 18;
  assert.ok(
    avgSlip <= slipLimit + 2,
    `PA-12: Coupled должен удерживать β в пределах лимита (${slipLimit}°), получили ${avgSlip.toFixed(2)}°`
  );
  assert.ok(
    Math.abs(avgSlip - avgTarget) < 6,
    `PA-12: фактический слип должен совпадать с таргетом (β=${avgSlip.toFixed(2)}°, β*=${avgTarget.toFixed(2)}°)`
  );
  const maxLateral = Math.max(...recent.map((frame) => Math.abs(frame.command.thrustRight)));
  assert.ok(maxLateral <= 1.05, `PA-12: Coupled не должен пересекать бюджет латерали, получили ${maxLateral.toFixed(2)}`);
}

function testPA13GripPrecision() {
  const { summary, config } = SHIPS.Grip;
  const segments = [
    { start: 120, thrustRight: 0.9 },
    { start: 180, thrustRight: -0.9 },
    { start: 240, thrustRight: 0.9 },
    { start: 300, thrustRight: -0.9 }
  ];
  const result = simulateScenario({
    summary,
    config,
    steps: 420,
    inputPlan: (step) => {
      const active = [...segments].reverse().find((segment) => step >= segment.start);
      const thrustRight = active ? active.thrustRight : 0;
      return { thrustForward: 0.65, thrustRight, modeCoupled: true };
    }
  });
  const slipLimit = summary.assist_slip_limit_deg || 8;
  segments.forEach((segment) => {
    const window = result.history.slice(segment.start + 20, segment.start + 50);
    const avgSlip = average(window, (frame) => Math.abs(frame.telemetry.slip_deg || 0));
    const avgTarget = average(window, (frame) => Math.abs(frame.telemetry.slip_target_deg || 0));
    assert.ok(
      avgSlip <= slipLimit + 2,
      `PA-13: сегмент со strafe ${segment.thrustRight} превысил лимит (${avgSlip.toFixed(2)}°)`
    );
    assert.ok(
      Math.abs(avgSlip - avgTarget) < 5,
      `PA-13: Coupled должен следовать за целевым β при стрейфе (β=${avgSlip.toFixed(2)}°, β*=${avgTarget.toFixed(2)}°)`
    );
  });
}

function testPA14BrakeTransition() {
  const { summary, config } = SHIPS.Balanced;
  const accelFrames = 180;
  const brakeFrames = 60;
  const settleFrames = 120;
  const total = accelFrames + brakeFrames + settleFrames;
  const result = simulateScenario({
    summary,
    config,
    steps: total,
    inputPlan: (step) => {
      if (step < accelFrames) {
        return { thrustForward: 1, modeCoupled: true };
      }
      if (step < accelFrames + brakeFrames) {
        return { brake: true };
      }
      return { thrustForward: 0, modeCoupled: true };
    }
  });

  const brakeSegment = result.history.slice(accelFrames, accelFrames + brakeFrames);
  assert.ok(
    brakeSegment.every((frame) => frame.result.mode === "Brake"),
    "PA-14: в Brake-сегменте режим должен быть Brake"
  );
  const opposingThrust = brakeSegment.filter((frame) => {
    const vel = frame.stateBefore.velocity;
    const orientation = frame.stateBefore.orientation;
    const forwardVel = vel.x * Math.cos(orientation) + vel.y * Math.sin(orientation);
    return frame.command.thrustForward * forwardVel <= 0;
  });
  assert.ok(
    opposingThrust.length >= brakeSegment.length * 0.9,
    "PA-14: Brake должен выдавать тягу, противоположную текущему движению"
  );
  const opposingTorque = brakeSegment.filter(
    (frame) => frame.command.torque * frame.stateBefore.angularVelocity <= 0
  );
  assert.ok(
    opposingTorque.length >= brakeSegment.length * 0.9,
    "PA-14: Brake должен демпфировать вращение (torque против ω)"
  );
  const postBrake = result.history.slice(accelFrames + brakeFrames, accelFrames + brakeFrames + 40);
  const jerkHits = postBrake.filter((frame) => frame.telemetry.jerk_clamped_forward).length;
  assert.ok(jerkHits <= 20, `PA-14: Coupled не должен постоянно упираться в jerk, clamped=${jerkHits}`);
}

function testPA15LimiterRegression() {
  const { summary, config } = SHIPS.Balanced;
  const result = simulateScenario({
    summary,
    config,
    steps: 900,
    env: { c_mps: 400 },
    inputPlan: () => ({ thrustForward: 1, modeCoupled: true })
  });
  const limiterFrames = tail(result.history, 120);
  assert.ok(
    limiterFrames.some((frame) => frame.telemetry.limiter_active),
    "PA-15: limiter должен сработать при превышении порога"
  );
  const reducedForward = limiterFrames.filter((frame) => frame.command.thrustForward < 0.95);
  assert.ok(reducedForward.length > 0, "PA-15: thrustForward должен снижаться при активном limiter");
  const slipDuringLimiter = Math.max(...limiterFrames.map((frame) => Math.abs(frame.telemetry.slip_deg || 0)));
  assert.ok(slipDuringLimiter < 8, `PA-15: limiter не должен ломать стабилизацию, β=${slipDuringLimiter.toFixed(2)}°`);
}

function run() {
  testPA12DriftSteadySlip();
  testPA13GripPrecision();
  testPA14BrakeTransition();
  testPA15LimiterRegression();
  console.log("flighttest-pa.test.js: OK");
}

run();
