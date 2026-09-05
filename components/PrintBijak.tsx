import React, { useState, useEffect, useRef } from 'react';
import { WarehouseTransaction, SystemSettings, Contact } from '../types';
import { formatCurrency, formatDate } from '../constants';
import { X, Printer, Loader2, Share2, Search, Users, Smartphone, FileDown, CheckCircle, XCircle, ZoomIn, ZoomOut, RotateCcw, MessageSquare } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';
import { generatePdf } from '../utils/pdfGenerator'; 
import html2canvas from 'html2canvas';
import { shareElementToChat } from '../services/chatShareService';

interface PrintBijakProps {
  tx: WarehouseTransaction;
  onClose: () => void;
  settings?: SystemSettings;
  embed?: boolean;
  forceHidePrices?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  transactions?: WarehouseTransaction[];
}

const PrintBijak: React.FC<PrintBijakProps> = ({ tx, onClose, settings, embed, forceHidePrices, onApprove, onReject, transactions }) => {
  const [processing, setProcessing] = useState(false);
  const [hidePrices, setHidePrices] = useState(forceHidePrices || false);
  const [sharePlatform, setSharePlatform] = useState<'whatsapp' | 'telegram' | 'bale' | null>(null);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [contactsLoading, setContactsLoading] = useState(false);

  const stockInfo = React.useMemo(() => {
     if (!transactions || !tx.items) return [];
     return tx.items.map(item => {
         let qty = 0; let weight = 0;
         transactions.filter(t => t.company === tx.company && t.status !== 'REJECTED').forEach(t => {
             if (Array.isArray(t.items)) {
                 t.items.forEach(ti => {
                     if (ti.itemId === item.itemId || ti.itemName === item.itemName) {
                         if (t.type === 'IN') { qty += (Number(ti.quantity) || 0); weight += (Number(ti.weight) || 0); }
                         else { qty -= (Number(ti.quantity) || 0); weight -= (Number(ti.weight) || 0); }
                     }
                 });
             }
         });
         return { name: item.itemName, qty, weight };
     });
  }, [transactions, tx]);

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

  useEffect(() => {
      const style = document.getElementById('page-size-style');
      if (style && !embed) { 
          style.innerHTML = '@page { size: A5 portrait; margin: 0; }';
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
            const targetWidth = 560; // A5 Width in px (approx)
            
            if (wrapperWidth < targetWidth + 40) {
                setScale(Math.max(0.3, (wrapperWidth - 32) / targetWidth));
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
    const nextScale = Math.max(0.3, currentScale - 0.15);
    setUserZoom(nextScale);
    setScale(nextScale);
  };

  const handleSetZoom = (newScale: number) => {
    const clamped = Math.min(3.0, Math.max(0.3, newScale));
    setUserZoom(clamped);
    setScale(clamped);
  };

  const handleResetZoom = () => {
    setUserZoom(null);
    setTimeout(() => {
      const wrapper = containerWrapperRef.current;
      if (wrapper) {
        const wrapperWidth = wrapper.clientWidth;
        const targetWidth = 560;
        if (wrapperWidth < targetWidth + 40) {
          setScale(Math.max(0.3, (wrapperWidth - 32) / targetWidth));
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
      const targetScale = Math.min(3.0, Math.max(0.3, touchStartScaleRef.current * ratio));
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
      const newScale = Math.min(3.0, Math.max(0.3, scale * zoomFactor));
      setScale(newScale);
      setUserZoom(newScale);
    }
  };

  const containerId = embed 
    ? `print-bijak-${tx.id}${forceHidePrices ? '-noprice' : '-price'}` 
    : "print-area";

  useEffect(() => {
      if (typeof forceHidePrices === 'boolean') setHidePrices(forceHidePrices);
  }, [forceHidePrices]);

  useEffect(() => {
      const loadContacts = async () => {
          setContactsLoading(true);
          const saved = settings?.savedContacts || [];
          try {
            const users = await getUsers();
            const userContacts = users
                .map(u => ({ 
                    id: u.id, 
                    name: u.fullName, 
                    number: u.phoneNumber || '',
                    telegramId: u.telegramChatId || (u as any).telegramId,
                    baleId: u.baleChatId || (u as any).baleId,
                    isGroup: false 
                })).filter(u => u.number || u.telegramId || u.baleId);
            setAllContacts([...saved, ...userContacts]);
          } catch (e) {
            setAllContacts(saved);
          } finally {
            setContactsLoading(false);
          }
      };
      if (sharePlatform) loadContacts();
  }, [settings, sharePlatform]);
  
  const companyConfig = settings?.companyNotifications?.[tx.company];
  const warehouseTarget = companyConfig?.warehouseGroup || settings?.defaultWarehouseGroup;
  const managerTarget = companyConfig?.salesManager || settings?.defaultSalesManager;

  const handlePrint = () => {
      const style = document.getElementById('page-size-style');
      if (style) {
          style.innerHTML = `
            @page { size: A5 portrait; margin: 0; }
            @media print {
                body * { visibility: hidden; }
                #${containerId}, #${containerId} * { visibility: visible; }
                #${containerId} { 
                    position: absolute; 
                    left: 0; 
                    top: 0; 
                    width: 148mm !important; 
                    height: 209mm !important;
                    margin: 0 !important;
                    padding: 8mm !important;
                    border: none !important;
                    box-shadow: none !important;
                }
                .no-print { display: none !important; }
            }
          `;
      }
      window.print();
  };

  const handleDownloadPDF = async () => {
      setProcessing(true);
      await generatePdf({
          elementId: containerId,
          filename: `Bijak_${tx.number}.pdf`,
          format: 'A5',
          orientation: 'portrait',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در دانلود PDF'); setProcessing(false); }
      });
  };

  const handleSendToChat = async () => {
      setProcessing(true);
      try {
          const el = document.getElementById(containerId);
          if (!el) throw new Error('المان چاپ بیجک پیدا نشد');
          await shareElementToChat(
              el,
              `Bijak_${tx.number}.jpg`,
              {
                  defaultMessage: `حواله/بیجک خروج انبار شماره ${tx.number} - تحویل گیرنده: ${tx.recipientName || tx.driverName || '---'} (شرکت: ${tx.company || '---'})`,
                  title: 'ارسال بیجک به گفتگو'
              }
          );
      } catch (e) {
          console.error(e);
          alert('خطا در آماده‌سازی بیجک جهت ارسال به گفتگو');
      } finally {
          setProcessing(false);
      }
  };

  const generateAndSend = async (target: string, shouldHidePrice: boolean, captionPrefix: string, platform?: 'whatsapp' | 'telegram' | 'bale') => {
      if (!target) { alert("شماره مخاطب/مدیر برای این شرکت تنظیم نشده است. لطفا در تنظیمات انبار بررسی کنید."); return; }
      setProcessing(true);
      const originalState = hidePrices;
      setHidePrices(shouldHidePrice);

      setTimeout(async () => {
          try {
              const element = document.getElementById(containerId);
              if (!element) throw new Error("Element not found");

              const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: 1000 });
              const base64 = canvas.toDataURL('image/png').split(',')[1];

              let caption = `${captionPrefix}\nشماره: ${tx.number}\nگیرنده: ${tx.recipientName}\nتعداد: ${tx.items.length} قلم`;

              const p = platform || 'whatsapp';
              if (p === 'whatsapp') {
                  await apiCall('/send-whatsapp', 'POST', {
                      number: target,
                      message: caption,
                      mediaData: { data: base64, mimeType: 'image/png', filename: `Bijak_${tx.number}.png` }
                  });
              } else {
                  await apiCall('/send-bot-message', 'POST', {
                      platform: p,
                      chatId: target,
                      caption: caption,
                      mediaData: { data: base64, filename: `Bijak_${tx.number}.png` }
                  });
              }
              if (!embed) alert('ارسال شد ✅');
          } catch (e) { console.error(e); if (!embed) alert('خطا در ارسال ❌'); } 
          finally { 
              setHidePrices(originalState); 
              setProcessing(false); 
              setSharePlatform(null);
          }
      }, 1500); 
  };

  const filteredContacts = allContacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.number.includes(contactSearch));

  const Stamp = ({ title, name, color = 'blue' }: { title: string, name: string, color?: 'blue' | 'green' | 'gray' }) => {
      const colorClass = color === 'blue' ? 'border-blue-800 text-blue-800' : color === 'green' ? 'border-green-800 text-green-800' : 'border-gray-500 text-gray-500';
      return (
          <div className={`border-2 border-dashed ${colorClass} rounded-lg p-1.5 px-3 inline-flex flex-col items-center justify-center transform -rotate-3 opacity-90 scale-90`}>
              <span className="text-[9px] font-black tracking-wider uppercase">{title}</span>
              <span className="text-[11px] font-bold mt-0.5">{name}</span>
              <span className="text-[7px] text-gray-400 font-mono mt-0.5">{formatDate(new Date().toISOString())}</span>
          </div>
      );
  };

  const content = (
      <div 
        id={containerId} 
        className="printable-content glass-panel p-6 text-black bg-white shadow-2xl relative flex flex-col justify-between"
        style={{ 
            width: '148mm', 
            minHeight: '209mm', 
            direction: 'rtl',
            padding: '8mm', 
            boxSizing: 'border-box',
            margin: '0 auto',
            backgroundColor: '#ffffff'
        }}
      >
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4 relative z-10">
                <div className="text-right">
                    <h1 className="text-xl font-black">{tx.company}</h1>
                    <h2 className="text-sm font-bold text-gray-700 mt-0.5">بیجک خروج از انبار (حواله تحویل)</h2>
                </div>
                <div className="text-left text-xs space-y-1">
                    <div><span className="font-bold">شماره:</span> <span className="font-mono font-bold text-red-600">{tx.number}</span></div>
                    <div><span className="font-bold">تاریخ:</span> <span className="font-mono">{tx.date}</span></div>
                    <div><span className="font-bold">ساعت:</span> <span className="font-mono">{tx.time}</span></div>
                </div>
            </div>

            <div className="border rounded-lg p-3 mb-4 bg-gray-50 text-gray-800 text-sm print:glass-panel print:border-black relative z-10">
                <div className="grid grid-cols-2 gap-4">
                    <div><span className="text-gray-500 ml-2">تحویل گیرنده:</span> <span className="font-bold">{tx.recipientName}</span></div>
                    <div><span className="text-gray-500 ml-2">مقصد:</span> <span className="font-bold">{tx.destination || '-'}</span></div>
                    <div><span className="text-gray-500 ml-2">راننده:</span> <span className="font-bold">{tx.driverName || '-'}</span></div>
                    <div><span className="text-gray-500 ml-2">پلاک:</span> <span className="font-bold font-mono dir-ltr">{tx.plateNumber || '-'}</span></div>
                </div>
            </div>

            <div className="flex-1 relative z-10">
                <table className="w-full text-sm border-collapse border border-black">
                    <thead className="bg-gray-200 print:bg-gray-100 text-gray-800">
                        <tr>
                            <th className="border border-black p-2 w-10 text-center">#</th>
                            <th className="border border-black p-2">شرح کالا</th>
                            <th className="border border-black p-2 w-20 text-center">تعداد</th>
                            <th className="border border-black p-2 w-24 text-center">وزن (KG)</th>
                            {!hidePrices && <th className="border border-black p-2 w-28 text-center">فی (ریال)</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {tx.items.map((item, idx) => (
                            <tr key={idx}>
                                <td className="border border-black p-2 text-center">{idx + 1}</td>
                                <td className="border border-black p-2 font-bold">{item.itemName}</td>
                                <td className="border border-black p-2 text-center">{item.quantity}</td>
                                <td className="border border-black p-2 text-center">{Number(Number(item.weight).toFixed(2))}</td>
                                {!hidePrices && <td className="border border-black p-2 text-center font-mono">{item.unitPrice ? formatCurrency(item.unitPrice).replace('ریال', '') : '-'}</td>}
                            </tr>
                        ))}
                        <tr className="bg-gray-100 font-bold print:glass-panel">
                            <td colSpan={2} className="border border-black p-2 text-left pl-4">جمع کل:</td>
                            <td className="border border-black p-2 text-center">{tx.items.reduce((a,b)=>a+(Number(b.quantity)||0),0)}</td>
                            <td className="border border-black p-2 text-center">{Number(tx.items.reduce((a,b)=>a+(Number(b.weight)||0),0).toFixed(2))}</td>
                            {!hidePrices && <td className="border border-black p-2 bg-gray-200"></td>}
                        </tr>
                    </tbody>
                </table>
                {tx.description && <div className="mt-4 border p-2 rounded text-sm"><span className="font-bold block mb-1">توضیحات:</span>{tx.description}</div>}
            </div>
            
            {stockInfo.length > 0 && (
                <div className="mt-4 border border-black p-2 rounded text-[10px] relative z-10">
                    <span className="font-bold block mb-1">موجودی اقلام بیجک:</span>
                    <div className="flex flex-wrap gap-4">
                        {stockInfo.map((s, idx) => (
                            <div key={idx} className="flex gap-1 border-r border-black/20 pr-4 first:border-0 first:pr-0">
                                <span className="font-bold bg-gray-100 px-1 rounded">{s.name}:</span>
                                <div>تعداد: {s.qty} / وزن: {Number(s.weight.toFixed(2))} Kg</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-8 pt-4 border-t-2 border-black grid grid-cols-3 gap-4 text-center relative z-10 h-24">
                <div className="flex flex-col items-center justify-between">
                    <div className="mb-1 flex items-center justify-center h-full">
                        <Stamp title="انباردار (ثبت)" name={tx.createdBy || 'کاربر انبار'} color="blue" />
                    </div>
                    <div className="w-full border-t border-gray-400 pt-1 text-[9px] font-bold text-gray-600">امضا انباردار</div>
                </div>
                <div className="flex flex-col items-center justify-between">
                    <div className="mb-1 flex items-center justify-center h-full">
                        {tx.approvedBy ? <Stamp title="تایید مدیریت" name={tx.approvedBy} color="green" /> : <span className="text-gray-300 text-[10px]">منتظر تایید</span>}
                    </div>
                    <div className="w-full border-t border-gray-400 pt-1 text-[9px] font-bold text-gray-600">امضا مدیریت</div>
                </div>
                <div className="flex flex-col items-center justify-between">
                    <div className="mb-1 flex items-center justify-center h-full">
                        <div className="h-10 w-24"></div>
                    </div>
                    <div className="w-full border-t border-gray-400 pt-1 text-[9px] font-bold text-gray-600">امضا تحویل گیرنده</div>
                </div>
            </div>
      </div>
  );

  if (embed) return content;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex flex-col p-0 m-0 overflow-hidden animate-fade-in safe-top safe-bottom">
      {/* Sticky Top Header Bar */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-3 py-2 md:px-6 md:py-2.5 shadow-md flex items-center justify-between gap-2 flex-wrap shrink-0 no-print">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 flex items-center justify-center font-bold text-xs shadow-xs">
            📄
          </div>
          <span className="font-bold text-sm md:text-base text-gray-800 dark:text-gray-100">پیش‌نمایش بیجک ({tx.number})</span>
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
        <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
          {(onApprove || onReject) && (
            <div className="flex items-center gap-1 border-l pl-2 border-gray-200 dark:border-zinc-700">
              {onApprove && (
                <button 
                  onClick={onApprove} 
                  className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center gap-1 text-xs font-bold transition-all active:scale-95 shadow-sm"
                >
                  <CheckCircle size={14}/> تایید
                </button>
              )}
              {onReject && (
                <button 
                  onClick={onReject} 
                  className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center gap-1 text-xs font-bold transition-all active:scale-95 shadow-sm"
                >
                  <XCircle size={14}/> رد
                </button>
              )}
            </div>
          )}

          <button onClick={handleSendToChat} disabled={processing} className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 font-bold shadow-md transition-all disabled:opacity-50 cursor-pointer" title="ارسال مستقیم بیجک به گفتگوی سازمانی">
            {processing ? <Loader2 size={15} className="animate-spin"/> : <MessageSquare size={15}/>}
            <span>ارسال به گفتگو</span>
          </button>

          <button onClick={handleDownloadPDF} disabled={processing} className="bg-red-600 hover:bg-red-700 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 font-bold shadow-md transition-all disabled:opacity-50">
            {processing ? <Loader2 size={15} className="animate-spin"/> : <FileDown size={15}/>}
            <span>دانلود PDF</span>
          </button>

          <button onClick={handlePrint} disabled={processing} className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 font-bold shadow-md transition-all">
            {processing ? <Loader2 size={15} className="animate-spin"/> : <Printer size={15}/>}
            <span className="hidden sm:inline">چاپ</span>
          </button>

          <button onClick={() => { if(warehouseTarget) generateAndSend(warehouseTarget, true, "📦 *حواله خروج (نسخه انبار)*"); else alert(`شماره گروه انبار برای شرکت ${tx.company} تنظیم نشده است.`); }} disabled={processing} className="bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 px-2.5 py-1.5 rounded-xl text-xs font-bold">
            ارسال انبار
          </button>

          <button onClick={() => { if(managerTarget) generateAndSend(managerTarget, false, "📑 *حواله خروج (نسخه مدیریت)*"); else alert(`شماره مدیر فروش برای شرکت ${tx.company} تنظیم نشده است.`); }} disabled={processing} className="bg-green-50 hover:bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 px-2.5 py-1.5 rounded-xl text-xs font-bold">
            ارسال مدیریت
          </button>

          <button onClick={() => setSharePlatform(sharePlatform === 'whatsapp' ? null : 'whatsapp')} className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 border transition-all ${sharePlatform === 'whatsapp' ? 'bg-green-500 text-white border-green-600' : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-green-600 hover:bg-green-50'}`}>
            <Share2 size={13}/> ارسال
          </button>

          <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 p-2 rounded-xl transition-colors" title="بستن">
            <X size={18}/>
          </button>
        </div>
      </header>

      {/* Share Modal Dialog */}
      {sharePlatform && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-2xl shadow-2xl w-full max-w-sm flex flex-col h-[70vh] animate-fade-in bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
            <div className="p-3 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
              <span className="font-bold text-gray-800 dark:text-gray-100 text-sm">انتخاب مخاطب {sharePlatform === 'whatsapp' ? 'واتساپ' : sharePlatform === 'bale' ? 'بله' : 'تلگرام'}</span>
              <button onClick={() => setSharePlatform(null)} className="bg-red-100 text-red-600 rounded-lg p-1.5 hover:bg-red-200"><X size={16}/></button>
            </div>
            <div className="p-3 border-b border-gray-200 dark:border-zinc-800">
              <div className="bg-gray-100 dark:bg-zinc-800 rounded-xl flex items-center px-3 py-2">
                <Search size={16} className="text-gray-400 ml-2"/>
                <input className="bg-transparent w-full outline-none text-xs" placeholder="جستجو نام یا شماره..." autoFocus value={contactSearch} onChange={e => setContactSearch(e.target.value)}/>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {contactsLoading ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2"><Loader2 size={28} className="animate-spin"/> <span className="text-xs">در حال دریافت لیست...</span></div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center text-gray-400 mt-10 text-xs">مخاطبی یافت نشد</div>
              ) : (
                filteredContacts.map(c => {
                  let targetId = c.number;
                  if (sharePlatform === 'telegram') targetId = c.telegramId || c.number;
                  if (sharePlatform === 'bale') targetId = c.baleId || c.number;
                  return (
                    <button key={c.id} onClick={() => {
                      if (!targetId) { alert("آیدی این پلتفرم برای کاربر مورد نظر ثبت نشده است."); return; }
                      generateAndSend(targetId, hidePrices, "📄 *بیجک ارسالی*", sharePlatform);
                    }} className="w-full text-right p-2.5 hover:bg-blue-50 dark:hover:bg-zinc-800/60 rounded-xl flex items-center gap-3 transition-colors group">
                      <div className={`p-2 rounded-full ${c.isGroup ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                        {c.isGroup ? <Users size={16}/> : <Smartphone size={16}/>}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-800 dark:text-gray-200 text-xs group-hover:text-blue-600">{c.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono mt-0.5">{targetId || c.number}</div>
                      </div>
                      <div className="bg-gray-100 dark:bg-zinc-800 px-2.5 py-1 rounded-lg text-xs font-bold text-gray-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">ارسال</div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="p-3 border-t border-gray-200 dark:border-zinc-800">
              <button onClick={() => { const num = prompt("شماره یا شناسه را وارد کنید:"); if(num) generateAndSend(num, hidePrices, "📄 *بیجک ارسالی*", sharePlatform); }} className="w-full border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-200 py-2 rounded-xl text-xs font-bold hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                ورود دستی شماره
              </button>
            </div>
          </div>
        </div>
      )}

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
            width: `${148 * 3.779527559 * scale}px`,
            minHeight: `${209 * 3.779527559 * scale}px`,
            position: 'relative',
            flexShrink: 0,
            margin: 'auto'
          }}>
            <div 
              dir="rtl"
              style={{ 
                width: '148mm', 
                minHeight: '209mm', 
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

export default PrintBijak;
