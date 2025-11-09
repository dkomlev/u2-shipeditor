"use strict";

/**
 * AppConfig loader and validator for FlightTest v0.6.3
 * Loads u2-appconfig.json and provides safe defaults
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.U2AppConfigLoader = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  
  const DEFAULT_CONFIG = {
    version: "0.6.3",
    build: "flight-test",
    paths: {
      ship_config_path: "",
      app_config_path: "./config/u2-appconfig.json"
    },
    world: {
      seed: 1337,
      bounds: { width: 1000000, height: 1000000 },
      environment: "vacuum"
    },
    physics: {
      c_mps: 100000,        // Speed of light (§1 ТЗ)
      dt_sec: 1/60,         // Physics tick (60 Hz default)
      tick_rate_hz: 60,
      gravity_mps2: 0
    },
    render: {
      grid: { enabled: true, cell: 250, alpha: 0.15 },
      axis: false,
      hud: true,
      canvas: { width: 1200, height: 800 }
    },
    hud: {
      language: "en-US",
      units: "metric",
      show_debug: true,
      show_sr_telemetry: true
    },
    input: {
      profile: "kbm",
      invert_y: false,
      bindings: {
        throttle_up: "W",
        throttle_down: "S",
        strafe_left: "A",
        strafe_right: "D",
        turn_left: "Q",
        turn_right: "E",
        brake: "Space",
        boost: "ShiftLeft",
        toggle_mode: "C",
        toggle_autopilot: "R",
        toggle_collision_mode: "F2",
        toggle_collision_overlay: "F3",
        zoom_in: "Equal",
        zoom_out: "Minus",
        export_log: "F12"
      }
    },
    collision: {
      mode: "AABB",        // "AABB" or "Alpha"
      debug: false,
      overlay: false
    },
    asteroids: {
      enabled: true,
      count: 100,
      density: 0.4,
      radius_min: 50,
      radius_max: 800,  // Reduced from 5000 for better visibility
      velocity_min: 5,
      velocity_max: 50
    },
    autopilot: {
      enabled_on_start: false,
      coupled_on_start: true,
      dampeners: true
    },
    debug: {
      logging: false,
      log_path: "./logs/flight-test.log",
      probes: false
    }
  };

  /**
   * Load AppConfig from path or use defaults
   * @param {string} path - Path to appconfig.json
   * @returns {Promise<Object>} Validated AppConfig
   */
  async function loadAppConfig(path = "./config/u2-appconfig.json") {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        console.warn(`AppConfig not found at ${path}, using defaults`);
        return structuredClone(DEFAULT_CONFIG);
      }
      
      const raw = await response.json();
      return validateAndMerge(raw);
      
    } catch (error) {
      console.error("Failed to load AppConfig:", error);
      return structuredClone(DEFAULT_CONFIG);
    }
  }

  /**
   * Validate and merge loaded config with defaults
   * Implements cross-validation from §1.3 ТЗ
   */
  function validateAndMerge(raw) {
    const config = structuredClone(DEFAULT_CONFIG);
    
    // Deep merge
    if (raw.version) config.version = raw.version;
    if (raw.build) config.build = raw.build;
    
    if (raw.paths) {
      Object.assign(config.paths, raw.paths);
    }
    
    if (raw.world) {
      Object.assign(config.world, raw.world);
      if (raw.world.bounds) {
        Object.assign(config.world.bounds, raw.world.bounds);
      }
    }
    
    if (raw.physics) {
      Object.assign(config.physics, raw.physics);
      // §1.3: Cross-validate c_mps
      if (config.physics.c_mps <= 0) {
        console.warn("Invalid c_mps, using default 100000 m/s");
        config.physics.c_mps = 100000;
      }
      // Derive dt_sec from tick_rate if not explicit
      if (raw.physics.tick_rate_hz && !raw.physics.dt_sec) {
        config.physics.dt_sec = 1 / raw.physics.tick_rate_hz;
      }
    }
    
    if (raw.render) {
      Object.assign(config.render, raw.render);
      if (raw.render.grid) {
        Object.assign(config.render.grid, raw.render.grid);
      }
      if (raw.render.canvas) {
        Object.assign(config.render.canvas, raw.render.canvas);
      }
    }
    
    if (raw.hud) {
      Object.assign(config.hud, raw.hud);
    }
    
    if (raw.input) {
      Object.assign(config.input, raw.input);
      if (raw.input.bindings) {
        Object.assign(config.input.bindings, raw.input.bindings);
      }
    }
    
    if (raw.collision) {
      Object.assign(config.collision, raw.collision);
      // Validate mode
      if (!["AABB", "Alpha"].includes(config.collision.mode)) {
        console.warn(`Invalid collision mode ${config.collision.mode}, using AABB`);
        config.collision.mode = "AABB";
      }
    }
    
    if (raw.asteroids) {
      Object.assign(config.asteroids, raw.asteroids);
    }
    
    if (raw.autopilot) {
      Object.assign(config.autopilot, raw.autopilot);
    }
    
    if (raw.debug) {
      Object.assign(config.debug, raw.debug);
    }
    
    return config;
  }

  /**
   * Get synchronous copy of default config (for testing)
   */
  function getDefaultConfig() {
    return structuredClone(DEFAULT_CONFIG);
  }

  return {
    loadAppConfig,
    getDefaultConfig
  };
});
