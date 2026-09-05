import React, { useState, useEffect, useRef } from 'react';
import { TradeRecord, SystemSettings } from '../../types';
import { formatNumberString } from '../../constants';
import { X, Printer, Loader2, FileDown, ZoomIn, ZoomOut, RotateCcw, MessageSquare } from 'lucide-react';
import { generatePdf } from '../../utils/pdfGenerator';
import { shareElementToChat } from '../../services/chatShareService';

interface Props {
  record: TradeRecord;
  settings: SystemSettings;
  onClose: () => void;
  embed?: boolean;
}

const PrintClearanceDeclaration: React.FC<Props> = ({ record, settings, onClose, embed }) => {
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData] = useState({
      brokerName: 'شرکت خدمات بازرگانی / کارگزار ترخیص',
      transportMode: 'Land' as 'Rail' | 'Land' | 'Sea',
      truckCount: '',
      wagonCount: '',
      containerCount: '',
      transportCompany: '',
      part: 'اول (نهایی)',
      sataCode: '',
      bankBranch: '',
      bankCode: '',
      packageType: 'کارتن',
      letterNumber: '',
      letterDate: new Date().toLocaleDateString('fa-IR'),
      attachment: 'دارد'
  });

  // Scaling State
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

  const company = settings.companies?.find(c => c.name === record.company);
  const letterhead = company?.letterhead;

  const blDoc = record.shippingDocuments?.find(d => d.type === 'Bill of Lading');
  const packingList = record.shippingDocuments?.find(d => d.type === 'Packing List');
  const invoice = record.shippingDocuments?.find(d => d.type === 'Commercial Invoice');
  const warehouseReceipt = (record.clearanceData as any)?.receipts?.[0];

  const totalWeight = (record.items || []).reduce((sum, i) => sum + (i.weight || 0), 0);
  const totalPackages = (packingList as any)?.packagesCount || 0;
  const regNumber = record.registrationNumber || record.orderNumber || record.fileNumber || '---';

  const elementId = embed ? `clearance-dec-embed-${record.id}` : 'clearance-declaration-print';

  useEffect(() => {
    const style = document.getElementById('page-size-style');
    if (style && !embed) {
      style.innerHTML = '@page { size: A4 portrait; margin: 0; }';
    }
  }, [embed]);

  // Auto-Scale Logic
  useEffect(() => {
    if (embed) return;
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
  }, [embed, userZoom]);

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

  const handleDownloadPDF = async () => {
      setProcessing(true);
      await generatePdf({
          elementId: elementId,
          filename: `Clearance_Declaration_${regNumber}.pdf`,
          format: 'A4',
          orientation: 'portrait',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در دانلود PDF'); setProcessing(false); }
      });
  };

  const handleSendToChat = async () => {
      setProcessing(true);
      try {
          await shareElementToChat(
              elementId,
              `Clearance_Declaration_${regNumber}.jpg`,
              {
                  defaultMessage: `اظهارنامه ترخیص گمرکی شماره کوتاژ ${regNumber} - کالا: ${record.goodsName || '---'} (شرکت: ${record.company || '---'})`,
                  title: 'ارسال اظهارنامه ترخیص به گفتگو'
              }
          );
      } catch (e) {
          console.error(e);
          alert('خطا در آماده‌سازی اظهارنامه جهت ارسال به گفتگو');
      } finally {
          setProcessing(false);
      }
  };

  const handlePrint = () => {
      window.print();
  };

  const content = (
    <div id={elementId} className="bg-white text-black font-sans relative overflow-hidden text-right dir-rtl shadow-2xl" style={{ width: '210mm', minHeight: '296mm', padding: '15mm 20mm', boxSizing: 'border-box', margin: '0 auto' }}>
        {/* Letterhead Background if exists */}
        {letterhead ? (
            <img src={letterhead} alt="سربرگ" className="absolute inset-0 w-full h-full object-fill pointer-events-none z-0" />
        ) : (
            <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-xl font-black">{record.company}</h1>
                    <p className="text-xs text-gray-600 mt-1">سامانه جامع مدیریت بازرگانی و ترخیص</p>
                </div>
                <div className="text-left text-xs space-y-1">
                    <div><span className="font-bold">تاریخ:</span> {formData.letterDate}</div>
                    <div><span className="font-bold">شماره:</span> {formData.letterNumber || regNumber}</div>
                    <div><span className="font-bold">پیوست:</span> {formData.attachment}</div>
                </div>
            </div>
        )}

        <div className="relative z-10" style={{ paddingTop: letterhead ? '25mm' : '0' }}>
            {/* Header info in case of letterhead */}
            {letterhead && (
                <div className="flex justify-end mb-6 text-xs pl-4 space-y-1 flex-col items-end">
                    <div><span className="font-bold">شماره:</span> <input type="text" value={formData.letterNumber} onChange={e => setFormData({...formData, letterNumber: e.target.value})} placeholder="شماره نامه..." className="border-b border-gray-300 outline-none w-24 text-center font-mono" /></div>
                    <div><span className="font-bold">تاریخ:</span> <input type="text" value={formData.letterDate} onChange={e => setFormData({...formData, letterDate: e.target.value})} className="border-b border-gray-300 outline-none w-24 text-center font-mono" /></div>
                    <div><span className="font-bold">پیوست:</span> <input type="text" value={formData.attachment} onChange={e => setFormData({...formData, attachment: e.target.value})} className="border-b border-gray-300 outline-none w-16 text-center" /></div>
                </div>
            )}

            {/* Recipient */}
            <div className="mb-6 text-sm font-bold leading-relaxed">
                <div>به: <input type="text" value={formData.brokerName} onChange={e => setFormData({...formData, brokerName: e.target.value})} className="border-b border-gray-400 outline-none px-1 font-bold w-64 text-gray-900" /></div>
                <div className="mt-1 text-xs text-gray-700">موضوع: اعلام ورود و ارسال اسناد ترخیص محموله ثبت سفارش شماره {regNumber}</div>
            </div>

            {/* Body */}
            <div className="text-xs leading-loose text-justify mb-6">
                <p>
                    با سلام و احترام؛
                </p>
                <p className="mt-2">
                    بدین‌وسیله به اطلاع می‌رساند محموله مربوط به شرکت <span className="font-bold">{record.company}</span> تحت شماره ثبت سفارش <span className="font-bold font-mono">{regNumber}</span> و شماره کوتاژ / پرونده به مشخصات جدول ذیل به گمرک <span className="font-bold">{(record.clearanceData as any)?.customsName || (record as any).customsName || '---'}</span> واصل گردیده است. خواهشمند است اقدامات لازم جهت ترخیص قطعی کالا را مبذول فرمایید.
                </p>
            </div>

            {/* Shipment Specifications Table */}
            <table className="w-full text-right border-collapse border border-black text-xs mb-6">
                <tbody>
                    <tr className="border-b border-black">
                        <td className="p-2 border-r border-black bg-gray-100 font-bold w-1/4">فروشنده / ذینفع:</td>
                        <td className="p-2 border-r border-black w-1/4">{record.sellerName || '---'}</td>
                        <td className="p-2 border-r border-black bg-gray-100 font-bold w-1/4">پروفرما / سفارش:</td>
                        <td className="p-2 w-1/4 font-mono">{invoice?.documentNumber || record.orderNumber || record.fileNumber || '---'}</td>
                    </tr>
                    <tr className="border-b border-black">
                        <td className="p-2 border-r border-black bg-gray-100 font-bold">شرح کالا:</td>
                        <td className="p-2 border-r border-black" colSpan={3}>
                            {(record.items || []).map(i => i.name).join(' - ')}
                        </td>
                    </tr>
                    <tr className="border-b border-black">
                        <td className="p-2 border-r border-black bg-gray-100 font-bold">وزن ناخالص / خالص:</td>
                        <td className="p-2 border-r border-black font-mono">{formatNumberString(totalWeight)} کیلوگرم</td>
                        <td className="p-2 border-r border-black bg-gray-100 font-bold">تعداد بسته‌بندی:</td>
                        <td className="p-2">
                            <input type="text" value={formData.packageType} onChange={e => setFormData({...formData, packageType: e.target.value})} className="w-16 border-b outline-none text-center" />
                            <span className="font-mono mr-1">{totalPackages > 0 ? totalPackages : '-'}</span>
                        </td>
                    </tr>
                    <tr className="border-b border-black">
                        <td className="p-2 border-r border-black bg-gray-100 font-bold">شماره بارنامه:</td>
                        <td className="p-2 border-r border-black font-mono">{blDoc?.documentNumber || '---'}</td>
                        <td className="p-2 border-r border-black bg-gray-100 font-bold">قبض انبار:</td>
                        <td className="p-2 font-mono">{(warehouseReceipt as any)?.receiptNumber || (warehouseReceipt as any)?.documentNumber || '---'}</td>
                    </tr>
                    <tr className="border-b border-black">
                        <td className="p-2 border-r border-black bg-gray-100 font-bold">نوع و تعداد ناوگان:</td>
                        <td className="p-2 border-r border-black" colSpan={3}>
                            <div className="flex items-center gap-4 flex-wrap">
                                <span>کامیون: <input type="text" placeholder="تعداد" value={formData.truckCount} onChange={e => setFormData({...formData, truckCount: e.target.value})} className="w-12 border-b text-center font-mono outline-none" /></span>
                                <span>واگن: <input type="text" placeholder="تعداد" value={formData.wagonCount} onChange={e => setFormData({...formData, wagonCount: e.target.value})} className="w-12 border-b text-center font-mono outline-none" /></span>
                                <span>کانتینر: <input type="text" placeholder="تعداد" value={formData.containerCount} onChange={e => setFormData({...formData, containerCount: e.target.value})} className="w-12 border-b text-center font-mono outline-none" /></span>
                            </div>
                        </td>
                    </tr>
                    <tr className="border-b border-black">
                        <td className="p-2 border-r border-black bg-gray-100 font-bold">کد ساتا / منشا ارز:</td>
                        <td className="p-2 border-r border-black font-mono">
                            <input type="text" placeholder="کد ساتا..." value={formData.sataCode} onChange={e => setFormData({...formData, sataCode: e.target.value})} className="w-full border-b outline-none font-mono" />
                        </td>
                        <td className="p-2 border-r border-black bg-gray-100 font-bold">پارت حمل:</td>
                        <td className="p-2">
                            <input type="text" value={formData.part} onChange={e => setFormData({...formData, part: e.target.value})} className="w-full border-b outline-none" />
                        </td>
                    </tr>
                    <tr>
                        <td className="p-2 border-r border-black bg-gray-100 font-bold">بانک عامل:</td>
                        <td className="p-2 border-r border-black" colSpan={3}>
                            <div className="flex items-center gap-4">
                                <span>{record.operatingBank || '---'}</span>
                                <span>شعبه: <input type="text" placeholder="نام شعبه" value={formData.bankBranch} onChange={e => setFormData({...formData, bankBranch: e.target.value})} className="border-b outline-none w-28 text-center" /></span>
                                <span>کد شعبه: <input type="text" placeholder="کد" value={formData.bankCode} onChange={e => setFormData({...formData, bankCode: e.target.value})} className="border-b outline-none w-16 text-center font-mono" /></span>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Attached Documents Checklist */}
            <div className="border border-black p-3 text-xs mb-8">
                <div className="font-bold mb-2 bg-gray-100 p-1">مدارک و اسناد پیوست جهت ترخیص:</div>
                <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" defaultChecked={!!blDoc} className="rounded" /> اصل / تصویر ترخیصیه و بارنامه
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" defaultChecked={!!invoice} className="rounded" /> فاکتور تجاری (Invoice)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" defaultChecked={!!packingList} className="rounded" /> لیست عدلبندی (Packing List)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" defaultChecked={!!warehouseReceipt} className="rounded" /> قبض انبار الکترونیک
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" defaultChecked={true} className="rounded" /> گواهی مبدا (Certificate of Origin)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" defaultChecked={true} className="rounded" /> بیمه‌نامه و ثبت سفارش
                    </label>
                </div>
            </div>

            {/* Footer Signature */}
            <div className="mt-12 ml-10 text-left text-sm font-bold">
                <div>با احترام</div>
                <div className="mt-1">شرکت {record.company}</div>
            </div>
        </div>
    </div>
  );

  if (embed) return content;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[130] flex flex-col p-0 m-0 overflow-hidden animate-fade-in safe-top safe-bottom">
      {/* Sticky Top Header Bar */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-3 py-2.5 md:px-6 md:py-3 shadow-md flex items-center justify-between gap-2 flex-wrap shrink-0 no-print">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shadow-xs">
            📋
          </div>
          <span className="font-bold text-sm md:text-base text-gray-800 dark:text-gray-100">پیش‌نمایش اعلام ورود کالا (ترخیصیه)</span>
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
            minHeight: `${296 * 3.779527559 * scale}px`,
            position: 'relative',
            flexShrink: 0,
            margin: 'auto'
          }}>
            <div 
              dir="rtl"
              style={{ 
                width: '210mm', 
                minHeight: '296mm', 
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

export default PrintClearanceDeclaration;
