const fs = require('fs');
let content = fs.readFileSync('./components/reports/CurrencyReport.tsx', 'utf8');

const targetHeader = `<th className="p-3.5 text-center min-w-[65px] bg-blue-50/40 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300">نوع ارز</th>
                                    <th className="p-3.5 text-center min-w-[105px] font-sans">تاریخ خرید</th>
                                    <th className="p-3.5 text-center min-w-[135px]">ارز خریداری شده (ریال)</th>
                                    <th className="p-3.5 text-center min-w-[115px]">صرافی عامل</th>
                                    <th className="p-3.5 text-center min-w-[115px]">کارگزار</th>
                                    <th className="p-3.5 text-center min-w-[125px]">بانک عامل</th>
                                    <th className="p-3.5 text-center min-w-[125px] bg-green-50/40 dark:bg-green-950/20 text-green-800 dark:text-green-300">مقدار تحویل شده</th>
                                    <th className="p-3.5 text-center min-w-[65px] bg-green-50/40 dark:bg-green-950/20 text-green-800 dark:text-green-300">وضعیت</th>
                                    <th className="p-3.5 text-center min-w-[105px]">مبلغ عودت</th>
                                    <th className="p-3.5 text-center min-w-[95px] font-sans">تاریخ عودت</th>`;

const newHeader = `<th className="p-3.5 text-center min-w-[65px] bg-blue-50/40 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300">نوع ارز</th>
                                    <th className="p-3.5 text-center min-w-[120px] bg-indigo-50/40 text-indigo-800 cursor-pointer hover:bg-indigo-100 transition-colors" onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}>
                                        تاریخ خرید {sortDirection === 'asc' ? '▲' : '▼'}
                                    </th>
                                    <th className="p-3.5 text-center min-w-[135px] text-green-800 bg-green-100/50">بهای ارز (کسر عودت ریال)</th>
                                    <th className="p-3.5 text-center min-w-[135px] bg-purple-50/40 text-purple-800">بهای تمام شده تحویلی (ریال)</th>
                                    <th className="p-3.5 text-center min-w-[115px]">صرافی عامل</th>
                                    <th className="p-3.5 text-center min-w-[115px]">کارگزار</th>
                                    <th className="p-3.5 text-center min-w-[125px]">بانک عامل</th>
                                    <th className="p-3.5 text-center min-w-[125px] bg-green-50/40 dark:bg-green-950/20 text-green-800 dark:text-green-300">مقدار تحویل شده</th>
                                    <th className="p-3.5 text-center min-w-[65px] bg-green-50/40 dark:bg-green-950/20 text-green-800 dark:text-green-300">وضعیت</th>
                                    <th className="p-3.5 text-center min-w-[105px] text-rose-800 bg-rose-50 border-r border-slate-200">مبلغ عودت</th>
                                    <th className="p-3.5 text-center min-w-[95px] font-sans text-rose-800 bg-rose-50">تاریخ عودت</th>`;

content = content.replace(targetHeader, newHeader);

const targetBody = `<td className="p-3 text-center font-mono font-black text-blue-600 dark:text-blue-400 font-sans" rowSpan={groupRowSpan}>
                                                                    {formatUSD(t.usdAmount)}
                                                                </td>
                                                                <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                                                                    {formatNumberString(t.originalAmount)}
                                                                </td>
                                                                <td className="p-3 text-center font-extrabold text-blue-700 dark:text-blue-400">
                                                                    {t.currencyType}
                                                                </td>
                                                                <td className="p-3 text-center font-mono font-bold text-slate-500 font-sans">
                                                                    {t.purchaseDate || '-'}
                                                                </td>
                                                                <td className="p-3 text-center font-mono font-black text-indigo-700 dark:text-indigo-400">
                                                                    {formatNumberString(t.rialAmount)}
                                                                </td>
                                                                <td className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                                                                    {t.exchangeName}
                                                                </td>
                                                                <td className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                                                                    {t.brokerName}
                                                                </td>
                                                                <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-800" rowSpan={groupRowSpan}>
                                                                    {group.recordInfo.bank || '-'}
                                                                </td>
                                                                <td className="p-3 text-center font-mono font-black text-green-700 dark:text-green-400 bg-green-50/30 dark:bg-green-900/10">
                                                                    {formatNumberString(t.deliveredAmount)}
                                                                </td>
                                                                <td className="p-3 text-center font-extrabold text-xs">
                                                                    {t.isDelivered ? <span className="text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-md">پایان</span> : <span className="text-orange-500 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-400 px-2 py-0.5 rounded-md">در جریان</span>}
                                                                </td>
                                                                <td className="p-3 text-center text-rose-600 dark:text-rose-400 font-mono font-bold">
                                                                    {t.returnAmount ? formatNumberString(t.returnAmount) : '-'}
                                                                </td>
                                                                <td className="p-3 text-center text-slate-500 font-mono text-xs font-sans">
                                                                    {t.returnDate || '-'}
                                                                </td>`;

const newBody = `<td className="p-3 text-center font-mono font-black text-blue-600 dark:text-blue-400 font-sans" rowSpan={groupRowSpan}>
                                                                    {formatUSD(t.usdAmount)}
                                                                </td>
                                                                <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                                                                    {formatNumberString(t.originalAmount)}
                                                                </td>
                                                                <td className="p-3 text-center font-extrabold text-blue-700 dark:text-blue-400">
                                                                    {t.currencyType}
                                                                </td>
                                                                <td className="p-3 text-center font-mono font-bold text-indigo-700 border-x border-slate-200 bg-indigo-50/20">
                                                                    {t.purchaseDate || '-'}
                                                                </td>
                                                                <td className="p-3 text-center font-mono font-black text-green-800 bg-green-50/40">
                                                                    {formatNumberString(t.rialAmount)}
                                                                </td>
                                                                <td className="p-3 text-center font-mono font-black text-purple-700 bg-purple-50/40">
                                                                    {formatNumberString(t.finalCostPerUnit)} <span className="text-[9px] font-sans font-normal text-purple-400 block">ریال</span>
                                                                </td>
                                                                <td className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                                                                    {t.exchangeName}
                                                                </td>
                                                                <td className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">
                                                                    {t.brokerName}
                                                                </td>
                                                                <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300 border-l border-slate-200 dark:border-slate-800" rowSpan={groupRowSpan}>
                                                                    {group.recordInfo.bank || '-'}
                                                                </td>
                                                                <td className="p-3 text-center font-mono font-black text-green-700 dark:text-green-400 bg-green-50/30 dark:bg-green-900/10">
                                                                    {formatNumberString(t.deliveredAmount)}
                                                                </td>
                                                                <td className="p-3 text-center font-extrabold text-xs">
                                                                    {t.isDelivered ? <span className="text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-md">پایان</span> : <span className="text-orange-500 bg-orange-100 dark:bg-orange-900/40 dark:text-orange-400 px-2 py-0.5 rounded-md">در جریان</span>}
                                                                </td>
                                                                <td className="p-3 text-center text-rose-600 font-mono font-bold bg-rose-50 border-r border-slate-200">
                                                                    {t.returnAmount ? formatNumberString(t.returnAmount) : '-'}
                                                                </td>
                                                                <td className="p-3 text-center text-slate-500 font-mono text-xs font-sans bg-rose-50">
                                                                    {t.returnDate || '-'}
                                                                </td>`;

content = content.replace(targetBody, newBody);

fs.writeFileSync('./components/reports/CurrencyReport.tsx', content, 'utf8');
