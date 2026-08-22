const fs = require('fs');
try {
  const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));
  console.log("Active Fiscal Year ID:", db.activeFiscalYearId);
  console.log("Fiscal Years:", JSON.stringify(db.fiscalYears, null, 2));
  console.log("Warehouse Overview config:", JSON.stringify(db.warehouseOverview?.meta, null, 2));
} catch(e) {
  console.error(e);
}
