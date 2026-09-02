import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExitPermit, ExitPermitStatus, ExitPermitItem, ExitPermitDestination, UserRole, SalesContact, SystemSettings } from '../types';
import { editExitPermit, getSettings, uploadFileChunked } from '../services/storageService';
import { generateUUID, getShamsiDateFromIso, jalaliToGregorian, getCurrentShamsiDate } from '../constants';
import { Save, Loader2, Truck, Package, MapPin, Hash, Plus, Trash2, X, AlertTriangle, Paperclip, Database, Download, Eye } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import { getUsers } from '../services/authService';
import { apiCall } from '../services/apiService';
import { searchSayanPersons } from '../services/sayanExitService';
import html2canvas from 'html2canvas';
import { FileViewerModal } from './FileViewerModal';

interface EditExitPermitModalProps {
  permit: ExitPermit;
  onClose: () => void;
  onSave: () => void;
}

const EditExitPermitModal: React.FC<EditExitPermitModalProps> = ({ permit, onClose, onSave }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialShamsi = getShamsiDateFromIso(permit.date);
  const [shamsiDate, setShamsiDate] = useState({ year: initialShamsi.year, month: initialShamsi.month, day: initialShamsi.day });
  const [permitNumber, setPermitNumber] = useState(permit.permitNumber.toString());
  
  const [items, setItems] = useState<ExitPermitItem[]>(
    permit.items && permit.items.length > 0 
      ? permit.items 
      : [{ id: generateUUID(), goodsName: permit.goodsName || '', cartonCount: permit.cartonCount || 0, weight: permit.weight || 0, price: permit.price || 0 }]
  );

  const [destinations, setDestinations] = useState<ExitPermitDestination[]>(
    permit.destinations && permit.destinations.length > 0 
      ? permit.destinations 
      : [{ id: generateUUID(), recipientName: permit.recipientName || '', address: permit.destinationAddress || '', phone: '', sayanPersonCode: permit.sayanPersonCode, sayanTafsiliCode: permit.sayanTafsiliCode }]
  );

  const [driverInfo, setDriverInfo] = useState({ 
    plateNumber: permit.plateNumber || '', 
    driverName: permit.driverName || '', 
    description: permit.description || '' 
  });
  
  const [attachments, setAttachments] = useState<{ fileName: string; data: string }[]>(permit.attachments || []);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; fileName: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingPermits, setExistingPermits] = useState<ExitPermit[]>([]);

  // Sayan & Contacts autocomplete states
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [savedContacts, setSavedContacts] = useState<SalesContact[]>([]);
  const [botSubscribers, setBotSubscribers] = useState<any[]>([]);
  const [sayanSearching, setSayanSearching] = useState(false);
  const [contactSuggestions, setContactSuggestions] = useState<any[]>([]);
  const [activeSuggestDestId, setActiveSuggestDestId] = useState<string | null>(null);

  // Hidden capture state for WhatsApp auto-send
  const [tempPermitForCapture, setTempPermitForCapture] = useState<ExitPermit | null>(null);

  useEffect(() => {
    // Scroll container to top
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }

    // Lock body scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Load settings, contacts, bot subscribers, and permits
    getSettings().then(s => {
      setSettings(s);
      setSavedContacts(s.salesContacts || []);
    }).catch(console.error);

    apiCall<ExitPermit[]>('/exit-permits').then(res => {
      if (Array.isArray(res)) setExistingPermits(res);
    }).catch(console.error);

    apiCall<any[]>('/bot-subscribers').then(res => {
      if (Array.isArray(res)) setBotSubscribers(res);
    }).catch(console.error);

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const handleRecipientChange = async (destId: string, val: string) => {
    setDestinations(prev => prev.map(d => d.id === destId ? { ...d, recipientName: val } : d));
    setActiveSuggestDestId(destId);

    if (val.trim().length > 1) {
      const contacts = savedContacts.filter(c => (c.name && c.name.includes(val)) || (c.mobile && c.mobile.includes(val)));
      const leads = botSubscribers.filter(l => (l.fullName && l.fullName.includes(val)) || (l.mobile && l.mobile.includes(val)));
      
      const merged: any[] = [...contacts];
      leads.forEach(l => {
        const mobile = l.mobile?.replace(/^0/, '') || '';
        const exists = merged.some(m => m.mobile?.replace(/^0/, '') === mobile);
        if (!exists) {
          merged.push({
            id: l.id,
            name: l.fullName || 'بدون نام',
            mobile: l.mobile || '',
            isLead: true
          });
        }
      });

      setContactSuggestions(merged);

      if (settings?.sayanOnlineExitPermitsEnabled) {
        setSayanSearching(true);
        try {
          const sayanPersons = await searchSayanPersons(val);
          if (sayanPersons && sayanPersons.length > 0) {
            const sayanItems = sayanPersons.map(sp => ({
              id: `sayan-${sp.personCode || sp.id}`,
              name: sp.name,
              mobile: sp.mobile || '',
              address: sp.address || '',
              personCode: sp.personCode,
              tafsiliCode: sp.tafsiliCode || sp.accountingCode,
              isSayan: true
            }));
            setContactSuggestions([...sayanItems, ...merged]);
          }
        } catch (err) {
          console.warn('Sayan live search error in edit modal:', err);
        } finally {
          setSayanSearching(false);
        }
      }
    } else {
      setContactSuggestions([]);
    }
  };

  const selectContact = (destId: string, contact: any) => {
    setDestinations(prev => prev.map(d => {
      if (d.id === destId) {
        return {
          ...d,
          recipientName: contact.name,
          phone: contact.mobile || d.phone,
          address: contact.address || d.address,
          sayanPersonCode: contact.personCode || d.sayanPersonCode,
          sayanTafsiliCode: contact.tafsiliCode || d.sayanTafsiliCode,
        };
      }
      return d;
    }));
    setContactSuggestions([]);
    setActiveSuggestDestId(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingFiles(true);
    for (const file of files) {
      if (file.size > 150 * 1024 * 1024) {
        alert(`حجم فایل ${file.name} بیشتر از ۱۵۰ مگابایت است.`);
        continue;
      }
      try {
        const res = await uploadFileChunked(file, () => {});
        setAttachments(prev => [...prev, { fileName: res.fileName, data: res.url }]);
      } catch (err) {
        console.error(err);
        alert(`خطا در آپلود فایل ${file.name}`);
      }
    }
    setUploadingFiles(false);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleNumberBlur = () => {
    if (permitNumber && permit.company) {
      const isDuplicate = existingPermits.some(p => 
        p.id !== permit.id &&
        p.company === permit.company && 
        p.permitNumber === parseInt(permitNumber)
      );
      if (isDuplicate) {
        alert(`⚠️ شماره ${permitNumber} قبلاً برای شرکت ${permit.company} ثبت شده است. در حال جستجوی اولین شماره خالی...`);
        apiCall<{ nextNumber: number }>(`/next-exit-permit-number?company=${encodeURIComponent(permit.company)}&t=${Date.now()}`)
          .then(res => {
            if (res && res.nextNumber) setPermitNumber(res.nextNumber.toString());
          });
      }
    }
  };

  const getIsoDate = () => { 
    try { 
      const date = jalaliToGregorian(shamsiDate.year, shamsiDate.month, shamsiDate.day); 
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } catch (e) { 
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } 
  };

  const handleAddItem = () => { 
    setItems([...items, { id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0, price: 0 }]); 
  };

  const handleRemoveItem = (id: string) => { 
    if (items.length > 1) setItems(items.filter(i => i.id !== id)); 
  };

  const handleUpdateItem = (id: string, field: keyof ExitPermitItem, value: string | number) => { 
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i)); 
  };

  const handleAddDestination = () => { 
    setDestinations([...destinations, { id: generateUUID(), recipientName: '', address: '', phone: '' }]); 
  };

  const handleRemoveDestination = (id: string) => { 
    if (destinations.length > 1) setDestinations(destinations.filter(d => d.id !== id)); 
  };

  const handleUpdateDestination = (id: string, field: keyof ExitPermitDestination, value: string) => { 
    setDestinations(destinations.map(d => d.id === id ? { ...d, [field]: value } : d)); 
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (items.some(i => !i.goodsName)) { 
      alert('لطفا نام کالا را برای تمام ردیف‌ها وارد کنید.'); 
      return; 
    }
    if (destinations.some(d => !d.recipientName || !d.address)) { 
      alert('لطفا گیرنده و آدرس را برای تمام مقصدها وارد کنید.'); 
      return; 
    }

    setIsSubmitting(true);
    
    const updatedPermit: ExitPermit = {
      ...permit,
      permitNumber: Number(permitNumber),
      date: getIsoDate(),
      items: items,
      destinations: destinations,
      goodsName: items.map(i => i.goodsName).join('، '),
      recipientName: destinations.map(d => d.recipientName).join('، '),
      sayanPersonCode: destinations[0]?.sayanPersonCode,
      sayanTafsiliCode: destinations[0]?.sayanTafsiliCode,
      destinationAddress: destinations[0]?.address,
      plateNumber: driverInfo.plateNumber,
      driverName: driverInfo.driverName,
      description: driverInfo.description,
      attachments: attachments,
      
      // Reset Approval Process
      status: ExitPermitStatus.PENDING_CEO,
      approverCeo: undefined,
      approverFactory: undefined,
      approverWarehouse: undefined,
      approverSecurity: undefined,
      exitTime: undefined,
      
      rejectionReason: undefined,
      rejectedBy: undefined,
      updatedAt: Date.now(),
      isEdit: true
    };

    try {
      // 1. Save to DB
      await editExitPermit(updatedPermit);
      
      // 2. Prepare for Capture
      setTempPermitForCapture(updatedPermit);
      
      // 3. Wait for Render and Send
      setTimeout(async () => {
        const elementId = `print-permit-edit-modal-${updatedPermit.id}`;
        const element = document.getElementById(elementId);
        
        if (element) {
          try {
            const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
            const base64 = canvas.toDataURL('image/png').split(',')[1];

            const users = await getUsers();
            const currentSettings = await getSettings();

            // A. Notify CEO
            const ceo = users.find(u => u.role === UserRole.CEO && u.phoneNumber);
            if (ceo) {
              let caption = `🚛 *اصلاحیه حواله خروج کارخانه*\n`;
              caption += `⚠️ *این حواله خروج ویرایش شده است*\n`;
              caption += `شماره: ${updatedPermit.permitNumber}\n`;
              caption += `گیرنده: ${updatedPermit.recipientName}\n`;
              caption += `وضعیت: بازگشت به صف (مدیرعامل)\n\n`;
              caption += `لطفا مجدداً بررسی و تایید نمایید.`;

              await apiCall('/send-whatsapp', 'POST', { 
                number: ceo.phoneNumber, 
                message: caption, 
                mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_Edit_${updatedPermit.permitNumber}.png` } 
              });
            }

            // B. Notify Group if configured
            const groupTarget = currentSettings?.exitPermitNotificationGroup;
            if (groupTarget) {
              let groupCaption = `📝 *حواله خروج کارخانه ویرایش شد*\n`;
              groupCaption += `🚨 *توجه: نسخه قبلی این حواله خروج فاقد اعتبار است.*\n`;
              groupCaption += `شماره: ${updatedPermit.permitNumber}\n`;
              groupCaption += `وضعیت فعلی: در انتظار تایید مجدد مدیریت`;

              await apiCall('/send-whatsapp', 'POST', { 
                number: groupTarget, 
                message: groupCaption, 
                mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_Invalidated_${updatedPermit.permitNumber}.png` } 
              });
            }
          } catch (err) { 
            console.error("Auto send error in edit exit permit", err); 
          }
        }
        
        onSave();
        onClose();
      }, 1500);

    } catch (e: any) { 
      if (e.message && (e.message.includes('409') || e.message.includes('Duplicate'))) {
        alert(`⛔ خطا: شماره حواله خروج کارخانه ${permitNumber} برای شرکت "${permit.company}" تکراری است.`);
      } else {
        alert('خطا در ذخیره تغییرات: ' + (e.message || 'Unknown error'));
      }
      setIsSubmitting(false); 
    }
  };

  const years = Array.from({ length: 11 }, (_, i) => 1400 + i);
  const months = [ 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند' ];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const totalCartons = items.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0);
  const totalWeight = items.reduce((acc, i) => acc + (Number(i.weight) || 0), 0);

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-md overflow-hidden animate-fade-in">
      {/* Hidden Render for Auto Send with Watermark */}
      {tempPermitForCapture && (
        <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
          <div id={`print-permit-edit-modal-${tempPermitForCapture.id}`}>
            <PrintExitPermit permit={tempPermitForCapture} onClose={() => {}} embed watermark="EDITED" />
          </div>
        </div>
      )}

      <div 
        ref={containerRef}
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative border border-gray-200 dark:border-zinc-800 text-gray-800 dark:text-gray-200"
      >
        {/* Sticky Header */}
        <div className="p-5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md z-20">
          <div className="flex items-center gap-3">
            <div className="bg-orange-50 dark:bg-orange-950/40 p-2.5 rounded-xl text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/30">
              <Save size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900 dark:text-gray-100">ویرایش حواله خروج کارخانه</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">شماره حواله: {permit.permitNumber} | شرکت: {permit.company}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            type="button"
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors"
          >
            <X size={22}/>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-6">
          
          {/* Rejection notice if previously rejected */}
          {permit.status === ExitPermitStatus.REJECTED && permit.rejectionReason && (
            <div className="bg-red-50 dark:bg-red-950/30 border-r-4 border-red-500 p-4 rounded-xl flex gap-3 animate-fade-in">
              <div className="text-red-500 mt-0.5"><AlertTriangle size={20}/></div>
              <div>
                <h4 className="text-red-800 dark:text-red-300 font-bold text-sm mb-1">این مجوز قبلاً رد شده است</h4>
                <p className="text-red-700 dark:text-red-200 text-sm leading-relaxed"><span className="font-bold">دلیل رد شدن: </span>{permit.rejectionReason}</p>
                <p className="text-red-500 dark:text-red-400 text-xs mt-1.5">با ذخیره تغییرات، درخواست مجدداً به چرخه تایید مدیرعامل بازمی‌گردد.</p>
              </div>
            </div>
          )}

          {/* 1. Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-gray-200/70 dark:border-zinc-700/60">
            <div>
              <label className="text-xs font-bold block mb-1.5 flex items-center gap-1 text-gray-700 dark:text-gray-300">
                <Hash size={15}/> شماره مجوز
              </label>
              <input 
                type="number" 
                className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl p-2.5 bg-white dark:bg-zinc-900 text-left dir-ltr font-bold text-orange-600 dark:text-orange-400 focus:ring-2 focus:ring-orange-500 outline-none" 
                value={permitNumber} 
                onChange={e => setPermitNumber(e.target.value)} 
                onBlur={handleNumberBlur} 
                required 
              />
            </div>
            <div>
              <label className="text-xs font-bold block mb-1.5 text-gray-700 dark:text-gray-300">تاریخ صدور / خروج</label>
              <div className="flex gap-2">
                <select 
                  className="border border-gray-300 dark:border-zinc-700 rounded-xl p-2 bg-white dark:bg-zinc-900 text-sm flex-1 outline-none" 
                  value={shamsiDate.day} 
                  onChange={e => setShamsiDate({...shamsiDate, day: Number(e.target.value)})}
                >
                  {days.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select 
                  className="border border-gray-300 dark:border-zinc-700 rounded-xl p-2 bg-white dark:bg-zinc-900 text-sm flex-1 outline-none" 
                  value={shamsiDate.month} 
                  onChange={e => setShamsiDate({...shamsiDate, month: Number(e.target.value)})}
                >
                  {months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                </select>
                <select 
                  className="border border-gray-300 dark:border-zinc-700 rounded-xl p-2 bg-white dark:bg-zinc-900 text-sm flex-1 outline-none" 
                  value={shamsiDate.year} 
                  onChange={e => setShamsiDate({...shamsiDate, year: Number(e.target.value)})}
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Items List */}
          <div className="space-y-3 bg-blue-50/40 dark:bg-blue-950/20 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/30">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm flex items-center gap-2">
                <Package size={18} className="text-blue-600 dark:text-blue-400"/> مشخصات اقلام و کالاها
              </h3>
              <button 
                type="button" 
                onClick={handleAddItem} 
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 font-bold shadow-sm transition-colors"
              >
                <Plus size={14}/> افزودن ردیف کالا
              </button>
            </div>
            
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-blue-100 dark:border-zinc-800 overflow-x-auto w-full">
              <table className="w-full text-xs text-right min-w-[650px]">
                <thead className="bg-blue-100/70 dark:bg-blue-900/40 text-blue-900 dark:text-blue-200 font-bold whitespace-nowrap">
                  <tr>
                    <th className="p-2.5 w-10 text-center">#</th>
                    <th className="p-2.5">نام کالا / محصول</th>
                    <th className="p-2.5 w-28 text-center">تعداد (کارتن)</th>
                    <th className="p-2.5 w-32 text-center">وزن تقریبی (KG)</th>
                    <th className="p-2.5 w-32 text-center">فی / قیمت واحد</th>
                    <th className="p-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-950/30 transition-colors">
                      <td className="p-2 text-center text-gray-500 font-bold">{index + 1}</td>
                      <td className="p-2">
                        <input 
                          className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg p-2 text-xs bg-white dark:bg-zinc-900 focus:border-blue-500 outline-none" 
                          placeholder="شرح کالا..." 
                          value={item.goodsName} 
                          onChange={e => handleUpdateItem(item.id, 'goodsName', e.target.value)} 
                          required 
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="number" 
                          className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg p-2 dir-ltr text-center text-xs font-bold bg-white dark:bg-zinc-900 outline-none" 
                          placeholder="0" 
                          value={item.cartonCount || ''} 
                          onChange={e => handleUpdateItem(item.id, 'cartonCount', Number(e.target.value))} 
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="number" 
                          step="0.001" 
                          className="w-full border border-gray-300 dark:border-zinc-700 rounded-lg p-2 dir-ltr text-center text-xs font-bold bg-white dark:bg-zinc-900 outline-none" 
                          placeholder="0" 
                          value={item.weight || ''} 
                          onChange={e => handleUpdateItem(item.id, 'weight', Number(e.target.value))} 
                        />
                      </td>
                      <td className="p-2">
                        <input 
                          type="number" 
                          className="w-full border border-blue-200 dark:border-blue-900 rounded-lg p-2 dir-ltr text-center text-xs font-bold bg-blue-50/50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 outline-none" 
                          placeholder="مبلغ" 
                          value={item.price || ''} 
                          onChange={e => handleUpdateItem(item.id, 'price', Number(e.target.value))} 
                        />
                      </td>
                      <td className="p-2 text-center">
                        {items.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => handleRemoveItem(item.id)} 
                            className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <Trash2 size={15}/>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-blue-50 dark:bg-blue-950/50 font-bold text-blue-900 dark:text-blue-200">
                    <td colSpan={2} className="p-2.5 text-left pl-4">جمع کل:</td>
                    <td className="p-2.5 text-center dir-ltr">{totalCartons} کارتن</td>
                    <td className="p-2.5 text-center dir-ltr">{Number(totalWeight.toFixed(3))} کیلوگرم</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Destinations & Sayan Live Lookup */}
          <div className="space-y-4 bg-emerald-50/30 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-emerald-600 dark:text-emerald-400"/>
                <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm">مشخصات گیرنده و مقصد (ها)</h3>
                <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                  متصل به استعلام آنلاین سایان ERP
                </span>
              </div>
              <button 
                type="button" 
                onClick={handleAddDestination} 
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl flex items-center gap-1 font-bold shadow-sm transition-colors"
              >
                <Plus size={14}/> افزودن مقصد
              </button>
            </div>

            <div className="space-y-4">
              {destinations.map((dest, index) => (
                <div key={dest.id} className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/40 relative shadow-sm">
                  {destinations.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => handleRemoveDestination(dest.id)} 
                      className="absolute top-3 left-3 text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                    >
                      <Trash2 size={16}/>
                    </button>
                  )}

                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-3 flex items-center gap-2">
                    <span className="bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded-lg text-[11px]">
                      مقصد {index + 1}
                    </span>
                    {dest.sayanPersonCode && (
                      <span className="flex items-center gap-1 text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg font-mono border border-indigo-200 dark:border-indigo-800/40">
                        <Database size={12} className="text-indigo-600 dark:text-indigo-400" />
                        <span>سایان: کد {dest.sayanPersonCode}</span>
                        {dest.sayanTafsiliCode && <span>| تفصیلی: {dest.sayanTafsiliCode}</span>}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    {/* Recipient Name with Live Sayan Dropdown */}
                    <div className="md:col-span-5 relative">
                      <label className="text-xs font-bold block mb-1 text-gray-700 dark:text-gray-300">
                        نام گیرنده / مشتری
                      </label>
                      <div className="relative">
                        <input 
                          className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl p-2.5 text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:border-emerald-500 outline-none pl-8" 
                          placeholder="جستجوی شخص یا شرکت در سایان / مخاطبین..." 
                          value={dest.recipientName} 
                          onChange={e => handleRecipientChange(dest.id, e.target.value)} 
                          onFocus={() => {
                            if (dest.recipientName.trim().length > 1) {
                              handleRecipientChange(dest.id, dest.recipientName);
                            }
                          }}
                          required 
                        />
                        {sayanSearching && activeSuggestDestId === dest.id && (
                          <div className="absolute left-2.5 top-2.5 text-indigo-500 animate-spin">
                            <Loader2 size={16} />
                          </div>
                        )}
                      </div>

                      {/* Suggestions Dropdown */}
                      {activeSuggestDestId === dest.id && contactSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-[100] bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-2xl mt-1 max-h-64 overflow-y-auto">
                          {contactSuggestions.map(con => (
                            <button 
                              key={con.id} 
                              type="button"
                              onClick={() => selectContact(dest.id, con)}
                              className={`w-full text-right p-3 hover:bg-gray-50 dark:hover:bg-zinc-700/60 border-b border-gray-100 dark:border-zinc-700 last:border-0 flex justify-between items-center transition-colors ${
                                con.isSayan ? 'bg-indigo-50/40 dark:bg-indigo-950/30 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/60' : ''
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-gray-900 dark:text-gray-100">{con.name}</span>
                                  {con.isSayan && (
                                    <span className="text-[9px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded font-mono">
                                      سایان ERP
                                    </span>
                                  )}
                                  {con.isLead && !con.isSayan && (
                                    <span className="text-[8px] bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 px-1 rounded">ربات</span>
                                  )}
                                </div>
                                {con.isSayan && con.personCode && (
                                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                                    کد شخص: {con.personCode} {con.tafsiliCode ? `| تفصیلی: ${con.tafsiliCode}` : ''}
                                  </div>
                                )}
                                {con.address && (
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate max-w-[280px]">
                                    {con.address}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{con.mobile}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Phone Number */}
                    <div className="md:col-span-3">
                      <label className="text-xs font-bold block mb-1 text-gray-700 dark:text-gray-300">
                        شماره تماس
                      </label>
                      <input 
                        className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl p-2.5 text-xs dir-ltr bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:border-emerald-500 outline-none" 
                        placeholder="0912..." 
                        value={dest.phone} 
                        onChange={e => handleUpdateDestination(dest.id, 'phone', e.target.value)} 
                      />
                    </div>

                    {/* Full Address */}
                    <div className="md:col-span-4">
                      <label className="text-xs font-bold block mb-1 text-gray-700 dark:text-gray-300">
                        آدرس مقصد
                      </label>
                      <input 
                        className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl p-2.5 text-xs bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:border-emerald-500 outline-none" 
                        placeholder="آدرس کامل..." 
                        value={dest.address} 
                        onChange={e => handleUpdateDestination(dest.id, 'address', e.target.value)} 
                        required 
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Driver Info */}
          <div className="bg-gray-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-gray-200/70 dark:border-zinc-700/60 space-y-3">
            <h3 className="font-bold text-gray-700 dark:text-gray-300 text-xs flex items-center gap-2">
              <Truck size={16} className="text-gray-600 dark:text-gray-400"/> اطلاعات راننده و خودرو (اختیاری)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold block mb-1 text-gray-600 dark:text-gray-400">نام راننده</label>
                <input 
                  className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl p-2 text-xs bg-white dark:bg-zinc-900 outline-none" 
                  value={driverInfo.driverName} 
                  onChange={e => setDriverInfo({...driverInfo, driverName: e.target.value})} 
                />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1 text-gray-600 dark:text-gray-400">شماره پلاک خودرو</label>
                <input 
                  className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl p-2 text-xs dir-ltr bg-white dark:bg-zinc-900 outline-none" 
                  placeholder="12 A 345 67" 
                  value={driverInfo.plateNumber} 
                  onChange={e => setDriverInfo({...driverInfo, plateNumber: e.target.value})} 
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold block mb-1 text-gray-600 dark:text-gray-400">توضیحات تکمیلی</label>
              <textarea 
                className="w-full border border-gray-300 dark:border-zinc-700 rounded-xl p-2 text-xs h-16 resize-none bg-white dark:bg-zinc-900 outline-none" 
                value={driverInfo.description} 
                onChange={e => setDriverInfo({...driverInfo, description: e.target.value})} 
              />
            </div>
          </div>

          {/* 5. Attachments */}
          <div className="bg-emerald-50/30 dark:bg-emerald-950/20 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                <Paperclip size={16} className="text-emerald-600"/>
                <span>ضمیمه تصاویر و مدارک (فاکتور، پیش‌فاکتور، قبض باسکول، عکس بار)</span>
              </div>
              <input 
                type="file" 
                multiple 
                accept="image/*,.pdf,.doc,.docx" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
              />
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()} 
                disabled={uploadingFiles}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {uploadingFiles ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14}/>}
                <span>{uploadingFiles ? 'در حال آپلود...' : 'افزودن فایل'}</span>
              </button>
            </div>

            {attachments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                {attachments.map((att, idx) => {
                  const isImg = att.data?.startsWith('data:image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(att.fileName);
                  return (
                    <div key={idx} className="flex items-center justify-between bg-white dark:bg-zinc-800 p-2 rounded-xl border border-emerald-200 dark:border-emerald-900/40 text-xs shadow-xs hover:border-emerald-400 transition-colors">
                      <div 
                        onClick={() => setPreviewFile({ url: att.data, fileName: att.fileName })}
                        className="flex items-center gap-2 truncate flex-1 cursor-pointer"
                        title="کلیک برای پیش‌نمایش"
                      >
                        {isImg ? (
                          <img src={att.data} alt="" className="w-7 h-7 rounded object-cover border border-emerald-100" />
                        ) : (
                          <div className="w-7 h-7 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <Paperclip size={15} />
                          </div>
                        )}
                        <div className="flex flex-col truncate">
                          <span className="truncate font-mono text-[11px]" dir="ltr">{att.fileName}</span>
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                            <Eye size={10} /> مشاهده
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 mr-1 shrink-0">
                        <a 
                          href={att.data} 
                          download={att.fileName} 
                          target="_blank" 
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-gray-500 hover:text-emerald-700 p-1 bg-gray-50 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="دانلود فایل"
                        >
                          <Download size={13} />
                        </a>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); removeAttachment(idx); }} 
                          className="text-red-500 hover:text-red-700 p-1 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 rounded-lg transition-colors"
                          title="حذف فایل"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-gray-500 dark:text-gray-400 italic">هیچ فایلی ضمیمه نشده است</p>
            )}
          </div>

          {/* Sticky Actions Footer */}
          <div className="flex gap-2 justify-end pt-3 border-t border-gray-100 dark:border-zinc-800 sticky bottom-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md py-2 z-20">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 font-bold text-xs transition-colors"
            >
              انصراف
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="bg-orange-600 hover:bg-orange-700 text-white px-7 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              ذخیره و ارسال جهت تایید مجدد
            </button>
          </div>
        </form>
      </div>
      {previewFile && (
        <FileViewerModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          fileUrl={previewFile.url}
          fileName={previewFile.fileName}
        />
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default EditExitPermitModal;
