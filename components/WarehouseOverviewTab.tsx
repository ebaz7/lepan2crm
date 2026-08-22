import React, { useState, useEffect, useMemo } from 'react';
import { 
    Loader2, Save, Plus, Trash2, Edit2, Check, X, FileText, 
    TrendingDown, TrendingUp, DollarSign, Calendar, RefreshCw 
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

const DEFAULT_RAW_MATERIALS: string[] = [
    "اسپان 30 خام ویتکس",
    "اسپان 30 ویتکس مشکی",
    "اسپان 40 ویتکس",
    "اسپان رنگی کد 201 سفید",
    "اسپان رنگی کد 207 مشکی",
    "الکرا 20",
    "الکرا 30",
    "الکرا 40",
    "الکرا 70",
    "الکرا 140",
    "الکرا 210",
    "نخ ملت کارتن"
];

const DEFAULT_FACTORY_ITEMS: string[] = [
    "روغن poy",
    "نخ poy",
    "نخ الستیک"
];

export const WarehouseOverviewTab: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

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

    // Metadata
    const [reportDate, setReportDate] = useState("۱۴۰۴/۰۴/۱۷");
    const [signature, setSignature] = useState("محمد ابراهیم حیدری");

    // Load everything on mount
    useEffect(() => {
        loadSavedData();
    }, []);

    const loadSavedData = async () => {
        setIsLoading(true);
        try {
            // 1. Fetch Sayan Live stock
            const sayanRes = await fetch('/api/sayan/warehouse-inventory');
            const sayanData = await sayanRes.json();
            if (sayanData.success) {
                setSayanLastYear(sayanData.lastYearStock || []);
                setSayanCurrent(sayanData.currentStock || []);
            }

            // 2. Fetch our custom DB data
            const dbRes = await fetch('/api/warehouse-overview/data');
            const dbData = await dbRes.json();

            if (dbData) {
                setLastYearOverrides(dbData.lastYearOverrides || {});
                setCurrentOverrides(dbData.currentOverrides || {});
                setGoodsInTransit(dbData.goodsInTransit || []);
                setGoodsInCustoms(dbData.goodsInCustoms || []);
                setPurchasingGoods(dbData.purchasingGoods || []);
                setCommercialGoods(dbData.commercialGoods || []);
                if (dbData.meta) {
                    if (dbData.meta.reportDate) setReportDate(dbData.meta.reportDate);
                    if (dbData.meta.signature) setSignature(dbData.meta.signature);
                }
            }
        } catch (err) {
            console.error("Failed to load warehouse overview data", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = {
                lastYearOverrides,
                currentOverrides,
                goodsInTransit,
                goodsInCustoms,
                purchasingGoods,
                commercialGoods,
                meta: {
                    reportDate,
                    signature
                }
            };

            const res = await fetch('/api/warehouse-overview/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                setIsEditMode(false);
                alert("تغییرات با موفقیت ذخیره شد.");
            } else {
                alert("خطا در ذخیره تغییرات روی سرور.");
            }
        } catch (err) {
            console.error(err);
            alert("خطا در ذخیره اطلاعات.");
        } finally {
            setIsSaving(false);
        }
    };

    // Smart Mapper to match Sayan raw item name to standard categories
    const getSayanValue = (itemName: string, isLastYear: boolean, field: 'weight' | 'cartons'): number => {
        const list = isLastYear ? sayanLastYear : sayanCurrent;
        
        // Clean query terms
        const target = itemName.replace(/\s+/g, '').toLowerCase();
        
        // Find best match in Sayan rows
        const found = list.find(r => {
            const rowName = String(r.itemName || '').replace(/\s+/g, '').toLowerCase();
            return rowName.includes(target) || target.includes(rowName);
        });

        if (found) {
            return field === 'weight' ? Math.abs(found.stockQty) : Math.abs(found.cartonsQty);
        }
        return 0;
    };

    // Table item getter with override fallback
    const getItemValue = (
        itemName: string, 
        isLastYear: boolean, 
        field: 'proforma' | 'cartons' | 'weight' | 'containers' | 'dollars'
    ): any => {
        const overrides = isLastYear ? lastYearOverrides : currentOverrides;
        const itemOverride = overrides[itemName];

        if (itemOverride && itemOverride[field] !== undefined && itemOverride[field] !== '') {
            return itemOverride[field];
        }

        // Sayan fallback for weight and cartons
        if (field === 'weight' || field === 'cartons') {
            return getSayanValue(itemName, isLastYear, field);
        }

        // Defaults
        if (field === 'proforma') return '';
        return 0;
    };

    // Helper to update override values in state
    const handleCellChange = (itemName: string, isLastYear: boolean, field: string, value: any) => {
        const setOverrides = isLastYear ? setLastYearOverrides : setCurrentOverrides;
        const overrides = isLastYear ? lastYearOverrides : currentOverrides;

        const numVal = (field === 'proforma') ? value : parseFloat(value || '0');

        setOverrides({
            ...overrides,
            [itemName]: {
                ...(overrides[itemName] || {}),
                [field]: numVal
            }
        });
    };

    // Calculate sum of a list of standard items
    const calculateSectionSum = (items: string[], isLastYear: boolean, field: 'cartons' | 'weight' | 'containers' | 'dollars') => {
        return items.reduce((sum, itemName) => {
            const val = getItemValue(itemName, isLastYear, field);
            return sum + (typeof val === 'number' ? val : 0);
        }, 0);
    };

    // Calculate sum of custom tables
    const calculateCustomTableSum = (list: any[], field: string) => {
        return list.reduce((sum, item) => sum + (parseFloat(item[field]) || 0), 0);
    };

    // Totals calculations
    const totalLastYearContainers = useMemo(() => {
        const bg = calculateSectionSum(DEFAULT_RAW_MATERIALS, true, 'containers');
        const transit = calculateCustomTableSum(goodsInTransit, 'container'); // We can split last year / current or keep general
        const customs = calculateCustomTableSum(goodsInCustoms, 'container');
        const purchase = calculateCustomTableSum(purchasingGoods, 'container');
        return bg + transit + customs + purchase;
    }, [goodsInTransit, goodsInCustoms, purchasingGoods, lastYearOverrides]);

    const totalCurrentContainers = useMemo(() => {
        const bg = calculateSectionSum(DEFAULT_RAW_MATERIALS, false, 'containers');
        // Let's assume transit/customs/purchase in the tables are current year
        const transit = calculateCustomTableSum(goodsInTransit, 'container');
        const customs = calculateCustomTableSum(goodsInCustoms, 'container');
        const purchase = calculateCustomTableSum(purchasingGoods, 'container');
        return bg + transit + customs + purchase;
    }, [goodsInTransit, goodsInCustoms, purchasingGoods, currentOverrides]);

    const totalLastYearDollars = useMemo(() => {
        const bg = calculateSectionSum(DEFAULT_RAW_MATERIALS, true, 'dollars');
        const transit = calculateCustomTableSum(goodsInTransit, 'dollars');
        const customs = calculateCustomTableSum(goodsInCustoms, 'dollars');
        const purchase = calculateCustomTableSum(purchasingGoods, 'dollars');
        return bg + transit + customs + purchase;
    }, [goodsInTransit, goodsInCustoms, purchasingGoods, lastYearOverrides]);

    const totalCurrentDollars = useMemo(() => {
        const bg = calculateSectionSum(DEFAULT_RAW_MATERIALS, false, 'dollars');
        const transit = calculateCustomTableSum(goodsInTransit, 'dollars');
        const customs = calculateCustomTableSum(goodsInCustoms, 'dollars');
        const purchase = calculateCustomTableSum(purchasingGoods, 'dollars');
        return bg + transit + customs + purchase;
    }, [goodsInTransit, goodsInCustoms, purchasingGoods, currentOverrides]);

    // Difference and ratio formulas matching the PDF
    const diffContainers = totalCurrentContainers - totalLastYearContainers;
    const ratioContainers = totalLastYearContainers > 0 ? (diffContainers / totalLastYearContainers) * 100 : 0;

    const diffDollars = totalCurrentDollars - totalLastYearDollars;
    const ratioDollars = totalLastYearDollars > 0 ? (diffDollars / totalLastYearDollars) * 100 : 0;

    const isDownwardTrend = diffContainers < 0;

    // Helper to render editable/static cell
    const renderCell = (itemName: string, isLastYear: boolean, field: 'proforma' | 'cartons' | 'weight' | 'containers' | 'dollars', format = 'number') => {
        const val = getItemValue(itemName, isLastYear, field);
        if (isEditMode) {
            return (
                <input 
                    type={format === 'number' ? 'number' : 'text'}
                    value={val}
                    onChange={(e) => handleCellChange(itemName, isLastYear, field, e.target.value)}
                    className="w-full text-center py-1 px-1 bg-blue-50 border border-blue-200 rounded text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
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
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                        >
                            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            <span>ذخیره تغییرات</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Letter Header Box */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="text-xs font-bold text-slate-400">گزارش مدیریتی مقایسه‌ای</div>
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
                    <p className="text-xs text-slate-500 font-medium">با سلام، احتراما گزارش موجودی منتهی به سال ۱۴۰۳ و مقایسه آن با سال ۱۴۰۴ تا امروز به شرح ذیل تقدیم حضور می‌گردد:</p>
                </div>
            </div>

            {/* Main Grid: Last Year vs Current Year comparison */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                
                {/* 1. LAST YEAR END OF FISCAL INVENTORY TABLE (1403) */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                    <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse"></span>
                            <h4 className="font-extrabold text-sm sm:text-base">موجودی بنگاه‌ها و کارخانه (منتهی به سال ۱۴۰۳)</h4>
                        </div>
                        <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300 font-mono">پایان دوره ۱۴۰۳</span>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-xs text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                    <th className="py-3 px-2 text-right">نوع کالا / نخ</th>
                                    <th className="py-3 px-2">پروفرم</th>
                                    <th className="py-3 px-2">کارتن مانده</th>
                                    <th className="py-3 px-2">وزن مانده (kg)</th>
                                    <th className="py-3 px-2">کانتینر</th>
                                    <th className="py-3 px-2">ارزش دلاری</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <tr className="bg-slate-50 text-slate-500 font-bold text-right"><td colSpan={6} className="py-1 px-3 text-[10px]">موجودی انبار بنگاه‌ها</td></tr>
                                {DEFAULT_RAW_MATERIALS.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 text-slate-700">
                                        <td className="py-2.5 px-3 text-right font-bold">{item}</td>
                                        <td className="py-2.5 px-2">{renderCell(item, true, 'proforma', 'text')}</td>
                                        <td className="py-2.5 px-2 font-mono font-medium">{renderCell(item, true, 'cartons', 'number')}</td>
                                        <td className="py-2.5 px-2 font-mono font-medium">{renderCell(item, true, 'weight', 'number')}</td>
                                        <td className="py-2.5 px-2 font-mono font-medium">{renderCell(item, true, 'containers', 'number')}</td>
                                        <td className="py-2.5 px-2 font-mono font-bold text-emerald-600">{renderCell(item, true, 'dollars', 'dollar')}</td>
                                    </tr>
                                ))}
                                
                                <tr className="bg-slate-50 text-slate-500 font-bold text-right"><td colSpan={6} className="py-1 px-3 text-[10px]">موجودی در کارخانه</td></tr>
                                {DEFAULT_FACTORY_ITEMS.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 text-slate-700">
                                        <td className="py-2.5 px-3 text-right font-bold">{item}</td>
                                        <td className="py-2.5 px-2">{renderCell(item, true, 'proforma', 'text')}</td>
                                        <td className="py-2.5 px-2 font-mono font-medium">{renderCell(item, true, 'cartons', 'number')}</td>
                                        <td className="py-2.5 px-2 font-mono font-medium">{renderCell(item, true, 'weight', 'number')}</td>
                                        <td className="py-2.5 px-2 font-mono font-medium">{renderCell(item, true, 'containers', 'number')}</td>
                                        <td className="py-2.5 px-2 font-mono font-bold text-emerald-600">{renderCell(item, true, 'dollars', 'dollar')}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-slate-900 text-white font-extrabold border-t border-slate-700">
                                    <td className="py-3 px-3 text-right font-extrabold" colSpan={2}>جمع کل انبارها</td>
                                    <td className="py-3 px-2 font-mono text-center">
                                        {calculateSectionSum([...DEFAULT_RAW_MATERIALS, ...DEFAULT_FACTORY_ITEMS], true, 'cartons').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center">
                                        {calculateSectionSum([...DEFAULT_RAW_MATERIALS, ...DEFAULT_FACTORY_ITEMS], true, 'weight').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center">
                                        {calculateSectionSum([...DEFAULT_RAW_MATERIALS, ...DEFAULT_FACTORY_ITEMS], true, 'containers').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center text-amber-400">
                                        ${calculateSectionSum([...DEFAULT_RAW_MATERIALS, ...DEFAULT_FACTORY_ITEMS], true, 'dollars').toLocaleString('en-US')}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* 2. CURRENT ACTIVE FISCAL INVENTORY TABLE (1404) */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                    <div className="p-4 bg-blue-900 text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></span>
                            <h4 className="font-extrabold text-sm sm:text-base">موجودی بنگاه‌ها و کارخانه (فعلی سال ۱۴۰۴)</h4>
                        </div>
                        <span className="text-xs bg-blue-800 px-2 py-1 rounded text-blue-200 font-mono">دوره فعال ۱۴۰۴</span>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-xs text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                                    <th className="py-3 px-2 text-right">نوع کالا / نخ</th>
                                    <th className="py-3 px-2">پروفرم</th>
                                    <th className="py-3 px-2">کارتن مانده</th>
                                    <th className="py-3 px-2">وزن مانده (kg)</th>
                                    <th className="py-3 px-2">کانتینر</th>
                                    <th className="py-3 px-2">ارزش دلاری</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <tr className="bg-slate-50 text-slate-500 font-bold text-right"><td colSpan={6} className="py-1 px-3 text-[10px]">موجودی انبار بنگاه‌ها</td></tr>
                                {DEFAULT_RAW_MATERIALS.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 text-slate-700">
                                        <td className="py-2.5 px-3 text-right font-bold">{item}</td>
                                        <td className="py-2.5 px-2">{renderCell(item, false, 'proforma', 'text')}</td>
                                        <td className="py-2.5 px-2 font-mono font-medium">{renderCell(item, false, 'cartons', 'number')}</td>
                                        <td className="py-2.5 px-2 font-mono font-medium">{renderCell(item, false, 'weight', 'number')}</td>
                                        <td className="py-2.5 px-2 font-mono font-medium">{renderCell(item, false, 'containers', 'number')}</td>
                                        <td className="py-2.5 px-2 font-mono font-bold text-emerald-600">{renderCell(item, false, 'dollars', 'dollar')}</td>
                                    </tr>
                                ))}
                                
                                <tr className="bg-slate-50 text-slate-500 font-bold text-right"><td colSpan={6} className="py-1 px-3 text-[10px]">موجودی در کارخانه</td></tr>
                                {DEFAULT_FACTORY_ITEMS.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 text-slate-700">
                                        <td className="py-2.5 px-3 text-right font-bold">{item}</td>
                                        <td className="py-2.5 px-2">{renderCell(item, false, 'proforma', 'text')}</td>
                                        <td className="py-2.5 px-2 font-mono font-medium">{renderCell(item, false, 'cartons', 'number')}</td>
                                        <td className="py-2.5 px-2 font-mono font-medium">{renderCell(item, false, 'weight', 'number')}</td>
                                        <td className="py-2.5 px-2 font-mono font-medium">{renderCell(item, false, 'containers', 'number')}</td>
                                        <td className="py-2.5 px-2 font-mono font-bold text-emerald-600">{renderCell(item, false, 'dollars', 'dollar')}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-blue-900 text-white font-extrabold border-t border-blue-700">
                                    <td className="py-3 px-3 text-right font-extrabold" colSpan={2}>جمع کل انبارها</td>
                                    <td className="py-3 px-2 font-mono text-center">
                                        {calculateSectionSum([...DEFAULT_RAW_MATERIALS, ...DEFAULT_FACTORY_ITEMS], false, 'cartons').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center">
                                        {calculateSectionSum([...DEFAULT_RAW_MATERIALS, ...DEFAULT_FACTORY_ITEMS], false, 'weight').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center">
                                        {calculateSectionSum([...DEFAULT_RAW_MATERIALS, ...DEFAULT_FACTORY_ITEMS], false, 'containers').toLocaleString('fa-IR')}
                                    </td>
                                    <td className="py-3 px-2 font-mono text-center text-emerald-300">
                                        ${calculateSectionSum([...DEFAULT_RAW_MATERIALS, ...DEFAULT_FACTORY_ITEMS], false, 'dollars').toLocaleString('en-US')}
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
                                                    className="w-full py-1 px-2 border rounded border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
