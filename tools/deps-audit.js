// tools/deps-audit.js
const { exec } = require("child_process");

const commands = [
  { name: "DPDM - Árbol completo", cmd: "npx dpdm ./ --no-warning" },
  { name: "DPDM - Dependencias muertas", cmd: "npx dpdm ./ --dead-only" },
  { name: "DPDM - Ciclos", cmd: "npx dpdm ./ --circular-only" },
  { name: "Madge - Dependencias", cmd: "npx madge ./src" },
  { name: "Madge - Ciclos", cmd: "npx madge --circular ./src" },
  { name: "Madge - Grafo PNG", cmd: "npx madge --image graph.png ./src" },
  { name: "TS - Resolución de imports", cmd: "npx tsc --traceResolution" },
  { name: "TS - Archivos incluidos", cmd: "npx tsc --listFiles" },
  { name: "ESLint - Imports no usados", cmd: "npx eslint . --rule 'no-unused-vars:error'" },
  { name: "NPM - Árbol", cmd: "npm ls" },
  { name: "NPM - Vulnerabilidades", cmd: "npm audit" },
  { name: "NPM - Desactualizados", cmd: "npm outdated" },
  { name: "RN - Bundle iOS", cmd: "npx react-native bundle --entry-file index.js --platform ios" },
  { name: "RN - Bundle Android", cmd: "npx react-native bundle --entry-file index.js --platform android" },
  { name: "Source Map Explorer", cmd: "npx source-map-explorer dist/*.js" }
];

function runCommand({ name, cmd }) {
  console.log(`\n\n==============================`);
  console.log(`▶ Ejecutando: ${name}`);
  console.log(`==============================\n`);

  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ Error en ${name}`);
        console.error(error.message);
      }
      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);
      resolve();
    });
  });
}

(async () => {
  console.log("\n🚀 Iniciando auditoría completa de dependencias...\n");

  for (const command of commands) {
    await runCommand(command);
  }

  console.log("\n🎉 Auditoría completa finalizada.\n");
})();
