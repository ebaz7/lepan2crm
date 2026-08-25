import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    Sparkles, 
    X, 
    Loader2, 
    TrendingUp, 
    AlertTriangle, 
    CheckCircle2, 
    Boxes, 
    Ship, 
    Building, 
    ShoppingCart, 
    Printer, 
    Copy, 
    Check, 
    RefreshCw,
    FileText,
    ShieldAlert,
    Clock,
    ArrowUpRight,
    Send,
    User,
    Users
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AiWarehouseAdvisorModalProps {
    isOpen: boolean;
    onClose: () => void;
    warehouseData: any;
    report1Label?: string;
    report2Label?: string;
    reportDate?: string;
}

export const AiWarehouseAdvisorModal: React.FC<AiWarehouseAdvisorModalProps> = ({
    isOpen,
    onClose,
    warehouseData,
    report1Label = 'سال قبل',
    report2Label = 'سال جاری',
    reportDate = ''
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [copied, setCopied] = useState(false);
    const [activeView, setActiveView] = useState<'insights' | 'alerts' | 'procurement' | 'fullReport'>('insights');
    
    // Bot dispatch state
    const [isBotPanelOpen, setIsBotPanelOpen] = useState(false);
    const [isSendingBot, setIsSendingBot] = useState(false);
    const [settings, setSettings] = useState<any>(null);
    const [useDefaultGroup, setUseDefaultGroup] = useState(true);
    const [useDefaultPerson, setUseDefaultPerson] = useState(true);
    const [selectedSavedContacts, setSelectedSavedContacts] = useState<string[]>([]);
    const [customTelegramIds, setCustomTelegramIds] = useState('');
    const [customBaleIds, setCustomBaleIds] = useState('');
    const [platforms, setPlatforms] = useState<('telegram' | 'bale')[]>(['telegram', 'bale']);

    useEffect(() => {
        if (isOpen) {
            fetch('/api/settings')
                .then(res => res.json())
                .then(data => setSettings(data))
                .catch(err => console.error("Error fetching settings:", err));
        }
    }, [isOpen]);

    const getFinalTargets = () => {
        const targets: { platform: 'telegram' | 'bale'; id: string; name: string }[] = [];
        
        // 1. Default Groups
        if (useDefaultGroup && settings) {
            if (platforms.includes('telegram')) {
                const tgGroupIds = [
                    settings.warehouseTelegramGroupId,
                    settings.warehouseTelegramGroupIds,
                    settings.warehouseGroupId,
                    settings.defaultWarehouseGroup
                ].filter(Boolean);
                tgGroupIds.forEach(id => {
                    const strId = String(id).trim();
                    if (strId && !targets.some(t => t.platform === 'telegram' && t.id === strId)) {
                        targets.push({ platform: 'telegram', id: strId, name: 'گروه پیش‌فرض تلگرام انبار' });
                    }
                });
            }
            if (platforms.includes('bale')) {
                const baleGroupIds = [
                    settings.warehouseBaleGroupId,
                    settings.warehouseBaleGroupIds
                ].filter(Boolean);
                baleGroupIds.forEach(id => {
                    const strId = String(id).trim();
                    if (strId && !targets.some(t => t.platform === 'bale' && t.id === strId)) {
                        targets.push({ platform: 'bale', id: strId, name: 'گروه پیش‌فرض بله انبار' });
                    }
                });
            }
        }

        // 2. Default Persons (Management)
        if (useDefaultPerson && settings) {
            if (platforms.includes('telegram') && settings.telegramChatId) {
                const chatIds = String(settings.telegramChatId).split(/[,،;\n\r]+/).map(s => s.trim()).filter(Boolean);
                chatIds.forEach(id => {
                    if (id && !targets.some(t => t.platform === 'telegram' && t.id === id)) {
                        targets.push({ platform: 'telegram', id, name: 'شخص مدیریت (تلگرام)' });
                    }
                });
            }
            if (platforms.includes('bale') && settings.baleChatId) {
                const chatIds = String(settings.baleChatId).split(/[,،;\n\r]+/).map(s => s.trim()).filter(Boolean);
                chatIds.forEach(id => {
                    if (id && !targets.some(t => t.platform === 'bale' && t.id === id)) {
                        targets.push({ platform: 'bale', id, name: 'شخص مدیریت (بله)' });
                    }
                });
            }
        }

        // 3. Saved Contacts
        if (settings?.savedContacts && Array.isArray(settings.savedContacts)) {
            settings.savedContacts.forEach((contact: any) => {
                if (selectedSavedContacts.includes(contact.id || contact.number)) {
                    if (platforms.includes('telegram') && contact.telegramId) {
                        const strId = String(contact.telegramId).trim();
                        if (strId && !targets.some(t => t.platform === 'telegram' && t.id === strId)) {
                            targets.push({ platform: 'telegram', id: strId, name: contact.name });
                        }
                    }
                    if (platforms.includes('bale') && contact.baleId) {
                        const strId = String(contact.baleId).trim();
                        if (strId && !targets.some(t => t.platform === 'bale' && t.id === strId)) {
                            targets.push({ platform: 'bale', id: strId, name: contact.name });
                        }
                    }
                    if (contact.number) {
                        const strId = String(contact.number).trim();
                        if (strId && !strId.startsWith('+') && strId.length > 5) {
                            const platform = contact.platform || (platforms.includes('telegram') ? 'telegram' : 'bale');
                            if (platforms.includes(platform) && !targets.some(t => t.platform === platform && t.id === strId)) {
                                targets.push({ platform: platform as any, id: strId, name: contact.name });
                            }
                        }
                    }
                }
            });
        }

        // 4. Custom manually typed IDs
        if (customTelegramIds && platforms.includes('telegram')) {
            const rawIds = customTelegramIds.split(/[,،;\n\r]+/).map(s => s.trim()).filter(Boolean);
            rawIds.forEach(id => {
                if (id && !targets.some(t => t.platform === 'telegram' && t.id === id)) {
                    targets.push({ platform: 'telegram', id, name: `آیدی دستی تلگرام: ${id}` });
                }
            });
        }
        if (customBaleIds && platforms.includes('bale')) {
            const rawIds = customBaleIds.split(/[,،;\n\r]+/).map(s => s.trim()).filter(Boolean);
            rawIds.forEach(id => {
                if (id && !targets.some(t => t.platform === 'bale' && t.id === id)) {
                    targets.push({ platform: 'bale', id, name: `آیدی دستی بله: ${id}` });
                }
            });
        }

        return targets;
    };

    const handleRunAnalysis = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/ai/warehouse-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    summary: warehouseData.summary,
                    yarnsSample: (warehouseData.yarnItems || []).slice(0, 15),
                    rawMaterialsSample: (warehouseData.rawItems || []).slice(0, 15),
                    logisticsItems: warehouseData.logisticsItems || [],
                    negativeItems: warehouseData.negativeItems || [],
                    growthItems: warehouseData.growthItems || [],
                    report1Label,
                    report2Label,
                    reportDate
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'خطا در برقراری ارتباط با سرویس هوش مصنوعی');
            }

            const data = await res.json();
            setAnalysisResult(data);
            toast.success('تحلیل استراتژیک انبار با هوش مصنوعی تکمیل شد.');
        } catch (err: any) {
            console.error('AI Warehouse analysis error:', err);
            toast.error(err.message || 'خطا در دریافت تحلیل هوشمند انبار');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendToBot = async () => {
        if (!analysisResult) {
            toast.error('داده‌ای برای ارسال وجود ندارد. ابتدا تحلیل را اجرا کنید.');
            return;
        }
        
        const finalTargets = getFinalTargets();
        if (finalTargets.length === 0) {
            toast.error('لطفاً حداقل یک مقصد (گروه، شخص یا آیدی سفارشی) جهت ارسال انتخاب نمایید.');
            return;
        }

        setIsSendingBot(true);
        try {
            const res = await fetch('/api/warehouse-overview/send-ai-advisor-report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    analysisResult,
                    platforms,
                    reportDate,
                    report1Label,
                    report2Label,
                    signature: 'مشاور استراتژیک هوش مصنوعی سایان',
                    customTargets: finalTargets
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(`گزارش ارزیابی هوشمند با موفقیت به ${data.sentCount} مقصد ارسال شد.`);
                setIsBotPanelOpen(false);
            } else {
                toast.error(data.error || 'خطا در ارسال گزارش به ربات');
            }
        } catch (err: any) {
            toast.error(err.message || 'خطا در ارتباط با سرور جهت ارسال گزارش');
        } finally {
            setIsSendingBot(false);
        }
    };

    React.useEffect(() => {
        if (isOpen && !analysisResult && !isLoading) {
            handleRunAnalysis();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const copyReport = () => {
        if (!analysisResult) return;
        const text = analysisResult.fullReportMarkdown || JSON.stringify(analysisResult, null, 2);
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('متن تحلیل در کلیپ‌بورد کپی شد.');
    };

    const handlePrint = () => {
        window.print();
    };

    return createPortal(
        <div id="ai-advisor-modal-print-area" className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animation-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }} dir="rtl">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative z-[99999]">
                
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                            <Sparkles className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-extrabold text-base sm:text-lg">مشاور استراتژیک هوش مصنوعی انبار و زنجیره تامین</h3>
                                <span className="px-2 py-0.5 text-[10px] bg-indigo-500/30 border border-indigo-400/40 rounded-full font-mono font-bold text-indigo-200">
                                    Gemini 2.5 Flash
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 font-medium mt-0.5">
                                تحلیل جامع تراز وزنی، وضعیت بارهای در راه و گمرک، ریسک کسری و پیشنهادات خرید
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleRunAnalysis}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                            title="تحلیل مجدد"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">تحلیل مجدد</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Sub Navigation Bar */}
                <div className="px-5 py-2.5 bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-2 no-print">
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setActiveView('insights')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeView === 'insights'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300'
                            }`}
                        >
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>شاخص‌ها و دیدگاه کلان</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveView('alerts')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeView === 'alerts'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300'
                            }`}
                        >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>هشدارهای کسری ({analysisResult?.criticalAlerts?.length || 0})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveView('procurement')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeView === 'procurement'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300'
                            }`}
                        >
                            <ShoppingCart className="w-3.5 h-3.5" />
                            <span>برنامه خرید و ترخیص ({analysisResult?.procurementActionPlan?.length || 0})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveView('fullReport')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeView === 'fullReport'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300'
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span>متن کامل گزارش مدیریتی</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 no-print">
                        {analysisResult && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setIsBotPanelOpen(!isBotPanelOpen)}
                                    className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 border transition-all ${
                                        isBotPanelOpen 
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-900 dark:text-indigo-300' 
                                            : 'bg-white hover:text-indigo-600 border-slate-200 text-slate-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300'
                                    }`}
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>ارسال به بات</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg flex items-center gap-1 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>چاپ گزارش</span>
                                </button>
                            </>
                        )}

                        <button
                            type="button"
                            onClick={copyReport}
                            className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 rounded-lg flex items-center gap-1 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? 'کپی شد' : 'کپی گزارش'}</span>
                        </button>
                    </div>
                </div>

                {/* Bot Dispatch Options Panel */}
                {isBotPanelOpen && analysisResult && (
                    <div className="px-5 py-5 bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700/60 flex flex-col gap-5 no-print transition-all animate-fade-in text-slate-800 dark:text-zinc-200">
                        {/* Header & General Config */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-zinc-700/40 pb-4">
                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                                    <Send className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" />
                                    <span>تنظیمات پیشرفته و ارسال هوشمند گزارش به بات‌ها</span>
                                </h4>
                                <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
                                    تعیین دقیق گروه‌ها، اشخاص و مخاطبان دلخواه برای ارسال فایل PDF رسمی و گزارش هوش مصنوعی.
                                </p>
                            </div>

                            {/* Platform selector checkboxes */}
                            <div className="flex items-center gap-4 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 p-2.5 rounded-xl shrink-0">
                                <span className="font-bold text-slate-500 dark:text-zinc-400 ml-1">بسترهای فعال:</span>
                                <label className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-zinc-200 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={platforms.includes('telegram')}
                                        onChange={(e) => {
                                            if (e.target.checked) setPlatforms([...platforms, 'telegram']);
                                            else setPlatforms(platforms.filter(p => p !== 'telegram'));
                                        }}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span>تلگرام</span>
                                </label>
                                <label className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-zinc-200 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={platforms.includes('bale')}
                                        onChange={(e) => {
                                            if (e.target.checked) setPlatforms([...platforms, 'bale']);
                                            else setPlatforms(platforms.filter(p => p !== 'bale'));
                                        }}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span>بله</span>
                                </label>
                            </div>
                        </div>

                        {/* Middle Settings: Defaults vs Custom Overrides */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
                            {/* Left Col: System Defaults (lg:col-span-4) */}
                            <div className="lg:col-span-4 space-y-3">
                                <span className="font-extrabold text-slate-600 dark:text-zinc-400 block mb-1">گیرندگان پیش‌فرض سیستم:</span>
                                
                                {/* Default Group Toggle Card */}
                                <div className="p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-2">
                                    <label className="flex items-center gap-2 font-black text-slate-800 dark:text-zinc-200 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={useDefaultGroup}
                                            onChange={(e) => setUseDefaultGroup(e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                                        />
                                        <span>ارسال به گروه‌های پیش‌فرض انبار</span>
                                    </label>
                                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 pr-6 space-y-1">
                                        <div>تلگرام: {settings?.warehouseTelegramGroupId || settings?.warehouseGroupId || <span className="text-red-500 font-bold">تنظیم‌نشده</span>}</div>
                                        <div>بله: {settings?.warehouseBaleGroupId || <span className="text-red-500 font-bold">تنظیم‌نشده</span>}</div>
                                    </div>
                                </div>

                                {/* Default Manager Toggle Card */}
                                <div className="p-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl space-y-2">
                                    <label className="flex items-center gap-2 font-black text-slate-800 dark:text-zinc-200 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={useDefaultPerson}
                                            onChange={(e) => setUseDefaultPerson(e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                                        />
                                        <span>ارسال به شخص مدیریت (ادمین‌ها)</span>
                                    </label>
                                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 pr-6 space-y-1">
                                        <div>تلگرام: {settings?.telegramChatId || <span className="text-red-500 font-bold">تنظیم‌نشده</span>}</div>
                                        <div>بله: {settings?.baleChatId || <span className="text-red-500 font-bold">تنظیم‌نشده</span>}</div>
                                    </div>
                                </div>
                            </div>

                            {/* Middle Col: Saved Contacts Picker (lg:col-span-4) */}
                            <div className="lg:col-span-4 space-y-2">
                                <span className="font-extrabold text-slate-600 dark:text-zinc-400 block mb-1">انتخاب از مخاطبان و گروه‌های ذخیره شده:</span>
                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 max-h-40 overflow-y-auto custom-scrollbar space-y-2">
                                    {!settings?.savedContacts || settings.savedContacts.length === 0 ? (
                                        <div className="text-center py-6 text-slate-400 dark:text-zinc-500 font-medium">مخاطب ذخیره شده‌ای یافت نشد.</div>
                                    ) : (
                                        settings.savedContacts.map((contact: any) => {
                                            const contactId = contact.id || contact.number;
                                            const isSelected = selectedSavedContacts.includes(contactId);
                                            return (
                                                <label key={contactId} className="flex items-center gap-2 py-1 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg px-1.5 cursor-pointer font-medium transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedSavedContacts([...selectedSavedContacts, contactId]);
                                                            else setSelectedSavedContacts(selectedSavedContacts.filter(id => id !== contactId));
                                                        }}
                                                        className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-slate-800 dark:text-zinc-200 font-bold truncate">{contact.name}</div>
                                                        <div className="text-[9px] text-slate-400 truncate">
                                                            {contact.telegramId && `T: ${contact.telegramId} `}
                                                            {contact.baleId && `B: ${contact.baleId}`}
                                                        </div>
                                                    </div>
                                                    <span className="px-1.5 py-0.5 rounded text-[8px] bg-slate-100 dark:bg-zinc-800 font-bold text-slate-500">
                                                        {contact.isGroup ? 'گروه' : 'شخص'}
                                                    </span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Right Col: Custom manual overrides inputs (lg:col-span-4) */}
                            <div className="lg:col-span-4 space-y-3">
                                <span className="font-extrabold text-slate-600 dark:text-zinc-400 block mb-1">تعیین مستقیم آیدی‌های سفارشی:</span>
                                
                                <div className="space-y-2">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 mb-1">آیدی‌های تلگرام (عددی، با کاما جدا کنید):</label>
                                        <input
                                            type="text"
                                            value={customTelegramIds}
                                            onChange={(e) => setCustomTelegramIds(e.target.value)}
                                            placeholder="مثال: -1002134567, 4390234"
                                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono tracking-wide text-left dir-ltr focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 mb-1">آیدی‌های بله (عددی، با کاما جدا کنید):</label>
                                        <input
                                            type="text"
                                            value={customBaleIds}
                                            onChange={(e) => setCustomBaleIds(e.target.value)}
                                            placeholder="مثال: 98765432, 234567"
                                            className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono tracking-wide text-left dir-ltr focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Calculated Final Targets Overview & final trigger button */}
                        <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/15 rounded-2xl border border-indigo-100/40 dark:border-indigo-900/30 flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="w-full md:w-auto space-y-1.5 flex-1">
                                <span className="text-[10px] font-extrabold text-indigo-950 dark:text-indigo-400 block">لیست نهایی مقاصد برای ارسال گزارش:</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {getFinalTargets().length === 0 ? (
                                        <span className="text-[10px] text-red-500 dark:text-red-400 font-bold animate-pulse">هیچ مقصدی انتخاب نشده است!</span>
                                    ) : (
                                        getFinalTargets().map((t, idx) => (
                                            <span key={`${t.platform}-${t.id}-${idx}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 shadow-xs">
                                                <span className={`w-1.5 h-1.5 rounded-full ${t.platform === 'telegram' ? 'bg-sky-400' : 'bg-green-500'}`} />
                                                <span className="text-slate-800 dark:text-zinc-200">{t.name}</span>
                                                <span className="text-slate-400 font-mono font-normal">({t.id})</span>
                                            </span>
                                        ))
                                    )}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleSendToBot}
                                disabled={isSendingBot || getFinalTargets().length === 0}
                                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-slate-300 disabled:to-slate-300 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {isSendingBot ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>در حال تولید PDF و ارسال...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        <span>تایید و ارسال نهایی گزارش</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Content Body */}
                <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center space-y-4">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                            <div className="text-center space-y-1">
                                <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">
                                    هوش مصنوعی در حال تحلیل عمیق زنجیره تامین و انبار...
                                </h4>
                                <p className="text-xs text-slate-500 max-w-md">
                                    بررسی تراز وزنی سال گذشته و سال جاری، تلفیق بارهای در راه، ترخیص گمرک، خریدهای جاری و برآورد زمان اتمام موجودی.
                                </p>
                            </div>
                        </div>
                    ) : !analysisResult ? (
                        <div className="py-16 text-center space-y-3">
                            <Boxes className="w-12 h-12 text-slate-300 mx-auto" />
                            <p className="text-sm font-bold text-slate-600">داده‌ای برای نمایش وجود ندارد.</p>
                            <button
                                type="button"
                                onClick={handleRunAnalysis}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold"
                            >
                                شروع تحلیل با هوش مصنوعی
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Executive Highlight Banner */}
                            <div className="bg-gradient-to-br from-indigo-50 via-slate-50 to-blue-50 dark:from-zinc-800/80 dark:to-zinc-800/40 p-5 rounded-2xl border border-indigo-100 dark:border-zinc-700 space-y-4">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl font-mono font-black text-sm shadow-xs flex items-center gap-1.5">
                                            <span>نمره پایداری زنجیره:</span>
                                            <span className="text-amber-300 font-extrabold">{analysisResult.healthScore || 85}</span>
                                            <span>/ ۱۰۰</span>
                                        </div>
                                        <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                                            ارزیابی هوشمند تاریخ {reportDate || 'امروز'}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                                        <span>تراز مبنا: {report1Label}</span>
                                        <span>•</span>
                                        <span>تراز جاری: {report2Label}</span>
                                    </div>
                                </div>

                                {/* Executive Summary Points */}
                                <div className="space-y-2 pt-2 border-t border-indigo-100 dark:border-zinc-700">
                                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                        <span>خلاصه اجرایی مخصوص جلسه مدیران و هیئت مدیره:</span>
                                    </h4>
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                                        {(analysisResult.executiveSummary || []).map((point: string, idx: number) => (
                                            <li key={idx} className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-slate-300 font-medium flex items-start gap-2 shadow-xs">
                                                <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                                                    {idx + 1}
                                                </span>
                                                <span className="leading-relaxed">{point}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* View 1: Insights & Macro Analysis */}
                            {activeView === 'insights' && (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                                            <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-100 dark:border-zinc-800 pb-2">
                                                <Boxes className="w-4 h-4 text-blue-600" />
                                                <span>تحلیل کلان تراز وزنی انبار</span>
                                            </h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line font-normal">
                                                {analysisResult.totalWeightAnalysis || 'اطلاعات در دسترس نیست.'}
                                            </p>
                                        </div>

                                        <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                                            <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 border-b border-slate-100 dark:border-zinc-800 pb-2">
                                                <Ship className="w-4 h-4 text-teal-600" />
                                                <span>تحلیل پایپ‌لاین لجستیک (در راه، گمرک، خرید)</span>
                                            </h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line font-normal">
                                                {analysisResult.logisticsPipelineInsight || 'اطلاعات در دسترس نیست.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* View 2: Critical Alerts */}
                            {activeView === 'alerts' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                                            اقلام نیازمند اقدام فوری و پیشگیری از توقف خط تولید:
                                        </h4>
                                        <span className="text-xs text-slate-500 font-medium">
                                            تعداد هشدارهای شناسایی شده: {analysisResult.criticalAlerts?.length || 0} مورد
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {(analysisResult.criticalAlerts || []).map((alert: any, idx: number) => {
                                            const isCrit = alert.riskLevel === 'CRITICAL';
                                            return (
                                                <div 
                                                    key={idx} 
                                                    className={`p-4 rounded-xl border flex flex-col justify-between space-y-2 ${
                                                        isCrit 
                                                            ? 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50' 
                                                            : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-extrabold text-xs text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                                            <AlertTriangle className={`w-4 h-4 ${isCrit ? 'text-rose-600' : 'text-amber-600'}`} />
                                                            <span>{alert.itemName}</span>
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                            isCrit ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                                                        }`}>
                                                            {isCrit ? 'بحرانی' : 'هشدار ریسک'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                                        {alert.reason}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* View 3: Procurement & Logistics Plan */}
                            {activeView === 'procurement' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                                            برنامه عملیاتی تامین مواد اولیه و تسریع ترخیص:
                                        </h4>
                                    </div>

                                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800">
                                        <table className="w-full text-xs text-right border-collapse">
                                            <thead>
                                                <tr className="bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 font-extrabold">
                                                    <th className="py-2.5 px-3">اولویت</th>
                                                    <th className="py-2.5 px-3">اقدام پیشنهادی هوش مصنوعی</th>
                                                    <th className="py-2.5 px-3">اثر استراتژیک بر تولید / نقدینگی</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                                                {(analysisResult.procurementActionPlan || []).map((plan: any, idx: number) => {
                                                    const isHigh = plan.priority === 'HIGH';
                                                    return (
                                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                                            <td className="py-3 px-3">
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                    isHigh 
                                                                        ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                                                                        : 'bg-blue-100 text-blue-800 border border-blue-200'
                                                                }`}>
                                                                    {isHigh ? 'اولویت اول (فوری)' : 'اولویت دوم'}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100">
                                                                {plan.action}
                                                            </td>
                                                            <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-medium">
                                                                {plan.impact}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* View 4: Full Report Markdown */}
                            {activeView === 'fullReport' && (
                                <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
                                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                            <FileText className="w-4 h-4 text-indigo-600" />
                                            <span>متن کامل گزارش تحلیلی مدیر ارشد زنجیره تامین</span>
                                        </h4>
                                    </div>
                                    <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-wrap selection:bg-indigo-100">
                                        {analysisResult.fullReportMarkdown}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-2 no-print">
                    <div className="text-[11px] text-slate-500 font-medium">
                        تولید شده توسط موتور هوش مصنوعی پیشرفته سیستم یکپارچه لپان بافت
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
                        >
                            بستن
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
export default AiWarehouseAdvisorModal;
