"use strict";

/**
 * Collision detection for FlightTest v0.6.3
 * AABB (fast broad-phase) and Alpha (pixel-perfect)
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.U2CollisionDetector = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {

  /**
   * AABB collision check (fast, conservative)
   * @param {Object} a - {bounds: {minX, maxX, minY, maxY}}
   * @param {Object} b - {bounds: {minX, maxX, minY, maxY}}
   * @returns {boolean}
   */
  function checkAABB(a, b) {
    return !(
      a.bounds.maxX < b.bounds.minX ||
      a.bounds.minX > b.bounds.maxX ||
      a.bounds.maxY < b.bounds.minY ||
      a.bounds.minY > b.bounds.maxY
    );
  }

  /**
   * Check ship collision with asteroids using AABB
   * @param {Object} ship - {position, radius OR bounds}
   * @param {Array} asteroids - Array of asteroids with bounds
   * @returns {Array} Colliding asteroids
   */
  function checkShipCollisionsAABB(ship, asteroids) {
    // Build ship AABB if not present
    const shipBounds = ship.bounds || {
      minX: ship.position.x - (ship.radius || 20),
      maxX: ship.position.x + (ship.radius || 20),
      minY: ship.position.y - (ship.radius || 20),
      maxY: ship.position.y + (ship.radius || 20)
    };

    const collisions = [];
    for (const asteroid of asteroids) {
      if (checkAABB({ bounds: shipBounds }, asteroid)) {
        collisions.push(asteroid);
      }
    }
    return collisions;
  }

  /**
   * Alpha (pixel-perfect) collision using canvas image data
   * NOTE: This is expensive and should only be used after AABB passes
   * 
   * @param {Object} shipSprite - {imageData, position, rotation}
   * @param {Object} asteroidSprite - {imageData, position, rotation}
   * @returns {boolean}
   */
  function checkAlphaCollision(shipSprite, asteroidSprite) {
    // TODO: Implement pixel-perfect collision
    // For now, fall back to circle collision
    const dx = shipSprite.position.x - asteroidSprite.position.x;
    const dy = shipSprite.position.y - asteroidSprite.position.y;
    const distance = Math.hypot(dx, dy);
    const minDistance = (shipSprite.radius || 20) + (asteroidSprite.radius || 50);
    return distance < minDistance;
  }

  /**
   * Check ship collisions with mode selection
   * @param {Object} ship 
   * @param {Array} asteroids 
   * @param {string} mode - "AABB" or "Alpha"
   * @returns {Array} Colliding asteroids
   */
  function checkShipCollisions(ship, asteroids, mode = "AABB") {
    if (mode === "Alpha") {
      // First pass: AABB to filter candidates
      const candidates = checkShipCollisionsAABB(ship, asteroids);
      // Second pass: Pixel-perfect
      return candidates.filter(asteroid => 
        checkAlphaCollision(ship, asteroid)
      );
    }
    
    // AABB only
    return checkShipCollisionsAABB(ship, asteroids);
  }

  /**
   * Render collision overlay (debug visualization)
   * @param {CanvasRenderingContext2D} ctx 
   * @param {Object} ship 
   * @param {Array} asteroids 
   * @param {Array} collisions - Currently colliding asteroids
   * @param {Object} camera 
   * @param {number} scale 
   */
  function renderCollisionOverlay(ctx, ship, asteroids, collisions, camera, scale = 0.4) {
    const cameraPos = camera.position || { x: 0, y: 0 };
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);

    // Draw ship AABB
    const shipBounds = ship.bounds || {
      minX: ship.position.x - (ship.radius || 20),
      maxX: ship.position.x + (ship.radius || 20),
      minY: ship.position.y - (ship.radius || 20),
      maxY: ship.position.y + (ship.radius || 20)
    };

    const shipScreenX = (ship.position.x - cameraPos.x) * scale;
    const shipScreenY = -(ship.position.y - cameraPos.y) * scale;
    const shipWidth = (shipBounds.maxX - shipBounds.minX) * scale;
    const shipHeight = (shipBounds.maxY - shipBounds.minY) * scale;

    ctx.strokeStyle = "rgba(0, 255, 0, 0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      shipScreenX - shipWidth / 2,
      shipScreenY - shipHeight / 2,
      shipWidth,
      shipHeight
    );

    // Draw asteroid AABBs
    const collisionSet = new Set(collisions.map(a => a.id));

    for (const asteroid of asteroids) {
      const screenX = (asteroid.position.x - cameraPos.x) * scale;
      const screenY = -(asteroid.position.y - cameraPos.y) * scale;

      // Cull off-screen
      if (Math.abs(screenX) > canvasWidth / 2 + 100 ||
          Math.abs(screenY) > canvasHeight / 2 + 100) {
        continue;
      }

      const width = (asteroid.bounds.maxX - asteroid.bounds.minX) * scale;
      const height = (asteroid.bounds.maxY - asteroid.bounds.minY) * scale;

      const isColliding = collisionSet.has(asteroid.id);
      ctx.strokeStyle = isColliding ? "rgba(255, 0, 0, 0.8)" : "rgba(255, 255, 0, 0.3)";
      ctx.lineWidth = isColliding ? 3 : 1;

      ctx.strokeRect(
        screenX - width / 2,
        screenY - height / 2,
        width,
        height
      );
    }

    ctx.restore();
  }

  return {
    checkAABB,
    checkShipCollisions,
    renderCollisionOverlay
  };
});
