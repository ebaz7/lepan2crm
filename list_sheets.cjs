const XLSX = require('xlsx');
try {
  const wb = XLSX.readFile('downloaded.xlsx');
  console.log("Sheets in downloaded.xlsx:");
  console.log(wb.SheetNames.join(', '));
} catch(e) { console.error(e.message); }
