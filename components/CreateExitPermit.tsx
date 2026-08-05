
import React, { useState, useEffect } from 'react';
import { ExitPermit, ExitPermitStatus, User, ExitPermitItem, ExitPermitDestination, UserRole, SalesContact, SystemSettings } from '../types';
import { saveExitPermit, getSettings } from '../services/storageService';
import { generateUUID, getCurrentShamsiDate, jalaliToGregorian } from '../constants';
import { apiCall } from '../services/apiService';
import { getUsers } from '../services/authService';
import { Save, Loader2, Truck, Package, MapPin, Hash, Plus, Trash2, Building2, User as UserIcon, Calendar, CheckSquare, ArrowLeft, GitMerge, Users, X, Paperclip } from 'lucide-react';
import PrintExitPermit from './PrintExitPermit';
import html2canvas from 'html2canvas';

const CreateExitPermit: React.FC<{ onSuccess: () => void, currentUser: User }> = ({ onSuccess, currentUser }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [permitNumber, setPermitNumber] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');
    const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
    
    const currentShamsi = getCurrentShamsiDate();
    const [shamsiDate, setShamsiDate] = useState({ year: currentShamsi.year, month: currentShamsi.month, day: currentShamsi.day });

    const [items, setItems] = useState<ExitPermitItem[]>([{ id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0, price: 0 }]);
    const [destinations, setDestinations] = useState<ExitPermitDestination[]>([{ id: generateUUID(), recipientName: '', address: '', phone: '' }]);
    const [driverInfo, setDriverInfo] = useState({ plateNumber: '', driverName: '', description: '' });
    const [price, setPrice] = useState(0);
    const [savedContacts, setSavedContacts] = useState<SalesContact[]>([]);
    const [botSubscribers, setBotSubscribers] = useState<any[]>([]);
    const [contactSuggestions, setContactSuggestions] = useState<any[]>([]);
    
    // Auto-Send Hook
    const [tempPermit, setTempPermit] = useState<ExitPermit | null>(null);
    const [existingPermits, setExistingPermits] = useState<ExitPermit[]>([]);
    const [settings, setSettings] = useState<SystemSettings | null>(null);

    const [showMergeModal, setShowMergeModal] = useState(false);
    const [searchTermLead, setSearchTermLead] = useState('');
    const [attachments, setAttachments] = useState<{ fileName: string; data: string }[]>([]);
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

    useEffect(() => {
        getSettings().then(s => {
            setSettings(s);
            const names = s.companies?.map(c => c.name) || s.companyNames || [];
            setAvailableCompanies(names);
            setSavedContacts(s.salesContacts || []);
            if (s.defaultCompany) {
                setSelectedCompany(s.defaultCompany);
                fetchNextNumber(s.defaultCompany);
            }
        });
        // Fetch existing permits for duplicate checking (Background)
        apiCall<ExitPermit[]>('/exit-permits').then(res => {
            if (Array.isArray(res)) setExistingPermits(res);
        }).catch(console.error);

        apiCall<any[]>('/bot-subscribers').then(res => {
            if (Array.isArray(res)) setBotSubscribers(res);
        }).catch(console.error);
    }, []);

    const handleMergeLead = async (lead: any) => {
        if (!settings) return;
        
        const newContact: SalesContact = {
            id: generateUUID(),
            name: lead.fullName || 'بدون نام',
            mobile: lead.mobile || '',
            telegramId: lead.telegramChatId || lead.chatId,
            baleId: lead.baleChatId || lead.chatId,
            sendBirthdayGreeting: false
        };

        const updatedContacts = [...(settings.salesContacts || []), newContact];
        const updatedSettings = { ...settings, salesContacts: updatedContacts };
        
        try {
            await apiCall('/settings', 'POST', updatedSettings);
            setSettings(updatedSettings);
            setSavedContacts(updatedContacts);
            alert('مخاطب با موفقیت به لیست مشتریان اضافه شد.');
        } catch (e) {
            alert('خطا در ذخیره مخاطب');
        }
    };

    const handleRecipientChange = (val: string) => {
        const d = [...destinations];
        d[0].recipientName = val;
        setDestinations(d);

        if (val.trim().length > 1) {
            const contacts = savedContacts.filter(c => c.name.includes(val) || (c.mobile && c.mobile.includes(val)));
            const leads = botSubscribers.filter(l => (l.fullName && l.fullName.includes(val)) || (l.mobile && l.mobile.includes(val)));
            
            // Deduplicate and prioritize contacts over leads if mobile matches
            const merged = [...contacts];
            leads.forEach(l => {
                const mobile = l.mobile?.replace(/^0/, '') || '';
                const exists = merged.some(m => m.mobile?.replace(/^0/, '') === mobile);
                if (!exists) {
                    merged.push({
                        id: l.id,
                        name: l.fullName || 'بدون نام',
                        mobile: l.mobile || '',
                        telegramId: l.telegramChatId || l.chatId,
                        baleId: l.baleChatId || l.chatId,
                        isLead: true
                    } as any);
                }
            });

            setContactSuggestions(merged);
        } else {
            setContactSuggestions([]);
        }
    };

    const selectContact = (contact: any) => {
        const d = [...destinations];
        d[0].recipientName = contact.name;
        d[0].phone = contact.mobile;
        setDestinations(d);
        setContactSuggestions([]);
    };

    const fetchNextNumber = (company?: string) => {
        if (!company) return;
        // Ensure API call is correct
        apiCall<{ nextNumber: number }>(`/next-exit-permit-number?company=${encodeURIComponent(company)}&t=${Date.now()}`)
            .then(res => {
                if (res && res.nextNumber) setPermitNumber(res.nextNumber.toString());
                else setPermitNumber('1001');
            })
            .catch((e) => {
                console.error("Fetch Number Error", e);
                setPermitNumber('1001');
            });
    };

    const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedCompany(val);
        fetchNextNumber(val);
    };

    const handleNumberBlur = () => {
        if (!permitNumber && selectedCompany) {
            fetchNextNumber(selectedCompany);
        } else if (permitNumber && selectedCompany) {
            // Check for duplicate locally first for instant feedback
            const isDuplicate = existingPermits.some(p => 
                p.company === selectedCompany && 
                p.permitNumber === parseInt(permitNumber)
            );
            if (isDuplicate) {
                // Automatically fetch next available number (gap)
                alert(`⚠️ شماره ${permitNumber} قبلاً ثبت شده است. سیستم به طور خودکار اولین شماره خالی (Gap) را جایگزین می‌کند.`);
                fetchNextNumber(selectedCompany);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCompany) return alert('لطفا شرکت صادرکننده را انتخاب کنید');
        if (!permitNumber) return alert('شماره حواله الزامی است');
        if (items.some(i => !i.goodsName)) return alert('نام کالا الزامی است');
        /* START EDIT: MANDATORY PRICE FOR SALES MANAGER/ADMIN */
        if (items.some(i => !i.price || i.price <= 0)) {
            return alert('وارد کردن فی (قیمت واحد) برای تمامی اقلام الزامی است.');
        }
        /* END EDIT */
        if (destinations.some(d => !d.recipientName)) return alert('نام گیرنده الزامی است');

        setIsSubmitting(true);
        
        try {
            let isoDate;
            try {
                const date = jalaliToGregorian(shamsiDate.year, shamsiDate.month, shamsiDate.day);
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                isoDate = `${y}-${m}-${d}`;
            } catch (err) { 
                const d = new Date();
                isoDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }

            const newPermit: ExitPermit = {
                id: generateUUID(),
                permitNumber: parseInt(permitNumber.replace(/[^0-9]/g, '')) || 0,
                company: selectedCompany,
                date: isoDate,
                requester: currentUser.fullName,
                items: items,
                destinations: destinations,
                goodsName: items.map(i => i.goodsName).join('، '),
                recipientName: destinations.map(d => d.recipientName).join('، '),
                cartonCount: items.reduce((acc, i) => acc + (Number(i.cartonCount) || 0), 0),
                weight: items.reduce((acc, i) => acc + (Number(i.weight) || 0), 0),
                plateNumber: driverInfo.plateNumber,
                driverName: driverInfo.driverName,
                description: driverInfo.description,
                attachments: attachments,
                price: items.reduce((acc, i) => acc + (Number(i.price) || 0), 0), // Kept for backwards compatibility or total
                status: ExitPermitStatus.PENDING_CEO,
                createdAt: Date.now()
            };

            // Call API
            await saveExitPermit(newPermit);
            
            // Navigate/clear immediately for instant response
            onSuccess();
            
            // Initiate Auto-Send Process asynchronously in background
            setTempPermit(newPermit);
            
            setTimeout(async () => {
                const elNoPrice = document.getElementById(`print-permit-create-noprice-${newPermit.id}`);
                const elWithPrice = document.getElementById(`print-permit-create-price-${newPermit.id}`);
                
                if (elNoPrice && elWithPrice) {
                    try {
                        const can1 = await html2canvas(elNoPrice, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
                        const base64NoPrice = can1.toDataURL('image/png').split(',')[1];
                        
                        const can2 = await html2canvas(elWithPrice, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
                        const base64WithPrice = can2.toDataURL('image/png').split(',')[1];
                        
                        const users = await getUsers();
                        const captionWithPrice = `📋 *صدور مجوز خروج کارخانه*\n🏭 شرکت: ${newPermit.company}\n🔢 شماره: ${newPermit.permitNumber}\n👤 گیرنده: ${newPermit.recipientName}\n📦 کالا: ${newPermit.goodsName}\n💰 مبلغ: ${newPermit.price}\n\nجهت بررسی و تایید مدیرعامل ارسال شد.`;
                        const captionNoPrice = `📋 *صدور مجوز خروج کارخانه*\n🏭 شرکت: ${newPermit.company}\n🔢 شماره: ${newPermit.permitNumber}\n👤 گیرنده: ${newPermit.recipientName}\n📦 کالا: ${newPermit.goodsName}\n\nدر انتظار بررسی و تایید.`;
                        
                        const mediaNoPrice = { data: base64NoPrice, mimeType: 'image/png', filename: `Permit_${newPermit.permitNumber}.png` };
                        const mediaWithPrice = { data: base64WithPrice, mimeType: 'image/png', filename: `Proforma_${newPermit.permitNumber}.png` };

                        const ceos = users.filter(u => u.role === UserRole.CEO || u.role === UserRole.SALES_MANAGER || u.role === UserRole.ADMIN);
                        for(const c of ceos) {
                            if (c.phoneNumber) await apiCall('/send-whatsapp', 'POST', { number: c.phoneNumber, message: captionWithPrice, mediaData: mediaWithPrice });
                            const tgId = (c as any).telegramId || (c as any).telegramChatId;
                            const blId = (c as any).baleId || (c as any).baleChatId;
                            if (tgId) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: tgId, caption: captionWithPrice, mediaData: mediaWithPrice });
                            if (blId) await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: blId, caption: captionWithPrice, mediaData: mediaWithPrice });
                        }
                        
                        // Check GROUP settings for CREATE action
                        const companyConfig = settings?.companyNotifications?.[newPermit.company];
                        const g1WA = companyConfig?.warehouseGroup || settings?.exitPermitNotificationGroup || settings?.defaultWarehouseGroup;
                        const g1Bale = companyConfig?.baleChannelId || settings?.exitPermitNotificationBaleId;
                        const g1Tg = companyConfig?.telegramChannelId || settings?.exitPermitNotificationTelegramId;

                        const g2Config = settings?.exitPermitSecondGroupConfig;
                        const g2WA = g2Config?.groupId;
                        const g2Bale = g2Config?.baleId;
                        const g2Tg = g2Config?.telegramId;
                        
                        const g1StatusArray = settings?.exitPermitFirstGroupConfig?.activeStatuses || [];
                        if (g1StatusArray.includes('CREATE')) {
                            if (g1WA) await apiCall('/send-whatsapp', 'POST', { number: g1WA, message: captionNoPrice, mediaData: mediaNoPrice });
                            if (g1Bale) await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: g1Bale, caption: captionNoPrice, mediaData: mediaNoPrice });
                            if (g1Tg) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: g1Tg, caption: captionNoPrice, mediaData: mediaNoPrice });
                        }
                        
                        const g2StatusArray = settings?.exitPermitSecondGroupConfig?.activeStatuses || [];
                        if (g2StatusArray.includes('CREATE')) {
                            if (g2WA) await apiCall('/send-whatsapp', 'POST', { number: g2WA, message: captionNoPrice, mediaData: mediaNoPrice });
                            if (g2Bale) await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: g2Bale, caption: captionNoPrice, mediaData: mediaNoPrice });
                            if (g2Tg) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: g2Tg, caption: captionNoPrice, mediaData: mediaNoPrice });
                        }
                    } catch (e) { console.error("Notification Error", e); }
                }
            }, 300);

        } catch (e: any) {
            console.error("Submit Error:", e);
            alert(`خطا در ثبت حواله: ${e.message || 'Server Error'}`);
            setIsSubmitting(false);
        }
    };

    return (
        <div className="glass-panel rounded-2xl shadow-lg border border-gray-200/50 dark:border-white/10 overflow-hidden animate-fade-in relative max-w-4xl mx-auto my-6">
            
            {/* Hidden Print Element for Auto-Send */}
            {tempPermit && (
                <div className="hidden-print-export" style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '800px', zIndex: -1 }}>
                    <div id={`print-permit-create-noprice-${tempPermit.id}`}>
                        <PrintExitPermit permit={tempPermit} onClose={()=>{}} embed showPrice={false} mode="EXIT" />
                    </div>
                    <div id={`print-permit-create-price-${tempPermit.id}`}>
                        <PrintExitPermit permit={tempPermit} onClose={()=>{}} embed showPrice={true} mode="PROFORMA" />
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="bg-gradient-to-r from-teal-700 to-teal-900 p-6 text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm"><Truck size={28} className="text-white"/></div>
                    <div>
                        <h2 className="text-xl font-black">صدور حواله خروج بار کارخانه</h2>
                        <p className="text-teal-100 text-xs mt-1">فرم رسمی درخواست خروج کالا و محصول</p>
                    </div>
                </div>
                <div className="hidden md:block text-teal-200 text-sm font-bold bg-white/10 px-3 py-1 rounded-full">
                    مرحله ۱: ثبت فروش
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
                
                {/* 1. General Info */}
                <div className="bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 p-5 rounded-2xl border border-gray-200 relative">
                    <div className="absolute -top-3 right-4 glass-panel px-3 py-1 text-sm font-bold text-gray-500 border rounded-lg shadow-sm flex items-center gap-2">
                        <Hash size={16}/> اطلاعات پایه
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">شرکت صادرکننده</label>
                            <select className="w-full border rounded-xl p-3 text-sm glass-panel focus:ring-2 focus:ring-teal-500 outline-none" value={selectedCompany} onChange={handleCompanyChange}>
                                <option value="">-- انتخاب کنید --</option>
                                {availableCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">شماره حواله</label>
                            <input type="number" className="w-full border rounded-xl p-3 text-sm font-bold text-center dir-ltr focus:ring-2 focus:ring-teal-500 outline-none" value={permitNumber} onChange={e => setPermitNumber(e.target.value)} onBlur={handleNumberBlur} placeholder="0000" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">تاریخ صدور</label>
                            <div className="flex gap-1 dir-ltr">
                                <input className="w-full border rounded-xl p-3 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500" placeholder="روز" value={shamsiDate.day} onChange={e => setShamsiDate({...shamsiDate, day: +e.target.value})} />
                                <input className="w-full border rounded-xl p-3 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500" placeholder="ماه" value={shamsiDate.month} onChange={e => setShamsiDate({...shamsiDate, month: +e.target.value})} />
                                <input className="w-full border rounded-xl p-3 text-center text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500" placeholder="سال" value={shamsiDate.year} onChange={e => setShamsiDate({...shamsiDate, year: +e.target.value})} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Items */}
                <div className="bg-teal-50/50 p-5 rounded-2xl border border-teal-100 relative">
                     <div className="absolute -top-3 right-4 glass-panel px-3 py-1 text-sm font-bold text-teal-700 border border-teal-200 rounded-lg shadow-sm flex items-center gap-2">
                        <Package size={16}/> لیست اقلام و کالاها
                    </div>
                    <div className="mt-2 space-y-3">
                        {items.map((item, idx) => (
                            <div key={item.id} className="flex flex-col md:flex-row gap-3 items-end glass-panel p-3 rounded-xl border border-gray-200 shadow-sm flex-wrap">
                                <div className="flex-1 w-full min-w-[200px]">
                                    <label className="text-[10px] font-bold text-gray-500 block mb-1">نام کالا / محصول</label>
                                    <input className="w-full border-b border-gray-300 p-2 text-sm font-bold focus:border-teal-500 outline-none" placeholder="مثال: میلگرد 14..." value={item.goodsName} onChange={e => { const n = [...items]; n[idx].goodsName = e.target.value; setItems(n); }} />
                                </div>
                                <div className="w-full md:w-28">
                                    <label className="text-[10px] font-bold text-gray-500 block mb-1 text-center">تعداد (کارتن)</label>
                                    <input type="number" className="w-full border rounded-lg p-2 text-center font-bold bg-gray-50 focus:glass-panel transition-colors outline-none" value={item.cartonCount === 0 ? '' : item.cartonCount} onFocus={e => e.target.select()} onChange={e => { const n = [...items]; n[idx].cartonCount = e.target.value === '' ? 0 : +e.target.value; setItems(n); }} />
                                </div>
                                <div className="w-full md:w-36">
                                    <label className="text-[10px] font-bold text-gray-500 block mb-1 text-center">وزن تقریبی (KG)</label>
                                    <input type="number" step="0.001" className="w-full border rounded-lg p-2 text-center font-bold bg-gray-50 focus:glass-panel transition-colors outline-none" value={item.weight === 0 ? '' : item.weight} onFocus={e => e.target.select()} onChange={e => { const n = [...items]; n[idx].weight = e.target.value === '' ? 0 : +e.target.value; setItems(n); }} />
                                </div>
                                {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.CEO || currentUser.role === UserRole.SALES_MANAGER) && (
                                    <div className="w-full md:w-32">
                                        <label className="text-[10px] font-bold text-gray-500 block mb-1 text-center">فی / قیمت واحد</label>
                                        <input type="number" className="w-full border rounded-lg p-2 text-center font-bold bg-blue-50 text-blue-700 focus:glass-panel transition-colors outline-none" placeholder="مبلغ" value={item.price || ''} onFocus={e => e.target.select()} onChange={e => { const n = [...items]; n[idx].price = e.target.value === '' ? 0 : +e.target.value; setItems(n); }} />
                                    </div>
                                )}
                                {items.length > 1 && (
                                    <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="bg-red-100 text-red-500 p-2.5 rounded-lg hover:bg-red-200 transition-colors">
                                        <Trash2 size={18}/>
                                    </button>
                                )}
                            </div>
                        ))}
                        <button type="button" onClick={() => setItems([...items, { id: generateUUID(), goodsName: '', cartonCount: 0, weight: 0 }])} className="text-teal-600 text-sm font-bold flex items-center gap-1 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-colors">
                            <Plus size={16}/> افزودن ردیف کالا
                        </button>
                    </div>
                </div>

                {/* 3. Destination & Driver */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 relative">
                        <div className="absolute -top-3 right-4 glass-panel px-3 py-1 text-sm font-bold text-gray-500 border rounded-lg shadow-sm flex items-center gap-2">
                            <MapPin size={16}/> گیرنده و مقصد
                        </div>
                        <div className="space-y-3 mt-2">
                            <div className="relative">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-bold block">نام گیرنده / مشتری</label>
                                    <button 
                                        type="button" 
                                        onClick={() => setShowMergeModal(true)}
                                        className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg flex items-center gap-1 hover:bg-blue-100 transition-colors"
                                    >
                                        <GitMerge size={12}/> ادغام لیدها و مخاطبین
                                    </button>
                                </div>
                                <input 
                                    className="w-full border rounded-xl p-2 text-sm glass-panel" 
                                    placeholder="شخص یا شرکت..." 
                                    value={destinations[0].recipientName} 
                                    onChange={e => handleRecipientChange(e.target.value)} 
                                />
                                {contactSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 z-[100] bg-white dark:bg-gray-800 border rounded-xl shadow-xl mt-1 overflow-hidden">
                                        {contactSuggestions.map(con => (
                                            <button 
                                                key={con.id} 
                                                type="button"
                                                onClick={() => selectContact(con)}
                                                className="w-full text-right p-3 hover:bg-gray-50 border-b last:border-0 flex justify-between items-center"
                                            >
                                                <span className="font-bold text-sm">{con.name}</span>
                                                <div className="flex items-center gap-2">
                                                    {con.isLead && <span className="text-[8px] bg-blue-50 text-blue-500 px-1 rounded">ربات</span>}
                                                    <span className="text-xs text-gray-400 font-mono">{con.mobile}</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div><label className="text-xs font-bold block mb-1">شماره تماس</label><input className="w-full border rounded-xl p-2 text-sm glass-panel dir-ltr text-right" placeholder="0912..." value={destinations[0].phone} onChange={e => { const d = [...destinations]; d[0].phone = e.target.value; setDestinations(d); }} /></div>
                            <div><label className="text-xs font-bold block mb-1">آدرس تخلیه</label><textarea className="w-full border rounded-xl p-2 text-sm glass-panel h-20 resize-none" placeholder="آدرس دقیق..." value={destinations[0].address} onChange={e => { const d = [...destinations]; d[0].address = e.target.value; setDestinations(d); }} /></div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 relative">
                         <div className="absolute -top-3 right-4 glass-panel px-3 py-1 text-sm font-bold text-gray-500 border rounded-lg shadow-sm flex items-center gap-2">
                            <Truck size={16}/> حمل و نقل و مالی (بخش مدیریت)
                        </div>
                        <div className="space-y-3 mt-2">
                            <div><label className="text-xs font-bold block mb-1">نام راننده</label><input className="w-full border rounded-xl p-2 text-sm glass-panel" value={driverInfo.driverName} onChange={e => setDriverInfo({...driverInfo, driverName: e.target.value})} /></div>
                            <div><label className="text-xs font-bold block mb-1">پلاک خودرو</label><input className="w-full border rounded-xl p-2 text-sm glass-panel dir-ltr text-center font-mono font-bold tracking-widest" placeholder="12 A 345 67" value={driverInfo.plateNumber} onChange={e => setDriverInfo({...driverInfo, plateNumber: e.target.value})} /></div>
                            <div><label className="text-xs font-bold block mb-1">توضیحات تکمیلی</label><textarea className="w-full border rounded-xl p-2 text-sm glass-panel h-20 resize-none" placeholder="توضیحات..." value={driverInfo.description} onChange={e => setDriverInfo({...driverInfo, description: e.target.value})} /></div>
                        </div>
                    </div>
                </div>

                {/* Attachments & Documents Section */}
                <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-200/80 space-y-3">
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
                        <p className="text-[11px] text-gray-500 italic">هیچ فایلی ضمیمه نشده است (اختیاری)</p>
                    )}
                </div>

                {/* Footer Action */}
                <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button type="submit" disabled={isSubmitting || !selectedCompany} className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg shadow-teal-200 hover:shadow-teal-300 transform hover:-translate-y-1 transition-all flex items-center gap-3 disabled:opacity-70 disabled:transform-none">
                        {isSubmitting ? <Loader2 className="animate-spin" size={24}/> : <CheckSquare size={24}/>}
                        <span>ثبت نهایی و ارسال به کارتابل مدیرعامل</span>
                    </button>
                </div>

                {/* Lead Merge Modal */}
                {showMergeModal && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4">
                        <div className="glass-panel w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col max-h-[80vh] shadow-2xl animate-fade-in border border-white/20">
                            <div className="bg-teal-900 p-4 text-white flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <Users size={20}/>
                                    <span className="font-bold text-sm">مدیریت لیدهای ربات (تبدیل به مخاطب)</span>
                                </div>
                                <button type="button" onClick={() => setShowMergeModal(false)}><X/></button>
                            </div>
                            
                            <div className="p-4 bg-teal-50/30 border-b">
                                <div className="relative">
                                    <input 
                                        className="w-full border rounded-xl p-3 pr-10 text-sm glass-panel" 
                                        placeholder="جستجوی لید بر اساس نام یا شماره..." 
                                        value={searchTermLead}
                                        onChange={e => setSearchTermLead(e.target.value)}
                                        autoFocus
                                    />
                                    <Users className="absolute right-3 top-3 text-gray-400" size={18}/>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
                                    💡 لیدهایی که در اینجا می‌بینید، افرادی هستند که با ربات تعامل داشته‌اند. با زدن دکمه "ادغام"، آن‌ها به لیست مخاطبین اصلی شما اضافه می‌شوند.
                                </p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {botSubscribers
                                    .filter(l => (l.fullName || 'بدون نام').includes(searchTermLead) || (l.mobile || '').includes(searchTermLead))
                                    .map(lead => {
                                        const isAlreadyMerged = savedContacts.some(sc => sc.mobile?.replace(/^0/, '') === lead.mobile?.replace(/^0/, ''));
                                        return (
                                            <div key={lead.id} className={`flex items-center justify-between p-3 rounded-xl border ${isAlreadyMerged ? 'bg-gray-50 border-gray-100 opacity-60' : 'bg-white border-teal-100'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold uppercase text-xs">
                                                        {(lead.fullName || '؟').charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm text-gray-800">{lead.fullName || 'بدون نام'}</div>
                                                        <div className="text-xs text-gray-500 font-mono">{lead.mobile || 'فاقد شماره'}</div>
                                                    </div>
                                                </div>
                                                {isAlreadyMerged ? (
                                                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">قبلاً ادغام شده</span>
                                                ) : (
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleMergeLead(lead)}
                                                        className="bg-teal-600 text-white text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-teal-700 transition-shadow shadow-sm active:scale-95"
                                                    >
                                                        <GitMerge size={12}/> ادغام با مخاطبین
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })
                                }
                                {botSubscribers.length === 0 && (
                                    <div className="text-center py-10 text-gray-400 italic text-sm">هیچ لیدی یافت نشد</div>
                                )}
                            </div>
                            
                            <div className="p-4 border-t bg-gray-50 flex justify-end">
                                <button type="button" onClick={() => setShowMergeModal(false)} className="px-5 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">بستن</button>
                            </div>
                        </div>
                    </div>
                )}
            </form>
        </div>
    );
};

export default CreateExitPermit;
