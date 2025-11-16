"use strict";

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.U2BuildInfo = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const buildInfo = {
    version: "0.7.4",
    build: 1,
    buildId: "001",
    label: "v0.7.4 build 001",
    updatedAt: "2025-11-13T16:40:11.621Z"
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
