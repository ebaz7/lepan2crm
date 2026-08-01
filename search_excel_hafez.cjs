const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const searchTerms = ['حافظ', 'کشتیرانی', '112447', '2447', 'حافط', 'کشتيراني', 'کشتی رانی'];

async function searchInExcel(filePath) {
  console.log(`Searching in: ${filePath}...`);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(filePath);
    workbook.eachSheet((sheet, sheetId) => {
      let foundInSheet = 0;
      sheet.eachRow((row, rowNumber) => {
        const rowValues = row.values;
        if (!rowValues) return;
        const rowStr = JSON.stringify(rowValues);
        const match = searchTerms.find(term => rowStr.includes(term));
        if (match) {
          foundInSheet++;
          if (foundInSheet <= 5) {
            console.log(`  [Sheet: ${sheet.name}] Row ${rowNumber}:`, rowValues);
          }
        }
      });
      if (foundInSheet > 0) {
        console.log(`  --> Found ${foundInSheet} total rows in Sheet [${sheet.name}]`);
      }
    });
  } catch (e) {
    console.error(`  Error reading ${filePath}:`, e.message);
  }
}

async function run() {
  const files = fs.readdirSync('.').filter(f => f.endsWith('.xlsx'));
  for (const file of files) {
    await searchInExcel(file);
  }
}

run();
