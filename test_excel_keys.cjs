const xlsx = require('xlsx');

const wb = xlsx.readFileSync('farvardin_sales.xlsx');
const rows = xlsx.utils.sheet_to_json(wb.Sheets['Data']);

console.log("Excel keys:", Object.keys(rows[0]));
// Let's check if there are any numeric columns in excel rows besides مبلغ, مبلغ کل, قابل پرداخت, بدون پرداخت
rows.slice(0, 5).forEach((r, i) => {
    console.log(`Row ${i+1}:`, r);
});
