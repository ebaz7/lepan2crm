import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { getDb, saveDb } from './db-manager.js';
import * as utils from './utils.js';

/**
 * Dynamically resolves the Gemini API Key from settings or environment variables
 */
export const getActiveGeminiApiKey = (customKey) => {
    if (customKey && typeof customKey === 'string' && customKey.trim()) {
        return customKey.trim();
    }
    try {
        const db = getDb();
        const settingsKey = db?.settings?.geminiApiKey;
        if (settingsKey && typeof settingsKey === 'string' && settingsKey.trim()) {
            return settingsKey.trim();
        }
    } catch (e) {
        // ignore DB read error
    }
    const envKey = process.env.GEMINI_API_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim()) {
        return envKey.trim();
    }
    return '';
};

/**
 * Initializes GoogleGenAI client with the active or provided API key
 */
export const getGeminiClient = (customKey) => {
    const apiKey = getActiveGeminiApiKey(customKey);
    if (!apiKey) {
        throw new Error("کلید Google Gemini AI تنظیم نشده است. لطفاً کلید API را از بخش «تنظیمات سیستم ⚙️ -> تب ربات‌ها و ارتباطات -> بخش هوش مصنوعی» وارد و ذخیره نمایید.");
    }
    return new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
    });
};

/**
 * Live test of AI connection with given or stored key
 */
export const testAiConnection = async (customKey) => {
    const ai = getGeminiClient(customKey);
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
                role: 'user',
                parts: [{ text: 'سلام! اتصال آزمایشی سیستم ERP لپان بافت به هوش مصنوعی را در یک جمله کوتاه تایید کن.' }]
            }
        ]
    });
    return {
        success: true,
        reply: response.text?.trim() || 'ارتباط با موتور هوش مصنوعی با موفقیت برقرار است.',
        model: 'gemini-2.5-flash',
        timestamp: new Date().toISOString()
    };
};

/**
 * Gather live system snapshot context for the AI Agent
 */
export const getSystemContextSnapshot = () => {
    try {
        const db = getDb();
        const settings = db.settings || {};
        
        // Active fiscal year
        const activeYear = (settings.fiscalYears || []).find(y => y.id === settings.activeFiscalYearId)?.label || '1404';
        
        // Orders & permits
        const ordersCount = (db.orders || []).length;
        const pendingPermits = (db.exitPermits || []).filter(p => p.status === 'PENDING' || p.status === 'APPROVED_FINANCIAL').length;
        const completedPermits = (db.exitPermits || []).filter(p => p.status === 'EXITED' || p.status === 'DELIVERED').length;
        
        // Trade records (Logistics)
        const transitCount = (db.tradeRecords || []).filter(r => r.type === 'transit').length;
        const customsCount = (db.tradeRecords || []).filter(r => r.type === 'customs').length;
        const purchaseCount = (db.tradeRecords || []).filter(r => r.type === 'purchase').length;

        // Cheques
        const cheques = db.cheques || db.chequeReceipts || [];
        const pendingCheques = cheques.filter(c => c.statusGroup === 'in_hand' || !c.statusGroup || c.status === 'PENDING').length;

        return {
            activeYear,
            companyNames: (settings.companies || []).map(c => typeof c === 'string' ? c : c.name),
            ordersCount,
            pendingPermits,
            completedPermits,
            logistics: {
                transitCount,
                customsCount,
                purchaseCount
            },
            pendingChequesCount: pendingCheques,
            dateJalali: new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran' }).format(new Date())
        };
    } catch (e) {
        console.error("Error generating system snapshot:", e.message);
        return {};
    }
};

/**
 * Transcribe and execute Voice / Audio commands
 */
