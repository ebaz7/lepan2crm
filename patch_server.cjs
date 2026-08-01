const fs = require('fs');
const file = 'server.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
    /const columns = \['گروه کالا', 'مقدار A \(kg\)', 'مبلغ خالص A \(ریال\)', 'مقدار B \(kg\)', 'مبلغ خالص B \(ریال\)', 'تغییر مبلغ \(%\)'\];/g,
    `const columns = ['گروه کالا', 'خالص A', 'فی A', 'مرجوعی A', 'خالص B', 'فی B', 'مرجوعی B', 'تغییر مبلغ'];`
);

content = content.replace(
    /return \[\s*row\.name \|\| 'سایر',\s*\(row\.netWeightA \|\| 0\)\.toFixed\(2\),\s*\(row\.netAmountA \|\| 0\)\.toLocaleString\('fa-IR'\),\s*\(row\.netWeightB \|\| 0\)\.toFixed\(2\),\s*\(row\.netAmountB \|\| 0\)\.toLocaleString\('fa-IR'\),\s*\(amountDiff > 0 \? '\+' : ''\) \+ amountDiff\.toFixed\(1\) \+ '%'\s*\];/g,
    `return [
                row.name || 'سایر',
                (row.netWeightA || 0).toFixed(2),
                (row.netWeightA ? (row.netAmountA / row.netWeightA) : 0).toLocaleString('fa-IR', {maximumFractionDigits:0}),
                (row.retWeightA || 0).toFixed(2),
                (row.netWeightB || 0).toFixed(2),
                (row.netWeightB ? (row.netAmountB / row.netWeightB) : 0).toLocaleString('fa-IR', {maximumFractionDigits:0}),
                (row.retWeightB || 0).toFixed(2),
                (amountDiff > 0 ? '+' : '') + amountDiff.toFixed(1) + '%'
            ];`
);

content = content.replace(
    /tableRows\.push\(\[\s*'جمع کل',\s*'-',\s*totalNetAmtA\.toLocaleString\('fa-IR'\),\s*'-',\s*totalNetAmtB\.toLocaleString\('fa-IR'\),\s*\(totalDiff > 0 \? '\+' : ''\) \+ totalDiff\.toFixed\(1\) \+ '%'\s*\]\);/g,
    `tableRows.push([
            'جمع کل',
            '-',
            '-',
            '-',
            '-',
            '-',
            '-',
            (totalDiff > 0 ? '+' : '') + totalDiff.toFixed(1) + '%'
        ]);`
);
fs.writeFileSync(file, content);
