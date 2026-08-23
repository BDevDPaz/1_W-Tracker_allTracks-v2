// tools/deps-dashboard.js
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "audit-output");
const DASHBOARD_FILE = path.join(__dirname, "dashboard.html");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const commands = [
  { name: "dpdm_tree", cmd: "npx dpdm ./ --json" },
  { name: "dpdm_dead", cmd: "npx dpdm ./ --dead-only --json" },
  { name: "dpdm_circular", cmd: "npx dpdm ./ --circular-only --json" },
  { name: "madge_graph", cmd: "npx madge --json ./src" },
  { name: "npm_outdated", cmd: "npm outdated --json" },
  { name: "npm_audit", cmd: "npm audit --json" },
  { name: "ts_files", cmd: "npx tsc --listFiles" },
];

function runCommand({ name, cmd }) {
  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      const file = path.join(OUTPUT_DIR, `${name}.json`);

      if (stdout) {
        try {
          fs.writeFileSync(file, stdout);
        } catch {
          fs.writeFileSync(file, JSON.stringify({ raw: stdout }));
        }
      }

      if (error) {
        fs.writeFileSync(
          file,
          JSON.stringify({ error: error.message, stderr })
        );
      }

      resolve();
    });
  });
}

function generateDashboard() {
  const files = fs.readdirSync(OUTPUT_DIR);

  let sections = "";

  files.forEach((file) => {
    const content = fs.readFileSync(path.join(OUTPUT_DIR, file), "utf8");
    sections += `
      <section>
        <h2>${file.replace(".json", "")}</h2>
        <pre>${content}</pre>
      </section>
      <hr/>
    `;
  });

  const html = `
  <html>
  <head>
    <title>WTracker Dependency Dashboard</title>
    <style>
      body { font-family: Arial; padding: 20px; background: #f5f5f5; }
      h1 { color: #333; }
      section { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; }
      pre { background: #222; color: #0f0; padding: 15px; border-radius: 6px; overflow-x: auto; }
    </style>
  </head>
  <body>
    <h1>WTracker Dependency Dashboard</h1>
    ${sections}
  </body>
  </html>
  `;

  fs.writeFileSync(DASHBOARD_FILE, html);
}

(async () => {
  console.log("🚀 Generando dashboard de dependencias...\n");

  for (const command of commands) {
    console.log(`▶ Ejecutando: ${command.name}`);
    await runCommand(command);
  }

  console.log("\n📊 Construyendo dashboard HTML...");
  generateDashboard();

  console.log(`\n🎉 Dashboard generado en: ${DASHBOARD_FILE}\n`);
})();
