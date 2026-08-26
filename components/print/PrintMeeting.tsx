import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Loader2, FileDown, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator';
import { MeetingMinutes } from '../../types';

interface PrintMeetingProps {
  meeting: MeetingMinutes;
  onClose: () => void;
}

const PrintMeeting: React.FC<PrintMeetingProps> = ({ meeting, onClose }) => {
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
    const styleId = 'page-size-style-meeting';
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
        #meeting-print-area {
          width: 210mm !important;
          min-height: 297mm !important;
          margin: 0 auto !important;
          padding: 12mm 15mm !important;
          box-sizing: border-box !important;
          box-shadow: none !important;
        }
      }
    `;
    return () => {
      if (style) style.remove();
    };
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

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

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
          elementId: 'meeting-print-area',
          filename: `Meeting_${meeting.meetingNumber}.pdf`,
          format: 'A4',
          orientation: 'portrait',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
      });
  };

  const content = (
    <div id="meeting-print-area" className="w-[210mm] min-h-[297mm] bg-white p-8 font-sans text-black shadow-2xl printable-content text-right dir-rtl" style={{ boxSizing: 'border-box', margin: '0 auto', backgroundColor: '#ffffff' }}>
      <div className="border-4 border-gray-900 p-6 relative rounded-xl h-full flex flex-col justify-between">
          <div>
            <h1 className="text-2xl font-black text-center mb-6">صورتجلسه</h1>

            <div className="grid grid-cols-4 gap-3 text-xs mb-6 border-b-2 border-gray-200 pb-4">
                <div className="space-y-1">
                    <div className="text-gray-500 font-bold text-[11px]">شماره جلسه:</div>
                    <div className="font-black font-mono text-sm">{meeting.meetingNumber}</div>
                </div>
                <div className="space-y-1">
                    <div className="text-gray-500 font-bold text-[11px]">تاریخ برگزاری:</div>
                    <div className="font-black font-mono">{meeting.date}</div>
                </div>
                <div className="space-y-1">
                    <div className="text-gray-500 font-bold text-[11px]">ساعت برگزاری:</div>
                    <div className="font-black font-mono">{meeting.time}</div>
                </div>
                <div className="space-y-1">
                    <div className="text-gray-500 font-bold text-[11px]">محل برگزاری:</div>
                    <div className="font-black">{meeting.location}</div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs mb-6 border-b-2 border-gray-200 pb-4">
                <div><span className="font-black">رئیس جلسه:</span> {meeting.chairman}</div>
                <div><span className="font-black">دبیر جلسه:</span> {meeting.secretary}</div>
            </div>

            <div className="mb-6">
                <h2 className="font-black border-b-2 border-gray-200 mb-3 pb-1 text-xs">اعضای حاضر</h2>
                <div className="grid grid-cols-4 gap-2">
                    {meeting.attendees.filter(a => a.isPresent).map((a, i) => (
                        <div key={i} className="text-[11px] bg-gray-50 p-1.5 rounded border border-gray-200 font-bold">• {a.fullName} - {a.role}</div>
                    ))}
                    {meeting.guestAttendees && meeting.guestAttendees.map((g, i) => (
                        <div key={`guest-${i}`} className="text-[11px] text-gray-700 bg-gray-50 p-1.5 rounded border border-gray-200 font-bold">• {g} - مدعو</div>
                    ))}
                </div>
            </div>

            <div className="mb-6">
                <h2 className="font-black border-b-2 border-gray-200 mb-3 pb-1 text-xs">مصوبات</h2>
                <table className="w-full border-collapse border border-gray-400 text-xs">
                    <thead>
                        <tr className="bg-gray-100 font-bold">
                            <th className="border border-gray-400 p-1.5 w-10 text-center">ردیف</th>
                            <th className="border border-gray-400 p-1.5">شرح مصوبه</th>
                            <th className="border border-gray-400 p-1.5 w-28 text-center">مسئول پیگیری</th>
                            <th className="border border-gray-400 p-1.5 w-24 text-center">مهلت اقدام</th>
                        </tr>
                    </thead>
                    <tbody>
                        {meeting.items.map((item, idx) => (
                            <tr key={item.id} className="border-b border-gray-300">
                                <td className="border border-gray-400 p-1.5 text-center font-mono">{idx + 1}</td>
                                <td className="border border-gray-400 p-1.5 leading-relaxed">{item.description}</td>
                                <td className="border border-gray-400 p-1.5 text-center">{item.responsiblePerson}</td>
                                <td className="border border-gray-400 p-1.5 text-center font-mono">{item.duration}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>

          <div className="mt-8 border-t-2 border-gray-900 pt-4">
              <h3 className="font-black text-xs mb-3">امضاها و تاییدات الکترونیک اعضا:</h3>
              <div className="flex flex-wrap gap-3">
              {Object.entries(meeting.approvals || {}).map(([username, appInfo]) => {
                  const attendee = meeting.attendees.find(a => a.username === username);
                  const name = attendee ? attendee.fullName : username;
                  const role = attendee ? attendee.role : 'عضو';
                  return (
                      <div key={username} className="border-2 border-emerald-800 text-emerald-800 rounded-xl p-2.5 transform -rotate-2 text-center bg-emerald-50/30 min-w-[110px] shadow-xs">
                          <div className="text-[9px] font-black border-b border-emerald-800 mb-1 pb-0.5">تایید شد ✓</div>
                          <div className="text-xs font-black">{name}</div>
                          <div className="text-[9px] font-bold mt-0.5">{role}</div>
                          <div className="text-[9px] font-mono mt-0.5">{new Date(appInfo.date).toLocaleDateString('fa-IR')}</div>
                      </div>
                  );
              })}
              </div>
          </div>
      </div>
    </div>
  );

  const modalContent = (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex flex-col p-0 m-0 overflow-hidden animate-fade-in safe-top safe-bottom">
      {/* Sticky Top Header Bar */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-3 py-2.5 md:px-6 md:py-3 shadow-md flex items-center justify-between gap-2 flex-wrap shrink-0 no-print">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 flex items-center justify-center font-bold text-xs shadow-xs">
            📝
          </div>
          <span className="font-bold text-sm md:text-base text-gray-800 dark:text-gray-100">پیش‌نمایش صورتجلسه شماره {meeting.meetingNumber}</span>
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

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

export default PrintMeeting;