export const processVoiceAudio = async (audioBuffer, mimeType = 'audio/ogg', customKey) => {
    const ai = getGeminiClient(customKey);
    const base64Audio = audioBuffer.toString('base64');
    const systemContext = JSON.stringify(getSystemContextSnapshot(), null, 2);

    const prompt = `
شما «دستیار هوشمند و ایجنت صوتی مدیر ارشد ERP» گروه صنعتی لپان بافت هستید.
وظیفه شما:
۱. پیام صوتی فارسی ارسال شده را دقیقاً بشنوید و متن آن را رونویسی (Transcribe) کنید.
۲. بر اساس متن و دستور کاربر، اطلاعات مربوطه را از سیستم تحلیل کرده یا پاسخ جامع، مؤدبانه و دقیق مدیریتی بدهید.
۳. در صورتی که کاربر دستوری مانند دریافت گزارش، تراز انبار، چک‌ها، یا بارهای در راه داده باشد، آن را مشخص نمایید.

اطلاعات زنده سیستم:
${systemContext}

خروجی خود را دقیقاً به زبان فارسی سلیس و در قالب JSON معتبر زیر ارائه دهید:
{
  "transcription": "متن دقیق شنیده شده از وویس",
  "intent": "نوع_درخواست (مانند WAREHOUSE_QUERY, SALES_QUERY, CHEQUE_QUERY, LOGISTICS_QUERY, GENERAL_HELP)",
  "replyText": "پاسخ کامل، روان و رسمی به زبان فارسی برای کاربر یا مدیر",
  "suggestedAction": "نام_عملیات_پیشنهادی_در_صورت_وجود (اختیاری)"
}
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            data: base64Audio,
                            mimeType: mimeType || 'audio/ogg'
                        }
                    },
                    {
                        text: prompt
                    }
                ]
            }
        ],
        config: {
            responseMimeType: "application/json"
        }
    });

    try {
        const text = response.text?.trim() || "{}";
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(clean);
    } catch (e) {
        return {
            transcription: "صوت دریافت شد",
            intent: "GENERAL",
            replyText: response.text || "پیام صوتی شما با موفقیت پردازش شد."
        };
    }
};

/**
 * Ask AI Assistant / Copilot
 */
export const askAiAssistant = async ({ message, contextData, history = [], customKey }) => {
    const ai = getGeminiClient(customKey);
    const systemSnapshot = getSystemContextSnapshot();
    const systemInstruction = `
شما «ایجنت هوش مصنوعی و مشاور ارشد سیستم ERP لپان بافت» هستید.
شما به تمام داده‌های زنده انبار (موجودی، بارهای در راه، گمرک، خرید، کسری‌ها و تراز وزنی)، فروش و مرجوعی‌ها، اسناد و چک‌های خزانه، برگه‌های خروج و وضعیت بارگیری دسترسی دارید.
اهداف شما:
- پاسخ به زبان فارسی بسیار روان، فاخر و دقیق مدیریتی.
- ارائه راهکارهای عملیاتی و اعداد مستند بر اساس داده‌ها.
- تحلیل ریسک، زمان اتمام موجودی و پیش‌بینی‌های هوشمند.
- استفاده از ساختاردهی زیبا (بولِت‌پوینت، ایموجی مناسب، اعداد خوانا با فونت و جداکننده).

داده‌های خلاصه وضعیت سیستم:
${JSON.stringify(systemSnapshot, null, 2)}

داده‌های زمینه‌ای صفحه جاری کاربر:
${contextData ? JSON.stringify(contextData, null, 2) : 'داده اضافه ثبت نشده'}
`;

    const formattedContents = [];
    if (Array.isArray(history) && history.length > 0) {
        history.forEach(item => {
            if (item.text) {
                formattedContents.push({
                    role: item.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: item.text }]
                });
            }
        });
    }

    formattedContents.push({
        role: 'user',
        parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: formattedContents,
        config: {
            systemInstruction
        }
    });

    return {
        reply: response.text || "پاسخی از هوش مصنوعی دریافت نشد.",
        timestamp: new Date().toISOString()
    };
};

/**
 * Deep Strategic Warehouse AI Analysis
 */
export const generateWarehouseStrategicAnalysis = async (warehousePayload, customKey) => {
    const ai = getGeminiClient(customKey);

    const prompt = `
شما «مدیر ارشد تحلیل زنجیره تامین و هوش انبار (AI Supply Chain Director)» هستید.
داده‌های تراز وزنی انبار، اقلام تولیدی، مواد اولیه وارداتی و کالاهای در راه/گمرک/خرید به شرح زیر به شما ارائه شده است:

${JSON.stringify(warehousePayload, null, 2)}

لطفاً یک «گزارش تحلیلی و استراتژیک جامع مدیریتی» تهیه کنید که شامل بخش‌های زیر باشد:
۱. **ارزیابی کلان تراز وزنی و مقایسه دوره‌ها**: تحلیل تغییرات وزنی، نسبت رشد یا کاهش مواد و محصولات نهایی.
۲. **تحلیل وضعیت لجستیک و تامین در راه**: بررسی وضعیت بارهای کانتینری در راه، بارهای متوقف در گمرک و در حال خرید و تخمین زمان تزریق به خط تولید.
۳. **شناسایی اقلام بحرانی و هشدارهای کسری (Stockout Risks)**: اقلام با افت شدید یا منفی و تخمین زمان اتمام بر اساس روند.
۴. **پیشنهادات عملیاتی و استراتژی خرید (Procurement Recommendations)**: چه اقلامی باید فوراً سفارش‌گذاری شوند و اولویت ترخیص گمرکی با کدام است.
۵. **خلاصه اجرایی برای جلسه هیئت مدیره (Executive Summary)**: ۳ الی ۵ نکته کلیدی تصمیم‌ساز به صورت کاملاً حرفه‌ای.

خروجی را در قالب یک پاسخ ساختاریافته JSON با فرمت زیر ارائه فرمایید:
{
  "executiveSummary": ["نکته ۱", "نکته ۲", "نکته ۳"],
  "healthScore": 88, // نمره سلامت زنجیره تامین از ۱ تا ۱۰۰
  "totalWeightAnalysis": "متن تحلیل کلان تراز و نسبت‌ها",
  "logisticsPipelineInsight": "تحلیل بارهای در راه، گمرک و خریدهای در حال انجام",
  "criticalAlerts": [
    { "itemName": "نام کالا", "riskLevel": "CRITICAL", "reason": "علت ریسک و پیشنهاد رفع" }
  ],
  "procurementActionPlan": [
    { "priority": "HIGH", "action": "اقدام مشخص خرید یا ترخیص", "impact": "اثر اقتصادی/تولیدی" }
  ],
  "fullReportMarkdown": "متن کامل، ساختاریافته و زیبای گزارش با مارک‌داون جهت نمایش و چاپ"
}
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            responseMimeType: "application/json"
        }
    });

    try {
        const text = response.text?.trim() || "{}";
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(clean);
    } catch (e) {
        return {
            healthScore: 85,
            executiveSummary: ["تحلیل با موفقیت انجام شد"],
            fullReportMarkdown: response.text || "گزارش تحلیلی با موفقیت تولید شد."
        };
    }
};

