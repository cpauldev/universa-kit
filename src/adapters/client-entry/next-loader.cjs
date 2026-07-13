const ts = require("typescript");

module.exports = function injectUniversalClientEntries(source) {
  const code = source.toString();
  const options = this.getOptions?.() ?? {};
  const bootstrap = options.bootstrap;
  if (typeof bootstrap !== "string" || !bootstrap) return code;

  return ts.transpileModule(`${bootstrap}\n${code}`, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
};
