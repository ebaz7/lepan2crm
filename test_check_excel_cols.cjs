const xlsx = require('xlsx');

const wb = xlsx.readFileSync('farvardin_sales.xlsx');
const rows = xlsx.utils.sheet_to_json(wb.Sheets['Data']);

rows.slice(0, 10).forEach((r, i) => {
    console.log(`Row ${i+1} (${r['نام کامل شخص']}, Inv #${r['شماره']}): مبلغ=${r['مبلغ']}, مبلغ کل=${r['مبلغ کل']}, قابل پرداخت=${r['قابل پرداخت']}, رسمی=${r['رسمی']}`);
});
