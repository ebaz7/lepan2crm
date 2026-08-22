const fs = require('fs');
try {
  const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));
  console.log("Settings keys:", Object.keys(db.settings || {}));
  console.log("Settings contents:", JSON.stringify(db.settings, null, 2));
} catch(e) {
  console.error(e);
}
