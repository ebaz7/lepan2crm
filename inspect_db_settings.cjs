const fs = require('fs');
try {
  const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));
  console.log("Database keys:", Object.keys(db));
  console.log("Settings keys:", db.settings ? Object.keys(db.settings) : "No settings");
  if (db.settings) {
    console.log("Fiscal Years in settings:", db.settings.fiscalYears);
    console.log("Active Fiscal Year ID in settings:", db.settings.activeFiscalYearId);
  }
} catch(e) {
  console.error(e);
}
