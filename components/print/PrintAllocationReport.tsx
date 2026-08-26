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

  // Touch pinch zoom
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartScaleRef = useRef<number>(1);
  const lastTapRef = useRef<number>(0);

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
          setScale(Math.max(0.25, (wrapperWidth - 32) / targetWidth));
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
    const nextScale = Math.min(3.0, currentScale + 0.15);
    setUserZoom(nextScale);
    setScale(nextScale);
  };

  const handleZoomOut = () => {
    const currentScale = userZoom !== null ? userZoom : scale;
    const nextScale = Math.max(0.25, currentScale - 0.15);
    setUserZoom(nextScale);
    setScale(nextScale);
  };

  const handleSetZoom = (newScale: number) => {
    const clamped = Math.min(3.0, Math.max(0.25, newScale));
    setUserZoom(clamped);
    setScale(clamped);
  };

  const handleResetZoom = () => {
    setUserZoom(null);
    setTimeout(() => {
      const wrapper = containerWrapperRef.current;
      if (wrapper) {
        const wrapperWidth = wrapper.clientWidth;
        const targetWidth = 1100;
        if (wrapperWidth < targetWidth + 40) {
          setScale(Math.max(0.25, (wrapperWidth - 32) / targetWidth));
        } else {
          setScale(1);
        }
      }
    }, 50);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDistRef.current = dist;
      touchStartScaleRef.current = scale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        if (scale > 1.1) {
          handleResetZoom();
        } else {
          handleSetZoom(1.35);
        }
      }
      lastTapRef.current = now;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDist / touchStartDistRef.current;
      const targetScale = Math.min(3.0, Math.max(0.25, touchStartScaleRef.current * ratio));
      setScale(targetScale);
      setUserZoom(targetScale);
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.min(3.0, Math.max(0.25, scale * zoomFactor));
      setScale(newScale);
      setUserZoom(newScale);
    }
  };

  const handleDownloadPDF = async () => {
    setProcessing(true);
    await generatePdf({
      elementId: 'allocation-report-content',
      filename: `Currency_Allocation_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
      format: 'A4',
      orientation: 'landscape',
      onComplete: () => setProcessing(false),
      onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
    });
  };

  const formatUSD = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const content = (
    <div id="allocation-report-content" className="printable-content glass-panel shadow-2xl relative text-black" 
      style={{ 
        width: '296mm',
        minHeight: '209mm', 
        direction: 'rtl',
        padding: '10mm', 
        boxSizing: 'border-box',
        margin: '0 auto',
        backgroundColor: '#ffffff'
      }}>
      <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-4">
        <div>
          <h1 className="text-xl font-black">گزارش جامع تخصیص و صف ارزی</h1>
          <p className="text-xs text-gray-500 mt-1">تاریخ گزارش: {new Date().toLocaleDateString('fa-IR')}</p>
        </div>
        <div className="text-left">
          <div className="text-xs font-bold text-gray-600">سامانه جامع بازرگانی و ارزی</div>
        </div>
      </div>

      {/* Summary Boxes */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border border-black p-3 bg-gray-50 rounded">
          <div className="text-xs text-gray-500 font-bold mb-1">مجموع ارز تخصیص یافته</div>
          <div className="text-lg font-black font-mono text-emerald-700">{formatUSD(totalAllocated)}</div>
        </div>
        <div className="border border-black p-3 bg-gray-50 rounded">
          <div className="text-xs text-gray-500 font-bold mb-1">مجموع در صف تخصیص</div>
          <div className="text-lg font-black font-mono text-amber-700">{formatUSD(totalQueue)}</div>
        </div>
        <div className="border border-black p-3 bg-gray-50 rounded">
          <div className="text-xs text-gray-500 font-bold mb-1">سرجمع کل تعهدات ارزی</div>
          <div className="text-lg font-black font-mono text-blue-700">{formatUSD(totalAllocated + totalQueue)}</div>
        </div>
      </div>

      {/* Main Table */}
      <table className="w-full text-right border-collapse border border-black text-xs">
        <thead>
          <tr className="bg-gray-100 border-b border-black font-bold">
            <th className="p-2 border-r border-black">ردیف</th>
            <th className="p-2 border-r border-black">شماره ثبت سفارش</th>
            <th className="p-2 border-r border-black">شرکت</th>
            <th className="p-2 border-r border-black">تامین‌کننده</th>
            <th className="p-2 border-r border-black">نوع ارز</th>
            <th className="p-2 border-r border-black">مبلغ کل ارزی</th>
            <th className="p-2 border-r border-black">مبلغ تخصیص (USD)</th>
            <th className="p-2 border-r border-black">مبلغ در صف (USD)</th>
            <th className="p-2">وضعیت</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={i} className="border-b border-gray-300">
              <td className="p-2 border-r border-black text-center">{i + 1}</td>
              <td className="p-2 border-r border-black font-mono">{r.orderRegistrationNumber || '-'}</td>
              <td className="p-2 border-r border-black font-bold">{r.companyName || '-'}</td>
              <td className="p-2 border-r border-black">{r.supplierName || '-'}</td>
              <td className="p-2 border-r border-black">{r.currencyType || '-'}</td>
              <td className="p-2 border-r border-black font-mono">{formatCurrency(r.amount || 0)}</td>
              <td className="p-2 border-r border-black font-mono text-emerald-700">{r.status === 'allocated' ? formatUSD(r.amountUSD || 0) : '-'}</td>
              <td className="p-2 border-r border-black font-mono text-amber-700">{r.status === 'queue' ? formatUSD(r.amountUSD || 0) : '-'}</td>
              <td className="p-2 font-bold">
                {r.status === 'allocated' ? 'تخصیص یافته' : r.status === 'queue' ? 'در صف تخصیص' : 'نامشخص'}
              </td>
            </tr>
          ))}
          {records.length === 0 && (
            <tr><td colSpan={9} className="p-4 text-center text-gray-400">هیچ رکوردی یافت نشد</td></tr>
          )}
        </tbody>
      </table>

      {/* Company Summary Table */}
      <div className="mt-8">
        <h3 className="text-sm font-bold mb-2">تفکیک بر اساس شرکت</h3>
        <table className="w-full text-right border-collapse border border-gray-400 text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-400 font-bold">
              <th className="p-2 border-r border-gray-400">شرکت</th>
              <th className="p-2 border-r border-gray-400">تخصیص یافته (USD)</th>
              <th className="p-2 border-r border-gray-400">در صف تخصیص (USD)</th>
              <th className="p-2 border-r border-gray-400">مجموع (USD)</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(companySummary).map((c, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="p-2 border-r border-gray-400 font-bold">{c}</td>
                <td className="p-2 border-r border-gray-400 font-mono text-emerald-700">{formatUSD(companySummary[c].allocated)}</td>
                <td className="p-2 border-r border-gray-400 font-mono text-amber-700">{formatUSD(companySummary[c].queue)}</td>
                <td className="p-2 border-r border-gray-400 font-mono font-bold">{formatUSD(companySummary[c].allocated + companySummary[c].queue)}</td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-black border-t-2 border-black">
              <td className="p-2 border-r border-gray-400">جمع کل</td>
              <td className="p-2 border-r border-gray-400 font-mono text-emerald-700">{formatUSD(totalAllocated)}</td>
              <td className="p-2 border-r border-gray-400 font-mono text-amber-700">{formatUSD(totalQueue)}</td>
              <td className="p-2 border-r border-gray-400 font-mono">{formatUSD(totalAllocated + totalQueue)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col p-0 m-0 overflow-hidden animate-fade-in safe-top safe-bottom">
      {/* Sticky Top Header Bar */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-3 py-2.5 md:px-6 md:py-3 shadow-md flex items-center justify-between gap-2 flex-wrap shrink-0 no-print">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shadow-xs">
            📊
          </div>
          <span className="font-bold text-sm md:text-base text-gray-800 dark:text-gray-100">پیش‌نمایش تخصیص ارز</span>
        </div>

        {/* Interactive Zoom Toolbar */}
        <div className="flex items-center gap-1 md:gap-2 bg-gray-100 dark:bg-zinc-900 px-2 py-1 md:px-3 md:py-1.5 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-xs">
          <button onClick={handleZoomOut} className="p-1 md:p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors" title="کوچک‌نمایی">
            <ZoomOut size={16}/>
          </button>
          
          <button onClick={() => handleSetZoom(1)} className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300 px-1.5 py-0.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded min-w-[44px] text-center" title="تنظیم به ۱۰۰٪">
            {Math.round(scale * 100)}%
          </button>
          
          <button onClick={handleZoomIn} className="p-1 md:p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors" title="بزرگ‌نمایی">
            <ZoomIn size={16}/>
          </button>

          <div className="h-4 w-px bg-gray-300 dark:bg-zinc-700 mx-0.5" />

          <button onClick={handleResetZoom} className="px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors flex items-center gap-1" title="تناسب خودکار">
            <RotateCcw size={13}/>
            <span className="text-[11px]">تناسب</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 md:gap-2">
          <button onClick={handleDownloadPDF} disabled={processing} className="bg-red-600 hover:bg-red-700 active:scale-95 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs flex items-center gap-1.5 font-bold shadow-md transition-all disabled:opacity-50">
            {processing ? <Loader2 size={16} className="animate-spin"/> : <FileDown size={16}/>}
            <span>دانلود PDF</span>
          </button>
          
          <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs flex items-center gap-1.5 font-bold shadow-md transition-all">
            <Printer size={16}/>
            <span className="hidden sm:inline">چاپ</span>
          </button>
          
          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 p-2 rounded-xl transition-colors" title="بستن">
            <X size={18}/>
          </button>
        </div>
      </header>

      {/* Main Canvas Area */}
      <main 
        className="flex-1 w-full overflow-auto p-2 md:p-6 flex flex-col items-center justify-start overscroll-contain" 
        ref={containerWrapperRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <div style={{ 
          width: `${296 * 3.779527559 * scale}px`,
          minHeight: `${209 * 3.779527559 * scale}px`,
          position: 'relative',
          flexShrink: 0
        }}>
          <div style={{ 
            width: '296mm', 
            minHeight: '209mm', 
            backgroundColor: 'white', 
            boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0
          }} className="printable-content rounded-md">
            {content}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrintAllocationReport;
