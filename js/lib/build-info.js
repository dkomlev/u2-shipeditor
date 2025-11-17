"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.U2BuildInfo = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const buildInfo = {
    version: "0.7.5",
    build: 7,
    buildId: "007",
    label: "v0.7.5 build 007",
    updatedAt: "2025-11-17T16:00:02.045Z"
  };

  buildInfo.toString = function toString() {
    return buildInfo.label;
  };

  buildInfo.valueOf = function valueOf() {
    return buildInfo.build;
  };

  buildInfo.asBadge = function asBadge() {
    return buildInfo.label;
  };

  return buildInfo;
});
