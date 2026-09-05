import React, { useEffect, useState, useRef } from 'react';
import { X, Printer, Loader2, FileDown, ZoomIn, ZoomOut, RotateCcw, MessageSquare } from 'lucide-react';
import { TradeRecord, TradeStage } from '../../types';
import { formatCurrency, formatNumberString } from '../../constants';
import { generatePdf } from '../../utils/pdfGenerator'; 
import { shareElementToChat } from '../../services/chatShareService'; 

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
        if (userZoom !== null) return;
        const wrapper = containerWrapperRef.current;
        if (wrapper) {
            const wrapperWidth = wrapper.clientWidth;
            const targetWidth = 794; // A4 Portrait width in px at 96dpi
            
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

  const regNumber = record.registrationNumber || record.orderNumber || record.fileNumber || '---';
  const currencyStr = record.mainCurrency || 'USD';

  const handleDownloadPDF = async () => {
      setProcessing(true);
      await generatePdf({
          elementId: 'final-cost-print-area',
          filename: `Final_Cost_Report_${regNumber}.pdf`,
          format: 'A4',
          orientation: 'portrait',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در تولید PDF'); setProcessing(false); }
      });
  };

  const handleSendToChat = async () => {
      setProcessing(true);
      try {
          await shareElementToChat(
              'final-cost-print-area',
              `Final_Cost_Report_${regNumber}.jpg`,
              {
                  defaultMessage: `گزارش بهای تمام شده نهایی پرونده شماره ${regNumber} - شرکت: ${record.company || '---'} (بهای تمام شده: ${formatCurrency(totalRial)} ریال)`,
                  title: 'ارسال گزارش بهای تمام شده به گفتگو'
              }
          );
      } catch (e) {
          console.error(e);
          alert('خطا در آماده‌سازی گزارش بهای تمام شده جهت ارسال به گفتگو');
      } finally {
          setProcessing(false);
      }
  };

  const totalWeight = (record.items || []).reduce((sum, item) => sum + (item.weight || 0), 0);
  const costPerKgRial = totalWeight > 0 ? (grandTotalRial / totalWeight) : 0;

  const stageKeys = Object.values(TradeStage);

  const content = (
      <div 
        id="final-cost-print-area" 
        className="bg-white text-black font-sans relative text-right dir-rtl shadow-2xl flex flex-col justify-between"
        style={{ 
            width: '210mm', 
            height: '297mm', 
            maxHeight: '297mm',
            padding: '10mm 12mm', 
            boxSizing: 'border-box', 
            margin: '0 auto',
            overflow: 'hidden',
            backgroundColor: '#ffffff'
        }}
      >
        <div>
            {/* Header */}
            <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-3">
                <div>
                    <h1 className="text-xl font-black text-gray-900 leading-tight">صورتحساب بهای تمام‌شده نهایی پرونده تجاری</h1>
                    <p className="text-[11px] text-gray-600 mt-0.5">شرکت: <span className="font-bold text-black">{record.company}</span> | تامین‌کننده: <span className="font-bold text-black">{record.sellerName || '---'}</span></p>
                </div>
                <div className="text-left text-[11px] space-y-0.5">
                    <div><span className="font-bold text-gray-500">شماره ثبت سفارش:</span> <span className="font-mono font-black">{regNumber}</span></div>
                    <div><span className="font-bold text-gray-500">شماره پرونده:</span> <span className="font-mono">{record.fileNumber || '---'}</span></div>
                    <div><span className="font-bold text-gray-500">تاریخ صدور گزارش:</span> <span className="font-mono font-bold">{new Date().toLocaleDateString('fa-IR')}</span></div>
                </div>
            </div>

            {/* Quick Specs Summary */}
            <div className="grid grid-cols-4 gap-2 border border-black p-2 bg-gray-50 rounded-sm mb-3 text-[11px]">
                <div>
                    <div className="text-gray-500 font-bold text-[10px]">مجموع وزن کل</div>
                    <div className="font-mono font-black text-sm">{formatNumberString(totalWeight)} <span className="text-[10px] font-sans">کیلوگرم</span></div>
                </div>
                <div>
                    <div className="text-gray-500 font-bold text-[10px]">نوع ارز پرونده</div>
                    <div className="font-black text-sm text-blue-800">{currencyStr}</div>
                </div>
                <div>
                    <div className="text-gray-500 font-bold text-[10px]">نرخ تسعیر ارز نهایی</div>
                    <div className="font-mono font-bold">{exchangeRate > 0 ? formatCurrency(exchangeRate) + ' ریال' : 'تعیین نشده'}</div>
                </div>
                <div>
                    <div className="text-gray-500 font-bold text-[10px]">وضعیت پرونده</div>
                    <div className="font-black text-emerald-800">{record.status === 'Completed' ? 'تکمیل شده' : 'در جریان'}</div>
                </div>
            </div>

            {/* Stage Expenses Table */}
            <div className="mb-3">
                <div className="text-xs font-black mb-1 flex justify-between items-center text-gray-800">
                    <span>۱. ریز هزینه‌های ثبت‌شده در مراحل پرونده:</span>
                </div>
                <table className="w-full text-right border-collapse border border-black text-[11px]">
                    <thead>
                        <tr className="bg-gray-200 border-b border-black font-black text-gray-900">
                            <th className="p-1.5 border-r border-black w-8 text-center">#</th>
                            <th className="p-1.5 border-r border-black">مرحله / شرح هزینه</th>
                            <th className="p-1.5 border-r border-black w-36 text-center">مبلغ ریالی (IRR)</th>
                            <th className="p-1.5 border-r border-black w-32 text-center">مبلغ ارزی ({currencyStr})</th>
                            <th className="p-1.5 w-40">وضعیت و توضیحات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stageKeys.map((stageKey, idx) => {
                            const stageData = record.stages?.[stageKey];
                            const costRial = stageData?.costRial || 0;
                            const costCurrency = stageData?.costCurrency || 0;
                            return (
                                <tr key={stageKey} className="border-b border-gray-300">
                                    <td className="p-1 border-r border-black text-center font-mono text-[10px]">{idx + 1}</td>
                                    <td className="p-1 border-r border-black font-bold">{stageKey}</td>
                                    <td className="p-1 border-r border-black text-center font-mono font-bold">{costRial > 0 ? formatCurrency(costRial) : '-'}</td>
                                    <td className="p-1 border-r border-black text-center font-mono font-bold text-blue-700">{costCurrency > 0 ? formatCurrency(costCurrency) : '-'}</td>
                                    <td className="p-1 text-[10px] text-gray-600 truncate max-w-[150px]">
                                        {stageData?.isCompleted ? 'تکمیل شده' : 'جاری'} {stageData?.description ? `(${stageData.description})` : ''}
                                    </td>
                                </tr>
                            );
                        })}
                        {/* Subtotals */}
                        <tr className="bg-gray-100 font-bold border-t-2 border-black text-black">
                            <td colSpan={2} className="p-1.5 border-r border-black text-left pl-3">جمع کل هزینه‌های تفکیکی:</td>
                            <td className="p-1.5 border-r border-black text-center font-mono text-xs">{formatCurrency(totalRial)} ریال</td>
                            <td className="p-1.5 border-r border-black text-center font-mono text-xs text-blue-800">{formatCurrency(totalCurrency)} {currencyStr}</td>
                            <td className="p-1.5 text-[10px] text-gray-500">مجموع خالص ریالی + ارزی</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Total Cost Consolidation Box */}
            <div className="border-2 border-black p-3 bg-gray-50 rounded-sm mb-3">
                <div className="text-xs font-black mb-2 text-gray-900 border-b border-gray-300 pb-1 flex justify-between">
                    <span>۲. محاسبه و تجمیع نهایی بهای تمام‌شده کل:</span>
                    <span className="text-[11px] font-mono text-gray-600">فرمول: (هزینه ارزی × نرخ تسعیر) + هزینه ریالی</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1.5">
                        <div className="flex justify-between border-b border-dashed border-gray-300 pb-1">
                            <span className="text-gray-600">سرجمع هزینه‌های ارزی:</span>
                            <span className="font-mono font-bold text-blue-700">{formatCurrency(totalCurrency)} {currencyStr}</span>
                        </div>
                        <div className="flex justify-between border-b border-dashed border-gray-300 pb-1">
                            <span className="text-gray-600">نرخ تسعیر محاسباتی:</span>
                            <span className="font-mono font-bold">{exchangeRate > 0 ? formatCurrency(exchangeRate) + ' ریال' : 'محاسبه نشده'}</span>
                        </div>
                        <div className="flex justify-between font-bold text-gray-800">
                            <span>ارزش ریالی بخش ارزی:</span>
                            <span className="font-mono font-bold text-emerald-700">{formatCurrency(totalCurrency * exchangeRate)} ریال</span>
                        </div>
                    </div>

                    <div className="space-y-1.5 border-r border-gray-300 pr-3">
                        <div className="flex justify-between border-b border-dashed border-gray-300 pb-1">
                            <span className="text-gray-600">سرجمع هزینه‌های مستقیم ریالی:</span>
                            <span className="font-mono font-bold">{formatCurrency(totalRial)} ریال</span>
                        </div>
                        <div className="flex justify-between border-b border-black pb-1 bg-amber-100/60 p-1 rounded font-black text-black">
                            <span>بهای تمام‌شده کل پرونده:</span>
                            <span className="font-mono text-sm">{formatCurrency(grandTotalRial)} ریال</span>
                        </div>
                        <div className="flex justify-between font-bold text-purple-900 bg-purple-50 p-1 rounded border border-purple-200">
                            <span>بهای تمام‌شده هر کیلوگرم:</span>
                            <span className="font-mono font-black">{costPerKgRial > 0 ? formatCurrency(costPerKgRial) : '۰'} ریال / kg</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Signatures & Approvals */}
        <div className="border-t-2 border-black pt-2 mt-auto">
            <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                <div className="border border-gray-300 p-2 rounded flex flex-col justify-between h-20">
                    <span className="font-bold text-gray-700">کارشناس بازرگانی</span>
                    <span className="text-gray-400">امضا و تاریخ</span>
                </div>
                <div className="border border-gray-300 p-2 rounded flex flex-col justify-between h-20">
                    <span className="font-bold text-gray-700">حسابداری صنعتی</span>
                    <span className="text-gray-400">امضا و تاریخ</span>
                </div>
                <div className="border border-gray-300 p-2 rounded flex flex-col justify-between h-20">
                    <span className="font-bold text-gray-700">مدیر مالی</span>
                    <span className="text-gray-400">امضا و تاریخ</span>
                </div>
                <div className="border border-black p-2 rounded bg-gray-100 flex flex-col justify-between h-20">
                    <span className="font-black text-black">تایید مدیریت عامل</span>
                    <span className="text-gray-400">مهر و امضا</span>
                </div>
            </div>
            <div className="text-center text-[9px] text-gray-400 mt-2">
                سامانه یکپارچه مدیریت بازرگانی خارجی | گزارش سیستمی
            </div>
        </div>
      </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex flex-col p-0 m-0 overflow-hidden animate-fade-in safe-top safe-bottom">
      {/* Sticky Top Header Bar */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-3 py-2.5 md:px-6 md:py-3 shadow-md flex items-center justify-between gap-2 flex-wrap shrink-0 no-print">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shadow-xs">
            📊
          </div>
          <span className="font-bold text-sm md:text-base text-gray-800 dark:text-gray-100">پیش‌نمایش بهای تمام‌شده پرونده ({regNumber})</span>
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
          <button 
            onClick={handleSendToChat} 
            disabled={processing} 
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl text-xs flex items-center gap-1.5 font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer"
            title="ارسال مستقیم به گفتگو"
          >
            {processing ? <Loader2 size={16} className="animate-spin"/> : <MessageSquare size={16}/>}
            <span>ارسال به گفتگو</span>
          </button>

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

export default PrintFinalCostReport;
