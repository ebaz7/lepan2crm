const fs = require('fs');
let content = fs.readFileSync('./components/reports/CurrencyReport.tsx', 'utf8');

const printContentStart = `// A4 Landscape Print View Content
    const printContent = (`;

const newPrintContent = `// A4 Landscape Print View Content
    const printContent = (
        <React.Fragment>
        <style dangerouslySetInnerHTML={{__html: \`
            @media print {
                @page { size: A4 landscape; margin: 10mm; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; padding: 0; }
                .printable-content { width: 100% !important; margin: 0 !important; transform: none !important; box-shadow: none !important; border: none !important; }
                .no-print { display: none !important; }
            }
        \`}} />
        <div id={elementId} className="printable-content p-4 text-black text-[10px] relative" 
            style={{
                backgroundColor: '#ffffff',
                color: '#000000',
                width: '296mm', 
                minHeight: '210mm',
                margin: '0 auto',
                boxSizing: 'border-box',
                direction: 'rtl'
            }}
        >
            {/* Header */}
            <div className="border border-black mb-1 text-center text-black shadow-sm overflow-hidden rounded-t-lg">
                <div className="bg-slate-200/80 font-black py-2 border-b border-black text-sm text-slate-900">
                    گزارش جامع خرید ارز - سال {selectedYear}
                </div>
                <div className="flex justify-between px-3 py-1.5 font-bold text-slate-800 text-[10px] bg-slate-50">
                    <span>تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</span>
                    {filters.company && <span>شرکت: {filters.company}</span>}
                    {filters.bank && <span>بانک عامل: {filters.bank}</span>}
                </div>
            </div>

            {/* Main Table */}
            <table className="w-full border-collapse border border-black text-center mb-4 text-black table-fixed">
                <colgroup>
                    <col style={{width: '25px'}} /> {/* Row */}
                    <col /> {/* Goods */}
                    <col style={{width: '65px'}} /> {/* File No */}
                    <col style={{width: '65px'}} /> {/* Reg No */}
                    <col style={{width: '75px'}} /> {/* Company */}
                    <col style={{width: '65px'}} /> {/* USD Equivalent */}
                    <col style={{width: '60px'}} /> {/* Original Currency */}
                    <col style={{width: '40px'}} /> {/* Currency Type */}
                    <col style={{width: '60px'}} /> {/* Purchase Date */}
                    <col style={{width: '70px'}} /> {/* Final Cost Per Unit */}
                    <col style={{width: '75px'}} /> {/* Rial Cost */}
                    <col style={{width: '65px'}} /> {/* Exchange */}
                    <col style={{width: '60px'}} /> {/* Broker */}
                    <col style={{width: '65px'}} /> {/* Bank */}
                    <col style={{width: '60px'}} /> {/* Delivered */}
                    <col style={{width: '45px'}} /> {/* Status */}
                    <col style={{width: '60px'}} /> {/* Return Amt */}
                    <col style={{width: '50px'}} /> {/* Return Date */}
                </colgroup>
                <thead>
                    <tr className="bg-green-700 text-white font-extrabold text-[9px] border-black">
                        <th className="border border-black p-1 align-middle text-center">ردیف</th>
                        <th className="border border-black p-1 align-middle text-center">شرح کالا</th>
                        <th className="border border-black p-1 align-middle text-center">پرونده</th>
                        <th className="border border-black p-1 align-middle text-center">ثبت سفارش</th>
                        <th className="border border-black p-1 align-middle text-center">نام شرکت</th>
                        <th className="border border-black p-1 align-middle text-center">معادل دلار</th>
                        <th className="border border-black p-1 align-middle text-center">مقدار ارز</th>
                        <th className="border border-black p-1 align-middle text-center">نوع</th>
                        <th className="border border-black p-1 align-middle text-center">تاریخ خرید</th>
                        <th className="border border-black p-1 align-middle text-center">بهای هر واحد تحویلی (ریال)</th>
                        <th className="border border-black p-1 align-middle text-center">بهای ارز کسر عودت (ریال)</th>
                        <th className="border border-black p-1 align-middle text-center">صرافی</th>
                        <th className="border border-black p-1 align-middle text-center">کارگزار</th>
                        <th className="border border-black p-1 align-middle text-center">بانک</th>
                        <th className="border border-black p-1 align-middle text-center">تحویلی</th>
                        <th className="border border-black p-1 align-middle text-center">وضعیت</th>
                        <th className="border border-black p-1 align-middle text-center">عودت</th>
                        <th className="border border-black p-1 align-middle text-center">ت. عودت</th>
                    </tr>
                </thead>
                <tbody className="bg-white">
                    {(() => {
                        let globalIdx = 1;
                        return processedGroups.map((group, gIndex) => {
                            const groupRowSpan = group.tranches.length;
                            return (
                                <React.Fragment key={\`print_\${gIndex}\`}>
                                    {group.tranches.map((t: any, tIndex: number) => {
                                        return (
                                            <tr key={\`print_row_\${gIndex}_\${tIndex}\`} className={\`border border-black \${globalIdx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}\`}>
                                                {tIndex === 0 && (
                                                    <React.Fragment>
                                                        <td className="border border-black p-1 font-bold align-middle text-center text-[10px]" rowSpan={groupRowSpan}>{globalIdx++}</td>
                                                        <td className="border border-black p-1 truncate max-w-[100px] text-right text-[9px] align-middle" rowSpan={groupRowSpan}>{group.recordInfo.goodsName}</td>
                                                        <td className="border border-black p-1 font-mono font-bold align-middle text-center" rowSpan={groupRowSpan}>{group.recordInfo.fileNumber}</td>
                                                        <td className="border border-black p-1 font-mono align-middle text-center" rowSpan={groupRowSpan}>{group.recordInfo.registrationNumber || '-'}</td>
                                                        <td className="border border-black p-1 font-bold text-[9px] align-middle text-center" rowSpan={groupRowSpan}>{group.recordInfo.company}</td>
                                                    </React.Fragment>
                                                )}
                                                <td className="border border-black p-1 font-mono text-blue-800 font-bold align-middle text-center text-[9px]">{formatNumberString(t.usdAmount)}</td>
                                                <td className="border border-black p-1 font-mono font-bold align-middle text-center">{formatNumberString(t.originalAmount)}</td>
                                                <td className="border border-black p-1 font-bold text-[8px] align-middle text-center">{t.currencyType}</td>
                                                <td className="border border-black p-1 font-mono text-[9px] align-middle text-center">{t.purchaseDate || '-'}</td>
                                                <td className="border border-black p-1 font-mono font-bold text-purple-800 text-[10px] align-middle text-center bg-purple-50/10">{formatNumberString(t.finalCostPerUnit)}</td>
                                                <td className="border border-black p-1 font-mono font-bold align-middle text-center text-[10px]">{formatNumberString(t.rialAmount)}</td>
                                                <td className="border border-black p-1 text-[8px] align-middle text-center">{t.exchangeName}</td>
                                                <td className="border border-black p-1 text-[8px] align-middle text-center">{t.brokerName}</td>
                                                {tIndex === 0 && (
                                                    <td className="border border-black p-1 font-bold text-[9px] align-middle text-center" rowSpan={groupRowSpan}>{group.recordInfo.bank}</td>
                                                )}
                                                <td className="border border-black p-1 font-mono font-bold  bg-green-50 align-middle text-center text-green-900">{formatNumberString(t.deliveredAmount)}</td>
                                                <td className="border border-black p-1 font-bold text-[8px] align-middle text-center">{t.isDelivered ? 'پایان' : 'در جریان'}</td>
                                                <td className="border border-black p-1 font-mono text-[9px] text-red-700 bg-red-50 align-middle text-center">{t.returnAmount ? formatNumberString(t.returnAmount) : '-'}</td>
                                                <td className="border border-black p-1 font-sans text-[8px] text-gray-600 align-middle text-center">{t.returnDate || '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        });
                    })()}
                </tbody>
                {processedGroups.length > 0 && (
                    <tfoot className="font-black bg-slate-200 border-black border text-slate-800 shadow-inner">
                        <tr>
                            <td colSpan={5} className="p-1.5 text-center border font-bold text-[10px] border-black align-middle text-center">جمع کل</td>
                            <td className="p-1.5 font-mono font-bold border border-black align-middle text-center text-blue-900 border-t-2">{formatNumberString(tableTotals.usd)}</td>
                            <td className="p-1.5 font-mono font-bold border border-black align-middle text-center border-t-2">{formatNumberString(tableTotals.original)}</td>
                            <td colSpan={3} className="border border-black align-middle text-center border-t-2"></td>
                            <td className="p-1.5 font-mono font-bold border border-black align-middle text-center border-t-2">{formatNumberString(tableTotals.rial)}</td>
                            <td colSpan={3} className="border border-black align-middle text-center border-t-2"></td>
                            <td className="p-1.5 font-mono font-bold border border-black align-middle text-center bg-green-200/50 text-green-900 border-t-2">{formatNumberString(tableTotals.delivered)}</td>
                            <td colSpan={3} className="border border-black align-middle text-center border-t-2"></td>
                        </tr>
                    </tfoot>
                )}
            </table>
        </div>
        </React.Fragment>
    );`;

// We have to replace from `const printContent = (` to `);` (the end of printContent).
// Since print content is quite long, I'll use a regex that matches until `    // End of printContent` or `    return (` which is the start of the main component return.

const regex = /const printContent = \([\s\S]*?    \n    return \(\n/m;
content = content.replace(regex, newPrintContent + '\n\n    return (\n');

fs.writeFileSync('./components/reports/CurrencyReport.tsx', content, 'utf8');
