const xlsx = require('xlsx');

const wb = xlsx.readFileSync('farvardin_sales.xlsx');
const rows = xlsx.utils.sheet_to_json(wb.Sheets['Data']);

let sumAmt = 0;
let sumPayable = 0;
let sumTotal = 0;

rows.forEach(r => {
    const op = String(r['کد عملیات']).trim();
    const amt = parseFloat(r['مبلغ'] || 0);
    const total = parseFloat(r['مبلغ کل'] || 0);
    const payable = parseFloat(r['قابل پرداخت'] || 0);
    if (op === '12') {
        sumAmt += amt;
        sumTotal += total;
        sumPayable += payable;
    } else if (op === '13') {
        sumAmt -= amt;
        sumTotal -= total;
        sumPayable -= payable;
    }
});

console.log("Excel sum مبلغ:", sumAmt);
console.log("Excel sum مبلغ کل:", sumTotal);
console.log("Excel sum قابل پرداخت:", sumPayable);
