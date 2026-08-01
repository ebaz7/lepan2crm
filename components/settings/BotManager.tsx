
import React, { useState } from 'react';
import { Send, MessageCircle, RefreshCcw, Power, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiCall } from '../../services/apiService';
import { ReportDeliveryManager } from './ReportDeliveryManager';

const BotManager: React.FC = () => {
    const [loading, setLoading] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleRestart = async (type: 'telegram' | 'bale' | 'whatsapp') => {
        const labels = { telegram: 'تلگرام', bale: 'بله', whatsapp: 'واتساپ' };
        if (!confirm(`آیا از راه‌اندازی مجدد ربات ${labels[type]} اطمینان دارید؟`)) return;
        
        setLoading(type);
        setSuccessMsg(null);

        try {
            await apiCall('/restart-bot', 'POST', { type });
            
            // If WhatsApp, wait a moment then trigger status check to reveal QR
            if (type === 'whatsapp') {
                setTimeout(() => {
                    // This api call triggers backend to check state, frontend Settings page polls this.
                    // But to be sure, we can alert user.
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

    return (
        <div className="space-y-6">
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

            {/* Centralized Universal Report Delivery Engine Configurator */}
            <ReportDeliveryManager />
        </div>
    );
};

export default BotManager;
