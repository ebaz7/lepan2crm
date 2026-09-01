import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
    Loader2, RefreshCw, Printer, Download, Search, X, Eye, FileText, 
    ChevronDown, ChevronUp, Layers, Send, CheckCircle2, AlertTriangle, 
    AlertCircle, Sparkles, Building, BarChart2, PackageCheck, Archive, Filter,
    Undo2, FolderOpen, FileSpreadsheet, ChevronRight, Package, Tag, ArrowUpDown
} from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import * as jalaali from "jalaali-js";

interface ProductionReturnTabProps {
    dateFrom: string;
    dateTo: string;
    currentUser?: any;
    settings?: any;
    getEffectiveApiUrl?: (url: string) => string;
}

function formatDateToJalali(dateStr?: string): string {
    if (!dateStr) return "-";
    const clean = String(dateStr).trim();
    // Check if already in Shamsi 140x/xx/xx format
    if (/^1[34]\d{2}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(clean)) {
        return clean.replace(/-/g, "/");
    }
    try {
        const d = new Date(clean);
        if (!isNaN(d.getTime())) {
            const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
            return `${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")}`;
        }
    } catch {}
    return clean;
}

// Master Sayan Item Categories & Groups Dictionary based on Sayan ERP سرفصل کالاها
export interface SayanGroupDefinition {
    code: string;
    title: string;
    parentCategory: "مواد اولیه" | "محصولات" | "ضایعات" | "سایر";
    unit: string;
}

const SAYAN_MASTER_GROUPS: Record<string, SayanGroupDefinition> = {
    // 1. مواد اولیه
    "0101": { code: "0101", title: "چیپس", parentCategory: "مواد اولیه", unit: "کیلوگرم" },
    "0102": { code: "0102", title: "POY", parentCategory: "مواد اولیه", unit: "کیلوگرم" },
    "0103": { code: "0103", title: "dty یا پلی استر", parentCategory: "مواد اولیه", unit: "کیلوگرم" },
    "0104": { code: "0104", title: "لاستیک", parentCategory: "مواد اولیه", unit: "کیلوگرم" },
    "0105": { code: "0105", title: "لاکرا", parentCategory: "مواد اولیه", unit: "کیلوگرم" },
    "0106": { code: "0106", title: "پلی استر اسپان", parentCategory: "مواد اولیه", unit: "کیلوگرم" },
    "0107": { code: "0107", title: "مستربچ", parentCategory: "مواد اولیه", unit: "کیلوگرم" },
    "0108": { code: "0108", title: "نایلون", parentCategory: "مواد اولیه", unit: "کیلوگرم" },

    // 2. محصولات
    "0401": { code: "0401", title: "اسپاندکس (کاور)", parentCategory: "محصولات", unit: "کیلوگرم" },
    "0402": { code: "0402", title: "کش", parentCategory: "محصولات", unit: "کیلوگرم" },
    "0403": { code: "0403", title: "اسپاندکس جوشی (ساپورت)", parentCategory: "محصولات", unit: "کیلوگرم" },
    "0405": { code: "0405", title: "پلی استر شوایتر", parentCategory: "محصولات", unit: "کیلوگرم" },
    "0407": { code: "0407", title: "نایلون", parentCategory: "محصولات", unit: "کیلوگرم" },
    "0408": { code: "0408", title: "نخ ملت", parentCategory: "محصولات", unit: "کیلوگرم" },
    "0409": { code: "0409", title: "الیاف", parentCategory: "محصولات", unit: "کیلوگرم" },
    "0410": { code: "0410", title: "FDY", parentCategory: "محصولات", unit: "کیلوگرم" },

    // 3. ضایعات
    "0501": { code: "0501", title: "ضایعات بافت و نخ", parentCategory: "ضایعات", unit: "کیلوگرم" },
};

// Item Name resolver: Directly preserves authentic Sayan name and only fallbacks if missing
export const resolveProdItemName = (code: string, rawName: string): string => {
    const cleanCode = (code || "").trim();
    const cleanName = (rawName || "").trim();

    // If a valid genuine name was extracted from Sayan DB (not just duplicate of item code), use it directly!
    if (cleanName && cleanName !== cleanCode && cleanName !== "کالای بدون نام") {
        return cleanName;
    }

    // Fallback based on Sayan group prefix if no text name exists
    const prefix4 = cleanCode.slice(0, 4);
    if (SAYAN_MASTER_GROUPS[prefix4]) {
        return `${SAYAN_MASTER_GROUPS[prefix4].title} (${cleanCode})`;
    }

    return cleanName || (cleanCode ? `کالای کد ${cleanCode}` : 'کالای نامشخص');
};

