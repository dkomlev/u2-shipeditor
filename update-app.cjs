const fs=require("fs");
let text=fs.readFileSync('temp-app.html','utf8');
text=text.replace('Редактор AppConfig для U2 Flight Test v0.5.3+','Редактор AppConfig для U2 Flight Test v0.7.4 (decoupled).');
text=text.replace('<title>U2 Test · Настройки Вселенной</title>','<title>U2 AppConfig</title>');
text=text.replace('<link rel="stylesheet" href="css/universe.css" />','<link rel="stylesheet" href="css/universe.css" />\n  <script src="js/lib/build-info.js"></script>');
text=text.replace('<h1>Настройки Вселенной</h1>','<h1>Редактор AppConfig · <span data-build-label>v0.0.0 build 000</span></h1>');
text=text.replace('AppConfig v0.5.3+ · World / Render / HUD / Input / Collision / Autopilot','Schema 0.7.4 (decoupled) · World / Render / HUD / Input / Collision / Autopilot');
text=text.replace('Автосохранение...','Подготовка...');
text=text.replace('ТЗ','ТЗ'); // no change
text=text.replace('</body>',`  <script>\n    (function () {\n      const info = (typeof window !== "undefined" && window.U2BuildInfo) || {\n        version: "0.7.4",\n        buildId: "000",\n        label: "v0.7.4 build 000"\n      };\n      document.title = \
\`U2 AppConfig · ${info.label}\`;\n      document.querySelectorAll("[data-build-label]").forEach((node) => (node.textContent = info.label));\n    })();\n  </script>\n</body>`);
fs.writeFileSync('app-config.html', text);
fs.unlinkSync('temp-app.html');
