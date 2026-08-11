const xlsx = require('xlsx');
const fs = require('fs');

try {
    const wb = xlsx.readFileSync('farvardin_sales.xlsx');
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(ws);

    let sumAmt = 0;
    let sumPayable = 0;
    let sumTotal = 0;
    let sumQty = 0;
    let count = 0;

    const opCounts = {};
    const items = {};

    rows.forEach(r => {
        count++;
        const op = String(r['کد عملیات'] || r['OpCode'] || '').trim();
        const amt = parseFloat(r['مبلغ'] || r['Amount'] || 0);
        const total = parseFloat(r['مبلغ کل'] || r['Total'] || 0);
        const payable = parseFloat(r['قابل پرداخت'] || r['Payable'] || 0);
        const qty = parseFloat(r['مقدار'] || r['Quantity'] || 0);

        opCounts[op] = (opCounts[op] || 0) + 1;

        if (op === '12') {
            sumAmt += amt;
            sumTotal += total;
            sumPayable += payable;
            sumQty += qty;
        } else if (op === '13') {
            sumAmt -= amt;
            sumTotal -= total;
            sumPayable -= payable;
            sumQty -= qty;
        }
    });

    const result = {
        sheetName,
        rowCount: rows.length,
        opCounts,
        sumAmt,
        sumTotal,
        sumPayable,
        sumQty,
        sampleRow: rows[0] || null
    };

    fs.writeFileSync('excel_results.txt', JSON.stringify(result, null, 2));
    console.log("Done!");
} catch (e) {
    fs.writeFileSync('excel_results.txt', JSON.stringify({ error: e.message, stack: e.stack }, null, 2));
}
