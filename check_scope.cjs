const fs = require('fs');
const acorn = require('acorn');
const code = fs.readFileSync('server.js', 'utf8');
try {
  acorn.parse(code, { ecmaVersion: 2022, sourceType: 'module' });
  console.log("Acorn parsed successfully.");
} catch(e) {
  console.log("Error at", e.loc);
}
