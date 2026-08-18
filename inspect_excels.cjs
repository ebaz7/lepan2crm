const XLSX = require('xlsx');
const fs = require('fs');

function inspectFile(filename) {
  if (!fs.existsSync(filename)) {
    console.log(`${filename} does not exist`);
    return;
  }
  try {
    const wb = XLSX.readFile(filename);
    console.log(`\nSheets in ${filename}:`);
    console.log(wb.SheetNames.join(', '));
    wb.SheetNames.forEach(sheetName => {
      const sheet = wb.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      console.log(`  Sheet: "${sheetName}" has range ${sheet['!ref']} (Rows: ${range.e.r + 1}, Cols: ${range.e.c + 1})`);
    });
  } catch(e) {
    console.error(`Error reading ${filename}:`, e.message);
  }
}

inspectFile('downloaded.xlsx');
inspectFile('Sayan_DB_Proper.xlsx');
inspectFile('farvardin_sales.xlsx');