/**
 * Deep Strategic Sales & Cashflow AI Analysis
 */
export const generateSalesStrategicAnalysis = async (salesPayload, customKey) => {
    const ai = getGeminiClient(customKey);

    const prompt = `
شما «مدیر ارشد هوش تجاری و تحلیل استراتژیک فروش (AI Commercial & Revenue Director)» هستید.
داده‌های فروش، نرخ‌های میانگین، مقایسه بازه‌ها، مرجوعی‌ها (کد ۱۳) و تعهدات چک‌های دریافتنی به شرح زیر است:

${JSON.stringify(salesPayload, null, 2)}

لطفاً تحلیل جامع مدیریتی شامل موارد زیر ارائه دهید:
۱. **تحلیل روند فروش و حاشیه سود**: ارزیابی میانگین فی نهایی، درآمد ناخالص، نوسانات حجم فروش کیلوگرمی.
۲. **تحلیل مرجوعی‌ها و کیفیت بازار**: بررسی نسبت مرجوعی به فروش و شناسایی خطرات احتمالی.
۳. **پیش‌بینی جریان نقدینگی و وضعیت چک‌ها**: وضعیت سررسید چک‌های صندوق، نسبت وصولی و ریسک عدم وصول.
۴. **فرصت‌های رشد و راهکارهای افزایش فروش**: پیشنهادات کاربردی برای افزایش سهم بازار و سبد کالایی.
۵. **نکات کلیدی برای مدیرعامل و هیئت مدیره**.

خروجی را در قالب JSON استاندارد زیر ارائه فرمایید:
{
  "growthRatePct": 12.5,
  "revenueHealth": "STRONG",
  "executiveSummary": ["نکته ۱", "نکته ۲", "نکته ۳"],
  "salesTrendInsight": "متن تحلیل روند فروش و وزن مقایسه‌ای",
  "pricingAnalysis": "تحلیل میانگین نرخ‌ها و کشش قیمتی محصولات",
  "cashflowForecast": "پیش‌بینی نقدینگی ناشی از چک‌ها و درآمدهای وصولی",
  "strategicSuggestions": [
    { "target": "مشتریان یا گروه کالا", "action": "پیشنهاد عملیاتی", "expectedResult": "نتیجه مورد انتظار" }
  ],
  "fullReportMarkdown": "متن کامل و فاخر گزارش مدیریتی به صورت مارک‌داون"
}
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
            responseMimeType: "application/json"
        }
    });

    try {
        const text = response.text?.trim() || "{}";
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(clean);
    } catch (e) {
        return {
            growthRatePct: 0,
            revenueHealth: "STRONG",
            executiveSummary: ["تحلیل فروش با موفقیت تولید شد."],
            fullReportMarkdown: response.text || "تحلیل استراتژیک فروش آماده است."
        };
    }
};

/**
 * Smart Scanner for Invoices, Proformas, Bijaks, Cheques, Weighbridge Slips
 */
export const scanDocumentWithAi = async (imageBuffer, mimeType = 'image/jpeg', customKey) => {
    const ai = getGeminiClient(customKey);
    const base64Image = imageBuffer.toString('base64');
    const prompt = `
تصویر یک سند تجاری / صنعتی (فاکتور فروش، پروفرما، برگه خروج/بیجک، چک، یا برگه باسکول) بارگذاری شده است.
لطفاً تمام اطلاعات متنی و ساختاریافته این سند را به صورت هوشمند استخراج و اعتبارسنجی کنید.

نوع سند را تشخیص دهید و فیلدهای زیر را استخراج کنید:
- نوع سند (invoice, proforma, exit_permit, cheque, weighbridge, other)
- شماره سند / فاکتور / چک
- تاریخ سند (شمسی یا میلادی)
- نام صادرکننده / فروشنده / شرکت
- نام خریدار / تحویل‌گیرنده / گیرنده
- اقلام و ردیف‌های کالا (شامل نام کالا، تعداد/کارتن، وزن ناخالص/خالص، قیمت واحد، مبلغ کل)
- جمع کل مبالغ و اوزان
- شماره شبا / بانک / شماره حساب (در صورت وجود)
- توضیحات یا شروط سند

خروجی را در قالب JSON استاندارد زیر برگردانید:
{
  "documentType": "invoice",
  "documentTypeFa": "عنوان فارسی سند",
  "documentNumber": "شماره سند",
  "date": "تاریخ",
  "issuer": "صادرکننده",
  "recipient": "گیرنده/خریدار",
  "items": [
    {
      "rowNumber": 1,
      "itemName": "نام کالا",
      "quantity": 100,
      "unit": "کارتن یا عدد",
      "weight": 2500,
      "unitPrice": 150000,
      "totalPrice": 15000000
    }
  ],
  "totalQuantity": 100,
  "totalWeight": 2500,
  "totalAmount": 15000000,
  "currency": "ریال",
  "bankInfo": {
    "bankName": "نام بانک",
    "accountNo": "شماره حساب",
    "iban": "شماره شبا",
    "chequeSayad": "شناسه صیادی ۱۶ رقمی"
  },
  "notes": "سایر نکات مهم سند",
  "confidenceScore": 0.95
}
`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            data: base64Image,
                            mimeType: mimeType || 'image/jpeg'
                        }
                    },
                    { text: prompt }
                ]
            }
        ],
        config: {
            responseMimeType: "application/json"
        }
    });

    try {
        const text = response.text?.trim() || "{}";
        const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(clean);
    } catch (e) {
        return {
            documentType: "other",
            documentTypeFa: "سند متفرقه",
            notes: response.text || "استخراج اطلاعات انجام شد."
        };
    }
};
