const fs = require('fs');
let file = './components/reports/CurrencyReport.tsx';
let txt = fs.readFileSync(file, 'utf8');

// Replace table header in web view
const webHeaderRegex = /<thead className="bg-slate-50 dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 text-xs font-black text-slate-600 dark:text-slate-400">[\s\S]*?<\/thead>/;
const newWebHeader = \`<thead className="bg-slate-50 dark:bg-slate-900 border-b-2 border-slate-200 dark:border-slate-800 text-xs font-black text-slate-600 dark:text-slate-400">
    <tr>
        <th className="p-3 text-center border-l sticky right-0 bg-slate-50 dark:bg-slate-900 z-30">ردیف</th>
        <th className="p-3 text-right border-l sticky right-12 bg-slate-50 dark:bg-slate-900 z-30">شرح کالا</th>
        <th className="p-3 text-center">پرونده</th>
        <th className="p-3 text-center">ثبت سفارش</th>
        <th className="p-3 text-center">شرکت</th>
        <th className="p-3 text-center">معادل دلاری خرید ارز</th>
        <th className="p-3 text-center text-blue-700 dark:text-blue-400 font-extrabold max-w-[150px]">ارز تحویلی (نهایی)</th>
        <th className="p-3 text-center">وضعیت</th>
        <th className="p-3 text-center bg-green-50/50 dark:bg-green-950/20 text-green-700 dark:text-green-400 rounded-lg max-w-[150px]">بهای ارز (کسر عودت)</th>
        <th className="p-3 text-center bg-indigo-50/50 text-indigo-700 rounded-lg max-w-[150px]">بهای تمام شده برحسب تحویلی</th>
        <th className="p-3 text-center cursor-pointer hover:bg-slate-100" onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}>
            تاریخ خرید ارز {sortDirection === 'asc' ? '▲' : '▼'}
        </th>
        <th className="p-3 text-center text-rose-700 dark:text-rose-400 max-w-[130px]">مقدار ارز (اولیه)</th>
        <th className="p-3 text-center">نوع ارز</th>
        <th className="p-3 text-center">صرافی</th>
        <th className="p-3 text-center">کارگزار</th>
        <th className="p-3 text-center">بانک</th>
        <th className="p-3 text-center">مبلغ عودت</th>
        <th className="p-3 text-center">تاریخ عودت</th>
    </tr>
</thead>\`;
txt = txt.replace(webHeaderRegex, newWebHeader);

// Replace mapping inside the table body (we need to change columns)
// In Web view:
const webBodyRegex = /\{processedGroups\.map\(\(group, gIndex\) => \{[\s\S]*?<\/React\.Fragment>\n                                    \);\n                                \}\)\}/;

const newWebBody = \`{processedGroups.map((group, gIndex) => {
    const groupRowSpan = group.tranches.length;
    return (
        <React.Fragment key={\\\`web_\${gIndex}\\\`}>
            {group.tranches.map((t: any, tIndex: number) => {
                const currentIdx = globalWebRowIdx++;
                return (
                    <tr 
                        key={\\\`web_row_\${gIndex}_\${tIndex}\\\`} 
                        onClick={() => {
                             setSelectedRowDetail({ group, tranche: t, index: currentIdx });
                         }}
                        className="hover:bg-blue-50/40 dark:hover:bg-slate-800/40 cursor-pointer active:bg-blue-100/30 dark:active:bg-slate-800/60 transition-colors group text-slate-800 dark:text-slate-200 font-semibold"
                    >
                        {tIndex === 0 && (
                            <>
                                <td className="p-3 text-center font-bold bg-slate-50 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 sticky right-0 group-hover:bg-slate-100 dark:group-hover:bg-slate-850 z-20 shadow-xs" rowSpan={groupRowSpan}>
                                    {gIndex + 1}
                                </td>
                                <td className="p-3 text-right font-black text-slate-900 dark:text-white truncate border-l border-slate-200 dark:border-slate-800 sticky right-12 group-hover:bg-slate-100 dark:group-hover:bg-slate-850 z-20 max-w-[200px]" rowSpan={groupRowSpan} title={group.recordInfo.goodsName}>
                                    {group.recordInfo.goodsName}
                                </td>
                                <td className="p-3 text-center font-mono font-black text-blue-600 dark:text-blue-400" rowSpan={groupRowSpan}>
                                    {group.recordInfo.fileNumber}
                                </td>
                                <td className="p-3 text-center font-mono text-slate-500 dark:text-slate-400" rowSpan={groupRowSpan}>
                                    {group.recordInfo.registrationNumber || '-'}
                                </td>
                                <td className="p-3 text-center font-extrabold text-slate-700 dark:text-slate-300" rowSpan={groupRowSpan}>
                                    {group.recordInfo.company}
                                </td>
                            </>
                        )}
                        <td className="p-3 text-center font-mono font-bold text-gray-500">
                            {formatUSD(t.usdAmount)} $
                        </td>
                        <td className="p-3 text-center font-mono font-black text-blue-700 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-900/10 rounded-lg">
                            {formatNumberString(t.deliveredAmount)} <span className="text-xs text-slate-400 font-sans">{t.currencyType}</span>
                        </td>
                        <td className="p-3 text-center">
                            {t.isDelivered ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">تحویل شده</span> : <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">انتظار</span>}
                        </td>
                        <td className="p-3 text-center font-mono font-black text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-950/20 rounded-lg">
                            {formatNumberString(t.rialAmount)}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 rounded-lg">
                            {formatNumberString(t.finalCostPerUnit)} <span className="text-[10px] text-indigo-400 font-sans">ریال</span>
                        </td>
                        <td className="p-3 text-center font-mono text-slate-500 dark:text-slate-400">
                            {t.purchaseDate || '-'}
                        </td>
                        <td className="p-3 text-center font-mono font-bold text-rose-700 dark:text-rose-400">
                            {formatNumberString(t.originalAmount)}
                        </td>
                        <td className="p-3 text-center font-extrabold text-slate-600 dark:text-slate-300">
                            {t.currencyType}
                        </td>
                        <td className="p-3 text-center text-slate-600 dark:text-slate-300">
                            {t.exchangeName}
                        </td>
                        <td className="p-3 text-center text-slate-600 dark:text-slate-300">
                            {t.brokerName}
                        </td>
                        {tIndex === 0 && (
                            <td className="p-3 text-center font-extrabold text-slate-600 dark:text-slate-300" rowSpan={groupRowSpan}>
                                {group.recordInfo.bank}
                            </td>
                        )}
                        <td className="p-3 text-center font-mono text-orange-600">
                            {t.returnAmount ? formatNumberString(t.returnAmount) : '-'}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-500">
                            {t.returnDate || '-'}
                        </td>
                    </tr>
                );
            })}
        </React.Fragment>
    );
})}\`;

txt = txt.replace(webBodyRegex, newWebBody);

fs.writeFileSync(file, txt, 'utf8');
console.log('Script updated Web table.');
