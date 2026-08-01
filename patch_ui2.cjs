const fs = require('fs');
const file = 'components/AccountingReports.tsx';
let content = fs.readFileSync(file, 'utf8');

// The UI code currently has:
// <th>مقدار A (kg)</th><th>مبلغ خالص A (ریال)</th><th>مقدار B (kg)</th><th>مبلغ خالص B (ریال)</th><th>تغییر مبلغ</th>
// <td>${(row.netWeightA || 0).toFixed(2)}<br><span class="ret">مرجوعی: ${(row.retWeightA || 0).toFixed(2)}</span></td>
// <td>${(row.netAmountA || 0).toLocaleString('fa-IR')}<br><span class="ret">مرجوعی: ${(row.retAmountA || 0).toLocaleString('fa-IR')}</span></td>

content = content.replace(
    /<th>گروه کالا<\/th><th>مقدار A \(kg\)<\/th><th>مبلغ خالص A \(ریال\)<\/th><th>مقدار B \(kg\)<\/th><th>مبلغ خالص B \(ریال\)<\/th><th>تغییر مبلغ<\/th>/g,
    `<th>گروه کالا</th><th>مقدار A (kg)</th><th>میانگین فی A</th><th>مبلغ خالص A</th><th>مقدار B (kg)</th><th>میانگین فی B</th><th>مبلغ خالص B</th><th>تغییر مبلغ</th>`
);

content = content.replace(
    /<td>\$\{\(row\.netWeightA \|\| 0\)\.toFixed\(2\)\}<br><span class="ret">مرجوعی: \$\{\(row\.retWeightA \|\| 0\)\.toFixed\(2\)\}<\/span><\/td>\s*<td>\$\{\(row\.netAmountA \|\| 0\)\.toLocaleString\('fa-IR'\)\}<br><span class="ret">مرجوعی: \$\{\(row\.retAmountA \|\| 0\)\.toLocaleString\('fa-IR'\)\}<\/span><\/td>\s*<td>\$\{\(row\.netWeightB \|\| 0\)\.toFixed\(2\)\}<br><span class="ret">مرجوعی: \$\{\(row\.retWeightB \|\| 0\)\.toFixed\(2\)\}<\/span><\/td>\s*<td>\$\{\(row\.netAmountB \|\| 0\)\.toLocaleString\('fa-IR'\)\}<br><span class="ret">مرجوعی: \$\{\(row\.retAmountB \|\| 0\)\.toLocaleString\('fa-IR'\)\}<\/span><\/td>/g,
    `<td>\${(row.netWeightA || 0).toFixed(2)}<br><span class="ret">مرجوعی: \${(row.retWeightA || 0).toFixed(2)}</span></td>
     <td>\${(row.netWeightA ? (row.netAmountA / row.netWeightA) : 0).toLocaleString('fa-IR', {maximumFractionDigits:0})}</td>
     <td>\${(row.netAmountA || 0).toLocaleString('fa-IR')}<br><span class="ret">مرجوعی: \${(row.retAmountA || 0).toLocaleString('fa-IR')}</span></td>
     <td>\${(row.netWeightB || 0).toFixed(2)}<br><span class="ret">مرجوعی: \${(row.retWeightB || 0).toFixed(2)}</span></td>
     <td>\${(row.netWeightB ? (row.netAmountB / row.netWeightB) : 0).toLocaleString('fa-IR', {maximumFractionDigits:0})}</td>
     <td>\${(row.netAmountB || 0).toLocaleString('fa-IR')}<br><span class="ret">مرجوعی: \${(row.retAmountB || 0).toLocaleString('fa-IR')}</span></td>`
);

content = content.replace(
    /<th>جمع کل<\/th>\s*<th>-<\/th>\s*<th>\$\{sumA\.toLocaleString\('fa-IR'\)\}<\/th>\s*<th>-<\/th>\s*<th>\$\{sumB\.toLocaleString\('fa-IR'\)\}<\/th>/g,
    `<th>جمع کل</th>
     <th>-</th>
     <th>-</th>
     <th>\${sumA.toLocaleString('fa-IR')}</th>
     <th>-</th>
     <th>-</th>
     <th>\${sumB.toLocaleString('fa-IR')}</th>`
);

fs.writeFileSync(file, content);
