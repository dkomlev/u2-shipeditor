"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.U2InputController = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const DEFAULT_BINDINGS = {
    throttle_up: ["w", "keyw"],
    throttle_down: ["s", "keys"],
    strafe_left: ["a", "keya"],
    strafe_right: ["d", "keyd"],
    yaw_left: ["q", "keyq"],
    yaw_right: ["e", "keye"],
    brake: [" ", "space", "spacebar"],
    boost: ["shift", "shiftleft", "shiftright"],
    toggle_coupled: ["c", "keyc"],
    toggle_random_autopilot: ["r", "keyr"]
  };

  function createInputController(appConfigInput = {}, options = {}) {
    const bindings = normalizeBindings(appConfigInput.bindings || {});
    const pointerEnabled = appConfigInput.pointerEnabled === true;
    const keyState = new Set();
    let pointerVector = { x: 0, y: 0 };
    let pointerActive = false;
    const coupledDefault = options.coupled ?? true;
    const autopilotDefault = options.autopilotEnabled ?? true;
    const state = {
      coupled: coupledDefault,
      autopilot: autopilotDefault  // Start in autopilot; toggle with R or disable on manual input
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
      if (!pointerEnabled) {
        return;
      }
      pointerVector = {
        x: clamp(vector.x, -1, 1),
        y: clamp(vector.y, -1, 1)
      };
      pointerActive = true;
    }

    function handlePointerEnd() {
      if (!pointerEnabled) {
        return;
      }
      pointerVector = { x: 0, y: 0 };
      pointerActive = false;
    }

    function update() {
      let thrustForward = (isPressed(bindings.throttle_up) ? 1 : 0) - (isPressed(bindings.throttle_down) ? 1 : 0);
      let thrustRight = (isPressed(bindings.strafe_right) ? 1 : 0) - (isPressed(bindings.strafe_left) ? 1 : 0);
      let torque = (isPressed(bindings.yaw_left) ? 1 : 0) - (isPressed(bindings.yaw_right) ? 1 : 0);

      if (pointerEnabled && pointerActive) {
        torque -= pointerVector.x;
      }

      thrustForward = clamp(thrustForward, -1, 1);
      thrustRight = clamp(thrustRight, -1, 1);
      const clampedTorque = clamp(torque, -1, 1);
      const brake = isPressed(bindings.brake);
      const boost = isPressed(bindings.boost);

      // Любой осевой ввод ИЛИ тормоз/boost считаем ручным управлением и отключаем автопилот
      const manualInput =
        Math.abs(thrustForward) > 0.05 ||
        Math.abs(thrustRight) > 0.05 ||
        Math.abs(clampedTorque) > 0.05 ||
        brake ||
        boost;

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

    function matchesBinding(bindingList, key, code) {
      if (!bindingList || !bindingList.length) {
        return false;
      }
      const normalizedKey = normalizeKey(key);
      const normalizedCode = normalizeKey(code);
      return bindingList.some((token) => token === normalizedKey || token === normalizedCode);
    }

    function isPressed(bindingList) {
      return bindingList.some((token) => keyState.has(token));
    }

    return {
      handleKeyDown,
      handleKeyUp,
      handlePointerMove,
      handlePointerEnd,
      setAutopilot(value) {
        state.autopilot = !!value;
      },
      setCoupled(value) {
        state.coupled = !!value;
      },
      update
    };
  }

  function normalizeBindings(overrides) {
    const result = {};
    Object.keys(DEFAULT_BINDINGS).forEach((key) => {
      const override = overrides[key];
      let tokens = [];
      if (Array.isArray(override)) {
        tokens = override.flatMap(expandBindingToken);
      } else if (typeof override === "string") {
        tokens = expandBindingToken(override);
      } else {
        tokens = DEFAULT_BINDINGS[key];
      }
      if (!tokens || !tokens.length) {
        tokens = DEFAULT_BINDINGS[key];
      }
      result[key] = tokens;
    });
    return result;
  }

  function expandBindingToken(raw) {
    const out = [];
    const v = normalizeKey(raw);
    if (!v) {
      return out;
    }
    out.push(v);
    // For single-letter bindings (WASD/QE etc.) also bind by code (KeyW/KeyA/...),
    // so управление работает независимо от раскладки клавиатуры.
    if (v.length === 1 && v >= "a" && v <= "z") {
      out.push(`key${v}`);
    } else if (v === "space") {
      out.push(" ");
    }
    return out;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function normalizeKey(value) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
  }

  return {
    createInputController
  };
});
