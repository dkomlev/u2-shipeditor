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
    let pointerVector = { x: 0, y: 0 };
    let pointerActive = false;
    const state = {
      coupled: false,
      autopilot: false
    };

    function handleKeyDown(event) {
      const key = normalizeKey(event.key);
      const code = normalizeKey(event.code);
      if (key) {
        keyState.add(key);
      }
      if (code) {
        keyState.add(code);
      }
    }

    function handleKeyUp(event) {
      const key = normalizeKey(event.key);
      const code = normalizeKey(event.code);
      if (key) {
        keyState.delete(key);
      }
      if (code) {
        keyState.delete(code);
      }
      if (matchesBinding(bindings.toggle_coupled, key, code)) {
        state.coupled = !state.coupled;
      }
      if (matchesBinding(bindings.toggle_random_autopilot, key, code)) {
        state.autopilot = !state.autopilot;
      }
    }

    function handlePointerMove(vector) {
      pointerVector = {
        x: clamp(vector.x, -1, 1),
        y: clamp(vector.y, -1, 1)
      };
      pointerActive = true;
    }

    function handlePointerEnd() {
      pointerVector = { x: 0, y: 0 };
      pointerActive = false;
    }

    function update() {
      let thrustForward = (isPressed(bindings.throttle_up) ? 1 : 0) - (isPressed(bindings.throttle_down) ? 1 : 0);
      let thrustRight = (isPressed(bindings.strafe_right) ? 1 : 0) - (isPressed(bindings.strafe_left) ? 1 : 0);
      let torque = (isPressed(bindings.yaw_left) ? 1 : 0) - (isPressed(bindings.yaw_right) ? 1 : 0);

      if (pointerActive) {
        torque += pointerVector.x;
      }

      thrustForward = clamp(thrustForward, -1, 1);
      thrustRight = clamp(thrustRight, -1, 1);
      const clampedTorque = clamp(torque, -1, 1);
      const brake = isPressed(bindings.brake);
      const boost = isPressed(bindings.boost);

      const manualInput =
        Math.abs(thrustForward) > 0.05 || Math.abs(thrustRight) > 0.05 || Math.abs(clampedTorque) > 0.05 || brake;

      if (manualInput) {
        state.autopilot = false;
      }

      return {
        thrustForward,
        thrustRight,
        torque: clampedTorque,
        brake,
        boost,
        modeCoupled: state.coupled,
        autopilot: state.autopilot
      };
    }

    function isPressed(bindingList) {
      return bindingList.some((token) => keyState.has(token));
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
    const result = {};
    Object.keys(DEFAULT_BINDINGS).forEach((key) => {
      result[key] = normalizeBindingValue(overrides[key] ?? DEFAULT_BINDINGS[key]);
    });
    return result;
  }

  function normalizeBindingValue(value) {
    const tokens = Array.isArray(value) ? value : [value];
    const set = new Set();
    tokens.forEach((token) => {
      const lower = normalizeKey(token);
      if (!lower) {
        return;
      }
      set.add(lower);
      if (lower.length === 1 && lower >= "a" && lower <= "z") {
        set.add(`key${lower}`);
      }
      if (lower.startsWith("key") && lower.length === 4) {
        set.add(lower.slice(3));
      }
    });
    return Array.from(set);
  }

  function matchesBinding(bindingList, key, code) {
    if (!bindingList || !bindingList.length) {
      return false;
    }
    const normalizedKey = normalizeKey(key);
    const normalizedCode = normalizeKey(code);
    return bindingList.some((token) => token === normalizedKey || token === normalizedCode);
  }

  function normalizeKey(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  return {
    createInputController
  };
});
