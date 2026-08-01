
import React, { useState, useEffect, useRef } from 'react';
import { ExitPermit, ExitPermitStatus, SystemSettings, UserRole, SalesContact, User } from '../types';
import { formatDate, formatCurrency, formatIranianPlate } from '../constants';
import { X, Printer, Clock, MapPin, Package, Truck, CheckCircle, XCircle, Share2, Edit, Loader2, Users, Search, FileDown, Minimize2, Maximize2, ZoomIn, ZoomOut, Paperclip, Eye, Image as ImageIcon } from 'lucide-react';
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';
import { generatePdf } from '../utils/pdfGenerator'; 
import html2canvas from 'html2canvas';

interface Props {
  permit: ExitPermit;
  onClose: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  onEdit?: () => void;
  settings?: SystemSettings;
  embed?: boolean; 
  watermark?: 'DELETED' | 'EDITED' | null; 
  showPrice?: boolean;
  mode?: 'PROFORMA' | 'EXIT' | 'CUSTOMER_INVOICE';
  onToggleMode?: (mode: 'PROFORMA' | 'EXIT' | 'CUSTOMER_INVOICE') => void;
}

export default function PrintExitPermit({ permit, onClose, onApprove, onReject, onCancel, onEdit, settings, embed, watermark, showPrice, mode = 'EXIT', onToggleMode }: Props) {
  const [sharePlatform, setSharePlatform] = useState<'whatsapp' | 'telegram' | 'bale' | null>(null);
  const [processing, setProcessing] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [botSubscribers, setBotSubscribers] = useState<any[]>([]);
  const [lightboxImg, setLightboxImg] = useState<{ fileName: string; data: string } | null>(null);

  useEffect(() => {
     apiCall<any[]>('/bot-subscribers').then(setBotSubscribers).catch(() => {});
  }, []);

  // Scaling State
  const [scaleMode, setScaleMode] = useState<'fit' | 'width' | 'custom'>(embed ? 'width' : 'fit');
  const [customZoom, setCustomZoom] = useState(1);
  const [scale, setScale] = useState(1);
  const containerWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      const style = document.getElementById('page-size-style');
      if (style && !embed) { 
          style.innerHTML = '@page { size: A4 portrait; margin: 0; }';
      }
  }, [embed]);

  // Auto-Scale Logic
  useEffect(() => {
    const handleResize = () => {
        if (embed) return;
        const wrapper = containerWrapperRef.current;
        if (wrapper) {
            let wrapperWidth = wrapper.clientWidth;
            // Safeguard: If the modal is animating or not yet visible in DOM, clientWidth might be 0 or tiny.
            // Fall back to window.innerWidth with some margin.
            if (wrapperWidth < 100) {
                wrapperWidth = Math.max(320, window.innerWidth - 32);
            }
            const wrapperHeight = window.innerHeight;
            const targetWidth = 794; 
            const targetHeight = 1120;
            
            let computedScale = 1;
            if (scaleMode === 'fit') {
                const scaleX = Math.max(0.1, (wrapperWidth - 32) / targetWidth);
                const scaleY = Math.max(0.1, (wrapperHeight - 160) / targetHeight); // 160px margin for header and toolbar
                computedScale = Math.min(scaleX, scaleY, 1.2); // Cap at 1.2x to prevent oversized on giant screens
            } else if (scaleMode === 'width') {
                if (wrapperWidth < targetWidth + 40) {
                    computedScale = Math.max(0.1, (wrapperWidth - 32) / targetWidth);
                } else {
                    computedScale = 1;
                }
            } else {
                computedScale = customZoom;
            }
            // Enforce hard boundaries for scale to prevent vanishing/extreme sizes
            setScale(Math.max(0.25, Math.min(2.5, computedScale)));
        }
    };

    handleResize();

    // Trigger multiple delayed updates on mount to capture stable dimensions after transitions
    const timers = [
        setTimeout(handleResize, 50),
        setTimeout(handleResize, 150),
        setTimeout(handleResize, 300),
        setTimeout(handleResize, 600)
    ];

    window.addEventListener('resize', handleResize);

    // Also use ResizeObserver for immediate feedback when container expands
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerWrapperRef.current) {
        resizeObserver = new ResizeObserver(() => {
            handleResize();
        });
        resizeObserver.observe(containerWrapperRef.current);
    }

    return () => {
        window.removeEventListener('resize', handleResize);
        timers.forEach(t => clearTimeout(t));
        if (resizeObserver) {
            resizeObserver.disconnect();
        }
    };
  }, [embed, scaleMode, customZoom]);

  const Stamp = ({ title, name, date, time, isSecurity }: { title: string, name: string, date?: string, time?: string, isSecurity?: boolean }) => (
      <div className={`border-2 ${isSecurity ? 'border-black text-black' : 'border-blue-800 text-blue-800'} rounded-xl p-2 rotate-[-5deg] opacity-90 inline-block glass-panel/80 print:bg-transparent shadow-sm min-w-[90px]`}>
          <div className="text-[10px] font-bold border-b border-current mb-1 pb-1 text-center">{title}</div>
          <div className="text-sm font-black text-center px-2">{name}</div>
          {date && <div className="text-[10px] text-center mt-1">{date}</div>}
          {time && (
              <div className="mt-2 border-t border-dashed border-gray-400 pt-1">
                  <div className="text-[9px] font-bold text-center">ساعت خروج:</div>
                  <div className="text-2xl font-black text-center font-mono">{time}</div>
              </div>
          )}
      </div>
  );

  const containerId = embed ? `print-permit-${permit.id}` : "print-area-exit";

  const handlePrint = () => {
      const style = document.getElementById('page-size-style');
      if (style) {
          style.innerHTML = `
            @page { size: A4 portrait; margin: 0; }
            @media print {
                body * { visibility: hidden; }
                #${containerId}, #${containerId} * { visibility: visible; }
                #${containerId} { 
                    position: absolute; 
                    left: 0; 
                    top: 0; 
                    width: 210mm !important; 
                    height: 296mm !important;
                    margin: 0 !important;
                    padding: 10mm !important;
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
          filename: `Permit_${permit.permitNumber}.pdf`,
          format: 'A4',
          orientation: 'portrait',
          onComplete: () => setProcessing(false),
          onError: () => { alert('خطا در ایجاد PDF'); setProcessing(false); }
      });
  };

  const handleShare = async (targetId: string) => {
      if (!targetId || !sharePlatform) return;
      
      const element = document.getElementById(containerId);
      if (!element) { 
          alert("خطا: المان چاپ پیدا نشد."); 
          return; 
      }
      
      try {
          setProcessing(true);
          const canvas = await html2canvas(element, { 
              scale: 2, 
              backgroundColor: '#ffffff', 
              useCORS: true,
              windowWidth: 1200 
          });
          
          const base64 = canvas.toDataURL('image/png').split(',')[1];
          
          // CAPTION GENERATION MATCHING MANAGEEXITPERMITS LOGIC
          let caption = `🚛 *مجوز خروج کالا*\n🔢 شماره: ${permit.permitNumber}\n📅 تاریخ: ${formatDate(permit.date)}\n👤 گیرنده: ${permit.recipientName}`;
          if (permit.plateNumber) caption += `\n🆔 پلاک: ${formatIranianPlate(permit.plateNumber)}`;
          if (permit.driverName) caption += `\n👨‍✈️ راننده: ${permit.driverName}`;
          if (permit.driverPhone) caption += `\n📞 تماس: ${permit.driverPhone}`;
          if (permit.exitTime) caption += `\n🕒 ساعت خروج: ${permit.exitTime}`;
          
          // Items Detail
          caption += `\n📦 *اقلام:*`;
          if(permit.items && permit.items.length > 0) {
              permit.items.forEach((item, idx) => {
                  const qty = item.deliveredCartonCount ?? item.cartonCount ?? 0;
                  const w = Number(Number(item.deliveredWeight ?? item.weight ?? 0).toFixed(3));
                  caption += `\n${idx+1}. ${item.goodsName}\n   ▫️ تعداد: ${qty} کارتن | وزن: ${w} kg`;
              });
          } else {
              caption += `\n${permit.goodsName}`;
          }
          
          // Totals
          caption += `\n----------------\n`;
          caption += `📊 *جمع کل:*\n`;
          caption += `تعداد: ${permit.cartonCount || 0} کارتن\n`;
          caption += `وزن: ${Number(Number(permit.weight || 0).toFixed(3))} کیلوگرم`;

          if (sharePlatform === 'whatsapp') {
             await apiCall('/send-whatsapp', 'POST', {
                 number: targetId,
                 message: caption,
                 mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_${permit.permitNumber}.png` }
             });
          } else {
             await apiCall('/send-bot-message', 'POST', {
                 platform: sharePlatform,
                 chatId: targetId,
                 caption: caption,
                 mediaData: { data: base64, filename: `Permit_${permit.permitNumber}.png` }
             });
          }
          
          if (!embed) alert('ارسال شد.');
          setSharePlatform(null);
          
      } catch(e: any) { 
          console.error("Share Error:", e);
          alert('خطا در ارسال: ' + (e.message || 'Unknown error')); 
      } finally { 
          setProcessing(false); 
      }
  };

  // Combine Settings Contacts AND Sales Contacts AND Bot Leads into filterable list (For Recipients)
  const combinedContacts = (() => {
    const list: { id: string; name: string; number: string; platform?: string; chatId?: string; isLinked?: boolean }[] = [];
    
    // 1. Sales Contacts (Manual customers)
    (settings?.salesContacts || []).forEach(c => {
        // Try to FIND a matching Bot Lead by mobile (last 10 digits to be safe)
        const lead = botSubscribers.find(s => {
           const sMob = s.mobile ? s.mobile.replace(/\D/g, '').slice(-10) : '';
           const cMob = c.mobile ? c.mobile.replace(/\D/g, '').slice(-10) : '';
           return sMob && cMob && sMob === cMob;
        });
        
        list.push({ 
            id: c.id, 
            name: c.name, 
            number: c.mobile, 
            platform: lead?.platform, 
            chatId: lead?.chatId || c.telegramId || c.baleId,
            isLinked: !!lead
        });
    });

    // 2. Add remaining Bot Leads that aren't linked manually
    botSubscribers.forEach(s => {
        const sMob = s.mobile ? s.mobile.replace(/\D/g, '').slice(-10) : '';
        const alreadyAdded = list.find(l => l.number.replace(/\D/g, '').slice(-10) === sMob);
        
        if (!alreadyAdded) {
            list.push({
                id: s.id || s.chatId,
                name: s.fullName || s.customerName || s.username || 'نامشخص (بات)',
                number: s.mobile || '',
                platform: s.platform,
                chatId: s.chatId,
                isLinked: true
            });
        }
    });

    return list;
  })();

  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  useEffect(() => {
      getUsers().then(setStaffUsers).catch(() => {});
  }, []);

  const filteredStaff = staffUsers.filter(u => 
    u.fullName.toLowerCase().includes(contactSearch.toLowerCase()) || 
    u.phoneNumber?.includes(contactSearch)
  );

  const displayItems = permit.items && permit.items.length > 0 ? permit.items : [{ id: 'legacy', goodsName: permit.goodsName || '', cartonCount: permit.cartonCount || 0, weight: permit.weight || 0, deliveredCartonCount: permit.cartonCount || 0, deliveredWeight: permit.weight || 0 }];
  const displayDestinations = permit.destinations && permit.destinations.length > 0 ? permit.destinations : [{ id: 'legacy', recipientName: permit.recipientName || '', address: permit.destinationAddress || '', phone: '' }];
  
  const totalCartonsReq = displayItems.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
  const totalWeightReq = Number(displayItems.reduce((acc, i) => acc + (Number(i.weight) || 0), 0).toFixed(3));
  const totalCartonsDel = displayItems.reduce((acc, i) => acc + (Number(i.deliveredCartonCount ?? i.cartonCount) || 0), 0);
  const totalWeightDel = Number(displayItems.reduce((acc, i) => acc + (Number(i.deliveredWeight ?? i.weight) || 0), 0).toFixed(3));
  const totalAmount = displayItems.reduce((acc, i) => acc + (Number(i.weight || 0) * (Number(i.price || 0) || Number(permit.price || 0))), 0);
  const showDeliveryColumns = mode === 'EXIT' || (displayItems.some(i => i.deliveredCartonCount !== undefined && i.deliveredCartonCount !== i.cartonCount));

  const currentCompany = (settings?.companies || []).find(c => c.name === permit.company) || (settings?.companies || [])[0];

  const content = (
      <div id={containerId} 
        className="printable-content glass-panel mx-auto shadow-2xl relative text-gray-900 flex flex-col animate-fade-in" 
        style={{ 
            direction: 'rtl', 
            width: '210mm', 
            minHeight: '296mm', 
            padding: '10mm', 
            boxSizing: 'border-box',
            margin: '0 auto',
            backgroundColor: 'white'
        }}>
            {watermark === 'DELETED' && (<div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none overflow-hidden"><div className="border-[12px] border-red-500 text-red-500 font-black text-9xl opacity-40 rotate-[-45deg] p-10 rounded-3xl whitespace-nowrap bg-white/50 backdrop-blur-[2px]">حذف شد</div></div>)}
            {watermark === 'EDITED' && (<div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none overflow-hidden"><div className="border-[12px] border-orange-500 text-orange-500 font-black text-9xl opacity-40 rotate-[-45deg] p-10 rounded-3xl whitespace-nowrap bg-white/50 backdrop-blur-[2px]">اصلاحیه</div></div>)}
            {permit.status === ExitPermitStatus.CANCELED && (<div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none overflow-hidden"><div className="border-[12px] border-red-600 text-red-600 font-black text-8xl opacity-40 rotate-[45deg] p-10 rounded-3xl whitespace-nowrap bg-white/50 backdrop-blur-[2px]">کنسل شد</div></div>)}

            <div className={`flex justify-between items-center ${mode === 'CUSTOMER_INVOICE' ? 'border-b-8 border-blue-900' : 'border-b-4 border-black'} pb-4 mb-4`}>
                <div className="flex items-center gap-4">
                    {currentCompany?.logo && <img src={currentCompany.logo} className="h-20 w-20 object-contain mix-blend-multiply" alt="logo" />}
                    <div className="flex flex-col">
                        <h1 className={`${mode === 'CUSTOMER_INVOICE' ? 'text-4xl text-blue-900' : 'text-3xl text-gray-900'} font-black mb-1`}>
                            {mode === 'CUSTOMER_INVOICE' ? 'فاکتور فروش و تحویل کالا' : (mode === 'PROFORMA' ? 'پیش‌فاکتور فروش کالا' : (permit.status === ExitPermitStatus.EXITED ? 'خروج کارخانه (تکمیل شده)' : 'مجوز خروج کارخانه'))}
                        </h1>
                        <p className={`text-sm font-bold ${mode === 'CUSTOMER_INVOICE' ? 'text-blue-700' : 'text-gray-600'}`}>
                            {mode === 'CUSTOMER_INVOICE' ? (permit.company || settings?.appName || 'شرکت تولیدی بازرگانی') : (mode === 'PROFORMA' ? 'سند موقت فروش و رزرو کالا' : 'سیستم مکانیزه مدیریت بار و خروج')}
                        </p>
                    </div>
                </div>
                <div className="text-left space-y-2">
                    <div className={`text-xl font-black ${mode === 'CUSTOMER_INVOICE' ? 'bg-blue-900 text-white border-blue-900' : 'bg-gray-100 text-gray-800 border-black'} px-4 py-2 border-2 rounded-lg`}>
                        {mode === 'CUSTOMER_INVOICE' ? 'شماره فاکتور: ' : (mode === 'PROFORMA' ? 'شماره فاکتور: ' : 'شماره حواله: ')} {permit.permitNumber}
                    </div>
                    <div className="text-sm font-bold">تاریخ: {formatDate(permit.date)}</div>
                </div>
            </div>
            <div className="flex-1 space-y-6">
                {mode === 'CUSTOMER_INVOICE' ? (
                     <div className="grid grid-cols-2 gap-4">
                        <div className="border-2 border-blue-900 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-blue-900 text-white p-1 text-center font-black text-[10px] uppercase tracking-widest">مشخصات فروشنده</div>
                            <div className="p-3 bg-blue-50/10 space-y-1">
                                <div className="text-lg font-black text-blue-900 leading-tight">{permit.company || settings?.appName || 'شرکت تولیدی و بازرگانی'}</div>
                                <div className="text-[10px] font-bold text-gray-500">آدرس: {currentCompany?.address || 'دفتر مرکزی / کارخانه'}</div>
                                <div className="text-[10px] font-bold text-gray-500">تلفن: {currentCompany?.phone || '-'}</div>
                            </div>
                        </div>
                        <div className="border-2 border-blue-900 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-blue-900 text-white p-1 text-center font-black text-[10px] uppercase tracking-widest">مشخصات مشتری</div>
                            <div className="p-3 bg-blue-50/10 space-y-1">
                                <div className="text-gray-500 font-bold text-[10px] uppercase mb-1">نام گیرنده / مشتری:</div>
                                <div className="text-lg font-black text-blue-900 leading-tight">{permit.recipientName}</div>
                                <div className="text-[10px] font-bold text-gray-500">آدرس مقصد: {displayDestinations[0]?.address || '-'}</div>
                                <div className="text-[10px] font-bold text-gray-500">تلفن همراه: {displayDestinations[0]?.phone || '-'}</div>
                            </div>
                        </div>
                     </div>
                ) : mode === 'PROFORMA' ? (
                    <div className="border-2 border-black rounded-xl overflow-hidden">
                        <div className="bg-gray-100 border-b-2 border-black p-2 text-center font-black text-sm">مشخصات مشتری / متقاضی کالا</div>
                        <div className="p-4 grid grid-cols-2 gap-y-4 gap-x-8 bg-blue-50/10">
                            <div className="flex flex-col">
                                <span className="text-gray-500 font-bold text-[10px] uppercase">نام گیرنده / مشتری:</span>
                                <span className="text-xl font-black text-blue-900">{permit.recipientName || displayDestinations[0]?.recipientName}</span>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-gray-500 font-bold text-[10px] uppercase">وضعیت سند:</span>
                                <span className="text-sm font-black text-blue-700 bg-blue-100 px-3 py-1 rounded-full inline-block mr-auto">{permit.status === ExitPermitStatus.EXITED ? 'تکمیل شده' : permit.status}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1"><h3 className="font-black text-lg flex items-center gap-2"><MapPin size={20}/> مشخصات گیرنده و مقصد</h3>
                        <div className="border-2 border-black rounded-xl p-3 bg-gray-50 text-sm space-y-2">
                            {displayDestinations.map((dest, idx) => (
                                <div key={idx} className="border-b-2 border-gray-200/50 pb-2 last:border-0 last:pb-0">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div><span className="font-bold text-gray-500 ml-2">نام گیرنده:</span> <span className="font-bold text-lg">{dest.recipientName}</span></div>
                                        <div><span className="font-bold text-gray-500 ml-2">شماره تماس:</span> <span className="font-mono dir-ltr">{dest.phone || '-'}</span></div>
                                    </div>
                                    <div className="mt-1"><span className="font-bold text-gray-500 ml-2">آدرس مقصد:</span> <span className="font-medium">{dest.address}</span></div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className="space-y-1"><h3 className="font-black text-lg flex items-center gap-2"><Package size={20}/> {(mode === 'PROFORMA' || mode === 'CUSTOMER_INVOICE') ? 'شرح ردیف‌های فروش' : 'لیست اقلام و کالاها'}</h3>
                    <table className={`w-full text-sm border-collapse border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} text-center shadow-sm`}>
                        <thead>
                            <tr className={`${mode === 'CUSTOMER_INVOICE' ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-900'} text-base`}>
                                <th className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} p-2 w-10`} rowSpan={2}>#</th>
                                <th className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} p-2 text-center`} rowSpan={2}>شرح کالا / محصول</th>
                                <th className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} p-1`} colSpan={showDeliveryColumns ? 2 : 1}>تعداد (کارتن)</th>
                                <th className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} p-1`} colSpan={showDeliveryColumns ? 2 : 1}>وزن (KG)</th>
                                {(mode === 'PROFORMA' || mode === 'CUSTOMER_INVOICE') && (showPrice || mode === 'CUSTOMER_INVOICE') && (
                                    <>
                                        <th className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} p-1 w-24`} rowSpan={2}>فی (ریال)</th>
                                        <th className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} p-1 w-32`} rowSpan={2}>مبلغ کل</th>
                                    </>
                                )}
                            </tr>
                            {showDeliveryColumns && (
                                <tr className="bg-gray-50 text-gray-800 text-xs">
                                    <th className="border-2 border-black p-1 text-gray-500 w-20">درخواستی</th>
                                    <th className="border-2 border-black p-1 w-20 bg-green-50 text-green-800">خروجی</th>
                                    <th className="border-2 border-black p-1 text-gray-500 w-20">درخواستی</th>
                                    <th className="border-2 border-black p-1 w-20 bg-green-50 text-green-800">خروجی</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {displayItems.map((item, idx) => {
                                 const itemPrice = item.price || permit.price || 0;
                                 const deliveredWeight = Number(item.deliveredWeight ?? item.weight) || 0;
                                 return (
                                <tr key={idx} className="text-base hover:bg-gray-50 transition-colors">
                                    <td className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} p-2`}>{idx + 1}</td>
                                    <td className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} p-2 font-bold text-center align-middle`}>{item.goodsName}</td>
                                    {showDeliveryColumns ? (
                                        <>
                                            <td className="border-2 border-black p-2 font-mono text-gray-400 bg-gray-50/50">{item.cartonCount}</td>
                                            <td className="border-2 border-black p-2 font-mono font-bold bg-green-50/30">{item.deliveredCartonCount ?? item.cartonCount}</td>
                                            <td className="border-2 border-black p-2 font-mono text-gray-400 bg-gray-50/50">{Number(Number(item.weight).toFixed(3))}</td>
                                            <td className="border-2 border-black p-2 font-mono font-bold bg-green-50/30">{Number(Number(item.deliveredWeight ?? item.weight).toFixed(3))}</td>
                                        </>
                                    ) : (
                                        <>
                                            <td className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} p-2 font-mono font-bold`}>{item.cartonCount}</td>
                                            <td className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} p-2 font-mono font-bold`}>{Number(deliveredWeight.toFixed(3))}</td>
                                            {(mode === 'PROFORMA' || mode === 'CUSTOMER_INVOICE') && (showPrice || mode === 'CUSTOMER_INVOICE') && (
                                                <>
                                                <td className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900 font-black text-lg' : 'border-black'} p-2 font-mono`}>{formatCurrency(itemPrice)}</td>
                                                <td className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900 bg-blue-50 text-blue-900 font-black text-lg' : 'border-black'} p-2 font-mono font-bold`}>{formatCurrency(deliveredWeight * itemPrice)}</td>
                                                </>
                                            )}
                                        </>
                                    )}
                                </tr>
                            )})}
                            <tr className={`${mode === 'CUSTOMER_INVOICE' ? 'bg-blue-50 text-blue-900' : 'bg-gray-100'} text-base font-black`}>
                                <td colSpan={2} className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} p-2 text-left pl-6`}>جمع کل فاکتور:</td>
                                {showDeliveryColumns ? (
                                    <>
                                        <td className="border-2 border-black p-2 font-mono text-gray-500">{totalCartonsReq}</td>
                                        <td className="border-2 border-black p-2 font-mono text-black">{totalCartonsDel}</td>
                                        <td className="border-2 border-black p-2 font-mono text-gray-500">{totalWeightReq}</td>
                                        <td className="border-2 border-black p-2 font-mono text-black">{totalWeightDel}</td>
                                    </>
                                ) : (
                                    <>
                                        <td className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} p-2 font-mono`}>{totalCartonsReq}</td>
                                        <td className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} p-2 font-mono`}>{totalWeightDel}</td>
                                        {(mode === 'PROFORMA' || mode === 'CUSTOMER_INVOICE') && (showPrice || mode === 'CUSTOMER_INVOICE') && (
                                            <>
                                                <td className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} p-2 font-mono`}>-</td>
                                                <td className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900 bg-blue-900 text-white font-black text-xl' : 'border-black bg-blue-100 text-blue-900'} p-2 font-mono`}>{formatCurrency(totalAmount)} ریال</td>
                                            </>
                                        )}
                                    </>
                                )}
                            </tr>
                        </tbody>
                    </table>
                </div>

                {(mode === 'EXIT' || mode === 'CUSTOMER_INVOICE') && (permit.driverName || permit.plateNumber) && (
                    <div className="space-y-1">
                        <h3 className="font-black text-lg flex items-center gap-2"><Truck size={20}/> {mode === 'CUSTOMER_INVOICE' ? 'اطلاعات حمل و راننده' : 'مشخصات حمل'}</h3>
                        <div className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900 bg-blue-50/30' : 'border-black bg-gray-50'} rounded-xl p-3 text-sm grid grid-cols-3 gap-4`}>
                            <div className="flex flex-col"><span className="font-bold text-gray-500 text-[9px] uppercase">نام راننده:</span> <span className="font-black text-lg text-blue-900">{permit.driverName || 'نامشخص'}</span></div>
                            <div className="flex flex-col"><span className="font-bold text-gray-500 text-[9px] uppercase">شماره پلاک:</span> <span className="font-mono font-black text-lg dir-ltr text-blue-900">{permit.plateNumber ? formatIranianPlate(permit.plateNumber) : '-'}</span></div>
                            <div className="flex flex-col"><span className="font-bold text-gray-500 text-[9px] uppercase">تلفن همراه راننده:</span> <span className="font-mono font-black text-lg dir-ltr text-blue-900">{permit.driverPhone || '-'}</span></div>
                        </div>
                    </div>
                )}
                
                {permit.description && (<div className="space-y-1"><h3 className="font-black text-lg">توضیحات فاکتور</h3><div className={`border-2 ${mode === 'CUSTOMER_INVOICE' ? 'border-blue-900' : 'border-black'} rounded-xl p-3 glass-panel text-sm min-h-[40px]`}>{permit.description}</div></div>)}

                {permit.attachments && permit.attachments.length > 0 && (
                    <div className="space-y-2 my-3 border-t border-b border-emerald-100 py-3">
                        <h3 className="font-black text-sm flex items-center gap-2 text-gray-800">
                            <Paperclip size={18} className="text-emerald-600" />
                            <span>تصاویر و مدارک پیوست (قبض باسکول، عکس بار و اسناد) ({permit.attachments.length} فایل)</span>
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-emerald-50/40 p-3 rounded-2xl border-2 border-emerald-200">
                            {permit.attachments.map((att, idx) => {
                                const isImg = att.data?.startsWith('data:image/') || /\.(jpg|jpeg|png|webp)$/i.test(att.fileName);
                                return (
                                    <div key={idx} className="bg-white rounded-xl p-2 border border-emerald-100 shadow-sm flex flex-col items-center justify-between gap-2 group hover:shadow-md transition-all">
                                        {isImg ? (
                                            <div className="w-full h-24 rounded-lg overflow-hidden relative cursor-pointer group/img bg-gray-100" onClick={() => setLightboxImg(att)}>
                                                <img src={att.data} alt={att.fileName} className="w-full h-full object-cover group-hover/img:scale-105 transition-transform" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 no-print">
                                                    <Eye size={16} /> مشاهده
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-full h-24 rounded-lg bg-emerald-50 flex flex-col items-center justify-center text-emerald-700 p-2">
                                                <Paperclip size={28} className="mb-1" />
                                                <span className="text-[10px] font-bold text-center line-clamp-2" dir="ltr">{att.fileName}</span>
                                            </div>
                                        )}
                                        <div className="w-full flex items-center justify-between gap-1 pt-1 border-t border-gray-100">
                                            <span className="text-[10px] font-mono text-gray-600 truncate flex-1" dir="ltr" title={att.fileName}>{att.fileName}</span>
                                            <a 
                                                href={att.data} 
                                                download={att.fileName || `Attachment_${idx + 1}`} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="p-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors shrink-0 no-print"
                                                title="دانلود فایل"
                                            >
                                                <FileDown size={12} />
                                            </a>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            <div className={`mt-auto pt-4 ${mode === 'CUSTOMER_INVOICE' || mode === 'PROFORMA' ? 'border-t-4 border-blue-900' : 'border-t-4 border-black'} grid ${mode === 'CUSTOMER_INVOICE' || mode === 'PROFORMA' ? 'grid-cols-5' : 'grid-cols-6'} gap-2 text-center items-end`}>
                {(mode === 'CUSTOMER_INVOICE' || mode === 'PROFORMA') ? (
                    <>
                        <div className="col-span-2 flex flex-col items-start justify-between min-h-[140px] p-3 bg-blue-50/20 rounded-xl border border-blue-100 mt-2">
                             <div className="text-[11px] font-black text-blue-900 mb-2 border-b-2 border-blue-200 w-full pb-1">توضیحات و شرایط قانونی فاکتور:</div>
                             <div className="text-[11px] text-gray-700 text-right leading-relaxed font-bold">
                                 ۱. کالا طبق فاکتور صحیح و سالم و مطابق با استانداردهای سفارش تحویل گردید.<br/>
                                 ۲. هرگونه مغایرت وزنی یا تعدادی باید در لحظه بارگیری و خروج از کارخانه اعلام گردد.<br/>
                                 ۳. امضا و تایید این سند به منزله تسلیم قطعی کالا و سلب هرگونه ادعای بعدی است.
                             </div>
                        </div>
                        <div className="col-span-1"></div>
                        <div className="col-span-1 flex flex-col items-center justify-between min-h-[140px] border-r-2 border-blue-900/10 mt-2">
                             <div className="text-[11px] font-black text-blue-900 mb-auto">مهر و امضای فروشنده</div>
                             <div className="mb-8 text-sm font-black text-gray-200 uppercase tracking-[0.2em] leading-none border-4 border-dashed border-gray-100 p-6 rounded-full rotate-[-10deg]">VOUCHER SEAL</div>
                        </div>
                        <div className="col-span-1 flex flex-col items-center justify-between min-h-[140px] border-r-2 border-blue-900/10 mt-2">
                             <div className="text-[11px] font-black text-blue-900 mb-auto">مهر و امضای خریدار / مشتری</div>
                             <div className="mb-8 text-sm font-black text-gray-200 uppercase tracking-[0.2em] leading-none border-4 border-dashed border-gray-100 p-6 rounded-full rotate-[10deg]">CONFIRM SIGN</div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="flex flex-col items-center justify-between min-h-[80px]"><div className="mb-2 flex items-center justify-center h-full"><Stamp title="مدیر فروش" name={permit.requester} /></div><div className="w-full border-t-2 border-gray-400 pt-1 text-[10px] font-bold text-gray-600">مدیرفروش/ثبت سفارش</div></div>
                        
                        <div className="flex flex-col items-center justify-between min-h-[80px]"><div className="mb-2 flex items-center justify-center h-full">{permit.approverCeo ? <Stamp title="مدیریت" name={permit.approverCeo} /> : <span className="text-gray-300 text-xs">---</span>}</div><div className="w-full border-t-2 border-gray-400 pt-1 text-[10px] font-bold text-gray-600">مدیرعامل</div></div>
                        
                        <div className="flex flex-col items-center justify-between min-h-[80px]"><div className="mb-2 flex items-center justify-center h-full">{permit.approverFactory ? <Stamp title="مدیر کارخانه" name={permit.approverFactory} /> : <span className="text-gray-300 text-xs">---</span>}</div><div className="w-full border-t-2 border-gray-400 pt-1 text-[10px] font-bold text-gray-600">مدیر کارخانه</div></div>
                        
                        <div className="flex flex-col items-center justify-between min-h-[80px]"><div className="mb-2 flex items-center justify-center h-full">{permit.approverWarehouse ? <Stamp title="تحویل انبار" name={permit.approverWarehouse} /> : <span className="text-gray-300 text-xs">---</span>}</div><div className="w-full border-t-2 border-gray-400 pt-1 text-[10px] font-bold text-gray-600">سرپرست انبار</div></div>
                        
                        <div className="flex flex-col items-center justify-between min-h-[80px]">
                            <div className="mb-2 flex items-center justify-center h-full">
                                {(mode === 'EXIT' || mode === 'PROFORMA') && permit.approverSecurity ? 
                                    <Stamp 
                                        title="سرپرست انتظامات" 
                                        name={permit.approverSecurity} 
                                        time={permit.exitTime} 
                                        isSecurity={true}
                                    /> 
                                    : <div className="border-2 border-dashed border-gray-300 rounded-xl p-2 h-16 w-20 flex items-center justify-center text-gray-300 text-[9px]">امضاء انتظامات</div>
                                }
                            </div>
                            <div className="w-full border-t-2 border-black pt-1 text-[10px] font-black text-black">سرپرست انتظامات</div>
                        </div>

                        <div className="flex flex-col items-center justify-between min-h-[80px]">
                            <div className="mb-2 flex items-center justify-center h-full">
                                {(mode === 'EXIT' || mode === 'PROFORMA') && permit.approverFactoryFinal ? 
                                    <Stamp 
                                        title="مدیریت (نهایی)" 
                                        name={permit.approverFactoryFinal} 
                                    /> 
                                    : <div className="border-2 border-dashed border-gray-300 rounded-xl p-2 h-16 w-20 flex items-center justify-center text-gray-300 text-[9px]">امضاء نهایی</div>
                                }
                            </div>
                            <div className="w-full border-t-2 border-black pt-1 text-[10px] font-black text-black">تایید نهایی خروج</div>
                        </div>
                    </>
                )}
            </div>
            
            <div className="mt-2 border-t border-gray-300 text-[9px] text-gray-500 text-center">
                نسخه چاپی سیستم
            </div>
      </div>
  );

  if (embed) return content;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex flex-col items-center pt-6 md:pt-10 pb-16 md:pb-20 overflow-y-auto overflow-x-hidden justify-start p-2 animate-fade-in safe-pb">
        <div className="bg-white p-3 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex flex-wrap items-center justify-between gap-3 w-full max-w-5xl no-print mb-6 sticky top-0 z-[10000] border-2 border-blue-100 backdrop-blur-xl bg-white/95">
            <div className="flex items-center gap-3">
                <button onClick={onClose} className="p-2 hover:bg-red-50 rounded-xl text-gray-400 hover:text-red-500 transition-all active:scale-95"><X size={20}/></button>
                <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div>
                <div className="hidden sm:flex flex-col">
                    <span className="font-black text-[12px] text-gray-900 tracking-tight">مشاهده فرم</span>
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{permit.permitNumber}</span>
                </div>
            </div>

            {onToggleMode && (
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button 
                        onClick={() => onToggleMode('PROFORMA')} 
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'PROFORMA' || mode === 'CUSTOMER_INVOICE' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}
                    >
                        فاکتور
                    </button>
                    <button 
                        onClick={() => onToggleMode('EXIT')} 
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${mode === 'EXIT' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500 hover:bg-gray-200'}`}
                    >
                        خروج
                    </button>
                </div>
            )}

            {/* Zoom / Scale Controls */}
            {!embed && (
                <div className="flex items-center gap-1.5 bg-gray-100/80 dark:bg-gray-800/80 p-1 rounded-xl border border-gray-200/50 dark:border-white/5 no-print">
                    <button
                        type="button"
                        title="نمایش یکجای کل صفحه بدون اسکرول"
                        onClick={() => setScaleMode('fit')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                            scaleMode === 'fit' 
                                ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400 font-black border border-blue-100 dark:border-blue-900/30' 
                                : 'text-gray-600 hover:bg-white/50'
                        }`}
                    >
                        <Minimize2 size={13} />
                        <span className="hidden md:inline">نمایش یکجا</span>
                    </button>
                    <button
                        type="button"
                        title="برازش پهنای صفحه"
                        onClick={() => setScaleMode('width')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer ${
                            scaleMode === 'width' 
                                ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400 font-black border border-blue-100 dark:border-blue-900/30' 
                                : 'text-gray-600 hover:bg-white/50'
                        }`}
                    >
                        <Maximize2 size={13} />
                        <span className="hidden md:inline">برازش پهنا</span>
                    </button>
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                    <button
                        type="button"
                        title="کوچک‌نمایی"
                        onClick={() => {
                            setScaleMode('custom');
                            setCustomZoom(prev => Math.max(0.3, prev - 0.1));
                        }}
                        className="p-1 text-gray-500 hover:bg-white/50 rounded-lg transition-all cursor-pointer"
                    >
                        <ZoomOut size={13} />
                    </button>
                    <span className="text-[10px] font-black font-mono text-gray-700 min-w-[34px] text-center" dir="ltr">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        type="button"
                        title="بزرگ‌نمایی"
                        onClick={() => {
                            setScaleMode('custom');
                            setCustomZoom(prev => Math.min(2.0, prev + 0.1));
                        }}
                        className="p-1 text-gray-500 hover:bg-white/50 rounded-lg transition-all cursor-pointer"
                    >
                        <ZoomIn size={13} />
                    </button>
                </div>
            )}

            <div className="flex items-center gap-2 flex-wrap justify-center">
                {(onApprove || onReject || onCancel) && (
                    <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200/50">
                        {onApprove && <button onClick={onApprove} className="px-5 py-2 bg-emerald-600 text-white rounded-lg flex items-center gap-2 text-[12px] font-black transition-all shadow-md shadow-emerald-500/20 active:scale-95 hover:bg-emerald-700 hover:shadow-lg"><CheckCircle size={14}/> تایید و صدور</button>}
                        {onReject && <button onClick={onReject} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-lg flex items-center gap-2 text-[12px] font-black transition-all active:scale-95 hover:bg-rose-100"><XCircle size={14}/> رد درخواست</button>}
                        {onCancel && <button onClick={onCancel} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-[12px] font-black transition-all active:scale-95 hover:bg-red-100"><XCircle size={14}/> ابطال/کنسلی خروج</button>}
                    </div>
                )}
                
                <div className="flex items-center gap-2">
                    <button onClick={handleDownloadPDF} disabled={processing} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-[12px] font-black hover:bg-gray-200 flex items-center gap-2 transition-all active:scale-95">{processing ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>} دریافت PDF</button>
                    <button onClick={handlePrint} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-[12px] font-black hover:bg-blue-700 flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all active:scale-95"><Printer size={14}/> چاپ</button>
                    {onEdit && <button onClick={onEdit} className="bg-amber-50 text-amber-600 px-4 py-2 rounded-lg text-[12px] font-black hover:bg-amber-100 flex items-center gap-2 border border-amber-200 transition-all active:scale-95"><Edit size={14}/> اصلاح</button>}
                    
                    <div className="h-6 w-px bg-gray-200 mx-1 hidden lg:block"></div>
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setSharePlatform(sharePlatform === 'whatsapp' ? null : 'whatsapp')} className={`p-2 rounded-xl border transition-all active:scale-95 ${sharePlatform === 'whatsapp' ? 'bg-green-500 text-white border-green-600 shadow-lg shadow-green-500/30' : 'bg-white border-gray-100 text-green-600 hover:bg-green-50'}`} title="واتساپ"><Share2 size={18}/></button>
                        <button onClick={() => setSharePlatform(sharePlatform === 'bale' ? null : 'bale')} className={`p-2 rounded-xl border transition-all active:scale-95 ${sharePlatform === 'bale' ? 'bg-green-600 text-white border-green-700 shadow-lg shadow-green-600/30' : 'bg-white border-gray-100 text-green-700 hover:bg-green-50'}`} title="بله"><Share2 size={18}/></button>
                        <button onClick={() => setSharePlatform(sharePlatform === 'telegram' ? null : 'telegram')} className={`p-2 rounded-xl border transition-all active:scale-95 ${sharePlatform === 'telegram' ? 'bg-blue-500 text-white border-blue-600 shadow-lg shadow-blue-500/30' : 'bg-white border-gray-100 text-blue-600 hover:bg-blue-50'}`} title="تلگرام"><Share2 size={18}/></button>
                    </div>
                </div>
            </div>

            {sharePlatform && (
                 <div className="w-full mt-3 p-1 animate-scale-in origin-top">
                     <div className="glass-panel rounded-2xl shadow-xl border border-blue-100 overflow-hidden bg-white/70 backdrop-blur-3xl">
                         <div className="px-4 py-3 border-b bg-blue-50/50 flex justify-between items-center">
                             <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${sharePlatform === 'telegram' ? 'bg-blue-500' : 'bg-green-500'} animate-pulse`}></div>
                                <span className="text-xs font-black text-gray-700">ارسال به {sharePlatform === 'whatsapp' ? 'واتساپ' : sharePlatform === 'bale' ? 'بله' : 'تلگرام'}</span>
                             </div>
                             <button onClick={() => setSharePlatform(null)} className="p-1 px-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X size={16}/></button>
                         </div>
                         <div className="px-3 py-2 border-b bg-gray-50/50">
                             <div className="relative">
                                 <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
                                 <input 
                                     type="text" 
                                     placeholder="جستجوی همکار یا مشتری..." 
                                     className="w-full pr-9 pl-4 py-2 bg-white border border-gray-100 rounded-xl text-xs focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                     value={contactSearch}
                                     onChange={(e) => setContactSearch(e.target.value)}
                                 />
                             </div>
                         </div>
                         <div className="max-h-60 overflow-y-auto custom-scrollbar">
                             {/* Staff List */}
                             <div className="px-4 py-2 bg-gray-100 text-[10px] font-bold text-gray-400">کاربران نرم افزار (گروه های بله/تلگرام)</div>
                             {filteredStaff.map(u => {
                                 const targetId = u.phoneNumber || (u as any).telegramId || (u as any).baleId || (u as any).telegramChatId || (u as any).baleChatId;
                                 return (
                                     <button 
                                         key={u.id} 
                                         onClick={() => { if(!targetId){alert("شناسه تنظیم نشده است");return;} handleShare(targetId); }} 
                                         className="w-full text-right px-4 py-3 hover:bg-blue-50/50 text-xs flex justify-between items-center border-b border-gray-50 last:border-0 transition-colors group"
                                     >
                                         <div className="flex flex-col">
                                             <div className="flex items-center gap-2">
                                                 <span className="font-bold text-gray-800">{u.fullName}</span>
                                                 <span className="text-[8px] bg-gray-100 text-gray-600 px-1 rounded">{u.role}</span>
                                             </div>
                                             <span className="text-[9px] text-gray-400 font-mono mt-0.5">{targetId}</span>
                                         </div>
                                         <div className="opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all">
                                             <div className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black shadow-sm flex items-center gap-1">ارسال <Share2 size={10}/></div>
                                         </div>
                                     </button>
                                 );
                             })}

                             {/* Customers / Leads */}
                             <div className="px-4 py-2 bg-gray-100 text-[10px] font-bold text-gray-400 mt-2">مشتریان و لیدهای بات</div>
                             {combinedContacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.number.includes(contactSearch)).map(c => {
                                 const targetId = c.chatId || c.number;
                                 return (
                                     <button 
                                         key={c.id} 
                                         onClick={() => handleShare(targetId)} 
                                         className="w-full text-right px-4 py-3 hover:bg-blue-50/50 text-xs flex justify-between items-center border-b border-gray-50 last:border-0 transition-colors group"
                                     >
                                         <div className="flex flex-col">
                                             <div className="flex items-center gap-2">
                                                 <span className="font-bold text-gray-800">{c.name}</span>
                                                 {c.isLinked && <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" title="متصل به ربات"></div>}
                                             </div>
                                             <span className="text-[9px] text-gray-400 font-mono mt-0.5">{targetId}</span>
                                             {c.platform && <span className="text-[8px] bg-blue-100 text-blue-600 px-1 inline-block w-fit rounded mt-0.5">{c.platform}</span>}
                                             {!c.chatId && <span className="text-[7px] text-orange-500 font-bold mt-0.5">⚠️ بدون Chat ID (ارسال دستی)</span>}
                                         </div>
                                         <div className="opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all">
                                             <div className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black shadow-sm flex items-center gap-1">ارسال <Share2 size={10}/></div>
                                         </div>
                                     </button>
                                 );
                             })}
                             
                             {filteredStaff.length === 0 && combinedContacts.filter(c => c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.number.includes(contactSearch)).length === 0 && (
                                 <div className="p-8 text-center text-gray-400 text-[11px] font-bold">موردی یافت نشد.</div>
                             )}
                         </div>
                         <div className="p-3 bg-gray-50/50 border-t">
                            <button onClick={() => { const n = prompt('شناسه یا شماره مقصد:'); if(n) handleShare(n); }} className="w-full text-center py-2.5 text-[10px] text-blue-600 font-black hover:bg-blue-100/50 rounded-xl border border-blue-200 border-dashed transition-all active:scale-[0.98]">ارسال به شماره یا شناسه‌ی دستی</button>
                         </div>
                     </div>
                 </div>
            )}
            </div>

        {/* Responsive Wrapper */}
        <div className="order-2 w-full flex justify-center pb-10" ref={containerWrapperRef}>
            <div style={{ 
              width: `${scale * 794}px`,
              height: `${scale * 1120}px`,
              overflow: 'hidden',
              position: 'relative',
              borderRadius: '12px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
              transition: 'all 0.1s ease-out'
            }}>
                <div style={{ 
                  width: '794px', 
                  height: '1120px',
                  backgroundColor: 'white', 
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                  top: 0,
                  left: 0
                }}>
                    {content}
                </div>
            </div>
        </div>

        {lightboxImg && (
            <div className="fixed inset-0 z-[100000] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fade-in" onClick={() => setLightboxImg(null)}>
                <div className="relative max-w-4xl w-full max-h-[85vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between w-full mb-3 text-white">
                        <span className="font-mono text-xs truncate max-w-md" dir="ltr">{lightboxImg.fileName}</span>
                        <div className="flex items-center gap-2">
                            <a href={lightboxImg.data} download={lightboxImg.fileName || 'Attachment'} className="bg-emerald-600 text-white px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-700 shadow-md">
                                <FileDown size={14} /> دانلود فایل
                            </a>
                            <button onClick={() => setLightboxImg(null)} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                    <img src={lightboxImg.data} alt="" className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl border-2 border-white/20" />
                </div>
            </div>
        )}
    </div>
  );
};
