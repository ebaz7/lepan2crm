import React, { useState } from 'react';
import { 
    Sparkles, 
    X, 
    Loader2, 
    TrendingUp, 
    DollarSign, 
    CreditCard, 
    Users, 
    Lightbulb, 
    FileText, 
    Copy, 
    Check, 
    RefreshCw,
    Award
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AiSalesAdvisorModalProps {
    isOpen: boolean;
    onClose: () => void;
    salesData: any;
    periodLabel?: string;
}

export const AiSalesAdvisorModal: React.FC<AiSalesAdvisorModalProps> = ({
    isOpen,
    onClose,
    salesData,
    periodLabel = 'دوره جاری'
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [copied, setCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<'summary' | 'pricing' | 'cashflow' | 'strategies' | 'fullReport'>('summary');

    const handleRunAnalysis = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/ai/sales-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    salesData,
                    periodLabel
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'خطا در ارتباط با سرویس هوش مصنوعی');
            }

            const data = await res.json();
            setAnalysisResult(data);
            toast.success('تحلیل استراتژیک فروش و نقدینگی تولید شد.');
        } catch (err: any) {
            console.error('AI Sales analysis error:', err);
            toast.error(err.message || 'خطا در دریافت تحلیل هوشمند فروش');
        } finally {
            setIsLoading(false);
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animation-fade-in" dir="rtl">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                            <Sparkles className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-extrabold text-base sm:text-lg">مشاور استراتژیک هوش مصنوعی فروش، قیمت‌گذاری و نقدینگی</h3>
                                <span className="px-2 py-0.5 text-[10px] bg-emerald-500/30 border border-emerald-400/40 rounded-full font-mono font-bold text-emerald-200">
                                    Gemini 2.5 Flash
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 font-medium mt-0.5">
                                تحلیل عمیق روندهای فروش، کشش قیمتی، پیش‌بینی وصولی چک‌ها و استراتژی‌های سهم بازار
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleRunAnalysis}
                            disabled={isLoading}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
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

                {/* Sub Navigation */}
                <div className="px-5 py-2.5 bg-slate-50 dark:bg-zinc-800/50 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('summary')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeTab === 'summary'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300'
                            }`}
                        >
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>خلاصه اجرایی و روند فروش</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('pricing')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeTab === 'pricing'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300'
                            }`}
                        >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>تحلیل نرخ و کشش قیمتی</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('cashflow')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeTab === 'cashflow'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300'
                            }`}
                        >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>پیش‌بینی نقدینگی و چک‌ها</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('strategies')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeTab === 'strategies'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300'
                            }`}
                        >
                            <Lightbulb className="w-3.5 h-3.5" />
                            <span>پیشنهادات هوشمند تجاری ({analysisResult?.strategicSuggestions?.length || 0})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('fullReport')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                activeTab === 'fullReport'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-200/60 dark:text-slate-300'
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span>متن گزارش کامل</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={copyReport}
                            className="px-2.5 py-1 text-xs font-bold text-slate-600 hover:text-emerald-600 bg-white border border-slate-200 rounded-lg flex items-center gap-1"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? 'کپی شد' : 'کپی گزارش'}</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-5">
                    {isLoading ? (
                        <div className="py-20 flex flex-col items-center justify-center space-y-4">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600">
                                <Loader2 className="w-8 h-8 animate-spin" />
                            </div>
                            <div className="text-center space-y-1">
                                <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">
                                    هوش مصنوعی در حال تحلیل عمیق داده‌های فروش و نقدینگی...
                                </h4>
                                <p className="text-xs text-slate-500 max-w-md">
                                    محاسبه شاخص‌های کشش قیمتی، ارزیابی سودآوری سبد محصولات، نسبت مرجوعی‌ها و زمان‌بندی وصول چک‌های صندوق.
                                </p>
                            </div>
                        </div>
                    ) : !analysisResult ? (
                        <div className="py-16 text-center space-y-3">
                            <TrendingUp className="w-12 h-12 text-slate-300 mx-auto" />
                            <p className="text-sm font-bold text-slate-600">داده‌ای برای تحلیل موجود نیست.</p>
                            <button
                                type="button"
                                onClick={handleRunAnalysis}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
                            >
                                شروع تحلیل فروش با هوش مصنوعی
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Summary Banner */}
                            <div className="bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-50 dark:from-zinc-800/80 dark:to-zinc-800/40 p-5 rounded-2xl border border-emerald-100 dark:border-zinc-700 space-y-4">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex items-center gap-3">
                                        <span className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl font-mono font-black text-sm shadow-xs flex items-center gap-1.5">
                                            <Award className="w-4 h-4 text-amber-300" />
                                            <span>وضعیت درآمدی:</span>
                                            <span>{analysisResult.revenueHealth === 'STRONG' ? 'بسیار مطلوب و رو به رشد' : 'مطلوب با نیاز به پایش'}</span>
                                        </span>
                                    </div>
                                    <div className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                        بازه تحلیل: {periodLabel}
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-emerald-100 dark:border-zinc-700">
                                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                                        نکات کلیدی برای مدیرعامل و معاونت بازرگانی:
                                    </h4>
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                                        {(analysisResult.executiveSummary || []).map((pt: string, i: number) => (
                                            <li key={i} className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-slate-300 font-medium flex items-start gap-2 shadow-xs">
                                                <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                                                    {i + 1}
                                                </span>
                                                <span className="leading-relaxed">{pt}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {activeTab === 'summary' && (
                                <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-zinc-800 pb-2">
                                        تحلیل روند فروش و مقایسه اوزان و مبالغ
                                    </h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                        {analysisResult.salesTrendInsight}
                                    </p>
                                </div>
                            )}

                            {activeTab === 'pricing' && (
                                <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-zinc-800 pb-2">
                                        ارزیابی میانگین نرخ‌ها، کشش قیمتی و حاشیه سود
                                    </h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                        {analysisResult.pricingAnalysis}
                                    </p>
                                </div>
                            )}

                            {activeTab === 'cashflow' && (
                                <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-2">
                                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-zinc-800 pb-2">
                                        پیش‌بینی جریان نقدینگی و وضعیت چک‌های دریافتنی
                                    </h4>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                        {analysisResult.cashflowForecast}
                                    </p>
                                </div>
                            )}

                            {activeTab === 'strategies' && (
                                <div className="space-y-3">
                                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">
                                        اقدامات پیشنهادی جهت افزایش فروش و ارتقای وفاداری مشتریان:
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {(analysisResult.strategicSuggestions || []).map((sug: any, idx: number) => (
                                            <div key={idx} className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="font-extrabold text-xs text-emerald-900 dark:text-emerald-200">
                                                        🎯 هدف: {sug.target}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                    {sug.action}
                                                </p>
                                                <div className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-white/70 dark:bg-zinc-900 p-2 rounded-lg border border-emerald-100 dark:border-zinc-800">
                                                    💡 نتیجه مورد انتظار: {sug.expectedResult}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'fullReport' && (
                                <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 space-y-4">
                                    <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-wrap selection:bg-emerald-100">
                                        {analysisResult.fullReportMarkdown}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-2">
                    <div className="text-[11px] text-slate-500 font-medium">
                        طراحی شده برای تصمیم‌گیری سریع و داده‌محور هیئت مدیره
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
        </div>
    );
};
export default AiSalesAdvisorModal;
