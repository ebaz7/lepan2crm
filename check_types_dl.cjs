const XLSX = require('xlsx');
try {
  const wb = XLSX.readFile('downloaded_new.xlsx');
  const sheet = wb.Sheets['STR_TBL_006'];
  if (sheet) {
      const data = XLSX.utils.sheet_to_json(sheet, {header: 1});
      for(let i=0; i<Math.min(data.length, 20); i++) {
         console.log(data[i][0] + " | " + data[i][1] + " | " + data[i][2]);
      }
  } else {
      console.log("No STR_TBL_006 sheet");
  }
} catch(e) { console.error(e.message); }
