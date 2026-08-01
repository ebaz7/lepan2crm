import React, { useState, useEffect, useRef } from 'react';
import { TradeRecord, TradeStage } from '../../types';
import { formatNumberString, deformatNumberString, parsePersianDate, getCurrentShamsiDate, formatCurrency } from '../../constants';
import { FileSpreadsheet, Printer, FileDown, Filter, RefreshCw, X, Loader2, Eye, LayoutGrid, Smartphone, ChevronLeft, ChevronRight, CheckCircle2, Clock, Info, HelpCircle, Activity, DollarSign, Building2, Coins, ArrowLeftRight } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
// from '../../utils/pdfGenerator'; 

interface CurrencyReportProps {
    records: TradeRecord[];
    onSelectTranche?: (recordId: string, trancheId?: string | null) => void;
}

interface ExchangeRates {
    eurToUsd: number;
    aedToUsd: number;
    cnyToUsd: number;
    tryToUsd: number;
}

const STORAGE_KEY_RATES = 'currency_report_rates_v1';

const CurrencyReport: React.FC<CurrencyReportProps> = ({ records, onSelectTranche }) => {
    // -- State --
    const [viewMode, setViewMode] = useState<'web' | 'print'>('web');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [rates, setRates] = useState<ExchangeRates>({
        eurToUsd: 1.08,
        aedToUsd: 0.272,
        cnyToUsd: 0.14,
        tryToUsd: 0.03
    });
    
    const [selectedYear, setSelectedYear] = useState<number>(getCurrentShamsiDate().year);
    const [searchTerm, setSearchTerm] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [showRates, setShowRates] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Selected Row Detail (Smart Feature for Mobile View)
    const [selectedRowDetail, setSelectedRowDetail] = useState<{
        group: any;
        tranche: any;
        index: number;
    } | null>(null);

    // Scaling State
    const [scale, setScale] = useState(1);
    const containerWrapperRef = useRef<HTMLDivElement>(null);

    // Advanced Filters
    const [filters, setFilters] = useState({
        company: '',
        bank: '',
        currencyType: '',
        archiveStatus: 'active' as 'active' | 'archive' | 'all' 
    });

    const availableCompanies = Array.from(new Set(records.map(r => r.company).filter(Boolean)));
    const availableBanks = Array.from(new Set(records.map(r => r.operatingBank).filter(Boolean)));
    const years = Array.from({ length: 5 }, (_, i) => getCurrentShamsiDate().year - 2 + i);

    useEffect(() => {
        const savedRates = localStorage.getItem(STORAGE_KEY_RATES);
        if (savedRates) setRates(JSON.parse(savedRates));
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify(rates));
    }, [rates]);

    // Auto-Scale Logic (Only for A4 emulation view)
    useEffect(() => {
        const handleResize = () => {
            const wrapper = containerWrapperRef.current;
            if (wrapper) {
                const wrapperWidth = wrapper.clientWidth;
                const targetWidth = 1100; // A4 Landscape
                
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
    }, [viewMode]);

    const getWeeksPassed = (year: number) => {
        const currentShamsi = getCurrentShamsiDate();
        if (year < currentShamsi.year) return 52;
        if (year > currentShamsi.year) return 0;
        let totalDays = 0;
        for (let m = 1; m < currentShamsi.month; m++) { totalDays += (m <= 6 ? 31 : 30); }
        totalDays += currentShamsi.day;
        const weeks = totalDays / 7;
        return weeks > 0 ? weeks : 1; 
    };

    const weeksPassed = getWeeksPassed(selectedYear);

    // processedGroups filters and processes raw trade records into tranches
    const processedGroups = React.useMemo(() => {
        const groups: any[] = [];
        records.forEach(r => {
            if (filters.archiveStatus === 'active' && (r.status === 'Completed' || r.isArchived)) return;
            if (filters.archiveStatus === 'archive' && !(r.status === 'Completed' || r.isArchived)) return;
            if (filters.company && r.company !== filters.company) return;
            if (filters.bank && r.operatingBank !== filters.bank) return;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matches = r.fileNumber.toLowerCase().includes(term) || r.goodsName.toLowerCase().includes(term) || r.company.toLowerCase().includes(term) || r.currencyPurchaseData?.exchangeName?.includes(term);
                if (!matches) return;
            }

            const tranches = r.currencyPurchaseData?.tranches || [];
            const recordTranches: any[] = [];

            if (tranches.length === 0 && (r.currencyPurchaseData?.purchasedAmount || 0) > 0) {
                const pDate = r.currencyPurchaseData?.purchaseDate;
                if (pDate && parseInt(pDate.split('/')[0]) === selectedYear) {
                    const cType = r.currencyPurchaseData?.purchasedCurrencyType || r.mainCurrency || 'EUR';
                    if (filters.currencyType && cType !== filters.currencyType) return;
                    let usdRate = 1;
                    if (cType === 'EUR') usdRate = rates.eurToUsd;
                    else if (cType === 'AED') usdRate = rates.aedToUsd;
                    else if (cType === 'CNY') usdRate = rates.cnyToUsd;
                    else if (cType === 'TRY') usdRate = rates.tryToUsd;

                    recordTranches.push({
                        id: 'main',
                        currencyType: cType,
                        originalAmount: r.currencyPurchaseData?.purchasedAmount || 0,
                        usdAmount: (r.currencyPurchaseData?.purchasedAmount || 0) * usdRate,
                        purchaseDate: pDate,
                        rialAmount: r.stages[TradeStage.CURRENCY_PURCHASE]?.costRial || 0,
                        exchangeName: r.currencyPurchaseData?.exchangeName || '-',
                        brokerName: r.currencyPurchaseData?.brokerName || '-',
                        isDelivered: r.currencyPurchaseData?.isDelivered,
                        deliveredAmount: r.currencyPurchaseData?.deliveredAmount || 0,
                        returnAmount: 0,
                        returnDate: '-'
                    });
                }
            } else {
                tranches.forEach(t => {
                    const pDate = t.date;
                    if (pDate && parseInt(pDate.split('/')[0]) === selectedYear) {
                        if (filters.currencyType && t.currencyType !== filters.currencyType) return;
                        let usdRate = 1;
                        if (t.currencyType === 'EUR') usdRate = rates.eurToUsd;
                        else if (t.currencyType === 'AED') usdRate = rates.aedToUsd;
                        else if (t.currencyType === 'CNY') usdRate = rates.cnyToUsd;
                        else if (t.currencyType === 'TRY') usdRate = rates.tryToUsd;

                        const trancheDeliveredAmount = (t.deliveries && t.deliveries.length > 0) 
                            ? t.deliveries.reduce((sum: number, d: any) => sum + d.amount, 0) 
                            : (t.receivedAmount || (t.isDelivered ? t.amount : 0));

                        recordTranches.push({
                            id: t.id,
                            currencyType: t.currencyType,
                            originalAmount: t.amount,
                            usdAmount: t.amount * usdRate,
                            purchaseDate: t.date,
                            rialAmount: t.rialAmount || (t.amount * (t.rate || 0)),
                            exchangeName: t.exchangeName || '-',
                            brokerName: t.brokerName || '-',
                            isDelivered: t.isDelivered,
                            deliveredAmount: trancheDeliveredAmount,
                            // @ts-ignore
                            returnAmount: t.returnAmount || 0,
                            // @ts-ignore
                            returnDate: t.returnDate || '-'
                        });
                    }
                });
            }

            if (recordTranches.length > 0) {
                groups.push({
                    recordInfo: { recordId: r.id, goodsName: r.goodsName, fileNumber: r.fileNumber, orderNumber: r.orderNumber || r.fileNumber, registrationNumber: r.registrationNumber, company: r.company, bank: r.operatingBank },
                    tranches: recordTranches
                });
            }
        });
        return groups;
    }, [records, filters, searchTerm, rates, selectedYear]);

    const tableTotals = processedGroups.reduce((acc, group) => {
        group.tranches.forEach((t: any) => { 
            acc.usd += t.usdAmount; 
            acc.original += t.originalAmount; 
            acc.rial += t.rialAmount; 
            acc.delivered += t.deliveredAmount || 0;
        });
        return acc;
    }, { usd: 0, original: 0, rial: 0, delivered: 0 });

    const elementId = 'currency-report-print-area';

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        setIsGeneratingPdf(true);
        await generatePdf({
            elementId: elementId,
            filename: `Currency_Report_${selectedYear}.pdf`,
            format: 'A4',
            orientation: 'landscape',
            onComplete: () => setIsGeneratingPdf(false),
            onError: () => { alert('خطا در ایجاد PDF'); setIsGeneratingPdf(false); }
        });
    };

    const handleExportExcel = () => {
        const headers = ["ردیف", "شرح کالا", "شماره سفارش (پرونده)", "شماره ثبت سفارش", "نام شرکت", "دلار آمریکا (معادل)", "مقدار ارز", "نوع ارز", "تاریخ خرید ارز", "ارز خریداری شده (ریال)", "محل ارسال (صرافی)", "کارگزار", "ارز موجود نزد هر بانک", "مقدار تحویل شده", "وضعیت", "مبلغ عودت", "تاریخ عودت"];
        const rows = [headers.join(",")];
        let idx = 1;
        processedGroups.forEach(g => {
            g.tranches.forEach((t: any) => {
                rows.push(`${idx},"${g.recordInfo.goodsName}","${g.recordInfo.fileNumber}","${g.recordInfo.registrationNumber || '-'}","${g.recordInfo.company}",${t.usdAmount},${t.originalAmount},"${t.currencyType}","${t.purchaseDate}",${t.rialAmount},"${t.exchangeName}","${t.brokerName}","${g.recordInfo.bank}",${t.deliveredAmount},"${t.isDelivered ? 'تحویل شده' : 'انتظار'}",${t.returnAmount},"${t.returnDate}"`);
                idx++;
            });
        });
        const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Currency_Report_${selectedYear}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatUSD = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    const setRatesVal = (key: keyof ExchangeRates) => (e: React.ChangeEvent<HTMLInputElement>) => {
        setRates(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }));
    };

    // A4 Landscape Print View Content
    const printContent = (
        <div id={elementId} className="printable-content p-4 text-black text-[10px] relative border-black" 
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
            <div className="border border-black mb-1 text-center text-black">
                <div className="bg-gray-100 font-black py-2 border-b border-black text-sm text-black">
                    گزارش جامع خرید ارز - سال {selectedYear}
                </div>
                <div className="flex justify-between px-2 py-1 font-bold text-black text-[9px]">
                    <span>تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</span>
                    {filters.company && <span>شرکت: {filters.company}</span>}
                    {filters.bank && <span>بانک عامل: {filters.bank}</span>}
                </div>
            </div>

            {/* Main Table */}
            <table className="w-full border-collapse border border-black text-center mb-4 text-black table-fixed">
                <colgroup>
                    <col style={{width: '30px'}} /> {/* Row */}
                    <col /> {/* Goods */}
                    <col style={{width: '75px'}} /> {/* File No */}
                    <col style={{width: '75px'}} /> {/* Reg No */}
                    <col style={{width: '85px'}} /> {/* Company */}
                    <col style={{width: '65px'}} /> {/* USD */}
                    <col style={{width: '65px'}} /> {/* Orig Amount */}
                    <col style={{width: '40px'}} /> {/* Currency */}
                    <col style={{width: '65px'}} /> {/* Date */}
                    <col style={{width: '85px'}} /> {/* Rial */}
                    <col style={{width: '70px'}} /> {/* Exchange */}
                    <col style={{width: '65px'}} /> {/* Broker */}
                    <col style={{width: '75px'}} /> {/* Bank */}
                    <col style={{width: '65px'}} /> {/* Delivered */}
                    <col style={{width: '45px'}} /> {/* Status */}
                    <col style={{width: '75px'}} /> {/* Return Amt */}
                    <col style={{width: '65px'}} /> {/* Return Date */}
                </colgroup>
                <thead>
                    <tr className="bg-gray-100 text-black text-[9px] h-10 select-none">
                        <th className="border border-black p-1 font-black text-center bg-gray-100 text-black">ردیف</th>
                        <th className="border border-black p-1 font-black text-center bg-gray-100 text-black">شرح کالا</th>
                        <th className="border border-black p-1 font-black text-center bg-gray-100 text-black">شماره سفارش (پرونده)</th>
                        <th className="border border-black p-1 font-black text-center bg-gray-100 text-black">ثبت سفارش</th>
                        <th className="border border-black p-1 font-black text-center bg-gray-100 text-black">نام شرکت</th>
                        <th className="border border-black p-1 font-black text-center bg-blue-100/50 text-black">ارز (دلار آمریکا)</th>
                        <th className="border border-black p-1 font-black text-center bg-blue-100/50 text-black">ارز (مقدار)</th>
                        <th className="border border-black p-1 font-black text-center bg-blue-100/50 text-black">ارز (نوع)</th>
                        <th className="border border-black p-1 font-black text-center bg-gray-100 text-black">تاریخ خرید</th>
                        <th className="border border-black p-1 font-black text-center bg-gray-100 text-black">بهای ارز (ریال)</th>
                        <th className="border border-black p-1 font-black text-center bg-gray-100 text-black">محل ارسال</th>
                        <th className="border border-black p-1 font-black text-center bg-gray-100 text-black">کارگزار</th>
                        <th className="border border-black p-1 font-black text-center bg-gray-100 text-black">بانک عامل</th>
                        <th className="border border-black p-1 font-black text-center bg-green-100/50 text-black">مقدار تحویل</th>
                        <th className="border border-black p-1 font-black text-center bg-green-100/50 text-black">وضعیت تصفیه</th>
                        <th className="border border-black p-1 font-black text-center bg-red-100/50 text-black">مبلغ عودتی</th>
                        <th className="border border-black p-1 font-black text-center bg-red-100/50 text-black">تاریخ عودتی</th>
                    </tr>
                </thead>
                <tbody>
                    {processedGroups.map((group, gIndex) => (
                        <React.Fragment key={gIndex}>
                            {group.tranches.map((t: any, tIndex: number) => (
                                <tr key={`${gIndex}_${tIndex}`} className="bg-white text-gray-800 leading-tight text-black text-[9px]">
                                    {/* Row Span Logic: Only render details on first tranche */}
                                    {tIndex === 0 && (
                                        <>
                                            <td className="border border-black p-1 text-center font-bold text-black" rowSpan={group.tranches.length}>{gIndex + 1}</td>
                                            <td className="border border-black p-1 text-right truncate font-bold text-black" rowSpan={group.tranches.length} title={group.recordInfo.goodsName}>{group.recordInfo.goodsName}</td>
                                            <td className="border border-black p-1 font-mono font-bold text-center text-black" rowSpan={group.tranches.length}>{group.recordInfo.fileNumber}</td>
                                            <td className="border border-black p-1 font-mono text-center text-black" rowSpan={group.tranches.length}>{group.recordInfo.registrationNumber || '-'}</td>
                                            <td className="border border-black p-1 text-center font-bold text-black" rowSpan={group.tranches.length}>{group.recordInfo.company}</td>
                                        </>
                                    )}
                                    
                                    <td className="border border-black p-1 font-mono font-black bg-blue-50/50 text-center text-black">{formatUSD(t.usdAmount)}</td>
                                    <td className="border border-black p-1 font-mono font-bold text-center text-black">{formatNumberString(t.originalAmount)}</td>
                                    <td className="border border-black p-1 text-center font-bold text-black">{t.currencyType}</td>
                                    <td className="border border-black p-1 dir-ltr text-center font-bold text-black">{t.purchaseDate}</td>
                                    <td className="border border-black p-1 font-mono text-center font-bold text-black">{t.rialAmount > 0 ? formatNumberString(t.rialAmount) : '-'}</td>
                                    <td className="border border-black p-1 text-[9px] truncate text-center font-bold text-black" title={t.exchangeName}>{t.exchangeName}</td>
                                    <td className="border border-black p-1 font-mono text-[9px] text-center font-bold text-black">{t.brokerName}</td> 
                                    
                                    {tIndex === 0 && <td className="border border-black p-1 text-center font-bold text-black" rowSpan={group.tranches.length}>{group.recordInfo.bank}</td>}
                                    
                                    <td className="border border-black p-1 font-mono bg-green-50/50 text-center font-black text-black">{formatNumberString(t.deliveredAmount)}</td>
                                    <td className="border border-black p-1 text-center font-bold text-black">{t.isDelivered ? '✅' : '⏳'}</td>
                                    <td className="border border-black p-1 bg-red-50/50 text-center font-black text-black">{t.returnAmount > 0 ? formatNumberString(t.returnAmount) : '-'}</td>
                                    <td className="border border-black p-1 bg-red-50/50 text-center font-bold text-black">{t.returnDate}</td>
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                    {processedGroups.length === 0 && (
                        <tr><td colSpan={17} className="border border-black p-4 text-gray-400 font-bold text-center">اطلاعاتی یافت نشد</td></tr>
                    )}
                    <tr className="bg-gray-100 font-black text-[9px] text-black">
                        <td colSpan={5} className="border border-black p-1 text-center bg-gray-200 text-black">جمع کل</td>
                        <td className="border border-black p-1 dir-ltr text-center bg-gray-200 text-black">{formatUSD(tableTotals.usd)}</td>
                        <td className="border border-black p-1 dir-ltr text-center bg-gray-200 text-black">{formatNumberString(tableTotals.original)}</td>
                        <td className="border border-black p-1 bg-gray-200 text-black">-</td>
                        <td className="border border-black p-1 bg-gray-200 text-black">-</td>
                        <td className="border border-black p-1 dir-ltr text-center bg-gray-200 text-black">{formatNumberString(tableTotals.rial)}</td>
                        <td colSpan={3} className="border border-black p-1 bg-gray-200 text-black"></td>
                        <td className="border border-black p-1 font-mono bg-green-100/50 text-center font-black text-black">{formatNumberString(tableTotals.delivered)}</td>
                        <td colSpan={3} className="border border-black p-1 bg-gray-200 text-black"></td>
                    </tr>
                </tbody>
            </table>
        </div>
    );

    // Dynamic Row indexer counter helper for Web Layout 
    let globalWebRowIdx = 1;

    return (
        <div id="currency-report-screen-area" className="w-full h-full flex flex-col p-2 md:p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
            {/* Top Toolbar controls */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-4 shadow-sm z-30 no-print">
                <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-center">
                    {/* View Modes Segment Controllers & Title */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
                        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 rounded-xl">
                            <button 
                                onClick={() => setViewMode('web')}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'web' ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                            >
                                <LayoutGrid size={14} />
                                🖥️ نمایش هوشمند (وب و گوشی)
                            </button>
                            <button 
                                onClick={() => setViewMode('print')}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black transition-all ${viewMode === 'print' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                            >
                                <Eye size={14} />
                                📄 پیش‌نمایش چاپی (A4)
                            </button>
                        </div>
                        <div className="text-slate-400 text-xs hidden sm:block">|</div>
                        <span className="text-xs font-extrabold text-slate-500 bg-slate-50 dark:bg-slate-950/40 px-3 py-1.5 border border-slate-100 dark:border-slate-800 rounded-lg">
                            🔍 یافت شده: <span className="font-mono font-black text-slate-800 dark:text-white">{processedGroups.length}</span> پرونده
                        </span>
                    </div>

                    {/* PDF/Excel Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button 
                            onClick={handleExportExcel} 
                            className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-heavy px-4 py-2 rounded-xl flex items-center gap-2 text-xs transition-all shadow-sm"
                        >
                            <FileSpreadsheet size={15}/> خروجی اکسل
                        </button>
                        <button 
                            onClick={handleDownloadPDF} 
                            disabled={isGeneratingPdf} 
                            className="bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:bg-slate-300 text-white font-heavy px-4 py-2 rounded-xl flex items-center gap-2 text-xs transition-all shadow-sm"
                        >
                            {isGeneratingPdf ? <Loader2 size={15} className="animate-spin"/> : <FileDown size={15}/>} 
                            دانلود PDF
                        </button>
                        <button 
                            onClick={handlePrint} 
                            className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-heavy px-4 py-2 rounded-xl flex items-center gap-2 text-xs transition-all shadow-sm"
                        >
                            <Printer size={15}/> چاپ مستقیم
                        </button>
                    </div>
                </div>

                {/* Search & Setup triggers toolbar */}
                <div className="flex flex-col sm:flex-row items-center gap-3 mt-4">
                    {/* Search Field */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl flex-1 w-full">
                        <span className="text-xs font-bold text-slate-400">جستجو:</span>
                        <input 
                            type="text" 
                            className="bg-transparent text-sm font-bold outline-none flex-1 w-full text-right" 
                            placeholder="نام کالا، شماره سفارش پرونده، نام شرکت یا صرافی حواله‌گر..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="p-1 rounded bg-slate-200 text-slate-500 hover:bg-slate-300">
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                        {/* Financial Year Selector */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold cursor-pointer">
                            <span className="text-slate-400">سال مالی:</span>
                            <select 
                                className="bg-transparent text-xs font-black outline-none" 
                                value={selectedYear} 
                                onChange={e => setSelectedYear(Number(e.target.value))}
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>

                        {/* Toggle Advanced Filters Button */}
                        <button 
                            onClick={() => setShowFilters(!showFilters)} 
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${showFilters ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 dark:bg-slate-950/50 dark:border-slate-800'}`}
                        >
                            <Filter size={14}/> 
                            فیلترهای پیشرفته
                        </button>

                        {/* Toggle Exchange Rates Button */}
                        <button 
                            onClick={() => setShowRates(!showRates)} 
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${showRates ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 dark:bg-slate-950/50 dark:border-slate-800'}`}
                        >
                            <RefreshCw size={14}/> 
                            نرخ مبادله ارزها
                        </button>
                    </div>
                </div>

                {/* Advanced Filters Drawer Panel */}
                {showFilters && (
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                        {/* Company selector */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-black text-slate-500">فیلتر شرکت متقاضی:</span>
                            <select 
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs font-black outline-none cursor-pointer focus:border-blue-500"
                                value={filters.company}
                                onChange={e => setFilters({...filters, company: e.target.value})}
                            >
                                <option value="">همه شرکت‌ها (بدون فیلتر)</option>
                                {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* Bank selector */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-black text-slate-500">بانک عامل درخواست‌کننده:</span>
                            <select 
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs font-black outline-none cursor-pointer focus:border-blue-500"
                                value={filters.bank}
                                onChange={e => setFilters({...filters, bank: e.target.value})}
                            >
                                <option value="">همه بانک‌ها (بدون فیلتر)</option>
                                {availableBanks.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>

                        {/* Currency selector */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-black text-slate-500">نوع ارز واسط خرید:</span>
                            <select 
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs font-black outline-none cursor-pointer focus:border-blue-500"
                                value={filters.currencyType}
                                onChange={e => setFilters({...filters, currencyType: e.target.value})}
                            >
                                <option value="">تمام انواع ارز</option>
                                <option value="EUR">یورو (EUR)</option>
                                <option value="USD">دلار آمریکا (USD)</option>
                                <option value="AED">درهم امارات (AED)</option>
                                <option value="CNY">یوان چین (CNY)</option>
                                <option value="TRY">لیر ترکیه (TRY)</option>
                            </select>
                        </div>

                        {/* System Archive statuses */}
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-black text-slate-500">وضعیت گردش کار پرونده:</span>
                            <select 
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 text-xs font-black outline-none cursor-pointer focus:border-blue-500"
                                value={filters.archiveStatus}
                                onChange={e => setFilters({...filters, archiveStatus: e.target.value as any})}
                            >
                                <option value="active">پرونده‌های فعال جریان‌کار</option>
                                <option value="archive">پرونده‌های ترخیص شده و بایگانی</option>
                                <option value="all">کلیه پرونده‌ها (بایگانی + فعال)</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* Statistical Conversion Rates Settings panel */}
                {showRates && (
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl animate-fade-in animate-slide-down">
                        <div className="text-xs font-black text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-1.5">
                            <RefreshCw size={13} className="text-indigo-500 animate-spin-slow" />
                            <span>تنظیم دستی نرخ‌های تبدیل آماری به دلار آمریکا (تولید ارزش دلاری معادل):</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl">
                                <span className="text-xs font-extrabold text-blue-500 font-mono">EUR to USD</span>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    className="w-16 bg-slate-50 dark:bg-slate-950 rounded py-1 px-1.5 text-xs text-center font-black" 
                                    value={rates.eurToUsd} 
                                    onChange={e => setRates({...rates, eurToUsd: parseFloat(e.target.value) || 0})}
                                />
                            </div>
                            <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl">
                                <span className="text-xs font-extrabold text-green-500 font-mono">AED to USD</span>
                                <input 
                                    type="number" 
                                    step="0.001" 
                                    className="w-16 bg-slate-50 dark:bg-slate-950 rounded py-1 px-1.5 text-xs text-center font-black" 
                                    value={rates.aedToUsd} 
                                    onChange={setRatesVal('aedToUsd')}
                                />
                            </div>
                            <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl">
                                <span className="text-xs font-extrabold text-amber-500 font-mono">CNY to USD</span>
                                <input 
                                    type="number" 
                                    step="0.001" 
                                    className="w-16 bg-slate-50 dark:bg-slate-950 rounded py-1 px-1.5 text-xs text-center font-black" 
                                    value={rates.cnyToUsd} 
                                    onChange={setRatesVal('cnyToUsd')}
                                />
                            </div>
                            <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl">
                                <span className="text-xs font-extrabold text-red-500 font-mono">TRY to USD</span>
                                <input 
                                    type="number" 
                                    step="0.001" 
                                    className="w-16 bg-slate-50 dark:bg-slate-950 rounded py-1 px-1.5 text-xs text-center font-black" 
                                    value={rates.tryToUsd} 
                                    onChange={setRatesVal('tryToUsd')}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- PRIMARY WEB VIEW (SPACIOUS RESPONSIVE DASHBOARD MODE) --- */}
            {viewMode === 'web' && (
                <div className="flex-1 overflow-hidden flex flex-col w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 md:p-5 shadow-sm">
                    {/* Header statistics info strip */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 mb-4 rounded-xl bg-gradient-to-l from-blue-50 to-indigo-50/20 dark:from-blue-950/10 dark:to-slate-900 border border-blue-100/30 dark:border-blue-900/10 gap-3">
                        <div className="text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Activity size={18} className="text-blue-600 animate-pulse" />
                            <div>
                                <h4 className="text-xs font-black">داشبورد گزارشات مالی خرید و تدارکات ارزی</h4>
                                <p className="text-[10px] text-slate-500 font-medium">مجموع آمار خریدهای سال مالی {selectedYear} بر اساس معادل‌سازی واقعی</p>
                            </div>
                        </div>
                        <div className="flex gap-4 font-mono select-none">
                            <div className="text-right">
                                <span className="text-[10px] text-slate-500 block">جمع کل دلار (USD)</span>
                                <span className="text-sm font-black text-blue-700 dark:text-blue-400">{formatUSD(tableTotals.usd)} $</span>
                            </div>
                            <div className="text-right border-r pr-4 border-slate-200 dark:border-slate-800">
                                <span className="text-[10px] text-slate-500 block">جمع کل ریال (Rial)</span>
                                <span className="text-sm font-black text-indigo-700 dark:text-indigo-400">{formatNumberString(tableTotals.rial)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Scroll Assist Hint */}
                    <div className="sm:hidden text-[10px] pb-2 font-bold text-blue-500 text-center flex items-center justify-center gap-1">
                        <span>💡 برای مشاهده بقیه ستون‌ها، جدول را به چپ و راست اسکرول کنید.</span>
                    </div>

                    {/* Widescreen Responsive Data Table */}
                    <div className="flex-1 overflow-auto rounded-xl border border-slate-100 dark:border-slate-800 custom-scrollbar relative">
                        <table className="w-full border-collapse text-right text-xs">
                            <thead>
                                <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-extrabold border-b border-slate-200 dark:border-slate-800 shrink-0 select-none">
                                    <th className="p-3.5 text-center w-12 sticky right-0 bg-slate-100 dark:bg-slate-800 z-20 shadow-sm">ردیف</th>
                                    <th className="p-3.5 text-right min-w-[190px] sticky right-12 bg-slate-100 dark:bg-slate-800 z-20 shadow-sm">شرح کالا</th>
                                    <th className="p-3.5 text-center min-w-[110px]">شماره سفارش پرونده</th>
                                    <th className="p-3.5 text-center min-w-[110px]">ثبت سفارش</th>
                                    <th className="p-3.5 text-center min-w-[120px]">نام شرکت</th>
                                    <th className="p-3.5 text-center min-w-[125px] bg-blue-50/40 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300">معادل دلار آمریکا</th>
                                    <th className="p-3.5 text-center min-w-[115px] bg-blue-50/40 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300">مقدار ارز</th>
                                    <th className="p-3.5 text-center min-w-[65px] bg-blue-50/40 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300">نوع ارز</th>
                                    <th className="p-3.5 text-center min-w-[105px] font-sans">تاریخ خرید</th>
                                    <th className="p-3.5 text-center min-w-[135px]">ارز خریداری شده (ریال)</th>
                                    <th className="p-3.5 text-center min-w-[115px]">صرافی عامل</th>
                                    <th className="p-3.5 text-center min-w-[115px]">کارگزار</th>
                                    <th className="p-3.5 text-center min-w-[125px]">بانک عامل</th>
                                    <th className="p-3.5 text-center min-w-[125px] bg-green-50/40 dark:bg-green-950/20 text-green-800 dark:text-green-300">مقدار تحویل شده</th>
                                    <th className="p-3.5 text-center min-w-[65px] bg-green-50/40 dark:bg-green-950/20 text-green-800 dark:text-green-300">وضعیت</th>
                                    <th className="p-3.5 text-center min-w-[115px] bg-red-50/40 dark:bg-red-950/20 text-red-800 dark:text-red-300">مبلغ عودت</th>
                                    <th className="p-3.5 text-center min-w-[105px] bg-red-50/40 dark:bg-red-950/20 text-red-800 dark:text-red-300 font-sans">تاریخ عودت</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                {processedGroups.map((group, gIndex) => {
                                    const groupRowSpan = group.tranches.length;
                                    return (
                                        <React.Fragment key={`web_${gIndex}`}>
                                            {group.tranches.map((t: any, tIndex: number) => {
                                                const currentIdx = globalWebRowIdx++;
                                                return (
                                                    <tr 
                                                        key={`web_row_${gIndex}_${tIndex}`} 
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
                                                        
                                                        <td className="p-3 text-center font-mono font-black bg-blue-50/20 dark:bg-blue-950/5 text-blue-700 dark:text-blue-300">{formatUSD(t.usdAmount)} $</td>
                                                        <td className="p-3 text-center font-mono font-bold text-slate-900 dark:text-white">{formatNumberString(t.originalAmount)}</td>
                                                        <td className="p-3 text-center font-black text-slate-500 dark:text-slate-400">{t.currencyType}</td>
                                                        <td className="p-3 text-center font-mono text-slate-600 dark:text-slate-400">{t.purchaseDate || '-'}</td>
                                                        <td className="p-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">{t.rialAmount > 0 ? formatNumberString(t.rialAmount) : '-'}</td>
                                                        <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]" title={t.exchangeName}>{t.exchangeName}</td>
                                                        <td className="p-3 text-center text-slate-600 dark:text-slate-400">{t.brokerName || '-'}</td>
                                                        
                                                        {tIndex === 0 && (
                                                            <td className="p-3 text-center text-slate-700 dark:text-slate-300 font-black" rowSpan={groupRowSpan}>
                                                                {group.recordInfo.bank || '-'}
                                                            </td>
                                                        )}
                                                        
                                                        <td className="p-3 text-center font-mono font-black bg-green-50/20 dark:bg-green-950/5 text-green-700 dark:text-green-300">{formatNumberString(t.deliveredAmount)}</td>
                                                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                             <div className="flex items-center justify-center gap-1.5">
                                                                 <span className={`inline-flex items-center justify-center p-1.5 rounded-full ${t.isDelivered ? 'bg-green-100 dark:bg-green-900/35 text-green-800 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/35 text-amber-800 dark:text-amber-300'}`} title={t.isDelivered ? 'تحویل شده' : 'در انتظار'}>
                                                                     {t.isDelivered ? (
                                                                         <CheckCircle2 size={14} className="text-green-600 dark:text-green-400" />
                                                                     ) : (
                                                                         <Clock size={14} className="text-amber-600 dark:text-amber-400" />
                                                                     )}
                                                                 </span>
                                                                 {onSelectTranche && group.recordInfo.recordId && (
                                                                     <button
                                                                         onClick={(e) => {
                                                                             e.stopPropagation();
                                                                             onSelectTranche(group.recordInfo.recordId!, t.id);
                                                                         }}
                                                                         className="p-1 px-1.5 bg-green-50 hover:bg-green-100 dark:bg-green-950/20 dark:hover:bg-green-900/35 text-green-600 dark:text-green-400 rounded-md border border-green-200 dark:border-green-800/80 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                                                         title="ثبت و ویرایش تحویل‌های ارز"
                                                                     >
                                                                         <Coins size={12} />
                                                                         <span className="text-[10px] font-black hidden lg:inline">تحویل</span>
                                                                     </button>
                                                                 )}
                                                             </div>
                                                         </td>
                                                        <td className="p-3 text-center font-mono font-bold bg-red-50/10 text-red-600 dark:text-red-400">{t.returnAmount > 0 ? formatNumberString(t.returnAmount) : '-'}</td>
                                                        <td className="p-3 text-center font-mono text-slate-500 dark:text-slate-400">{t.returnDate || '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                                {processedGroups.length === 0 && (
                                    <tr>
                                        <td colSpan={17} className="p-12 text-center text-slate-400 dark:text-slate-500 font-extrabold text-sm">
                                            هیچ پرونده خریدی یافت نشد. سال مالی یا عبارات فیلتر را تغییر دهید.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {processedGroups.length > 0 && (
                                <tfoot className="bg-slate-50 dark:bg-slate-900/90 font-black border-t-2 border-slate-200 dark:border-slate-800 select-none">
                                    <tr className="text-slate-900 dark:text-white leading-loose text-center">
                                        <td colSpan={5} className="p-4 text-center border-l border-slate-200 dark:border-slate-800 sticky right-0 bg-slate-50 dark:bg-slate-900 z-20 font-black text-sm">جمع کل کارنامه سال مالی</td>
                                        <td className="p-4 font-mono font-black text-blue-700 dark:text-blue-400">{formatUSD(tableTotals.usd)} $</td>
                                        <td className="p-4 font-mono font-bold">{formatNumberString(tableTotals.original)}</td>
                                        <td colSpan={2}></td>
                                        <td className="p-4 font-mono font-black text-indigo-700 dark:text-indigo-400">{formatNumberString(tableTotals.rial)}</td>
                                        <td colSpan={3}></td>
                                        <td className="p-4 font-mono font-black text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-950/20">{formatNumberString(tableTotals.delivered)}</td>
                                        <td colSpan={3}></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}

            {/* --- PAPER EMULATION / PRINT PREVIEW MODE (A4 LANDSCAPE OVERFLOW CORRECTION) --- */}
            {viewMode === 'print' && (
                <div className="flex-1 overflow-auto flex justify-center bg-slate-100 dark:bg-slate-950 p-4" ref={containerWrapperRef}>
                    <div style={{ 
                        width: '296mm', 
                        minHeight: '210mm',
                        backgroundColor: 'white',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                        transform: `scale(${scale})`,
                        transformOrigin: 'top center',
                        marginBottom: `${(1 - scale) * -220}px` 
                    }} className="border dark:border-slate-800 rounded shadow-lg">
                        {printContent}
                    </div>
                </div>
            )}

            {/* --- OFF-SCREEN AND PRINT PORTAL (VISIBLE TO PRINT BUT HIDDEN TO SCREEN) --- */}
            {viewMode === 'web' && (
                <div className="print-only-element">
                    {printContent}
                </div>
            )}

            {/* --- INTELLIGENT ACCESSIBILITY DRAWER/MODAL FOR DETAILED RECORD VIEWS (ESPECIALLY ON PHONE SCREENS) --- */}
            {selectedRowDetail && (
                <div 
                    className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 animate-fade-in no-print" 
                    onClick={() => setSelectedRowDetail(null)}
                >
                    <div 
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[85vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div className="bg-slate-50 dark:bg-slate-850 px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center select-none">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                                    <Info size={19} />
                                </div>
                                <div className="text-right">
                                    <h3 className="font-black text-gray-950 dark:text-white text-sm">جزئیات کامل خرید ارز</h3>
                                    <p className="text-[10px] text-gray-400 font-bold">ردیف {selectedRowDetail.index} • شناسنامه آماری تدارکات</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedRowDetail(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors hover:bg-slate-200/50"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Drawer Body scroll list */}
                        <div className="px-6 py-5 overflow-y-auto space-y-4 text-right text-xs">
                            {/* Proforma goods specs */}
                            <div className="bg-blue-50/40 dark:bg-blue-950/10 p-4 rounded-xl border border-blue-100/30 dark:border-blue-900/10">
                                <div className="text-[10px] font-black text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
                                    <span>📦 مشخصات شناسه‌ای کالا</span>
                                </div>
                                <h4 className="font-extrabold text-slate-900 dark:text-white text-sm leading-relaxed mb-3">{selectedRowDetail.group.recordInfo.goodsName}</h4>
                                <div className="grid grid-cols-2 gap-3 font-mono text-[11px] text-slate-500">
                                    <div>شماره پرونده (پرونده): <span className="font-black text-slate-900 dark:text-white">{selectedRowDetail.group.recordInfo.fileNumber}</span></div>
                                    <div>ثبت سفارش: <span className="font-black text-slate-900 dark:text-white">{selectedRowDetail.group.recordInfo.registrationNumber || '-'}</span></div>
                                </div>
                            </div>

                            {/* Core quantities & dynamic USD conversions */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-bold block mb-1">💵 مقدار ارز ثبت‌شده</span>
                                    <span className="font-mono text-base font-black text-slate-900 dark:text-white">{formatNumberString(selectedRowDetail.tranche.originalAmount)}</span>
                                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 mr-1">{selectedRowDetail.tranche.currencyType}</span>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-bold block mb-1">🇺🇸 معادل دلاری (USD)</span>
                                    <span className="font-mono text-base font-black text-blue-600 dark:text-blue-400">{formatUSD(selectedRowDetail.tranche.usdAmount)} $</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-bold block mb-1">📅 تاریخ حواله خرید ارز</span>
                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedRowDetail.tranche.purchaseDate || '-'}</span>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-200/50 dark:border-slate-800">
                                    <span className="text-[10px] text-slate-400 font-bold block mb-1">🪙 بهای خرید کارمزد (ریال)</span>
                                    <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">{selectedRowDetail.tranche.rialAmount > 0 ? `${formatNumberString(selectedRowDetail.tranche.rialAmount)} ریال` : '-'}</span>
                                </div>
                            </div>

                            {/* Companies & Banking agents details */}
                            <div className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800 space-y-2.5">
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-400 font-extrabold flex items-center gap-1">🏢 نام شرکت متقاضی:</span>
                                    <span className="font-black text-slate-800 dark:text-slate-200">{selectedRowDetail.group.recordInfo.company}</span>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-400 font-extrabold flex items-center gap-1">🏦 بانک عامل گشایش:</span>
                                    <span className="font-black text-slate-800 dark:text-slate-200">{selectedRowDetail.group.recordInfo.bank || '-'}</span>
                                </div>
                                <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-slate-400 font-extrabold flex items-center gap-1">🏛️ صرافی حواله‌گر:</span>
                                    <span className="font-black text-slate-800 dark:text-slate-200">{selectedRowDetail.tranche.exchangeName || '-'}</span>
                                </div>
                                <div className="flex justify-between items-center py-1.5">
                                    <span className="text-slate-400 font-extrabold flex items-center gap-1">👤 کارگزار خارجی/داخلی:</span>
                                    <span className="font-black text-slate-800 dark:text-slate-200">{selectedRowDetail.tranche.brokerName || '-'}</span>
                                </div>
                            </div>

                            {/* Logistics outputs */}
                            <div className="grid grid-cols-2 gap-3 font-sans">
                                <div className="bg-green-50/40 dark:bg-green-950/10 p-3.5 rounded-xl border border-green-100/30 dark:border-green-900/10">
                                    <span className="text-[10px] text-green-600 dark:text-green-400 font-black block mb-1">📦 مقدار تحویل شده</span>
                                    <span className="font-mono text-sm font-black text-green-700 dark:text-green-300">{formatNumberString(selectedRowDetail.tranche.deliveredAmount)}</span>
                                    <span className="text-[10px] font-black text-slate-400 mr-1">{selectedRowDetail.tranche.currencyType}</span>
                                </div>
                                <div className="bg-green-50/40 dark:bg-green-950/10 p-3.5 rounded-xl border border-green-100/30 dark:border-green-900/10 flex flex-col justify-center">
                                    <span className="text-[10px] text-green-600 dark:text-green-400 font-black block mb-1">وضعیت تصفیه</span>
                                    <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold ${selectedRowDetail.tranche.isDelivered ? 'text-green-600' : 'text-amber-600'}`}>
                                        {selectedRowDetail.tranche.isDelivered ? '✅ تسویه و تحویل شده' : '⏳ در جریان کار (انتظار)'}
                                    </span>
                                </div>
                            </div>

                            {/* Returnings / Refunds */}
                            <div className="bg-red-50/30 dark:bg-red-950/5 p-4 rounded-xl border border-red-100/30 dark:border-red-900/10">
                                <div className="text-[10px] font-black text-red-600 dark:text-red-400 mb-1 flex items-center gap-1.5">
                                    <Coins size={12} />
                                    <span>مبالغ عودت داده شده ارز (ریفایند)</span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-[11px] font-sans">
                                    <div>مبلغ عودتی: <span className="font-mono font-black text-red-600 dark:text-red-400">{selectedRowDetail.tranche.returnAmount > 0 ? formatNumberString(selectedRowDetail.tranche.returnAmount) : '۰'}</span> {selectedRowDetail.tranche.currencyType}</div>
                                    <div>تاریخ عودت ارز: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedRowDetail.tranche.returnDate || '-'}</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Drawer Footer */}
                        <div className="bg-slate-50 dark:bg-slate-850 p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between select-none items-center">
                            {onSelectTranche && selectedRowDetail.group.recordInfo.recordId && (
                                <button 
                                    onClick={() => {
                                        const recId = selectedRowDetail.group.recordInfo.recordId;
                                        const trId = selectedRowDetail.tranche.id;
                                        setSelectedRowDetail(null);
                                        onSelectTranche(recId, trId);
                                    }}
                                    className="bg-green-600 hover:bg-green-700 active:bg-green-800 text-white font-black px-4 py-2 rounded-xl transition-colors shadow-sm text-xs flex items-center gap-1.5"
                                >
                                    <Coins size={14} />
                                    <span>ثبت و ویرایش تحویل‌ها</span>
                                </button>
                            )}
                            <button 
                                onClick={() => setSelectedRowDetail(null)}
                                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black px-6 py-2 rounded-xl transition-colors shadow-sm text-xs"
                            >
                                بستن جزئیات تراکنش
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CurrencyReport;
