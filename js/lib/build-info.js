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
    build: 6,
    buildId: "006",
    label: "v0.7.5 build 006",
    updatedAt: "2025-11-17T15:53:02.523Z"
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
