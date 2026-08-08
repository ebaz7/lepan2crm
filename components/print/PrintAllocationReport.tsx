
import React, { useEffect, useState, useRef } from 'react';
import { X, Printer, Loader2, FileDown, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { formatCurrency } from '../../constants';
import { generatePdf } from '../../utils/pdfGenerator';

interface PrintAllocationReportProps {
  records: any[];
  companySummary: any;
  totalAllocated: number;
  totalQueue: number;
  onClose: () => void;
}

const PrintAllocationReport: React.FC<PrintAllocationReportProps> = ({ records, companySummary, totalAllocated, totalQueue, onClose }) => {
  const [processing, setProcessing] = useState(false);

  // Scaling & Zoom States
  const [scale, setScale] = useState(1);
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const style = document.getElementById('page-size-style');
    if (style) {
      style.innerHTML = '@page { size: A4 landscape; margin: 0; }';
    }
  }, []);

  // Auto-Scale Logic
  useEffect(() => {
    const handleResize = () => {
        if (userZoom !== null) return;
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
  }, [userZoom]);

  const handleZoomIn = () => {
      const currentScale = userZoom !== null ? userZoom : scale;
      const nextScale = Math.min(2.5, currentScale + 0.15);
      setUserZoom(nextScale);
      setScale(nextScale);
  };

  const handleZoomOut = () => {
      const currentScale = userZoom !== null ? userZoom : scale;
      const nextScale = Math.max(0.3, currentScale - 0.15);
      setUserZoom(nextScale);
      setScale(nextScale);
  };

  const handleResetZoom = () => {
      setUserZoom(null);
      setTimeout(() => {
          const wrapper = containerWrapperRef.current;
          if (wrapper) {
              const wrapperWidth = wrapper.clientWidth;
              const targetWidth = 1100;
              if (wrapperWidth < targetWidth + 40) {
                  setScale((wrapperWidth - 32) / targetWidth);
              } else {
                  setScale(1);
              }
          }
      }, 50);
  };

  const formatUSD = (val: number) => val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleDownloadPDF = async () => {
      setProcessing(true);
      await generatePdf({
          elementId: 'allocation-report-print-area',
          filename: `Allocation_Report_${new Date().toISOString().slice(0,10)}.pdf`,
          format: 'A4',
          orientation: 'landscape',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
      });
  };

  const content = (
      <div id="allocation-report-print-area" className="printable-content glass-panel p-8 shadow-2xl relative text-black" 
        style={{ 
            width: '296mm', 
            minHeight: '209mm', 
            direction: 'rtl',
            padding: '5mm', 
            boxSizing: 'border-box'
        }}>
            <h2 className="text-center font-black text-xl mb-4 border-b-2 border-blue-900 pb-2">گزارش صف تخصیص ارز</h2>
            
            <table className="w-full text-[10px] text-center border-collapse border border-gray-400 mb-6">
                <thead>
                    <tr className="bg-[#1e3a8a] text-white">
                        <th className="p-1 border border-gray-400">ردیف</th>
                        <th className="p-1 border border-gray-400">پرونده / کالا</th>
                        <th className="p-1 border border-gray-400">ثبت سفارش</th>
                        <th className="p-1 border border-gray-400">شرکت</th>
                        <th className="p-1 border border-gray-400">مبلغ ارزی</th>
                        <th className="p-1 border border-gray-400">معادل دلار ($)</th>
                        <th className="p-1 border border-gray-400">معادل ریالی</th>
                        <th className="p-1 border border-gray-400">زمان در صف</th>
                        <th className="p-1 border border-gray-400">زمان تخصیص</th>
                        <th className="p-1 border border-gray-400">مانده مهلت (روز)</th>
                        <th className="p-1 border border-gray-400">وضعیت</th>
                        <th className="p-1 border border-gray-400">بانک عامل</th>
                        <th className="p-1 border border-gray-400 w-16">اولویت</th>
                        <th className="p-1 border border-gray-400 w-20">نوع ارز</th>
                    </tr>
                </thead>
                <tbody>
                    {records.length === 0 ? (
                        <tr><td colSpan={14} className="p-4 text-gray-500">موردی یافت نشد.</td></tr>
                    ) : (
                        records.map((r: any, index: number) => (
                            <tr key={r.id} className="border-b border-gray-300">
                                <td className="p-1 border-r border-gray-300">{index + 1}</td>
                                <td className="p-1 border-r border-gray-300 text-right">
                                    <div className="font-bold">{r.fileNumber}</div>
                                    <div className="text-[8px] text-gray-500 truncate max-w-[100px]">{r.goodsName}</div>
                                </td>
                                <td className="p-1 border-r border-gray-300 font-mono">{r.registrationNumber || '-'}</td>
                                <td className="p-1 border-r border-gray-300">{r.company}</td>
                                <td className="p-1 border-r border-gray-300 dir-ltr font-mono">{formatCurrency(r.amount)} {r.mainCurrency}</td>
                                <td className="p-1 border-r border-gray-300 dir-ltr font-mono font-bold">$ {formatUSD(r.amountInUSD)}</td>
                                <td className="p-1 border-r border-gray-300 dir-ltr font-mono text-blue-600">{formatCurrency(r.rialEquiv)}</td>
                                <td className="p-1 border-r border-gray-300 dir-ltr">{r.stageQ?.queueDate || '-'}</td>
                                <td className="p-1 border-r border-gray-300 dir-ltr">{r.stageA?.allocationDate || '-'}</td>
                                <td className={`p-1 border-r border-gray-300 font-bold ${r.remainingDays > 0 ? 'text-green-600' : r.remainingDays === '-' ? '' : 'text-red-600'}`}>{r.remainingDays}</td>
                                <td className={`p-1 border-r border-gray-300 font-bold ${r.isAllocated ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {r.isAllocated ? 'تخصیص یافته' : 'در صف'}
                                </td>
                                <td className="p-1 border-r border-gray-300 text-[9px]">{r.operatingBank || '-'}</td>
                                <td className="p-1 border-r border-gray-300 text-[10px]">{r.isPriority ? '✅' : '-'}</td>
                                <td className="p-1 border-r border-gray-300 text-[10px]">{r.allocationCurrencyRank === 'Type1' ? 'نوع 1' : r.allocationCurrencyRank === 'Type2' ? 'نوع 2' : '-'}</td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            <div className="border-t-2 border-black pt-2 break-inside-avoid">
                <h3 className="text-right font-bold mb-2 text-sm">خلاصه وضعیت ارزی به تفکیک شرکت (دلار آمریکا)</h3>
                <table className="w-full text-xs text-center border-collapse border border-gray-400">
                    <thead>
                        <tr className="bg-gray-200 text-gray-800">
                            <th className="p-2 border border-gray-400">نام شرکت</th>
                            <th className="p-2 border border-gray-400">جمع تخصیص یافته ($)</th>
                            <th className="p-2 border border-gray-400">جمع در صف ($)</th>
                            <th className="p-2 border border-gray-400 bg-gray-300">مجموع کل ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(companySummary).map(([comp, data]: any) => (
                            <tr key={comp} className="border-b border-gray-300">
                                <td className="p-2 border-r border-gray-300 font-bold">{comp}</td>
                                <td className="p-2 border-r border-gray-300 font-mono text-green-700 font-bold">{formatUSD(data.allocated)}</td>
                                <td className="p-2 border-r border-gray-300 font-mono text-amber-700 font-bold">{formatUSD(data.queue)}</td>
                                <td className="p-2 border-r border-gray-300 font-mono font-black bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200">{formatUSD(data.allocated + data.queue)}</td>
                            </tr>
                        ))}
                        <tr className="bg-gray-300 font-black border-t-2 border-black">
                            <td className="p-2 border-r border-gray-400">جمع نهایی</td>
                            <td className="p-2 border-r border-gray-400 font-mono">{formatUSD(totalAllocated)}</td>
                            <td className="p-2 border-r border-gray-400 font-mono">{formatUSD(totalQueue)}</td>
                            <td className="p-2 border-r border-gray-400 font-mono">{formatUSD(totalAllocated + totalQueue)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-start p-4 animate-fade-in safe-pb">
      <div className="relative z-50 flex flex-col gap-2 no-print w-full max-w-4xl mb-4">
         <div className="glass-panel p-3 rounded-xl shadow-lg flex justify-between items-center gap-4 bg-white dark:bg-zinc-950 flex-wrap">
             <span className="font-bold text-sm">پیش‌نمایش تخصیص ارز</span>

             {/* Interactive Zoom Toolbar */}
             <div className="flex items-center gap-2 bg-gray-100 dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-800">
                 <button onClick={handleZoomOut} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors" title="کوچک‌نمایی"><ZoomOut size={16}/></button>
                 <span className="text-xs font-mono font-bold text-gray-600 dark:text-gray-400 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
                 <button onClick={handleZoomIn} className="p-1 text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded transition-colors" title="بزرگ‌نمایی"><ZoomIn size={16}/></button>
                 {userZoom !== null && (
                     <button onClick={handleResetZoom} className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded transition-colors" title="بازنشانی"><RotateCcw size={14}/></button>
                 )}
             </div>
             <div className="flex gap-2">
                <button onClick={handleDownloadPDF} disabled={processing} className="bg-red-600 hover:bg-red-700 text-white p-2 px-3 rounded-lg text-xs flex items-center gap-1 font-bold shadow-sm">{processing ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>} دانلود PDF</button>
                <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white p-2 px-3 rounded-lg text-xs flex items-center gap-1 font-bold shadow-sm"><Printer size={16}/> چاپ</button>
                <button onClick={onClose} className="bg-gray-100 dark:bg-zinc-900 text-gray-700 dark:text-gray-300 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-800"><X size={18}/></button>
             </div>
         </div>
      </div>
      
      {/* Responsive Wrapper */}
      <div className="w-full flex justify-center pb-10 overflow-hidden" ref={containerWrapperRef}>
          <div style={{ 
            width: '296mm', 
            minHeight: '209mm',
            backgroundColor: 'white', 
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            marginBottom: `${(scale - 1) * 1120}px` 
          }} className="printable-content">
              {content}
          </div>
      </div>
    </div>
  );
};

export default PrintAllocationReport;
