const fs = require('fs');
try {
  const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));
  console.log("Root activeFiscalYearId:", db.activeFiscalYearId);
  console.log("Root fiscalYears:", JSON.stringify(db.fiscalYears, null, 2));
} catch(e) {
  console.error(e);
}
