import React, { useEffect, useState, useRef } from 'react';
import { X, Printer, Loader2, FileDown } from 'lucide-react';
import { TradeRecord, TradeStage } from '../../types';
import { formatCurrency, formatNumberString } from '../../constants';
import { generatePdf } from '../../utils/pdfGenerator'; 

interface Props {
  record: TradeRecord;
  totalRial: number;
  totalCurrency: number;
  exchangeRate: number;
  grandTotalRial: number;
  onClose: () => void;
}

const PrintFinalCostReport: React.FC<Props> = ({ record, totalRial, totalCurrency, exchangeRate, grandTotalRial, onClose }) => {
  const [processing, setProcessing] = useState(false);

  // Scaling State for Preview
  const [scale, setScale] = useState(1);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const styleId = 'page-size-style-final-cost';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.innerHTML = `
      @media print {
        @page { size: A4 portrait; margin: 0; }
        body { margin: 0 !important; padding: 0 !important; background: white !important; }
        .no-print { display: none !important; }
        #final-cost-print-area {
          width: 210mm !important;
          height: 297mm !important;
          max-height: 297mm !important;
          margin: 0 auto !important;
          padding: 10mm 12mm !important;
          box-sizing: border-box !important;
          overflow: hidden !important;
          page-break-after: avoid !important;
          page-break-before: avoid !important;
          page-break-inside: avoid !important;
        }
      }
    `;
    return () => {
      if (style) style.remove();
    };
  }, []);

  // Auto-Scale Logic for preview overlay
  useEffect(() => {
    const handleResize = () => {
        const wrapper = containerWrapperRef.current;
        if (wrapper) {
            const wrapperWidth = wrapper.clientWidth;
            const targetWidth = 794; // A4 Portrait width in px at 96dpi
            
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

  const totalWeight = record.items.reduce((sum, item) => sum + item.weight, 0);
  const tranches = record.currencyPurchaseData?.tranches || [];
  const netCurrencyRialCost = tranches.reduce((acc, t) => {
      const paid = t.rialAmount || ((t.amount || 0) * (t.rate || 0));
      const ret = t.returnAmount || 0; 
      return acc + (paid - ret);
  }, 0);

  const expenses: { name: string; amount: number }[] = [
      { name: 'هزینه خرید ارز (خالص ریالی)', amount: netCurrencyRialCost },
      { name: 'هزینه‌های ثبت سفارش و بانکی', amount: record.stages[TradeStage.LICENSES]?.costRial || 0 },
      { name: 'هزینه بیمه باربری', amount: record.stages[TradeStage.INSURANCE]?.costRial || 0 },
      { name: 'هزینه بازرسی (COI)', amount: record.stages[TradeStage.INSPECTION]?.costRial || 0 },
      { name: 'هزینه‌های ترخیصیه و انبارداری', amount: record.stages[TradeStage.CLEARANCE_DOCS]?.costRial || 0 },
  ];

  const greenLeaf = record.greenLeafData;
  const hasGreenLeafBreakdown = greenLeaf && (greenLeaf.duties?.length || greenLeaf.taxes?.length || greenLeaf.roadTolls?.length);

  if (hasGreenLeafBreakdown) {
      if (greenLeaf.duties?.length) {
          greenLeaf.duties.forEach((d, i) => {
              expenses.push({ 
                  name: `حقوق ورودی - ${d.part ? `پارت ${d.part}` : `ردیف ${i + 1}`} (کوتاژ ${d.cottageNumber || '-'})`, 
                  amount: d.amount 
              });
          });
      }
      if (greenLeaf.taxes?.length) {
          greenLeaf.taxes.forEach((t, i) => {
              expenses.push({ 
                  name: `مالیات ارزش افزوده - ${t.part ? `پارت ${t.part}` : `ردیف ${i + 1}`}`, 
                  amount: t.amount 
              });
          });
      }
      if (greenLeaf.roadTolls?.length) {
          greenLeaf.roadTolls.forEach((r, i) => {
              expenses.push({ 
                  name: `عوارض راهداری - ${r.part ? `پارت ${r.part}` : `ردیف ${i + 1}`}`, 
                  amount: r.amount 
              });
          });
      }
  } else {
      expenses.push({ name: 'حقوق و عوارض گمرکی', amount: record.stages[TradeStage.GREEN_LEAF]?.costRial || 0 });
  }

  expenses.push({ name: 'هزینه حمل داخلی', amount: record.stages[TradeStage.INTERNAL_SHIPPING]?.costRial || 0 });
  expenses.push({ name: 'کارمزد و هزینه‌های ترخیص', amount: record.stages[TradeStage.AGENT_FEES]?.costRial || 0 });

  const guaranteeDepositsTotal = record.greenLeafData?.guarantees?.reduce((acc, g) => acc + (g.cashAmount || 0), 0) || 0;
  if (guaranteeDepositsTotal > 0) {
      expenses.push({ name: 'سپرده نقدی ضمانت‌نامه‌ها (هزینه سوا)', amount: guaranteeDepositsTotal });
  }

  const activeExpenses = expenses.filter(e => e.amount > 0);

  const handleDownloadPDF = async () => {
      setProcessing(true);
      await generatePdf({
          elementId: 'final-cost-print-area',
          filename: `Final_Cost_Report_${record.fileNumber}.pdf`,
          format: 'A4',
          orientation: 'portrait',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
      });
  };

  const freightPerKgCurrency = totalWeight > 0 ? (record.freightCost || 0) / totalWeight : 0;

  const content = (
      <div 
        id="final-cost-print-area" 
        className="printable-content bg-white relative text-black flex flex-col justify-between" 
        style={{ 
          width: '210mm', 
          height: '297mm', 
          maxHeight: '297mm',
          padding: '10mm 12mm', 
          direction: 'rtl', 
          boxSizing: 'border-box',
          overflow: 'hidden'
        }}
      >
        <div>
          {/* Header */}
          <div className="border-b-2 border-gray-900 pb-2 mb-2 flex justify-between items-end">
              <div>
                  <h1 className="text-xl font-black mb-0.5 text-gray-900">صورتحساب نهایی هزینه‌ها و قیمت تمام شده</h1>
                  <h2 className="text-xs font-bold text-gray-700">{record.company}</h2>
              </div>
              <div className="text-left text-[11px] space-y-0.5 font-mono">
                  <div><span className="font-bold font-sans text-gray-700">شماره پرونده / پروفرم:</span> <span className="font-bold text-blue-900">{record.fileNumber}</span></div>
                  {record.transferredFrom && (
                      <div className="text-[10px] text-amber-800 font-sans"><span className="font-bold">انتقال از:</span> {record.transferredFrom.fileNumber}</div>
                  )}
                  <div><span className="font-bold font-sans text-gray-700">تاریخ گزارش:</span> {new Date().toLocaleDateString('fa-IR')}</div>
              </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-3 gap-y-1 gap-x-3 mb-2 bg-gray-50 text-gray-800 p-2 rounded border border-gray-300 text-[10.5px]">
              <div><span className="font-bold text-gray-600">شماره پرونده:</span> <span className="font-mono font-bold text-blue-900">{record.fileNumber}</span></div>
              <div><span className="font-bold text-gray-600">شرح کالا:</span> <span className="truncate">{record.goodsName}</span></div>
              <div><span className="font-bold text-gray-600">گروه کالایی:</span> {record.commodityGroup}</div>
              <div><span className="font-bold text-gray-600">فروشنده:</span> {record.sellerName}</div>
              <div><span className="font-bold text-gray-600">ارز پایه:</span> {record.mainCurrency}</div>
              <div><span className="font-bold text-gray-600">نرخ ریالی هر واحد ارز:</span> {formatCurrency(exchangeRate)}</div>
              <div><span className="font-bold text-gray-600">کل وزن:</span> {formatNumberString(totalWeight)} KG</div>
              <div><span className="font-bold text-gray-600">شماره ثبت سفارش:</span> {record.registrationNumber || record.orderNumber || '-'}</div>
              <div><span className="font-bold text-gray-600">شرکت:</span> {record.company}</div>
          </div>

          {record.transferredFrom && (
              <div className="mb-2 bg-amber-50/90 p-1.5 rounded border border-amber-300 text-amber-900 text-[10px] flex items-center justify-between">
                  <div>
                      <span className="font-bold">اطلاعات انتقال پروفرما:</span>
                      <span className="mr-1">این پرونده با شماره جدید <strong className="font-mono">{record.fileNumber}</strong>، از پرونده قبلی <strong className="font-mono">{record.transferredFrom.fileNumber}</strong> (شرح: {record.transferredFrom.goodsName}) منتقل شده است.</span>
                  </div>
              </div>
          )}

          {/* 1. BILL OF EXPENSES */}
          <h3 className="font-black text-[11px] mb-1 border-b border-gray-800 pb-0.5 mt-2">الف) ریز هزینه‌های انجام شده (ریالی)</h3>
          <table className="w-full text-[10.5px] border-collapse border border-gray-800 mb-2.5 text-center">
              <thead>
                  <tr className="bg-gray-200 text-gray-900 font-bold">
                      <th className="border border-gray-800 py-1 px-1.5 w-8">ردیف</th>
                      <th className="border border-gray-800 py-1 px-2 text-right">شرح هزینه</th>
                      <th className="border border-gray-800 py-1 px-2 w-36">مبلغ (ریال)</th>
                  </tr>
              </thead>
              <tbody>
                  {activeExpenses.map((exp, idx) => (
                      <tr key={idx} className="even:bg-gray-50/50">
                          <td className="border border-gray-800 py-0.5 px-1">{idx + 1}</td>
                          <td className="border border-gray-800 py-0.5 px-2 text-right">{exp.name}</td>
                          <td className="border border-gray-800 py-0.5 px-2 font-mono dir-ltr">{formatCurrency(exp.amount)}</td>
                      </tr>
                  ))}
                  <tr className="bg-gray-200 text-gray-900 font-black">
                      <td colSpan={2} className="border border-gray-800 py-1 px-2 text-left pl-4">جمع کل هزینه‌های ریالی پروژه</td>
                      <td className="border border-gray-800 py-1 px-2 font-mono dir-ltr">{formatCurrency(grandTotalRial)}</td>
                  </tr>
              </tbody>
          </table>

          {/* 2. COST CALCULATION SUMMARY BAR */}
          <h3 className="font-black text-[11px] mb-1 border-b border-gray-800 pb-0.5 mt-2">ب) خلاصه محاسبه قیمت تمام شده</h3>
          <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-gray-800 p-2 rounded mb-2.5 text-[10.5px]">
              <div className="flex flex-col">
                  <span className="text-gray-600 font-medium">مبلغ کل پروفرما (ارزی):</span>
                  <span className="font-mono font-bold text-gray-900 mt-0.5 dir-ltr text-right">{formatNumberString(totalCurrency)} {record.mainCurrency}</span>
              </div>
              <div className="flex flex-col border-r border-l border-gray-300 px-2">
                  <span className="text-gray-600 font-medium">هزینه حمل ارزی هر کیلو:</span>
                  <span className="font-mono font-bold text-gray-900 mt-0.5 dir-ltr text-right">{formatNumberString(freightPerKgCurrency)} {record.mainCurrency}</span>
              </div>
              <div className="flex flex-col bg-emerald-50/80 p-1 rounded border border-emerald-300">
                  <span className="text-emerald-900 font-black">قیمت تمام شده نهایی (کل):</span>
                  <span className="font-mono font-black text-emerald-950 text-xs mt-0.5 dir-ltr text-right">{formatCurrency(grandTotalRial)} ریال</span>
              </div>
          </div>

          {/* 3. ITEM COST BREAKDOWN */}
          <h3 className="font-black text-[11px] mb-1 border-b border-gray-800 pb-0.5 mt-2">ج) بهای تمام شده به تفکیک کالا</h3>
          <table className="w-full text-[10px] border-collapse border border-gray-800 mb-2 text-center">
              <thead>
                  <tr className="bg-gray-200 text-gray-900 font-bold">
                      <th className="border border-gray-800 py-1 px-1 w-7">ردیف</th>
                      <th className="border border-gray-800 py-1 px-1 text-right">شرح کالا</th>
                      <th className="border border-gray-800 py-1 px-1">وزن (KG)</th>
                      <th className="border border-gray-800 py-1 px-1">فی ارزی (خرید)</th>
                      <th className="border border-gray-800 py-1 px-1">فی ارزی با حمل</th>
                      <th className="border border-gray-800 py-1 px-1">قیمت تمام شده (ریال)</th>
                      <th className="border border-gray-800 py-1 px-1 bg-gray-300">فی تمام شده (ریال/KG)</th>
                  </tr>
              </thead>
              <tbody>
                  {record.items.map((item, idx) => {
                      const itemFreightShareCurrency = item.weight * freightPerKgCurrency;
                      const itemAdjustedTotalPriceCurrency = item.totalPrice + itemFreightShareCurrency;
                      const itemFinalCostRial = itemAdjustedTotalPriceCurrency * exchangeRate;
                      const itemFinalCostPerKg = item.weight > 0 ? itemFinalCostRial / item.weight : 0;
                      const itemAdjustedUnitPriceCurrency = item.weight > 0 ? itemAdjustedTotalPriceCurrency / item.weight : 0;

                      return (
                          <tr key={item.id} className="even:bg-gray-50/50">
                              <td className="border border-gray-800 py-0.5 px-1">{idx + 1}</td>
                              <td className="border border-gray-800 py-0.5 px-1 font-bold text-right">{item.name}</td>
                              <td className="border border-gray-800 py-0.5 px-1 font-mono">{formatNumberString(item.weight)}</td>
                              <td className="border border-gray-800 py-0.5 px-1 font-mono">{formatNumberString(item.unitPrice)}</td>
                              <td className="border border-gray-800 py-0.5 px-1 font-mono text-blue-900">{formatNumberString(itemAdjustedUnitPriceCurrency)}</td>
                              <td className="border border-gray-800 py-0.5 px-1 font-mono font-bold">{formatCurrency(itemFinalCostRial)}</td>
                              <td className="border border-gray-800 py-0.5 px-1 font-mono font-bold bg-gray-100/80">{formatCurrency(itemFinalCostPerKg)}</td>
                          </tr>
                      );
                  })}
              </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className="pt-2 border-t border-gray-300 mt-auto">
            <div className="grid grid-cols-3 gap-6 text-center text-[10.5px]">
                <div>
                    <div className="mb-5 font-bold text-gray-800">کارشناس بازرگانی</div>
                    <div className="border-b border-gray-800 w-2/3 mx-auto"></div>
                </div>
                <div>
                    <div className="mb-5 font-bold text-gray-800">مدیر مالی</div>
                    <div className="border-b border-gray-800 w-2/3 mx-auto"></div>
                </div>
                <div>
                    <div className="mb-5 font-bold text-gray-800">مدیر عامل</div>
                    <div className="border-b border-gray-800 w-2/3 mx-auto"></div>
                </div>
            </div>
        </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[120] flex flex-col items-center overflow-y-auto overflow-x-hidden justify-start p-4 md:p-6 animate-fade-in safe-pb">
        <div className="sticky top-2 z-50 flex justify-center w-full max-w-4xl no-print mb-4">
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 flex justify-between items-center gap-6 w-full md:w-auto">
                <span className="font-black text-sm text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <Printer size={18} className="text-blue-600"/> پیش‌نمایش صورتحساب نهایی هزینه‌ها (تک‌صفحه‌ای A4)
                </span>
                <div className="flex gap-2">
                    <button onClick={handleDownloadPDF} disabled={processing} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 font-bold transition-all shadow-sm active:scale-95">
                        {processing ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>} دانلود PDF
                    </button>
                    <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 font-bold transition-all shadow-sm active:scale-95">
                        <Printer size={16}/> چاپ
                    </button>
                    <button onClick={onClose} className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 p-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
                        <X size={18}/>
                    </button>
                </div>
            </div>
        </div>

        <div className="w-full flex justify-center pb-12" ref={containerWrapperRef}>
            <div style={{ 
              width: '210mm', 
              height: '297mm',
              backgroundColor: 'white', 
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              marginBottom: scale < 1 ? `${(scale - 1) * 1122.5}px` : '24px' 
            }} className="printable-content rounded-sm">
                {content}
            </div>
        </div>
    </div>
  );
};

export default PrintFinalCostReport;
