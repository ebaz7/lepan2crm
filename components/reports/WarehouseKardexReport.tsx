
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { WarehouseItem, WarehouseTransaction } from '../../types';
import { formatDate, formatCurrency, formatNumberString, parsePersianDate, jalaliToGregorian } from '../../constants';
import { Filter, Printer, FileDown, Search, ArrowDownCircle, ArrowUpCircle, X, Loader2 } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator'; 

interface Props {
    items: WarehouseItem[];
    transactions: WarehouseTransaction[];
    allTransactions?: WarehouseTransaction[];
    companies: string[];
    financialYear?: string;
}

const WarehouseKardexReport: React.FC<Props> = ({ items, transactions, allTransactions, companies, financialYear }) => {
    // Filters
    const [selectedCompany, setSelectedCompany] = useState<string>('');
    const [selectedItem, setSelectedItem] = useState<string>('');
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [txType, setTxType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
    const [isGenerating, setIsGenerating] = useState(false);

    // Scaling State
    const [scale, setScale] = useState(1);
    const containerWrapperRef = useRef<HTMLDivElement>(null);

    // Initial Filter Setup
    useEffect(() => {
        if (companies.length > 0 && !selectedCompany) setSelectedCompany(companies[0]);
        if (items.length > 0 && !selectedItem) setSelectedItem(items[0].id);
    }, [companies, items]);

    // Auto-Scale Logic
    useEffect(() => {
        const handleResize = () => {
            const wrapper = containerWrapperRef.current;
            if (wrapper) {
                const wrapperWidth = wrapper.clientWidth;
                const targetWidth = 794; // A4 Portrait
                
                if (wrapperWidth < targetWidth + 40) {
                    const newScale = (wrapperWidth - 32) / targetWidth;
                    setScale(newScale);
                } else {
                    setScale(1);
                }
            }
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Calculation Logic (Same as before + Opening Balance from previous fiscal years)
    const kardexRows = useMemo(() => {
        if (!selectedCompany || !selectedItem) return [];

        const txSource = allTransactions || transactions;

        // 1. Filter and sort ALL historical transactions for the selected item and company
        const itemTxs = txSource.filter(tx => {
            if (tx.company !== selectedCompany) return false;
            if (tx.status === 'REJECTED') return false;
            return tx.items.some(i => i.itemId === selectedItem);
        });

        // Sort chronologically by date
        itemTxs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // 2. Compute running balance chronologically across ALL transactions
        let currentBalance = 0;
        const txsWithBalance = itemTxs.flatMap(tx => {
            const matchingItems = tx.items.filter(i => i.itemId === selectedItem);
            return matchingItems.map((txItem, idx) => {
                const qty = txItem ? txItem.quantity : 0;
                const weight = txItem ? txItem.weight : 0;
                const unitPrice = txItem ? txItem.unitPrice : 0;

                if (tx.type === 'IN') {
                    currentBalance += qty;
                } else {
                    currentBalance -= qty;
                }

                return {
                    tx,
                    txItemId: tx.id + '_' + idx,
                    qty,
                    weight,
                    unitPrice,
                    balanceAtThisPoint: currentBalance
                };
            });
        });

        // 3. Segment into openingBalance (before the active window) and visibleRows
        const targetYear = financialYear && financialYear !== 'all' ? parseInt(financialYear.replace(/[^\d]/g, ''), 10) : null;
        const fromDate = dateRange.from ? parsePersianDate(dateRange.from) : null;
        const toDate = dateRange.to ? parsePersianDate(dateRange.to) : null;
        if (toDate) {
            toDate.setHours(23, 59, 59, 999);
        }

        const visibleRows: {
            id: string;
            date: string;
            number: string | number;
            type: 'IN' | 'OUT' | 'OPENING';
            description: string;
            in: number;
            out: number;
            balance: number;
            weight: number;
            unitPrice: number;
        }[] = [];

        let openingBalance = 0;

        txsWithBalance.forEach(item => {
            const { tx, qty, weight, unitPrice, balanceAtThisPoint } = item;
            const txDate = new Date(tx.date);

            // Determine if it matches the financial year
            let matchesYear = true;
            let isBeforeYear = false;

            if (targetYear !== null) {
                try {
                    const shamsiDate = txDate.toLocaleDateString('fa-IR-u-nu-latn');
                    const shamsiYearStr = shamsiDate.split('/')[0].replace(/[^\d]/g, '');
                    const shamsiYear = parseInt(shamsiYearStr, 10);
                    matchesYear = shamsiYear === targetYear;
                    isBeforeYear = shamsiYear < targetYear;
                } catch (e) {
                    matchesYear = true; 
                }
            }

            // Determine if it matches the date range
            let isBeforeDate = false;
            let isAfterDate = false;

            if (fromDate && txDate < fromDate) {
                isBeforeDate = true;
            }
            if (toDate && txDate > toDate) {
                isAfterDate = true;
            }

            // If it is before the selected range, it contributes to the opening balance
            if (isBeforeYear || (matchesYear && isBeforeDate)) {
                if (tx.type === 'IN') {
                    openingBalance += qty;
                } else {
                    openingBalance -= qty;
                }
            } else if (matchesYear && !isBeforeDate && !isAfterDate) {
                // It is in the visible range!
                // Filter by transaction type if needed, but preserve correct historical balance!
                if (txType === 'ALL' || tx.type === txType) {
                    visibleRows.push({
                        id: item.txItemId,
                        date: tx.date,
                        number: tx.number || tx.proformaNumber || '-',
                        type: tx.type,
                        description: tx.type === 'IN' 
                            ? `پروفرما: ${tx.proformaNumber}` 
                            : `گیرنده: ${tx.recipientName || '-'} | مقصد: ${tx.destination || '-'}`,
                        in: tx.type === 'IN' ? qty : 0,
                        out: tx.type === 'OUT' ? qty : 0,
                        balance: balanceAtThisPoint, // The 100% correct chronological balance
                        weight: weight,
                        unitPrice: unitPrice
                    });
                }
            }
        });

        // Prepend opening balance row if there is a start date filter or a specific financial year selected
        if (dateRange.from || (financialYear && financialYear !== 'all')) {
            visibleRows.unshift({
                id: 'opening-balance',
                date: '',
                number: '-',
                type: 'OPENING',
                description: dateRange.from 
                    ? 'انتقال از دوره قبل (مانده قبلی)' 
                    : 'مانده انتقالی از سال مالی قبل (افتتاحیه)',
                in: 0,
                out: 0,
                balance: openingBalance,
                weight: 0,
                unitPrice: 0
            });
        }

        return visibleRows;
    }, [transactions, allTransactions, financialYear, selectedCompany, selectedItem, dateRange, txType]);

    const activeItemName = items.find(i => i.id === selectedItem)?.name || '-';
    const elementId = 'kardex-print-area';

    const handlePrint = () => {
        setIsGenerating(true);
        const style = document.getElementById('page-size-style');
        if (style) {
            style.innerHTML = `
              @page { size: A4 portrait; margin: 0; }
              @media print {
                  body * { visibility: hidden; }
                  #${elementId}, #${elementId} * { visibility: visible; }
                  #${elementId} { 
                      position: absolute; 
                      left: 0; 
                      top: 0; 
                      width: 210mm !important; 
                      margin: 0 !important;
                      padding: 10mm !important;
                      border: none !important;
                      box-shadow: none !important;
                  }
                  .no-print { display: none !important; }
              }
            `;
        }
        setTimeout(() => {
            window.print();
            setIsGenerating(false);
        }, 500);
    };

    const handleDownloadPDF = async () => {
        setIsGenerating(true);
        await generatePdf({
            elementId: elementId,
            filename: `Kardex_${activeItemName}_${new Date().toISOString().slice(0,10)}.pdf`,
            format: 'A4',
            orientation: 'portrait',
            onComplete: () => setIsGenerating(false),
            onError: () => { alert('خطا در ایجاد PDF'); setIsGenerating(false); }
        });
    };

    const content = (
        <div id={elementId} className="printable-content glass-panel p-8 shadow-lg text-black" 
            style={{
                width: '210mm', 
                minHeight: '297mm', 
                direction: 'rtl',
                padding: '10mm',
                boxSizing: 'border-box'
            }}>
            
            <div className="header text-center mb-5 border-b-2 border-black pb-2">
                <h2 className="text-xl font-black mb-1">کاردکس تعدادی کالا</h2>
                <p className="text-sm text-gray-600">گزارش گردش انبار</p>
            </div>

            <div className="meta bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 p-2 rounded border border-gray-300 flex justify-between mb-2 text-xs font-bold">
                <div>شرکت: {selectedCompany}</div>
                <div>کالا: {activeItemName}</div>
                <div>تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</div>
            </div>

            <table className="w-full border-collapse text-center text-[10px]">
                <thead>
                    <tr className="bg-gray-800 text-white text-[9px]">
                        <th className="p-2 border border-gray-600">ردیف</th>
                        <th className="p-2 border border-gray-600">تاریخ</th>
                        <th className="p-2 border border-gray-600">نوع</th>
                        <th className="p-2 border border-gray-600">شماره سند</th>
                        <th className="p-2 border border-gray-600 w-1/4">شرح / طرف حساب</th>
                        <th className="p-2 border border-gray-600 bg-green-700">وارده</th>
                        <th className="p-2 border border-gray-600 bg-red-700">صادره</th>
                        <th className="p-2 border border-gray-600 bg-blue-800">مانده</th>
                        <th className="p-2 border border-gray-600 bg-amber-700">فی (ریال)</th>
                    </tr>
                </thead>
                <tbody>
                    {kardexRows.length === 0 ? (
                        <tr><td colSpan={9} className="p-4 text-gray-400 border border-gray-300">گردشی برای این کالا یافت نشد.</td></tr>
                    ) : (
                        kardexRows.map((row, idx) => {
                            if (row.type === 'OPENING') {
                                return (
                                    <tr key={row.id} className="bg-blue-50/50 text-blue-900 font-bold">
                                        <td className="border border-gray-300 p-1">{idx + 1}</td>
                                        <td className="border border-gray-300 p-1 font-mono text-[9px]">-</td>
                                        <td className="border border-gray-300 p-1 text-center">
                                            <span className="text-blue-700 font-black">مانده قبلی</span>
                                        </td>
                                        <td className="border border-gray-300 p-1 font-mono">-</td>
                                        <td className="border border-gray-300 p-1 text-right pr-2 text-[9px] font-sans">{row.description}</td>
                                        <td className="border border-gray-300 p-1 font-mono font-bold text-gray-400">-</td>
                                        <td className="border border-gray-300 p-1 font-mono font-bold text-gray-400">-</td>
                                        <td className="border border-gray-300 p-1 balance bg-blue-100/50 text-blue-800 text-base font-bold">{row.balance}</td>
                                        <td className="border border-gray-300 p-1 font-mono text-gray-400">-</td>
                                    </tr>
                                );
                            }
                            return (
                                <tr key={row.id} className={row.type === 'IN' ? 'bg-green-50' : 'bg-red-50'}>
                                    <td className="border border-gray-300 p-1">{idx + 1}</td>
                                    <td className="border border-gray-300 p-1 font-mono text-[9px]">{formatDate(row.date)}</td>
                                    <td className="border border-gray-300 p-1">{row.type === 'IN' ? <span className="text-green-700 font-bold flex items-center justify-center gap-1"><ArrowDownCircle size={10}/> ورود</span> : <span className="text-red-700 font-bold flex items-center justify-center gap-1"><ArrowUpCircle size={10}/> خروج</span>}</td>
                                    <td className="border border-gray-300 p-1 font-mono font-bold">{row.number}</td>
                                    <td className="border border-gray-300 p-1 text-right pr-2 text-[9px]">{row.description}</td>
                                    <td className="border border-gray-300 p-1 font-mono font-bold text-green-700 text-base">{row.in > 0 ? row.in : '-'}</td>
                                    <td className="border border-gray-300 p-1 font-mono font-bold text-red-700 text-base">{row.out > 0 ? row.out : '-'}</td>
                                    <td className="border border-gray-300 p-1 balance bg-gray-100 text-blue-800 text-base font-bold">{row.balance}</td>
                                    <td className="border border-gray-300 p-1 font-mono text-amber-800 font-bold">{row.unitPrice ? formatNumberString(row.unitPrice) : '-'}</td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
                <tfoot>
                    <tr className="bg-gray-800 text-white font-bold">
                        <td colSpan={5} className="p-2 text-left pl-4 border border-gray-600">جمع کل</td>
                        <td className="p-2 dir-ltr font-mono border border-gray-600">{kardexRows.reduce((a,b)=>a+b.in,0)}</td>
                        <td className="p-2 dir-ltr font-mono border border-gray-600">{kardexRows.reduce((a,b)=>a+b.out,0)}</td>
                        <td className="p-2 dir-ltr font-mono bg-blue-900 border border-gray-600">{kardexRows.length > 0 ? kardexRows[kardexRows.length-1].balance : 0}</td>
                        <td className="p-2 border border-gray-600 bg-amber-900"></td>
                    </tr>
                </tfoot>
            </table>

            <div className="mt-8 pt-4 border-t border-black flex justify-between text-[10px] text-gray-500">
                <div>امضاء انباردار</div>
                <div>امضاء مدیر انبار</div>
                <div>سیستم مدیریت هوشمند انبار</div>
            </div>
        </div>
    );

    return (
        <div className="space-y-4 h-full flex flex-col">
            {/* Filter Bar (Same as before) */}
            <div className="glass-panel p-4 rounded-xl border border-gray-200/50 dark:border-white/10 shadow-sm flex flex-col md:flex-row gap-4 items-end no-print">
                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">شرکت</label>
                        <select className="w-full border rounded p-2 text-sm" value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                            {companies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">کالا</label>
                        <select className="w-full border rounded p-2 text-sm" value={selectedItem} onChange={e => setSelectedItem(e.target.value)}>
                            {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">نوع تراکنش</label>
                        <select className="w-full border rounded p-2 text-sm" value={txType} onChange={e => setTxType(e.target.value as any)}>
                            <option value="ALL">همه (ورود و خروج)</option>
                            <option value="IN">فقط ورودی</option>
                            <option value="OUT">فقط خروجی</option>
                        </select>
                    </div>
                    <div className="flex gap-1">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-500 block mb-1">از تاریخ</label>
                            <input className="w-full border rounded p-2 text-sm dir-ltr" placeholder="1403/01/01" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-gray-500 block mb-1">تا تاریخ</label>
                            <input className="w-full border rounded p-2 text-sm dir-ltr" placeholder="1403/12/29" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} />
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleDownloadPDF} disabled={isGenerating} className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 text-sm h-[38px]">
                        {isGenerating ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>} PDF
                    </button>
                    <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 text-sm h-[38px]">
                        <Printer size={16}/> چاپ
                    </button>
                </div>
            </div>

            {/* Responsive Container for Scaling */}
            <div className="flex-1 bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 border rounded-xl overflow-hidden relative">
                <div className="absolute inset-0 overflow-auto flex justify-center p-4" ref={containerWrapperRef}>
                     <div style={{ 
                        width: '210mm', 
                        minHeight: '297mm',
                        backgroundColor: 'white',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        transform: `scale(${scale})`,
                        transformOrigin: 'top center',
                        marginBottom: `${(1 - scale) * -100}px` 
                    }}>
                        {content}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WarehouseKardexReport;