// Precise group classification according to Sayan ERP master groups
export const detectSayanGroup = (itemCode: string, itemName: string, rawGroupName?: string): SayanGroupDefinition => {
    const cleanCode = (itemCode || "").trim();
    const cleanName = (itemName || "").trim().toLowerCase();
    const cleanRawGroup = (rawGroupName || "").trim();

    // 1. Direct 4-digit code prefix check from Sayan master groups
    const prefix4 = cleanCode.slice(0, 4);
    if (SAYAN_MASTER_GROUPS[prefix4]) {
        return SAYAN_MASTER_GROUPS[prefix4];
    }

    // 2. If Sayan SQL returned a valid GroupName from IND_TBL_002, use it
    if (cleanRawGroup && cleanRawGroup !== "null") {
        const cat = cleanCode.startsWith("01") ? "مواد اولیه" : cleanCode.startsWith("04") ? "محصولات" : "سایر";
        return {
            code: prefix4 || "سایر",
            title: cleanRawGroup,
            parentCategory: cat as any,
            unit: "کیلوگرم"
        };
    }

    // 3. Intelligent matching for Sayan catalog categories
    if (cleanCode.startsWith("0405") || cleanName.includes("شوایتر")) {
        return SAYAN_MASTER_GROUPS["0405"]; // پلی استر شوایتر
    }
    if (cleanCode.startsWith("0103") || cleanName.includes("dty") || cleanName.includes("پلی استر")) {
        return SAYAN_MASTER_GROUPS["0103"]; // dty یا پلی استر
    }
    if (cleanCode.startsWith("0102") || cleanName.includes("poy")) {
        return SAYAN_MASTER_GROUPS["0102"]; // POY
    }
    if (cleanCode.startsWith("0105") || cleanName.includes("لاکرا") || cleanName.includes("lycra")) {
        return SAYAN_MASTER_GROUPS["0105"]; // لاکرا
    }
    if (cleanCode.startsWith("0401") || cleanName.includes("اسپاندکس") || cleanName.includes("کاور")) {
        return SAYAN_MASTER_GROUPS["0401"]; // اسپاندکس (کاور)
    }
    if (cleanCode.startsWith("0402") || (cleanName.includes("کش") && !cleanName.includes("لاکرا"))) {
        return SAYAN_MASTER_GROUPS["0402"]; // کش
    }
    if (cleanCode.startsWith("0104") || cleanName.includes("لاستیک")) {
        return SAYAN_MASTER_GROUPS["0104"]; // لاستیک
    }
    if (cleanCode.startsWith("0403") || cleanName.includes("جوشی") || cleanName.includes("ساپورت")) {
        return SAYAN_MASTER_GROUPS["0403"]; // اسپاندکس جوشی (ساپورت)
    }
    if (cleanCode.startsWith("0408") || cleanName.includes("ملت")) {
        return SAYAN_MASTER_GROUPS["0408"]; // نخ ملت
    }
    if (cleanCode.startsWith("0410") || cleanName.includes("fdy")) {
        return SAYAN_MASTER_GROUPS["0410"]; // FDY
    }
    if (cleanCode.startsWith("0101") || cleanName.includes("چیپس")) {
        return SAYAN_MASTER_GROUPS["0101"]; // چیپس
    }
    if (cleanCode.startsWith("0106") || cleanName.includes("اسپان")) {
        return SAYAN_MASTER_GROUPS["0106"]; // پلی استر اسپان
    }
    if (cleanCode.startsWith("0107") || cleanName.includes("مستربچ")) {
        return SAYAN_MASTER_GROUPS["0107"]; // مستربچ
    }
    if (cleanCode.startsWith("0108") || (cleanName.includes("نایلون") && cleanCode.startsWith("01"))) {
        return SAYAN_MASTER_GROUPS["0108"]; // نایلون مواد اولیه
    }
    if (cleanCode.startsWith("0407") || (cleanName.includes("نایلون") && cleanCode.startsWith("04"))) {
        return SAYAN_MASTER_GROUPS["0407"]; // نایلون محصولات
    }

    const fallbackCategory = cleanCode.startsWith("01") ? "مواد اولیه" : cleanCode.startsWith("04") ? "محصولات" : "سایر";
    return {
        code: prefix4 || "سایر",
        title: cleanName || `گروه ${prefix4 || "سایر"}`,
        parentCategory: fallbackCategory as any,
        unit: "کیلوگرم"
    };
};

