import React, { useState } from 'react';
import { STICKER_PACKS, StickerItem } from './stickerData';
import { X, Sparkles, Smile } from 'lucide-react';

interface StickerPickerProps {
    onSelectSticker: (sticker: StickerItem) => void;
    onClose: () => void;
}

export const StickerPicker: React.FC<StickerPickerProps> = ({ onSelectSticker, onClose }) => {
    const [selectedPackId, setSelectedPackId] = useState<string>(STICKER_PACKS[0]?.id || 'telegram_duck');

    const activePack = STICKER_PACKS.find(p => p.id === selectedPackId) || STICKER_PACKS[0];

    return (
        <div className="absolute bottom-16 left-2 right-2 md:left-4 md:right-auto md:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 z-50 overflow-hidden flex flex-col max-h-[380px] animate-scale-up" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <span className="text-lg">🌟</span>
                    <span className="text-xs font-bold text-gray-800 dark:text-gray-200">استیکرهای تلگرام و گوگل چت</span>
                </div>
                <button
                    onClick={onClose}
                    className="p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    title="بستن"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Sticker Pack Tabs */}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-100/70 dark:bg-gray-800/40 border-b border-gray-200/60 dark:border-gray-700/60 overflow-x-auto no-scrollbar">
                {STICKER_PACKS.map(pack => {
                    const isActive = pack.id === selectedPackId;
                    return (
                        <button
                            key={pack.id}
                            onClick={() => setSelectedPackId(pack.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                isActive
                                    ? 'bg-blue-600 text-white shadow-sm scale-105'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                            }`}
                        >
                            <span>{pack.icon}</span>
                            <span>{pack.title.split('(')[0].trim()}</span>
                        </button>
                    );
                })}
            </div>

            {/* Stickers Grid */}
            <div className="p-3 overflow-y-auto flex-1 grid grid-cols-3 gap-3">
                {activePack?.stickers.map(sticker => (
                    <button
                        key={sticker.id}
                        onClick={() => {
                            onSelectSticker(sticker);
                            onClose();
                        }}
                        className="group relative flex flex-col items-center justify-center p-2 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition-all hover:scale-105 active:scale-95"
                    >
                        <div
                            className="w-16 h-16 pointer-events-none drop-shadow-sm group-hover:drop-shadow-md transition-transform"
                            dangerouslySetInnerHTML={{ __html: sticker.preview }}
                        />
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 mt-1 truncate max-w-full text-center">
                            {sticker.name}
                        </span>
                    </button>
                ))}
            </div>

            {/* Footer */}
            <div className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 flex items-center justify-between">
                <span>کلیک برای ارسال فوری</span>
                <span className="flex items-center gap-1 font-mono">Telegram & Google Chat</span>
            </div>
        </div>
    );
};
