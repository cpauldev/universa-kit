"use strict";

/**
 * Turbopack/webpack loader that prepends a client module import to a source file.
 * Accepts options: { module: string } — the module specifier to import.
 * Idempotent: will not prepend if already injected.
 */
module.exports = function clientInjectLoader(source) {
  var options =
    typeof this.getOptions === "function"
      ? this.getOptions()
      : this.query || {};
  if (typeof options === "string") {
    try {
      options = JSON.parse(options);
    } catch (_) {
      options = {};
    }
  }
  var clientModule = options.module;
  if (!clientModule) return source;
  var marker = "/* __universa-kit-inject:" + clientModule + " */";
  if (source.includes(marker)) return source;
  return marker + "\nimport " + JSON.stringify(clientModule) + ";\n" + source;
};
