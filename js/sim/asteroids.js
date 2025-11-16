"use strict";

/**
 * Asteroid generator for FlightTest v0.6.3
 * Generates asteroids from AppConfig.asteroids settings
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.U2AsteroidGenerator = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {

  /**
   * Simple seedable PRNG (mulberry32)
   */
  function createRNG(seed) {
    let state = seed;
    return function() {
      state |= 0;
      state = state + 0x6D2B79F5 | 0;
      let t = Math.imul(state ^ state >>> 15, 1 | state);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /**
   * Generate asteroids from config
   * @param {Object} config - AppConfig.asteroids + world
   * @returns {Array} Array of asteroid objects
   */
  function generateAsteroids(config) {
    const asteroidCfg = config.asteroids || {};
    const worldCfg = config.world || {};
    
    if (!asteroidCfg.enabled) {
      return [];
    }

    const count = asteroidCfg.count || 100;
    const radiusMin = asteroidCfg.radius_min || 50;
    const radiusMax = asteroidCfg.radius_max || 5000;
    const velocityMin = asteroidCfg.velocity_min || 5;
    const velocityMax = asteroidCfg.velocity_max || 50;
    const density = asteroidCfg.density || 0.4; // fraction that have velocity
    
    const worldWidth = worldCfg.bounds?.width || 1000000;
    const worldHeight = worldCfg.bounds?.height || 1000000;
    const seed = worldCfg.seed || 1337;

    const rng = createRNG(seed);
    const asteroids = [];

    for (let i = 0; i < count; i++) {
      // Random position across world
      const x = (rng() - 0.5) * worldWidth;
      const y = (rng() - 0.5) * worldHeight;

      // Random radius (power distribution for more small asteroids)
      const radiusRatio = Math.pow(rng(), 2); // Square for power distribution
      const radius = radiusMin + radiusRatio * (radiusMax - radiusMin);

      // Random velocity (some asteroids are stationary)
      let vx = 0;
      let vy = 0;
      if (rng() < density) {
        const speed = velocityMin + rng() * (velocityMax - velocityMin);
        const angle = rng() * Math.PI * 2;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      }

      // Random rotation
      const rotation = rng() * Math.PI * 2;
      const angularVelocity = (rng() - 0.5) * 0.2; // Slow spin

      // Generate simple shape (number of vertices)
      const vertices = 6 + Math.floor(rng() * 6); // 6-11 vertices

      asteroids.push({
        id: `asteroid-${i}`,
        position: { x, y },
        velocity: { vx, vy },
        radius,
        rotation,
        angularVelocity,
        vertices,
        // For collision detection
        bounds: {
          minX: x - radius,
          maxX: x + radius,
          minY: y - radius,
          maxY: y + radius
        }
      });
    }

    console.log(`Generated ${count} asteroids (${Math.round(density * 100)}% moving)`);
    return asteroids;
  }

  /**
   * Update asteroid positions
   * @param {Array} asteroids 
   * @param {number} dt - Delta time in seconds
   */
  function updateAsteroids(asteroids, dt) {
    for (const asteroid of asteroids) {
      asteroid.position.x += asteroid.velocity.vx * dt;
      asteroid.position.y += asteroid.velocity.vy * dt;
      asteroid.rotation += asteroid.angularVelocity * dt;
      
      // Update AABB bounds
      asteroid.bounds.minX = asteroid.position.x - asteroid.radius;
      asteroid.bounds.maxX = asteroid.position.x + asteroid.radius;
      asteroid.bounds.minY = asteroid.position.y - asteroid.radius;
      asteroid.bounds.maxY = asteroid.position.y + asteroid.radius;
    }
  }

  /**
   * Wrap asteroids around toroidal world bounds
   * @param {Array} asteroids 
   * @param {Object} bounds - {width, height}
   */
  function wrapAsteroids(asteroids, bounds) {
    const halfWidth = bounds.width / 2;
    const halfHeight = bounds.height / 2;

    for (const asteroid of asteroids) {
      if (asteroid.position.x > halfWidth) {
        asteroid.position.x -= bounds.width;
      } else if (asteroid.position.x < -halfWidth) {
        asteroid.position.x += bounds.width;
      }

      if (asteroid.position.y > halfHeight) {
        asteroid.position.y -= bounds.height;
      } else if (asteroid.position.y < -halfHeight) {
        asteroid.position.y += bounds.height;
      }
    }
  }

  /**
   * Render asteroids on canvas
   * @param {CanvasRenderingContext2D} ctx 
   * @param {Array} asteroids 
   * @param {Object} camera - {position: {x, y}}
   * @param {number} scale - Pixels per meter
   */
  function renderAsteroids(ctx, asteroids, camera, scale = 0.4) {
    const cameraPos = camera.position || { x: 0, y: 0 };
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);

    for (const asteroid of asteroids) {
      // Camera-relative position
      const screenX = (asteroid.position.x - cameraPos.x) * scale;
      const screenY = -(asteroid.position.y - cameraPos.y) * scale;

      // Cull off-screen asteroids
      const screenRadius = asteroid.radius * scale;
      if (Math.abs(screenX) > canvasWidth / 2 + screenRadius ||
          Math.abs(screenY) > canvasHeight / 2 + screenRadius) {
        continue;
      }

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(asteroid.rotation);

      // Draw irregular polygon
      ctx.beginPath();
      const angleStep = (Math.PI * 2) / asteroid.vertices;
      for (let i = 0; i <= asteroid.vertices; i++) {
        const angle = i * angleStep;
        const r = screenRadius * (0.8 + Math.sin(i * 1.7) * 0.2); // Irregular
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      ctx.fillStyle = "rgba(100, 100, 120, 0.6)";
      ctx.fill();
      ctx.strokeStyle = "rgba(150, 150, 170, 0.8)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  return {
    generateAsteroids,
    updateAsteroids,
    wrapAsteroids,
    renderAsteroids
  };
});
