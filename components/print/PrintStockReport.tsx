import React, { useEffect, useState, useRef } from 'react';
import { X, Printer, FileDown, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator'; 

interface PrintStockReportProps {
  data: any[];
  onClose: () => void;
}

const PrintStockReport: React.FC<PrintStockReportProps> = ({ data, onClose }) => {
  const [processing, setProcessing] = useState(false);
  const reportData = data && data.length > 0 ? data : [];

  // Scaling & Zoom States
  const [scale, setScale] = useState(1);
  const [userZoom, setUserZoom] = useState<number | null>(null);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  // Touch pinch-to-zoom tracking
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartScaleRef = useRef<number>(1);
  const lastTapRef = useRef<number>(0);

  useEffect(() => {
    const style = document.getElementById('page-size-style');
    if (style) {
      style.innerHTML = '@page { size: A4 landscape; margin: 0; }';
    }
  }, []);

  // Auto-Scale Logic to fit screen width initially
  useEffect(() => {
    const handleResize = () => {
      if (userZoom !== null) return;
      const wrapper = containerWrapperRef.current;
      if (wrapper) {
        const wrapperWidth = wrapper.clientWidth;
        const targetWidth = 1100; // A4 Landscape approx width in px
        
        if (wrapperWidth < targetWidth + 40) {
          const newScale = Math.max(0.25, (wrapperWidth - 32) / targetWidth);
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

  // Mobile Touch Gestures (Pinch-to-zoom and double-tap)
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
        // Double tap toggle between fit and 100% or 150% zoom
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
      elementId: 'stock-report-content',
      filename: `Stock_Report_${new Date().toISOString().slice(0, 10)}.pdf`,
      format: 'A4',
      orientation: 'landscape',
      onComplete: () => setProcessing(false),
      onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
    });
  };

  const handlePrint = () => {
    const style = document.getElementById('page-size-style');
    if (style) {
      style.innerHTML = `
        @page { size: A4 landscape; margin: 0; }
        @media print {
            body * { visibility: hidden; }
            #stock-report-content, #stock-report-content * { visibility: visible; }
            #stock-report-content { 
                position: absolute; 
                left: 0; 
                top: 0; 
                width: 290mm !important; 
                margin: 0 !important;
                padding: 5mm !important;
                border: none !important;
                box-shadow: none !important;
            }
            .no-print { display: none !important; }
        }
      `;
    }
    window.print();
  };

  const content = (
    <div 
      id="stock-report-content" 
      className="printable-content glass-panel shadow-2xl relative text-black" 
      style={{ 
        width: '290mm',
        minHeight: '200mm', 
        direction: 'rtl',
        padding: '5mm', 
        boxSizing: 'border-box',
        margin: '0 auto',
        backgroundColor: '#ffffff'
      }}
    >
      <div style={{ textAlign: 'center', backgroundColor: '#fde047', border: '2px solid black', padding: '8px', marginBottom: '10px', fontWeight: '900', fontSize: '20px' }}>
        موجودی کلی انبارها
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid black', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {reportData.map((group, index) => {
              const headerColor = index === 0 ? '#d8b4fe' : index === 1 ? '#fdba74' : '#93c5fd';
              return (
                <th key={group.company} style={{ borderLeft: '2px solid black', verticalAlign: 'top', padding: 0 }}>
                  <div style={{ backgroundColor: headerColor, color: 'black', padding: '8px', borderBottom: '2px solid black', fontSize: '14px', fontWeight: '900' }}>
                    {group.company}
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f3f4f6' }}>
                        <th style={{ width: '36%', borderLeft: '1px solid black', borderBottom: '1px solid black', padding: '3px' }}>نخ / کالا</th>
                        <th style={{ width: '16%', borderLeft: '1px solid black', borderBottom: '1px solid black', padding: '3px' }}>کارتن</th>
                        <th style={{ width: '16%', borderLeft: '1px solid black', borderBottom: '1px solid black', padding: '3px' }}>وزن (KG)</th>
                        <th style={{ width: '16%', borderLeft: '1px solid black', borderBottom: '1px solid black', padding: '3px', backgroundColor: '#fef3c7' }}>وزن/کارتن</th>
                        <th style={{ width: '16%', borderBottom: '1px solid black', padding: '3px' }}>کانتینر</th>
                      </tr>
                    </thead>
                  </table>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr>
            {reportData.map((group) => (
              <td key={group.company} style={{ borderLeft: '2px solid black', verticalAlign: 'top', padding: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <tbody>
                    {group.items.map((item: any, i: number) => {
                      const wPerC = (item.quantity && Number(item.quantity) > 0 && item.weight)
                        ? (Number(item.weight) / Number(item.quantity)).toFixed(2)
                        : '-';

                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #d1d5db' }}>
                          <td style={{ width: '36%', borderLeft: '1px solid black', padding: '3px 4px', textAlign: 'right', fontWeight: 'bold', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {item.name}
                          </td>
                          <td style={{ width: '16%', borderLeft: '1px solid black', padding: '3px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', direction: 'ltr', color: (item.quantity || 0) < 0 ? '#dc2626' : 'inherit' }}>
                            {item.quantity !== undefined && item.quantity !== null ? Number(item.quantity).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0'}
                          </td>
                          <td style={{ width: '16%', borderLeft: '1px solid black', padding: '3px', textAlign: 'center', fontFamily: 'monospace', direction: 'ltr', color: (item.weight || 0) < 0 ? '#dc2626' : 'inherit' }}>
                            {item.weight !== undefined && item.weight !== null ? Number(item.weight).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '0'}
                          </td>
                          <td style={{ width: '16%', borderLeft: '1px solid black', padding: '3px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', direction: 'ltr', color: '#b45309', backgroundColor: '#fffbeb' }}>
                            {wPerC}
                          </td>
                          <td style={{ width: '16%', padding: '3px', textAlign: 'center', fontFamily: 'monospace', color: '#6b7280' }}>
                            {item.containerCount > 0 ? Number(item.containerCount).toFixed(2) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                    {group.items.length > 0 && (() => {
                      const totQty = group.items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
                      const totWeight = group.items.reduce((sum: number, i: any) => sum + (i.weight || 0), 0);
                      const avgWPerC = totQty > 0 ? (totWeight / totQty).toFixed(2) : '-';
                      const totContainers = group.items.reduce((sum: number, i: any) => sum + (i.containerCount || 0), 0);

                      return (
                        <tr style={{ backgroundColor: '#f9fafb', borderTop: '2px solid black' }}>
                          <td style={{ width: '36%', borderLeft: '1px solid black', padding: '5px 4px', textAlign: 'right', fontWeight: '900', fontSize: '11px' }}>جمع کل موجودی</td>
                          <td style={{ width: '16%', borderLeft: '1px solid black', padding: '5px', textAlign: 'center', fontWeight: '900', fontSize: '11px', borderBottom: '2px double black' }}>
                            {totQty.toFixed(2)}
                          </td>
                          <td style={{ width: '16%', borderLeft: '1px solid black', padding: '5px', textAlign: 'center', fontWeight: '900', fontSize: '11px', borderBottom: '2px double black' }}>
                            {totWeight.toFixed(2)}
                          </td>
                          <td style={{ width: '16%', borderLeft: '1px solid black', padding: '5px', textAlign: 'center', fontWeight: '900', fontSize: '11px', borderBottom: '2px double black', color: '#b45309', backgroundColor: '#fffbeb' }}>
                            {avgWPerC}
                          </td>
                          <td style={{ width: '16%', padding: '5px', textAlign: 'center', fontWeight: '900', fontSize: '10px' }}>
                            {totContainers > 0 ? totContainers.toFixed(2) : '-'}
                          </td>
                        </tr>
                      );
                    })()}
                    {group.items.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>موجودی صفر</td></tr>
                    )}
                  </tbody>
                </table>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <div style={{ textAlign: 'center', backgroundColor: '#fde047', border: '2px solid black', borderTop: 'none', padding: '4px', fontWeight: 'bold', fontSize: '12px' }}>
        گزارش سیستم مدیریت انبار - تاریخ چاپ: {new Date().toLocaleDateString('fa-IR')}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex flex-col p-0 m-0 overflow-hidden animate-fade-in safe-top safe-bottom">
      {/* Sticky Top Header Bar - Zero empty vertical space */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-3 py-2.5 md:px-6 md:py-3 shadow-md flex items-center justify-between gap-2 flex-wrap shrink-0 no-print">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 flex items-center justify-center font-bold text-xs shadow-xs">
            📦
          </div>
          <span className="font-bold text-sm md:text-base text-gray-800 dark:text-gray-100">پیش‌نمایش انبار</span>
        </div>

        {/* Interactive Zoom Toolbar & Presets */}
        <div className="flex items-center gap-1 md:gap-2 bg-gray-100 dark:bg-zinc-900 px-2 py-1 md:px-3 md:py-1.5 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-xs">
          <button 
            onClick={handleZoomOut} 
            className="p-1 md:p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors" 
            title="کوچک‌نمایی (-)"
          >
            <ZoomOut size={16} />
          </button>
          
          <button 
            onClick={() => handleSetZoom(1)} 
            className="text-xs font-mono font-bold text-gray-700 dark:text-gray-300 px-1.5 py-0.5 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded min-w-[44px] text-center" 
            title="تنظیم به ۱۰۰٪"
          >
            {Math.round(scale * 100)}%
          </button>
          
          <button 
            onClick={handleZoomIn} 
            className="p-1 md:p-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors" 
            title="بزرگ‌نمایی (+)"
          >
            <ZoomIn size={16} />
          </button>

          <div className="h-4 w-px bg-gray-300 dark:bg-zinc-700 mx-0.5 hidden sm:block" />

          {/* Quick preset buttons */}
          <div className="hidden sm:flex items-center gap-1">
            <button 
              onClick={() => handleSetZoom(0.75)} 
              className={`px-1.5 py-0.5 text-[11px] rounded font-mono ${scale === 0.75 ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-800'}`}
            >
              75%
            </button>
            <button 
              onClick={() => handleSetZoom(1.0)} 
              className={`px-1.5 py-0.5 text-[11px] rounded font-mono ${scale === 1.0 ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-800'}`}
            >
              100%
            </button>
            <button 
              onClick={() => handleSetZoom(1.25)} 
              className={`px-1.5 py-0.5 text-[11px] rounded font-mono ${scale === 1.25 ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-800'}`}
            >
              125%
            </button>
          </div>

          <div className="h-4 w-px bg-gray-300 dark:bg-zinc-700 mx-0.5" />

          <button 
            onClick={handleResetZoom} 
            className="px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors flex items-center gap-1" 
            title="تناسب با اندازه صفحه"
          >
            <RotateCcw size={13} />
            <span className="text-[11px]">تناسب</span>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 md:gap-2">
          <button 
            onClick={handleDownloadPDF} 
            disabled={processing} 
            className="bg-red-600 hover:bg-red-700 active:scale-95 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs flex items-center gap-1.5 font-bold shadow-md transition-all disabled:opacity-50"
          >
            {processing ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            <span>دانلود PDF</span>
          </button>
          
          <button 
            onClick={handlePrint} 
            className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs flex items-center gap-1.5 font-bold shadow-md transition-all"
          >
            <Printer size={16} />
            <span className="hidden sm:inline">چاپ</span>
          </button>
          
          <button 
            onClick={onClose} 
            className="bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 p-2 rounded-xl transition-colors" 
            title="بستن"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Main Canvas Container - Touch Pinch & Pan Supported */}
      <main 
        className="flex-1 w-full overflow-auto p-2 md:p-6 flex flex-col items-center justify-start overscroll-contain"
        ref={containerWrapperRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <div 
          style={{ 
            width: `${290 * 3.779527559 * scale}px`,
            minHeight: `${200 * 3.779527559 * scale}px`,
            position: 'relative',
            flexShrink: 0
          }}
        >
          <div 
            style={{ 
              width: '290mm', 
              minHeight: '200mm',
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
      </main>
    </div>
  );
};

export default PrintStockReport;
