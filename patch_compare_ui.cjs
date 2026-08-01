const fs = require('fs');
let code = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

const targetStr = `                                    {compareMode ? (
                                        chartData.length === 0 ? (
                                            <div className="text-center py-10 text-slate-400 font-medium">موردی یافت نشد. دوره فیلتر را تغییر دهید.</div>
                                        ) : (
                                            chartData.map((row, idx) => {
                                                const weightDiff = row.weightB ? ((row.weightA - row.weightB) / row.weightB) * 100 : 0;
                                                const amountDiff = row.amountB ? ((row.amountA - row.amountB) / row.amountB) * 100 : 0;
                                                return (
                                                    <div key={idx} className="p-4 space-y-3">
                                                        <h4 className="text-sm font-black text-slate-900">{row.name}</h4>
                                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                                            <div className="bg-slate-50 p-2.5 rounded-xl space-y-1">
                                                                <span className="text-[10px] text-slate-400 font-medium block">مقایسه وزن (kg)</span>
                                                                <div className="flex justify-between items-center text-[10px]">
                                                                    <span className="font-mono font-bold text-slate-700">{row.weightA.toFixed(1)} <span className="text-[8px] text-slate-400">A</span></span>
                                                                    <span className="font-mono text-slate-400">/</span>
                                                                    <span className="font-mono font-bold text-slate-700">{row.weightB.toFixed(1)} <span className="text-[8px] text-slate-400">B</span></span>
                                                                </div>
                                                                <span className={\`inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold \${weightDiff >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}\`}>
                                                                    {weightDiff >= 0 ? '+' : ''}{weightDiff.toFixed(1)}% تغییر وزن
                                                                </span>
                                                            </div>
                                                            <div className="bg-slate-50 p-2.5 rounded-xl space-y-1">
                                                                <span className="text-[10px] text-slate-400 font-medium block">مقایسه مبلغ (ریال)</span>
                                                                <div className="flex flex-col text-[10px] font-mono font-semibold text-slate-700 leading-relaxed">
                                                                    <div>A: {formatMoney(row.amountA)}</div>
                                                                    <div>B: {formatMoney(row.amountB)}</div>
                                                                </div>
                                                                <span className={\`inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold \${amountDiff >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}\`}>
                                                                    {amountDiff >= 0 ? '+' : ''}{amountDiff.toFixed(1)}% تغییر مبلغ
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )
                                    ) : (`;

const replaceStr = `                                    {compareMode ? (
                                        chartData.length === 0 ? (
                                            <div className="text-center py-10 text-slate-400 font-medium">موردی یافت نشد. دوره فیلتر را تغییر دهید.</div>
                                        ) : (
                                            <>
                                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                                                <h4 className="text-sm font-bold text-slate-800">گزارش مقایسه ای فروش (A نسبت به B)</h4>
                                                <button
                                                    onClick={async () => {
                                                        try {
                                                            const res = await fetch('/api/sayan/sales-report/send-compare', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ chartData, dateFromA: dateFrom, dateToA: dateTo, dateFromB: salesDateFromB, dateToB: salesDateToB })
                                                            });
                                                            const data = await res.json();
                                                            if (res.ok && data.success) {
                                                                alert(\`✅ \${data.message}\`);
                                                            } else {
                                                                alert(\`❌ خطا در ارسال: \${data.error || 'ناشناخته'}\`);
                                                            }
                                                        } catch (err) {
                                                            alert('❌ خطای ارتباط با سرور');
                                                        }
                                                    }}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                    ارسال دستی به ربات
                                                </button>
                                            </div>
                                            {chartData.map((row, idx) => {
                                                const weightDiff = row.netWeightB ? ((row.netWeightA - row.netWeightB) / row.netWeightB) * 100 : 0;
                                                const amountDiff = row.netAmountB ? ((row.netAmountA - row.netAmountB) / row.netAmountB) * 100 : 0;
                                                const avgFeeA = row.netWeightA ? (row.netAmountA / row.netWeightA) : 0;
                                                const avgFeeB = row.netWeightB ? (row.netAmountB / row.netWeightB) : 0;
                                                return (
                                                    <div key={idx} className="p-4 space-y-3 border-b border-slate-100 last:border-0">
                                                        <h4 className="text-sm font-black text-slate-900">{row.name}</h4>
                                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                                            <div className="bg-slate-50 p-2.5 rounded-xl space-y-1">
                                                                <span className="text-[10px] text-slate-400 font-medium block">مقایسه وزن خالص (kg)</span>
                                                                <div className="flex flex-col text-[10px] font-mono font-semibold text-slate-700 leading-relaxed space-y-0.5">
                                                                    <div className="flex justify-between items-center bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-100">
                                                                        <span>A: {row.netWeightA.toFixed(1)}</span>
                                                                        <span className="text-[8px] text-rose-500 font-sans font-bold" title="مرجوعی A">م {row.retWeightA.toFixed(1)}</span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-100">
                                                                        <span>B: {row.netWeightB.toFixed(1)}</span>
                                                                        <span className="text-[8px] text-rose-500 font-sans font-bold" title="مرجوعی B">م {row.retWeightB.toFixed(1)}</span>
                                                                    </div>
                                                                </div>
                                                                <span className={\`inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold \${weightDiff >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}\`}>
                                                                    {weightDiff >= 0 ? '+' : ''}{weightDiff.toFixed(1)}% تغییر خالص
                                                                </span>
                                                            </div>
                                                            <div className="bg-slate-50 p-2.5 rounded-xl space-y-1">
                                                                <span className="text-[10px] text-slate-400 font-medium block">مقایسه مبلغ خالص و میانگین فی (ریال)</span>
                                                                <div className="flex flex-col text-[10px] font-mono font-semibold text-slate-700 leading-relaxed space-y-0.5">
                                                                    <div className="flex justify-between items-center bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-100">
                                                                        <span className="flex flex-col">
                                                                            <span>A: {formatMoney(row.netAmountA)}</span>
                                                                            <span className="text-[8px] text-indigo-500 font-sans font-bold">میانگین فی: {formatMoney(avgFeeA)}</span>
                                                                        </span>
                                                                        <span className="text-[8px] text-rose-500 font-sans font-bold flex flex-col items-end" title="مرجوعی A">
                                                                            <span>مبلغ: م {formatMoney(row.retAmountA)}</span>
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex justify-between items-center bg-white px-1.5 py-0.5 rounded shadow-sm border border-slate-100">
                                                                        <span className="flex flex-col">
                                                                            <span>B: {formatMoney(row.netAmountB)}</span>
                                                                            <span className="text-[8px] text-indigo-500 font-sans font-bold">میانگین فی: {formatMoney(avgFeeB)}</span>
                                                                        </span>
                                                                        <span className="text-[8px] text-rose-500 font-sans font-bold flex flex-col items-end" title="مرجوعی B">
                                                                            <span>مبلغ: م {formatMoney(row.retAmountB)}</span>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <span className={\`inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold \${amountDiff >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}\`}>
                                                                    {amountDiff >= 0 ? '+' : ''}{amountDiff.toFixed(1)}% تغییر مبلغ خالص
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            </>
                                        )
                                    ) : (`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('components/AccountingReports.tsx', code);
console.log('patched compare UI');
