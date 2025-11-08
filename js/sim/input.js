"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.U2InputController = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const DEFAULT_BINDINGS = {
    throttle_up: "w",
    throttle_down: "s",
    strafe_left: "a",
    strafe_right: "d",
    yaw_left: "q",
    yaw_right: "e",
    brake: " ",
    boost: "shift",
    toggle_coupled: "c",
    toggle_random_autopilot: "r"
  };

  function createInputController(appConfigInput = {}) {
    const bindings = normalizeBindings(appConfigInput.bindings || {});
    const keyState = new Set();
    const toggles = {
      coupled: false,
      autopilot: false
    };
    let pointerVector = { x: 0, y: 0 };
    let pointerActive = false;

    function normalizeKey(event) {
      return event.key?.toLowerCase();
    }

    function handleKeyDown(event) {
      const key = normalizeKey(event);
      if (!key) {
        return;
      }
      keyState.add(key);
    }

    function handleKeyUp(event) {
      const key = normalizeKey(event);
      if (!key) {
        return;
      }
      keyState.delete(key);
      if (key === bindings.toggle_coupled) {
        toggles.coupled = !toggles.coupled;
      }
      if (key === bindings.toggle_random_autopilot) {
        toggles.autopilot = !toggles.autopilot;
      }
    }

    function handlePointerMove(xNorm, yNorm) {
      pointerVector = { x: clamp(xNorm, -1, 1), y: clamp(yNorm, -1, 1) };
      pointerActive = true;
    }

    function handlePointerEnd() {
      pointerVector = { x: 0, y: 0 };
      pointerActive = false;
    }

    function update() {
      const thrustForward =
        (keyState.has(bindings.throttle_up) ? 1 : 0) - (keyState.has(bindings.throttle_down) ? 1 : 0);
      const thrustRight =
        (keyState.has(bindings.strafe_right) ? 1 : 0) - (keyState.has(bindings.strafe_left) ? 1 : 0);
      const torque = (keyState.has(bindings.yaw_right) ? 1 : 0) - (keyState.has(bindings.yaw_left) ? 1 : 0);

      return {
        thrustForward: clamp(thrustForward + (pointerActive ? -pointerVector.y : 0), -1, 1),
        thrustRight: clamp(thrustRight + (pointerActive ? pointerVector.x : 0), -1, 1),
        torque: clamp(torque, -1, 1),
        brake: keyState.has(bindings.brake),
        boost: keyState.has(bindings.boost),
        toggleCoupled: toggles.coupled,
        toggleAutopilot: toggles.autopilot
      };
    }

    return {
      handleKeyDown,
      handleKeyUp,
      handlePointerMove,
      handlePointerEnd,
      update
    };
  }

  function normalizeBindings(overrides) {
    const binding = { ...DEFAULT_BINDINGS };
    Object.keys(overrides).forEach((key) => {
      if (typeof overrides[key] === "string") {
        binding[key] = overrides[key].toLowerCase();
      }
    });
    return binding;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  return {
    createInputController
  };
});
