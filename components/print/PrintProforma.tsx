import React, { useState, useEffect, useRef } from 'react';
import { TradeRecord, SystemSettings } from '../../types';
import { formatNumberString, formatCurrency } from '../../constants';
import { X, Printer, Loader2, FileDown, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator';

interface PrintProformaProps {
  record: TradeRecord;
  settings: SystemSettings | null;
  onClose: () => void;
}

const PrintProforma: React.FC<PrintProformaProps> = ({ record, settings, onClose }) => {
  const [processing, setProcessing] = useState(false);
  const totalWeight = record.items?.reduce((sum, item) => sum + (item.weight || 0), 0) || 0;
  const totalAmount = record.items?.reduce((sum, item) => sum + (item.totalPrice || (item.weight * item.unitPrice) || 0), 0) || 0;
  const company = settings?.companies?.find(c => c.name === record.company);

  // Scaling & Zoom States
  const [scale, setScale] = useState(1);
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  // Touch pinch zoom
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartScaleRef = useRef<number>(1);
  const lastTapRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const el = containerWrapperRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const el = containerWrapperRef.current;
    if (!el) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    el.scrollLeft = dragStartRef.current.scrollLeft - dx;
    el.scrollTop = dragStartRef.current.scrollTop - dy;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  useEffect(() => {
    const style = document.getElementById('page-size-style');
    if (style) {
      style.innerHTML = '@page { size: A4 portrait; margin: 0; }';
    }
  }, []);

  // Auto-Scale Logic (A4 Portrait target width is 794px)
  useEffect(() => {
    const handleResize = () => {
      if (userZoom !== null) return;
      const wrapper = containerWrapperRef.current;
      if (wrapper) {
        const wrapperWidth = wrapper.clientWidth;
        const targetWidth = 794; // A4 Portrait Width in px
        
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
        const targetWidth = 794;
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

  const handlePrint = () => {
    window.print();
  };

  const currencyStr = record.mainCurrency || 'USD';
  const proformaNum = record.orderNumber || (record as any).proformaNumber || record.fileNumber || '---';

  const handleDownloadPDF = async () => {
    setProcessing(true);
    await generatePdf({
      elementId: 'proforma-content',
      filename: `Proforma_${proformaNum}.pdf`,
      format: 'A4',
      orientation: 'portrait',
      onComplete: () => setProcessing(false),
      onError: () => { alert('خطا در دانلود PDF'); setProcessing(false); }
    });
  };

  const content = (
    <div id="proforma-content" className="printable-content glass-panel p-8 text-black text-right dir-rtl shadow-2xl relative" style={{ width: '210mm', minHeight: '297mm', boxSizing: 'border-box', margin: '0 auto', backgroundColor: '#ffffff' }}>
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-black mb-1">{record.company}</h1>
          <p className="text-xs text-gray-600">{company?.address || 'تهران، خیابان ولیعصر'}</p>
          <p className="text-xs text-gray-600">تلفن: {company?.phone || '۰۲۱-۸۸۸۸۸۸۸۸'}</p>
        </div>
        <div className="text-left">
          <h2 className="text-xl font-bold text-gray-800">پیش‌فاکتور (پروفرما)</h2>
          <div className="text-xs mt-2 space-y-1">
            <div><span className="font-bold">شماره پروفرما / سفارش:</span> {proformaNum}</div>
            <div><span className="font-bold">تاریخ:</span> {record.startDate || (record as any).proformaDate || '---'}</div>
            <div><span className="font-bold">شماره ثبت سفارش:</span> {record.registrationNumber || '---'}</div>
          </div>
        </div>
      </div>

      {/* Parties Info */}
      <div className="grid grid-cols-2 gap-4 border border-black p-3 mb-6 text-xs">
        <div>
          <div className="font-bold border-b pb-1 mb-1 bg-gray-100 p-1">مشخصات خریدار:</div>
          <div><span className="font-bold">نام:</span> {record.company}</div>
          <div><span className="font-bold">شناسه ملی:</span> {company?.nationalId || '---'}</div>
          <div><span className="font-bold">کد اقتصادی:</span> {company?.economicCode || '---'}</div>
        </div>
        <div>
          <div className="font-bold border-b pb-1 mb-1 bg-gray-100 p-1">مشخصات فروشنده / تامین‌کننده:</div>
          <div><span className="font-bold">نام:</span> {record.sellerName || (record as any).supplier || '---'}</div>
          <div><span className="font-bold">گروه کالایی:</span> {record.commodityGroup || '---'}</div>
          <div><span className="font-bold">شماره پرونده:</span> {record.fileNumber || '---'}</div>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-right border-collapse border border-black text-xs mb-6">
        <thead>
          <tr className="bg-gray-100 border-b border-black font-bold">
            <th className="p-2 border-r border-black w-10 text-center">ردیف</th>
            <th className="p-2 border-r border-black">شرح کالا</th>
            <th className="p-2 border-r border-black w-24 text-center">تعرفه گمرکی (HS)</th>
            <th className="p-2 border-r border-black w-20 text-center">وزن (kg)</th>
            <th className="p-2 border-r border-black w-24 text-center">قیمت واحد ({currencyStr})</th>
            <th className="p-2 w-28 text-center">مبلغ کل ({currencyStr})</th>
          </tr>
        </thead>
        <tbody>
          {(record.items || []).map((item, index) => (
            <tr key={index} className="border-b border-gray-300">
              <td className="p-2 border-r border-black text-center font-mono">{index + 1}</td>
              <td className="p-2 border-r border-black">{item.name}</td>
              <td className="p-2 border-r border-black text-center font-mono">{item.hsCode || '---'}</td>
              <td className="p-2 border-r border-black text-center font-mono">{formatNumberString(item.weight)}</td>
              <td className="p-2 border-r border-black text-center font-mono">{formatCurrency(item.unitPrice)}</td>
              <td className="p-2 text-center font-mono font-bold">{formatCurrency(item.totalPrice || (item.weight * item.unitPrice))}</td>
            </tr>
          ))}
          {/* Totals Row */}
          <tr className="bg-gray-50 border-t-2 border-black font-bold">
            <td colSpan={3} className="p-2 border-r border-black text-left pl-4">جمع کل:</td>
            <td className="p-2 border-r border-black text-center font-mono">{formatNumberString(totalWeight)}</td>
            <td className="p-2 border-r border-black text-center">-</td>
            <td className="p-2 text-center font-mono text-sm">{formatCurrency(totalAmount)} {currencyStr}</td>
          </tr>
        </tbody>
      </table>

      {/* Terms & Signatures */}
      <div className="border border-black p-3 text-xs mb-8">
        <div className="font-bold mb-1">شرایط و توضیحات:</div>
        <ul className="list-disc pr-4 space-y-1 text-gray-700">
          <li>نحوه تخصیص ارز: {(record as any).currencyAllocationType || 'طبق مقررات ارزی بانک مرکزی'}</li>
          <li>بانک عامل: {record.operatingBank || '---'}</li>
          <li>گمرک ترخیص: {(record.clearanceData as any)?.customsName || (record as any).customsName || '---'}</li>
        </ul>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-8 text-center text-xs mt-12">
        <div className="border-t border-black pt-2">
          <p className="font-bold mb-8">مهر و امضای فروشنده (تامین‌کننده)</p>
          <p className="text-gray-500">{record.sellerName || '---'}</p>
        </div>
        <div className="border-t border-black pt-2">
          <p className="font-bold mb-8">مهر و امضای خریدار</p>
          <p className="text-gray-500">{record.company}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col p-0 m-0 overflow-hidden animate-fade-in safe-top safe-bottom">
      {/* Sticky Top Header Bar */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-3 py-2.5 md:px-6 md:py-3 shadow-md flex items-center justify-between gap-2 flex-wrap shrink-0 no-print">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shadow-xs">
            📄
          </div>
          <span className="font-bold text-sm md:text-base text-gray-800 dark:text-gray-100">پیش‌نمایش پروفرما ({proformaNum})</span>
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
        dir="ltr"
        className="flex-1 w-full overflow-auto bg-zinc-900/95 cursor-grab active:cursor-grabbing select-none" 
        style={{ 
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y pinch-zoom'
        }}
        ref={containerWrapperRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div 
          className="min-w-full min-h-full flex items-center justify-center p-2 md:p-6"
          style={{ width: 'max-content', height: 'max-content' }}
        >
          <div style={{ 
            width: `${210 * 3.779527559 * scale}px`,
            minHeight: `${297 * 3.779527559 * scale}px`,
            position: 'relative',
            flexShrink: 0,
            margin: 'auto'
          }}>
            <div 
              dir="rtl"
              style={{ 
                width: '210mm', 
                minHeight: '297mm', 
                backgroundColor: 'white', 
                boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                position: 'absolute',
                top: 0,
                left: 0
              }} 
              className="printable-content rounded-md"
            >
              {content}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PrintProforma;
