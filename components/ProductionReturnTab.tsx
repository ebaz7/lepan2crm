import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
    Loader2, RefreshCw, Printer, Download, Search, X, Eye, FileText, 
    ChevronDown, ChevronUp, Layers, Send, CheckCircle2, AlertTriangle, 
    AlertCircle, Sparkles, Building, BarChart2, PackageCheck, Archive, Filter,
    Undo2, FolderOpen, FileSpreadsheet, EyeOff
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
    const [selectedProductForReport, setSelectedProductForReport] = useState<string>("all");
    const [isSendingBot, setIsSendingBot] = useState(false);

    // Fetch Prod Returns data (Operation Code 44)
    const fetchProdReturns = async () => {
        setIsFetchingProdReturns(true);
        try {
            const effectiveUrl = getEffectiveApiUrl('/api/sayan/production-returns');
            const res = await fetch(`${effectiveUrl}?dateFrom=${encodeURIComponent(dateFrom || '')}&dateTo=${encodeURIComponent(dateTo || '')}`);
            const data = await res.json();
            
            // Handle multiple response formats gracefully
            const rawList = Array.isArray(data.items)
                ? data.items
                : Array.isArray(data.data)
                ? data.data
                : Array.isArray(data.rows)
                ? data.rows
                : Array.isArray(data)
                ? data
                : [];

            // Normalize and enrich each row
            const normalized = rawList.map((item: any) => {
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

                return {
                    ...item,
                    DocNo: docNo,
                    DocDate: docDate,
                    ItemCode: itemCode,
                    ItemName: itemName,
                    Weight: weight,
                    Quantity: weight,
                    WarehouseName: warehouse,
                    Description: description,
                    UnitName: item.UnitName || 'کیلوگرم'
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

    // Name resolver for items
    const resolveProdItemName = (code: string, rawName: string): string => {
        const cleanCode = (code || "").trim();
        const cleanName = (rawName || "").trim();

        if (cleanCode.startsWith("01020203") || cleanCode.startsWith("010203")) return "نخ شوایتر 150/48";
        if (cleanCode.startsWith("01020204") || cleanCode.startsWith("010204")) return "نخ شوایتر 100/36";
        if (cleanCode.startsWith("01020205") || cleanCode.startsWith("010205")) return "نخ شوایتر 75/36";
        if (cleanCode.startsWith("01020206") || cleanCode.startsWith("010206")) return "نخ شوایتر 300/96";
        if (cleanCode.startsWith("01020209") || cleanCode.startsWith("010209")) return "نخ شوایتر 150/144";
        if (cleanCode.startsWith("01020214") || cleanCode.startsWith("010214")) return "نخ شوایتر 50/24";
        if (cleanCode.startsWith("01020216") || cleanCode.startsWith("010216")) return "نخ شوایتر 75/72";
        if (cleanCode.startsWith("01030211") || cleanCode.startsWith("010311")) return "نخ DTY 150/48";
        if (cleanCode.startsWith("010302") || cleanCode.startsWith("0103")) return "نخ DTY";
        if (cleanCode.startsWith("0101")) return "نخ POY";
        if (cleanCode.startsWith("0104")) return "نخ کش (Rubber)";
        if (cleanCode.startsWith("0105")) return "نخ لاکرا (Lycra)";

        return cleanName || (cleanCode ? `کالای کد ${cleanCode}` : 'کالای نامشخص');
    };

    // Helper for category classification
    const categorizeItem = (code: string, name: string): "production" | "raw_material" | "packaging" | "other" => {
        const c = (code || "").trim();
        const n = (name || "").trim();
        if (c.startsWith("0102") || c.startsWith("0103") || n.includes("شوایتر") || n.includes("DTY")) {
            return "production";
        }
        if (c.startsWith("0101") || c.startsWith("0104") || c.startsWith("0105") || n.includes("POY") || n.includes("لاکرا") || n.includes("کش")) {
            return "raw_material";
        }
        if (c.startsWith("0106") || c.startsWith("0107") || n.includes("کارتن") || n.includes("دوک") || n.includes("پالت")) {
            return "packaging";
        }
        return "other";
    };

    // Filter and Analyze data
    const analyzedData = useMemo(() => {
        let filtered = prodReturnsData;

        // Search query
        if (prodReturnsSearch.trim()) {
            const q = prodReturnsSearch.trim().toLowerCase();
            filtered = filtered.filter(item => 
                String(item.DocNo || "").toLowerCase().includes(q) ||
                String(item.DocDate || "").toLowerCase().includes(q) ||
                String(item.ItemCode || "").toLowerCase().includes(q) ||
                String(item.ItemName || "").toLowerCase().includes(q) ||
                String(item.WarehouseName || "").toLowerCase().includes(q) ||
                String(item.Description || "").toLowerCase().includes(q)
            );
        }

        // Product Filter
        if (selectedProductForReport !== "all") {
            filtered = filtered.filter(item => {
                const resolved = resolveProdItemName(item.ItemCode, item.ItemName);
                return resolved === selectedProductForReport || item.ItemCode === selectedProductForReport;
            });
        }

        // Calculate totals
        let totalWeight = 0;
        let totalProdWeight = 0;
        let totalMatWeight = 0;

        const detailedMap = new Map<string, any>();
        const groupMap = new Map<string, any>();
        const docsMap = new Map<string, any>();

        filtered.forEach(item => {
            const weight = Number(item.Weight || item.Quantity || 0);
            totalWeight += weight;

            const code = (item.ItemCode || "").trim();
            const name = resolveProdItemName(code, item.ItemName);
            const cat = categorizeItem(code, name);

            if (cat === "production") totalProdWeight += weight;
            else totalMatWeight += weight;

            // Detailed Aggregation
            const detKey = `${code}_${name}`;
            if (!detailedMap.has(detKey)) {
                detailedMap.set(detKey, {
                    code,
                    name,
                    category: cat,
                    categoryLabel: cat === "production" ? "تولیدی / نخ آماده" : cat === "raw_material" ? "ماده اولیه" : "سایر",
                    totalWeight: 0,
                    count: 0,
                    units: item.UnitName || "کیلوگرم",
                    warehouses: new Set<string>()
                });
            }
            const detEntry = detailedMap.get(detKey);
            detEntry.totalWeight += weight;
            detEntry.count += 1;
            if (item.WarehouseName && item.WarehouseName !== "-") detEntry.warehouses.add(item.WarehouseName);

            // Group Aggregation
            const groupCode = code.slice(0, 4) || "سایر";
            const groupName = cat === "production" ? "محصولات تولیدی و تکمیل شده" : cat === "raw_material" ? "مواد اولیه و کش/لاکرا" : "ملزومات و بسته‌بندی";
            if (!groupMap.has(groupCode)) {
                groupMap.set(groupCode, {
                    code: groupCode,
                    name: groupName,
                    itemsCount: 0,
                    totalQty: 0
                });
            }
            const grpEntry = groupMap.get(groupCode);
            grpEntry.itemsCount += 1;
            grpEntry.totalQty += weight;

            // Documents Aggregation
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
            const docEntry = docsMap.get(docNo);
            docEntry.totalWeight += weight;
            docEntry.itemsCount += 1;
            docEntry.rows.push(item);
        });

        const detailedList = Array.from(detailedMap.values()).sort((a, b) => b.totalWeight - a.totalWeight);
        const groupsList = Array.from(groupMap.values()).sort((a, b) => b.totalQty - a.totalQty);
        const productionGroupsList = groupsList.filter(g => g.name.includes("تولیدی"));
        const materialGroupsList = groupsList.filter(g => !g.name.includes("تولیدی"));
        const documentsList = Array.from(docsMap.values()).sort((a, b) => String(b.docNo).localeCompare(String(a.docNo), "en", { numeric: true }));

        return {
            filteredRaw: filtered,
            totalWeight,
            totalProdWeight,
            totalMatWeight,
            detailedList,
            productionGroupsList,
            materialGroupsList,
            groupsList,
            documentsList
        };
    }, [prodReturnsData, prodReturnsSearch, selectedProductForReport]);

    // Extract unique product options for filter
    const uniqueProducts = useMemo(() => {
        const map = new Map<string, string>();
        prodReturnsData.forEach(item => {
            const code = (item.ItemCode || "").trim();
            const name = resolveProdItemName(code, item.ItemName);
            if (name && !map.has(name)) {
                map.set(name, name);
            }
        });
        return Array.from(map.keys()).sort((a, b) => a.localeCompare(b, "fa"));
    }, [prodReturnsData]);

    // Send Telegram Bot Notification
    const handleSendReturnsBot = async () => {
        setIsSendingBot(true);
        try {
            const textLines = [
                `🔄 *گزارش برگشت از تولید به انبار (عملیات ۴۴)*`,
                `📅 بازه: ${dateFrom || "ابتدای دوره"} الی ${dateTo || "امروز"}`,
                `⚖️ *مجموع کل وزن:* ${Math.round(analyzedData.totalWeight).toLocaleString("fa-IR")} کیلوگرم`,
                `🧶 *محصولات تولیدی:* ${Math.round(analyzedData.totalProdWeight).toLocaleString("fa-IR")} کیلوگرم`,
                `🧵 *مواد اولیه و کش:* ${Math.round(analyzedData.totalMatWeight).toLocaleString("fa-IR")} کیلوگرم`,
                `📄 *تعداد اسناد:* ${analyzedData.documentsList.length.toLocaleString("fa-IR")} سند`,
                ``,
                `📊 *خلاصه گروه‌های کالا:*`
            ];

            analyzedData.groupsList.forEach((grp, idx) => {
                textLines.push(`${idx + 1}. ${grp.name} (${grp.code}): ${Math.round(grp.totalQty).toLocaleString("fa-IR")} ک‌گ`);
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
                <td style="font-weight: bold;">${resolveProdItemName(row.ItemCode, row.ItemName)}</td>
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
            const dataToExport = analyzedData.detailedList.map((item, idx) => ({
                "ردیف": idx + 1,
                "کد کالا": item.code,
                "شرح کالا": item.name,
                "دسته‌بندی": item.categoryLabel,
                "مجموع وزن (کیلوگرم)": Math.round(item.totalWeight),
                "تعداد اقلام/اسناد": item.count,
                "انبارها": Array.from(item.warehouses).join(", ")
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "برگشت_از_تولید");
            XLSX.writeFile(wb, `Production_Returns_${dateFrom}_to_${dateTo}.xlsx`);
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
                        گزارش گروه کالاها، اسناد ثبت‌شده و امکان جستجوی کالای خاص
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

                    {/* Excel Export */}
                    <button
                        onClick={handleExportExcel}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>خروجی اکسل</span>
                    </button>

                    {/* Refresh Button */}
                    <button
                        onClick={fetchProdReturns}
                        disabled={isFetchingProdReturns}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isFetchingProdReturns ? "animate-spin text-blue-600" : ""}`} />
                        <span>بروزرسانی</span>
                    </button>
                </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800 p-3.5 rounded-xl">
                    <div className="text-xs font-bold text-slate-500 dark:text-zinc-400">مجموع کل وزن برگشتی</div>
                    <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 mt-1 font-mono">
                        {Math.round(analyzedData.totalWeight).toLocaleString("fa-IR")} <span className="text-xs font-normal text-slate-500">کیلوگرم</span>
                    </div>
                </div>

                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 p-3.5 rounded-xl">
                    <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">محصولات نهایی و نخ آماده</div>
                    <div className="text-xl sm:text-2xl font-black text-indigo-900 dark:text-indigo-200 mt-1 font-mono">
                        {Math.round(analyzedData.totalProdWeight).toLocaleString("fa-IR")} <span className="text-xs font-normal text-indigo-500">کیلوگرم</span>
                    </div>
                </div>

                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3.5 rounded-xl">
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">مواد اولیه / کش و لاکرا</div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-1 font-mono">
                        {Math.round(analyzedData.totalMatWeight).toLocaleString("fa-IR")} <span className="text-xs font-normal text-emerald-500">کیلوگرم</span>
                    </div>
                </div>

                <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-3.5 rounded-xl">
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400">تعداد اسناد برگشتی ثبت‌شده</div>
                    <div className="text-xl sm:text-2xl font-black text-amber-900 dark:text-amber-200 mt-1 font-mono">
                        {analyzedData.documentsList.length.toLocaleString("fa-IR")} <span className="text-xs font-normal text-amber-500">سند</span>
                    </div>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-950 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Search Box for Specific Product / Code / Document */}
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={prodReturnsSearch}
                            onChange={(e) => setProdReturnsSearch(e.target.value)}
                            placeholder="جستجوی نام کالا، کد کالا، شماره سند یا انبار..."
                            className="w-full text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg pr-9 pl-3 py-2 outline-none focus:border-indigo-500 font-bold placeholder-slate-400"
                        />
                        {prodReturnsSearch && (
                            <button onClick={() => setProdReturnsSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Specific Product Select Dropdown */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 whitespace-nowrap">فیلتر کالا:</span>
                        <select
                            value={selectedProductForReport}
                            onChange={(e) => setSelectedProductForReport(e.target.value)}
                            className="text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg px-3 py-2 outline-none font-bold cursor-pointer min-w-[170px]"
                        >
                            <option value="all">همه کالاها ({uniqueProducts.length} مورد)</option>
                            {uniqueProducts.map((p, idx) => (
                                <option key={idx} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {(prodReturnsSearch || selectedProductForReport !== "all") && (
                    <button
                        onClick={() => { setProdReturnsSearch(""); setSelectedProductForReport("all"); }}
                        className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center justify-center gap-1 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 rounded-lg border border-rose-200 dark:border-rose-900/40"
                    >
                        <X className="w-3.5 h-3.5" />
                        <span>پاک کردن فیلترها</span>
                    </button>
                )}
            </div>

            {/* Main Content Loading / Empty / Data */}
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
                    {/* 1. TOP SECTION: Product Groups Aggregation */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                        <div className="bg-slate-50 dark:bg-zinc-950 px-4 py-3 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                <span>گروه کالاها (دسته‌بندی اقلام برگشتی)</span>
                            </h3>
                            <span className="text-xs font-bold text-slate-500 font-mono">
                                {analyzedData.groupsList.length} گروه کالا
                            </span>
                        </div>

                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full border-collapse text-right text-xs">
                                <thead>
                                    <tr className="bg-slate-50/50 dark:bg-zinc-900/60 text-slate-500 dark:text-zinc-400 font-black border-b border-slate-100 dark:border-zinc-800">
                                        <th className="p-3 w-14 text-center">ردیف</th>
                                        <th className="p-3 w-28 font-mono">پیشوند گروه</th>
                                        <th className="p-3">عنوان گروه کالا</th>
                                        <th className="p-3 text-center w-36">تعداد اقلام ثبت‌شده</th>
                                        <th className="p-3 text-left w-48">مجموع وزن برگشتی (کیلوگرم)</th>
                                        <th className="p-3 text-center w-28">سهم از کل</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                    {analyzedData.groupsList.map((grp, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                            <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                            <td className="p-3 font-mono font-bold text-slate-600 dark:text-zinc-400">{grp.code}</td>
                                            <td className="p-3 font-extrabold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full ${grp.name.includes("تولیدی") ? "bg-indigo-500" : "bg-emerald-500"}`}></span>
                                                {grp.name}
                                            </td>
                                            <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-zinc-300">{grp.itemsCount}</td>
                                            <td className="p-3 text-left font-black text-slate-900 dark:text-zinc-100 font-mono text-sm">
                                                {Math.round(grp.totalQty).toLocaleString("fa-IR")}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="inline-block bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 text-[11px] font-black font-mono px-2.5 py-0.5 rounded-full">
                                                    {analyzedData.totalWeight > 0 ? ((grp.totalQty / analyzedData.totalWeight) * 100).toFixed(1) : 0}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 dark:bg-zinc-950 font-black border-t border-slate-200 dark:border-zinc-800">
                                    <tr>
                                        <td colSpan={3} className="p-3 text-slate-800 dark:text-zinc-100">جمع کل گروه‌های کالا</td>
                                        <td className="p-3 text-center font-mono">{analyzedData.groupsList.reduce((acc, g) => acc + g.itemsCount, 0)}</td>
                                        <td className="p-3 text-left font-mono text-indigo-700 dark:text-indigo-400 text-sm">{Math.round(analyzedData.totalWeight).toLocaleString("fa-IR")}</td>
                                        <td className="p-3 text-center font-mono">۱۰۰%</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* 2. BOTTOM SECTION: Registered Documents List */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                        <div className="bg-slate-50 dark:bg-zinc-950 px-4 py-3 border-b border-slate-200/80 dark:border-zinc-800 flex items-center justify-between">
                            <h3 className="text-sm font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                                <span>بر اساس سندهای ثبت شده (اسناد تفکیکی برگشت از تولید)</span>
                            </h3>
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
                                                        className="px-2 py-1 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
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
                </div>
            )}

            {/* Document Details Modal */}
            {selectedDocModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
                    <div className="bg-white dark:bg-zinc-900 w-full max-w-3xl rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950">
                            <div>
                                <h3 className="font-black text-sm text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-indigo-600" />
                                    <span>جزئیات و اقلام سند برگشت از تولید {selectedDocModal.docNo}</span>
                                </h3>
                                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400 mt-1 font-bold">
                                    <span>تاریخ: {selectedDocModal.docDate}</span>
                                    <span>•</span>
                                    <span>انبار: {selectedDocModal.warehouse}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedDocModal(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                            <table className="w-full border-collapse text-right text-xs">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 font-bold border-b border-slate-100 dark:border-zinc-800">
                                        <th className="p-2.5 w-12 text-center">ردیف</th>
                                        <th className="p-2.5 w-28 font-mono">کد کالا</th>
                                        <th className="p-2.5">نام و مشخصات کالا</th>
                                        <th className="p-2.5 text-left w-36">وزن برگشتی</th>
                                        <th className="p-2.5 text-center w-24">واحد</th>
                                        <th className="p-2.5">توضیحات ردیف</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                    {(selectedDocModal.rows || []).map((r: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                                            <td className="p-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                                            <td className="p-2.5 font-mono font-bold text-slate-600 dark:text-zinc-400">{r.ItemCode}</td>
                                            <td className="p-2.5 font-extrabold text-slate-800 dark:text-zinc-200">{resolveProdItemName(r.ItemCode, r.ItemName)}</td>
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
                                        <td colSpan={3} className="p-2.5 text-slate-800 dark:text-zinc-100">جمع کل وزن سند</td>
                                        <td className="p-2.5 text-left font-mono text-indigo-600 dark:text-indigo-400 text-sm">
                                            {Math.round(selectedDocModal.totalWeight).toLocaleString("fa-IR")}
                                        </td>
                                        <td colSpan={2} className="p-2.5 text-slate-500 text-xs">کیلوگرم</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950">
                            <button
                                onClick={() => handlePrintSingleDoc(selectedDocModal)}
                                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>چاپ رسید رسمی</span>
                            </button>

                            <button
                                onClick={() => setSelectedDocModal(null)}
                                className="px-4 py-2 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-slate-300 transition-colors"
                            >
                                بستن
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
