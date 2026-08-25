import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
    Loader2, Save, Plus, Trash2, Edit2, Check, X, FileText, 
    TrendingDown, TrendingUp, DollarSign, Calendar, RefreshCw, Settings, Eye, EyeOff,
    ChevronDown, ChevronRight, ChevronUp, AlertTriangle, AlertCircle, Send, Bell, BellRing, 
    CheckCircle2, ArrowUpRight, ArrowDownRight, ArrowUp, Sparkles, Share2, Scale, Layers, 
    Package, Boxes, Filter, ExternalLink, Info, Download, FileDown, CheckSquare, Clock, Sliders, Navigation, Building2,
    Printer
} from 'lucide-react';
import { TradeStage } from '../types';
import { buildWarehouseOverviewPrintHtml } from '../utils/warehouseOverviewPrintHtml';

interface WarehouseItem {
    id?: string;
    itemName: string;
    proforma?: string;
    lastYearCartons?: number;
    lastYearWeight?: number;
    lastYearContainers?: number;
    lastYearDollars?: number;
    currentCartons?: number;
    currentWeight?: number;
    currentContainers?: number;
    currentDollars?: number;
}

interface CustomCargoItem {
    id: string;
    cargoType: string;
    proforma: string;
    weight: number;
    cartons: number;
    container: number;
    dollars: number;
}

interface CommercialGoodItem {
    id: string;
    itemName: string;
    category: string;
    cartons: number;
    weight: number;
    container: number;
    dollars: number;
}

