const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.json');
if (fs.existsSync(dbPath)) {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  console.log("Keys in database.json:", Object.keys(db));
  if (db.settings) {
    console.log("Settings keys:", Object.keys(db.settings));
    console.log("Settings companies:", JSON.stringify(db.settings.companies || [], null, 2));
    console.log("Settings bankNames:", db.settings.bankNames);
    console.log("Settings operatingBankNames:", db.settings.operatingBankNames);
    console.log("Settings companyBank:", db.settings.companyBank);
  }
} else {
  console.log("database.json does NOT exist!");
}
