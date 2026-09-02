import React, { useState, useEffect } from 'react';
import { 
    Sparkles, 
    X, 
    Loader2, 
    TrendingUp, 
    TrendingDown,
    Activity,
    DollarSign, 
    AlertTriangle, 
    CheckCircle2, 
    ShieldAlert, 
    FileText, 
    Copy, 
    Check, 
    RefreshCw,
    Award,
    Send,
    Download,
    Layers,
    BarChart3,
    PieChart as PieIcon,
    Calendar,
    MessageSquare,
    Sliders,
    Bot,
    ChevronDown,
    Info,
    HelpCircle,
    Building2,
    Factory,
    Boxes
} from 'lucide-react';
import { 
    ResponsiveContainer, 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    Tooltip, 
    Legend, 
    LineChart, 
    Line, 
    AreaChart, 
    Area, 
    CartesianGrid 
} from 'recharts';
import toast from 'react-hot-toast';
import { apiCall } from '../services/apiService';

export interface AiSayanReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    reportSection: string;
    sectionTitle?: string;
    reportPayload: any;
    dateRange?: any;
    customPrompt?: string;
    settings?: any;
}

export const AiSayanReportModal: React.FC<AiSayanReportModalProps> = ({
    isOpen,
    onClose,
    reportSection,
    sectionTitle,
    reportPayload,
    dateRange,
    customPrompt,
    settings
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'chart' | 'executive' | 'engineering' | 'risks' | 'actionPlan' | 'markdown' | 'chat'>('dashboard');
    const [copied, setCopied] = useState(false);

    // Bot dispatch modal state
    const [isBotModalOpen, setIsBotModalOpen] = useState(false);
    const [isSendingBot, setIsSendingBot] = useState(false);
    const [selectedPlatforms, setSelectedPlatforms] = useState<('telegram' | 'bale' | 'whatsapp')[]>(['telegram', 'bale']);
    const [customGroupTele, setCustomGroupTele] = useState('');
    const [customGroupBale, setCustomGroupBale] = useState('');
    const [customGroupWa, setCustomGroupWa] = useState('');
    const [attachPdfToBot, setAttachPdfToBot] = useState(true);

    // PDF Download state
    const [isExportingPdf, setIsExportingPdf] = useState(false);

    // Follow-up Chat state
    const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant', text: string }>>([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatLoading, setIsChatLoading] = useState(false);

    const getSectionIcon = () => {
        switch (reportSection) {
            case 'production':
            case 'production_comparison':
            case 'prodReturns':
                return <Factory className="w-5 h-5 text-amber-400" />;
            case 'sales':
            case 'daily_sales':
            case 'sales_comparison':
                return <TrendingUp className="w-5 h-5 text-emerald-400" />;
            case 'cheques':
            case 'cheque_vault':
            case 'traz':
            case 'customer_balances':
            case 'statement':
                return <DollarSign className="w-5 h-5 text-blue-400" />;
            case 'warehouseOverview':
            case 'remittances':
                return <Boxes className="w-5 h-5 text-purple-400" />;
            default:
                return <Sparkles className="w-5 h-5 text-cyan-400" />;
        }
    };

    const runAnalysis = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/ai/sayan-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportSection,
                    sectionTitle: sectionTitle || 'گزارشات سایان ERP',
                    payload: reportPayload,
                    dateRange: dateRange || 'دوره جاری',
                    customPrompt
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'خطا در ارتباط با سرویس هوش مصنوعی');
            }

            const data = await res.json();
            setAnalysisResult(data);
            toast.success('تحلیل جامع و هوشمند گزارش سایان با موفقیت تولید شد.');
        } catch (err: any) {
            console.error('Sayan AI analysis error:', err);
            toast.error(err.message || 'خطا در دریافت تحلیل هوشمند سایان');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && !analysisResult && !isLoading) {
            runAnalysis();
        }
    }, [isOpen, reportSection]);

    if (!isOpen) return null;

    const copyMarkdown = () => {
        if (!analysisResult) return;
        const text = analysisResult.fullReportMarkdown || JSON.stringify(analysisResult, null, 2);
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('متن کامل گزارش تحلیلی در کلیپ‌بورد کپی شد.');
    };

    const handleDownloadPdf = async () => {
        if (!analysisResult) return;
        setIsExportingPdf(true);
        try {
            const res = await fetch('/api/ai/sayan-export-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(analysisResult)
            });

            if (!res.ok) {
                throw new Error('خطا در ایجاد فایل PDF گزارش');
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Sayan_AI_Report_${reportSection}_${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success('فایل PDF گزارش مدیریتی با موفقیت دانلود شد.');
        } catch (err: any) {
            console.error('PDF Export error:', err);
            toast.error(err.message || 'خطا در دانلود خروجی PDF');
        } finally {
            setIsExportingPdf(false);
        }
    };

    const handleSendBotDispatch = async () => {
        if (!analysisResult) return;
        if (selectedPlatforms.length === 0) {
            toast.error('لطفاً حداقل یک پلتفرم (تلگرام، بله یا واتس‌اپ) را انتخاب کنید.');
            return;
        }

        setIsSendingBot(true);
        try {
            const res = await fetch('/api/ai/sayan-send-bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    analysisData: analysisResult,
                    selectedPlatforms,
                    customGroupTele,
                    customGroupBale,
                    customGroupWa,
                    attachPdf: attachPdfToBot
                })
            });

            const data = await res.json();
            if (!res.ok || data.error) {
                throw new Error(data.error || 'خطا در ارسال به بات‌ها');
            }

            toast.success(data.message || 'تحلیل هوش مصنوعی با موفقیت به بات‌ها ارسال گردید.');
            setIsBotModalOpen(false);
        } catch (err: any) {
            console.error('Bot dispatch error:', err);
            toast.error(err.message || 'خطا در ارسال به بات‌های پیام‌رسان');
        } finally {
            setIsSendingBot(false);
        }
    };

    const handleSendChatMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || isChatLoading) return;

        const userMsg = chatInput.trim();
        const newHistory = [...chatMessages, { role: 'user' as const, text: userMsg }];
        setChatMessages(newHistory);
        setChatInput('');
        setIsChatLoading(true);

        try {
            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg,
                    contextData: {
                        section: reportSection,
                        sectionTitle,
                        reportPayload,
                        analysisResult
                    },
                    history: chatMessages
                })
            });

            const data = await res.json();
            if (!res.ok || data.error) {
                throw new Error(data.error || 'خطا در پاسخ هوش مصنوعی');
            }

            setChatMessages([...newHistory, { role: 'assistant', text: data.reply || data.text || 'پاسخ دریافت شد.' }]);
        } catch (err: any) {
            console.error('Chat error:', err);
            setChatMessages([...newHistory, { role: 'assistant', text: 'متاسفانه در پردازش پاسخ خطایی رخ داد: ' + err.message }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    const score = analysisResult?.healthScore || 85;
    const scoreColor = score >= 80 ? 'text-emerald-500 border-emerald-500' : (score >= 60 ? 'text-amber-500 border-amber-500' : 'text-rose-500 border-rose-500');
    const scoreBg = score >= 80 ? 'bg-emerald-50 text-emerald-800' : (score >= 60 ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-800');

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animation-fade-in" dir="rtl">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-6xl max-h-[94vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="p-3.5 sm:p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                            {getSectionIcon()}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-extrabold text-sm sm:text-base text-white">
                                    {analysisResult?.reportTitle || `تحلیل هوشمند و استراتژیک ${sectionTitle || 'سایان ERP'}`}
                                </h3>
                                <span className="px-2 py-0.5 text-[10px] bg-indigo-500/30 border border-indigo-400/40 rounded-full font-mono font-bold text-indigo-200">
                                    Gemini 3.7 Strategic
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 font-medium mt-0.5">
                                بخش: <span className="text-indigo-200 font-bold">{sectionTitle || reportSection}</span> | بازه: <span className="text-slate-200">{typeof dateRange === 'string' ? dateRange : `${dateRange?.from || ''} تا ${dateRange?.to || ''}`}</span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={runAnalysis}
                            disabled={isLoading}
                            className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                            title="تحلیل مجدد داده‌ها"
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
                <div className="px-3 sm:px-5 py-2 bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-1.5 overflow-x-auto">
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('dashboard')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                                activeTab === 'dashboard'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
                            }`}
                        >
                            <Activity className="w-3.5 h-3.5" />
                            <span>شاخص‌ها و سلامت</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('chart')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                                activeTab === 'chart'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
                            }`}
                        >
                            <BarChart3 className="w-3.5 h-3.5" />
                            <span>نمودار تحلیلی هوشمند</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('executive')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                                activeTab === 'executive'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
                            }`}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            <span>خلاصه مدیریتی</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('engineering')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                                activeTab === 'engineering'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
                            }`}
                        >
                            <Factory className="w-3.5 h-3.5" />
                            <span>تحلیل مهندسی و فنی</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('risks')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                                activeTab === 'risks'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
                            }`}
                        >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>هشدارهای ریسک</span>
                            {analysisResult?.riskAlerts?.length ? (
                                <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full font-bold">
                                    {analysisResult.riskAlerts.length}
                                </span>
                            ) : null}
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('actionPlan')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                                activeTab === 'actionPlan'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
                            }`}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>برنامه اقدام و ماتریس</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('markdown')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                                activeTab === 'markdown'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span>متن کامل گزارش</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('chat')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                                activeTab === 'chat'
                                    ? 'bg-indigo-600 text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70'
                            }`}
                        >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>مشاوره و چت با هوش مصنوعی</span>
                        </button>
                    </div>

                    {/* Quick status pill */}
                    {analysisResult && (
                        <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 text-xs rounded-full font-bold flex items-center gap-1 ${scoreBg}`}>
                                <span className="w-2 h-2 rounded-full bg-current animate-ping" />
                                <span>امتیاز سلامت: {score} از ۱۰۰</span>
                            </span>
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100/50 dark:bg-zinc-950/50">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 mb-4 animate-bounce">
                                <Sparkles className="w-8 h-8" />
                            </div>
                            <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                                در حال پردازش و استخراج تحلیل چندلایه گزارش با هوش مصنوعی...
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                                استخراج شاخص‌های کلیدی، همبستگی‌های مالی، ارزیابی راندمان مهندسی و تدوین استراتژی‌های اجرایی برای {sectionTitle || 'این بخش'}
                            </p>
                            <div className="flex items-center gap-2 mt-4 text-xs font-mono text-indigo-600">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>تحلیل عمیق مدل Gemini 3.7</span>
                            </div>
                        </div>
                    ) : !analysisResult ? (
                        <div className="text-center py-16 text-slate-500">
                            اطلاعات تحلیلی دریافت نشد. لطفاً دکمه «تحلیل مجدد» را کلیک کنید.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            
                            {/* TAB 1: DASHBOARD & KPIS */}
                            {activeTab === 'dashboard' && (
                                <div className="space-y-6">
                                    {/* Top Score Banner */}
                                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-20 h-20 rounded-2xl border-4 flex flex-col items-center justify-center ${scoreColor} bg-slate-50 dark:bg-zinc-800/80`}>
                                                <span className="text-2xl font-black font-mono">{score}</span>
                                                <span className="text-[10px] font-bold text-slate-500">از ۱۰۰</span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                                                        وضعیت کلی و امتیاز سلامت سازمانی
                                                    </h4>
                                                    <span className={`px-2 py-0.5 text-xs rounded-md font-bold ${scoreBg}`}>
                                                        {analysisResult.healthStatusFa || (score >= 80 ? 'عالی و بهینه' : (score >= 60 ? 'پایدار / نیازمند پایش' : 'بحرانی'))}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
                                                    این شاخص بر اساس تحلیل داده‌های عملکردی، انحرافات تراز، شاخص‌های سودآوری، ضایعات و ریسک‌های نقدینگی محاسبه شده است.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Quick actions in banner */}
                                        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setIsBotModalOpen(true)}
                                                className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
                                            >
                                                <Send className="w-3.5 h-3.5" />
                                                <span>ارسال به بات‌ها</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleDownloadPdf}
                                                disabled={isExportingPdf}
                                                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
                                            >
                                                <Download className={`w-3.5 h-3.5 ${isExportingPdf ? 'animate-bounce' : ''}`} />
                                                <span>خروجی PDF مدیریتی</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* KPI Stat Cards */}
                                    {analysisResult.kpis && analysisResult.kpis.length > 0 && (
                                        <div>
                                            <h5 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                                                <Activity className="w-4 h-4 text-indigo-500" />
                                                <span>شاخص‌های کلیدی عملکرد (KPIs)</span>
                                            </h5>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                                {analysisResult.kpis.map((kpi: any, idx: number) => (
                                                    <div key={idx} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
                                                        <div className="text-xs text-slate-500 dark:text-slate-400 font-bold truncate">
                                                            {kpi.label}
                                                        </div>
                                                        <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                                                            {kpi.value}
                                                        </div>
                                                        {kpi.change && (
                                                            <div className="flex items-center gap-1 mt-1 text-xs font-bold">
                                                                {kpi.trend === 'UP' ? (
                                                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                                                                ) : kpi.trend === 'DOWN' ? (
                                                                    <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                                                                ) : (
                                                                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                                                                )}
                                                                <span className={kpi.trend === 'UP' ? 'text-emerald-600' : (kpi.trend === 'DOWN' ? 'text-rose-600' : 'text-slate-500')}>
                                                                    {kpi.change}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Top Highlights Summary */}
                                    {analysisResult.executiveSummary && (
                                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
                                            <h5 className="text-xs font-extrabold text-indigo-900 dark:text-indigo-300 mb-3 flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-indigo-600" />
                                                <span>گزیده نکات راهبردی و تصمیم‌گیری</span>
                                            </h5>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {analysisResult.executiveSummary.map((point: string, idx: number) => (
                                                    <div key={idx} className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl flex items-start gap-2.5">
                                                        <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                            {idx + 1}
                                                        </span>
                                                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                                                            {point}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 2: INTERACTIVE CHART */}
                            {activeTab === 'chart' && (
                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
                                    <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                                        <div className="flex items-center gap-2">
                                            <BarChart3 className="w-5 h-5 text-indigo-600" />
                                            <div>
                                                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                                    {analysisResult.chartConfig?.title || 'نمودار تحلیل هوشمند داده‌ها'}
                                                </h4>
                                                <span className="text-xs text-slate-500">
                                                    محور مقادیر: {analysisResult.chartConfig?.yAxisName || 'مقدار'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {analysisResult.chartData && analysisResult.chartData.length > 0 ? (
                                        <div className="h-[340px] w-full pt-4" dir="ltr">
                                            <ResponsiveContainer width="100%" height="100%">
                                                {analysisResult.chartConfig?.type === 'line' ? (
                                                    <LineChart data={analysisResult.chartData} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                        <XAxis dataKey={analysisResult.chartConfig?.xAxisKey || 'label'} angle={-25} textAnchor="end" tick={{ fontSize: 10 }} />
                                                        <YAxis tick={{ fontSize: 10 }} />
                                                        <Tooltip contentStyle={{ direction: 'rtl', borderRadius: '8px', fontSize: '12px' }} />
                                                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                                                        <Line type="monotone" dataKey={analysisResult.chartConfig?.yAxisKey || 'value'} stroke="#4f46e5" strokeWidth={3} name={analysisResult.chartConfig?.yAxisName || 'مقدار'} dot={{ r: 4 }} />
                                                        {analysisResult.chartConfig?.yAxisKey2 && (
                                                            <Line type="monotone" dataKey={analysisResult.chartConfig?.yAxisKey2} stroke="#10b981" strokeWidth={2} strokeDasharray="4 4" name={analysisResult.chartConfig?.yAxisName2 || 'مقدار دوم'} />
                                                        )}
                                                    </LineChart>
                                                ) : analysisResult.chartConfig?.type === 'area' ? (
                                                    <AreaChart data={analysisResult.chartData} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                        <XAxis dataKey={analysisResult.chartConfig?.xAxisKey || 'label'} angle={-25} textAnchor="end" tick={{ fontSize: 10 }} />
                                                        <YAxis tick={{ fontSize: 10 }} />
                                                        <Tooltip contentStyle={{ direction: 'rtl', borderRadius: '8px', fontSize: '12px' }} />
                                                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                                                        <Area type="monotone" dataKey={analysisResult.chartConfig?.yAxisKey || 'value'} stroke="#4f46e5" fill="#e0e7ff" name={analysisResult.chartConfig?.yAxisName || 'مقدار'} />
                                                    </AreaChart>
                                                ) : (
                                                    <BarChart data={analysisResult.chartData} margin={{ top: 10, right: 30, left: 20, bottom: 40 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                                        <XAxis dataKey={analysisResult.chartConfig?.xAxisKey || 'label'} angle={-25} textAnchor="end" tick={{ fontSize: 10 }} />
                                                        <YAxis tick={{ fontSize: 10 }} />
                                                        <Tooltip contentStyle={{ direction: 'rtl', borderRadius: '8px', fontSize: '12px' }} />
                                                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                                                        <Bar dataKey={analysisResult.chartConfig?.yAxisKey || 'value'} fill="#4f46e5" radius={[6, 6, 0, 0]} name={analysisResult.chartConfig?.yAxisName || 'مقدار'} />
                                                        {analysisResult.chartConfig?.yAxisKey2 && (
                                                            <Bar dataKey={analysisResult.chartConfig?.yAxisKey2} fill="#10b981" radius={[6, 6, 0, 0]} name={analysisResult.chartConfig?.yAxisName2 || 'مقدار دوم'} />
                                                        )}
                                                    </BarChart>
                                                )}
                                            </ResponsiveContainer>
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center text-xs text-slate-400">
                                            داده‌های عددی کافی جهت رسم نمودار تحلیلی در این خروجی موجود نیست.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 3: EXECUTIVE SUMMARY */}
                            {activeTab === 'executive' && (
                                <div className="space-y-4">
                                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
                                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-indigo-600" />
                                            <span>نکات راهبردی هیئت مدیره و مدیرعامل</span>
                                        </h4>
                                        <div className="space-y-2.5">
                                            {analysisResult.executiveSummary?.map((item: string, idx: number) => (
                                                <div key={idx} className="p-3.5 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl flex items-start gap-3">
                                                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                                                        {idx + 1}
                                                    </span>
                                                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                                                        {item}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {analysisResult.managerialInsights && (
                                        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-5 shadow-xs">
                                            <h4 className="font-extrabold text-sm text-emerald-900 dark:text-emerald-300 mb-2 flex items-center gap-2">
                                                <Award className="w-4 h-4 text-emerald-600" />
                                                <span>تحلیل تخصصی سودآوری و چرخه نقدینگی</span>
                                            </h4>
                                            <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                                                {analysisResult.managerialInsights}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 4: ENGINEERING ANALYSIS */}
                            {activeTab === 'engineering' && (
                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
                                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                                        <Factory className="w-5 h-5 text-indigo-600" />
                                        <div>
                                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                                تحلیل مهندسی، فنی، خطوط تولید و عملیات
                                            </h4>
                                            <span className="text-xs text-slate-500">
                                                ارزیابی مکانیک فرآیند، راندمان ماشین‌آلات، نرخ ضایعات و تعادل زنجیره تامین
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-line p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-800">
                                        {analysisResult.engineeringAnalysis || 'تحلیل مهندسی ثبت نشده است.'}
                                    </div>
                                </div>
                            )}

                            {/* TAB 5: RISKS & ALERTS */}
                            {activeTab === 'risks' && (
                                <div className="space-y-3">
                                    {analysisResult.riskAlerts && analysisResult.riskAlerts.length > 0 ? (
                                        analysisResult.riskAlerts.map((risk: any, idx: number) => {
                                            const isCrit = risk.level === 'CRITICAL';
                                            const isWarn = risk.level === 'WARNING';
                                            const bg = isCrit ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50' : (isWarn ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50' : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50');
                                            const badgeBg = isCrit ? 'bg-rose-600 text-white' : (isWarn ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white');
                                            const badgeLabel = isCrit ? 'بحرانی (فوری)' : (isWarn ? 'هشدار ریسک' : 'اطلاعیه');

                                            return (
                                                <div key={idx} className={`p-4 rounded-xl border shadow-xs ${bg}`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <AlertTriangle className={`w-4 h-4 ${isCrit ? 'text-rose-600' : 'text-amber-600'}`} />
                                                            <h5 className="font-extrabold text-xs text-slate-900 dark:text-white">
                                                                {risk.title}
                                                            </h5>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${badgeBg}`}>
                                                            {badgeLabel}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
                                                        {risk.description}
                                                    </p>
                                                    {risk.recommendation && (
                                                        <div className="p-2.5 bg-white/80 dark:bg-zinc-900/80 rounded-lg border border-slate-200/60 dark:border-zinc-800 text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2">
                                                            <span className="font-bold text-indigo-600 shrink-0">💡 راهکار مهار:</span>
                                                            <span>{risk.recommendation}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="py-12 text-center text-xs text-emerald-600 font-bold bg-emerald-50 rounded-xl border border-emerald-200">
                                            ✅ هیچ ریسک یا انحراف بحرانی در این مجموعه داده شناسایی نشد. وضعیت پایدار است.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 6: ACTION PLAN */}
                            {activeTab === 'actionPlan' && (
                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
                                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-zinc-800">
                                        <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                                        <div>
                                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                                ماتریس تصمیم‌گیری و برنامه اقدام اجرایی
                                            </h4>
                                            <span className="text-xs text-slate-500">
                                                تخصیص اولویت‌ها، مسئولان واحدها و زمان‌بندی اقدامات
                                            </span>
                                        </div>
                                    </div>

                                    {analysisResult.actionPlan && analysisResult.actionPlan.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-right text-xs">
                                                <thead>
                                                    <tr className="bg-slate-50 dark:bg-zinc-800/80 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-zinc-700">
                                                        <th className="p-3 text-center">اولویت</th>
                                                        <th className="p-3">اقدام مشخص</th>
                                                        <th className="p-3 text-center">واحد مسئول</th>
                                                        <th className="p-3">زمان‌بندی</th>
                                                        <th className="p-3">اثر مورد انتظار</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                                    {analysisResult.actionPlan.map((action: any, idx: number) => {
                                                        const isHigh = action.priority === 'HIGH';
                                                        const badgeClass = isHigh ? 'bg-rose-100 text-rose-800 border-rose-300' : (action.priority === 'MEDIUM' ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-slate-100 text-slate-800 border-slate-300');
                                                        const label = isHigh ? 'بالا (فوری)' : (action.priority === 'MEDIUM' ? 'متوسط' : 'عادی');

                                                        return (
                                                            <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                                                                <td className="p-3 text-center">
                                                                    <span className={`px-2 py-0.5 text-[10px] rounded-md font-bold border ${badgeClass}`}>
                                                                        {label}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 font-bold text-slate-900 dark:text-white">
                                                                    {action.action}
                                                                </td>
                                                                <td className="p-3 text-center text-slate-600 dark:text-slate-300 font-medium">
                                                                    {action.owner || 'مدیریت'}
                                                                </td>
                                                                <td className="p-3 text-slate-500 dark:text-slate-400">
                                                                    {action.timeframe || 'فوری'}
                                                                </td>
                                                                <td className="p-3 text-emerald-700 dark:text-emerald-400 font-medium">
                                                                    {action.expectedImpact || '-'}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center text-xs text-slate-500">
                                            اقدام فوری تعریف نشده است.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 7: MARKDOWN REPORT */}
                            {activeTab === 'markdown' && (
                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-3">
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-indigo-600" />
                                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                                متن جامع گزارش تحلیلی هوش مصنوعی (Markdown)
                                            </h4>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={copyMarkdown}
                                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                            <span>{copied ? 'کپی شد' : 'کپی متن گزارش'}</span>
                                        </button>
                                    </div>
                                    <div className="p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl text-xs font-mono leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap border border-slate-200 dark:border-zinc-800">
                                        {analysisResult.fullReportMarkdown || JSON.stringify(analysisResult, null, 2)}
                                    </div>
                                </div>
                            )}

                            {/* TAB 8: INTERACTIVE CHAT */}
                            {activeTab === 'chat' && (
                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-xs flex flex-col h-[480px] overflow-hidden">
                                    <div className="p-3.5 bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4 text-indigo-600" />
                                            <div>
                                                <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                                                    مشاوره تعاملی و پرسش درباره این گزارش
                                                </h4>
                                                <span className="text-[10px] text-slate-500">
                                                    می‌توانید هر سوال تکمیلی درباره مشتریان، تولید، چک‌ها، اقلام یا سودآوری بپرسید.
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Messages list */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                        {chatMessages.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                                                <Bot className="w-10 h-10 text-indigo-400 mb-2 opacity-60" />
                                                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                                                    هوش مصنوعی داده‌های این بخش را به طور کامل تحلیل نموده است.
                                                </p>
                                                <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                                                    مثال: «بیشترین مانده بدهکاری متعلق به کدام مشتری است؟» یا «راهکار کاهش ضایعات خطوط چیست؟»
                                                </p>
                                            </div>
                                        ) : (
                                            chatMessages.map((msg, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    <div
                                                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                                                            msg.role === 'user'
                                                                ? 'bg-indigo-600 text-white rounded-br-none'
                                                                : 'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 rounded-bl-none'
                                                        }`}
                                                    >
                                                        <div className="font-bold text-[10px] mb-1 opacity-70">
                                                            {msg.role === 'user' ? 'شما' : 'هوش مصنوعی سایان'}
                                                        </div>
                                                        <div className="whitespace-pre-wrap">{msg.text}</div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                        {isChatLoading && (
                                            <div className="flex justify-start">
                                                <div className="bg-slate-100 dark:bg-zinc-800 rounded-2xl p-3 text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2">
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                                                    <span>در حال تحلیل و تدوین پاسخ...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Chat Input */}
                                    <form onSubmit={handleSendChatMessage} className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            placeholder="سوال خود را درباره این گزارش بنویسید..."
                                            disabled={isChatLoading}
                                            className="flex-1 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <button
                                            type="submit"
                                            disabled={!chatInput.trim() || isChatLoading}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                            <span>ارسال</span>
                                        </button>
                                    </form>
                                </div>
                            )}

                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-3 sm:p-4 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsBotModalOpen(true)}
                            disabled={!analysisResult || isLoading}
                            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
                        >
                            <Send className="w-3.5 h-3.5" />
                            <span>ارسال به بات‌ها (تلگرام / بله)</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleDownloadPdf}
                            disabled={!analysisResult || isExportingPdf || isLoading}
                            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2"
                        >
                            <Download className={`w-3.5 h-3.5 ${isExportingPdf ? 'animate-bounce' : ''}`} />
                            <span>دریافت فایل PDF</span>
                        </button>

                        <button
                            type="button"
                            onClick={copyMarkdown}
                            disabled={!analysisResult}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">{copied ? 'کپی شد' : 'کپی متن گزارش'}</span>
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
                    >
                        بستن پنجره
                    </button>
                </div>

            </div>

            {/* SEND TO BOTS MODAL */}
            {isBotModalOpen && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animation-fade-in" dir="rtl">
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl p-5 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2">
                                <Bot className="w-5 h-5 text-indigo-600" />
                                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                                    ارسال تحلیل هوش مصنوعی به بات‌های پیام‌رسان
                                </h4>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsBotModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                                انتخاب پیام‌رسان‌های مقصد:
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedPlatforms(prev => 
                                            prev.includes('telegram') ? prev.filter(p => p !== 'telegram') : [...prev, 'telegram']
                                        );
                                    }}
                                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                        selectedPlatforms.includes('telegram')
                                            ? 'bg-blue-50 border-blue-500 text-blue-700'
                                            : 'border-slate-200 text-slate-600'
                                    }`}
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>تلگرام (Telegram)</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedPlatforms(prev => 
                                            prev.includes('bale') ? prev.filter(p => p !== 'bale') : [...prev, 'bale']
                                        );
                                    }}
                                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                        selectedPlatforms.includes('bale')
                                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                                            : 'border-slate-200 text-slate-600'
                                    }`}
                                >
                                    <Bot className="w-3.5 h-3.5" />
                                    <span>بله (Bale)</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setSelectedPlatforms(prev => 
                                            prev.includes('whatsapp') ? prev.filter(p => p !== 'whatsapp') : [...prev, 'whatsapp']
                                        );
                                    }}
                                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                                        selectedPlatforms.includes('whatsapp')
                                            ? 'bg-green-50 border-green-500 text-green-700'
                                            : 'border-slate-200 text-slate-600'
                                    }`}
                                >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>واتس‌اپ</span>
                                </button>
                            </div>

                            {/* Attach PDF Checkbox */}
                            <label className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={attachPdfToBot}
                                    onChange={(e) => setAttachPdfToBot(e.target.checked)}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                />
                                <div className="text-xs">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 block">پیوست فایل PDF گزارش مدیریتی</span>
                                    <span className="text-[11px] text-slate-500">فایل شکیل PDF شامل نمودارها، امتیاز سلامت و امضا نیز ارسال شود.</span>
                                </div>
                            </label>

                            {/* Optional Custom Groups */}
                            <div className="space-y-2 pt-2">
                                <span className="text-[11px] text-slate-500 block">
                                    شناسه‌های مقصد بر اساس تنظیمات پیش‌فرض بات‌ها فراخوانی می‌شوند. در صورت نیاز به ارسال به گروه دیگر، شناسه را وارد کنید:
                                </span>
                                {selectedPlatforms.includes('telegram') && (
                                    <input
                                        type="text"
                                        value={customGroupTele}
                                        onChange={(e) => setCustomGroupTele(e.target.value)}
                                        placeholder="شناسه گروه تلگرام دلخواه (مثال: -100123456789)"
                                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs"
                                    />
                                )}
                                {selectedPlatforms.includes('bale') && (
                                    <input
                                        type="text"
                                        value={customGroupBale}
                                        onChange={(e) => setCustomGroupBale(e.target.value)}
                                        placeholder="شناسه گروه بله دلخواه (مثال: -123456789)"
                                        className="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
                            <button
                                type="button"
                                onClick={() => setIsBotModalOpen(false)}
                                className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                            >
                                انصراف
                            </button>
                            <button
                                type="button"
                                onClick={handleSendBotDispatch}
                                disabled={isSendingBot}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                            >
                                <Send className={`w-3.5 h-3.5 ${isSendingBot ? 'animate-spin' : ''}`} />
                                <span>{isSendingBot ? 'در حال ارسال...' : 'ارسال قطعی'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
