import React, { useState, useEffect, useMemo } from 'react';
import { 
    Loader2, Save, Plus, Trash2, Edit2, Check, X, FileText, 
    TrendingDown, TrendingUp, DollarSign, Calendar, RefreshCw, Settings, Eye, EyeOff,
    ChevronDown, ChevronRight
} from 'lucide-react';

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

    // Search filter for Sayan items
    const [itemFilterText, setItemFilterText] = useState("");

    // Helper to extract Jalali year
    const getJalaliYear = (jalaliStr: string) => {
        const clean = String(jalaliStr || '').trim()
            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
        const match = clean.match(/^(\d{4})/);
        return match ? parseInt(match[1]) : 1404;
    };

    // Helper to approximate Gregorian start date of Jalali year
    const getJalaliYearStartMiladi = (year: number) => {
        if (year === 1403) return '2024-03-20';
        if (year === 1404) return '2025-03-21';
        if (year === 1405) return '2026-03-21';
        if (year === 1406) return '2027-03-21';
        return `${year + 1121}-03-21`;
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
            // 1. Fetch our custom DB data first to read labels/dates
            const dbRes = await fetch('/api/warehouse-overview/data');
            const dbData = await dbRes.json();

            // Fetch main system settings to dynamically compute defaults based on active fiscal year if there's no saved config
            let activeYearLabel = "1405"; // Default fallback
            try {
                const settingsRes = await fetch('/api/settings');
                const settingsData = await settingsRes.json();
                if (settingsData && settingsData.fiscalYears && settingsData.activeFiscalYearId) {
                    const activeYearObj = settingsData.fiscalYears.find((y: any) => y.id === settingsData.activeFiscalYearId);
                    if (activeYearObj && activeYearObj.label) {
                        activeYearLabel = activeYearObj.label;
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

            if (dbData) {
                setLastYearOverrides(dbData.lastYearOverrides || {});
                setCurrentOverrides(dbData.currentOverrides || {});
                setGoodsInTransit(dbData.goodsInTransit || []);
                setGoodsInCustoms(dbData.goodsInCustoms || []);
                setPurchasingGoods(dbData.purchasingGoods || []);
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
                }
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
            const payload = {
                lastYearOverrides,
                currentOverrides,
                goodsInTransit,
                goodsInCustoms,
                purchasingGoods,
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
                    cumulativeFromLastYear
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

    // Sayan Group definitions (predefined 4-digit prefixes)
    const MANUFACTURED_GROUPS = [
        { code: '0401', name: 'اسپاندکس (کاور)' },
        { code: '0402', name: 'کش' },
        { code: '0403', name: 'اسپاندکس جوشی (ساپورت)' },
        { code: '0405', name: 'پلی استر شوایتر' },
        { code: '0407', name: 'نایلون' },
        { code: '0108', name: 'نایلون' },
        { code: '0103', name: 'dty با پلی استر' }
    ];

    const RAW_MATERIAL_GROUPS = [
        { code: '0101', name: 'چیپس' },
        { code: '0102', name: 'POY' },
        { code: '0104', name: 'لاستیک' },
        { code: '0105', name: 'لاکرا' },
        { code: '0106', name: 'پلی استر اسپان' },
        { code: '0107', name: 'مستربچ' },
        { code: '0408', name: 'نخ ملت' },
        { code: '0409', name: 'الیاف' },
        { code: '0410', name: 'FDY' }
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
            default: return 'سایر مواد اولیه و ملزومات';
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
                const qty = field === 'weight' ? Math.abs(r.stockQty || 0) : Math.abs(r.cartonsQty || 0);
                return sum + qty;
            }
            return sum;
        }, 0);
    };

    const getSayanItemValue = (itemCode: string, isLastYear: boolean, field: 'weight' | 'cartons'): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        const found = list.find(r => String(r.itemCode || r.ItemCode || '') === itemCode);
        if (found) {
            return field === 'weight' ? Math.abs(found.stockQty || 0) : Math.abs(found.cartonsQty || 0);
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
            return val > 0 ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '-';
        }
        if (format === 'number') {
            return val > 0 ? val.toLocaleString('fa-IR') : '-';
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
        if (type === 'transit') setGoodsInTransit([...goodsInTransit, newRow]);
        if (type === 'customs') setGoodsInCustoms([...goodsInCustoms, newRow]);
        if (type === 'purchase') setPurchasingGoods([...purchasingGoods, newRow]);
    };

    const deleteCustomRow = (type: 'transit' | 'customs' | 'purchase', id: string) => {
        if (type === 'transit') setGoodsInTransit(goodsInTransit.filter(r => r.id !== id));
        if (type === 'customs') setGoodsInCustoms(goodsInCustoms.filter(r => r.id !== id));
        if (type === 'purchase') setPurchasingGoods(purchasingGoods.filter(r => r.id !== id));
    };

    const updateCustomCell = (type: 'transit' | 'customs' | 'purchase', id: string, field: string, value: any) => {
        const setter = type === 'transit' ? setGoodsInTransit : type === 'customs' ? setGoodsInCustoms : setPurchasingGoods;
        const list = type === 'transit' ? goodsInTransit : type === 'customs' ? goodsInCustoms : purchasingGoods;

        setter(list.map(r => r.id === id ? { ...r, [field]: field === 'cargoType' || field === 'proforma' ? value : parseFloat(value || '0') } : r));
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
        <div className="p-4 sm:p-6 space-y-8 bg-slate-50 rounded-xl select-none" dir="rtl">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                        <FileText className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">سامانه نمای کلی موجودی و مغایرت سالانه انبار</h2>
                        <p className="text-xs text-slate-500 mt-0.5">پایش همزمان موجودی‌های سایان، انبارهای تجاری، بارهای در راه و ترخیصی گمرک</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-all flex items-center gap-1.5 border ${
                            showSettings 
                            ? 'bg-blue-50 text-blue-800 border-blue-200' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <Settings className="w-3.5 h-3.5" />
                        <span>تنظیمات دوره مالی</span>
                    </button>

                    <button
                        onClick={loadSavedData}
                        disabled={isLoading}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-3.5 py-2 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        <span>بروزرسانی از سایان</span>
                    </button>

                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`rounded-lg px-4 py-2 text-xs font-bold transition-all flex items-center gap-1.5 border ${
                            isEditMode 
                            ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100' 
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{isEditMode ? "لغو ویرایش دستی" : "حالت ویرایش دستی"}</span>
                    </button>

                    {isEditMode && (
                        <button
                            onClick={() => handleSave(false)}
                            disabled={isSaving}
                            className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                        >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            <span>ذخیره تغییرات</span>
                        </button>
                    )}
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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                
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
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
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
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
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
                                    goodsInTransit.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50 text-slate-700">
                                            <td className="py-2.5 px-3 text-right font-bold">
                                                {isEditMode ? (
                                                    <input 
                                                        type="text" 
                                                        value={item.cargoType} 
                                                        onChange={(e) => updateCustomCell('transit', item.id, 'cargoType', e.target.value)}
                                                        className="w-full py-1 px-2 border rounded border-slate-200 focus:outline-none"
                                                    />
                                                ) : item.cargoType}
                                            </td>
                                            <td className="py-2.5 px-2">
                                                {isEditMode ? (
                                                    <input 
                                                        type="text" 
                                                        value={item.proforma} 
                                                        onChange={(e) => updateCustomCell('transit', item.id, 'proforma', e.target.value)}
                                                        className="w-full text-center py-1 px-2 border rounded border-slate-200 focus:outline-none"
                                                    />
                                                ) : item.proforma || '-'}
                                            </td>
                                            <td className="py-2.5 px-2 font-mono">
                                                {isEditMode ? (
                                                    <input 
                                                        type="number" 
                                                        value={item.weight} 
                                                        onChange={(e) => updateCustomCell('transit', item.id, 'weight', e.target.value)}
                                                        className="w-28 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                    />
                                                ) : item.weight.toLocaleString('fa-IR')}
                                            </td>
                                            <td className="py-2.5 px-2 font-mono">
                                                {isEditMode ? (
                                                    <input 
                                                        type="number" 
                                                        value={item.cartons} 
                                                        onChange={(e) => updateCustomCell('transit', item.id, 'cartons', e.target.value)}
                                                        className="w-24 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                    />
                                                ) : item.cartons.toLocaleString('fa-IR')}
                                            </td>
                                            <td className="py-2.5 px-2 font-mono">
                                                {isEditMode ? (
                                                    <input 
                                                        type="number" 
                                                        value={item.container} 
                                                        onChange={(e) => updateCustomCell('transit', item.id, 'container', e.target.value)}
                                                        className="w-20 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                    />
                                                ) : item.container.toLocaleString('fa-IR')}
                                            </td>
                                            <td className="py-2.5 px-2 font-mono font-bold text-emerald-600">
                                                {isEditMode ? (
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
                                                    <button 
                                                        onClick={() => deleteCustomRow('transit', item.id)}
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
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
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
                                    goodsInCustoms.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50 text-slate-700">
                                            <td className="py-2.5 px-3 text-right font-bold">
                                                {isEditMode ? (
                                                    <input 
                                                        type="text" 
                                                        value={item.cargoType} 
                                                        onChange={(e) => updateCustomCell('customs', item.id, 'cargoType', e.target.value)}
                                                        className="w-full py-1 px-2 border rounded border-slate-200 focus:outline-none"
                                                    />
                                                ) : item.cargoType}
                                            </td>
                                            <td className="py-2.5 px-2">
                                                {isEditMode ? (
                                                    <input 
                                                        type="text" 
                                                        value={item.proforma} 
                                                        onChange={(e) => updateCustomCell('customs', item.id, 'proforma', e.target.value)}
                                                        className="w-full text-center py-1 px-2 border rounded border-slate-200 focus:outline-none"
                                                    />
                                                ) : item.proforma || '-'}
                                            </td>
                                            <td className="py-2.5 px-2 font-mono">
                                                {isEditMode ? (
                                                    <input 
                                                        type="number" 
                                                        value={item.weight} 
                                                        onChange={(e) => updateCustomCell('customs', item.id, 'weight', e.target.value)}
                                                        className="w-28 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                    />
                                                ) : item.weight.toLocaleString('fa-IR')}
                                            </td>
                                            <td className="py-2.5 px-2 font-mono">
                                                {isEditMode ? (
                                                    <input 
                                                        type="number" 
                                                        value={item.cartons} 
                                                        onChange={(e) => updateCustomCell('customs', item.id, 'cartons', e.target.value)}
                                                        className="w-24 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                    />
                                                ) : item.cartons.toLocaleString('fa-IR')}
                                            </td>
                                            <td className="py-2.5 px-2 font-mono">
                                                {isEditMode ? (
                                                    <input 
                                                        type="number" 
                                                        value={item.container} 
                                                        onChange={(e) => updateCustomCell('customs', item.id, 'container', e.target.value)}
                                                        className="w-20 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                    />
                                                ) : item.container.toLocaleString('fa-IR')}
                                            </td>
                                            <td className="py-2.5 px-2 font-mono font-bold text-emerald-600">
                                                {isEditMode ? (
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
                                                    <button 
                                                        onClick={() => deleteCustomRow('customs', item.id)}
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
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
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
                                    purchasingGoods.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50 text-slate-700">
                                            <td className="py-2.5 px-3 text-right font-bold">
                                                {isEditMode ? (
                                                    <input 
                                                        type="text" 
                                                        value={item.cargoType} 
                                                        onChange={(e) => updateCustomCell('purchase', item.id, 'cargoType', e.target.value)}
                                                        className="w-full py-1 px-2 border rounded border-slate-200 focus:outline-none"
                                                    />
                                                ) : item.cargoType}
                                            </td>
                                            <td className="py-2.5 px-2">
                                                {isEditMode ? (
                                                    <input 
                                                        type="text" 
                                                        value={item.proforma} 
                                                        onChange={(e) => updateCustomCell('purchase', item.id, 'proforma', e.target.value)}
                                                        className="w-full text-center py-1 px-2 border rounded border-slate-200 focus:outline-none"
                                                    />
                                                ) : item.proforma || '-'}
                                            </td>
                                            <td className="py-2.5 px-2 font-mono">
                                                {isEditMode ? (
                                                    <input 
                                                        type="number" 
                                                        value={item.weight} 
                                                        onChange={(e) => updateCustomCell('purchase', item.id, 'weight', e.target.value)}
                                                        className="w-28 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                    />
                                                ) : item.weight.toLocaleString('fa-IR')}
                                            </td>
                                            <td className="py-2.5 px-2 font-mono">
                                                {isEditMode ? (
                                                    <input 
                                                        type="number" 
                                                        value={item.cartons} 
                                                        onChange={(e) => updateCustomCell('purchase', item.id, 'cartons', e.target.value)}
                                                        className="w-24 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                    />
                                                ) : item.cartons.toLocaleString('fa-IR')}
                                            </td>
                                            <td className="py-2.5 px-2 font-mono">
                                                {isEditMode ? (
                                                    <input 
                                                        type="number" 
                                                        value={item.container} 
                                                        onChange={(e) => updateCustomCell('purchase', item.id, 'container', e.target.value)}
                                                        className="w-20 text-center py-1 px-2 border rounded border-slate-200 font-mono"
                                                    />
                                                ) : item.container.toLocaleString('fa-IR')}
                                            </td>
                                            <td className="py-2.5 px-2 font-mono font-bold text-emerald-600">
                                                {isEditMode ? (
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
                                                    <button 
                                                        onClick={() => deleteCustomRow('purchase', item.id)}
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

            {/* COMPARATIVE ANALYSIS SUMMARY (تفاضل و مقایسه سالانه) */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-md space-y-6 max-w-4xl mx-auto">
                <div className="border-b border-slate-100 pb-4 text-center">
                    <h4 className="font-black text-slate-800 text-lg">تحلیل مقایسه‌ای وضعیت زنجیره تامین و موجودی</h4>
                    <p className="text-xs text-slate-400 mt-1">تغییرات سالانه حجم ترخیص کالا و کانتینرهای گمرک به صورت لحظه‌ای</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Container differences */}
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                            <div className="text-xs text-slate-500 font-bold">اختلاف تعداد کانتینر واردات سال قبل به امسال</div>
                            <div className="text-2xl font-black text-slate-800 font-mono mt-2" dir="ltr">
                                {diffContainers > 0 ? `+${diffContainers.toFixed(2)}` : diffContainers.toFixed(2)}
                            </div>
                        </div>
                        <div className={`p-3 rounded-xl font-bold text-xs flex flex-col items-center gap-1 ${ratioContainers < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {ratioContainers < 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                            <span className="font-mono">{ratioContainers.toFixed(1)}%</span>
                        </div>
                    </div>

                    {/* Currency value differences */}
                    <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                            <div className="text-xs text-slate-500 font-bold">اختلاف مقدار ارزی واردات سال قبل به امسال</div>
                            <div className="text-2xl font-black text-slate-800 font-mono mt-2" dir="ltr">
                                {diffDollars >= 0 ? `+$${diffDollars.toLocaleString('en-US')}` : `-$${Math.abs(diffDollars).toLocaleString('en-US')}`}
                            </div>
                        </div>
                        <div className={`p-3 rounded-xl font-bold text-xs flex flex-col items-center gap-1 ${ratioDollars < 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                            {ratioDollars < 0 ? <TrendingDown className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                            <span className="font-mono">{ratioDollars.toFixed(1)}%</span>
                        </div>
                    </div>
                </div>

                {/* Import Trend Notification Banner */}
                <div className={`p-4 rounded-2xl border flex items-center gap-3 justify-center text-sm font-bold ${
                    isDownwardTrend 
                    ? 'bg-amber-50 text-amber-800 border-amber-200' 
                    : 'bg-green-50 text-green-800 border-green-200'
                }`}>
                    <span>وضعیت آماری:</span>
                    <span>نسبت به سال گذشته، روند کل واردات کانتینری <span className="underline">{ratioContainers.toFixed(1)}%</span> و نسبت ارزی <span className="underline">{ratioDollars.toFixed(1)}%</span> تغییر داشته و {isDownwardTrend ? 'نزولی' : 'صعودی'} بوده است.</span>
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

        </div>
    );
};
export default WarehouseOverviewTab;
