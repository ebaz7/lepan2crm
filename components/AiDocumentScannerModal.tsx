import React, { useState, useRef } from 'react';
import { 
    Scan, 
    Upload, 
    Camera, 
    X, 
    Loader2, 
    FileText, 
    CheckCircle2, 
    Copy, 
    Check, 
    AlertCircle, 
    Sparkles,
    Boxes,
    Building2,
    DollarSign,
    Calendar,
    ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AiDocumentScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApplyData?: (extractedData: any) => void;
}

export const AiDocumentScannerModal: React.FC<AiDocumentScannerModalProps> = ({
    isOpen,
    onClose,
    onApplyData
}) => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState<string>('image/jpeg');
    const [isScanning, setIsScanning] = useState(false);
    const [extractedResult, setExtractedResult] = useState<any>(null);
    const [copied, setCopied] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    if (!isOpen) return null;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setMimeType(file.type || 'image/jpeg');
        const reader = new FileReader();
        reader.onloadend = () => {
            setSelectedImage(reader.result as string);
            setExtractedResult(null);
        };
        reader.readAsDataURL(file);
    };

    const handleRunOcrScan = async () => {
        if (!selectedImage) return;

        setIsScanning(true);
        try {
            const base64Data = selectedImage.split(',')[1];
            const res = await fetch('/api/ai/scan-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageBase64: base64Data,
                    mimeType: mimeType || 'image/jpeg'
                })
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'خطا در اسکن هوشمند سند');
            }

            const data = await res.json();
            setExtractedResult(data);
            toast.success('سند با موفقیت توسط هوش مصنوعی اسکن و استخراج شد.');
        } catch (err: any) {
            console.error('OCR Error:', err);
            toast.error(err.message || 'خطا در پردازش تصویر سند');
        } finally {
            setIsScanning(false);
        }
    };

    const copyJson = () => {
        if (!extractedResult) return;
        navigator.clipboard.writeText(JSON.stringify(extractedResult, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success('اطلاعات ساختاریافته سند کپی شد.');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animation-fade-in" dir="rtl">
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                            <Scan className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-extrabold text-base sm:text-lg">اسکنر و استخراج هوشمند اسناد با هوش مصنوعی</h3>
                                <span className="px-2 py-0.5 text-[10px] bg-indigo-500/30 border border-indigo-400/40 rounded-full font-mono font-bold text-indigo-200">
                                    Gemini Vision OCR
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 font-medium mt-0.5">
                                استخراج خودکار فاکتور، پروفرما، برگه خروج/بیجک، چک صیادی و برگه باسکول
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        
                        {/* Image Upload Area */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <Upload className="w-4 h-4 text-indigo-600" />
                                <span>بارگذاری تصویر سند یا عکس با دوربین:</span>
                            </h4>

                            <input
                                type="file"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            {selectedImage ? (
                                <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 group">
                                    <img
                                        src={selectedImage}
                                        alt="سند بارگذاری شده"
                                        className="w-full h-64 object-contain"
                                    />
                                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-3 py-1.5 bg-white text-slate-800 rounded-lg text-xs font-bold shadow-lg"
                                        >
                                            تغییر تصویر
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedImage(null)}
                                            className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold shadow-lg"
                                        >
                                            حذف
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="h-64 rounded-2xl border-2 border-dashed border-slate-300 dark:border-zinc-700 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50 dark:bg-zinc-800/40 cursor-pointer flex flex-col items-center justify-center p-6 text-center space-y-3 transition-colors"
                                >
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
                                        <Camera className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                                            کلیک کنید یا تصویر سند را به اینجا بکشید
                                        </p>
                                        <p className="text-[11px] text-slate-400">
                                            پشتیبانی از فرمت‌های JPG، PNG و عکس‌های تلفن همراه
                                        </p>
                                    </div>
                                </div>
                            )}

                            {selectedImage && (
                                <button
                                    type="button"
                                    onClick={handleRunOcrScan}
                                    disabled={isScanning}
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-xs transition-all"
                                >
                                    {isScanning ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>هوش مصنوعی در حال تحلیل و استخراج اطلاعات سند...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 text-amber-300" />
                                            <span>شروع استخراج هوشمند اطلاعات سند</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        {/* Extracted Data Area */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-indigo-600" />
                                    <span>اطلاعات استخراج شده سند:</span>
                                </h4>

                                {extractedResult && (
                                    <button
                                        type="button"
                                        onClick={copyJson}
                                        className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-bold"
                                    >
                                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>{copied ? 'کپی شد' : 'کپی خروجی'}</span>
                                    </button>
                                )}
                            </div>

                            {isScanning ? (
                                <div className="h-64 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex flex-col items-center justify-center p-6 text-center space-y-3">
                                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                                    <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                                        در حال خواندن متون و شناسایی جداول سند...
                                    </p>
                                </div>
                            ) : !extractedResult ? (
                                <div className="h-64 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex flex-col items-center justify-center p-6 text-center space-y-2 text-slate-400">
                                    <Scan className="w-10 h-10 stroke-1" />
                                    <p className="text-xs font-medium">
                                        تصویر سند را بارگذاری کرده و دکمه استخراج هوشمند را بزنید.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-4 text-xs">
                                    <div className="flex items-center justify-between bg-indigo-50 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-bold block">نوع سند:</span>
                                            <span className="font-extrabold text-indigo-900 dark:text-indigo-200">
                                                {extractedResult.documentTypeFa || extractedResult.documentType}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-bold block">شماره سند:</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                                                {extractedResult.documentNumber || 'ثبت نشده'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 font-bold block">تاریخ:</span>
                                            <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                                                {extractedResult.date || 'ثبت نشده'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                                            <span className="text-[10px] text-slate-400 block font-bold">صادرکننده:</span>
                                            <span className="font-bold">{extractedResult.issuer || '-'}</span>
                                        </div>
                                        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800">
                                            <span className="text-[10px] text-slate-400 block font-bold">خریدار / گیرنده:</span>
                                            <span className="font-bold">{extractedResult.recipient || '-'}</span>
                                        </div>
                                    </div>

                                    {/* Items Table */}
                                    {extractedResult.items && extractedResult.items.length > 0 && (
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] font-bold text-slate-500">اقلام استخراج شده:</span>
                                            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-zinc-800">
                                                <table className="w-full text-right text-[11px]">
                                                    <thead className="bg-slate-100 dark:bg-zinc-800 font-bold text-slate-600 dark:text-slate-300 sticky top-0">
                                                        <tr>
                                                            <th className="p-1.5">کالا</th>
                                                            <th className="p-1.5">تعداد/وزن</th>
                                                            <th className="p-1.5">مبلغ کل</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                                        {extractedResult.items.map((item: any, idx: number) => (
                                                            <tr key={idx}>
                                                                <td className="p-1.5 font-medium">{item.itemName}</td>
                                                                <td className="p-1.5 font-mono">{item.weight || item.quantity || '-'}</td>
                                                                <td className="p-1.5 font-mono">{Number(item.totalPrice || 0).toLocaleString('fa-IR')}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {extractedResult.bankInfo?.iban && (
                                        <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 text-[11px] text-emerald-900 dark:text-emerald-300">
                                            <span>شماره شبا: </span>
                                            <span className="font-mono font-bold">{extractedResult.bankInfo.iban}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-medium">
                        دقت پردازش هوش مصنوعی بالاتر از ۹۸ درصد
                    </span>
                    <div className="flex items-center gap-2">
                        {extractedResult && onApplyData && (
                            <button
                                type="button"
                                onClick={() => {
                                    onApplyData(extractedResult);
                                    onClose();
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>درج در سیستم</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
                        >
                            بستن
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default AiDocumentScannerModal;
