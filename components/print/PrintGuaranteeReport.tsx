import React, { useEffect, useState, useRef } from 'react';
import { X, Printer, Loader2, FileDown, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { formatCurrency, formatDate } from '../../constants';
import { generatePdf } from '../../utils/pdfGenerator'; 

export interface GuaranteeItem {
  id: string;
  fileNumber: string;
  company: string;
  section: string;
  bank: string;
  chequeNumber: string;
  amount: number;
  dueDate: string;
  isDelivered: boolean;
  description: string;
}

interface Props {
  data: GuaranteeItem[];
  totalAmount: number;
  onClose: () => void;
}

const PrintGuaranteeReport: React.FC<Props> = ({ data, totalAmount, onClose }) => {
  const [processing, setProcessing] = useState(false);

  // Scaling State
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
          elementId: 'guarantee-report-content',
          filename: `Guarantee_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
          format: 'A4',
          orientation: 'landscape',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در تولید PDF'); setProcessing(false); }
      });
  };

  const handlePrint = () => {
      window.print();
  };

  const content = (
      <div id="guarantee-report-content" className="printable-content glass-panel p-8 text-black" 
        style={{ 
            width: '290mm',
            minHeight: '200mm', 
            direction: 'rtl',
            padding: '10mm', 
            boxSizing: 'border-box',
            margin: '0 auto',
            backgroundColor: '#ffffff'
        }}>
            <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-6">
                <div>
                    <h1 className="text-xl font-bold">گزارش جامع تضامین و چک‌های شرکت</h1>
                    <p className="text-xs text-gray-500 mt-1">تاریخ گزارش: {formatDate(new Date().toISOString())}</p>
                </div>
                <div className="text-left">
                    <p className="text-sm font-bold">تعداد کل تضامین: {data.length}</p>
                </div>
            </div>

            <table className="w-full border-collapse border border-black text-center text-xs">
                <thead>
                    <tr className="bg-gray-100 text-black font-bold">
                        <th className="border border-black p-2 w-8">#</th>
                        <th className="border border-black p-2">شماره پرونده</th>
                        <th className="border border-black p-2">شرکت صادرکننده</th>
                        <th className="border border-black p-2">بخش / مرحله</th>
                        <th className="border border-black p-2">بانک</th>
                        <th className="border border-black p-2">شماره چک/سند</th>
                        <th className="border border-black p-2">مبلغ (ریال)</th>
                        <th className="border border-black p-2">سررسید</th>
                        <th className="border border-black p-2">وضعیت</th>
                        <th className="border border-black p-2">توضیحات</th>
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 ? (
                        <tr>
                            <td colSpan={10} className="border border-black p-4 text-center text-gray-500">موردی برای نمایش وجود ندارد</td>
                        </tr>
                    ) : (
                        data.map((item, index) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                                <td className="border border-black p-1.5">{index + 1}</td>
                                <td className="border border-black p-1.5 font-mono">{item.fileNumber}</td>
                                <td className="border border-black p-1.5 font-bold">{item.company}</td>
                                <td className="border border-black p-1.5">{item.section}</td>
                                <td className="border border-black p-1.5">{item.bank}</td>
                                <td className="border border-black p-1.5 font-mono">{item.chequeNumber}</td>
                                <td className="border border-black p-1.5 dir-ltr font-mono font-bold">{formatCurrency(item.amount)}</td>
                                <td className="border border-black p-1.5 font-mono">{item.dueDate}</td>
                                <td className="border border-black p-1.5 font-bold">
                                    {item.isDelivered ? 'تحویل داده شده / تسویه' : 'نزد شرکت / جاری'}
                                </td>
                                <td className="border border-black p-1.5 text-right">{item.description}</td>
                            </tr>
                        ))
                    )}
                </tbody>
                <tfoot>
                    <tr className="bg-gray-200 text-black font-black text-sm">
                        <td colSpan={6} className="border border-black p-2 text-left pl-4">جمع کل مبلغ تضمین</td>
                        <td className="border border-black p-2 dir-ltr font-mono">{formatCurrency(totalAmount)}</td>
                        <td colSpan={3} className="border border-black p-2"></td>
                    </tr>
                </tfoot>
            </table>

            <div className="mt-8 text-center text-[10px] text-gray-400">
                سیستم مدیریت مالی و بازرگانی - گزارش سیستمی
            </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col p-0 m-0 overflow-hidden animate-fade-in safe-top safe-bottom">
      {/* Sticky Top Header Bar */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-3 py-2.5 md:px-6 md:py-3 shadow-md flex items-center justify-between gap-2 flex-wrap shrink-0 no-print">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shadow-xs">
            🛡️
          </div>
          <span className="font-bold text-sm md:text-base text-gray-800 dark:text-gray-100">پیش‌نمایش گزارش تضامین و چک‌ها</span>
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
          
          <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs flex items-center gap-1.5 font-bold shadow-md transition-all">
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
          width: `${290 * 3.779527559 * scale}px`,
          minHeight: `${200 * 3.779527559 * scale}px`,
          position: 'relative',
          flexShrink: 0
        }}>
          <div style={{ 
            width: '290mm', 
            minHeight: '200mm', 
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

export default PrintGuaranteeReport;
