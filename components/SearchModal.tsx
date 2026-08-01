
import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, ArrowRight, ExternalLink, User, CreditCard, Truck, ClipboardList, Package, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiCall } from '../services/apiService';

interface SearchResult {
    type: 'payment_order' | 'exit_permit' | 'user' | 'meeting' | 'warehouse_tx' | 'purchase_request';
    id: string;
    title: string;
    subtitle: string;
    data: any;
    url: string;
}

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (tab: string, data?: any) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, onNavigate }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setQuery('');
            setResults([]);
        }
    }, [isOpen]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.length >= 2) {
                handleSearch();
            } else {
                setResults([]);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [query]);

    const handleSearch = async () => {
        setLoading(true);
        try {
            const data = await apiCall<{results: SearchResult[]}>(`/search-everything?query=${encodeURIComponent(query)}`);
            if (data && data.results) {
                setResults(data.results);
            }
        } catch (e) {
            console.error("Search failed", e);
        } finally {
            setLoading(false);
        }
    };

    const getIcon = (type: string) => {
        switch (type) {
            case 'payment_order': return <CreditCard className="text-blue-500" size={18} />;
            case 'exit_permit': return <Truck className="text-pink-500" size={18} />;
            case 'user': return <User className="text-indigo-500" size={18} />;
            case 'meeting': return <ClipboardList className="text-orange-500" size={18} />;
            case 'warehouse_tx': return <Package className="text-purple-500" size={18} />;
            case 'purchase_request': return <CreditCard className="text-emerald-500" size={18} />;
            default: return <Search className="text-gray-400" size={18} />;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4 sm:pt-32">
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
            />
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                className="relative w-full max-w-2xl glass-panel rounded-3xl shadow-2xl overflow-hidden border border-white/20 dark:border-white/10 flex flex-col max-h-[70vh]"
            >
                <div className="p-4 border-b border-gray-100 dark:border-white/5 flex items-center gap-3 bg-white/50 dark:bg-black/20">
                    <Search className="text-gray-400" size={20} />
                    <input 
                        ref={inputRef}
                        type="text" 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="جستجو در کل سیستم (نام، شماره، کالا و...)"
                        className="flex-1 bg-transparent border-none outline-none text-gray-800 dark:text-gray-100 font-bold placeholder:text-gray-400"
                    />
                    {loading ? (
                        <Loader2 className="animate-spin text-blue-500" size={20} />
                    ) : query ? (
                        <button onClick={() => setQuery('')} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition-colors">
                            <X size={18} className="text-gray-400" />
                        </button>
                    ) : (
                         <div className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-lg">ESC</div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                    {query.length < 2 ? (
                        <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-2">
                            <Search size={40} className="opacity-20" />
                            <p className="text-sm font-bold">حداقل ۲ کاراکتر برای جستجو وارد کنید</p>
                        </div>
                    ) : results.length === 0 && !loading ? (
                        <div className="py-12 text-center text-gray-400 flex flex-col items-center gap-2">
                            <X size={40} className="opacity-20" />
                            <p className="text-sm font-bold">موردی یافت نشد</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {results.map((result) => (
                                <button 
                                    key={`${result.type}-${result.id}`}
                                    onClick={() => {
                                        onNavigate(result.url, result.data);
                                        onClose();
                                    }}
                                    className="w-full text-right p-3 rounded-2xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center gap-4 group"
                                >
                                    <div className="bg-white dark:bg-white/10 p-3 rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                                        {getIcon(result.type)}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="font-black text-gray-800 dark:text-gray-100 text-sm truncate">{result.title}</div>
                                        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-bold truncate mt-0.5">{result.subtitle}</div>
                                    </div>
                                    <ArrowRight size={16} className="text-gray-300 group-hover:text-blue-500 transition-colors" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-3 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-white/5 flex justify-between items-center">
                    <div className="text-[10px] text-gray-400 font-bold flex items-center gap-3">
                         <span className="flex items-center gap-1"><ExternalLink size={10}/> اینتر: انتخاب</span>
                         <span className="flex items-center gap-1"><ArrowRight size={10} className="rotate-90"/> فلش: جابجایی</span>
                    </div>
                    <div className="text-[10px] text-gray-500 font-black">
                        {results.length} نتیجه یافت شد
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
