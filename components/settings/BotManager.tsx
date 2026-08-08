import React, { useState, useEffect } from 'react';
import { Send, MessageCircle, RefreshCcw, Power, Loader2, CheckCircle2, AlertTriangle, Users, Plus, Trash2, Key, ShieldAlert } from 'lucide-react';
import { apiCall } from '../../services/apiService';
import { ReportDeliveryManager } from './ReportDeliveryManager';
import { SystemSettings, UnionExitBotUser } from '../../types';

interface BotManagerProps {
    settings: SystemSettings;
    setSettings: (settings: SystemSettings) => void;
}

const BotManager: React.FC<BotManagerProps> = ({ settings, setSettings }) => {
    const [loading, setLoading] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [savingUsers, setSavingUsers] = useState(false);

    // Union Exit Bot Users State
    const [botUsers, setBotUsers] = useState<UnionExitBotUser[]>(settings.unionExitBotUsers || []);
    const [warehouseItems, setWarehouseItems] = useState<any[]>([]);
    
    // New User Form State
    const [newUserId, setNewUserId] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserCompanies, setNewUserCompanies] = useState<string[]>([]);
    const [newUserItems, setNewUserItems] = useState<string[]>([]);
    
    const [allCompaniesSelected, setAllCompaniesSelected] = useState(true);
    const [allProductsSelected, setAllProductsSelected] = useState(true);

    const companiesList = settings.companyNames || (settings.companies || []).map(c => c.name) || [];

    useEffect(() => {
        const fetchItems = async () => {
            try {
                const res = await apiCall<any[]>('/warehouse/items');
                if (Array.isArray(res)) {
                    setWarehouseItems(res);
                }
            } catch (e) {
                console.error("Error fetching warehouse items:", e);
            }
        };
        fetchItems();
    }, []);

    // Sync state if settings prop changes
    useEffect(() => {
        if (settings.unionExitBotUsers) {
            setBotUsers(settings.unionExitBotUsers);
        }
    }, [settings.unionExitBotUsers]);

    const handleRestart = async (type: 'telegram' | 'bale' | 'whatsapp') => {
        const labels = { telegram: 'تلگرام', bale: 'بله', whatsapp: 'واتساپ' };
        if (!confirm(`آیا از راه‌اندازی مجدد ربات ${labels[type]} اطمینان دارید؟`)) return;
        
        setLoading(type);
        setSuccessMsg(null);

        try {
            await apiCall('/restart-bot', 'POST', { type });
            
            if (type === 'whatsapp') {
                setTimeout(() => {
                    apiCall('/whatsapp/status'); 
                }, 3000);
            }

            setSuccessMsg(`${labels[type]} با موفقیت بازنشانی شد. لطفاً چند لحظه صبر کنید.`);
            setTimeout(() => setSuccessMsg(null), 5000);
        } catch (e: any) {
            console.error("Restart Error:", e);
            
            if (e.message && e.message.includes('404')) {
                alert(`⚠️ خطای 404: سرویس بازنشانی پیدا نشد.\n\nاین یعنی کدهای سرور آپدیت شده‌اند اما سرور هنوز ریستارت نشده است.\n\nلطفاً برنامه سرور (node server.js) را ببندید و دوباره اجرا کنید.`);
            } else {
                const errMsg = e.message || 'خطا در عملیات بازنشانی';
                alert(`خطا: ${errMsg}`);
            }
        } finally {
            setLoading(null);
        }
    };

    const handleAddUser = () => {
        if (!newUserId.trim()) {
            alert("لطفاً آیدی بله یا تلگرام کاربر را وارد کنید.");
            return;
        }

        // Check duplicate
        if (botUsers.some(u => u.messengerId === newUserId.trim())) {
            alert("کاربر با این شناسه قبلاً ثبت شده است.");
            return;
        }

        const newUser: UnionExitBotUser = {
            id: Math.random().toString(36).substring(2, 11),
            messengerId: newUserId.trim(),
            name: newUserName.trim() || 'کاربر بدون نام',
            allowedCompanies: allCompaniesSelected ? ['*'] : newUserCompanies,
            allowedCommodities: allProductsSelected ? ['*'] : newUserItems
        };

        const updatedUsers = [...botUsers, newUser];
        setBotUsers(updatedUsers);
        
        // Reset form
        setNewUserId('');
        setNewUserName('');
        setNewUserCompanies([]);
        setNewUserItems([]);
        setAllCompaniesSelected(true);
        setAllProductsSelected(true);
    };

    const handleDeleteUser = (id: string) => {
        if (!confirm("آیا از حذف دسترسی این کاربر اطمینان دارید؟")) return;
        const updatedUsers = botUsers.filter(u => u.id !== id);
        setBotUsers(updatedUsers);
    };

    const handleSaveUsers = async () => {
        setSavingUsers(true);
        try {
            const updatedSettings = {
                ...settings,
                unionExitBotUsers: botUsers
            };
            await apiCall('/settings', 'POST', updatedSettings);
            setSettings(updatedSettings);
            alert("تنظیمات دسترسی کاربران خروج اتحادیه با موفقیت ذخیره شد.");
        } catch (e) {
            console.error("Error saving union exit bot users:", e);
            alert("خطا در ذخیره تنظیمات.");
        } finally {
            setSavingUsers(false);
        }
    };

    const toggleCompanySelection = (co: string) => {
        if (newUserCompanies.includes(co)) {
            setNewUserCompanies(newUserCompanies.filter(c => c !== co));
        } else {
            setNewUserCompanies([...newUserCompanies, co]);
        }
    };

    const toggleProductSelection = (itemId: string) => {
        if (newUserItems.includes(itemId)) {
            setNewUserItems(newUserItems.filter(id => id !== itemId));
        } else {
            setNewUserItems([...newUserItems, itemId]);
        }
    };

    return (
        <div className="space-y-6">
            {/* Bots Restart Manager */}
            <div className="glass-panel p-6 rounded-xl border border-gray-200/50 dark:border-white/10 shadow-sm animate-fade-in">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                    <Power size={20} className="text-red-500"/>
                    مدیریت سرویس‌های پیام‌رسان (Restart Bots)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Telegram */}
                    <div className="border rounded-xl p-4 flex flex-col items-center justify-center gap-3 bg-blue-50/50 hover:bg-blue-50 transition-colors">
                        <div className="bg-blue-100 p-3 rounded-full text-blue-600">
                            <Send size={24}/>
                        </div>
                        <div className="text-center">
                            <h4 className="font-bold text-gray-800">ربات تلگرام</h4>
                            <p className="text-xs text-gray-500 mt-1">اتصال به سرورهای تلگرام</p>
                        </div>
                        <button 
                            onClick={() => handleRestart('telegram')} 
                            disabled={loading === 'telegram'}
                            className="w-full bg-blue-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {loading === 'telegram' ? <Loader2 size={14} className="animate-spin"/> : <RefreshCcw size={14}/>}
                            راه‌اندازی مجدد
                        </button>
                    </div>

                    {/* Bale */}
                    <div className="border rounded-xl p-4 flex flex-col items-center justify-center gap-3 bg-green-50/50 hover:bg-green-50 transition-colors">
                        <div className="bg-green-100 p-3 rounded-full text-green-600">
                            <MessageCircle size={24}/>
                        </div>
                        <div className="text-center">
                            <h4 className="font-bold text-gray-800">ربات بله</h4>
                            <p className="text-xs text-gray-500 mt-1">اتصال به سرورهای بله</p>
                        </div>
                        <button 
                            onClick={() => handleRestart('bale')} 
                            disabled={loading === 'bale'}
                            className="w-full bg-green-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-green-700 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {loading === 'bale' ? <Loader2 size={14} className="animate-spin"/> : <RefreshCcw size={14}/>}
                            راه‌اندازی مجدد
                        </button>
                    </div>

                    {/* WhatsApp */}
                    <div className="border rounded-xl p-4 flex flex-col items-center justify-center gap-3 bg-teal-50/50 hover:bg-teal-50 transition-colors">
                        <div className="bg-teal-100 p-3 rounded-full text-teal-600">
                            <MessageCircle size={24}/>
                        </div>
                        <div className="text-center">
                            <h4 className="font-bold text-gray-800">ربات واتساپ</h4>
                            <p className="text-xs text-gray-500 mt-1">مدیریت نشست (Session)</p>
                        </div>
                        <button 
                            onClick={() => handleRestart('whatsapp')} 
                            disabled={loading === 'whatsapp'}
                            className="w-full bg-teal-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-teal-700 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                            {loading === 'whatsapp' ? <Loader2 size={14} className="animate-spin"/> : <RefreshCcw size={14}/>}
                            راه‌اندازی مجدد
                        </button>
                    </div>
                </div>

                {successMsg && (
                    <div className="mt-4 bg-green-100 text-green-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold animate-fade-in border border-green-200">
                        <CheckCircle2 size={16}/> {successMsg}
                    </div>
                )}
            </div>

            {/* Union Exit Bot Users Access Settings */}
            <div className="glass-panel p-6 rounded-xl border border-gray-200/50 dark:border-white/10 shadow-sm animate-fade-in">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-2">
                    <Users size={20} className="text-blue-600"/>
                    مدیریت دسترسی کاربران ربات بله/تلگرام (خروج اتحادیه)
                </h3>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                    در این بخش می‌توانید بدون نیاز به ایجاد اکانت سیستمی، به کاربران بله یا تلگرام بر اساس آیدی عددی آن‌ها، دسترسی ثبت درخواست <b>«خروج اتحادیه»</b> بدهید و مشخص کنید به کدام شرکت‌ها و کالاها دسترسی داشته باشند.
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Register Form */}
                    <div className="lg:col-span-1 border rounded-xl p-4 bg-gray-50/50 dark:bg-gray-800/20 space-y-4">
                        <h4 className="font-bold text-sm text-gray-800 border-b pb-1.5 flex items-center gap-1.5">
                            <Plus size={16} className="text-green-600" />
                            افزودن کاربر جدید
                        </h4>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-gray-600 block mb-1">شناسه عددی (Bale / Telegram Chat ID) <span className="text-red-500">*</span></label>
                                <input 
                                    className="w-full border rounded-lg p-2 text-xs dir-ltr font-mono" 
                                    placeholder="مثال: 987654321" 
                                    value={newUserId}
                                    onChange={e => setNewUserId(e.target.value.replace(/\D/g, ''))}
                                />
                                <span className="text-[10px] text-gray-400 mt-1 block">کاربر با ارسال پیام به ربات و نوشتن کلمه «آیدی» می‌تواند این کد را دریافت کند.</span>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-600 block mb-1">نام یا عنوان کاربر</label>
                                <input 
                                    className="w-full border rounded-lg p-2 text-xs" 
                                    placeholder="مثال: راننده کریمی" 
                                    value={newUserName}
                                    onChange={e => setNewUserName(e.target.value)}
                                />
                            </div>

                            {/* Allowed Companies Selection */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-bold text-gray-600">شرکت‌های مجاز</label>
                                    <label className="flex items-center gap-1 text-[10px] text-blue-600 cursor-pointer font-bold select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={allCompaniesSelected}
                                            onChange={e => setAllCompaniesSelected(e.target.checked)}
                                        />
                                        دسترسی به همه
                                    </label>
                                </div>
                                {!allCompaniesSelected && (
                                    <div className="border rounded-lg p-2 max-h-32 overflow-y-auto bg-white dark:bg-gray-800 space-y-1">
                                        {companiesList.map(co => (
                                            <label key={`co_sel_${co}`} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer py-0.5 hover:bg-gray-50 rounded">
                                                <input 
                                                    type="checkbox" 
                                                    checked={newUserCompanies.includes(co)}
                                                    onChange={() => toggleCompanySelection(co)}
                                                />
                                                {co}
                                            </label>
                                        ))}
                                        {companiesList.length === 0 && <span className="text-[10px] text-gray-400">هیچ شرکتی تعریف نشده است.</span>}
                                    </div>
                                )}
                            </div>

                            {/* Allowed Products Selection */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-bold text-gray-600">کالاهای مجاز</label>
                                    <label className="flex items-center gap-1 text-[10px] text-blue-600 cursor-pointer font-bold select-none">
                                        <input 
                                            type="checkbox" 
                                            checked={allProductsSelected}
                                            onChange={e => setAllProductsSelected(e.target.checked)}
                                        />
                                        دسترسی به همه
                                    </label>
                                </div>
                                {!allProductsSelected && (
                                    <div className="border rounded-lg p-2 max-h-40 overflow-y-auto bg-white dark:bg-gray-800 space-y-1">
                                        {warehouseItems.map(item => (
                                            <label key={`item_sel_${item.id}`} className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer py-0.5 hover:bg-gray-50 rounded">
                                                <input 
                                                    type="checkbox" 
                                                    checked={newUserItems.includes(item.name)}
                                                    onChange={() => toggleProductSelection(item.name)}
                                                />
                                                {item.name}
                                            </label>
                                        ))}
                                        {warehouseItems.length === 0 && <span className="text-[10px] text-gray-400">هیچ کالایی در انبار ثبت نشده است.</span>}
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={handleAddUser}
                                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                            >
                                <Plus size={14}/> افزودن به لیست
                            </button>
                        </div>
                    </div>

                    {/* Right Column: Users List */}
                    <div className="lg:col-span-2 border rounded-xl p-4 flex flex-col justify-between min-h-[300px]">
                        <div>
                            <h4 className="font-bold text-sm text-gray-800 border-b pb-1.5 mb-3 flex items-center gap-1.5">
                                <Key size={16} className="text-blue-600" />
                                لیست کاربران مجاز خروج اتحادیه
                            </h4>

                            <div className="overflow-x-auto">
                                <table className="w-full text-right text-xs">
                                    <thead>
                                        <tr className="border-b bg-gray-50 text-gray-500 font-bold">
                                            <th className="p-2">نام کاربر</th>
                                            <th className="p-2">شناسه عددی (پیام‌رسان)</th>
                                            <th className="p-2">شرکت‌های مجاز</th>
                                            <th className="p-2">کالاهای مجاز</th>
                                            <th className="p-2 text-center w-12">عملیات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {botUsers.map((u) => (
                                            <tr key={u.id} className="hover:bg-gray-50/50">
                                                <td className="p-2 font-bold text-gray-800">{u.name}</td>
                                                <td className="p-2 font-mono">{u.messengerId}</td>
                                                <td className="p-2 text-gray-600">
                                                    {u.allowedCompanies.includes('*') ? (
                                                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-black">همه شرکت‌ها</span>
                                                    ) : (
                                                        <span className="truncate max-w-[120px] block" title={u.allowedCompanies.join('، ')}>
                                                            {u.allowedCompanies.join('، ')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2 text-gray-600">
                                                    {u.allowedCommodities.includes('*') ? (
                                                        <span className="bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-black">همه کالاها</span>
                                                    ) : (
                                                        <span className="truncate max-w-[120px] block" title={u.allowedCommodities.join('، ')}>
                                                            {u.allowedCommodities.join('، ')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button 
                                                        onClick={() => handleDeleteUser(u.id)}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                                                        title="حذف دسترسی"
                                                    >
                                                        <Trash2 size={14}/>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {botUsers.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-gray-400 font-bold">
                                                    <ShieldAlert size={24} className="mx-auto text-gray-300 mb-1" />
                                                    هیچ کاربری با دسترسی خروج اتحادیه ثبت نشده است.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {botUsers.length > 0 && (
                            <div className="border-t pt-4 mt-4 flex justify-end">
                                <button 
                                    onClick={handleSaveUsers}
                                    disabled={savingUsers}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                                >
                                    {savingUsers ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}
                                    ذخیره نهایی دسترسی‌ها
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Centralized Universal Report Delivery Engine Configurator */}
            <ReportDeliveryManager />
        </div>
    );
};

export default BotManager;
