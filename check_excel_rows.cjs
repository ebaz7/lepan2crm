const xlsx = require('xlsx');

const wb = xlsx.readFile('downloaded.xlsx');

wb.SheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
    console.log(`\n\n--- Sheet: ${sheetName} ---`);
    for (let i = 0; i < Math.min(5, data.length); i++) {
        console.log(`Row ${i}:`, data[i].slice(0, 15).join(' | '));
    }
});