export default function ProductionReturnTab({
    dateFrom,
    dateTo,
    currentUser,
    settings,
    getEffectiveApiUrl = (url: string) => url
}: ProductionReturnTabProps) {
    const [prodReturnsData, setProdReturnsData] = useState<any[]>([]);
    const [isFetchingProdReturns, setIsFetchingProdReturns] = useState(false);
    const [selectedDocModal, setSelectedDocModal] = useState<any | null>(null);
    const [prodReturnsSearch, setProdReturnsSearch] = useState("");
    const [selectedProductFilter, setSelectedProductFilter] = useState<string>("all");
    const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("all");
    const [activeViewMode, setActiveViewMode] = useState<"groups" | "items" | "documents">("groups");
    const [expandedGroupCodes, setExpandedGroupCodes] = useState<Set<string>>(new Set());
    const [isSendingBot, setIsSendingBot] = useState(false);

    // Prevent body scrolling when modal is active
    useEffect(() => {
        if (selectedDocModal) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [selectedDocModal]);

    // Fetch Prod Returns data (Operation Code 44)
    const fetchProdReturns = async () => {
        setIsFetchingProdReturns(true);
        try {
            const effectiveUrl = getEffectiveApiUrl('/api/sayan/production-returns');
            const res = await fetch(`${effectiveUrl}?dateFrom=${encodeURIComponent(dateFrom || '')}&dateTo=${encodeURIComponent(dateTo || '')}`);
            const data = await res.json();
            
            const rawList = Array.isArray(data.items)
                ? data.items
                : Array.isArray(data.data)
                ? data.data
                : Array.isArray(data.rows)
                ? data.rows
                : Array.isArray(data)
                ? data
                : [];

            // Filter out auxiliary packaging materials (02%) and keep authentic production goods (04%), raw materials (01%), waste (05%)
            const productionOnlyList = rawList.filter((item: any) => {
                const c = String(item.ItemCode || item.code || item.item_code || '').trim();
                // Exclude packaging materials (cartons, boxes, pallets, spools starting with 02)
                if (c.startsWith("02")) return false;
                return true;
            });

            // Normalize and enrich each row with Sayan master group metadata
            const normalized = productionOnlyList.map((item: any) => {
                const docNo = String(
                    item.DocNumber || 
                    item.ArchiveCode || 
                    item.DocId || 
                    item.ArchiveNo || 
                    item.SubCode || 
                    item.DocNo || 
                    item.HeaderID || 
                    '-'
                );
                const rawDate = item.Date || item.DocDate || item.date || item.HeaderDate || '';
                const docDate = formatDateToJalali(rawDate);
                const itemCode = String(item.ItemCode || item.code || item.item_code || '').trim();
                const itemName = String(item.ItemName || item.name || item.item_name || '').trim();
                const weight = Number(item.Quantity ?? item.Weight ?? item.Amount ?? item.qty ?? 0);
                const warehouse = String(
                    item.WarehouseName || 
                    (item.WarehouseCode ? `انبار ${item.WarehouseCode}` : '') || 
                    item.Warehouse || 
                    '-'
                );
                const description = String(
                    item.LineNotes || 
                    item.HeaderDescription || 
                    item.DocDescription || 
                    item.Description || 
                    item.notes || 
                    '-'
                );

                // Group mapping from Sayan ERP definition
                const groupDef = detectSayanGroup(itemCode, itemName, item.GroupName);
                const resolvedName = resolveProdItemName(itemCode, itemName);

                return {
                    ...item,
                    DocNo: docNo,
                    DocDate: docDate,
                    ItemCode: itemCode,
                    ItemName: itemName,
                    ResolvedName: resolvedName,
                    Weight: weight,
                    Quantity: weight,
                    WarehouseName: warehouse,
                    Description: description,
                    UnitName: item.UnitName || groupDef.unit || 'کیلوگرم',
                    GroupCode: groupDef.code,
                    GroupTitle: groupDef.title,
                    ParentCategory: groupDef.parentCategory
                };
            });

            setProdReturnsData(normalized);
        } catch (err) {
            console.error("Failed to fetch production returns:", err);
            toast.error("خطا در دریافت اطلاعات برگشت از تولید از سرور سایان");
            setProdReturnsData([]);
        } finally {
            setIsFetchingProdReturns(false);
        }
    };

    useEffect(() => {
        fetchProdReturns();
    }, [dateFrom, dateTo]);

    // Toggle group accordion expand/collapse
    const toggleGroupExpand = (groupCode: string) => {
        setExpandedGroupCodes(prev => {
            const next = new Set(prev);
            if (next.has(groupCode)) {
                next.delete(groupCode);
            } else {
                next.add(groupCode);
            }
            return next;
        });
    };

    // Filter and Analyze data
    const analyzedData = useMemo(() => {
        let filtered = prodReturnsData;

        // Search filter
        if (prodReturnsSearch.trim()) {
            const q = prodReturnsSearch.trim().toLowerCase();
            filtered = filtered.filter(item => 
                String(item.DocNo || "").toLowerCase().includes(q) ||
                String(item.DocDate || "").toLowerCase().includes(q) ||
                String(item.ItemCode || "").toLowerCase().includes(q) ||
                String(item.ItemName || "").toLowerCase().includes(q) ||
                String(item.ResolvedName || "").toLowerCase().includes(q) ||
                String(item.GroupTitle || "").toLowerCase().includes(q) ||
                String(item.WarehouseName || "").toLowerCase().includes(q) ||
                String(item.Description || "").toLowerCase().includes(q)
            );
        }

        // Group Filter
        if (selectedGroupFilter !== "all") {
            filtered = filtered.filter(item => item.GroupCode === selectedGroupFilter);
        }

        // Single Product Filter
        if (selectedProductFilter !== "all") {
            filtered = filtered.filter(item => 
                item.ItemCode === selectedProductFilter || 
                item.ResolvedName === selectedProductFilter ||
                item.ItemName === selectedProductFilter
            );
        }

        // Aggregations
        let totalWeight = 0;
        let totalRawMaterialWeight = 0;
        let totalProductsWeight = 0;
        let totalOtherWeight = 0;

        // Group Map: ONLY GROUPS WITH ITEMS PRESENT IN THE DOCUMENTS
        const groupMap = new Map<string, {
            code: string;
            title: string;
            parentCategory: string;
            unit: string;
            totalQty: number;
            itemsCount: number;
            subItemsMap: Map<string, {
                code: string;
                name: string;
                resolvedName: string;
                totalWeight: number;
                count: number;
                unit: string;
                warehouses: Set<string>;
            }>;
        }>();

        // Individual Items Map (Detailed Products Map)
        const itemsMap = new Map<string, {
            code: string;
            name: string;
            resolvedName: string;
            groupCode: string;
            groupTitle: string;
            parentCategory: string;
            totalWeight: number;
            count: number;
            unit: string;
            warehouses: Set<string>;
            docs: Set<string>;
        }>();

        // Documents Map
        const docsMap = new Map<string, {
            docNo: string;
            docDate: string;
            warehouse: string;
            desc: string;
            totalWeight: number;
            itemsCount: number;
            rows: any[];
        }>();

        filtered.forEach(item => {
            const weight = Number(item.Weight || item.Quantity || 0);
            totalWeight += weight;

            if (item.ParentCategory === "مواد اولیه") {
                totalRawMaterialWeight += weight;
            } else if (item.ParentCategory === "محصولات") {
                totalProductsWeight += weight;
            } else {
                totalOtherWeight += weight;
            }

            // 1. Group Aggregation (Only created when item exists!)
            const grpKey = item.GroupCode || "0000";
            if (!groupMap.has(grpKey)) {
                groupMap.set(grpKey, {
                    code: item.GroupCode,
                    title: item.GroupTitle,
                    parentCategory: item.ParentCategory,
                    unit: item.UnitName || "کیلوگرم",
                    totalQty: 0,
                    itemsCount: 0,
                    subItemsMap: new Map()
                });
            }
            const grp = groupMap.get(grpKey)!;
            grp.totalQty += weight;
            grp.itemsCount += 1;

            // Sub-item inside group
            const subKey = item.ItemCode || item.ResolvedName;
            if (!grp.subItemsMap.has(subKey)) {
                grp.subItemsMap.set(subKey, {
                    code: item.ItemCode,
                    name: item.ItemName,
                    resolvedName: item.ResolvedName,
                    totalWeight: 0,
                    count: 0,
                    unit: item.UnitName || "کیلوگرم",
                    warehouses: new Set()
                });
            }
            const subItem = grp.subItemsMap.get(subKey)!;
            subItem.totalWeight += weight;
            subItem.count += 1;
            if (item.WarehouseName && item.WarehouseName !== "-") subItem.warehouses.add(item.WarehouseName);

            // 2. Individual Item Aggregation
            const itemKey = `${item.ItemCode}_${item.ResolvedName}`;
            if (!itemsMap.has(itemKey)) {
                itemsMap.set(itemKey, {
                    code: item.ItemCode,
                    name: item.ItemName,
                    resolvedName: item.ResolvedName,
                    groupCode: item.GroupCode,
                    groupTitle: item.GroupTitle,
                    parentCategory: item.ParentCategory,
                    totalWeight: 0,
                    count: 0,
                    unit: item.UnitName || "کیلوگرم",
                    warehouses: new Set(),
                    docs: new Set()
                });
            }
            const itm = itemsMap.get(itemKey)!;
            itm.totalWeight += weight;
            itm.count += 1;
            if (item.WarehouseName && item.WarehouseName !== "-") itm.warehouses.add(item.WarehouseName);
            if (item.DocNo) itm.docs.add(item.DocNo);

            // 3. Document Aggregation
            const docNo = String(item.DocNo || "نامشخص");
            if (!docsMap.has(docNo)) {
                docsMap.set(docNo, {
                    docNo,
                    docDate: item.DocDate || "-",
                    warehouse: item.WarehouseName || "-",
                    desc: item.Description || "-",
                    totalWeight: 0,
                    itemsCount: 0,
                    rows: []
                });
            }
            const docEntry = docsMap.get(docNo)!;
            docEntry.totalWeight += weight;
            docEntry.itemsCount += 1;
            docEntry.rows.push(item);
        });

        // Convert Maps to sorted arrays
        const groupsList = Array.from(groupMap.values())
            .map(g => ({
                ...g,
                subItems: Array.from(g.subItemsMap.values()).sort((a, b) => b.totalWeight - a.totalWeight)
            }))
            .sort((a, b) => b.totalQty - a.totalQty);

        const itemsList = Array.from(itemsMap.values()).sort((a, b) => b.totalWeight - a.totalWeight);
        const documentsList = Array.from(docsMap.values()).sort((a, b) => String(b.docNo).localeCompare(String(a.docNo), "en", { numeric: true }));

        return {
            filteredRaw: filtered,
            totalWeight,
            totalRawMaterialWeight,
            totalProductsWeight,
            totalOtherWeight,
            groupsList,
            itemsList,
            documentsList
        };
    }, [prodReturnsData, prodReturnsSearch, selectedGroupFilter, selectedProductFilter]);

    // Unique options for filters
    const filterOptions = useMemo(() => {
        const groups = new Map<string, { code: string; title: string; category: string }>();
        const products = new Map<string, { code: string; name: string }>();

        prodReturnsData.forEach(item => {
            if (item.GroupCode && !groups.has(item.GroupCode)) {
                groups.set(item.GroupCode, {
                    code: item.GroupCode,
                    title: item.GroupTitle,
                    category: item.ParentCategory
                });
            }
            const prodCode = item.ItemCode;
            if (prodCode && !products.has(prodCode)) {
                const displayName = item.ItemName && item.ItemName !== item.ItemCode && item.ItemName !== "کالای بدون نام"
                    ? `${item.ItemName} (${item.ItemCode})`
                    : (item.ResolvedName || `کد ${item.ItemCode}`);
                products.set(prodCode, {
                    code: item.ItemCode,
                    name: displayName
                });
            }
        });

        return {
            groups: Array.from(groups.values()).sort((a, b) => a.code.localeCompare(b.code)),
            products: Array.from(products.values()).sort((a, b) => a.name.localeCompare(b.name, "fa"))
        };
    }, [prodReturnsData]);

    // Fast filter by clicking a specific item
    const handleFilterByItem = (itemCode: string, itemName: string) => {
        setSelectedProductFilter(itemCode || itemName);
        toast.success(`فیلتر روی کالای "${itemName}" اعمال شد`);
    };

    // Send Telegram Bot Notification
    const handleSendReturnsBot = async () => {
        setIsSendingBot(true);
        try {
            const textLines = [
                `🔄 *گزارش برگشت از تولید به انبار (عملیات ۴۴)*`,
                `📅 بازه: ${dateFrom || "ابتدای دوره"} الی ${dateTo || "امروز"}`,
                `⚖️ *مجموع کل وزن:* ${Math.round(analyzedData.totalWeight).toLocaleString("fa-IR")} کیلوگرم`,
                `🧶 *محصولات تولیدی:* ${Math.round(analyzedData.totalProductsWeight).toLocaleString("fa-IR")} کیلوگرم`,
                `🧵 *مواد اولیه و کش:* ${Math.round(analyzedData.totalRawMaterialWeight).toLocaleString("fa-IR")} کیلوگرم`,
                `📄 *تعداد اسناد:* ${analyzedData.documentsList.length.toLocaleString("fa-IR")} سند`,
                ``,
                `📊 *گروه‌های کالا (سرفصل‌های موجود در اسناد):*`
            ];

            analyzedData.groupsList.forEach((grp, idx) => {
                textLines.push(`${idx + 1}. [${grp.code}] ${grp.title} (${grp.parentCategory}): ${Math.round(grp.totalQty).toLocaleString("fa-IR")} ک‌گ (${grp.subItems.length} قلم)`);
            });

            const effectiveUrl = getEffectiveApiUrl('/api/telegram/send');
            const res = await fetch(effectiveUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: textLines.join("\n") })
            });

            if (res.ok) {
                toast.success("گزارش برگشت از تولید با موفقیت به ربات ارسال شد ✅");
            } else {
                toast.error("خطا در ارسال پیام به بات تلگرام");
            }
        } catch (e) {
            console.error("Bot send error:", e);
            toast.error("عدم برقراری ارتباط با سرور بات");
        } finally {
            setIsSendingBot(false);
        }
    };

    // Print Single Document
    const handlePrintSingleDoc = (doc: any) => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            toast.error("لطفاً اجازه باز شدن پنجره پاپ‌آپ چاپ را بدهید");
            return;
        }

        const rowsHtml = (doc.rows || []).map((row: any, idx: number) => `
            <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td style="font-family: monospace;">${row.ItemCode || '-'}</td>
                <td style="font-weight: bold;">${row.ResolvedName || resolveProdItemName(row.ItemCode, row.ItemName)}</td>
                <td style="text-align: center;">${row.GroupTitle || '-'}</td>
                <td style="text-align: left; font-family: monospace; font-weight: bold;">${Math.round(Number(row.Weight || row.Quantity || 0)).toLocaleString("fa-IR")}</td>
                <td style="text-align: center;">${row.UnitName || 'کیلوگرم'}</td>
                <td>${row.WarehouseName || '-'}</td>
                <td>${row.Description || '-'}</td>
            </tr>
        `).join("");

        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="UTF-8" />
                <title>رسید برگشت از تولید - سند شماره ${doc.docNo}</title>
                <style>
                    body { font-family: Tahoma, 'Segoe UI', sans-serif; direction: rtl; padding: 20px; font-size: 12px; color: #111; }
                    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 15px; }
                    .title { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
                    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); margin-bottom: 15px; background: #f9f9f9; padding: 10px; border-radius: 6px; border: 1px solid #ddd; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #999; padding: 6px 8px; font-size: 11px; }
                    th { background: #eee; font-weight: bold; }
                    .total-box { margin-top: 15px; text-align: left; font-size: 13px; font-weight: bold; }
                    .footer { margin-top: 40px; display: flex; justify-content: space-between; padding: 0 30px; font-size: 11px; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">رسید برگشت کالا از تولید به انبار (کد عملیات ۴۴)</div>
                    <div>نرم‌افزار جامع مدیریت کارخانه و انبار</div>
                </div>
                <div class="meta-grid">
                    <div><strong>شماره سند:</strong> <span style="font-family: monospace;">${doc.docNo}</span></div>
                    <div><strong>تاریخ سند:</strong> ${doc.docDate}</div>
                    <div><strong>انبار تحویل‌گیرنده:</strong> ${doc.warehouse}</div>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;">ردیف</th>
                            <th style="width: 110px;">کد کالا</th>
                            <th>نام و مشخصات کالا</th>
                            <th style="width: 120px; text-align: center;">گروه کالا</th>
                            <th style="width: 100px; text-align: left;">وزن برگشتی</th>
                            <th style="width: 70px; text-align: center;">واحد</th>
                            <th>انبار</th>
                            <th>توضیحات</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
                <div class="total-box">
                    <span>مجموع وزن کل سند: </span>
                    <span style="font-family: monospace; font-size: 14px;">${Math.round(doc.totalWeight).toLocaleString("fa-IR")} کیلوگرم</span>
                </div>
                <div class="footer">
                    <div>امضا تحویل‌دهنده (سالن بافت/تولید): ....................</div>
                    <div>امضا انباردار / تحویل‌گیرنده: ....................</div>
                    <div>تاریخ چاپ: ${new Date().toLocaleDateString("fa-IR")}</div>
                </div>
                <script>
                    window.onload = function() { window.print(); };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    // Export to Excel
    const handleExportExcel = () => {
        try {
            const dataToExport = analyzedData.itemsList.map((item, idx) => ({
                "ردیف": idx + 1,
                "کد کالا": item.code,
                "شرح و نام کالا": item.resolvedName || item.name,
                "کد گروه سرفصل": item.groupCode,
                "عنوان گروه کالا": item.groupTitle,
                "سرفصل اصلی": item.parentCategory,
                "مجموع وزن (کیلوگرم)": Math.round(item.totalWeight),
                "تعداد اسناد/اقلام": item.count,
                "انبارها": Array.from(item.warehouses).join(", ")
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "برگشت_از_تولید_سایان");
            XLSX.writeFile(wb, `Production_Returns_Sayan_${dateFrom}_to_${dateTo}.xlsx`);
            toast.success("فایل اکسل با موفقیت ایجاد و دانلود شد 📊");
        } catch (err) {
            console.error("Failed to export excel", err);
            toast.error("خطا در صدور فایل اکسل");
        }
    };

    return (
        <div className="p-3 sm:p-6 space-y-5">
            {/* Header and Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
                <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                        <Undo2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <span>رسید برگشت از تولید به انبار (کد عملیات ۴۴)</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                        گزارش سرفصل و گروه کالاها، تفکیک کالا به کالا، و اسناد ثبت‌شده در پایگاه داده سایان
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Bot Notification Button */}
                    <button
                        onClick={handleSendReturnsBot}
                        disabled={isSendingBot}
                        className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-black transition-all shadow-sm shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="ارسال خلاصه گزارش به کانال/گروه تلگرام"
                    >
                        {isSendingBot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        <span>ارسال به بات</span>
                    </button>

                    {/* Export Excel Button */}
                    <button
                        onClick={handleExportExcel}
                        disabled={analyzedData.itemsList.length === 0}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-all shadow-sm shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>خروجی اکسل</span>
                    </button>

                    {/* Refresh Button */}
                    <button
                        onClick={fetchProdReturns}
                        disabled={isFetchingProdReturns}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isFetchingProdReturns ? 'animate-spin' : ''}`} />
                        <span>بروزرسانی</span>
                    </button>
                </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Total Weight */}
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/40 dark:to-indigo-900/20 border border-indigo-200/80 dark:border-indigo-800/50 rounded-xl p-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-indigo-700 dark:text-indigo-400">مجموع کل وزن برگشتی</span>
                        <PackageCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-xl sm:text-2xl font-black font-mono text-indigo-950 dark:text-indigo-100">
                            {Math.round(analyzedData.totalWeight).toLocaleString("fa-IR")}
                        </span>
                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">کیلوگرم</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 font-bold">
                        {analyzedData.filteredRaw.length} ردیف کالای ثبت‌شده
                    </div>
                </div>

                {/* Products Weight */}
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20 border border-emerald-200/80 dark:border-emerald-800/50 rounded-xl p-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-400">محصولات تولیدی</span>
                        <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-xl sm:text-2xl font-black font-mono text-emerald-950 dark:text-emerald-100">
                            {Math.round(analyzedData.totalProductsWeight).toLocaleString("fa-IR")}
                        </span>
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">کیلوگرم</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 font-bold">
                        اسپاندکس، شوایتر، کش، ملت و ...
                    </div>
                </div>

                {/* Raw Materials Weight */}
                <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20 border border-amber-200/80 dark:border-amber-800/50 rounded-xl p-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-amber-700 dark:text-amber-400">مواد اولیه و کش</span>
                        <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-xl sm:text-2xl font-black font-mono text-amber-950 dark:text-amber-100">
                            {Math.round(analyzedData.totalRawMaterialWeight).toLocaleString("fa-IR")}
                        </span>
                        <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">کیلوگرم</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 font-bold">
                        POY، DTY، لاکرا، لاستیک، چیپس و ...
                    </div>
                </div>

                {/* Documents Count */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/40 dark:to-purple-900/20 border border-purple-200/80 dark:border-purple-800/50 rounded-xl p-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-purple-700 dark:text-purple-400">اسناد ثبت‌شده</span>
                        <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-xl sm:text-2xl font-black font-mono text-purple-950 dark:text-purple-100">
                            {analyzedData.documentsList.length.toLocaleString("fa-IR")}
                        </span>
                        <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">سند</span>
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1 font-bold">
                        {analyzedData.groupsList.length} گروه فعال در این اسناد
                    </div>
                </div>
            </div>

            {/* Filters and View Mode Controls */}
            <div className="bg-slate-50/80 dark:bg-zinc-900/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 space-y-3">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* View Switcher Tabs */}
                    <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 rounded-lg border border-slate-200 dark:border-zinc-700 w-fit">
                        <button
                            onClick={() => setActiveViewMode("groups")}
                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeViewMode === "groups"
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                            }`}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            <span>گروه کالاها (سرفصل سایان)</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                activeViewMode === "groups" ? "bg-indigo-700 text-white" : "bg-slate-100 dark:bg-zinc-800 text-slate-600"
                            }`}>
                                {analyzedData.groupsList.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveViewMode("items")}
                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeViewMode === "items"
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                            }`}
                        >
                            <Package className="w-3.5 h-3.5" />
                            <span>تفکیک بر اساس کالا</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                activeViewMode === "items" ? "bg-indigo-700 text-white" : "bg-slate-100 dark:bg-zinc-800 text-slate-600"
                            }`}>
                                {analyzedData.itemsList.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveViewMode("documents")}
                            className={`px-3 py-1.5 rounded-md text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                                activeViewMode === "documents"
                                    ? "bg-indigo-600 text-white shadow-xs"
                                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
                            }`}
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span>اسناد ثبت‌شده (رسیدهای ۴۴)</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                activeViewMode === "documents" ? "bg-indigo-700 text-white" : "bg-slate-100 dark:bg-zinc-800 text-slate-600"
                            }`}>
                                {analyzedData.documentsList.length}
                            </span>
                        </button>
                    </div>

                    {/* Search Input */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="جستجو در کد کالا، نام، گروه، شماره سند، انبار..."
                            value={prodReturnsSearch}
                            onChange={(e) => setProdReturnsSearch(e.target.value)}
                            className="w-full text-xs pr-9 pl-8 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-200"
                        />
                        {prodReturnsSearch && (
                            <button
                                onClick={() => setProdReturnsSearch("")}
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Filter Selectors Row */}
                <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-200/50 dark:border-zinc-800">
                    {/* Group Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-indigo-500" />
                            فیلتر گروه:
                        </span>
                        <select
                            value={selectedGroupFilter}
                            onChange={(e) => setSelectedGroupFilter(e.target.value)}
                            className="text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg px-2.5 py-1.5 outline-none font-bold cursor-pointer"
                        >
                            <option value="all">همه گروه‌ها ({filterOptions.groups.length})</option>
                            {filterOptions.groups.map((g) => (
                                <option key={g.code} value={g.code}>
                                    [{g.code}] {g.title} ({g.category})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Single Product Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-slate-500 dark:text-zinc-400 flex items-center gap-1">
                            <Package className="w-3.5 h-3.5 text-emerald-500" />
                            فیلتر کالا:
                        </span>
                        <select
                            value={selectedProductFilter}
                            onChange={(e) => setSelectedProductFilter(e.target.value)}
                            className="text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg px-2.5 py-1.5 outline-none font-bold cursor-pointer max-w-[280px]"
                        >
                            <option value="all">همه کالاها ({filterOptions.products.length})</option>
                            {filterOptions.products.map((p, idx) => (
                                <option key={idx} value={p.code || p.name}>
                                    {p.name} {p.code ? `(${p.code})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Clear Filters Button */}
                    {(prodReturnsSearch || selectedGroupFilter !== "all" || selectedProductFilter !== "all") && (
                        <button
                            onClick={() => {
                                setProdReturnsSearch("");
                                setSelectedGroupFilter("all");
                                setSelectedProductFilter("all");
                            }}
                            className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 bg-rose-50 dark:bg-rose-950/30 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>حذف تمام فیلترها</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Body */}
            {isFetchingProdReturns ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <span className="text-xs font-bold text-slate-500 mt-3">در حال فراخوانی اطلاعات برگشت از تولید از سرور سایان...</span>
                </div>
            ) : analyzedData.groupsList.length === 0 && analyzedData.documentsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl text-slate-400">
                    <FolderOpen className="w-10 h-10 stroke-1 mb-2 text-slate-300" />
                    <span className="text-sm font-bold">هیچ ردیف سند برگشت از تولیدی در این بازه زمانی یافت نشد</span>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* ========================================================================= */}
                    {/* VIEW 1: GROUPS ACCORDION (سرفصل کالاها با امکان باز شدن اقلام زیرمجموعه) */}
                    {/* ========================================================================= */}
                    {activeViewMode === "groups" && (
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                            <div className="bg-slate-50 dark:bg-zinc-950 px-4 py-3 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100">
                                        گروه کالاها (سرفصل‌های موجود در اسناد برگشت از تولید)
                                    </h3>
                                    <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-bold mr-2">
                                        (روی هر ردیف کلیک کنید تا اقلام زیرمجموعه باز شوند)
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            if (expandedGroupCodes.size === analyzedData.groupsList.length) {
                                                setExpandedGroupCodes(new Set());
                                            } else {
                                                setExpandedGroupCodes(new Set(analyzedData.groupsList.map(g => g.code)));
                                            }
                                        }}
                                        className="text-xs text-indigo-600 hover:text-indigo-700 font-bold bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-900/40 cursor-pointer"
                                    >
                                        {expandedGroupCodes.size === analyzedData.groupsList.length ? "بستن همه" : "باز کردن همه اقلام"}
                                    </button>
                                    <span className="text-xs font-bold text-slate-500 font-mono">
                                        {analyzedData.groupsList.length} گروه فعال
                                    </span>
                                </div>
                            </div>

                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full border-collapse text-right text-xs">
                                    <thead>
                                        <tr className="bg-slate-50/50 dark:bg-zinc-900/60 text-slate-500 dark:text-zinc-400 font-black border-b border-slate-100 dark:border-zinc-800">
                                            <th className="p-3 w-10 text-center"></th>
                                            <th className="p-3 w-12 text-center">ردیف</th>
                                            <th className="p-3 w-28 font-mono">کد گروه</th>
                                            <th className="p-3">عنوان گروه کالا</th>
                                            <th className="p-3 w-32 text-center">سرفصل اصلی</th>
                                            <th className="p-3 text-center w-28">تعداد اقلام</th>
                                            <th className="p-3 text-left w-44">مجموع وزن (کیلوگرم)</th>
                                            <th className="p-3 text-center w-24">سهم از کل</th>
                                            <th className="p-3 text-center w-28">عملیات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                        {analyzedData.groupsList.map((grp, idx) => {
                                            const isExpanded = expandedGroupCodes.has(grp.code);
                                            const isRaw = grp.parentCategory === "مواد اولیه";
                                            const isProd = grp.parentCategory === "محصولات";

                                            return (
                                                <React.Fragment key={grp.code}>
                                                    <tr 
                                                        onClick={() => toggleGroupExpand(grp.code)}
                                                        className={`hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors ${
                                                            isExpanded ? "bg-indigo-50/20 dark:bg-indigo-950/10" : ""
                                                        }`}
                                                    >
                                                        <td className="p-3 text-center text-slate-400">
                                                            {isExpanded ? (
                                                                <ChevronUp className="w-4 h-4 text-indigo-600 inline" />
                                                            ) : (
                                                                <ChevronDown className="w-4 h-4 text-slate-400 inline" />
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                                        <td className="p-3 font-mono font-black text-indigo-600 dark:text-indigo-400">
                                                            {grp.code}
                                                        </td>
                                                        <td className="p-3 font-extrabold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                                                            <span className={`w-2.5 h-2.5 rounded-full ${
                                                                isProd ? "bg-emerald-500" : isRaw ? "bg-indigo-500" : "bg-amber-500"
                                                            }`}></span>
                                                            <span className="text-sm">{grp.title}</span>
                                                            <span className="text-[10px] text-slate-400 font-normal">
                                                                ({grp.subItems.length} کالای مجزا)
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                                                isProd 
                                                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                                                    : isRaw
                                                                    ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300"
                                                                    : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                                                            }`}>
                                                                {grp.parentCategory}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-zinc-300">
                                                            {grp.itemsCount} ردیف
                                                        </td>
                                                        <td className="p-3 text-left font-black text-slate-900 dark:text-zinc-100 font-mono text-sm">
                                                            {Math.round(grp.totalQty).toLocaleString("fa-IR")}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <span className="inline-block bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px] font-black font-mono px-2 py-0.5 rounded-full">
                                                                {analyzedData.totalWeight > 0 ? ((grp.totalQty / analyzedData.totalWeight) * 100).toFixed(1) : 0}%
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => setSelectedGroupFilter(grp.code)}
                                                                className="px-2 py-1 bg-slate-100 hover:bg-indigo-100 dark:bg-zinc-800 dark:hover:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded text-[11px] font-bold transition-colors cursor-pointer"
                                                                title="فیلتر فقط روی این گروه"
                                                            >
                                                                فیلتر این گروه
                                                            </button>
                                                        </td>
                                                    </tr>

                                                    {/* Expandable Nested Sub-Items Table */}
                                                    {isExpanded && (
                                                        <tr className="bg-slate-50/70 dark:bg-zinc-950/40">
                                                            <td colSpan={9} className="p-3 pr-8 pl-4">
                                                                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-3 space-y-2 shadow-inner">
                                                                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
                                                                        <span className="font-extrabold text-xs text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                                                                            <Package className="w-3.5 h-3.5 text-indigo-500" />
                                                                            کالاهای زیرمجموعه گروه «{grp.title}» ({grp.subItems.length} قلم):
                                                                        </span>
                                                                        <span className="text-[11px] font-mono font-bold text-indigo-600">
                                                                            مجموع وزن گروه: {Math.round(grp.totalQty).toLocaleString("fa-IR")} کیلوگرم
                                                                        </span>
                                                                    </div>

                                                                    <table className="w-full border-collapse text-right text-xs">
                                                                        <thead>
                                                                            <tr className="text-slate-400 dark:text-zinc-500 font-bold border-b border-slate-100 dark:border-zinc-800 text-[11px]">
                                                                                <th className="p-2 w-8 text-center">#</th>
                                                                                <th className="p-2 w-28 font-mono">کد کالا</th>
                                                                                <th className="p-2">نام و مشخصات کالا</th>
                                                                                <th className="p-2 text-center w-24">تعداد ثبت</th>
                                                                                <th className="p-2 text-left w-36">وزن برگشتی</th>
                                                                                <th className="p-2 text-center w-20">سهم از گروه</th>
                                                                                <th className="p-2">انبارها</th>
                                                                                <th className="p-2 text-center w-24">عملیات</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/40">
                                                                            {grp.subItems.map((sub, sIdx) => (
                                                                                <tr key={sIdx} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30">
                                                                                    <td className="p-2 text-center text-slate-400 text-[11px]">{sIdx + 1}</td>
                                                                                    <td className="p-2 font-mono font-bold text-slate-700 dark:text-zinc-300">{sub.code || '-'}</td>
                                                                                    <td className="p-2 font-bold text-slate-900 dark:text-zinc-100">
                                                                                        {sub.resolvedName || sub.name}
                                                                                    </td>
                                                                                    <td className="p-2 text-center font-mono">{sub.count}</td>
                                                                                    <td className="p-2 text-left font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                                                                        {Math.round(sub.totalWeight).toLocaleString("fa-IR")} <span className="text-[10px] text-slate-400">ک‌گ</span>
                                                                                    </td>
                                                                                    <td className="p-2 text-center font-mono text-[11px] text-slate-500">
                                                                                        {grp.totalQty > 0 ? ((sub.totalWeight / grp.totalQty) * 100).toFixed(1) : 0}%
                                                                                    </td>
                                                                                    <td className="p-2 text-slate-500 text-[11px]">
                                                                                        {Array.from(sub.warehouses).join(", ") || "-"}
                                                                                    </td>
                                                                                    <td className="p-2 text-center">
                                                                                        <button
                                                                                            onClick={() => handleFilterByItem(sub.code, sub.resolvedName || sub.name)}
                                                                                            className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-bold transition-colors cursor-pointer"
                                                                                        >
                                                                                            فیلتر کالا
                                                                                        </button>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-slate-50 dark:bg-zinc-950 font-black border-t border-slate-200 dark:border-zinc-800">
                                        <tr>
                                            <td colSpan={5} className="p-3 text-slate-800 dark:text-zinc-100">جمع کل سرفصل‌ها و گروه‌های کالا</td>
                                            <td className="p-3 text-center font-mono">{analyzedData.groupsList.reduce((acc, g) => acc + g.itemsCount, 0)} ردیف</td>
                                            <td className="p-3 text-left font-mono text-indigo-700 dark:text-indigo-400 text-sm">{Math.round(analyzedData.totalWeight).toLocaleString("fa-IR")}</td>
                                            <td className="p-3 text-center font-mono">۱۰۰%</td>
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* VIEW 2: ITEMS BREAKDOWN TABLE (تفکیک تک‌تک اقلام و کالاهای برگشتی) */}
                    {/* ========================================================================= */}
                    {activeViewMode === "items" && (
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                            <div className="bg-slate-50 dark:bg-zinc-950 px-4 py-3 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100">
                                        تفکیک بر اساس کالا (فهرست کامل اقلام برگشتی)
                                    </h3>
                                </div>
                                <span className="text-xs font-bold text-slate-500 font-mono">
                                    {analyzedData.itemsList.length} کالای متمایز
                                </span>
                            </div>

                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full border-collapse text-right text-xs">
                                    <thead>
                                        <tr className="bg-slate-50/50 dark:bg-zinc-900/60 text-slate-500 dark:text-zinc-400 font-black border-b border-slate-100 dark:border-zinc-800">
                                            <th className="p-3 w-12 text-center">ردیف</th>
                                            <th className="p-3 w-32 font-mono">کد کالا</th>
                                            <th className="p-3">نام و مشخصات کالا</th>
                                            <th className="p-3 w-36">گروه سرفصل</th>
                                            <th className="p-3 text-center w-28">تعداد اسناد</th>
                                            <th className="p-3 text-left w-40">مجموع وزن (کیلوگرم)</th>
                                            <th className="p-3 text-center w-24">سهم از کل</th>
                                            <th className="p-3">انبارها</th>
                                            <th className="p-3 text-center w-24">عملیات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                        {analyzedData.itemsList.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                                <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                                <td className="p-3 font-mono font-bold text-slate-700 dark:text-zinc-300">{item.code || '-'}</td>
                                                <td className="p-3 font-extrabold text-slate-900 dark:text-zinc-100">
                                                    {item.resolvedName || item.name}
                                                </td>
                                                <td className="p-3">
                                                    <span className="inline-block bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px] font-bold px-2 py-0.5 rounded">
                                                        {item.groupTitle}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-zinc-300">
                                                    {item.docs.size} سند ({item.count} قلم)
                                                </td>
                                                <td className="p-3 text-left font-black text-slate-900 dark:text-zinc-100 font-mono text-sm">
                                                    {Math.round(item.totalWeight).toLocaleString("fa-IR")}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className="inline-block bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 text-[11px] font-black font-mono px-2 py-0.5 rounded-full">
                                                        {analyzedData.totalWeight > 0 ? ((item.totalWeight / analyzedData.totalWeight) * 100).toFixed(1) : 0}%
                                                    </span>
                                                </td>
                                                <td className="p-3 text-slate-500 text-[11px]">
                                                    {Array.from(item.warehouses).join(", ") || "-"}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <button
                                                        onClick={() => handleFilterByItem(item.code, item.resolvedName || item.name)}
                                                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 rounded text-[11px] font-bold transition-colors cursor-pointer"
                                                    >
                                                        فیلتر کالا
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 dark:bg-zinc-950 font-black border-t border-slate-200 dark:border-zinc-800">
                                        <tr>
                                            <td colSpan={4} className="p-3 text-slate-800 dark:text-zinc-100">جمع کل کالاها</td>
                                            <td className="p-3 text-center font-mono">{analyzedData.itemsList.reduce((acc, i) => acc + i.count, 0)}</td>
                                            <td className="p-3 text-left font-mono text-indigo-700 dark:text-indigo-400 text-sm">{Math.round(analyzedData.totalWeight).toLocaleString("fa-IR")}</td>
                                            <td className="p-3 text-center font-mono">۱۰۰%</td>
                                            <td colSpan={2}></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ========================================================================= */}
                    {/* VIEW 3: DOCUMENTS LIST (اسناد تفکیکی برگشت از تولید) */}
                    {/* ========================================================================= */}
                    {activeViewMode === "documents" && (
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                            <div className="bg-slate-50 dark:bg-zinc-950 px-4 py-3 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                    <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100">
                                        بر اساس سندهای ثبت شده (اسناد تفکیکی برگشت از تولید)
                                    </h3>
                                </div>
                                <span className="text-xs font-bold text-slate-500 font-mono">
                                    {analyzedData.documentsList.length} سند ثبت‌شده
                                </span>
                            </div>

                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full border-collapse text-right text-xs">
                                    <thead>
                                        <tr className="bg-slate-50/50 dark:bg-zinc-900/60 text-slate-500 dark:text-zinc-400 font-black border-b border-slate-100 dark:border-zinc-800">
                                            <th className="p-3 w-14 text-center">ردیف</th>
                                            <th className="p-3 w-32 font-mono">شماره سند</th>
                                            <th className="p-3 w-32">تاریخ سند</th>
                                            <th className="p-3">انبار دریافت‌کننده</th>
                                            <th className="p-3 text-center w-28">تعداد اقلام</th>
                                            <th className="p-3 text-left w-40">وزن کل سند (کیلوگرم)</th>
                                            <th className="p-3 text-center w-28">عملیات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                        {analyzedData.documentsList.map((doc, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                                <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                                <td className="p-3 font-mono font-black text-indigo-600 dark:text-indigo-400">{doc.docNo}</td>
                                                <td className="p-3 font-mono font-bold text-slate-600 dark:text-zinc-400">{doc.docDate}</td>
                                                <td className="p-3 font-bold text-slate-800 dark:text-zinc-200">{doc.warehouse}</td>
                                                <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-zinc-300">{doc.itemsCount}</td>
                                                <td className="p-3 text-left font-black text-slate-900 dark:text-zinc-100 font-mono text-sm">
                                                    {Math.round(doc.totalWeight).toLocaleString("fa-IR")}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => setSelectedDocModal(doc)}
                                                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                                            title="مشاهده اقلام سند"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            <span>مشاهده</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handlePrintSingleDoc(doc)}
                                                            className="p-1.5 text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                                                            title="چاپ رسید رسمی این سند"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 dark:bg-zinc-950 font-black border-t border-slate-200 dark:border-zinc-800">
                                        <tr>
                                            <td colSpan={4} className="p-3 text-slate-800 dark:text-zinc-100">جمع کل اسناد ثبت‌شده</td>
                                            <td className="p-3 text-center font-mono">{analyzedData.documentsList.reduce((acc, d) => acc + d.itemsCount, 0)}</td>
                                            <td className="p-3 text-left font-mono text-indigo-700 dark:text-indigo-400 text-sm">{Math.round(analyzedData.totalWeight).toLocaleString("fa-IR")}</td>
                                            <td className="p-3 text-center"></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* PORTAL MODAL: DOCUMENT DETAILS (ALWAYS AT THE EXACT CENTER OF THE SCREEN) */}
            {/* ========================================================================= */}
            {selectedDocModal && typeof document !== "undefined" && createPortal(
                <div 
                    className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setSelectedDocModal(null);
                    }}
                >
                    <div 
                        className="bg-white dark:bg-zinc-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[85vh] my-auto m-auto relative z-10 animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950 shrink-0">
                            <div>
                                <h3 className="font-black text-sm sm:text-base text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-indigo-600" />
                                    <span>جزئیات و اقلام سند برگشت از تولید {selectedDocModal.docNo}</span>
                                </h3>
                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-zinc-400 mt-1 font-bold">
                                    <span>تاریخ: {selectedDocModal.docDate}</span>
                                    <span>•</span>
                                    <span>انبار: {selectedDocModal.warehouse}</span>
                                    <span>•</span>
                                    <span>تعداد اقلام: {selectedDocModal.itemsCount} ردیف</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedDocModal(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                            <table className="w-full border-collapse text-right text-xs">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-100 dark:border-zinc-800">
                                        <th className="p-2.5 w-10 text-center">ردیف</th>
                                        <th className="p-2.5 w-28 font-mono">کد کالا</th>
                                        <th className="p-2.5">نام و مشخصات کالا</th>
                                        <th className="p-2.5 w-32">گروه سرفصل</th>
                                        <th className="p-2.5 text-left w-32">وزن برگشتی</th>
                                        <th className="p-2.5 text-center w-20">واحد</th>
                                        <th className="p-2.5">توضیحات ردیف</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                    {(selectedDocModal.rows || []).map((r: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                                            <td className="p-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                                            <td className="p-2.5 font-mono font-bold text-slate-600 dark:text-zinc-400">{r.ItemCode}</td>
                                            <td className="p-2.5 font-extrabold text-slate-800 dark:text-zinc-200">
                                                {r.ResolvedName || resolveProdItemName(r.ItemCode, r.ItemName)}
                                            </td>
                                            <td className="p-2.5">
                                                <span className="inline-block bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[10px] font-bold px-2 py-0.5 rounded">
                                                    {r.GroupTitle || detectSayanGroup(r.ItemCode, r.ItemName).title}
                                                </span>
                                            </td>
                                            <td className="p-2.5 text-left font-black text-slate-900 dark:text-zinc-100 font-mono">
                                                {Math.round(Number(r.Weight || r.Quantity || 0)).toLocaleString("fa-IR")}
                                            </td>
                                            <td className="p-2.5 text-center text-slate-500">{r.UnitName || "کیلوگرم"}</td>
                                            <td className="p-2.5 text-slate-500 text-[11px]">{r.Description || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 dark:bg-zinc-950 font-black border-t border-slate-200 dark:border-zinc-800">
                                    <tr>
                                        <td colSpan={4} className="p-2.5 text-slate-800 dark:text-zinc-100">جمع کل وزن سند</td>
                                        <td className="p-2.5 text-left font-mono text-indigo-600 dark:text-indigo-400 text-sm">
                                            {Math.round(selectedDocModal.totalWeight).toLocaleString("fa-IR")}
                                        </td>
                                        <td colSpan={2} className="p-2.5 text-slate-500 text-xs">کیلوگرم</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950 shrink-0">
                            <button
                                onClick={() => handlePrintSingleDoc(selectedDocModal)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                            >
                                <Printer className="w-4 h-4" />
                                <span>چاپ رسید رسمی سند</span>
                            </button>

                            <button
                                onClick={() => setSelectedDocModal(null)}
                                className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-slate-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                            >
                                بستن
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
