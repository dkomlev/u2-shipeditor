"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.U2Relativity = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  /**
   * Special Relativity helper utilities for linear motion.
   */

  function updateMomentum(px, py, Fx, Fy, dt) {
    return { x: (px || 0) + Fx * dt, y: (py || 0) + Fy * dt };
  }

  function gammaFromMomentum(px, py, mass_kg, c) {
    const p2 = (px * px) + (py * py);
    const m2c2 = (mass_kg * mass_kg) * (c * c);
    return Math.sqrt(1 + p2 / m2c2);
  }

  function velocityFromMomentum(px, py, mass_kg, c) {
    const p2 = (px * px) + (py * py);
    const m2 = mass_kg * mass_kg;
    const c2 = c * c;
    const denom = Math.sqrt(m2 + p2 / c2);
    const vx = px / denom;
    const vy = py / denom;
    const gamma = Math.sqrt(1 + p2 / (m2 * c2));
    return { vx, vy, gamma };
  }

  return {
    updateMomentum,
    gammaFromMomentum,
    velocityFromMomentum
  };
});
