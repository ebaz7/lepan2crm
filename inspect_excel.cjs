const XLSX = require('xlsx');

try {
  const wb = XLSX.readFile('downloaded_new.xlsx');
  const str10 = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'] || wb.Sheets[wb.SheetNames[0]]);
  
  console.log("Sheet names:", wb.SheetNames);
  console.log("Sheet1 first row:", str10[0]);
} catch(e) { console.error(e.message); }
