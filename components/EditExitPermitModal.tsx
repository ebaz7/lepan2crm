
import React, { useState } from 'react';
import { ExitPermit, ExitPermitStatus, ExitPermitItem, ExitPermitDestination, UserRole } from '../types';
import { editExitPermit } from '../services/storageService';
import { generateUUID, getShamsiDateFromIso, jalaliToGregorian, getCurrentShamsiDate } from '../constants';
import { Save, Loader2, Truck, Package, MapPin, Hash, Plus, Trash2, X, AlertTriangle, Paperclip } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import { getUsers } from '../services/authService';
import { apiCall } from '../services/apiService';
import { getSettings } from '../services/storageService'; 
import html2canvas from 'html2canvas';

interface EditExitPermitModalProps {
  permit: ExitPermit;
  onClose: () => void;
  onSave: () => void;
}

const EditExitPermitModal: React.FC<EditExitPermitModalProps> = ({ permit, onClose, onSave }) => {
  const currentShamsi = getCurrentShamsiDate();
  const initialShamsi = getShamsiDateFromIso(permit.date);
  const [shamsiDate, setShamsiDate] = useState({ year: initialShamsi.year, month: initialShamsi.month, day: initialShamsi.day });
  const [permitNumber, setPermitNumber] = useState(permit.permitNumber.toString());
  
  const [items, setItems] = useState<ExitPermitItem[]>(permit.items && permit.items.length > 0 ? permit.items : [{ id: generateUUID(), goodsName: permit.goodsName || '', cartonCount: permit.cartonCount || 0, weight: permit.weight || 0 }]);
  const [destinations, setDestinations] = useState<ExitPermitDestination[]>(permit.destinations && permit.destinations.length > 0 ? permit.destinations : [{ id: generateUUID(), recipientName: permit.recipientName || '', address: permit.destinationAddress || '', phone: '' }]);
  const [driverInfo, setDriverInfo] = useState({ plateNumber: permit.plateNumber || '', driverName: permit.driverName || '', description: permit.description || '' });
  const [attachments, setAttachments] = useState<{ fileName: string; data: string }[]>(permit.attachments || []);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      files.forEach(file => {
          if (file.size > 50 * 1024 * 1024) {
              alert(`حجم فایل ${file.name} بیشتر از ۵۰ مگابایت است.`);
              return;
          }
          const reader = new FileReader();
          reader.onload = (evt) => {
              if (evt.target?.result) {
                  setAttachments(prev => [...prev, { fileName: file.name, data: evt.target!.result as string }]);
              }
          };
          reader.readAsDataURL(file);
      });
      e.target.value = '';
  };

  const removeAttachment = (index: number) => {
      setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingPermits, setExistingPermits] = useState<ExitPermit[]>([]);

  React.useEffect(() => {
    apiCall<ExitPermit[]>('/exit-permits').then(res => {
        if (Array.isArray(res)) setExistingPermits(res);
    }).catch(console.error);
  }, []);

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
  
  // State for rendering the hidden invoice for auto-send
  const [tempPermitForCapture, setTempPermitForCapture] = useState<ExitPermit | null>(null);

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
  const handleAddItem = () => { setItems([...items, { id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }]); };
  const handleRemoveItem = (id: string) => { if (items.length > 1) setItems(items.filter(i => i.id !== id)); };
  const handleUpdateItem = (id: string, field: keyof ExitPermitItem, value: string | number) => { setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i)); };
  const handleAddDestination = () => { setDestinations([...destinations, { id: generateUUID(), recipientName: '', address: '', phone: '' }]); };
  const handleRemoveDestination = (id: string) => { if (destinations.length > 1) setDestinations(destinations.filter(d => d.id !== id)); };
  const handleUpdateDestination = (id: string, field: keyof ExitPermitDestination, value: string) => { setDestinations(destinations.map(d => d.id === id ? { ...d, [field]: value } : d)); };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (items.some(i => !i.goodsName)) { alert('لطفا نام کالا را برای تمام ردیف‌ها وارد کنید.'); return; }
      if (destinations.some(d => !d.recipientName || !d.address)) { alert('لطفا گیرنده و آدرس را برای تمام مقصدها وارد کنید.'); return; }

      setIsSubmitting(true);
      
      const updatedPermit: ExitPermit = {
          ...permit,
          permitNumber: Number(permitNumber),
          date: getIsoDate(),
          items: items,
          destinations: destinations,
          goodsName: items.map(i => i.goodsName).join('، '), // Sync legacy
          recipientName: destinations.map(d => d.recipientName).join('، '), // Sync legacy
          plateNumber: driverInfo.plateNumber,
          driverName: driverInfo.driverName,
          description: driverInfo.description,
          attachments: attachments,
          
          // Reset Approval Process (Full Reset)
          status: ExitPermitStatus.PENDING_CEO,
          approverCeo: undefined,
          approverFactory: undefined,
          approverWarehouse: undefined, // Ensure warehouse approval is reset
          approverSecurity: undefined, // Ensure security approval is reset
          exitTime: undefined, // Reset exit time
          
          rejectionReason: undefined,
          rejectedBy: undefined,
          updatedAt: Date.now(),
          isEdit: true // Add isEdit flag to tell server it's an edit
      };

      try {
          // 1. Save to DB
          await editExitPermit(updatedPermit);
          
          // 2. Prepare for Capture
          setTempPermitForCapture(updatedPermit);
          
          // 3. Wait for Render and Send
          setTimeout(async () => {
              // Unique ID for the hidden element in this modal
              const elementId = `print-permit-edit-modal-${updatedPermit.id}`;
              const element = document.getElementById(elementId);
              
              if (element) {
                  try {
                      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
                      const base64 = canvas.toDataURL('image/png').split(',')[1];

                      const users = await getUsers();
                      const settings = await getSettings();

                      // A. Notify CEO (Correction Request) - CRITICAL
                      const ceo = users.find(u => u.role === UserRole.CEO && u.phoneNumber);
                      
                      if (ceo) {
                          let caption = `🚛 *اصلاحیه مجوز خروج*\n`;
                          caption += `⚠️ *این مجوز ویرایش شده است*\n`;
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

                      // B. Notify Group (Invalidation Alert) if group is configured
                      const groupTarget = settings?.exitPermitNotificationGroup;
                      if (groupTarget) {
                          let groupCaption = `📝 *مجوز خروج ویرایش شد*\n`;
                          groupCaption += `🚨 *توجه: نسخه قبلی این مجوز فاقد اعتبار است.*\n`;
                          groupCaption += `شماره: ${updatedPermit.permitNumber}\n`;
                          groupCaption += `وضعیت فعلی: در انتظار تایید مجدد مدیریت`;

                          await apiCall('/send-whatsapp', 'POST', { 
                              number: groupTarget, 
                              message: groupCaption, 
                              mediaData: { data: base64, mimeType: 'image/png', filename: `Permit_Invalidated_${updatedPermit.permitNumber}.png` } 
                          });
                      }

                  } catch(e) { console.error("Auto send error", e); }
              } else {
                  console.error("Print element not found for ID:", elementId);
              }
              
              onSave();
              onClose();
          }, 2000); // 2 seconds wait for reliable render

      } catch (e: any) { 
          // Handle Duplicate Error from Server
          if (e.message && (e.message.includes('409') || e.message.includes('Duplicate'))) {
              alert(`⛔ خطا: شماره مجوز خروج ${permitNumber} برای شرکت "${permit.company}" تکراری است.`);
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4">
        {/* Hidden Render for Auto Send with Watermark - MUST BE HERE */}
        {tempPermitForCapture && (
            <div className="hidden-print-export" style={{position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1}}>
                {/* We use a specific ID to target this element for html2canvas inside the modal */}
                <div id={`print-permit-edit-modal-${tempPermitForCapture.id}`}>
                    <PrintExitPermit permit={tempPermitForCapture} onClose={()=>{}} embed watermark="EDITED" />
                </div>
            </div>
        )}

        <div className="glass-panel rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 glass-panel z-10">
                <div className="flex items-center gap-3">
                    <div className="bg-orange-50 p-2 rounded-lg text-orange-600"><Save size={20} /></div>
                    <h2 className="text-xl font-bold text-gray-800">ویرایش مجوز خروج</h2>
                </div>
                <button onClick={onClose} data-close-modal="true" className="text-gray-400 hover:text-red-500"><X size={24}/></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-8">
                
                {permit.status === ExitPermitStatus.REJECTED && permit.rejectionReason && (
                    <div className="bg-red-50 border-r-4 border-red-500 p-4 rounded-lg flex gap-3 animate-fade-in">
                        <div className="text-red-500 mt-0.5"><AlertTriangle size={20}/></div>
                        <div>
                            <h4 className="text-red-800 font-bold text-sm mb-1">این مجوز رد شده است</h4>
                            <p className="text-red-700 text-sm leading-relaxed"><span className="font-bold">دلیل رد شدن: </span>{permit.rejectionReason}</p>
                            <p className="text-red-500 text-xs mt-2">با ذخیره تغییرات، درخواست مجدداً به وضعیت «در انتظار تایید» تغییر خواهد کرد.</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 p-4 rounded-xl border border-gray-200/50 dark:border-white/10">
                    <div><label className="text-sm font-bold block mb-1 flex items-center gap-1"><Hash size={16}/> شماره مجوز</label><input type="number" className="w-full border rounded-xl p-3 glass-panel text-left dir-ltr font-bold text-orange-600" value={permitNumber} onChange={e => setPermitNumber(e.target.value)} onBlur={handleNumberBlur} required /></div>
                    <div><label className="text-sm font-bold block mb-1">تاریخ خروج</label><div className="flex gap-2"><select className="border rounded-xl p-2 glass-panel flex-1" value={shamsiDate.day} onChange={e => setShamsiDate({...shamsiDate, day: Number(e.target.value)})}>{days.map(d => <option key={d} value={d}>{d}</option>)}</select><select className="border rounded-xl p-2 glass-panel flex-1" value={shamsiDate.month} onChange={e => setShamsiDate({...shamsiDate, month: Number(e.target.value)})}>{months.map((m, i) => <option key={i} value={i+1}>{m}</option>)}</select><select className="border rounded-xl p-2 glass-panel flex-1" value={shamsiDate.year} onChange={e => setShamsiDate({...shamsiDate, year: Number(e.target.value)})}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div></div>
                </div>
                <div className="space-y-4">
                    <div className="flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Package size={20} className="text-blue-600"/> مشخصات اقلام و کالاها</h3><button type="button" onClick={handleAddItem} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 font-bold"><Plus size={14}/> افزودن کالا</button></div>
                    <div className="bg-blue-50/50 rounded-xl border border-blue-100 overflow-x-auto w-full max-w-full"><table className="w-full text-sm text-right min-w-[600px]"><thead className="bg-blue-100 text-blue-800 whitespace-nowrap"><tr><th className="p-3 w-10 text-center">#</th><th className="p-3">نام کالا / محصول</th><th className="p-3 w-32">تعداد کارتن</th><th className="p-3 w-40">وزن (KG)</th><th className="p-3 w-10"></th></tr></thead><tbody className="divide-y divide-blue-100">{items.map((item, index) => (<tr key={item.id}><td className="p-2 text-center text-gray-500 font-bold">{index + 1}</td><td className="p-2"><input className="w-full border border-blue-200 rounded p-2" placeholder="شرح کالا..." value={item.goodsName} onChange={e => handleUpdateItem(item.id, 'goodsName', e.target.value)} required /></td><td className="p-2"><input type="number" className="w-full border border-blue-200 rounded p-2 dir-ltr text-center" placeholder="0" value={item.cartonCount || ''} onChange={e => handleUpdateItem(item.id, 'cartonCount', Number(e.target.value))} /></td><td className="p-2"><input type="number" step="0.001" className="w-full border border-blue-200 rounded p-2 dir-ltr text-center font-bold" placeholder="0" value={item.weight || ''} onChange={e => handleUpdateItem(item.id, 'weight', Number(e.target.value))} /></td><td className="p-2 text-center"><button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button></td></tr>))}<tr className="bg-blue-100/50 font-bold text-blue-900"><td colSpan={2} className="p-3 text-left pl-4">جمع کل:</td><td className="p-3 text-center dir-ltr">{totalCartons} کارتن</td><td className="p-3 text-center dir-ltr">{Number(totalWeight.toFixed(3))} کیلوگرم</td><td></td></tr></tbody></table></div>
                </div>
                <div className="space-y-4 border-t pt-6">
                    <div className="flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><MapPin size={20} className="text-green-600"/> مشخصات گیرنده و مقصد (ها)</h3><button type="button" onClick={handleAddDestination} className="text-xs bg-green-50 text-green-600 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-green-100 font-bold"><Plus size={14}/> افزودن مقصد</button></div>
                    <div className="space-y-3">{destinations.map((dest, index) => (<div key={dest.id} className="p-4 bg-green-50 rounded-xl border border-green-200 relative group">{destinations.length > 1 && <button type="button" onClick={() => handleRemoveDestination(dest.id)} className="absolute top-2 left-2 text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>}<div className="text-xs font-bold text-green-800 mb-2 flex items-center gap-1"><span className="bg-green-200 px-1.5 rounded text-green-900">{index + 1}</span> اطلاعات گیرنده</div><div className="grid grid-cols-1 md:grid-cols-12 gap-3"><div className="md:col-span-4"><input className="w-full border border-green-300 rounded p-2 text-sm" placeholder="نام گیرنده..." value={dest.recipientName} onChange={e => handleUpdateDestination(dest.id, 'recipientName', e.target.value)} required /></div><div className="md:col-span-3"><input className="w-full border border-green-300 rounded p-2 text-sm dir-ltr" placeholder="شماره تماس..." value={dest.phone} onChange={e => handleUpdateDestination(dest.id, 'phone', e.target.value)} /></div><div className="md:col-span-5"><input className="w-full border border-green-300 rounded p-2 text-sm" placeholder="آدرس کامل..." value={dest.address} onChange={e => handleUpdateDestination(dest.id, 'address', e.target.value)} required /></div></div></div>))}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4 mt-6">
                    <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2"><Truck size={18}/> اطلاعات راننده (اختیاری)</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-xs font-bold block mb-1">نام راننده</label><input className="w-full border rounded-lg p-2 text-sm" value={driverInfo.driverName} onChange={e => setDriverInfo({...driverInfo, driverName: e.target.value})} /></div><div><label className="text-xs font-bold block mb-1">شماره پلاک</label><input className="w-full border rounded-lg p-2 text-sm dir-ltr" placeholder="12 A 345 67" value={driverInfo.plateNumber} onChange={e => setDriverInfo({...driverInfo, plateNumber: e.target.value})} /></div></div>
                    <div><label className="text-xs font-bold block mb-1">توضیحات تکمیلی</label><textarea className="w-full border rounded-lg p-2 text-sm h-20 resize-none" value={driverInfo.description} onChange={e => setDriverInfo({...driverInfo, description: e.target.value})} /></div>
                </div>

                {/* Attachments Section */}
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 space-y-3 mt-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                            <Paperclip size={18} className="text-emerald-600"/>
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
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                        >
                            <Paperclip size={16}/> افزودن فایل / تصویر
                        </button>
                    </div>

                    {attachments.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
                            {attachments.map((att, idx) => {
                                const isImg = att.data?.startsWith('data:image/') || /\.(jpg|jpeg|png|webp)$/i.test(att.fileName);
                                return (
                                    <div key={idx} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-emerald-200 text-xs shadow-sm">
                                        <div className="flex items-center gap-2 truncate flex-1">
                                            {isImg ? (
                                                <img src={att.data} alt="" className="w-8 h-8 rounded object-cover border" />
                                            ) : (
                                                <Paperclip size={16} className="text-emerald-600 shrink-0" />
                                            )}
                                            <span className="truncate font-mono text-[11px]" dir="ltr">{att.fileName}</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={() => removeAttachment(idx)} 
                                            className="text-red-500 hover:text-red-700 p-1 bg-red-50 hover:bg-red-100 rounded-lg shrink-0 mr-1 transition-colors"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-[11px] text-gray-500 italic">هیچ فایلی ضمیمه نشده است</p>
                    )}
                </div>
                <div className="flex gap-2 justify-end pt-4 border-t">
                    <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl border text-gray-700 hover:bg-gray-50 font-medium">انصراف</button>
                    <button type="submit" disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-70">{isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <Save size={24} />}ذخیره و ارسال جهت تایید مجدد</button>
                </div>
            </form>
        </div>
    </div>
  );
};
export default EditExitPermitModal;
