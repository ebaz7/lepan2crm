const fs = require('fs');
let code = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

const targetStr = `                                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                                <h4 className="text-sm font-bold text-slate-800">گزارش مقایسه ای فروش (A نسبت به B)</h4>
                                                <button`;

const replaceStr = `                                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-2 justify-between items-center">
                                                <h4 className="text-sm font-bold text-slate-800">گزارش مقایسه ای فروش (A نسبت به B)</h4>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const printWindow = window.open('', '_blank');
                                                            if (!printWindow) return;
                                                            let html = '<html dir="rtl"><head><title>چاپ مقایسه فروش</title><style>body{font-family:Tahoma,sans-serif;margin:20px;direction:rtl}table{width:100%;border-collapse:collapse;margin-top:20px;font-size:12px}th,td{border:1px solid #ccc;padding:8px;text-align:right}th{background:#f1f5f9}.diff{direction:ltr;display:inline-block}.ret{color:#e11d48;font-size:10px}</style></head><body>';
                                                            html += '<h2>گزارش مقایسه ای فروش</h2>';
                                                            html += '<table><thead><tr><th>گروه کالا</th><th>خالص A (kg)</th><th>مبلغ A (ریال)</th><th>خالص B (kg)</th><th>مبلغ B (ریال)</th><th>رشد مبلغ</th></tr></thead><tbody>';
                                                            let sumA = 0, sumB = 0;
                                                            chartData.forEach(row => {
                                                                sumA += row.netAmountA || 0;
                                                                sumB += row.netAmountB || 0;
                                                                const diff = row.netAmountB ? ((row.netAmountA - row.netAmountB) / row.netAmountB) * 100 : 0;
                                                                html += \`<tr>
                                                                    <td><strong>\${row.name}</strong></td>
                                                                    <td>\${(row.netWeightA || 0).toFixed(2)}<br><span class="ret">مرجوعی: \${(row.retWeightA || 0).toFixed(2)}</span></td>
                                                                    <td>\${(row.netAmountA || 0).toLocaleString('fa-IR')}<br><span class="ret">مرجوعی: \${(row.retAmountA || 0).toLocaleString('fa-IR')}</span></td>
                                                                    <td>\${(row.netWeightB || 0).toFixed(2)}<br><span class="ret">مرجوعی: \${(row.retWeightB || 0).toFixed(2)}</span></td>
                                                                    <td>\${(row.netAmountB || 0).toLocaleString('fa-IR')}<br><span class="ret">مرجوعی: \${(row.retAmountB || 0).toLocaleString('fa-IR')}</span></td>
                                                                    <td class="diff" style="color: \${diff>=0?'#16a34a':'#dc2626'}">\${diff>0?'+':''}\${diff.toFixed(1)}%</td>
                                                                </tr>\`;
                                                            });
                                                            const totDiff = sumB ? ((sumA - sumB) / sumB) * 100 : 0;
                                                            html += \`<tr>
                                                                <th>جمع کل</th>
                                                                <th>-</th>
                                                                <th>\${sumA.toLocaleString('fa-IR')}</th>
                                                                <th>-</th>
                                                                <th>\${sumB.toLocaleString('fa-IR')}</th>
                                                                <th class="diff" style="color: \${totDiff>=0?'#16a34a':'#dc2626'}">\${totDiff>0?'+':''}\${totDiff.toFixed(1)}%</th>
                                                            </tr>\`;
                                                            html += '</tbody></table></body></html>';
                                                            printWindow.document.write(html);
                                                            printWindow.document.close();
                                                            printWindow.focus();
                                                            setTimeout(() => { printWindow.print(); }, 500);
                                                        }}
                                                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                        چاپ (Print)
                                                    </button>
                                                <button`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('components/AccountingReports.tsx', code);
console.log('patched compare print');
