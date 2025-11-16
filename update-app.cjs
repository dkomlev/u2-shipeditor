const fs = require("fs");

const SOURCE = "temp-app.html";
const OUTPUT = "app-config.html";
const BUILD_INFO = {
  version: "0.7.5",
  buildId: "002",
  label: "v0.7.5 build 002"
};

const replacements = [
  [
    "Редактор AppConfig для U2 Flight Test v0.5.3+",
    "Редактор AppConfig для U2 Flight Test v0.7.5 (decoupled)."
  ],
  [
    "<title>U2 Test  Настройки Вселенной</title>",
    "<title>U2 AppConfig</title>"
  ],
  [
    '<link rel="stylesheet" href="css/universe.css" />',
    '<link rel="stylesheet" href="css/universe.css" />\n  <script src="js/lib/build-info.js"></script>'
  ],
  [
    "<h1>Настройки Вселенной</h1>",
    '<h1>Редактор AppConfig  <span data-build-label>v0.0.0 build 000</span></h1>'
  ],
  [
    "AppConfig v0.5.3+  World / Render / HUD / Input / Collision / Autopilot",
    "Schema 0.7.5 (decoupled)  World / Render / HUD / Input / Collision / Autopilot"
  ],
  ["Автосохранение...", "Подготовка..."]
];

function applyReplacements(payload) {
  return replacements.reduce((memo, [search, replace]) => {
    if (!memo.includes(search)) {
      console.warn(`Pattern not found in template: ${search}`);
      return memo;
    }
    return memo.replace(search, replace);
  }, payload);
}

function injectBuildScript(payload) {
  const scriptBlock = `  <script>
    (function () {
      const info = (typeof window !== "undefined" && window.U2BuildInfo) || {
        version: "${BUILD_INFO.version}",
        buildId: "${BUILD_INFO.buildId}",
        label: "${BUILD_INFO.label}"
      };
      document.title = \`U2 AppConfig  \${info.label}\`;
      document.querySelectorAll("[data-build-label]").forEach((node) => (node.textContent = info.label));
    })();
  </script>
</body>`;

  if (!payload.includes("</body>")) {
    throw new Error("Template missing </body> marker");
  }

  return payload.replace("</body>", scriptBlock);
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`Missing temporary template: ${SOURCE}`);
  }

  let text = fs.readFileSync(SOURCE, "utf8");
  text = applyReplacements(text);
  text = injectBuildScript(text);

  fs.writeFileSync(OUTPUT, text);
  fs.unlinkSync(SOURCE);
}

main();
