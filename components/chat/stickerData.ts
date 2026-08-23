export interface StickerItem {
    id: string;
    packId: string;
    name: string;
    emoji: string;
    preview: string; // SVG or High Quality graphic markup
    category: 'telegram_duck' | 'telegram_dog' | 'google_chat' | 'office_work';
}

export interface StickerPack {
    id: string;
    title: string;
    icon: string;
    stickers: StickerItem[];
}

export const STICKER_PACKS: StickerPack[] = [
    {
        id: 'telegram_duck',
        title: 'اردک تلگرام (Duck Spotty)',
        icon: '🦆',
        stickers: [
            {
                id: 'tg_duck_hello',
                packId: 'telegram_duck',
                name: 'سلام و درود',
                emoji: '👋',
                category: 'telegram_duck',
                preview: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="54" fill="#FFF9C4" stroke="#FBC02D" stroke-width="3"/>
                    <ellipse cx="60" cy="65" rx="36" ry="32" fill="#FDD835"/>
                    <circle cx="60" cy="42" r="24" fill="#FDD835"/>
                    <!-- Eyes -->
                    <circle cx="50" cy="38" r="4.5" fill="#263238"/>
                    <circle cx="52" cy="36.5" r="1.5" fill="#FFFFFF"/>
                    <circle cx="70" cy="38" r="4.5" fill="#263238"/>
                    <circle cx="72" cy="36.5" r="1.5" fill="#FFFFFF"/>
                    <!-- Cheeks -->
                    <circle cx="43" cy="45" r="5" fill="#FF8A80" opacity="0.6"/>
                    <circle cx="77" cy="45" r="5" fill="#FF8A80" opacity="0.6"/>
                    <!-- Beak -->
                    <path d="M52 46 Q60 56 68 46 Q60 42 52 46 Z" fill="#FB8C00"/>
                    <!-- Waving Hand -->
                    <path d="M88 40 Q105 25 100 48 Q92 56 84 52 Z" fill="#FDD835" stroke="#FBC02D" stroke-width="2"/>
                    <!-- Speed waves -->
                    <path d="M106 28 Q112 34 108 42" stroke="#FF9800" stroke-width="2.5" stroke-linecap="round"/>
                    <path d="M110 32 Q116 38 112 46" stroke="#FF9800" stroke-width="2" stroke-linecap="round"/>
                </svg>`
            },
            {
                id: 'tg_duck_like',
                packId: 'telegram_duck',
                name: 'عالیه / لایک',
                emoji: '👍',
                category: 'telegram_duck',
                preview: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="54" fill="#E8F5E9" stroke="#81C784" stroke-width="3"/>
                    <ellipse cx="60" cy="65" rx="36" ry="32" fill="#FDD835"/>
                    <circle cx="60" cy="42" r="24" fill="#FDD835"/>
                    <!-- Cool Sunglasses -->
                    <path d="M40 36 H58 L55 46 H43 Z" fill="#212121"/>
                    <path d="M62 36 H80 L77 46 H65 Z" fill="#212121"/>
                    <path d="M58 39 H62" stroke="#212121" stroke-width="3"/>
                    <path d="M42 38 L50 38" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>
                    <path d="M64 38 L72 38" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>
                    <!-- Beak Smirk -->
                    <path d="M54 48 Q60 56 68 49 Z" fill="#FB8C00"/>
                    <!-- Big Thumbs Up -->
                    <g transform="translate(80, 48)">
                        <rect x="0" y="10" width="14" height="22" rx="3" fill="#FB8C00"/>
                        <path d="M6 10 V2 Q6 -4 14 -2 Q18 4 18 10 H24 Q28 10 28 15 Q28 18 24 20 Q28 20 28 25 Q28 28 24 30 Q28 30 28 35 Q28 38 22 38 H10 Z" fill="#FDD835" stroke="#FBC02D" stroke-width="2"/>
                    </g>
                </svg>`
            },
            {
                id: 'tg_duck_love',
                packId: 'telegram_duck',
                name: 'عشق و تشکر',
                emoji: '❤️',
                category: 'telegram_duck',
                preview: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="54" fill="#FFEBEE" stroke="#FF8A80" stroke-width="3"/>
                    <ellipse cx="60" cy="65" rx="36" ry="32" fill="#FDD835"/>
                    <circle cx="60" cy="42" r="24" fill="#FDD835"/>
                    <!-- Heart Eyes -->
                    <path d="M46 38 C44 33 38 33 38 38 C38 43 46 48 46 48 C46 48 54 43 54 38 C54 33 48 33 46 38 Z" fill="#E53935"/>
                    <path d="M74 38 C72 33 66 33 66 38 C66 43 74 48 74 48 C74 48 82 43 82 38 C82 33 76 33 74 38 Z" fill="#E53935"/>
                    <!-- Cheeks -->
                    <circle cx="36" cy="46" r="6" fill="#FF5252" opacity="0.6"/>
                    <circle cx="84" cy="46" r="6" fill="#FF5252" opacity="0.6"/>
                    <!-- Beak kiss -->
                    <ellipse cx="60" cy="49" rx="6" ry="4" fill="#FB8C00"/>
                    <!-- Floating Hearts -->
                    <path d="M22 26 C20 22 15 22 15 26 C15 30 22 35 22 35 C22 35 29 30 29 26 C29 22 24 22 22 26 Z" fill="#FF1744" opacity="0.8"/>
                    <path d="M96 22 C94 18 89 18 89 22 C89 26 96 31 96 31 C96 31 103 26 103 22 C103 18 98 18 96 22 Z" fill="#FF1744" opacity="0.8"/>
                </svg>`
            },
            {
                id: 'tg_duck_fire',
                packId: 'telegram_duck',
                name: 'بمب انرژی / عالی',
                emoji: '🔥',
                category: 'telegram_duck',
                preview: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="54" fill="#FFF3E0" stroke="#FFB74D" stroke-width="3"/>
                    <!-- Flames in background -->
                    <path d="M30 65 Q40 20 60 15 Q65 30 75 25 Q85 18 90 65 Z" fill="#FF6D00" opacity="0.3"/>
                    <path d="M40 70 Q50 35 60 30 Q70 40 80 70 Z" fill="#FFD600" opacity="0.4"/>
                    <ellipse cx="60" cy="65" rx="36" ry="32" fill="#FDD835"/>
                    <circle cx="60" cy="42" r="24" fill="#FDD835"/>
                    <!-- Determined Eyes -->
                    <path d="M44 35 L56 39" stroke="#263238" stroke-width="3" stroke-linecap="round"/>
                    <path d="M76 35 L64 39" stroke="#263238" stroke-width="3" stroke-linecap="round"/>
                    <circle cx="50" cy="41" r="3.5" fill="#263238"/>
                    <circle cx="70" cy="41" r="3.5" fill="#263238"/>
                    <!-- Confident Beak -->
                    <path d="M52 48 Q60 56 68 48 Q60 45 52 48 Z" fill="#FB8C00"/>
                    <!-- Muscle flex -->
                    <path d="M22 55 Q10 40 25 35 Q35 48 30 65 Z" fill="#FDD835" stroke="#FBC02D" stroke-width="2"/>
                    <path d="M98 55 Q110 40 95 35 Q85 48 90 65 Z" fill="#FDD835" stroke="#FBC02D" stroke-width="2"/>
                </svg>`
            },
            {
                id: 'tg_duck_celebrate',
                packId: 'telegram_duck',
                name: 'جشن و پیروزی',
                emoji: '🎉',
                category: 'telegram_duck',
                preview: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="54" fill="#F3E5F5" stroke="#CE93D8" stroke-width="3"/>
                    <!-- Party Hat -->
                    <path d="M48 24 L60 2 L72 24 Z" fill="#AB47BC"/>
                    <circle cx="60" cy="2" r="4" fill="#FFEB3B"/>
                    <path d="M52 16 L68 16" stroke="#FFEB3B" stroke-width="2"/>
                    <ellipse cx="60" cy="68" rx="36" ry="30" fill="#FDD835"/>
                    <circle cx="60" cy="45" r="23" fill="#FDD835"/>
                    <!-- Joyful Eyes -->
                    <path d="M46 42 Q51 35 56 42" stroke="#263238" stroke-width="3" stroke-linecap="round" fill="none"/>
                    <path d="M64 42 Q69 35 74 42" stroke="#263238" stroke-width="3" stroke-linecap="round" fill="none"/>
                    <!-- Open Beak -->
                    <path d="M52 48 Q60 62 68 48 Z" fill="#D84315"/>
                    <ellipse cx="60" cy="55" rx="4" ry="2" fill="#FF8A80"/>
                    <!-- Confetti -->
                    <circle cx="25" cy="30" r="3" fill="#E91E63"/>
                    <circle cx="95" cy="35" r="3.5" fill="#2196F3"/>
                    <rect x="30" y="45" width="5" height="5" fill="#4CAF50" transform="rotate(30 30 45)"/>
                    <rect x="88" y="55" width="6" height="4" fill="#FF9800" transform="rotate(45 88 55)"/>
                </svg>`
            },
            {
                id: 'tg_duck_coffee',
                packId: 'telegram_duck',
                name: 'خسته نباشید / چای و قهوه',
                emoji: '☕',
                category: 'telegram_duck',
                preview: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="54" fill="#EFEBE9" stroke="#BCAAA4" stroke-width="3"/>
                    <ellipse cx="60" cy="65" rx="36" ry="32" fill="#FDD835"/>
                    <circle cx="60" cy="42" r="24" fill="#FDD835"/>
                    <!-- Relaxed Eyes -->
                    <path d="M46 38 Q51 44 56 38" stroke="#263238" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                    <path d="M64 38 Q69 44 74 38" stroke="#263238" stroke-width="2.5" stroke-linecap="round" fill="none"/>
                    <!-- Beak -->
                    <path d="M54 46 Q60 52 66 46 Z" fill="#FB8C00"/>
                    <!-- Coffee Cup -->
                    <g transform="translate(68, 52)">
                        <rect x="0" y="6" width="22" height="24" rx="4" fill="#6D4C41"/>
                        <path d="M22 10 Q28 10 28 17 Q28 24 22 24" stroke="#6D4C41" stroke-width="3" fill="none"/>
                        <!-- Steam -->
                        <path d="M6 2 Q8 -4 6 -8" stroke="#BCAAA4" stroke-width="2" stroke-linecap="round" fill="none"/>
                        <path d="M14 4 Q16 -2 14 -6" stroke="#BCAAA4" stroke-width="2" stroke-linecap="round" fill="none"/>
                    </g>
                </svg>`
            }
        ]
    },
    {
        id: 'telegram_dog',
        title: 'سگ و گربه تلگرام (Pets & Energy)',
        icon: '🐶',
        stickers: [
            {
                id: 'tg_dog_super',
                packId: 'telegram_dog',
                name: 'عالی و پرانرژی',
                emoji: '💪',
                category: 'telegram_dog',
                preview: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="54" fill="#E1F5FE" stroke="#81D4FA" stroke-width="3"/>
                    <!-- Dog Body -->
                    <ellipse cx="60" cy="68" rx="34" ry="28" fill="#8D6E63"/>
                    <!-- Head -->
                    <circle cx="60" cy="46" r="24" fill="#A1887F"/>
                    <!-- Ears -->
                    <ellipse cx="38" cy="40" rx="9" ry="16" fill="#5D4037" transform="rotate(-15 38 40)"/>
                    <ellipse cx="82" cy="40" rx="9" ry="16" fill="#5D4037" transform="rotate(15 82 40)"/>
                    <!-- Eyes & Star sparkles -->
                    <circle cx="51" cy="42" r="4" fill="#212121"/>
                    <circle cx="69" cy="42" r="4" fill="#212121"/>
                    <circle cx="52" cy="40.5" r="1.5" fill="#FFFFFF"/>
                    <circle cx="70" cy="40.5" r="1.5" fill="#FFFFFF"/>
                    <!-- Nose -->
                    <ellipse cx="60" cy="49" rx="4.5" ry="3" fill="#212121"/>
                    <!-- Tongue -->
                    <path d="M57 52 Q60 62 63 52 Z" fill="#FF5252"/>
                    <!-- Star sparkles -->
                    <path d="M96 22 L98 28 L104 30 L98 32 L96 38 L94 32 L88 30 L94 28 Z" fill="#FFD600"/>
                </svg>`
            },
            {
                id: 'tg_cat_success',
                packId: 'telegram_dog',
                name: 'تایید و موفقیت',
                emoji: '🎯',
                category: 'telegram_dog',
                preview: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="54" fill="#EDE7F6" stroke="#B39DDB" stroke-width="3"/>
                    <!-- Cat Head -->
                    <circle cx="60" cy="52" r="28" fill="#FFB74D"/>
                    <!-- Ears -->
                    <path d="M38 34 L32 14 L50 28 Z" fill="#FF9800"/>
                    <path d="M36 30 L34 18 L46 26 Z" fill="#FFAB91"/>
                    <path d="M82 34 L88 14 L70 28 Z" fill="#FF9800"/>
                    <path d="M84 30 L86 18 L74 26 Z" fill="#FFAB91"/>
                    <!-- Big Happy Eyes -->
                    <path d="M46 48 Q52 40 58 48" stroke="#3E2723" stroke-width="3" stroke-linecap="round" fill="none"/>
                    <path d="M62 48 Q68 40 74 48" stroke="#3E2723" stroke-width="3" stroke-linecap="round" fill="none"/>
                    <!-- Nose & Whiskers -->
                    <polygon points="57,53 63,53 60,56" fill="#D81B60"/>
                    <path d="M32 52 H46 M30 57 H46 M74 52 H88 M74 57 H88" stroke="#3E2723" stroke-width="1.5" stroke-linecap="round"/>
                    <!-- Target Badge -->
                    <circle cx="86" cy="80" r="18" fill="#E53935"/>
                    <circle cx="86" cy="80" r="12" fill="#FFFFFF"/>
                    <circle cx="86" cy="80" r="6" fill="#E53935"/>
                </svg>`
            },
            {
                id: 'tg_dog_deal',
                packId: 'telegram_dog',
                name: 'توافق و تایید قرارداد',
                emoji: '🤝',
                category: 'telegram_dog',
                preview: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="54" fill="#E0F2F1" stroke="#80CBC4" stroke-width="3"/>
                    <circle cx="60" cy="46" r="24" fill="#90A4AE"/>
                    <ellipse cx="38" cy="40" rx="8" ry="15" fill="#546E7A" transform="rotate(-20 38 40)"/>
                    <ellipse cx="82" cy="40" rx="8" ry="15" fill="#546E7A" transform="rotate(20 82 40)"/>
                    <circle cx="51" cy="43" r="3.5" fill="#263238"/>
                    <circle cx="69" cy="43" r="3.5" fill="#263238"/>
                    <ellipse cx="60" cy="49" rx="4" ry="2.5" fill="#263238"/>
                    <!-- Tie & Suit -->
                    <path d="M42 70 L60 88 L78 70 Z" fill="#1E88E5"/>
                    <path d="M57 70 L60 82 L63 70 Z" fill="#D32F2F"/>
                    <!-- Checkmark Badge -->
                    <circle cx="92" cy="30" r="14" fill="#43A047"/>
                    <path d="M86 30 L90 34 L98 26" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`
            }
        ]
    },
    {
        id: 'google_chat',
        title: 'استیکرهای سه‌بعدی گوگل چت (Google Chat 3D)',
        icon: '🌟',
        stickers: [
            {
                id: 'gc_rocket',
                packId: 'google_chat',
                name: 'پرواز / سرعت بالا',
                emoji: '🚀',
                category: 'google_chat',
                preview: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="54" fill="#E8EAF6" stroke="#9FA8DA" stroke-width="3"/>
                    <defs>
                        <linearGradient id="rocketGrad" x1="40" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
                            <stop stop-color="#4285F4"/>
                            <stop offset="1" stop-color="#1967D2"/>
                        </linearGradient>
                    </defs>
                    <!-- Rocket Body -->
                    <path d="M60 16 C75 30 84 55 80 80 L40 80 C36 55 45 30 60 16 Z" fill="url(#rocketGrad)"/>
                    <circle cx="60" cy="45" r="9" fill="#FFFFFF"/>
                    <circle cx="60" cy="45" r="6" fill="#8AB4F8"/>
                    <!-- Fins -->
                    <path d="M40 68 L24 82 L42 80 Z" fill="#EA4335"/>
                    <path d="M80 68 L96 82 L78 80 Z" fill="#EA4335"/>
                    <!-- Exhaust Flame -->
                    <path d="M48 80 Q60 108 72 80 Q60 92 48 80 Z" fill="#FBBC04"/>
                    <path d="M52 80 Q60 98 68 80 Z" fill="#EA4335"/>
                    <!-- Sparkles -->
                    <circle cx="25" cy="35" r="3" fill="#FBBC04"/>
                    <circle cx="95" cy="30" r="4" fill="#34A853"/>
                </svg>`
            },
            {
                id: 'gc_trophy',
                packId: 'google_chat',
                name: 'جام قهرمانی و موفقیت',
                emoji: '🏆',
                category: 'google_chat',
                preview: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="54" fill="#FFF8E1" stroke="#FFE082" stroke-width="3"/>
                    <!-- Trophy Cup -->
                    <path d="M38 24 H82 V50 C82 64 72 74 60 74 C48 74 38 64 38 50 Z" fill="#FBBC04"/>
                    <!-- Handles -->
                    <path d="M38 32 H26 C22 32 20 44 26 50 H38" stroke="#F29900" stroke-width="4" fill="none" stroke-linecap="round"/>
                    <path d="M82 32 H94 C98 32 100 44 94 50 H82" stroke="#F29900" stroke-width="4" fill="none" stroke-linecap="round"/>
                    <!-- Base -->
                    <path d="M54 74 H66 V86 H54 Z" fill="#F29900"/>
                    <path d="M36 86 H84 V98 H36 Z" rx="3" fill="#5F6368"/>
                    <!-- Star on Trophy -->
                    <path d="M60 38 L62 44 L68 45 L63 49 L65 55 L60 52 L55 55 L57 49 L52 45 L58 44 Z" fill="#FFFFFF"/>
                </svg>`
            },
            {
                id: 'gc_idea',
                packId: 'google_chat',
                name: 'ایده نو / راه‌حل هوشمند',
                emoji: '💡',
                category: 'google_chat',
                preview: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="54" fill="#FFFDE7" stroke="#FFF59D" stroke-width="3"/>
                    <!-- Rays -->
                    <path d="M60 10 V18 M25 25 L31 31 M95 25 L89 31 M15 60 H23 M97 60 H105" stroke="#F29900" stroke-width="3" stroke-linecap="round"/>
                    <!-- Bulb Glass -->
                    <path d="M60 26 C44 26 36 38 36 50 C36 60 46 66 48 74 H72 C74 66 84 60 84 50 C84 38 76 26 60 26 Z" fill="#FBBC04"/>
                    <!-- Base Screw -->
                    <rect x="50" y="76" width="20" height="4" rx="2" fill="#BDC1C6"/>
                    <rect x="50" y="82" width="20" height="4" rx="2" fill="#BDC1C6"/>
                    <path d="M54 88 H66 Q60 94 54 88 Z" fill="#5F6368"/>
                    <!-- Filament Glow -->
                    <path d="M52 50 Q60 40 68 50" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" fill="none"/>
                </svg>`
            },
            {
                id: 'gc_approved_doc',
                packId: 'google_chat',
                name: 'سند تایید شد',
                emoji: '📝',
                category: 'google_chat',
                preview: `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="60" cy="60" r="54" fill="#E8F5E9" stroke="#A5D6A7" stroke-width="3"/>
                    <!-- Document Paper -->
                    <rect x="36" y="20" width="48" height="66" rx="4" fill="#FFFFFF" stroke="#BDC1C6" stroke-width="2"/>
                    <!-- Text lines -->
                    <line x1="44" y1="32" x2="68" y2="32" stroke="#4285F4" stroke-width="3" stroke-linecap="round"/>
                    <line x1="44" y1="42" x2="76" y2="42" stroke="#BDC1C6" stroke-width="2.5" stroke-linecap="round"/>
                    <line x1="44" y1="50" x2="76" y2="50" stroke="#BDC1C6" stroke-width="2.5" stroke-linecap="round"/>
                    <line x1="44" y1="58" x2="64" y2="58" stroke="#BDC1C6" stroke-width="2.5" stroke-linecap="round"/>
                    <!-- Big Green Check Badge -->
                    <circle cx="78" cy="80" r="18" fill="#34A853"/>
                    <path d="M70 80 L76 86 L86 74" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`
            }
        ]
    }
];