export const WarehouseOverviewTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    // Bot Alert & Dispatch States
    const [isBotModalOpen, setIsBotModalOpen] = useState(false);
    const [isSendingBot, setIsSendingBot] = useState(false);
    const [botDestinationType, setBotDestinationType] = useState<'default' | 'production' | 'custom'>('default');
    const [customTargetId, setCustomTargetId] = useState('');
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['telegram', 'bale']);
    const [botReportScope, setBotReportScope] = useState<'both' | 'overview_only' | 'variance_only'>('both');
    const [botSendFormat, setBotSendFormat] = useState<'pdf_and_caption' | 'pdf_only' | 'caption_only'>('pdf_and_caption');
    const [botNotifyInApp, setBotNotifyInApp] = useState<boolean>(true);
    const [botSendSuccessMessage, setBotSendSuccessMessage] = useState<string | null>(null);
    const [botSendErrorMessage, setBotSendErrorMessage] = useState<string | null>(null);

    // PDF Direct Download States
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [pdfScopeMenuOpen, setPdfScopeMenuOpen] = useState(false);

    // Variance Filter State
    const [varianceFilter, setVarianceFilter] = useState<'all' | 'negative' | 'positive'>('all');
    const [showVarianceDetails, setShowVarianceDetails] = useState(true);

    // Live Sayan Data States
    const [sayanLastYear, setSayanLastYear] = useState<any[]>([]);
    const [sayanCurrent, setSayanCurrent] = useState<any[]>([]);

    // Overrides & Extra tables saved in our local DB
    const [lastYearOverrides, setLastYearOverrides] = useState<Record<string, Partial<WarehouseItem>>>({});
    const [currentOverrides, setCurrentOverrides] = useState<Record<string, Partial<WarehouseItem>>>({});

    // Custom tables
    const [goodsInTransit, setGoodsInTransit] = useState<CustomCargoItem[]>([]);
    const [goodsInCustoms, setGoodsInCustoms] = useState<CustomCargoItem[]>([]);
    const [purchasingGoods, setPurchasingGoods] = useState<CustomCargoItem[]>([]);
    const [commercialGoods, setCommercialGoods] = useState<CommercialGoodItem[]>([]);

    // Dynamic category overrides for Sayan items
    const [itemCategories, setItemCategories] = useState<Record<string, 'raw' | 'factory' | 'other'>>({});

    // Collapsible group state for Manufactured Yarns
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    // Metadata & Configurable Reporting Dates
    const [reportDate, setReportDate] = useState("۱۴۰۵/۰۵/۳۱");
    const [signature, setSignature] = useState("محمد ابراهیم حیدری");

    // Configurable Labels and Query Dates
    const [report1Label, setReport1Label] = useState("منتهی به سال ۱۴۰۴");
    const [report1Jalali, setReport1Jalali] = useState("۱۴۰۴/۱۲/۲۹");
    const [report1Miladi, setReport1Miladi] = useState("2026-03-20");

    const [report2Label, setReport2Label] = useState("وضعیت فعلی سال ۱۴۰۵");
    const [report2Jalali, setReport2Jalali] = useState("۱۴۰۵/۰۵/۳۱");
    const [report2Miladi, setReport2Miladi] = useState("2026-08-22");

    const [cumulativeFromLastYear, setCumulativeFromLastYear] = useState<boolean>(true);

    // Allowed commercial companies for warehouse overview integration
    const [allowedCompanies, setAllowedCompanies] = useState<string[]>([]);
    const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
    
    // Persistent refs for trade records and base custom table items
    const rawTradeRecordsRef = useRef<any[]>([]);
    const baseTransitRef = useRef<CustomCargoItem[]>([]);
    const baseCustomsRef = useRef<CustomCargoItem[]>([]);
    const basePurchaseRef = useRef<CustomCargoItem[]>([]);

    // Warehouse Bot Group Configurations from AppSettings
    const [warehouseTelegramGroupId, setWarehouseTelegramGroupId] = useState<string>('');
    const [warehouseBaleGroupId, setWarehouseBaleGroupId] = useState<string>('');
    const [warehouseWhatsappGroupId, setWarehouseWhatsappGroupId] = useState<string>('');

    // Search filter for Sayan items
    const [itemFilterText, setItemFilterText] = useState("");

    // Active Section State for Navigator
    const [activeSectionId, setActiveSectionId] = useState<string>('section-sayan-tables');

    // Scroll lock for Bot Modal to strictly prevent background page scrolling / jumping
    useEffect(() => {
        if (isBotModalOpen) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [isBotModalOpen]);

    // Smooth scroll helper to navigate effortlessly between sections without tiring scroll
    const scrollToSection = (sectionId: string) => {
        setActiveSectionId(sectionId);
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const containers = document.querySelectorAll('.overflow-y-auto, .custom-scrollbar');
        containers.forEach(c => c.scrollTo({ top: 0, behavior: 'smooth' }));
    };

    // Company name normalization and matching helpers
    const normalizeCompanyName = (name: string): string => {
        if (!name) return '';
        return String(name)
            .trim()
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/ي/g, 'ی')
            .replace(/ك/g, 'ک')
            .replace(/آ/g, 'ا')
            .replace(/\s+/g, ' ')
            .toLowerCase();
    };

    const isCompanyMatching = (recordCompany: string, allowedComps: string[]): boolean => {
        if (!allowedComps || allowedComps.length === 0) return true;
        const normRec = normalizeCompanyName(recordCompany);
        if (!normRec || normRec === 'بدون شرکت') {
            return allowedComps.some(c => {
                const normC = normalizeCompanyName(c);
                return normC === 'بدون شرکت' || normC === '';
            });
        }

        return allowedComps.some(allowed => {
            const normAllowed = normalizeCompanyName(allowed);
            if (!normAllowed) return false;
            if (normRec === normAllowed) return true;

            const cleanRec = normRec.replace(/^شرکت\s+/, '').trim();
            const cleanAllowed = normAllowed.replace(/^شرکت\s+/, '').trim();
            if (cleanRec === cleanAllowed) return true;

            if (cleanAllowed.length >= 5 && cleanRec.includes(cleanAllowed)) return true;
            if (cleanRec.length >= 5 && cleanAllowed.includes(cleanRec)) return true;

            return false;
        });
    };

    const getRecordWeight = (rec: any): number => {
        if (rec.shippingDocuments && rec.shippingDocuments.length > 0) {
            const commDocs = rec.shippingDocuments.filter((d: any) => d.type === 'Commercial Invoice');
            let commW = 0;
            for (const doc of commDocs) {
                if (doc.invoiceItems && doc.invoiceItems.length > 0) {
                    commW += doc.invoiceItems.reduce((sum: number, item: any) => sum + (Number(item.weight) || 0), 0);
                } else if (doc.netWeight) {
                    commW += Number(doc.netWeight) || 0;
                }
            }
            if (commW > 0) return commW;
        }
        return rec.items ? rec.items.reduce((sum: number, item: any) => sum + (Number(item.weight) || 0), 0) : 0;
    };

    const getRecordCartons = (rec: any): number => {
        if (!rec.shippingDocuments) return 0;
        const commDocs = rec.shippingDocuments.filter((d: any) => d.type === 'Commercial Invoice');
        let cartons = 0;
        for (const doc of commDocs) {
            if (doc.packagesCount) {
                cartons += Number(doc.packagesCount) || 0;
            } else if (doc.packingItems && doc.packingItems.length > 0) {
                cartons += doc.packingItems.reduce((sum: number, item: any) => sum + (Number(item.packageCount) || 0), 0);
            }
        }
        return cartons;
    };

    const getRecordDollars = (rec: any): number => {
        if (rec.shippingDocuments && rec.shippingDocuments.length > 0) {
            const commDocs = rec.shippingDocuments.filter((d: any) => d.type === 'Commercial Invoice');
            let dol = 0;
            for (const doc of commDocs) {
                if (doc.invoiceItems && doc.invoiceItems.length > 0) {
                    dol += doc.invoiceItems.reduce((sum: number, item: any) => sum + (Number(item.totalPrice) || 0), 0);
                }
            }
            if (dol > 0) return dol;
        }
        return rec.items ? rec.items.reduce((sum: number, item: any) => sum + (Number(item.totalPrice) || 0), 0) : 0;
    };

    const applyCommercialFilterAndMerge = (
        trades: any[],
        targetAllowedCompanies: string[],
        baseTransit: CustomCargoItem[],
        baseCustoms: CustomCargoItem[],
        basePurchase: CustomCargoItem[]
    ) => {
        const activeTradeRecords = (trades || []).filter((r: any) => !r.isArchived && isCompanyMatching(r.company, targetAllowedCompanies));

        const parsedCommercialTransit: CustomCargoItem[] = [];
        const parsedCommercialCustoms: CustomCargoItem[] = [];
        const parsedCommercialPurchase: CustomCargoItem[] = [];

        for (const record of activeTradeRecords) {
            const isCompleted = record.status === 'Completed' || record.isArchived;

            // Check if record has reached customs (has cottage, green leaf, guarantees, or customs clearance receipts)
            const hasCottage = Boolean(
                (record.greenLeafData?.duties && record.greenLeafData.duties.length > 0) ||
                (record.greenLeafData?.guarantees && record.greenLeafData.guarantees.length > 0) ||
                (record.stages?.[TradeStage.GREEN_LEAF]?.costRial > 0 || record.stages?.[TradeStage.GREEN_LEAF]?.isCompleted) ||
                (record.stages?.['برگ سبز']?.costRial > 0 || record.stages?.['برگ سبز']?.isCompleted) ||
                (record.cottageNumber && String(record.cottageNumber).trim() !== '') ||
                (record.greenLeafData?.duties?.some((d: any) => d.cottageNumber && String(d.cottageNumber).trim() !== ''))
            );

            const hasCustomsWarehouseReceipt = Boolean(
                (record.clearanceData?.receipts && record.clearanceData.receipts.length > 0) ||
                (record.stages?.[TradeStage.CLEARANCE_DOCS]?.costRial > 0 || record.stages?.[TradeStage.CLEARANCE_DOCS]?.isCompleted) ||
                (record.stages?.['ترخیصیه و قبض انبار']?.costRial > 0 || record.stages?.['ترخیصیه و قبض انبار']?.isCompleted) ||
                (record.clearanceData?.payments && record.clearanceData.payments.length > 0)
            );

            const isInCustoms = !isCompleted && (record.isInCustoms || hasCottage || hasCustomsWarehouseReceipt);

            const hasShipping = Boolean(
                record.isInTransit ||
                (record.shippingDocuments && record.shippingDocuments.length > 0) ||
                (record.stages?.[TradeStage.SHIPPING_DOCS]?.costRial > 0 || record.stages?.[TradeStage.SHIPPING_DOCS]?.costCurrency > 0 || record.stages?.[TradeStage.SHIPPING_DOCS]?.isCompleted) ||
                (record.stages?.['اسناد حمل']?.costRial > 0 || record.stages?.['اسناد حمل']?.costCurrency > 0 || record.stages?.['اسناد حمل']?.isCompleted) ||
                (record.stages?.[TradeStage.INSPECTION]?.costRial > 0 || record.stages?.[TradeStage.INSPECTION]?.isCompleted) ||
                (record.stages?.['گواهی بازرسی']?.costRial > 0 || record.stages?.['گواهی بازرسی']?.isCompleted)
            );

            const isInTransit = !isCompleted && !isInCustoms && hasShipping;

            const hasCurrencyPurchase = Boolean(
                (record.currencyPurchaseData && (
                    (record.currencyPurchaseData.purchasedAmount || 0) > 0 || 
                    (record.currencyPurchaseData.tranches && record.currencyPurchaseData.tranches.length > 0)
                )) ||
                (record.stages?.[TradeStage.CURRENCY_PURCHASE]?.costCurrency > 0 || record.stages?.[TradeStage.CURRENCY_PURCHASE]?.costRial > 0 || record.stages?.[TradeStage.CURRENCY_PURCHASE]?.isCompleted) ||
                (record.stages?.['خرید ارز']?.costCurrency > 0 || record.stages?.['خرید ارز']?.costRial > 0 || record.stages?.['خرید ارز']?.isCompleted)
            );

            const isPurchasing = !isCompleted && !isInCustoms && !isInTransit && (
                hasCurrencyPurchase ||
                (record.registrationNumber && String(record.registrationNumber).trim() !== '') ||
                (record.stages?.[TradeStage.ALLOCATION_APPROVED]?.isCompleted || record.stages?.['تخصیص یافته']?.isCompleted) ||
                (record.stages?.[TradeStage.ALLOCATION_QUEUE]?.isCompleted || record.stages?.['در صف تخصیص ارز']?.isCompleted) ||
                (record.stages?.[TradeStage.LICENSES]?.isCompleted || record.stages?.['مجوزها و پروفرما']?.isCompleted) ||
                (record.licenseData?.transactions && record.licenseData.transactions.length > 0) ||
                (record.items && record.items.length > 0)
            );

            const item: CustomCargoItem = {
                id: `com_${record.id}`,
                cargoType: record.goodsName || 'کالای بازرگانی',
                proforma: record.fileNumber || '',
                weight: getRecordWeight(record),
                cartons: getRecordCartons(record),
                container: 0,
                dollars: getRecordDollars(record)
            };

            if (isInCustoms) {
                parsedCommercialCustoms.push(item);
            } else if (isInTransit) {
                parsedCommercialTransit.push(item);
            } else if (isPurchasing) {
                parsedCommercialPurchase.push(item);
            }
        }

        const clearedFileNumbers = new Set(
            activeTradeRecords
                .filter(r => r.status === 'Completed' || r.isArchived)
                .map(r => r.fileNumber)
                .filter(Boolean)
        );

        setGoodsInTransit([
            ...(baseTransit || []).filter((x: any) => !x.id.startsWith('com_')),
            ...parsedCommercialTransit
        ]);
        setGoodsInCustoms([
            ...(baseCustoms || []).filter((x: any) => !x.id.startsWith('com_') && (!x.proforma || !clearedFileNumbers.has(x.proforma))),
            ...parsedCommercialCustoms
        ]);
        setPurchasingGoods([
            ...(basePurchase || []).filter((x: any) => !x.id.startsWith('com_')),
            ...parsedCommercialPurchase
        ]);
    };

    // Helper to extract Jalali year
    const getJalaliYear = (jalaliStr: string) => {
        const clean = String(jalaliStr || '').trim()
            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
        const match = clean.match(/^(\d{4})/);
        return match ? parseInt(match[1]) : 1404;
    };

    // Helper to approximate Gregorian start date of Jalali year (anchoring to official opening balance base 2025-03-21)
    const getJalaliYearStartMiladi = (year: number) => {
        if (year < 1404) return '2024-03-20';
        return '2025-03-21';
    };

    // Helper to fetch Sayan warehouse inventory using dynamic start and end dates
    const fetchSayanData = async (r1Miladi: string, r2Miladi: string, r1Jalali: string, r2Jalali: string, isCumulative: boolean) => {
        const y1 = getJalaliYear(r1Jalali);
        const y2 = getJalaliYear(r2Jalali);
        
        const r1From = getJalaliYearStartMiladi(y1);
        const r2From = isCumulative ? getJalaliYearStartMiladi(y1) : getJalaliYearStartMiladi(y2);
        
        const url = `/api/sayan/warehouse-inventory?lastYearDateFrom=${r1From}&lastYearDateTo=${r1Miladi}&currentYearDateFrom=${r2From}&currentYearDateTo=${r2Miladi}`;
        const sayanRes = await fetch(url);
        const sayanData = await sayanRes.json();
        if (sayanData.success) {
            setSayanLastYear(sayanData.lastYearStock || []);
            setSayanCurrent(sayanData.currentStock || []);
        }
    };

    // Load everything on mount
    useEffect(() => {
        loadSavedData();
    }, []);

    const loadSavedData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch our custom DB data first to read labels/dates and allowed companies
            const dbRes = await fetch('/api/warehouse-overview/data');
            const dbData = await dbRes.json();

            let currentAllowedComps: string[] = [];
            if (dbData && dbData.meta && Array.isArray(dbData.meta.allowedCompanies)) {
                currentAllowedComps = dbData.meta.allowedCompanies;
                setAllowedCompanies(currentAllowedComps);
            }

            // Fetch main system settings to dynamically compute defaults based on active fiscal year if there's no saved config
            let activeYearLabel = "1405"; // Default fallback
            try {
                const settingsRes = await fetch('/api/settings');
                const settingsData = await settingsRes.json();
                if (settingsData) {
                    if (settingsData.warehouseTelegramGroupId) setWarehouseTelegramGroupId(settingsData.warehouseTelegramGroupId);
                    if (settingsData.warehouseBaleGroupId) setWarehouseBaleGroupId(settingsData.warehouseBaleGroupId);
                    if (settingsData.warehouseWhatsappGroupId) setWarehouseWhatsappGroupId(settingsData.warehouseWhatsappGroupId);
                    
                    if (settingsData.fiscalYears && settingsData.activeFiscalYearId) {
                        const activeYearObj = settingsData.fiscalYears.find((y: any) => y.id === settingsData.activeFiscalYearId);
                        if (activeYearObj && activeYearObj.label) {
                            activeYearLabel = activeYearObj.label;
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to fetch settings for active fiscal year", e);
            }

            // Dynamic defaults based on system's active fiscal year
            let r1Date = '2025-03-20'; // Default for 1403
            let r2Date = '2026-08-22'; // Default for 1405 (actual today date in 1405)

            if (activeYearLabel === "1405") {
                r1Date = '2026-03-20'; // 1404/12/29
                r2Date = '2026-08-22'; // 1405/05/31
                
                setReport1Label("منتهی به سال ۱۴۰۴");
                setReport1Jalali("۱۴۰۴/۱۲/۲۹");
                setReport1Miladi("2026-03-20");

                setReport2Label("وضعیت فعلی سال ۱۴۰۵");
                setReport2Jalali("۱۴۰۵/۰۵/۳۱");
                setReport2Miladi("2026-08-22");
                setReportDate("۱۴۰۵/۰۵/۳۱");
            } else if (activeYearLabel === "1404") {
                r1Date = '2025-03-20'; // 1403/12/30
                r2Date = '2025-11-13'; // 1404/08/22
                
                setReport1Label("منتهی به سال ۱۴۰۳");
                setReport1Jalali("۱۴۰۳/۱۲/۳۰");
                setReport1Miladi("2025-03-20");

                setReport2Label("وضعیت فعلی سال ۱۴۰۴");
                setReport2Jalali("۱۴۰۴/۰۸/۲۲");
                setReport2Miladi("2025-11-13");
                setReportDate("۱۴۰۴/۰۸/۲۲");
            } else {
                // Generalized mathematical solar-to-miladi mapping fallback for any active year
                const yr = parseInt(activeYearLabel) || 1404;
                const prevYr = yr - 1;
                const miladiYear = yr + 1121;
                
                r1Date = `${miladiYear - 1}-03-20`;
                r2Date = `${miladiYear}-08-22`;

                setReport1Label(`منتهی به سال ${prevYr.toLocaleString('fa-IR', {useGrouping: false})}`);
                setReport1Jalali(`${prevYr.toLocaleString('fa-IR', {useGrouping: false})}/۱۲/۲۹`);
                setReport1Miladi(`${miladiYear - 1}-03-20`);

                setReport2Label(`وضعیت فعلی سال ${yr.toLocaleString('fa-IR', {useGrouping: false})}`);
                setReport2Jalali(`${yr.toLocaleString('fa-IR', {useGrouping: false})}/۰۸/۲۲`);
                setReport2Miladi(`${miladiYear}-08-22`);
                setReportDate(`${yr.toLocaleString('fa-IR', {useGrouping: false})}/۰۸/۲۲`);
            }

            // Fetch trade records to dynamically compute commercial goods in transit, in customs, and purchased
            let tradeRecords: any[] = [];
            try {
                const tradeRes = await fetch('/api/trade');
                if (tradeRes.ok) {
                    tradeRecords = await tradeRes.json();
                }
            } catch (err) {
                console.error("Failed to fetch trade records", err);
            }

            rawTradeRecordsRef.current = tradeRecords;
            const uniqueComps = Array.from(new Set(tradeRecords.filter((r: any) => !r.isArchived).map((r: any) => r.company || 'بدون شرکت'))).sort();
            setAvailableCompanies(uniqueComps);

            if (dbData) {
                setLastYearOverrides(dbData.lastYearOverrides || {});
                setCurrentOverrides(dbData.currentOverrides || {});
                
                const loadedTransit: CustomCargoItem[] = (dbData.goodsInTransit || []).filter((x: any) => !x.id.startsWith('com_'));
                const loadedCustoms: CustomCargoItem[] = (dbData.goodsInCustoms || []).filter((x: any) => !x.id.startsWith('com_'));
                const loadedPurchase: CustomCargoItem[] = (dbData.purchasingGoods || []).filter((x: any) => !x.id.startsWith('com_'));

                baseTransitRef.current = loadedTransit;
                baseCustomsRef.current = loadedCustoms;
                basePurchaseRef.current = loadedPurchase;

                applyCommercialFilterAndMerge(tradeRecords, currentAllowedComps, loadedTransit, loadedCustoms, loadedPurchase);

                setCommercialGoods(dbData.commercialGoods || []);
                setItemCategories(dbData.itemCategories || {});
                
                if (dbData.meta) {
                    if (dbData.meta.reportDate) setReportDate(dbData.meta.reportDate);
                    if (dbData.meta.signature) setSignature(dbData.meta.signature);
                    
                    if (dbData.meta.report1Label) setReport1Label(dbData.meta.report1Label);
                    if (dbData.meta.report1Jalali) setReport1Jalali(dbData.meta.report1Jalali);
                    if (dbData.meta.report1Miladi) {
                        setReport1Miladi(dbData.meta.report1Miladi);
                        r1Date = dbData.meta.report1Miladi;
                    }
                    
                    if (dbData.meta.report2Label) setReport2Label(dbData.meta.report2Label);
                    if (dbData.meta.report2Jalali) setReport2Jalali(dbData.meta.report2Jalali);
                    if (dbData.meta.report2Miladi) {
                        setReport2Miladi(dbData.meta.report2Miladi);
                        r2Date = dbData.meta.report2Miladi;
                    }

                    if (dbData.meta.cumulativeFromLastYear !== undefined) {
                        setCumulativeFromLastYear(dbData.meta.cumulativeFromLastYear);
                    }
                    if (Array.isArray(dbData.meta.allowedCompanies)) {
                        setAllowedCompanies(dbData.meta.allowedCompanies);
                    }
                }
            } else {
                applyCommercialFilterAndMerge(tradeRecords, currentAllowedComps, [], [], []);
            }

            // 2. Fetch Sayan Live stock with correct dates
            const finalR1Jalali = dbData?.meta?.report1Jalali || (activeYearLabel === "1405" ? "۱۴۰۴/۱۲/۲۹" : "۱۴۰۳/۱۲/۳۰");
            const finalR2Jalali = dbData?.meta?.report2Jalali || (activeYearLabel === "1405" ? "۱۴۰۵/۰۵/۳۱" : "۱۴۰۴/۰۸/۲۲");
            const finalCumulative = dbData?.meta?.cumulativeFromLastYear !== undefined ? dbData.meta.cumulativeFromLastYear : true;

            await fetchSayanData(r1Date, r2Date, finalR1Jalali, finalR2Jalali, finalCumulative);
        } catch (err) {
            console.error("Failed to load warehouse overview data", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Helper to sync dates directly with system's active fiscal year inside settings
    const handleSyncWithActiveYear = async () => {
        setIsLoading(true);
        try {
            const settingsRes = await fetch('/api/settings');
            const settingsData = await settingsRes.json();
            let activeYearLabel = "1405";
            if (settingsData && settingsData.fiscalYears && settingsData.activeFiscalYearId) {
                const activeYearObj = settingsData.fiscalYears.find((y: any) => y.id === settingsData.activeFiscalYearId);
                if (activeYearObj && activeYearObj.label) {
                    activeYearLabel = activeYearObj.label;
                }
            }

            if (activeYearLabel === "1405") {
                setReport1Label("منتهی به سال ۱۴۰۴");
                setReport1Jalali("۱۴۰۴/۱۲/۲۹");
                setReport1Miladi("2026-03-20");

                setReport2Label("وضعیت فعلی سال ۱۴۰۵");
                setReport2Jalali("۱۴۰۵/۰۵/۳۱");
                setReport2Miladi("2026-08-22");
                setReportDate("۱۴۰۵/۰۵/۳۱");
            } else if (activeYearLabel === "1404") {
                setReport1Label("منتهی به سال ۱۴۰۳");
                setReport1Jalali("۱۴۰۳/۱۲/۳۰");
                setReport1Miladi("2025-03-20");

                setReport2Label("وضعیت فعلی سال ۱۴۰۴");
                setReport2Jalali("۱۴۰۴/۰۸/۲۲");
                setReport2Miladi("2025-11-13");
                setReportDate("۱۴۰۴/۰۸/۲۲");
            } else {
                // Generalized mathematical solar-to-miladi mapping fallback for any active year
                const yr = parseInt(activeYearLabel) || 1404;
                const prevYr = yr - 1;
                const miladiYear = yr + 1121;
                
                setReport1Label(`منتهی به سال ${prevYr.toLocaleString('fa-IR', {useGrouping: false})}`);
                setReport1Jalali(`${prevYr.toLocaleString('fa-IR', {useGrouping: false})}/۱۲/۲۹`);
                setReport1Miladi(`${miladiYear - 1}-03-20`);

                setReport2Label(`وضعیت فعلی سال ${yr.toLocaleString('fa-IR', {useGrouping: false})}`);
                setReport2Jalali(`${yr.toLocaleString('fa-IR', {useGrouping: false})}/۰۸/۲۲`);
                setReport2Miladi(`${miladiYear}-08-22`);
                setReportDate(`${yr.toLocaleString('fa-IR', {useGrouping: false})}/۰۸/۲۲`);
            }
            alert(`تاریخ‌ها بر اساس سال مالی فعال سیستم (${activeYearLabel}) بازنشانی شدند. جهت ذخیره به عنوان پیش‌فرض دائم، دکمه «ثبت دائم و استعلام جدید» را بزنید.`);
        } catch (err) {
            console.error("Failed to sync with active year", err);
            alert("خطا در همگام‌سازی با سال مالی فعال سیستم.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async (silent = false) => {
        setIsSaving(true);
        try {
            const totalNegativeWeight = negativeItems.reduce((sum, item) => sum + item.diffWeight, 0);
            const totalPositiveWeight = growthItems.reduce((sum, item) => sum + item.diffWeight, 0);

            const payload = {
                lastYearOverrides,
                currentOverrides,
                goodsInTransit: goodsInTransit.filter(r => !r.id.startsWith('com_')),
                goodsInCustoms: goodsInCustoms.filter(r => !r.id.startsWith('com_')),
                purchasingGoods: purchasingGoods.filter(r => !r.id.startsWith('com_')),
                commercialGoods,
                itemCategories,
                meta: {
                    reportDate,
                    signature,
                    report1Label,
                    report1Jalali,
                    report1Miladi,
                    report2Label,
                    report2Jalali,
                    report2Miladi,
                    cumulativeFromLastYear,
                    allowedCompanies,
                    totalCurrentAllWeight,
                    diffAllWeight,
                    ratioAllWeight,
                    totalCurrentYarnsWeight,
                    totalLastYearYarnsWeight,
                    totalCurrentRawWeight,
                    totalLastYearRawWeight,
                    totalNegativeWeight,
                    totalPositiveWeight
                }
            };

            const res = await fetch('/api/warehouse-overview/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                if (!silent) {
                    setIsEditMode(false);
                    alert("تغییرات با موفقیت ذخیره شد.");
                }
            } else {
                if (!silent) alert("خطا در ذخیره تغییرات روی سرور.");
            }
        } catch (err) {
            console.error(err);
            if (!silent) alert("خطا در ذخیره اطلاعات.");
        } finally {
            setIsSaving(false);
        }
    };

    // Apply custom dates and trigger fresh data query from Sayan
    const handleApplySettingsAndFetch = async () => {
        setIsLoading(true);
        try {
            // Save bot group settings to main system settings
            try {
                const settingsRes = await fetch('/api/settings');
                const existingSettings = await settingsRes.json();
                await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...existingSettings,
                        warehouseTelegramGroupId,
                        warehouseBaleGroupId,
                        warehouseWhatsappGroupId
                    })
                });
            } catch (e) {
                console.error("Failed to update bot group settings", e);
            }

            // First save overrides and config
            await handleSave(true);

            // Refetch live stock with newly updated Miladi dates & cumulative configurations
            await fetchSayanData(report1Miladi, report2Miladi, report1Jalali, report2Jalali, cumulativeFromLastYear);
            
            setShowSettings(false);
            alert("تنظیمات با موفقیت ذخیره شد و به عنوان پیش‌فرض دائم گزارش ثبت گردید.");
        } catch (err) {
            console.error("Failed to refetch Sayan data", err);
            alert("خطا در استعلام اطلاعات جدید از سایان.");
        } finally {
            setIsLoading(false);
        }
    };

    // Sayan Group definitions (predefined 4-digit prefixes exactly matching Sayan ERP)
    const MANUFACTURED_GROUPS = [
        { code: '0401', name: 'اسپاندکس (کاور)' },
        { code: '0402', name: 'کش' },
        { code: '0403', name: 'اسپاندکس جوشی ( ساپورت )' },
        { code: '0405', name: 'پلی استر شوایتر' },
        { code: '0407', name: 'نایلون' },
        { code: '0408', name: 'نخ ملت' },
        { code: '0409', name: 'الیاف' },
        { code: '0410', name: 'FDY' }
    ];

    const RAW_MATERIAL_GROUPS = [
        { code: '0101', name: 'چیپس' },
        { code: '0102', name: 'POY' },
        { code: '0103', name: 'dty یا پلی استر' },
        { code: '0104', name: 'لاستیک' },
        { code: '0105', name: 'لاکرا' },
        { code: '0106', name: 'پلی استر اسپان' },
        { code: '0107', name: 'مستر بچ' },
        { code: '0108', name: 'نایلون' }
    ];

    // Helper function to classify Sayan items based on keywords and database group name
    const classifyItem = (r: any): 'lycra' | 'spun' | 'rubber' | 'melt' | 'nylon' | 'chips' | 'oil' | 'yarn' => {
        const code = String(r.itemCode || r.ItemCode || '');
        if (code.startsWith('04')) {
            return 'yarn';
        }
        if (code.startsWith('0104')) {
            return 'rubber';
        }
        if (code.startsWith('0105')) {
            return 'lycra';
        }
        if (code.startsWith('0106')) {
            return 'spun';
        }
        if (code.startsWith('0101')) {
            return 'chips';
        }

        const name = String(r.itemName || '').toLowerCase();
        const grp = String(r.groupName || '').toLowerCase();

        if (name.includes('لاکرا') || name.includes('اسپاندکس') || grp.includes('لاکرا') || grp.includes('اسپاندکس') || name.includes('spandex') || name.includes('lycra')) {
            return 'lycra';
        }
        if (name.includes('اسپان') || grp.includes('اسپان') || name.includes('spunbond') || name.includes('spun')) {
            return 'spun';
        }
        if (name.includes('لاستیک') || name.includes('الستیک') || grp.includes('لاستیک') || grp.includes('الستیک') || name.includes('rubber') || name.includes('elastic')) {
            return 'rubber';
        }
        if (name.includes('ملت') || grp.includes('ملت') || name.includes('meltblown') || name.includes('melt')) {
            return 'melt';
        }
        if (name.includes('نایلون') || grp.includes('نایلون') || name.includes('nylon')) {
            return 'nylon';
        }
        if (name.includes('چیپس') || grp.includes('چیپس') || name.includes('chips')) {
            return 'chips';
        }
        if (name.includes('روغن') || grp.includes('روغن') || name.includes('oil')) {
            return 'oil';
        }

        return 'yarn';
    };

    // Helper function to get all groups for a section dynamically, falling back to discovered ones if not predefined
    const getSectionGroups = (isProduction: boolean, predefinedGroups: { code: string; name: string }[]) => {
        const set = new Set<string>();
        predefinedGroups.forEach(g => set.add(g.code));

        const otherPredefined = isProduction ? RAW_MATERIAL_GROUPS : MANUFACTURED_GROUPS;
        const otherPredefinedCodes = new Set(otherPredefined.map(g => g.code));

        const matchesSection = (code: string) => {
            const prefix4 = code.substring(0, 4);
            if (set.has(prefix4)) return true;
            if (otherPredefinedCodes.has(prefix4)) return false;
            if (isProduction) {
                return code.startsWith('04');
            } else {
                return code.startsWith('01');
            }
        };

        sayanLastYear.forEach(r => {
            const code = String(r.itemCode || r.ItemCode || '');
            if (code.length >= 4 && matchesSection(code)) {
                set.add(code.substring(0, 4));
            }
        });
        sayanCurrent.forEach(r => {
            const code = String(r.itemCode || r.ItemCode || '');
            if (code.length >= 4 && matchesSection(code)) {
                set.add(code.substring(0, 4));
            }
        });

        const list = Array.from(set).map(prefix => {
            const predefined = predefinedGroups.find(g => g.code === prefix);
            if (predefined) return predefined;

            let discoveredName = '';
            const found = [...sayanCurrent, ...sayanLastYear].find(r => {
                const c = String(r.itemCode || r.ItemCode || '');
                return c.startsWith(prefix) && (r.groupName || r.itemName);
            });
            if (found) {
                discoveredName = found.groupName || found.itemName || '';
            }
            return {
                code: prefix,
                name: discoveredName || `گروه ${prefix}`
            };
        });

        return list.sort((a, b) => a.code.localeCompare(b.code));
    };

    // Helper function to get all child items of a group prefix across both periods
    const getGroupChildItems = (groupCode: string) => {
        const map: Record<string, { itemName: string; itemCode: string }> = {};
        sayanLastYear.forEach(r => {
            const code = String(r.itemCode || r.ItemCode || '');
            if (code.startsWith(groupCode)) {
                const name = r.itemName || code || 'کالای بدون نام';
                map[code] = { itemName: name, itemCode: code };
            }
        });
        sayanCurrent.forEach(r => {
            const code = String(r.itemCode || r.ItemCode || '');
            if (code.startsWith(groupCode)) {
                const name = r.itemName || code || 'کالای بدون نام';
                map[code] = { itemName: name, itemCode: code };
            }
        });
        return Object.values(map).sort((a, b) => a.itemName.localeCompare(b.itemName));
    };

    const toggleGroup = (groupCode: string) => {
        setExpandedGroups(prev => ({
            ...prev,
            [groupCode]: !prev[groupCode]
        }));
    };

    const getCategoryPersianLabel = (cat: string) => {
        switch (cat) {
            case 'lycra': return 'نخ لاکرا و اسپاندکس';
            case 'spun': return 'اسپان باند';
            case 'rubber': return 'لاستیک و کش';
            case 'melt': return 'ملت بلون';
            case 'nylon': return 'نایلون وارداتی';
            case 'chips': return 'چیپس پلیمر (پتروشیمی)';
            case 'oil': return 'روغن‌های کمکی و ریسندگی';
            default: return 'سایر اقلام انبار';
        }
    };

    // Aligned list of Manufactured Yarn Groups (Starting with 04 by default, plus DTY)
    const alignedYarns = useMemo(() => {
        const groups = getSectionGroups(true, MANUFACTURED_GROUPS);
        return groups.filter(g => itemCategories[g.code] !== 'other');
    }, [sayanLastYear, sayanCurrent, itemCategories]);

    // Aligned list of Raw Material Groups (Starting with 01 by default, plus FDY, الیاف, نخ ملت)
    const alignedImported = useMemo(() => {
        const groups = getSectionGroups(false, RAW_MATERIAL_GROUPS);
        return groups.filter(g => itemCategories[g.code] !== 'other');
    }, [sayanLastYear, sayanCurrent, itemCategories]);

    // Filters based on search input
    const filteredYarns = useMemo(() => {
        if (!itemFilterText.trim()) return alignedYarns;
        const search = itemFilterText.trim().toLowerCase();
        return alignedYarns.filter(g => 
            g.name.toLowerCase().includes(search) || 
            g.code.toLowerCase().includes(search)
        );
    }, [alignedYarns, itemFilterText]);

    const filteredImported = useMemo(() => {
        if (!itemFilterText.trim()) return alignedImported;
        const search = itemFilterText.trim().toLowerCase();
        return alignedImported.filter(g => 
            g.name.toLowerCase().includes(search) || 
            g.code.toLowerCase().includes(search)
        );
    }, [alignedImported, itemFilterText]);

    // Retrieve Sayan direct stock quantities for yarn groups or individual items
    const getSayanGroupSum = (groupCode: string, isLastYear: boolean, field: 'weight' | 'cartons'): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        return list.reduce((sum, r) => {
            const code = String(r.itemCode || r.ItemCode || '');
            if (code.startsWith(groupCode)) {
                const qty = field === 'weight' ? (r.stockQty || 0) : (r.cartonsQty || 0);
                return sum + qty;
            }
            return sum;
        }, 0);
    };

    const getSayanItemValue = (itemCode: string, isLastYear: boolean, field: 'weight' | 'cartons'): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        const found = list.find(r => String(r.itemCode || r.ItemCode || '') === itemCode);
        if (found) {
            return field === 'weight' ? (found.stockQty || 0) : (found.cartonsQty || 0);
        }
        return 0;
    };

    // Smart value getter supporting local overrides with Sayan database fallback
    const getItemValue = (
        itemKey: string, 
        isLastYear: boolean, 
        field: 'proforma' | 'cartons' | 'weight' | 'containers' | 'dollars',
        isGroup = false
    ): any => {
        const overrides = isLastYear ? lastYearOverrides : currentOverrides;
        
        let itemOverride = overrides[itemKey];
        if (!itemOverride) {
            // Backward compatibility: check if there's an override under the item's Persian name
            const allItems = [...sayanLastYear, ...sayanCurrent];
            const foundItem = allItems.find(r => String(r.itemCode || r.ItemCode || '') === itemKey);
            if (foundItem && foundItem.itemName) {
                itemOverride = overrides[foundItem.itemName];
            }
        }

        if (itemOverride && itemOverride[field] !== undefined && itemOverride[field] !== '') {
            return itemOverride[field];
        }

        // Sayan fallback for weight and cartons
        if (field === 'weight' || field === 'cartons') {
            if (isGroup) {
                return getSayanGroupSum(itemKey, isLastYear, field);
            } else {
                return getSayanItemValue(itemKey, isLastYear, field);
            }
        }

        // Defaults
        if (field === 'proforma') return '';
        return 0;
    };

    // Helper to update override values in state
    const handleCellChange = (itemName: string, isLastYear: boolean, field: string, value: any) => {
        const setOverrides = isLastYear ? setLastYearOverrides : setCurrentOverrides;
        const overrides = isLastYear ? lastYearOverrides : currentOverrides;

        const val = (field === 'proforma') ? value : parseFloat(value || '0');

        setOverrides({
            ...overrides,
            [itemName]: {
                ...(overrides[itemName] || {}),
                [field]: val
            }
        });
    };

    const handleCategoryChange = (itemName: string, category: 'raw' | 'factory' | 'other') => {
        setItemCategories(prev => ({
            ...prev,
            [itemName]: category
        }));
    };

    // Calculate sum of custom tables
    const calculateCustomTableSum = (list: any[], field: string) => {
        return list.reduce((sum, item) => sum + (parseFloat(item[field]) || 0), 0);
    };

    // Support getting custom category overrides
    const getItemCategory = (itemName: string): 'raw' | 'factory' | 'other' => {
        if (itemCategories[itemName]) {
            return itemCategories[itemName];
        }
        return 'raw'; // Default is active/visible
    };

    // Backward compatibility variables for total calculations
    const allActiveRawItems = alignedImported;
    const allActiveFactoryItems = alignedYarns;

    const calculateTotalSayanSum = (isLastYear: boolean, field: 'cartons' | 'weight' | 'containers' | 'dollars') => {
        const sumYarns = alignedYarns.reduce((sum, item) => sum + getItemValue(item.code, isLastYear, field, true), 0);
        const sumImported = alignedImported.reduce((sum, item) => sum + getItemValue(item.code, isLastYear, field, true), 0);
        return sumYarns + sumImported;
    };

    // Total calculations using grouped yarns + detail imported
    const totalLastYearContainers = useMemo(() => {
        const bg = calculateTotalSayanSum(true, 'containers');
        const transit = calculateCustomTableSum(goodsInTransit, 'container');
        const customs = calculateCustomTableSum(goodsInCustoms, 'container');
        const purchase = calculateCustomTableSum(purchasingGoods, 'container');
        return bg + transit + customs + purchase;
    }, [goodsInTransit, goodsInCustoms, purchasingGoods, lastYearOverrides, alignedYarns, alignedImported]);

    const totalCurrentContainers = useMemo(() => {
        const bg = calculateTotalSayanSum(false, 'containers');
        const transit = calculateCustomTableSum(goodsInTransit, 'container');
        const customs = calculateCustomTableSum(goodsInCustoms, 'container');
        const purchase = calculateCustomTableSum(purchasingGoods, 'container');
        return bg + transit + customs + purchase;
    }, [goodsInTransit, goodsInCustoms, purchasingGoods, currentOverrides, alignedYarns, alignedImported]);

    const totalLastYearDollars = useMemo(() => {
        const bg = calculateTotalSayanSum(true, 'dollars');
        const transit = calculateCustomTableSum(goodsInTransit, 'dollars');
        const customs = calculateCustomTableSum(goodsInCustoms, 'dollars');
        const purchase = calculateCustomTableSum(purchasingGoods, 'dollars');
        return bg + transit + customs + purchase;
    }, [goodsInTransit, goodsInCustoms, purchasingGoods, lastYearOverrides, alignedYarns, alignedImported]);

    const totalCurrentDollars = useMemo(() => {
        const bg = calculateTotalSayanSum(false, 'dollars');
        const transit = calculateCustomTableSum(goodsInTransit, 'dollars');
        const customs = calculateCustomTableSum(goodsInCustoms, 'dollars');
        const purchase = calculateCustomTableSum(purchasingGoods, 'dollars');
        return bg + transit + customs + purchase;
    }, [goodsInTransit, goodsInCustoms, purchasingGoods, currentOverrides, alignedYarns, alignedImported]);

    // Difference and ratio formulas matching the PDF
    const diffContainers = totalCurrentContainers - totalLastYearContainers;
    const ratioContainers = totalLastYearContainers > 0 ? (diffContainers / totalLastYearContainers) * 100 : 0;

    const diffDollars = totalCurrentDollars - totalLastYearDollars;
    const ratioDollars = totalLastYearDollars > 0 ? (diffDollars / totalLastYearDollars) * 100 : 0;

    const isDownwardTrend = diffContainers < 0;

    // TOTAL WEIGHTS COMPARISON CALCULATIONS (مجموعه مقایسه‌های جامع وزنی)
    // 1. Factory Manufactured Yarns (نخ‌های تولیدی کارخانه)
    const totalLastYearYarnsWeight = useMemo(() => {
        return alignedYarns.reduce((sum, item) => sum + getItemValue(item.code, true, 'weight', true), 0);
    }, [alignedYarns, lastYearOverrides, sayanLastYear]);

    const totalCurrentYarnsWeight = useMemo(() => {
        return alignedYarns.reduce((sum, item) => sum + getItemValue(item.code, false, 'weight', true), 0);
    }, [alignedYarns, currentOverrides, sayanCurrent]);

    const diffYarnsWeight = totalCurrentYarnsWeight - totalLastYearYarnsWeight;
    const ratioYarnsWeight = totalLastYearYarnsWeight > 0 ? (diffYarnsWeight / totalLastYearYarnsWeight) * 100 : 0;
    const isYarnsDownward = diffYarnsWeight < 0;

    // 2. Raw Materials & Imported Goods (مواد اولیه و واردات شامل انبار + گمرک + ترانزیت + خرید)
    const totalLastYearRawWeight = useMemo(() => {
        const bg = alignedImported.reduce((sum, item) => sum + getItemValue(item.code, true, 'weight', true), 0);
        const transit = calculateCustomTableSum(goodsInTransit, 'weight');
        const customs = calculateCustomTableSum(goodsInCustoms, 'weight');
        const purchase = calculateCustomTableSum(purchasingGoods, 'weight');
        return bg + transit + customs + purchase;
    }, [alignedImported, goodsInTransit, goodsInCustoms, purchasingGoods, lastYearOverrides, sayanLastYear]);

    const totalCurrentRawWeight = useMemo(() => {
        const bg = alignedImported.reduce((sum, item) => sum + getItemValue(item.code, false, 'weight', true), 0);
        const transit = calculateCustomTableSum(goodsInTransit, 'weight');
        const customs = calculateCustomTableSum(goodsInCustoms, 'weight');
        const purchase = calculateCustomTableSum(purchasingGoods, 'weight');
        return bg + transit + customs + purchase;
    }, [alignedImported, goodsInTransit, goodsInCustoms, purchasingGoods, currentOverrides, sayanCurrent]);

    const diffRawWeight = totalCurrentRawWeight - totalLastYearRawWeight;
    const ratioRawWeight = totalLastYearRawWeight > 0 ? (diffRawWeight / totalLastYearRawWeight) * 100 : 0;
    const isRawDownward = diffRawWeight < 0;

    // 3. Total Enterprise Inventory & Inflow (سرجمع کل زنجیره تامین و انبار)
    const totalLastYearAllWeight = totalLastYearYarnsWeight + totalLastYearRawWeight;
    const totalCurrentAllWeight = totalCurrentYarnsWeight + totalCurrentRawWeight;
    const diffAllWeight = totalCurrentAllWeight - totalLastYearAllWeight;
    const ratioAllWeight = totalLastYearAllWeight > 0 ? (diffAllWeight / totalLastYearAllWeight) * 100 : 0;
    const isAllWeightDownward = diffAllWeight < 0;

    // 4. Comparative matrix of all items (and detection of negative items)
    const allComparedItems = useMemo(() => {
        const list: Array<{
            code: string;
            name: string;
            category: 'factory' | 'raw';
            categoryLabel: string;
            lastYearWeight: number;
            currentWeight: number;
            diffWeight: number;
            ratio: number;
            isNegative: boolean;
        }> = [];

        // Add Yarns (Factory Production)
        alignedYarns.forEach(group => {
            const wLast = getItemValue(group.code, true, 'weight', true);
            const wCurr = getItemValue(group.code, false, 'weight', true);
            const diff = wCurr - wLast;
            const ratio = wLast > 0 ? (diff / wLast) * 100 : (wCurr < 0 ? -100 : 0);
            list.push({
                code: group.code,
                name: group.name,
                category: 'factory',
                categoryLabel: 'تولیدی کارخانه',
                lastYearWeight: wLast,
                currentWeight: wCurr,
                diffWeight: diff,
                ratio,
                isNegative: diff < 0 || wCurr < 0
            });
        });

        // Add Raw Materials & Imports
        alignedImported.forEach(group => {
            const wLast = getItemValue(group.code, true, 'weight', true);
            const wCurr = getItemValue(group.code, false, 'weight', true);
            const diff = wCurr - wLast;
            const ratio = wLast > 0 ? (diff / wLast) * 100 : (wCurr < 0 ? -100 : 0);
            list.push({
                code: group.code,
                name: group.name,
                category: 'raw',
                categoryLabel: 'مواد اولیه / وارداتی',
                lastYearWeight: wLast,
                currentWeight: wCurr,
                diffWeight: diff,
                ratio,
                isNegative: diff < 0 || wCurr < 0
            });
        });

        return list;
    }, [alignedYarns, alignedImported, lastYearOverrides, currentOverrides, sayanLastYear, sayanCurrent]);

    // Negative Items (کالاهای منفی / دارای کاهش وزنی یا موجودی منفی)
    const negativeItems = useMemo(() => {
        return allComparedItems
            .filter(item => item.isNegative)
            .sort((a, b) => a.diffWeight - b.diffWeight); // sorted by largest negative deficit first
    }, [allComparedItems]);

    // Growth Items (کالاهای دارای رشد وزنی مثبت)
    const growthItems = useMemo(() => {
        return allComparedItems
            .filter(item => !item.isNegative && item.diffWeight > 0)
            .sort((a, b) => b.diffWeight - a.diffWeight); // sorted by highest positive growth first
    }, [allComparedItems]);

    // Filtered variance items for table display
    const filteredVarianceItems = useMemo(() => {
        if (varianceFilter === 'negative') return allComparedItems.filter(item => item.isNegative);
        if (varianceFilter === 'positive') return allComparedItems.filter(item => !item.isNegative);
        return allComparedItems;
    }, [allComparedItems, varianceFilter]);

    // Structured Dataset Extractor for PDF and Bot Dispatch
    const getExportDataset = () => {
        const yarnItems = filteredYarns.map(g => ({
            code: g.code,
            name: g.name,
            lastYearCartons: getItemValue(g.code, true, 'cartons', true),
            lastYearWeight: getItemValue(g.code, true, 'weight', true),
            lastYearContainers: getItemValue(g.code, true, 'containers', true),
            lastYearDollars: getItemValue(g.code, true, 'dollars', true),
            currentCartons: getItemValue(g.code, false, 'cartons', true),
            currentWeight: getItemValue(g.code, false, 'weight', true),
            currentContainers: getItemValue(g.code, false, 'containers', true),
            currentDollars: getItemValue(g.code, false, 'dollars', true)
        }));

        const rawItems = filteredImported.map(g => ({
            code: g.code,
            name: g.name,
            category: getItemCategory(g.code),
            proforma: getItemValue(g.code, false, 'proforma', true) || getItemValue(g.code, true, 'proforma', true),
            lastYearCartons: getItemValue(g.code, true, 'cartons', true),
            lastYearWeight: getItemValue(g.code, true, 'weight', true),
            lastYearContainers: getItemValue(g.code, true, 'containers', true),
            lastYearDollars: getItemValue(g.code, true, 'dollars', true),
            currentCartons: getItemValue(g.code, false, 'cartons', true),
            currentWeight: getItemValue(g.code, false, 'weight', true),
            currentContainers: getItemValue(g.code, false, 'containers', true),
            currentDollars: getItemValue(g.code, false, 'dollars', true)
        }));

        const logisticsItems = [
            ...goodsInTransit.map(r => ({ ...r, category: 'transit', categoryLabel: 'بارهای در راه (کانتینری)' })),
            ...goodsInCustoms.map(r => ({ ...r, category: 'customs', categoryLabel: 'بارهای در گمرک' })),
            ...purchasingGoods.map(r => ({ ...r, category: 'purchasing', categoryLabel: 'بارهای در حال خرید' })),
            ...commercialGoods.map(r => ({ ...r, category: 'commercial', categoryLabel: 'کالای تجاری / متفرقه' }))
        ];

        const summary = {
            reportDate,
            report1Label,
            report2Label,
            signature,
            lastYearYarnsWeight: totalLastYearYarnsWeight,
            currentYarnsWeight: totalCurrentYarnsWeight,
            yarnsDiffWeight: diffYarnsWeight,
            yarnsRatio: ratioYarnsWeight,
            lastYearRawWeight: totalLastYearRawWeight,
            currentRawWeight: totalCurrentRawWeight,
            rawDiffWeight: diffRawWeight,
            rawRatio: ratioRawWeight,
            lastYearTotalWeight: totalLastYearAllWeight,
            currentTotalWeight: totalCurrentAllWeight,
            totalDiffWeight: diffAllWeight,
            totalRatio: ratioAllWeight,
            containersTotal: totalCurrentContainers,
            dollarsTotal: totalCurrentDollars
        };

        return {
            summary,
            yarnItems,
            rawItems,
            logisticsItems,
            growthItems,
            negativeItems,
            signature
        };
    };

    // Direct Browser Print function (100% reliable, opens native print/PDF dialog)
    const handlePrintReport = (scope: 'both' | 'overview_only' | 'variance_only' = 'both') => {
        setPdfScopeMenuOpen(false);
        try {
            const data = getExportDataset();
            const html = buildWarehouseOverviewPrintHtml(data, scope);

            // Create dedicated invisible iframe for isolated printing
            const printFrame = document.createElement('iframe');
            printFrame.style.position = 'fixed';
            printFrame.style.right = '0';
            printFrame.style.bottom = '0';
            printFrame.style.width = '0px';
            printFrame.style.height = '0px';
            printFrame.style.border = '0';
            document.body.appendChild(printFrame);

            const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
            if (!frameDoc) {
                throw new Error('امکان دسترسی به پنجره چاپ مرورگر وجود ندارد');
            }

            frameDoc.open();
            frameDoc.write(html);
            frameDoc.close();

            setTimeout(() => {
                try {
                    if (printFrame.contentWindow) {
                        printFrame.contentWindow.focus();
                        printFrame.contentWindow.print();
                    }
                } catch (printErr: any) {
                    console.error('Frame print failed, opening print window:', printErr);
                    const win = window.open('', '_blank');
                    if (win) {
                        win.document.write(html);
                        win.document.close();
                        win.focus();
                        win.print();
                    }
                } finally {
                    setTimeout(() => {
                        if (document.body.contains(printFrame)) {
                            document.body.removeChild(printFrame);
                        }
                    }, 4000);
                }
            }, 600);
        } catch (err: any) {
            console.error('Print generation error:', err);
            alert('خطا در آماده‌سازی پیش‌نمایش چاپ: ' + (err.message || ''));
        }
    };

    // PDF Download function (Server-side with direct browser PDF/Print fallback)
    const handleDownloadPdf = async (scope: 'both' | 'overview_only' | 'variance_only' = 'both') => {
        setIsDownloadingPdf(true);
        setPdfScopeMenuOpen(false);
        try {
            const data = getExportDataset();
            const payload = {
                ...data,
                mode: scope
            };

            const res = await fetch('/api/warehouse-overview/generate-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `پاسخ ناموفق سرور (${res.status})`);
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const scopeSuffix = scope === 'both' ? 'Full_2Pages' : (scope === 'overview_only' ? 'Page1_Overview' : 'Page2_Variance');
            a.download = `Warehouse_Overview_${reportDate.replace(/[\/\\]/g, '-')}_${scopeSuffix}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            console.warn("Server PDF error, opening browser print/save:", err);
            const userChoice = confirm(
                `دریافت فایل PDF از سرور با خطا مواجه شد:\n(${err.message || 'پاسخ ناموفق'})\n\nآیا مایلید پنجره چاپ و ذخیره مستقیم PDF مرورگر برای شما باز شود؟`
            );
            if (userChoice) {
                handlePrintReport(scope);
            }
        } finally {
            setIsDownloadingPdf(false);
        }
    };

    // Bot dispatch function
    const handleSendNegativeAlert = async () => {
        setIsSendingBot(true);
        setBotSendSuccessMessage(null);
        setBotSendErrorMessage(null);
        try {
            let targetGroup = null;
            if (botDestinationType === 'custom' && customTargetId.trim()) {
                targetGroup = customTargetId.trim();
            }

            const data = getExportDataset();
            const payload = {
                ...data,
                mode: botReportScope,
                sendFormat: botSendFormat,
                notifyInApp: botNotifyInApp,
                targetGroup,
                platforms: selectedPlatforms
            };

            const res = await fetch('/api/warehouse-overview/send-negative-alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const respData = await res.json();
            if (res.ok && respData.success) {
                const scopeLabel = botReportScope === 'both' ? 'جامع ۲ صفحه‌ای' : (botReportScope === 'overview_only' ? 'صفحه ۱ (جداول کل)' : 'صفحه ۲ (تحلیل روند و کسری)');
                const formatLabel = botSendFormat === 'pdf_and_caption' ? 'PDF رسمی + خلاصه متنی' : (botSendFormat === 'pdf_only' ? 'فایل PDF' : 'پیام متنی');
                setBotSendSuccessMessage(`✅ گزارش (${scopeLabel} با فرمت ${formatLabel}) با موفقیت به ${respData.sentCount || 1} گروه ارسال شد${botNotifyInApp ? ' و نوتیفیکیشن هشدار به مدیرعامل مخابره گردید.' : '.'}`);
            } else {
                setBotSendErrorMessage(respData.error || 'خطا در ارسال گزارش به ربات');
            }
        } catch (err: any) {
            setBotSendErrorMessage(err.message || 'خطا در برقراری ارتباط با سرور');
        } finally {
            setIsSendingBot(false);
        }
    };

    // Helper to render editable/static cell
    const renderCell = (itemName: string, isLastYear: boolean, field: 'proforma' | 'cartons' | 'weight' | 'containers' | 'dollars', format = 'number', isGroup = false) => {
        const val = getItemValue(itemName, isLastYear, field, isGroup);
        if (isEditMode) {
            return (
                <input 
                    type={format === 'number' ? 'number' : 'text'}
                    value={val}
                    onChange={(e) => handleCellChange(itemName, isLastYear, field, e.target.value)}
                    className="w-full text-center py-1 px-1 bg-blue-50 border border-blue-200 rounded text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none font-semibold"
                />
            );
        }

        if (format === 'dollar') {
            return val !== 0 ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '-';
        }
        if (format === 'number') {
            return val !== 0 ? val.toLocaleString('fa-IR', { maximumFractionDigits: 3 }) : '-';
        }
        return val || '-';
    };

    // CRUD custom tables helpers
    const addCustomRow = (type: 'transit' | 'customs' | 'purchase') => {
        const newRow: CustomCargoItem = {
            id: 'cargo_' + Date.now() + Math.random().toString(36).substr(2, 4),
            cargoType: 'نخ جدید',
            proforma: '',
            weight: 0,
            cartons: 0,
            container: 0,
            dollars: 0
        };
        if (type === 'transit') {
            const next = [...goodsInTransit, newRow];
            setGoodsInTransit(next);
            baseTransitRef.current = next.filter(r => !r.id.startsWith('com_'));
        }
        if (type === 'customs') {
            const next = [...goodsInCustoms, newRow];
            setGoodsInCustoms(next);
            baseCustomsRef.current = next.filter(r => !r.id.startsWith('com_'));
        }
        if (type === 'purchase') {
            const next = [...purchasingGoods, newRow];
            setPurchasingGoods(next);
            basePurchaseRef.current = next.filter(r => !r.id.startsWith('com_'));
        }
    };

    const deleteCustomRow = (type: 'transit' | 'customs' | 'purchase', id: string) => {
        if (type === 'transit') {
            const next = goodsInTransit.filter(r => r.id !== id);
            setGoodsInTransit(next);
            baseTransitRef.current = next.filter(r => !r.id.startsWith('com_'));
        }
        if (type === 'customs') {
            const next = goodsInCustoms.filter(r => r.id !== id);
            setGoodsInCustoms(next);
            baseCustomsRef.current = next.filter(r => !r.id.startsWith('com_'));
        }
        if (type === 'purchase') {
            const next = purchasingGoods.filter(r => r.id !== id);
            setPurchasingGoods(next);
            basePurchaseRef.current = next.filter(r => !r.id.startsWith('com_'));
        }
    };

    const updateCustomCell = (type: 'transit' | 'customs' | 'purchase', id: string, field: string, value: any) => {
        const list = type === 'transit' ? goodsInTransit : type === 'customs' ? goodsInCustoms : purchasingGoods;
        const next = list.map(r => r.id === id ? { ...r, [field]: field === 'cargoType' || field === 'proforma' ? value : parseFloat(value || '0') } : r);

        if (type === 'transit') {
            setGoodsInTransit(next);
            baseTransitRef.current = next.filter(r => !r.id.startsWith('com_'));
        }
        if (type === 'customs') {
            setGoodsInCustoms(next);
            baseCustomsRef.current = next.filter(r => !r.id.startsWith('com_'));
        }
        if (type === 'purchase') {
            setPurchasingGoods(next);
            basePurchaseRef.current = next.filter(r => !r.id.startsWith('com_'));
        }
    };

    // CRUD Commercial Warehouse Goods
    const addCommercialRow = () => {
        const newRow: CommercialGoodItem = {
            id: 'com_' + Date.now() + Math.random().toString(36).substr(2, 4),
            itemName: 'کالای تجاری جدید',
            category: 'منسوجات',
            cartons: 0,
            weight: 0,
            container: 0,
            dollars: 0
        };
        setCommercialGoods([...commercialGoods, newRow]);
    };

    const deleteCommercialRow = (id: string) => {
        setCommercialGoods(commercialGoods.filter(r => r.id !== id));
    };

    const updateCommercialCell = (id: string, field: string, value: any) => {
        setCommercialGoods(commercialGoods.map(r => r.id === id ? { ...r, [field]: field === 'itemName' || field === 'category' ? value : parseFloat(value || '0') } : r));
    };

    const renderTableBody = (isLastYear: boolean) => {
        return (
            <tbody className="divide-y divide-slate-100">
                {/* 1. MANUFACTURED GOODS */}
                <tr className="bg-slate-50 text-slate-700 font-extrabold text-right">
                    <td colSpan={7} className="py-2.5 px-3 text-[11px] text-blue-900 bg-blue-50/80 border-y border-blue-100/60 font-bold">
                        ۱. کالاهای تولیدی (ادغام شده در سطح گروه کالا)
                    </td>
                </tr>
                {filteredYarns.length === 0 ? (
                    <tr>
                        <td colSpan={7} className="py-4 text-center text-slate-400">موردی یافت نشد.</td>
                    </tr>
                ) : (
                    filteredYarns.map((group, idx) => {
                        const isExpanded = !!expandedGroups[group.code];
                        const childItems = getGroupChildItems(group.code);

                        return (
                            <React.Fragment key={`group-yarn-${isLastYear ? 'ly' : 'curr'}-${group.code}`}>
                                <tr className="hover:bg-slate-50 text-slate-700 border-b border-slate-100 transition-colors">
                                    <td 
                                        className="py-2.5 px-3 text-right font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors select-none"
                                        onClick={() => toggleGroup(group.code)}
                                    >
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-slate-100 transition-colors">
                                            {isExpanded ? (
                                                <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                                            ) : (
                                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                            )}
                                        </span>
                                        <span className="font-mono text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold mr-1">{group.code}</span>
                                        <span className="font-bold text-slate-900">{group.name}</span>
                                        <span className="text-[10px] text-slate-400 font-normal mr-1">({childItems.length} کالا)</span>
                                    </td>
                                    <td className="py-2 px-1">
                                        {isEditMode ? (
                                            <select
                                                value={getItemCategory(group.code)}
                                                onChange={(e) => handleCategoryChange(group.code, e.target.value as any)}
                                                className="text-[10px] p-1 border rounded bg-white text-slate-700 focus:outline-none"
                                            >
                                                <option value="raw">تولیدی (نمایش)</option>
                                                <option value="other">پنهان کردن</option>
                                            </select>
                                        ) : (
                                            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold">تولیدی</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-2">{renderCell(group.code, isLastYear, 'proforma', 'text', true)}</td>
                                    <td className="py-2 px-2 font-mono font-medium">{renderCell(group.code, isLastYear, 'cartons', 'number', true)}</td>
                                    <td className="py-2 px-2 font-mono font-bold text-slate-900">{renderCell(group.code, isLastYear, 'weight', 'number', true)}</td>
                                    <td className="py-2 px-2 font-mono font-medium">{renderCell(group.code, isLastYear, 'containers', 'number', true)}</td>
                                    <td className="py-2 px-2 font-mono font-bold text-emerald-600">{renderCell(group.code, isLastYear, 'dollars', 'dollar', true)}</td>
                                </tr>
                                
                                {isExpanded && childItems.map((child, cIdx) => (
                                    <tr 
                                        key={`child-yarn-${isLastYear ? 'ly' : 'curr'}-${group.code}-${child.itemCode}`} 
                                        className="bg-slate-50/40 hover:bg-slate-100/60 transition-colors text-slate-600 text-[11px] border-b border-dashed border-slate-100/80"
                                    >
                                        <td className="py-2 px-3 pr-8 text-right font-normal text-slate-700 flex items-center gap-1.5">
                                            <span className="text-slate-300 font-bold select-none">↳</span>
                                            <span className="font-mono text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded mr-1 select-all">{child.itemCode}</span>
                                            <span className="font-semibold text-slate-800">{child.itemName}</span>
                                        </td>
                                        <td className="py-2 px-1">
                                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold select-none">کالا</span>
                                        </td>
                                        <td className="py-2 px-2 font-mono text-slate-500">{renderCell(child.itemCode, isLastYear, 'proforma', 'text', false)}</td>
                                        <td className="py-2 px-2 font-mono text-slate-500">{renderCell(child.itemCode, isLastYear, 'cartons', 'number', false)}</td>
                                        <td className="py-2 px-2 font-mono font-semibold text-slate-700">{renderCell(child.itemCode, isLastYear, 'weight', 'number', false)}</td>
                                        <td className="py-2 px-2 font-mono text-slate-500">{renderCell(child.itemCode, isLastYear, 'containers', 'number', false)}</td>
                                        <td className="py-2 px-2 font-mono font-semibold text-slate-600">{renderCell(child.itemCode, isLastYear, 'dollars', 'dollar', false)}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        );
                    })
                )}

                {/* 2. IMPORTED & RAW MATERIALS */}
                <tr className="bg-slate-50 text-slate-700 font-extrabold text-right">
                    <td colSpan={7} className="py-2.5 px-3 text-[11px] text-teal-900 bg-teal-50/80 border-y border-teal-100/60 font-bold">
                        ۲. مواد اولیه وارداتی و کمکی (تفکیک شده بر اساس گروه کالا)
                    </td>
                </tr>
                {filteredImported.length === 0 ? (
                    <tr>
                        <td colSpan={7} className="py-4 text-center text-slate-400">موردی یافت نشد.</td>
                    </tr>
                ) : (
                    filteredImported.map((group, idx) => {
                        const isExpanded = !!expandedGroups[group.code];
                        const childItems = getGroupChildItems(group.code);

                        return (
                            <React.Fragment key={`group-imp-${isLastYear ? 'ly' : 'curr'}-${group.code}`}>
                                <tr className="hover:bg-slate-50 text-slate-700 border-b border-slate-100 transition-colors">
                                    <td 
                                        className="py-2.5 px-3 text-right font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer hover:text-teal-600 transition-colors select-none"
                                        onClick={() => toggleGroup(group.code)}
                                    >
                                        <span className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-slate-100 transition-colors">
                                            {isExpanded ? (
                                                <ChevronDown className="w-3.5 h-3.5 text-teal-600" />
                                            ) : (
                                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                            )}
                                        </span>
                                        <span className="font-mono text-[10px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded font-bold mr-1">{group.code}</span>
                                        <span className="font-bold text-slate-900">{group.name}</span>
                                        <span className="text-[10px] text-slate-400 font-normal mr-1">({childItems.length} کالا)</span>
                                    </td>
                                    <td className="py-2 px-1">
                                        {isEditMode ? (
                                            <select
                                                value={getItemCategory(group.code)}
                                                onChange={(e) => handleCategoryChange(group.code, e.target.value as any)}
                                                className="text-[10px] p-1 border rounded bg-white text-slate-700 focus:outline-none"
                                            >
                                                <option value="raw">وارداتی (نمایش)</option>
                                                <option value="other">پنهان کردن</option>
                                            </select>
                                        ) : (
                                            <span className="text-[10px] bg-teal-50 text-teal-600 px-1.5 py-0.5 rounded font-bold">وارداتی</span>
                                        )}
                                    </td>
                                    <td className="py-2 px-2">{renderCell(group.code, isLastYear, 'proforma', 'text', true)}</td>
                                    <td className="py-2 px-2 font-mono font-medium">{renderCell(group.code, isLastYear, 'cartons', 'number', true)}</td>
                                    <td className="py-2 px-2 font-mono font-bold text-slate-900">{renderCell(group.code, isLastYear, 'weight', 'number', true)}</td>
                                    <td className="py-2 px-2 font-mono font-medium">{renderCell(group.code, isLastYear, 'containers', 'number', true)}</td>
                                    <td className="py-2 px-2 font-mono font-bold text-emerald-600">{renderCell(group.code, isLastYear, 'dollars', 'dollar', true)}</td>
                                </tr>
                                
                                {isExpanded && childItems.map((child, cIdx) => (
                                    <tr 
                                        key={`child-imp-${isLastYear ? 'ly' : 'curr'}-${group.code}-${child.itemCode}`} 
                                        className="bg-slate-50/40 hover:bg-slate-100/60 transition-colors text-slate-600 text-[11px] border-b border-dashed border-slate-100/80"
                                    >
                                        <td className="py-2 px-3 pr-8 text-right font-normal text-slate-700 flex items-center gap-1.5">
                                            <span className="text-slate-300 font-bold select-none">↳</span>
                                            <span className="font-mono text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded mr-1 select-all">{child.itemCode}</span>
                                            <span className="font-semibold text-slate-800">{child.itemName}</span>
                                        </td>
                                        <td className="py-2 px-1">
                                            <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-semibold select-none">کالا</span>
                                        </td>
                                        <td className="py-2 px-2 font-mono text-slate-500">{renderCell(child.itemCode, isLastYear, 'proforma', 'text', false)}</td>
                                        <td className="py-2 px-2 font-mono text-slate-500">{renderCell(child.itemCode, isLastYear, 'cartons', 'number', false)}</td>
                                        <td className="py-2 px-2 font-mono font-semibold text-slate-700">{renderCell(child.itemCode, isLastYear, 'weight', 'number', false)}</td>
                                        <td className="py-2 px-2 font-mono text-slate-500">{renderCell(child.itemCode, isLastYear, 'containers', 'number', false)}</td>
                                        <td className="py-2 px-2 font-mono font-semibold text-slate-600">{renderCell(child.itemCode, isLastYear, 'dollars', 'dollar', false)}</td>
                                    </tr>
                                ))}
                            </React.Fragment>
                        );
                    })
                )}
            </tbody>
        );
    };

    return (
        <div className="p-3 sm:p-6 space-y-6 bg-slate-50 rounded-2xl select-none" dir="rtl">
            {/* Sticky Action & Navigation Bar */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-md space-y-3 transition-all">
                {/* Top Row: Title and Primary Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shadow-xs">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                                <span>سامانه نمای کلی موجودی و مغایرت سالانه انبار</span>
                                <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold">داشبورد هوشمند</span>
                            </h2>
                            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">پایش همزمان موجودی‌های سایان، انبارهای تجاری، بارهای در راه و ترخیصی گمرک</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Direct Print Button */}
                        <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); handlePrintReport('both'); }}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl px-3 py-2 text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                            title="چاپ و پرینت مستقیم گزارش انبار با پنجره پرینت استاندارد مرورگر"
                        >
                            <Printer className="w-3.5 h-3.5 text-emerald-600" />
                            <span>چاپ گزارش</span>
                        </button>

                        {/* PDF & Print Dropdown */}
                        <div className="relative">
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPdfScopeMenuOpen(!pdfScopeMenuOpen); }}
                                disabled={isDownloadingPdf}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl px-3.5 py-2 text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                                title="دانلود فایل PDF رسمی گزارش انبار و تحلیل روندها"
                            >
                                {isDownloadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 text-indigo-600" />}
                                <span>خروجی PDF و چاپ رسمی</span>
                                <ChevronDown className="w-3 h-3 text-indigo-500 mr-0.5" />
                            </button>

                            {pdfScopeMenuOpen && (
                                <div className="absolute left-0 mt-1 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-2.5 space-y-2 text-right animate-fade-in" dir="rtl">
                                    <div className="text-[10px] font-black text-slate-400 px-1 py-0.5 border-b border-slate-100 flex items-center justify-between">
                                        <span>انتخاب محدوده گزارش، دریافت PDF یا پرینت:</span>
                                        <button type="button" onClick={() => setPdfScopeMenuOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-3 h-3" /></button>
                                    </div>
                                    
                                    {/* Option 1: Full 2 Pages */}
                                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 transition-colors">
                                        <div className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                                            <span>📑 گزارش جامع ۲ صفحه‌ای (کل زنجیره + تحلیل)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadPdf('both')}
                                                className="flex-1 py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                            >
                                                <Download className="w-3 h-3" />
                                                <span>دانلود PDF</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handlePrintReport('both')}
                                                className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                            >
                                                <Printer className="w-3 h-3" />
                                                <span>چاپ</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Option 2: Page 1 Only */}
                                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
                                        <div className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                                            <span>🏢 فقط صفحه ۱ (کل جداول زنجیره تامین)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadPdf('overview_only')}
                                                className="flex-1 py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                            >
                                                <Download className="w-3 h-3" />
                                                <span>دانلود PDF</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handlePrintReport('overview_only')}
                                                className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                            >
                                                <Printer className="w-3 h-3" />
                                                <span>چاپ</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Option 3: Page 2 Only */}
                                    <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 hover:border-amber-200 transition-colors">
                                        <div className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                                            <span>⚠️ فقط صفحه ۲ (تحلیل روند و کسری منفی)</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadPdf('variance_only')}
                                                className="flex-1 py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                            >
                                                <Download className="w-3 h-3" />
                                                <span>دانلود PDF</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handlePrintReport('variance_only')}
                                                className="py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                                            >
                                                <Printer className="w-3 h-3" />
                                                <span>چاپ</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Direct Print All Quick Action */}
                                    <button
                                        type="button"
                                        onClick={() => handlePrintReport('both')}
                                        className="w-full text-center py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                                    >
                                        <Printer className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>🖨️ باز کردن پیش‌نمایش و چاپ مستقیم (مرورگر)</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Bot Modal Trigger */}
                        {negativeItems.length > 0 ? (
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsBotModalOpen(true); }}
                                className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-3.5 py-2 text-xs font-black transition-all flex items-center gap-1.5 animate-pulse shadow-md shadow-red-500/20 cursor-pointer"
                                title="مشاهده اقلام منفی و ارسال گزارش هشدار به ربات"
                            >
                                <BellRing className="w-3.5 h-3.5 text-white animate-bounce" />
                                <span>🚨 ارسال هشدار کسری ({negativeItems.length.toLocaleString('fa-IR')} کالا)</span>
                                <Send className="w-3 h-3 text-white/90 mr-0.5" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsBotModalOpen(true); }}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl px-3.5 py-2 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                title="ارسال گزارش وضعیت کلی انبار به ربات"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>تراز وزنی مثبت (ارسال به بات)</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setShowSettings(!showSettings)}
                            className={`rounded-xl px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                                showSettings 
                                ? 'bg-blue-50 text-blue-800 border-blue-200' 
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <Settings className="w-3.5 h-3.5 text-slate-500" />
                            <span className="hidden sm:inline">تنظیمات دوره</span>
                        </button>

                        <button
                            type="button"
                            onClick={loadSavedData}
                            disabled={isLoading}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            <span className="hidden sm:inline">بروزرسانی</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsEditMode(!isEditMode)}
                            className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer ${
                                isEditMode 
                                ? 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-300' 
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                            <span>{isEditMode ? "لغو ویرایش" : "ویرایش دستی"}</span>
                        </button>

                        {isEditMode && (
                            <button
                                type="button"
                                onClick={() => handleSave(false)}
                                disabled={isSaving}
                                className="bg-green-600 hover:bg-green-700 text-white rounded-xl px-4 py-2 text-xs font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                            >
                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                <span>ذخیره</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Bottom Row: Quick Section Navigation Ribbon */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold border-t border-slate-100 pt-2 custom-scrollbar">
                    <span className="text-[10px] text-slate-400 font-black pl-1 whitespace-nowrap flex items-center gap-1">
                        <Navigation className="w-3 h-3 text-blue-500" />
                        <span>دسترسی سریع:</span>
                    </span>

                    <button
                        type="button"
                        onClick={() => scrollToSection('section-summary')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                    >
                        <Scale className="w-3 h-3 text-blue-600" />
                        <span>📊 خلاصه تراز کل</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => scrollToSection('section-sayan-tables')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                    >
                        <Package className="w-3 h-3 text-indigo-600" />
                        <span>🧵 تولیدات و مواد سایان</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => scrollToSection('section-commercial')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                    >
                        <Boxes className="w-3 h-3 text-emerald-600" />
                        <span>🏬 کالای تجاری</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => scrollToSection('section-transit')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                    >
                        <Layers className="w-3 h-3 text-teal-600" />
                        <span>🚢 بارهای در راه</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => scrollToSection('section-customs')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-sky-50 text-slate-700 hover:text-sky-700 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                    >
                        <Layers className="w-3 h-3 text-sky-600" />
                        <span>🏢 ترخیصی گمرک</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => scrollToSection('section-purchasing')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                    >
                        <Layers className="w-3 h-3 text-indigo-600" />
                        <span>🛒 در حال خرید</span>
                    </button>

                    {negativeItems.length > 0 && (
                        <button
                            type="button"
                            onClick={() => scrollToSection('section-negative-alert')}
                            className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer animate-pulse font-black"
                        >
                            <BellRing className="w-3 h-3 text-red-600" />
                            <span>🚨 هشدار کسری منفی ({negativeItems.length.toLocaleString('fa-IR')})</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => scrollToSection('section-variance-matrix')}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
                    >
                        <TrendingUp className="w-3 h-3 text-amber-600" />
                        <span>📈 ماتریس تحلیل روندها</span>
                    </button>
                </div>
            </div>

            {/* Dynamic Date & Period Settings Control (User Requested) */}
            {showSettings && (
                <div className="bg-white p-6 rounded-2xl border-2 border-blue-100 shadow-md space-y-6 max-w-4xl mx-auto animation-fade-in">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                        <Settings className="w-5 h-5 text-blue-600" />
                        <h4 className="font-extrabold text-slate-800 text-sm sm:text-base">تنظیمات پویای دوره‌های مالی و تاریخ استعلام سایان</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Period 1 Settings */}
                        <div className="p-4 bg-slate-50 rounded-xl space-y-4 border border-slate-100">
                            <h5 className="font-bold text-xs text-blue-900 border-b border-blue-100 pb-1.5">ستون گزارش ۱ (مثلاً سال گذشته)</h5>
                            
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[11px] text-slate-500 font-bold mb-1">برچسب ستون جدول</label>
                                    <input 
                                        type="text"
                                        value={report1Label}
                                        onChange={(e) => setReport1Label(e.target.value)}
                                        className="w-full text-xs font-bold p-2 bg-white border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="مانند: منتهی به سال ۱۴۰۳"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[11px] text-slate-500 font-bold mb-1">تاریخ شمسی (نمایش)</label>
                                        <input 
                                            type="text"
                                            value={report1Jalali}
                                            onChange={(e) => setReport1Jalali(e.target.value)}
                                            className="w-full text-xs font-semibold p-2 bg-white border rounded text-center focus:outline-none"
                                            placeholder="۱۴۰۳/۱۲/۳۰"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-slate-500 font-bold mb-1">تاریخ میلادی (سایان)</label>
                                        <input 
                                            type="date"
                                            value={report1Miladi}
                                            onChange={(e) => setReport1Miladi(e.target.value)}
                                            className="w-full text-xs font-semibold p-2 bg-white border rounded text-center focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Period 2 Settings */}
                        <div className="p-4 bg-slate-50 rounded-xl space-y-4 border border-slate-100">
                            <h5 className="font-bold text-xs text-blue-900 border-b border-blue-100 pb-1.5">ستون گزارش ۲ (مثلاً سال جاری)</h5>
                            
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[11px] text-slate-500 font-bold mb-1">برچسب ستون جدول</label>
                                    <input 
                                        type="text"
                                        value={report2Label}
                                        onChange={(e) => setReport2Label(e.target.value)}
                                        className="w-full text-xs font-bold p-2 bg-white border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        placeholder="مانند: وضعیت فعلی سال ۱۴۰۴"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[11px] text-slate-500 font-bold mb-1">تاریخ شمسی (نمایش)</label>
                                        <input 
                                            type="text"
                                            value={report2Jalali}
                                            onChange={(e) => setReport2Jalali(e.target.value)}
                                            className="w-full text-xs font-semibold p-2 bg-white border rounded text-center focus:outline-none"
                                            placeholder="۱۴۰۴/۰۴/۱۷"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-slate-500 font-bold mb-1">تاریخ میلادی (سایان)</label>
                                        <input 
                                            type="date"
                                            value={report2Miladi}
                                            onChange={(e) => setReport2Miladi(e.target.value)}
                                            className="w-full text-xs font-semibold p-2 bg-white border rounded text-center focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Cumulative balance option */}
                    <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                            <h5 className="font-extrabold text-xs text-blue-900">محاسبه مانده تجمعی سال قبل در ستون سال جاری (۱۴۰۵)</h5>
                            <p className="text-[10px] text-slate-500 font-medium">در صورت فعال بودن، مانده واقعی سال ۱۴۰۵ از ابتدای سال ۱۴۰۴ تا امروز محاسبه می‌شود (تضمین نمایش دقیق موجودی بر اساس تراکنش‌های تجمعی).</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                checked={cumulativeFromLastYear} 
                                onChange={(e) => setCumulativeFromLastYear(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>

                    {/* Warehouse Bot Groups Configuration */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Send className="w-4 h-4 text-blue-600" />
                                <h5 className="font-extrabold text-xs text-slate-800">تنظیم شناسه گروه‌های ربات انبار و زنجیره تامین</h5>
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium">جهت ارسال خودکار و دستی هشدارهای تراز منفی</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">شناسه گروه تلگرام (Telegram Group ID):</label>
                                <input
                                    type="text"
                                    value={warehouseTelegramGroupId}
                                    onChange={(e) => setWarehouseTelegramGroupId(e.target.value)}
                                    placeholder="مثال: -100123456789 یا @warehouse_group"
                                    className="w-full text-xs font-mono p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    dir="ltr"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">شناسه گروه بله (Bale Group ID):</label>
                                <input
                                    type="text"
                                    value={warehouseBaleGroupId}
                                    onChange={(e) => setWarehouseBaleGroupId(e.target.value)}
                                    placeholder="مثال: -123456789@g.bale.ai"
                                    className="w-full text-xs font-mono p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    dir="ltr"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-600 mb-1">شناسه گروه واتساپ (WhatsApp Group ID):</label>
                                <input
                                    type="text"
                                    value={warehouseWhatsappGroupId}
                                    onChange={(e) => setWarehouseWhatsappGroupId(e.target.value)}
                                    placeholder="مثال: 12036302488888@g.us"
                                    className="w-full text-xs font-mono p-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Commercial Companies Filter Configuration */}
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-blue-600" />
                                <h5 className="font-extrabold text-xs text-slate-800">انتخاب شرکت‌های بخش بازرگانی (ارتباط با گزارش انبار)</h5>
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium">فقط پرونده‌های شرکت‌های انتخاب‌شده در محاسبات و گزارش انبار اعمال می‌شوند</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 pt-1">
                            {availableCompanies.length === 0 ? (
                                <span className="text-xs text-slate-400">هیچ شرکتی در پرونده‌های بازرگانی یافت نشد.</span>
                            ) : (
                                availableCompanies.map(comp => {
                                    const isSelected = allowedCompanies.some(c => normalizeCompanyName(c) === normalizeCompanyName(comp));
                                    return (
                                        <button
                                            key={comp}
                                            type="button"
                                            onClick={() => {
                                                let newAllowed: string[];
                                                if (isSelected) {
                                                    newAllowed = allowedCompanies.filter(c => normalizeCompanyName(c) !== normalizeCompanyName(comp));
                                                } else {
                                                    newAllowed = [...allowedCompanies, comp];
                                                }
                                                setAllowedCompanies(newAllowed);
                                                applyCommercialFilterAndMerge(
                                                    rawTradeRecordsRef.current,
                                                    newAllowed,
                                                    baseTransitRef.current,
                                                    baseCustomsRef.current,
                                                    basePurchaseRef.current
                                                );
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                                isSelected 
                                                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400' 
                                                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                                            }`}
                                        >
                                            <span>{comp}</span>
                                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                            <span className="text-[11px] text-blue-700 font-bold">
                                {allowedCompanies.length === 0 ? 'وضعیت: اعمال تمام شرکت‌ها (بدون فیلتر)' : `شرکت‌های فعال: ${allowedCompanies.join(', ')}`}
                            </span>
                            {allowedCompanies.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAllowedCompanies([]);
                                        applyCommercialFilterAndMerge(
                                            rawTradeRecordsRef.current,
                                            [],
                                            baseTransitRef.current,
                                            baseCustomsRef.current,
                                            basePurchaseRef.current
                                        );
                                    }}
                                    className="text-xs text-red-600 hover:text-red-800 font-bold underline cursor-pointer"
                                >
                                    پاک کردن فیلتر (انتخاب همه)
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-4">
                        <button
                            type="button"
                            onClick={handleSyncWithActiveYear}
                            disabled={isLoading}
                            className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg px-4 py-2 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                            <RefreshCw className="w-3.5 h-3.5 animate-pulse" />
                            <span>همگام‌سازی هوشمند با سال مالی فعال سیستم</span>
                        </button>
                        
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowSettings(false)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg px-4 py-2 text-xs font-bold transition-all"
                            >
                                انصراف
                            </button>
                            <button
                                onClick={handleApplySettingsAndFetch}
                                disabled={isLoading}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-5 py-2 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                            >
                                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                <span>ثبت دائم و استعلام جدید از سایان</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Letter Header Box */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="text-xs font-bold text-slate-400">گزارش مدیریتی مقایسه‌ای وضعیت انبارها</div>
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-slate-500 font-bold">تاریخ گزارش:</span>
                        {isEditMode ? (
                            <input 
                                type="text"
                                value={reportDate}
                                onChange={(e) => setReportDate(e.target.value)}
                                className="w-24 text-center bg-transparent border-b border-blue-400 font-bold focus:outline-none"
                            />
                        ) : (
                            <span className="font-mono font-bold text-slate-800">{reportDate}</span>
                        )}
                    </div>
                </div>

                <div className="space-y-1">
                    <h3 className="font-extrabold text-slate-800 text-base">مدیریت محترم لپان بافت جناب آقای محمد امین فتوت احمدی</h3>
                    <p className="text-xs text-slate-500 font-medium">
                        با سلام، احتراما گزارش موجودی {report1Label} (مورخ {report1Jalali}) و مقایسه آن با {report2Label} (مورخ {report2Jalali}) مستخرج از سامانه یکپارچه سایان به همراه جزئیات بارهای در راه و گمرک به شرح ذیل تقدیم حضور می‌گردد:
                    </p>
                </div>
            </div>

            {/* Sayan Items Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded">تعداد کل اقلام سایان: {(allActiveRawItems.length + allActiveFactoryItems.length).toLocaleString('fa-IR')} قلم</span>
                    <span className="px-2 py-1 bg-green-50 text-green-600 rounded">مواد اولیه: {allActiveRawItems.length.toLocaleString('fa-IR')} قلم</span>
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded">در کارخانه: {allActiveFactoryItems.length.toLocaleString('fa-IR')} قلم</span>
                </div>
                <div className="w-full md:w-72">
                    <input 
                        type="text"
                        value={itemFilterText}
                        onChange={(e) => setItemFilterText(e.target.value)}
                        placeholder="جستجو در بین اقلام انبار سایان..."
                        className="w-full text-xs p-2 bg-slate-50 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                </div>
            </div>

            {/* Main Grid: Sayan Items - Left (Report 1) vs Right (Report 2) comparison */}
            <div id="section-sayan-tables" className="grid grid-cols-1 xl:grid-cols-2 gap-6 scroll-mt-28">
                
                {/* 1. REPORT 1 END OF FISCAL INVENTORY TABLE */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                    <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse"></span>
                            <h4 className="font-extrabold text-sm sm:text-base">موجودی انبارها ({report1Label})</h4>
                        </div>
                        <span className="text-xs bg-slate-800 px-2.5 py-1 rounded text-slate-300 font-bold font-mono">{report1Jalali}</span>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-xs text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                    <th className="py-3 px-2 text-right">نوع کالا / نخ</th>
                                    <th className="py-3 px-2">دسته‌بندی</th>
                                    <th className="py-3 px-2">پروفرم</th>
                                    <th className="py-3 px-2">کارتن</th>
                                    <th className="py-3 px-2 font-bold text-slate-900">وزن (kg)</th>
                                    <th className="py-3 px-2">کانتینر</th>
                                    <th className="py-3 px-2">ارزش دلاری</th>
                                </tr>
                            </thead>
                            {renderTableBody(true)}
                            <tfoot>
                                <tr className="bg-slate-900 text-white font-extrabold border-t border-slate-700">
                                    <td className="py-3 px-3 text-right font-extrabold" colSpan={3}>جمع کل انبارها (سایان)</td>
                                    <td className="py-3 px-2 font-mono text-center">
                                        {calculateTotalSayanSum(true, 'cartons').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center text-amber-300">
                                        {calculateTotalSayanSum(true, 'weight').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center">
                                        {calculateTotalSayanSum(true, 'containers').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center text-emerald-300">
                                        ${calculateTotalSayanSum(true, 'dollars').toLocaleString('en-US')}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* 2. REPORT 2 CURRENT ACTIVE INVENTORY TABLE */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                    <div className="p-4 bg-blue-900 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></span>
                            <h4 className="font-extrabold text-sm sm:text-base">موجودی انبارها ({report2Label})</h4>
                        </div>
                        <span className="text-xs bg-blue-800 px-2.5 py-1 rounded text-blue-200 font-bold font-mono">{report2Jalali}</span>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-xs text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                    <th className="py-3 px-2 text-right">نوع کالا / نخ</th>
                                    <th className="py-3 px-2">دسته‌بندی</th>
                                    <th className="py-3 px-2">پروفرم</th>
                                    <th className="py-3 px-2">کارتن</th>
                                    <th className="py-3 px-2 font-bold text-slate-900">وزن (kg)</th>
                                    <th className="py-3 px-2">کانتینر</th>
                                    <th className="py-3 px-2">ارزش دلاری</th>
                                </tr>
                            </thead>
                            {renderTableBody(false)}
                            <tfoot>
                                <tr className="bg-blue-900 text-white font-extrabold border-t border-blue-700">
                                    <td className="py-3 px-3 text-right font-extrabold" colSpan={3}>جمع کل انبارها (سایان)</td>
                                    <td className="py-3 px-2 font-mono text-center">
                                        {calculateTotalSayanSum(false, 'cartons').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center text-amber-300">
                                        {calculateTotalSayanSum(false, 'weight').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center">
                                        {calculateTotalSayanSum(false, 'containers').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center text-emerald-300">
                                        ${calculateTotalSayanSum(false, 'dollars').toLocaleString('en-US')}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

            </div>

            {/* 3. COMMERCIAL WAREHOUSE GOODS TABLE */}
            <div id="section-commercial" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm scroll-mt-28">
                <div className="p-4 bg-emerald-800 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-sm sm:text-base">کالای انبار تجاری (مخصوص سرمایه در گردش و بازرگانی)</h4>
                    </div>
                    {isEditMode && (
                        <button
                            onClick={addCommercialRow}
                            className="bg-emerald-700 hover:bg-emerald-600 text-white rounded px-3 py-1 text-xs font-bold transition-all flex items-center gap-1"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>افزودن کالای تجاری</span>
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-center border-collapse">
                        <thead>
                            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                <th className="py-3 px-3 text-right">نام کالا</th>
                                <th className="py-3 px-2">دسته‌بندی</th>
                                <th className="py-3 px-2">تعداد کارتن</th>
                                <th className="py-3 px-2">وزن ناخالص/خالص (kg)</th>
                                <th className="py-3 px-2">کانتینر</th>
                                <th className="py-3 px-2">ارزش دلاری</th>
                                {isEditMode && <th className="py-3 px-2">عملیات</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {commercialGoods.length === 0 ? (
                                <tr>
                                    <td colSpan={isEditMode ? 7 : 6} className="py-6 text-center text-slate-400 font-medium">هیچ کالایی در انبار تجاری ثبت نشده است.</td>
                                </tr>
                            ) : (
                                commercialGoods.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 text-slate-700">
                                        <td className="py-2.5 px-3 text-right font-bold">
                                            {isEditMode ? (
                                                <input 
                                                    type="text" 
                                                    value={item.itemName} 
                                                    onChange={(e) => updateCommercialCell(item.id, 'itemName', e.target.value)}
                                                    className="w-full py-1 px-2 border rounded border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                                                />
                                            ) : item.itemName}
                                        </td>
                                        <td className="py-2.5 px-2">
                                            {isEditMode ? (
                                                <input 
                                                    type="text" 
                                                    value={item.category} 
                                                    onChange={(e) => updateCommercialCell(item.id, 'category', e.target.value)}
                                                    className="w-full text-center py-1 px-2 border rounded border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                />
                                            ) : item.category}
                                        </td>
                                        <td className="py-2.5 px-2 font-mono">
                                            {isEditMode ? (
                                                <input 
                                                    type="number" 
                                                    value={item.cartons} 
                                                    onChange={(e) => updateCommercialCell(item.id, 'cartons', e.target.value)}
                                                    className="w-24 text-center py-1 px-2 border rounded border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                                                />
                                            ) : item.cartons.toLocaleString('fa-IR')}
                                        </td>
                                        <td className="py-2.5 px-2 font-mono">
                                            {isEditMode ? (
                                                <input 
                                                    type="number" 
                                                    value={item.weight} 
                                                    onChange={(e) => updateCommercialCell(item.id, 'weight', e.target.value)}
                                                    className="w-28 text-center py-1 px-2 border rounded border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                                                />
                                            ) : item.weight.toLocaleString('fa-IR')}
                                        </td>
                                        <td className="py-2.5 px-2 font-mono">
                                            {isEditMode ? (
                                                <input 
                                                    type="number" 
                                                    value={item.container} 
                                                    onChange={(e) => updateCommercialCell(item.id, 'container', e.target.value)}
                                                    className="w-20 text-center py-1 px-2 border rounded border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                                                />
                                            ) : item.container.toLocaleString('fa-IR')}
                                        </td>
                                        <td className="py-2.5 px-2 font-mono font-bold text-emerald-600">
                                            {isEditMode ? (
                                                <input 
                                                    type="number" 
                                                    value={item.dollars} 
                                                    onChange={(e) => updateCommercialCell(item.id, 'dollars', e.target.value)}
                                                    className="w-28 text-center py-1 px-2 border rounded border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                                                />
                                            ) : `$${item.dollars.toLocaleString('en-US')}`}
                                        </td>
                                        {isEditMode && (
                                            <td className="py-2.5 px-2">
                                                <button 
                                                    onClick={() => deleteCommercialRow(item.id)}
                                                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {commercialGoods.length > 0 && (
                            <tfoot>
                                <tr className="bg-emerald-900 text-white font-extrabold border-t border-emerald-700">
                                    <td className="py-3 px-3 text-right" colSpan={2}>جمع کل انبار تجاری</td>
                                    <td className="py-3 px-2 font-mono">{calculateCustomTableSum(commercialGoods, 'cartons').toLocaleString('fa-IR')}</td>
                                    <td className="py-3 px-2 font-mono">{calculateCustomTableSum(commercialGoods, 'weight').toLocaleString('fa-IR')}</td>
                                    <td className="py-3 px-2 font-mono">{calculateCustomTableSum(commercialGoods, 'container').toLocaleString('fa-IR')}</td>
                                    <td className="py-3 px-2 font-mono text-emerald-300">${calculateCustomTableSum(commercialGoods, 'dollars').toLocaleString('en-US')}</td>
                                    {isEditMode && <td></td>}
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* THREE INTERACTIVE CARGO TABLES: Transit, Customs, Purchasing */}
            <div className="space-y-6">
                
                {/* A. GOODS IN TRANSIT (کالاهای در راه) */}
                <div id="section-transit" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm scroll-mt-28">
                    <div className="p-4 bg-teal-800 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm sm:text-base">کالاهای در راه (بارهای در مسیر حمل دریایی / زمینی)</h4>
                        </div>
                        {isEditMode && (
                            <button
                                onClick={() => addCustomRow('transit')}
                                className="bg-teal-700 hover:bg-teal-600 text-white rounded px-3 py-1 text-xs font-bold transition-all flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>افزودن بار در راه</span>
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                    <th className="py-3 px-3 text-right">نوع بار</th>
                                    <th className="py-3 px-2">پروفرم / حواله</th>
                                    <th className="py-3 px-2">وزن (kg)</th>
                                    <th className="py-3 px-2">تعداد کارتن</th>
                                    <th className="py-3 px-2">کانتینر</th>
                                    <th className="py-3 px-2">ارزش دلاری ($)</th>
                                    {isEditMode && <th className="py-3 px-2">عملیات</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {goodsInTransit.length === 0 ? (
                                    <tr>
                                        <td colSpan={isEditMode ? 7 : 6} className="py-6 text-center text-slate-400 font-medium">هیچ باری در راه ثبت نشده است.</td>
                                    </tr>
                                ) : (
                                    goodsInTransit.map((item) => {
                                        const isCommercial = item.id.startsWith('com_');
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50 text-slate-700">
                                                <td className="py-2.5 px-3 text-right font-bold flex items-center gap-1.5 flex-wrap">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="text" 
                                                            value={item.cargoType} 
                                                            onChange={(e) => updateCustomCell('transit', item.id, 'cargoType', e.target.value)}
                                                            className="w-full py-1 px-2 border rounded border-slate-200 focus:outline-none"
                                                        />
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 flex-wrap">
                                                            {item.cargoType}
                                                            {isCommercial && (
                                                                <span className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 text-[10px] px-1.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-900 font-bold font-sans">
                                                                    سیستم بازرگانی
                                                                </span>
                                                            )}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-2">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="text" 
                                                            value={item.proforma} 
                                                            onChange={(e) => updateCustomCell('transit', item.id, 'proforma', e.target.value)}
                                                            className="w-full text-center py-1 px-2 border rounded border-slate-200 focus:outline-none"
                                                        />
                                                    ) : item.proforma || '-'}
                                                </td>
                                                <td className="py-2.5 px-2 font-mono">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="number" 
                                                            value={item.weight} 
                                                            onChange={(e) => updateCustomCell('transit', item.id, 'weight', e.target.value)}
                                                            className="w-28 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                        />
                                                    ) : item.weight.toLocaleString('fa-IR')}
                                                </td>
                                                <td className="py-2.5 px-2 font-mono">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="number" 
                                                            value={item.cartons} 
                                                            onChange={(e) => updateCustomCell('transit', item.id, 'cartons', e.target.value)}
                                                            className="w-24 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                        />
                                                    ) : item.cartons.toLocaleString('fa-IR')}
                                                </td>
                                                <td className="py-2.5 px-2 font-mono">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="number" 
                                                            value={item.container} 
                                                            onChange={(e) => updateCustomCell('transit', item.id, 'container', e.target.value)}
                                                            className="w-20 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                        />
                                                    ) : item.container.toLocaleString('fa-IR')}
                                                </td>
                                                <td className="py-2.5 px-2 font-mono font-bold text-emerald-600">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="number" 
                                                            value={item.dollars} 
                                                            onChange={(e) => updateCustomCell('transit', item.id, 'dollars', e.target.value)}
                                                            className="w-28 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                        />
                                                    ) : `$${item.dollars.toLocaleString('en-US')}`}
                                                </td>
                                                {isEditMode && (
                                                    <td className="py-2.5 px-2">
                                                        {!isCommercial && (
                                                            <button 
                                                                onClick={() => deleteCustomRow('transit', item.id)}
                                                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-all"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            {goodsInTransit.length > 0 && (
                                <tfoot>
                                    <tr className="bg-teal-900 text-white font-extrabold border-t border-teal-700">
                                        <td className="py-3 px-3 text-right" colSpan={2}>جمع بارهای در راه</td>
                                        <td className="py-3 px-2 font-mono">{calculateCustomTableSum(goodsInTransit, 'weight').toLocaleString('fa-IR')}</td>
                                        <td className="py-3 px-2 font-mono">{calculateCustomTableSum(goodsInTransit, 'cartons').toLocaleString('fa-IR')}</td>
                                        <td className="py-3 px-2 font-mono">{calculateCustomTableSum(goodsInTransit, 'container').toLocaleString('fa-IR')}</td>
                                        <td className="py-3 px-2 font-mono text-emerald-300">${calculateCustomTableSum(goodsInTransit, 'dollars').toLocaleString('en-US')}</td>
                                        {isEditMode && <td></td>}
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* B. GOODS IN CUSTOMS (بارهای در گمرک) */}
                <div id="section-customs" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm scroll-mt-28">
                    <div className="p-4 bg-sky-800 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm sm:text-base">بارهای در گمرک (رسیده به گمرکات کشور و در حال ترخیص)</h4>
                        </div>
                        {isEditMode && (
                            <button
                                onClick={() => addCustomRow('customs')}
                                className="bg-sky-700 hover:bg-sky-600 text-white rounded px-3 py-1 text-xs font-bold transition-all flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>افزودن بار در گمرک</span>
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                    <th className="py-3 px-3 text-right">نوع بار</th>
                                    <th className="py-3 px-2">پروفرم / حواله</th>
                                    <th className="py-3 px-2">وزن (kg)</th>
                                    <th className="py-3 px-2">تعداد کارتن</th>
                                    <th className="py-3 px-2">کانتینر</th>
                                    <th className="py-3 px-2">ارزش دلاری ($)</th>
                                    {isEditMode && <th className="py-3 px-2">عملیات</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {goodsInCustoms.length === 0 ? (
                                    <tr>
                                        <td colSpan={isEditMode ? 7 : 6} className="py-6 text-center text-slate-400 font-medium">هیچ باری در گمرک ثبت نشده است.</td>
                                    </tr>
                                ) : (
                                    goodsInCustoms.map((item) => {
                                        const isCommercial = item.id.startsWith('com_');
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50 text-slate-700">
                                                <td className="py-2.5 px-3 text-right font-bold flex items-center gap-1.5 flex-wrap">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="text" 
                                                            value={item.cargoType} 
                                                            onChange={(e) => updateCustomCell('customs', item.id, 'cargoType', e.target.value)}
                                                            className="w-full py-1 px-2 border rounded border-slate-200 focus:outline-none"
                                                        />
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 flex-wrap">
                                                            {item.cargoType}
                                                            {isCommercial && (
                                                                <span className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 text-[10px] px-1.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-900 font-bold font-sans">
                                                                    سیستم بازرگانی
                                                                </span>
                                                            )}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-2">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="text" 
                                                            value={item.proforma} 
                                                            onChange={(e) => updateCustomCell('customs', item.id, 'proforma', e.target.value)}
                                                            className="w-full text-center py-1 px-2 border rounded border-slate-200 focus:outline-none"
                                                        />
                                                    ) : item.proforma || '-'}
                                                </td>
                                                <td className="py-2.5 px-2 font-mono">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="number" 
                                                            value={item.weight} 
                                                            onChange={(e) => updateCustomCell('customs', item.id, 'weight', e.target.value)}
                                                            className="w-28 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                        />
                                                    ) : item.weight.toLocaleString('fa-IR')}
                                                </td>
                                                <td className="py-2.5 px-2 font-mono">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="number" 
                                                            value={item.cartons} 
                                                            onChange={(e) => updateCustomCell('customs', item.id, 'cartons', e.target.value)}
                                                            className="w-24 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                        />
                                                    ) : item.cartons.toLocaleString('fa-IR')}
                                                </td>
                                                <td className="py-2.5 px-2 font-mono">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="number" 
                                                            value={item.container} 
                                                            onChange={(e) => updateCustomCell('customs', item.id, 'container', e.target.value)}
                                                            className="w-20 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                        />
                                                    ) : item.container.toLocaleString('fa-IR')}
                                                </td>
                                                <td className="py-2.5 px-2 font-mono font-bold text-emerald-600">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="number" 
                                                            value={item.dollars} 
                                                            onChange={(e) => updateCustomCell('customs', item.id, 'dollars', e.target.value)}
                                                            className="w-28 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                        />
                                                    ) : `$${item.dollars.toLocaleString('en-US')}`}
                                                </td>
                                                {isEditMode && (
                                                    <td className="py-2.5 px-2">
                                                        {!isCommercial && (
                                                            <button 
                                                                onClick={() => deleteCustomRow('customs', item.id)}
                                                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-all"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            {goodsInCustoms.length > 0 && (
                                <tfoot>
                                    <tr className="bg-sky-900 text-white font-extrabold border-t border-sky-700">
                                        <td className="py-3 px-3 text-right" colSpan={2}>جمع بارهای در گمرک</td>
                                        <td className="py-3 px-2 font-mono">{calculateCustomTableSum(goodsInCustoms, 'weight').toLocaleString('fa-IR')}</td>
                                        <td className="py-3 px-2 font-mono">{calculateCustomTableSum(goodsInCustoms, 'cartons').toLocaleString('fa-IR')}</td>
                                        <td className="py-3 px-2 font-mono">{calculateCustomTableSum(goodsInCustoms, 'container').toLocaleString('fa-IR')}</td>
                                        <td className="py-3 px-2 font-mono text-emerald-300">${calculateCustomTableSum(goodsInCustoms, 'dollars').toLocaleString('en-US')}</td>
                                        {isEditMode && <td></td>}
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

                {/* C. GOODS UNDER PURCHASE / PROCURING (در حال خرید) */}
                <div id="section-purchasing" className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm scroll-mt-28">
                    <div className="p-4 bg-indigo-800 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-sm sm:text-base">بارهای در حال خرید (ثبت سفارش شده یا پیش پرداخت انجام شده)</h4>
                        </div>
                        {isEditMode && (
                            <button
                                onClick={() => addCustomRow('purchase')}
                                className="bg-indigo-700 hover:bg-indigo-600 text-white rounded px-3 py-1 text-xs font-bold transition-all flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>افزودن خرید جدید</span>
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                    <th className="py-3 px-3 text-right">نوع بار</th>
                                    <th className="py-3 px-2">پروفرم / حواله</th>
                                    <th className="py-3 px-2">وزن (kg)</th>
                                    <th className="py-3 px-2">تعداد کارتن</th>
                                    <th className="py-3 px-2">کانتینر</th>
                                    <th className="py-3 px-2">ارزش دلاری ($)</th>
                                    {isEditMode && <th className="py-3 px-2">عملیات</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {purchasingGoods.length === 0 ? (
                                    <tr>
                                        <td colSpan={isEditMode ? 7 : 6} className="py-6 text-center text-slate-400 font-medium">هیچ خرید فعالی در دست اقدام نیست.</td>
                                    </tr>
                                ) : (
                                    purchasingGoods.map((item) => {
                                        const isCommercial = item.id.startsWith('com_');
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50 text-slate-700">
                                                <td className="py-2.5 px-3 text-right font-bold flex items-center gap-1.5 flex-wrap">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="text" 
                                                            value={item.cargoType} 
                                                            onChange={(e) => updateCustomCell('purchase', item.id, 'cargoType', e.target.value)}
                                                            className="w-full py-1 px-2 border rounded border-slate-200 focus:outline-none"
                                                        />
                                                    ) : (
                                                        <span className="flex items-center gap-1.5 flex-wrap">
                                                            {item.cargoType}
                                                            {isCommercial && (
                                                                <span className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 text-[10px] px-1.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-900 font-bold font-sans">
                                                                    سیستم بازرگانی
                                                                </span>
                                                            )}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-2">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="text" 
                                                            value={item.proforma} 
                                                            onChange={(e) => updateCustomCell('purchase', item.id, 'proforma', e.target.value)}
                                                            className="w-full text-center py-1 px-2 border rounded border-slate-200 focus:outline-none"
                                                        />
                                                    ) : item.proforma || '-'}
                                                </td>
                                                <td className="py-2.5 px-2 font-mono">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="number" 
                                                            value={item.weight} 
                                                            onChange={(e) => updateCustomCell('purchase', item.id, 'weight', e.target.value)}
                                                            className="w-28 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                        />
                                                    ) : item.weight.toLocaleString('fa-IR')}
                                                </td>
                                                <td className="py-2.5 px-2 font-mono">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="number" 
                                                            value={item.cartons} 
                                                            onChange={(e) => updateCustomCell('purchase', item.id, 'cartons', e.target.value)}
                                                            className="w-24 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                        />
                                                    ) : item.cartons.toLocaleString('fa-IR')}
                                                </td>
                                                <td className="py-2.5 px-2 font-mono">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="number" 
                                                            value={item.container} 
                                                            onChange={(e) => updateCustomCell('purchase', item.id, 'container', e.target.value)}
                                                            className="w-20 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                        />
                                                    ) : item.container.toLocaleString('fa-IR')}
                                                </td>
                                                <td className="py-2.5 px-2 font-mono font-bold text-emerald-600">
                                                    {isEditMode && !isCommercial ? (
                                                        <input 
                                                            type="number" 
                                                            value={item.dollars} 
                                                            onChange={(e) => updateCustomCell('purchase', item.id, 'dollars', e.target.value)}
                                                            className="w-28 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                        />
                                                    ) : `$${item.dollars.toLocaleString('en-US')}`}
                                                </td>
                                                {isEditMode && (
                                                    <td className="py-2.5 px-2">
                                                        {!isCommercial && (
                                                            <button 
                                                                onClick={() => deleteCustomRow('purchase', item.id)}
                                                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-all"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            {purchasingGoods.length > 0 && (
                                <tfoot>
                                    <tr className="bg-indigo-900 text-white font-extrabold border-t border-indigo-700">
                                        <td className="py-3 px-3 text-right" colSpan={2}>جمع بارهای در حال خرید</td>
                                        <td className="py-3 px-2 font-mono">{calculateCustomTableSum(purchasingGoods, 'weight').toLocaleString('fa-IR')}</td>
                                        <td className="py-3 px-2 font-mono">{calculateCustomTableSum(purchasingGoods, 'cartons').toLocaleString('fa-IR')}</td>
                                        <td className="py-3 px-2 font-mono">{calculateCustomTableSum(purchasingGoods, 'container').toLocaleString('fa-IR')}</td>
                                        <td className="py-3 px-2 font-mono text-emerald-300">${calculateCustomTableSum(purchasingGoods, 'dollars').toLocaleString('en-US')}</td>
                                        {isEditMode && <td></td>}
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

            </div>

            {/* COMPARATIVE ANALYSIS SUMMARY (تفاضل و مقایسه جامع وزنی، تولید، واردات و آمار سالانه) */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-md space-y-8 max-w-5xl mx-auto">
                <div className="border-b border-slate-100 pb-4 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold mb-2">
                        <Scale className="w-3.5 h-3.5" />
                        <span>تحلیل مقایسه‌ای تراز وزنی و عملکرد سالانه</span>
                    </div>
                    <h4 className="font-black text-slate-800 text-lg sm:text-xl">مقایسه تراز وزنی تولیدات، واردات و موجودی زنجیره تامین</h4>
                    <p className="text-xs text-slate-500 mt-1">پایش لحظه‌ای تراز وزنی سال جاری ({report2Label}) نسبت به سال گذشته ({report1Label}) و تفکیک رشد یا افت</p>
                </div>

                {/* 4 Comprehensive Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* 1. Factory Production Yarns Weight */}
                    <div className="p-4 bg-gradient-to-br from-blue-50/50 to-slate-50 rounded-2xl border border-blue-100/80 flex flex-col justify-between space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                                <Package className="w-3.5 h-3.5 text-blue-600" />
                                <span>نخ‌های تولیدی کارخانه</span>
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isYarnsDownward ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {isYarnsDownward ? '🔻 تراز منفی' : '📈 تراز مثبت'}
                            </span>
                        </div>
                        <div>
                            <div className="text-[11px] text-slate-500 font-medium flex justify-between">
                                <span>پارسال: {(totalLastYearYarnsWeight / 1000).toFixed(2)} تن</span>
                                <span>امسال: {(totalCurrentYarnsWeight / 1000).toFixed(2)} تن</span>
                            </div>
                            <div className="text-xl font-black text-slate-800 font-mono mt-1" dir="ltr">
                                {diffYarnsWeight >= 0 ? `+${(diffYarnsWeight / 1000).toFixed(2)}` : (diffYarnsWeight / 1000).toFixed(2)} <span className="text-xs font-normal text-slate-500">تن</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                            <span className="text-slate-500 font-medium">درصد تغییرات:</span>
                            <span className={`font-mono font-bold flex items-center gap-0.5 ${ratioYarnsWeight < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {ratioYarnsWeight < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                                {ratioYarnsWeight >= 0 ? `+${ratioYarnsWeight.toFixed(1)}%` : `${ratioYarnsWeight.toFixed(1)}%`}
                            </span>
                        </div>
                    </div>

                    {/* 2. Raw & Imported Materials Weight */}
                    <div className="p-4 bg-gradient-to-br from-teal-50/50 to-slate-50 rounded-2xl border border-teal-100/80 flex flex-col justify-between space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                                <Boxes className="w-3.5 h-3.5 text-teal-600" />
                                <span>مواد اولیه و واردات</span>
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isRawDownward ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {isRawDownward ? '🔻 تراز منفی' : '📈 تراز مثبت'}
                            </span>
                        </div>
                        <div>
                            <div className="text-[11px] text-slate-500 font-medium flex justify-between">
                                <span>پارسال: {(totalLastYearRawWeight / 1000).toFixed(2)} تن</span>
                                <span>امسال: {(totalCurrentRawWeight / 1000).toFixed(2)} تن</span>
                            </div>
                            <div className="text-xl font-black text-slate-800 font-mono mt-1" dir="ltr">
                                {diffRawWeight >= 0 ? `+${(diffRawWeight / 1000).toFixed(2)}` : (diffRawWeight / 1000).toFixed(2)} <span className="text-xs font-normal text-slate-500">تن</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                            <span className="text-slate-500 font-medium">درصد تغییرات:</span>
                            <span className={`font-mono font-bold flex items-center gap-0.5 ${ratioRawWeight < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {ratioRawWeight < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                                {ratioRawWeight >= 0 ? `+${ratioRawWeight.toFixed(1)}%` : `${ratioRawWeight.toFixed(1)}%`}
                            </span>
                        </div>
                    </div>

                    {/* 3. Total Enterprise Supply Chain Weight */}
                    <div className="p-4 bg-gradient-to-br from-indigo-50/50 to-slate-50 rounded-2xl border border-indigo-100/80 flex flex-col justify-between space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                <span>سرجمع کل وزن زنجیره</span>
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isAllWeightDownward ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {isAllWeightDownward ? '🔻 تراز منفی' : '📈 تراز مثبت'}
                            </span>
                        </div>
                        <div>
                            <div className="text-[11px] text-slate-500 font-medium flex justify-between">
                                <span>پارسال: {(totalLastYearAllWeight / 1000).toFixed(2)} تن</span>
                                <span>امسال: {(totalCurrentAllWeight / 1000).toFixed(2)} تن</span>
                            </div>
                            <div className="text-xl font-black text-slate-800 font-mono mt-1" dir="ltr">
                                {diffAllWeight >= 0 ? `+${(diffAllWeight / 1000).toFixed(2)}` : (diffAllWeight / 1000).toFixed(2)} <span className="text-xs font-normal text-slate-500">تن</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                            <span className="text-slate-500 font-medium">تغییر کل:</span>
                            <span className={`font-mono font-bold flex items-center gap-0.5 ${ratioAllWeight < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {ratioAllWeight < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                                {ratioAllWeight >= 0 ? `+${ratioAllWeight.toFixed(1)}%` : `${ratioAllWeight.toFixed(1)}%`}
                            </span>
                        </div>
                    </div>

                    {/* 4. Containers & Dollars Import Metrics */}
                    <div className="p-4 bg-gradient-to-br from-amber-50/50 to-slate-50 rounded-2xl border border-amber-100/80 flex flex-col justify-between space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                                <span>کانتینر و ارزش دلاری</span>
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ratioContainers < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                {ratioContainers < 0 ? '🔻 نزولی' : '📈 صعودی'}
                            </span>
                        </div>
                        <div>
                            <div className="text-[11px] text-slate-500 font-medium flex justify-between">
                                <span>کانتینر: {diffContainers > 0 ? `+${diffContainers.toFixed(1)}` : diffContainers.toFixed(1)}</span>
                                <span>ارزش: {diffDollars >= 0 ? `+$${(diffDollars / 1000).toFixed(0)}k` : `-$${(Math.abs(diffDollars) / 1000).toFixed(0)}k`}</span>
                            </div>
                            <div className="text-xl font-black text-slate-800 font-mono mt-1" dir="ltr">
                                {ratioContainers >= 0 ? `+${ratioContainers.toFixed(1)}%` : `${ratioContainers.toFixed(1)}%`}
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                            <span className="text-slate-500 font-medium">تغییر ارزی:</span>
                            <span className={`font-mono font-bold ${ratioDollars < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {ratioDollars >= 0 ? `+${ratioDollars.toFixed(1)}%` : `${ratioDollars.toFixed(1)}%`}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 🚨 NEGATIVE ITEMS ALERT CENTER */}
                {negativeItems.length > 0 ? (
                    <div id="section-negative-alert" className="p-5 rounded-2xl bg-red-50/90 border-2 border-red-200 space-y-4 shadow-sm scroll-mt-28">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-red-200/80 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-red-600 text-white rounded-xl shadow animate-bounce">
                                    <BellRing className="w-5 h-5" />
                                </div>
                                <div>
                                    <h5 className="font-extrabold text-red-900 text-sm sm:text-base flex items-center gap-2">
                                        <span>هشدار فوری: شناسایی {negativeItems.length.toLocaleString('fa-IR')} قلم کالا با تراز منفی و افت وزنی</span>
                                        <span className="px-2 py-0.5 bg-red-200 text-red-800 rounded-full text-[10px] font-mono font-bold">ALARM ACTIVE</span>
                                    </h5>
                                    <p className="text-xs text-red-700 mt-0.5">
                                        این اقلام در مقایسه با سال گذشته کاهش موجودی داشته یا مانده فعلی آن‌ها منفی است و نیازمند بررسی و صدور گزارش به مدیران می‌باشند.
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setIsBotModalOpen(true)}
                                className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-2.5 text-xs font-extrabold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg self-stretch sm:self-auto"
                            >
                                <Send className="w-4 h-4" />
                                <span>ارسال فوری گزارش منفی‌ها به بات</span>
                            </button>
                        </div>

                        {/* List of Negative Items Mini Table */}
                        <div className="overflow-x-auto rounded-xl border border-red-200 bg-white">
                            <table className="w-full text-xs text-center border-collapse">
                                <thead>
                                    <tr className="bg-red-100/70 text-red-900 font-bold border-b border-red-200">
                                        <th className="py-2.5 px-3 text-right">کد و نام کالا / گروه</th>
                                        <th className="py-2.5 px-2">دسته‌بندی</th>
                                        <th className="py-2.5 px-2 font-mono">وزن پارسال ({report1Label})</th>
                                        <th className="py-2.5 px-2 font-mono">وزن امسال ({report2Label})</th>
                                        <th className="py-2.5 px-2 font-mono text-red-700 font-extrabold">میزان کسری و افت (Δ kg)</th>
                                        <th className="py-2.5 px-2 font-mono">درصد افت</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {negativeItems.map((item, idx) => (
                                        <tr key={`neg-${item.code}-${idx}`} className="border-b border-red-100 hover:bg-red-50/50 transition-colors">
                                            <td className="py-2 px-3 text-right font-bold text-slate-800 flex items-center gap-1.5">
                                                <span className="font-mono text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">{item.code}</span>
                                                <span>{item.name}</span>
                                            </td>
                                            <td className="py-2 px-2 text-slate-600">
                                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                                    {item.categoryLabel}
                                                </span>
                                            </td>
                                            <td className="py-2 px-2 font-mono text-slate-600">
                                                {item.lastYearWeight.toLocaleString('fa-IR', { maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-2 px-2 font-mono font-bold text-slate-900">
                                                {item.currentWeight.toLocaleString('fa-IR', { maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-2 px-2 font-mono font-extrabold text-red-600 bg-red-50/50" dir="ltr">
                                                {item.diffWeight.toLocaleString('fa-IR', { maximumFractionDigits: 2 })} kg
                                                <span className="text-[10px] text-red-500 font-normal mr-1">({(item.diffWeight / 1000).toFixed(2)} تن)</span>
                                            </td>
                                            <td className="py-2 px-2 font-mono font-bold text-red-600">
                                                {item.ratio.toFixed(1)}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                            <div>
                                <h5 className="font-extrabold text-emerald-900 text-xs sm:text-sm">تراز وزنی کلیه اقلام مثبت است</h5>
                                <p className="text-[11px] text-emerald-700">هیچ قلم کالایی با کاهش یا تراز منفی نسبت به سال گذشته شناسایی نشد.</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsBotModalOpen(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-3.5 py-2 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                        >
                            <Send className="w-3.5 h-3.5" />
                            <span>ارسال گزارش به ربات</span>
                        </button>
                    </div>
                )}

                {/* DETAILED VARIANCE & WEIGHT CHANGE MATRIX */}
                <div className="space-y-4 pt-2 border-t border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <h5 className="font-extrabold text-slate-800 text-sm sm:text-base">جدول مقایسه مستقیم و ماتریس تراز وزنی تمام اقلام</h5>
                            <button
                                onClick={() => setShowVarianceDetails(!showVarianceDetails)}
                                className="text-xs text-blue-600 hover:underline font-bold"
                            >
                                {showVarianceDetails ? '(پنهان کردن)' : '(نمایش جزئیات)'}
                            </button>
                        </div>

                        {/* Filter Tabs */}
                        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                            <button
                                onClick={() => setVarianceFilter('all')}
                                className={`px-3 py-1.5 rounded-lg transition-all ${varianceFilter === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                همه اقلام ({allComparedItems.length})
                            </button>
                            <button
                                onClick={() => setVarianceFilter('negative')}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${varianceFilter === 'negative' ? 'bg-red-600 text-white shadow-sm' : 'text-red-600 hover:bg-red-50'}`}
                            >
                                <TrendingDown className="w-3.5 h-3.5" />
                                <span>دارای افت وزنی ({negativeItems.length})</span>
                            </button>
                            <button
                                onClick={() => setVarianceFilter('positive')}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${varianceFilter === 'positive' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-600 hover:bg-emerald-50'}`}
                            >
                                <TrendingUp className="w-3.5 h-3.5" />
                                <span>دارای رشد وزنی ({allComparedItems.length - negativeItems.length})</span>
                            </button>
                        </div>
                    </div>

                    {showVarianceDetails && (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                            <table className="w-full text-xs text-center border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                        <th className="py-2.5 px-3 text-right">کد و عنوان کالا / گروه</th>
                                        <th className="py-2.5 px-2">دسته‌بندی</th>
                                        <th className="py-2.5 px-2 font-mono">وزن سال قبل ({report1Label})</th>
                                        <th className="py-2.5 px-2 font-mono">وزن سال جاری ({report2Label})</th>
                                        <th className="py-2.5 px-2 font-mono font-bold">اختلاف وزنی (Δ kg)</th>
                                        <th className="py-2.5 px-2 font-mono">درصد تغییر</th>
                                        <th className="py-2.5 px-2">وضعیت تراز</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredVarianceItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-4 text-center text-slate-400">موردی مطابق با فیلتر یافت نشد.</td>
                                        </tr>
                                    ) : (
                                        filteredVarianceItems.map((item, idx) => (
                                            <tr key={`var-${item.code}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                                                <td className="py-2.5 px-3 text-right font-bold text-slate-800 flex items-center gap-1.5">
                                                    <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{item.code}</span>
                                                    <span>{item.name}</span>
                                                </td>
                                                <td className="py-2 px-2 text-slate-500">
                                                    <span className="text-[10px] bg-slate-50 border px-1.5 py-0.5 rounded font-medium">
                                                        {item.categoryLabel}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-2 font-mono text-slate-600">
                                                    {item.lastYearWeight.toLocaleString('fa-IR', { maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="py-2 px-2 font-mono font-bold text-slate-900">
                                                    {item.currentWeight.toLocaleString('fa-IR', { maximumFractionDigits: 2 })}
                                                </td>
                                                <td className={`py-2 px-2 font-mono font-extrabold ${item.isNegative ? 'text-red-600 bg-red-50/40' : 'text-emerald-600 bg-emerald-50/40'}`} dir="ltr">
                                                    {item.diffWeight >= 0 ? `+${item.diffWeight.toLocaleString('fa-IR', { maximumFractionDigits: 2 })}` : item.diffWeight.toLocaleString('fa-IR', { maximumFractionDigits: 2 })} kg
                                                </td>
                                                <td className={`py-2 px-2 font-mono font-bold ${item.isNegative ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {item.ratio >= 0 ? `+${item.ratio.toFixed(1)}%` : `${item.ratio.toFixed(1)}%`}
                                                </td>
                                                <td className="py-2 px-2">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.isNegative ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {item.isNegative ? '🔻 منفی' : '🟢 مثبت'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Signature Box */}
                <div className="pt-6 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 font-bold">
                    <div>تهیه و تنظیم گزارش: انبارداری مرکزی و تامین خارجی</div>
                    <div className="flex items-center gap-1 text-slate-800">
                        <span>با تشکر -</span>
                        {isEditMode ? (
                            <input 
                                type="text"
                                value={signature}
                                onChange={(e) => setSignature(e.target.value)}
                                className="bg-transparent border-b border-blue-400 font-bold focus:outline-none"
                            />
                        ) : (
                            <span className="font-black text-slate-900">{signature}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* 🤖 BOT DISPATCH & ALARM NOTIFICATION MODAL */}
            {isBotModalOpen && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/75 backdrop-blur-md animate-fade-in" dir="rtl">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 sm:p-7 space-y-5 max-h-[92vh] flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-red-50 text-red-600 rounded-2xl">
                                    <Send className="w-5 h-5 sm:w-6 sm:h-6" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-sm sm:text-base md:text-lg">ارسال گزارش انبار، هشدار کسری و مغایرت به ربات و مدیریت</h3>
                                    <p className="text-[11px] text-slate-500 mt-0.5">ارسال فایل PDF رسمی، کپشن تحلیلی و نوتیفیکیشن اختصاصی به مدیرعامل</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsBotModalOpen(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Status / Alert feedback */}
                        {botSendSuccessMessage && (
                            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shrink-0">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                <span>{botSendSuccessMessage}</span>
                            </div>
                        )}

                        {botSendErrorMessage && (
                            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold flex items-center gap-2 shrink-0">
                                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                                <span>{botSendErrorMessage}</span>
                            </div>
                        )}

                        <div className="overflow-y-auto flex-1 space-y-4 pr-1 pl-1 custom-scrollbar min-h-0">
                            {/* 1. Scope Selection (محدوده گزارش ارسالی) */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                                    <FileText className="w-4 h-4 text-indigo-600" />
                                    <span>۱. انتخاب محدوده و صفحات گزارش (Scope)</span>
                                </label>
                                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setBotReportScope('both')}
                                        className={`flex-1 py-1.5 text-center text-[10.5px] font-black rounded-lg transition-all ${
                                            botReportScope === 'both'
                                            ? 'bg-white shadow text-indigo-950 font-extrabold'
                                            : 'text-slate-600 hover:text-slate-900 font-bold'
                                        }`}
                                    >
                                        📑 گزارش جامع (۲ صفحه)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBotReportScope('overview_only')}
                                        className={`flex-1 py-1.5 text-center text-[10.5px] font-black rounded-lg transition-all ${
                                            botReportScope === 'overview_only'
                                            ? 'bg-white shadow text-blue-950 font-extrabold'
                                            : 'text-slate-600 hover:text-slate-900 font-bold'
                                        }`}
                                    >
                                        🏢 فقط صفحه ۱
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBotReportScope('variance_only')}
                                        className={`flex-1 py-1.5 text-center text-[10.5px] font-black rounded-lg transition-all ${
                                            botReportScope === 'variance_only'
                                            ? 'bg-white shadow text-amber-950 font-extrabold'
                                            : 'text-slate-600 hover:text-slate-900 font-bold'
                                        }`}
                                    >
                                        ⚠️ فقط صفحه ۲ (تحلیل کسری)
                                    </button>
                                </div>
                            </div>

                            {/* 2. Format Selection (نوع و قالب ارسال) */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                                    <Sliders className="w-4 h-4 text-emerald-600" />
                                    <span>۲. قالب و فرمت ارسال گزارش (Format)</span>
                                </label>
                                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setBotSendFormat('pdf_and_caption')}
                                        className={`flex-1 py-1.5 text-center text-[10.5px] font-black rounded-lg transition-all ${
                                            botSendFormat === 'pdf_and_caption'
                                            ? 'bg-white shadow text-emerald-950 font-extrabold'
                                            : 'text-slate-600 hover:text-slate-900 font-bold'
                                        }`}
                                    >
                                        📎 PDF + متن کپشن
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBotSendFormat('pdf_only')}
                                        className={`flex-1 py-1.5 text-center text-[10.5px] font-black rounded-lg transition-all ${
                                            botSendFormat === 'pdf_only'
                                            ? 'bg-white shadow text-emerald-950 font-extrabold'
                                            : 'text-slate-600 hover:text-slate-900 font-bold'
                                        }`}
                                    >
                                        📄 فقط فایل PDF
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBotSendFormat('caption_only')}
                                        className={`flex-1 py-1.5 text-center text-[10.5px] font-black rounded-lg transition-all ${
                                            botSendFormat === 'caption_only'
                                            ? 'bg-white shadow text-emerald-950 font-extrabold'
                                            : 'text-slate-600 hover:text-slate-900 font-bold'
                                        }`}
                                    >
                                        💬 فقط پیام متنی
                                    </button>
                                </div>
                            </div>

                            {/* 3. In-App Notification to CEO / Management */}
                            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                                            <BellRing className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <span className="text-[11px] font-black text-amber-900 block">
                                                ارسال نوتیفیکیشن درون‌برنامه‌ای به مدیرعامل و مدیران ارشد
                                            </span>
                                        </div>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={botNotifyInApp}
                                        onChange={(e) => setBotNotifyInApp(e.target.checked)}
                                        className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                                    />
                                </label>
                            </div>

                            {/* 4. Destination Selection */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-extrabold text-slate-700">۳. انتخاب گروه یا مخاطب مقصد</label>
                                <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setBotDestinationType('default')}
                                        className={`flex-1 py-1.5 text-center text-[10.5px] font-black rounded-lg transition-all ${
                                            botDestinationType === 'default'
                                            ? 'bg-white shadow text-blue-900 font-extrabold'
                                            : 'text-slate-600 hover:text-slate-900 font-bold'
                                        }`}
                                    >
                                        👥 گروه‌های پیش‌فرض انبار
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBotDestinationType('custom')}
                                        className={`flex-1 py-1.5 text-center text-[10.5px] font-black rounded-lg transition-all ${
                                            botDestinationType === 'custom'
                                            ? 'bg-white shadow text-blue-900 font-extrabold'
                                            : 'text-slate-600 hover:text-slate-900 font-bold'
                                        }`}
                                    >
                                        👤 شناسه سفارشی (Chat ID)
                                    </button>
                                </div>

                                {botDestinationType === 'custom' && (
                                    <div className="mt-1">
                                        <input
                                            type="text"
                                            value={customTargetId}
                                            onChange={(e) => setCustomTargetId(e.target.value)}
                                            placeholder="مثال: -100123456789 یا @my_warehouse_group"
                                            className="w-full text-xs font-mono p-2 bg-slate-50 border rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            dir="ltr"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* 5. Platforms Checkbox */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-extrabold text-slate-700">۴. پلتفرم‌های پیام‌رسان فعال</label>
                                <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={selectedPlatforms.includes('telegram')}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedPlatforms([...selectedPlatforms, 'telegram']);
                                                else setSelectedPlatforms(selectedPlatforms.filter(p => p !== 'telegram'));
                                            }}
                                            className="w-4 h-4 text-blue-600 rounded border-slate-300"
                                        />
                                        <span>تلگرام (Telegram)</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={selectedPlatforms.includes('bale')}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedPlatforms([...selectedPlatforms, 'bale']);
                                                else setSelectedPlatforms(selectedPlatforms.filter(p => p !== 'bale'));
                                            }}
                                            className="w-4 h-4 text-blue-600 rounded border-slate-300"
                                        />
                                        <span>بله (Bale)</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 shrink-0">
                            <button
                                onClick={() => setIsBotModalOpen(false)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl px-5 py-2.5 text-xs font-bold transition-all cursor-pointer"
                            >
                                انصراف و بستن
                            </button>
                            <button
                                onClick={handleSendNegativeAlert}
                                disabled={isSendingBot || selectedPlatforms.length === 0}
                                className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-6 py-2.5 text-xs font-black transition-all flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                            >
                                {isSendingBot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                <span>{isSendingBot ? 'در حال ارسال و تولید فایل PDF...' : 'تایید و ارسال به گروه و مدیریت'}</span>
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
};
export default WarehouseOverviewTab;
