import React, { useState, useRef, useEffect } from 'react';
import { 
    Sparkles, 
    Mic, 
    MicOff, 
    Send, 
    X, 
    Minimize2, 
    Maximize2, 
    Bot, 
    User, 
    Loader2, 
    Scan, 
    Volume2, 
    VolumeX, 
    ArrowLeft,
    Boxes,
    CreditCard,
    Ship,
    TrendingUp,
    FileSearch,
    RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: string;
    transcription?: string;
    suggestedAction?: string;
}

interface AiExecutiveCopilotProps {
    currentUser?: any;
    activeTab?: string;
    onOpenScanner?: () => void;
    onOpenWarehouseAdvisor?: () => void;
    onOpenSalesAdvisor?: () => void;
}

export const AiExecutiveCopilot: React.FC<AiExecutiveCopilotProps> = ({
    currentUser,
    activeTab,
    onOpenScanner,
    onOpenWarehouseAdvisor,
    onOpenSalesAdvisor
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [inputMessage, setInputMessage] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isBottomBarVisible, setIsBottomBarVisible] = useState(true);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            text: 'سلام! من «دستیار هوشمند و ایجنت صوتی ERP» هستم. می‌توانید با ویس یا متن، هر سوالی درباره موجودی انبار، بارهای در راه و گمرک، فروش، چک‌ها یا گزارش‌های مدیریتی دارید بپرسید.',
            timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
        }
    ]);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen]);

    useEffect(() => {
        const handleVisibilityChange = (e: any) => {
            setIsBottomBarVisible(!!e.detail);
        };
        window.addEventListener('BOTTOM_NAV_VISIBLE', handleVisibilityChange);
        return () => {
            window.removeEventListener('BOTTOM_NAV_VISIBLE', handleVisibilityChange);
        };
    }, []);

    // Handle Text Send
    const handleSendMessage = async (textToSend?: string) => {
        const query = textToSend || inputMessage;
        if (!query.trim() || isProcessing) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: query.trim(),
            timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, userMsg]);
        if (!textToSend) setInputMessage('');
        setIsProcessing(true);

        const executeCall = async () => {
            try {
                const historyPayload = messages.slice(-6).map(m => ({ role: m.role, text: m.text }));
                
                // Get live Sayan data context if available
                const sayanLiveData = (window as any).__SAYAN_LIVE_DATA__ || null;

                const res = await fetch('/api/ai/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: query.trim(),
                        contextData: {
                            user: currentUser?.fullName || 'مدیر سیستم',
                            role: currentUser?.role,
                            sayanLiveData: sayanLiveData
                        },
                        history: historyPayload
                    })
                });

                if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    throw new Error(err.error || 'خطا در ارتباط با سرور هوش مصنوعی');
                }

                const data = await res.json();
                const botMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    text: data.reply || 'پاسخی دریافت نشد.',
                    timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
                };
                setMessages(prev => [...prev, botMsg]);
            } catch (err: any) {
                console.error("AI Chat Error:", err);
                toast.error(err.message || 'خطا در دریافت پاسخ');
            } finally {
                setIsProcessing(false);
            }
        };

        // If Sayan data is currently extracting, wait for it to finish so AI can use correct data
        if ((window as any).__SAYAN_LOADING__) {
            const waitMsgId = (Date.now() + 2).toString();
            const waitMsg: Message = {
                id: waitMsgId,
                role: 'assistant',
                text: '⏳ نرم‌افزار در حال استخراج و دریافت اطلاعات زنده از سیستم مالی سایان است... لطفاً چند لحظه شکیبا باشید تا استخراج داده‌ها تکمیل شود و تحلیل هوش مصنوعی با دقیق‌ترین ارقام لحظه‌ای آغاز گردد.',
                timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, waitMsg]);

            const interval = setInterval(() => {
                if (!(window as any).__SAYAN_LOADING__) {
                    clearInterval(interval);
                    setMessages(prev => prev.filter(m => m.id !== waitMsgId));
                    executeCall();
                }
            }, 500);

            // Timeout after 25 seconds
            setTimeout(() => {
                clearInterval(interval);
                setIsProcessing(false);
            }, 25000);
        } else {
            await executeCall();
        }
    };

    // Handle Voice Recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
                await sendVoiceBlob(audioBlob);
            };

            mediaRecorder.start();
            setIsRecording(true);
            toast.success('در حال ضبط صدا... صحبت کنید.');
        } catch (err: any) {
            console.error("Voice recording access error:", err);
            toast.error('دسترسی به میکروفون امکان‌پذیر نیست یا رد شد.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const sendVoiceBlob = async (blob: Blob) => {
        setIsProcessing(true);
        
        const executeVoiceCall = async () => {
            try {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = async () => {
                    const base64Data = (reader.result as string).split(',')[1];
                    
                    // Live Sayan data context if available
                    const sayanLiveData = (window as any).__SAYAN_LIVE_DATA__ || null;

                    const res = await fetch('/api/ai/voice-command', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            audioBase64: base64Data,
                            mimeType: 'audio/webm',
                            contextData: {
                                user: currentUser?.fullName || 'مدیر سیستم',
                                role: currentUser?.role,
                                sayanLiveData: sayanLiveData
                            }
                        })
                    });

                    if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || 'خطا در پردازش صوت');
                    }

                    const data = await res.json();
                    
                    const userVoiceMsg: Message = {
                        id: Date.now().toString(),
                        role: 'user',
                        text: `🎙️ ${data.transcription || 'پیام صوتی'}`,
                        transcription: data.transcription,
                        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
                    };

                    const botVoiceMsg: Message = {
                        id: (Date.now() + 1).toString(),
                        role: 'assistant',
                        text: data.replyText || 'دستور شما پردازش شد.',
                        suggestedAction: data.suggestedAction,
                        timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
                    };

                    setMessages(prev => [...prev, userVoiceMsg, botVoiceMsg]);
                    toast.success('پیام صوتی شما با موفقیت تحلیل شد.');
                    setIsProcessing(false);
                };
            } catch (err: any) {
                console.error("Voice processing error:", err);
                toast.error(err.message || 'خطا در تبدیل و تحلیل صوت');
                setIsProcessing(false);
            }
        };

        // If Sayan data is currently extracting, wait for it to finish
        if ((window as any).__SAYAN_LOADING__) {
            const waitMsgId = (Date.now() + 2).toString();
            const waitMsg: Message = {
                id: waitMsgId,
                role: 'assistant',
                text: '🎙️⏳ در حال انتظار برای اتمام استخراج داده‌های زنده سایان جهت تلفیق با پیام صوتی شما... لطفاً چند ثانیه منتظر بمانید.',
                timestamp: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, waitMsg]);

            const interval = setInterval(() => {
                if (!(window as any).__SAYAN_LOADING__) {
                    clearInterval(interval);
                    setMessages(prev => prev.filter(m => m.id !== waitMsgId));
                    executeVoiceCall();
                }
            }, 500);

            // Timeout after 25 seconds
            setTimeout(() => {
                clearInterval(interval);
                setIsProcessing(false);
            }, 25000);
        } else {
            await executeVoiceCall();
        }
    };

    // Position calculation to never overlap chat input bar or bottom navigation
    const bottomPositionClass = isBottomBarVisible 
        ? 'bottom-24' 
        : activeTab === 'chat' 
            ? 'bottom-20 sm:bottom-22' 
            : 'bottom-6';

    // Floating Button when Closed
    if (!isOpen) {
        return (
            <div className={`fixed ${bottomPositionClass} left-4 sm:left-6 z-50 transition-all duration-300`} dir="rtl">
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="relative group p-1.5 px-3 bg-gradient-to-tr from-indigo-700 via-indigo-600 to-violet-500 hover:from-indigo-800 hover:to-violet-600 text-white rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center gap-1.5 border border-indigo-300/40"
                    title="ایجنت هوش مصنوعی و فرمان صوتی"
                >
                    <div className="relative">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                        <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-emerald-400 rounded-full ring-1 ring-indigo-900 animate-ping" />
                    </div>
                    <span className="text-[10px] font-black tracking-tight hidden sm:inline">
                        دستیار هوشمند و صوتی AI
                    </span>
                </button>
            </div>
        );
    }

    return (
        <div className={`fixed ${bottomPositionClass} left-3 sm:left-6 z-50 transition-all duration-300 ${isMinimized ? 'w-72 h-12' : 'w-[94vw] sm:w-[380px] h-[480px] max-h-[80vh]'} bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animation-fade-in`} dir="rtl">
            
            {/* Copilot Header */}
            <div className="p-2.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-indigo-900/40">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1">
                            <h4 className="font-extrabold text-[11px] text-white">دستیار صوتی و هوشمند ERP</h4>
                            <span className="px-1 py-0.2 text-[8px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full font-mono">
                                Live
                            </span>
                        </div>
                        <p className="text-[9px] text-slate-300">پاسخ صوتی، انبار و فروش</p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
                        title={isMinimized ? 'بزرگنمایی' : 'کوچک‌نمایی'}
                    >
                        {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Quick Action Shortcuts */}
                    <div className="px-3 py-2 bg-slate-50 dark:bg-zinc-800/60 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                        <button
                            type="button"
                            onClick={() => handleSendMessage('وضعیت تراز انبار و بارهای در راه و گمرک را به صورت خلاصه گزارش بده.')}
                            className="px-2.5 py-1 text-[11px] font-bold bg-white dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-zinc-700 rounded-lg whitespace-nowrap flex items-center gap-1 shrink-0"
                        >
                            <Boxes className="w-3 h-3 text-indigo-600" />
                            <span>تراز انبار و بارهای در راه</span>
                        </button>
                        
                        {onOpenWarehouseAdvisor && (
                            <button
                                type="button"
                                onClick={onOpenWarehouseAdvisor}
                                className="px-2.5 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg whitespace-nowrap flex items-center gap-1 shrink-0"
                            >
                                <Sparkles className="w-3 h-3 text-indigo-600" />
                                <span>تحلیل پیشرفته انبار</span>
                            </button>
                        )}

                        {onOpenSalesAdvisor && (
                            <button
                                type="button"
                                onClick={onOpenSalesAdvisor}
                                className="px-2.5 py-1 text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg whitespace-nowrap flex items-center gap-1 shrink-0"
                            >
                                <TrendingUp className="w-3 h-3 text-emerald-600" />
                                <span>تحلیل فروش و نقدینگی</span>
                            </button>
                        )}

                        {onOpenScanner && (
                            <button
                                type="button"
                                onClick={onOpenScanner}
                                className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg whitespace-nowrap flex items-center gap-1 shrink-0"
                            >
                                <Scan className="w-3 h-3 text-slate-600" />
                                <span>اسکنر هوشمند سند</span>
                            </button>
                        )}
                    </div>

                    {/* Messages Container */}
                    <div className="flex-1 p-3.5 overflow-y-auto space-y-3 custom-scrollbar bg-slate-50/50 dark:bg-zinc-900/40">
                        {messages.map((msg) => {
                            const isUser = msg.role === 'user';
                            return (
                                <div
                                    key={msg.id}
                                    className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                                >
                                    {!isUser && (
                                        <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                                            <Bot className="w-4 h-4" />
                                        </div>
                                    )}

                                    <div
                                        className={`max-w-[82%] p-3 rounded-2xl text-xs leading-relaxed ${
                                            isUser
                                                ? 'bg-indigo-600 text-white rounded-br-none shadow-xs'
                                                : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-zinc-700 rounded-bl-none shadow-xs'
                                        }`}
                                    >
                                        <div className="whitespace-pre-wrap font-sans font-medium">
                                            {msg.text}
                                        </div>
                                        <div className={`text-[9px] mt-1.5 text-left font-mono ${isUser ? 'text-indigo-200' : 'text-slate-400'}`}>
                                            {msg.timestamp}
                                        </div>
                                    </div>

                                    {isUser && (
                                        <div className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                                            <User className="w-4 h-4" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {isProcessing && (
                            <div className="flex items-center gap-2 p-3 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 w-fit text-xs text-indigo-600">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="font-bold">هوش مصنوعی در حال تحلیل و پردازش است...</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Bar with Voice Button */}
                    <div className="p-3 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800">
                        {isRecording ? (
                            <div className="flex items-center justify-between p-2.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl animate-pulse">
                                <div className="flex items-center gap-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                                    <div className="w-3 h-3 bg-rose-600 rounded-full animate-ping" />
                                    <span>در حال ضبط صدا... لطفاً صحبت کنید</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={stopRecording}
                                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs"
                                >
                                    <MicOff className="w-3.5 h-3.5" />
                                    <span>اتمام و ارسال</span>
                                </button>
                            </div>
                        ) : (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSendMessage();
                                }}
                                className="flex items-center gap-2"
                            >
                                <button
                                    type="button"
                                    onClick={startRecording}
                                    disabled={isProcessing}
                                    className="p-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-zinc-800 text-indigo-700 dark:text-indigo-400 rounded-xl transition-all border border-indigo-200 dark:border-zinc-700 flex items-center justify-center shrink-0"
                                    title="دستور یا پیام صوتی (Voice)"
                                >
                                    <Mic className="w-4 h-4" />
                                </button>

                                <input
                                    type="text"
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    placeholder="پرسش یا دستور خود را بنویسید یا ویس بدهید..."
                                    disabled={isProcessing}
                                    className="flex-1 px-3.5 py-2 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800 dark:text-slate-100"
                                />

                                <button
                                    type="submit"
                                    disabled={!inputMessage.trim() || isProcessing}
                                    className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl transition-all flex items-center justify-center shrink-0 shadow-xs"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            </form>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
export default AiExecutiveCopilot;
