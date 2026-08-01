import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Upload, Download, Gift, Save, X, FileText, UserPlus, GitMerge } from 'lucide-react';
import { SalesContact, BirthdayGreetingTemplate } from '../types';
import { apiCall } from '../services/apiService';
import { getSettings, saveSettings } from '../services/storageService';
import * as XLSX from 'xlsx';
import { saveBlobAndOpenFile } from '../services/fileService';

export default function SalesCRMModule() {
    const [contacts, setContacts] = useState<SalesContact[]>([]);
    const [botSubscribers, setBotSubscribers] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'contacts' | 'bot_leads'>('contacts');
    const [template, setTemplate] = useState<BirthdayGreetingTemplate>({ text: 'تولدت مبارک عزیز!', isActive: true });

    // Lead Merge States
    const [mergingLead, setMergingLead] = useState<any | null>(null);
    const [mergeMode, setMergeMode] = useState<'new' | 'existing'>('new');
    const [selectedContactId, setSelectedContactId] = useState<string>('');
    const [mergeForm, setMergeForm] = useState<{
        name: string;
        mobile: string;
        telegramId: string;
        baleId: string;
        birthday: string;
        accountCode: string;
    }>({ name: '', mobile: '', telegramId: '', baleId: '', birthday: '', accountCode: '' });

    useEffect(() => {
        const handleGlobalClose = () => {
            setMergingLead(null);
            setIsModalOpen(false);
        };
        window.addEventListener('CLOSE_ACTIVE_MODALS', handleGlobalClose);
        return () => window.removeEventListener('CLOSE_ACTIVE_MODALS', handleGlobalClose);
    }, []);

    const handleStartMerge = (lead: any) => {
        const matched = contacts.find(c => {
            const cleanLeadMob = (lead.mobile || '').replace(/^0/, '').trim();
            const cleanContMob = (c.mobile || '').replace(/^0/, '').trim();
            return cleanLeadMob && cleanContMob && (cleanContMob.endsWith(cleanLeadMob) || cleanLeadMob.endsWith(cleanContMob));
        });

        setMergingLead(lead);
        if (matched) {
            setMergeMode('existing');
            setSelectedContactId(matched.id);
        } else {
            setMergeMode('new');
            setSelectedContactId('');
        }

        setMergeForm({
            name: lead.fullName || '',
            mobile: lead.mobile || '',
            telegramId: lead.platform === 'telegram' ? (lead.telegramChatId || lead.chatId || '') : '',
            baleId: lead.platform === 'bale' ? (lead.baleChatId || lead.chatId || '') : '',
            birthday: lead.birthday || '',
            accountCode: ''
        });
    };

    const handleSaveMerge = async () => {
        if (!mergeForm.name || !mergeForm.mobile) {
            alert('نام و شماره موبایل الزامی است.');
            return;
        }

        let updatedContacts = [...contacts];
        if (mergeMode === 'existing') {
            const targetId = selectedContactId;
            if (!targetId) {
                alert('لطفاً یک مخاطب برای ادغام انتخاب کنید.');
                return;
            }
            updatedContacts = contacts.map(c => {
                if (c.id === targetId) {
                    return {
                        ...c,
                        name: mergeForm.name || c.name,
                        mobile: mergeForm.mobile || c.mobile,
                        telegramId: mergeForm.telegramId || c.telegramId,
                        baleId: mergeForm.baleId || c.baleId,
                        birthday: mergeForm.birthday || c.birthday,
                        accountCode: mergeForm.accountCode || c.accountCode
                    };
                }
                return c;
            });
            await updateContacts(updatedContacts);
            alert('اطلاعات لید با موفقیت با مخاطب انتخاب شده ادغام شد.');
        } else {
            const newC: SalesContact = {
                id: Date.now().toString(),
                name: mergeForm.name,
                mobile: mergeForm.mobile,
                telegramId: mergeForm.telegramId,
                baleId: mergeForm.baleId,
                birthday: mergeForm.birthday,
                accountCode: mergeForm.accountCode,
                sendBirthdayGreeting: true
            };
            await updateContacts([...contacts, newC]);
            alert('لید با موفقیت به عنوان مخاطب جدید ذخیره شد.');
        }
        setMergingLead(null);
    };
    
    const fetchData = async () => {
        getSettings().then(s => {
            if (s.salesContacts) setContacts(s.salesContacts);
            if (s.birthdayGreetingTemplate) setTemplate(s.birthdayGreetingTemplate);
        });
        try {
            const subs = await apiCall<any[]>('/bot-subscribers');
            setBotSubscribers(subs);
        } catch (e) {}
    };

    useEffect(() => {
        fetchData();
    }, []);

    const updateContacts = async (newContacts: SalesContact[]) => {
        setContacts(newContacts);
        const s = await getSettings();
        await saveSettings({ ...s, salesContacts: newContacts });
    };

    const handleDeleteBotSub = async (id: string) => {
        if (!confirm('آیا از حذف این عضو اطمینان دارید؟')) return;
        try {
            await apiCall(`/bot-subscribers/${id}`, 'DELETE');
            fetchData();
        } catch (e) {
            alert('خطا در حذف عضو');
        }
    };

    const updateTemplate = async (newTemplate: BirthdayGreetingTemplate) => {
        setTemplate(newTemplate);
        const s = await getSettings();
        await saveSettings({ ...s, birthdayGreetingTemplate: newTemplate });
    };

    const exportContacts = () => {
        const headers = ["نام", "موبایل", "تلگرام", "بله", "تاریخ تولد(YYYY-MM-DD)"];
        const rows = contacts.map(c => [c.name, c.mobile, c.telegramId || '', c.baleId || '', c.birthday || '']);
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob(["\uFEFF", csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "contacts.csv");
        link.click();
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (!confirm(`آیا از وارد کردن ${data.length} مخاطب اطمینان دارید؟`)) return;

                const newContacts = [...contacts];
                data.forEach((row: any) => {
                    const mobile = String(row['موبایل'] || row['Mobile'] || '').trim();
                    const name = String(row['نام'] || row['Name'] || '').trim();
                    const accountCode = String(row['کد تفصیلی'] || row['کد حساب'] || row['کد حسابداری'] || row['AccountCode'] || row['کد'] || '').trim();
                    if (mobile && name) {
                        newContacts.push({
                            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                            name,
                            mobile,
                            telegramId: String(row['تلگرام'] || row['Telegram'] || ''),
                            baleId: String(row['بله'] || row['Bale'] || ''),
                            birthday: String(row['تاریخ تولد'] || row['Birthday'] || ''),
                            accountCode: accountCode || undefined,
                            sendBirthdayGreeting: true
                        });
                    }
                });
                await updateContacts(newContacts);
                alert(`${data.length} مخاطب با موفقیت وارد شد.`);
            } catch (err) {
                console.error(err);
                alert('خطا در پردازش فایل');
            }
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<SalesContact | null>(null);
    const [formData, setFormData] = useState<Partial<SalesContact>>({ name: '', mobile: '', birthday: '', telegramId: '', baleId: '', accountCode: '' });

    // Handler to open modal for new contact
    const handleAddManualContact = () => {
        setEditingContact(null);
        setFormData({ name: '', mobile: '', birthday: '', telegramId: '', baleId: '', accountCode: '', sendBirthdayGreeting: true });
        setIsModalOpen(true);
    };

    // Handler to open modal for editing
    const handleEditContact = (contact: SalesContact) => {
        setEditingContact(contact);
        setFormData(contact);
        setIsModalOpen(true);
    };

    const handleSaveContact = () => {
        if (!formData.name || !formData.mobile) {
            alert('لطفاً نام و شماره موبایل را وارد کنید');
            return;
        }

        if (editingContact) {
            updateContacts(contacts.map(c => c.id === editingContact.id ? { ...editingContact, ...formData, telegramId: formData.telegramId, baleId: formData.baleId, accountCode: formData.accountCode } as SalesContact : c));
        } else {
            const newContact: SalesContact = {
                id: Date.now().toString(),
                ...formData as SalesContact
            };
            updateContacts([...contacts, newContact]);
        }
        setIsModalOpen(false);
    };

    const handleDeleteContact = (id: string) => {
        if (confirm('آیا از حذف این مخاطب اطمینان دارید؟')) {
            updateContacts(contacts.filter(c => c.id !== id));
        }
    };

    const downloadSample = () => {
        const sampleData = [
            { 'نام': 'علی محمدی', 'موبایل': '09121234567', 'تلگرام': '', 'بله': '', 'تاریخ تولد': '1370/05/20' },
            { 'نام': 'رضا علوی', 'موبایل': '09191234567', 'تلگرام': 'reza_alavi', 'بله': 'reza_bale', 'تاریخ تولد': '1365/10/12' }
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Contacts");
        
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveBlobAndOpenFile(blob, "Sample_Contacts.xlsx");
    };

    const handleSaveTemplate = () => {
        updateTemplate(template);
        alert('متن تبریک ذخیره شد.');
    };

    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastTarget, setBroadcastTarget] = useState<'users' | 'contacts' | 'all_subscribers'>('all_subscribers');
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const handleBroadcast = async () => {
        if (!broadcastMessage.trim()) {
            alert('لطفا متن پیام را وارد کنید.');
            return;
        }
        setIsBroadcasting(true);
        try {
            const res = await apiCall<{count: number}>('/bot/broadcast', 'POST', { 
                message: broadcastMessage,
                target: broadcastTarget
            });
            alert(`پیام همگانی با موفقیت به ${res.count} چت/کاربر ارسال شد.`);
            setBroadcastMessage('');
        } catch (e) {
            alert('خطا در ارسال پیام همگانی');
        } finally {
            setIsBroadcasting(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <h2 className="text-2xl font-black text-gray-800">مدیریت مخاطبین فروش</h2>
            
            {/* Tabs for Navigation */}
            <div className="flex border-b border-gray-200/50 dark:border-white/10">
                <button 
                    onClick={() => setActiveTab('contacts')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'contacts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}
                >
                    👥 لیست مخاطبین فروش
                </button>
                <button 
                    onClick={() => setActiveTab('bot_leads')}
                    className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${activeTab === 'bot_leads' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}
                >
                    🤖 لیدهای جمع‌آوری شده از ربات
                </button>
            </div>

            {activeTab === 'contacts' ? (
                <>
                    {/* Bulk Messaging */}
                    <div className="glass-panel p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-lg mb-4">ارسال پیام همگانی به مشتریان</h3>
                        <div className="space-y-4">
                            <div className="flex gap-4 mb-2">
                                <label className="flex items-center gap-2 text-sm cursor-pointer border p-2 rounded-xl bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 flex-1 justify-center">
                                    <input type="radio" checked={broadcastTarget === 'all_subscribers'} onChange={() => setBroadcastTarget('all_subscribers')} />
                                    <span>همه اعضای ربات</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer border p-2 rounded-xl bg-gray-50 flex-1 justify-center">
                                    <input type="radio" checked={broadcastTarget === 'users'} onChange={() => setBroadcastTarget('users')} />
                                    <span>فقط کارکنان</span>
                                </label>
                                <label className="flex items-center gap-2 text-sm cursor-pointer border p-2 rounded-xl bg-gray-50 flex-1 justify-center">
                                    <input type="radio" checked={broadcastTarget === 'contacts'} onChange={() => setBroadcastTarget('contacts')} />
                                    <span>فقط لیست مشتریان</span>
                                </label>
                            </div>
                            <textarea 
                                className="w-full p-3 border rounded-xl"
                                rows={3}
                                placeholder="متن پیام همگانی..."
                                value={broadcastMessage}
                                onChange={e => setBroadcastMessage(e.target.value)}
                                disabled={isBroadcasting}
                            />
                            <button disabled={isBroadcasting} onClick={handleBroadcast} className={`flex items-center gap-2 text-white px-4 py-2 rounded-xl font-bold transition-colors ${isBroadcasting ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'}`}>
                                <Save size={18}/> {isBroadcasting ? 'در حال ارسال...' : 'ارسال به همه بر اساس فیلتر'}
                            </button>
                            <p className="text-[10px] text-gray-400">نکته: پیام همگانی به پلتفرم‌هایی که کاربر در آن عضو است (تلگرام/بله) ارسال می‌شود.</p>
                        </div>
                    </div>

                    {/* Birthday Template Settings */}
                    <div className="glass-panel p-6 rounded-2xl border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Gift className="text-pink-500"/> تنظیمات تبریک تولد</h3>
                        <div className="space-y-4">
                            <textarea 
                                value={template.text}
                                onChange={e => setTemplate({...template, text: e.target.value})}
                                className="w-full p-3 border rounded-xl"
                                rows={3}
                                placeholder="متن تبریک..."
                            />
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={template.isActive} onChange={e => setTemplate({...template, isActive: e.target.checked})} />
                                فعال‌سازی ارسال خودکار تبریک
                            </label>
                            <button onClick={handleSaveTemplate} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700">
                                <Save size={18}/> ذخیره متن
                            </button>
                        </div>
                    </div>

                    {/* Contacts Table / Cards */}
                    <div className="glass-panel p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm">
                            <div className="flex flex-wrap gap-2 w-full md:w-auto">
                                <label className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-bold cursor-pointer hover:bg-emerald-200 border border-emerald-200">
                                     <Upload size={18}/> ایمپورت اکسل
                                     <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                                </label>
                                <button onClick={() => {
                                    const sampleData = [
                                        { 'نام': 'علی محمدی', 'موبایل': '09121234567', 'تلگرام': '', 'بله': '', 'تاریخ تولد': '1370/05/20', 'کد حساب تفصیلی': '102001' },
                                        { 'نام': 'رضا علوی', 'موبایل': '09191234567', 'تلگرام': 'reza_alavi', 'بله': 'reza_bale', 'تاریخ تولد': '1365/10/12', 'کد حساب تفصیلی': '102002' }
                                    ];
                                    const ws = XLSX.utils.json_to_sheet(sampleData);
                                    const wb = XLSX.utils.book_new();
                                    XLSX.utils.book_append_sheet(wb, ws, "Contacts");
                                    XLSX.writeFile(wb, "Sample_Contacts.xlsx");
                                }} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-xl font-bold hover:bg-gray-200 border"><Download size={18}/> نمونه اکسل</button>
                                <button onClick={exportContacts} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gray-100 px-4 py-2 rounded-xl font-bold hover:bg-gray-200 border"><Download size={18}/> اکسپورت</button>
                                <button onClick={handleAddManualContact} className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100"><Plus size={18}/> افزودن دستی</button>
                            </div>

                        {/* Desktop View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-sm text-right">
                                <thead>
                                    <tr className="border-b bg-gray-50 text-gray-500">
                                        <th className="p-4 font-bold text-right">نام مشتری</th>
                                        <th className="p-4 font-bold text-center">شماره موبایل</th>
                                        <th className="p-4 font-bold text-center">کد حساب مالی</th>
                                        <th className="p-4 font-bold text-center">تاریخ تولد</th>
                                        <th className="p-4 font-bold text-center">تبریک تولد</th>
                                        <th className="p-4 font-bold text-center">عملیات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contacts.map(c => {
                                        const isLinked = botSubscribers.some(sub => sub.mobile?.includes(c.mobile.slice(-10)) || c.mobile.includes(sub.mobile?.slice(-10)));
                                        return (
                                            <tr key={c.id} className="border-b hover:bg-gray-50 transition-colors">
                                                <td className="p-4 font-bold text-gray-800">
                                                    <div className="flex flex-col">
                                                        <span>{c.name}</span>
                                                        {isLinked && <span className="text-[8px] bg-blue-100 text-blue-600 px-1 rounded w-fit mt-1">متصل به ربات</span>}
                                                    </div>
                                                </td>
                                                <td className="p-4 text-center font-mono">{c.mobile}</td>
                                                <td className="p-4 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                    {c.accountCode ? <span className="bg-emerald-50 dark:bg-emerald-950/20 px-2.5 py-1 rounded-lg text-xs"><code>{c.accountCode}</code></span> : <span className="text-gray-300 text-xs">-</span>}
                                                </td>
                                                <td className="p-4 text-center">{c.birthday || '-'}</td>
                                                <td className="p-4 text-center">
                                                    {c.sendBirthdayGreeting ? 
                                                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold">فعال</span> : 
                                                        <span className="bg-gray-100 text-gray-400 px-3 py-1 rounded-full text-[10px] font-bold">غیرفعال</span>
                                                    }
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex justify-center gap-2">
                                                        <button onClick={() => handleEditContact(c)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                                        <button onClick={() => handleDeleteContact(c.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {contacts.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-gray-400 italic font-medium">هیچ مخاطبی ثبت نشده است.</td></tr>}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View */}
                        <div className="md:hidden space-y-4">
                            {contacts.map(c => (
                                <div key={c.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center group">
                                    <div>
                                        <div className="font-bold text-gray-800">{c.name}</div>
                                        <div className="text-xs text-gray-500 font-mono mt-1">{c.mobile}</div>
                                        {c.accountCode && <div className="text-xs text-emerald-600 font-bold mt-1">کد حسابدار: {c.accountCode}</div>}
                                        {c.birthday && <div className="text-[10px] text-gray-400 mt-1">تولد: {c.birthday}</div>}
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleEditContact(c)} className="p-2 text-blue-600 glass-panel rounded-xl shadow-sm"><Edit2 size={16}/></button>
                                        <button onClick={() => handleDeleteContact(c.id)} className="p-2 text-red-600 glass-panel rounded-xl shadow-sm"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                            {contacts.length === 0 && <div className="p-8 text-center text-gray-400 italic text-sm">لیست خالی است.</div>}
                        </div>
                    </div>
                </>
            ) : (
                <div className="glass-panel p-4 md:p-6 rounded-2xl border border-gray-200 shadow-sm animate-fade-in">
                    <h3 className="font-bold text-lg mb-6">لیست لیدهای ربات (اعضای جدید)</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead>
                                <tr className="border-b bg-gray-50 text-gray-500">
                                    <th className="p-4 font-bold text-right">نام ثبت شده</th>
                                    <th className="p-4 font-bold text-center">شماره موبایل</th>
                                    <th className="p-4 font-bold text-center">تاریخ تولد</th>
                                    <th className="p-4 font-bold text-center">پلتفرم</th>
                                    <th className="p-4 font-bold text-center">شناسه چت</th>
                                    <th className="p-4 font-bold text-center">عملیات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {botSubscribers.map(sub => {
                                    const linkedContact = contacts.find(c => sub.mobile?.includes(c.mobile.slice(-10)) || c.mobile.includes(sub.mobile?.slice(-10)));
                                    return (
                                        <tr key={sub.id} className="border-b hover:bg-gray-50">
                                            <td className="p-4 font-bold text-gray-800">
                                                <div className="flex flex-col">
                                                    <span>{sub.fullName || '(بدون نام)'}</span>
                                                    {linkedContact && <span className="text-[8px] bg-emerald-100 text-emerald-600 px-1 rounded w-fit mt-1">لینک شده به مخاطب: {linkedContact.name}</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center font-mono">{sub.mobile || '-'}</td>
                                            <td className="p-4 text-center">{sub.birthday || '-'}</td>
                                            <td className="p-4 text-center">
                                                {sub.platform === 'telegram' ? 
                                                    <span className="text-blue-500 font-bold text-[10px]">تلگرام</span> : 
                                                    <span className="text-emerald-500 font-bold text-[10px]">بله</span>
                                                }
                                            </td>
                                            <td className="p-4 text-center font-mono text-[10px] text-gray-400">
                                                {sub.telegramChatId || sub.baleChatId || sub.chatId}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex justify-center items-center gap-1.5 flex-wrap">
                                                    <button 
                                                        onClick={() => handleStartMerge(sub)} 
                                                        className="py-1 px-2.5 bg-gradient-to-l from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/10 flex items-center gap-1 transition-all active:scale-95"
                                                        title="انتقال و ادغام اطلاعات این لید با مخاطبان"
                                                    >
                                                        <UserPlus size={13}/>
                                                        <span>انتقال / ادغام</span>
                                                    </button>
                                                    <button onClick={() => handleDeleteBotSub(sub.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" title="حذف لید"><Trash2 size={15}/></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {botSubscribers.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-gray-400 italic">هیچ لیدی هنوز از ربات جمع‌آوری نشده است.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="glass-panel rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
                        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
                            <h3 className="font-bold text-lg">{editingContact ? 'ویرایش مخاطب' : 'افزودن مخاطب جدید'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/20 rounded-lg"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">نام و نام خانوادگی *</label>
                                <input 
                                    className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-blue-500 outline-none transition-all font-bold"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    placeholder="مثلا: علی محمدی"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">شماره موبایل *</label>
                                <input 
                                    className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-blue-500 outline-none transition-all dir-ltr text-right font-mono font-bold"
                                    value={formData.mobile}
                                    onChange={e => setFormData({...formData, mobile: e.target.value})}
                                    placeholder="۰۹۱۲..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">کد تفصیلی حسابداری (جهت دریافت راحت مانده در ربات)</label>
                                <input 
                                    className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-blue-500 outline-none transition-all dir-ltr text-left font-mono font-bold"
                                    value={formData.accountCode || ''}
                                    onChange={e => setFormData({...formData, accountCode: e.target.value})}
                                    placeholder="مثلا: 104008"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">آیدی تلگرام</label>
                                    <input 
                                        className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-blue-500 outline-none transition-all font-bold"
                                        value={formData.telegramId || ''}
                                        onChange={e => setFormData({...formData, telegramId: e.target.value})}
                                        placeholder="@id"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">آیدی بله</label>
                                    <input 
                                        className="w-full border-2 border-gray-100 rounded-xl p-3 focus:border-blue-500 outline-none transition-all font-bold"
                                        value={formData.baleId || ''}
                                        onChange={e => setFormData({...formData, baleId: e.target.value})}
                                        placeholder="@id"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">تاریخ تولد (شمسی)</label>
                                <div className="flex gap-2" dir="ltr">
                                        <select 
                                            className="flex-1 border-2 border-gray-100 rounded-xl p-2 text-sm outline-none focus:border-blue-500"
                                            value={formData.birthday?.split('/')[2] || ''}
                                            onChange={e => {
                                                const parts = (formData.birthday || '1370/01/01').split('/');
                                                parts[2] = e.target.value.padStart(2, '0');
                                                setFormData({...formData, birthday: parts.join('/')});
                                            }}
                                        >
                                            <option value="">روز</option>
                                            {Array.from({length: 31}, (_, i) => (i + 1).toString().padStart(2, '0')).map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                        <select 
                                            className="flex-1 border-2 border-gray-100 rounded-xl p-2 text-sm outline-none focus:border-blue-500"
                                            value={formData.birthday?.split('/')[1] || ''}
                                            onChange={e => {
                                                const parts = (formData.birthday || '1370/01/01').split('/');
                                                parts[1] = e.target.value.padStart(2, '0');
                                                setFormData({...formData, birthday: parts.join('/')});
                                            }}
                                        >
                                            <option value="">ماه</option>
                                            {Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                        <input 
                                            type="number"
                                            className="w-20 border-2 border-gray-100 rounded-xl p-2 text-sm outline-none focus:border-blue-500 text-center font-mono"
                                            placeholder="سال"
                                            value={formData.birthday?.split('/')[0] || ''}
                                            onChange={e => {
                                                const parts = (formData.birthday || '1370/01/01').split('/');
                                                parts[0] = e.target.value;
                                                setFormData({...formData, birthday: parts.join('/')});
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col justify-end">
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer select-none mb-2">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.sendBirthdayGreeting} 
                                            onChange={e => setFormData({...formData, sendBirthdayGreeting: e.target.checked})}
                                        />
                                        ارسال خودکار پیام تبریک به این مخاطب
                                    </label>
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button 
                                    onClick={handleSaveContact}
                                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                                >
                                    ذخیره مخاطب
                                </button>
                                <button 
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-6 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200"
                                >
                                    انصراف
                                </button>
                            </div>
                        </div>
                    </div>

            )}

            {/* Subtab Back Trigger for Mobile Back Gesture/Button */}
            {activeTab === 'bot_leads' && (
                <button 
                    data-subtab-back="true" 
                    onClick={() => setActiveTab('contacts')} 
                    className="hidden"
                />
            )}

            {/* Lead Merge & Import Dialog Overlay */}
            {mergingLead && (
                <div role="dialog" className="fixed inset-0 z-[100] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in text-right font-sans" dir="rtl">
                    <div className="glass-panel rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 animate-scale-in">
                        <div className="bg-gradient-to-l from-blue-700 to-indigo-700 p-5 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-extrabold text-base flex items-center gap-2">
                                    <GitMerge size={20}/>
                                    انتقال و ادغام لید به مخاطبین فروش
                                </h3>
                                <p className="text-[10px] text-blue-100 mt-1">عضو ربات به جمع مخاطبین فروش اضافه و یا با یکی از مخاطبین فعلی ادغام می‌شود</p>
                            </div>
                            <button onClick={() => setMergingLead(null)} className="p-1.5 hover:bg-white/15 text-white rounded-lg transition-all text-xs font-bold">بستن (✕)</button>
                        </div>
                        
                        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                            {/* Lead Profile Preview */}
                            <div className="bg-blue-50/50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-blue-100/50 dark:border-zinc-800/80 flex items-center justify-between">
                                <div className="space-y-1">
                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block">پروفایل لید ربات ({mergingLead.platform === 'telegram' ? 'تلگرام' : 'پیام‌رسان بله'})</span>
                                    <div className="font-extrabold text-sm text-gray-800 dark:text-gray-100">{mergingLead.fullName || 'بدون نام'}</div>
                                    <div className="text-xs text-gray-500 font-mono select-all">{mergingLead.mobile || 'شماره ثبت نشده'}</div>
                                </div>
                                <div className="bg-blue-100/60 text-blue-800 font-bold px-3 py-1.5 rounded-xl text-xs">
                                    {mergingLead.platform === 'telegram' ? 'Telegram' : 'Bale'} ID: <code className="font-mono text-[10px] select-all">{mergingLead.telegramChatId || mergingLead.baleChatId || mergingLead.chatId}</code>
                                </div>
                            </div>

                            {/* Mode selection (Merge Existing vs Create New) */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black text-gray-500 dark:text-gray-400">نحوه پردازش و ثبت:</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => setMergeMode('new')}
                                        className={`p-3 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1.5 ${mergeMode === 'new' ? 'border-blue-600 bg-blue-50/20 text-blue-700 font-black' : 'border-gray-100 hover:bg-gray-50 text-gray-500 font-bold'}`}
                                    >
                                        <UserPlus size={18}/>
                                        <span className="text-xs">ثبت به عنوان مخاطب جدید</span>
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setMergeMode('existing')}
                                        className={`p-3 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center gap-1.5 ${mergeMode === 'existing' ? 'border-blue-600 bg-blue-50/20 text-blue-700 font-black' : 'border-gray-100 hover:bg-gray-50 text-gray-500 font-bold'}`}
                                    >
                                        <GitMerge size={18}/>
                                        <span className="text-xs">ادغام با مخاطب فعلی</span>
                                    </button>
                                </div>
                            </div>

                            {/* Existing Contact Selection Dropdown */}
                            {mergeMode === 'existing' && (
                                <div className="space-y-1.5 animate-in fade-in duration-200">
                                    <label className="block text-xs font-bold text-gray-500">انتخاب مخاطب مقصد برای مرج و ادغام:</label>
                                    <select 
                                        className="w-full border-2 border-gray-100 dark:border-zinc-800 rounded-xl p-3 focus:border-blue-500 outline-none transition-all font-bold text-sm bg-white dark:bg-zinc-900"
                                        value={selectedContactId}
                                        onChange={(e) => {
                                            setSelectedContactId(e.target.value);
                                            const contact = contacts.find(c => c.id === e.target.value);
                                            if (contact) {
                                                setMergeForm(prev => ({
                                                    ...prev,
                                                    name: contact.name || prev.name,
                                                    mobile: contact.mobile || prev.mobile,
                                                    accountCode: contact.accountCode || prev.accountCode || '',
                                                    // Only keep lead fields if contact fields are empty, else prioritize contact
                                                    telegramId: contact.telegramId || prev.telegramId || '',
                                                    baleId: contact.baleId || prev.baleId || '',
                                                    birthday: contact.birthday || prev.birthday || ''
                                                }));
                                            }
                                        }}
                                    >
                                        <option value="">-- یک مخاطب را انتخاب کنید --</option>
                                        {contacts.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.name} ({c.mobile}) {c.accountCode ? `[کد: ${c.accountCode}]` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-gray-400 mt-1">با ادغام اطلاعات، فیلدهای خالی مخاطب هدف با مقادیر ربات پر خواهد شد و هیچ اطلاعاتی پاک نمی‌شود.</p>
                                </div>
                            )}

                            {/* Merge fields adjustments form */}
                            <div className="space-y-4 pt-1 border-t border-gray-100 dark:border-zinc-800/80">
                                <span className="block text-xs font-black text-gray-500">بازنگری فیلدها پیش از ذخیره‌سازی:</span>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">نام مخاطب در پروسه</label>
                                        <input 
                                            className="w-full border-2 border-gray-100 dark:border-zinc-800 rounded-xl p-2.5 focus:border-blue-500 outline-none transition-all font-bold text-xs bg-white dark:bg-zinc-900"
                                            value={mergeForm.name}
                                            onChange={e => setMergeForm({...mergeForm, name: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">شماره موبایل</label>
                                        <input 
                                            className="w-full border-2 border-gray-100 dark:border-zinc-800 rounded-xl p-2.5 focus:border-blue-500 outline-none transition-all font-bold text-xs bg-white dark:bg-zinc-900 dir-ltr text-right"
                                            value={mergeForm.mobile}
                                            onChange={e => setMergeForm({...mergeForm, mobile: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">کد حساب مالی (اختیاری)</label>
                                        <input 
                                            className="w-full border-2 border-gray-100 dark:border-zinc-800 rounded-xl p-2.5 focus:border-blue-500 outline-none transition-all font-bold text-[11px] bg-white dark:bg-zinc-900 dir-ltr text-right font-mono text-emerald-600"
                                            value={mergeForm.accountCode}
                                            onChange={e => setMergeForm({...mergeForm, accountCode: e.target.value})}
                                            placeholder="مثلا: 103004"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">تاریخ تولد (شمسی)</label>
                                        <input 
                                            className="w-full border-2 border-gray-100 dark:border-zinc-800 rounded-xl p-2.5 focus:border-blue-500 outline-none transition-all font-bold text-[11px] bg-white dark:bg-zinc-900 dir-ltr text-right font-mono"
                                            value={mergeForm.birthday}
                                            placeholder="شمسی مانند: 1370/02/12"
                                            onChange={e => setMergeForm({...mergeForm, birthday: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">آیدی تلگرام</label>
                                        <input 
                                            className="w-full border-2 border-gray-100 dark:border-zinc-800 rounded-xl p-2.5 focus:border-blue-500 outline-none transition-all font-bold text-xs bg-white dark:bg-zinc-900"
                                            value={mergeForm.telegramId}
                                            onChange={e => setMergeForm({...mergeForm, telegramId: e.target.value})}
                                            placeholder="@id"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 mb-1">آیدی بله</label>
                                        <input 
                                            className="w-full border-2 border-gray-100 dark:border-zinc-800 rounded-xl p-2.5 focus:border-blue-500 outline-none transition-all font-bold text-xs bg-white dark:bg-zinc-900"
                                            value={mergeForm.baleId}
                                            onChange={e => setMergeForm({...mergeForm, baleId: e.target.value})}
                                            placeholder="@id"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/20 flex gap-3">
                            <button 
                                onClick={handleSaveMerge}
                                className="flex-1 bg-gradient-to-l from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-black text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg active:scale-95"
                            >
                                {mergeMode === 'existing' ? 'ادغام و بروزرسانی پرونده مخاطب' : 'ذخیره به عنوان مخاطب جدید'}
                            </button>
                            <button 
                                onClick={() => setMergingLead(null)}
                                className="px-5 bg-gray-150 hover:bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 rounded-xl font-bold text-sm"
                            >
                                انصراف
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
