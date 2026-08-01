const xlsx = require('xlsx');
const fs = require('fs');

const wb = xlsx.readFile('downloaded.xlsx');
const schema = {};

wb.SheetNames.forEach(sheetName => {
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
    if (data.length > 0) {
        schema[sheetName] = data.slice(0, 3); // Get headers and up to 2 data rows
    }
});

console.log(JSON.stringify(schema, null, 2));
