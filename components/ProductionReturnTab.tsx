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
    const [prodReturnsGrouping, setProdReturnsGrouping] = useState<"archive" | "group" | "detail" | "document">("archive");
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
            const res = await fetch("/api/sayan/production-returns/send-bot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dateFrom, dateTo })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || "گزارش با موفقیت به گروه‌های منتخب ارسال شد ✅");
            } else {
                toast.error(data.error || "خطا در ارسال گزارش به بات ❌");
            }
        } catch (err) {
            console.error("Failed to send bot report", err);
            toast.error("خطای ارتباط با سرور در ارسال به بات ❌");
        } finally {
            setIsSendingBot(false);
        }
    };

    // Single Document Print
    const handlePrintSingleDoc = (doc: any) => {
        if (!doc) return;
        const printWindow = window.open("", "_blank");
        if (!printWindow) {
            toast.error("اجازه باز شدن پاپ‌آپ چاپ مسدود است");
            return;
        }

        const rowsHtml = (doc.rows || []).map((r: any, idx: number) => `
            <tr style="border-bottom: 1px solid #e2e8f0; text-align: right;">
                <td style="padding: 8px; text-align: center;">${idx + 1}</td>
                <td style="padding: 8px; font-family: monospace;">${r.ItemCode || "-"}</td>
                <td style="padding: 8px; font-weight: bold;">${resolveProdItemName(r.ItemCode, r.ItemName)}</td>
                <td style="padding: 8px; text-align: left; font-family: monospace; font-weight: bold;">${Number(r.Weight || r.Quantity || 0).toLocaleString("fa-IR")}</td>
                <td style="padding: 8px; text-align: center;">${r.UnitName || "کیلوگرم"}</td>
                <td style="padding: 8px;">${r.WarehouseName || "-"}</td>
                <td style="padding: 8px; color: #64748b;">${r.Description || "-"}</td>
            </tr>
        `).join("");

        printWindow.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="utf-8" />
                <title>سند برگشت از تولید شماره ${doc.docNo}</title>
                <style>
                    body { font-family: Tahoma, 'Vazirmatn', sans-serif; margin: 20px; color: #1e293b; }
                    .header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px; }
                    .meta { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 13px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                    th { background-color: #f1f5f9; padding: 10px 8px; text-align: right; border-bottom: 2px solid #cbd5e1; }
                    .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2 style="margin: 0 0 6px 0;">رسید سند برگشت از تولید (کد عملیات ۴۴)</h2>
                    <div style="font-size: 13px; color: #64748b;">سیستم حسابداری و انبارداری سایان ERP</div>
                </div>
                <div class="meta">
                    <div><strong>شماره سند:</strong> ${doc.docNo}</div>
                    <div><strong>تاریخ سند:</strong> ${doc.docDate}</div>
                    <div><strong>انبار:</strong> ${doc.warehouse}</div>
                    <div><strong>مجموع وزن:</strong> ${Math.round(doc.totalWeight).toLocaleString("fa-IR")} کیلوگرم</div>
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
                <div class="footer">
                    <div>امضا تحویل‌دهنده: ....................</div>
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
        <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
            {/* Header and Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4">
                <div>
                    <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                        <Undo2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        <span>گزارش جامع برگشت از تولید به انبار (کد عملیات ۴۴)</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                        پایش و تجمیع کلیه اسناد و اقلام برگشتی از سالن‌های بافت/تکمیل به انبارها در بازه زمانی انتخابی
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

            {/* View Filter Mode Selector & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-slate-200/80 dark:border-zinc-800">
                {/* Mode Buttons */}
                <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 p-1 rounded-lg border border-slate-200 dark:border-zinc-800 overflow-x-auto">
                    <button
                        onClick={() => setProdReturnsGrouping("archive")}
                        className={`px-3 py-1.5 rounded-md text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                            prodReturnsGrouping === "archive" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                        }`}
                    >
                        تجمیع براساس محصول
                    </button>
                    <button
                        onClick={() => setProdReturnsGrouping("group")}
                        className={`px-3 py-1.5 rounded-md text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                            prodReturnsGrouping === "group" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                        }`}
                    >
                        دسته‌بندی کلی
                    </button>
                    <button
                        onClick={() => setProdReturnsGrouping("document")}
                        className={`px-3 py-1.5 rounded-md text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                            prodReturnsGrouping === "document" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                        }`}
                    >
                        فهرست اسناد تفکیکی
                    </button>
                    <button
                        onClick={() => setProdReturnsGrouping("detail")}
                        className={`px-3 py-1.5 rounded-md text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                            prodReturnsGrouping === "detail" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                        }`}
                    >
                        ردیف‌های خام ثبتی
                    </button>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                    {/* Product filter dropdown */}
                    <select
                        value={selectedProductForReport}
                        onChange={(e) => setSelectedProductForReport(e.target.value)}
                        className="text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg px-2.5 py-1.5 outline-none font-bold cursor-pointer"
                    >
                        <option value="all">همه محصولات ({uniqueProducts.length})</option>
                        {uniqueProducts.map((p, idx) => (
                            <option key={idx} value={p}>{p}</option>
                        ))}
                    </select>

                    {/* Search Box */}
                    <div className="relative flex-1 sm:w-60">
                        <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={prodReturnsSearch}
                            onChange={(e) => setProdReturnsSearch(e.target.value)}
                            placeholder="جستجو در شرح، کد، سند..."
                            className="w-full text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 rounded-lg pr-8 pl-3 py-1.5 outline-none focus:border-indigo-500 font-bold"
                        />
                        {prodReturnsSearch && (
                            <button onClick={() => setProdReturnsSearch("")} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Table Content */}
            {isFetchingProdReturns ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <span className="text-xs font-bold text-slate-500 mt-3">در حال فراخوانی اطلاعات برگشت از تولید از سرور سایان...</span>
                </div>
            ) : analyzedData.detailedList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl text-slate-400">
                    <FolderOpen className="w-10 h-10 stroke-1 mb-2 text-slate-300" />
                    <span className="text-sm font-bold">هیچ ردیف سند برگشت از تولیدی در این بازه زمانی یافت نشد</span>
                </div>
            ) : (
                <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                    {/* View 1: Detailed Products Aggregated */}
                    {(prodReturnsGrouping === "archive") && (
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full border-collapse text-right text-xs">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 font-black border-b border-slate-100 dark:border-zinc-800">
                                        <th className="p-3 w-14 text-center">ردیف</th>
                                        <th className="p-3 w-32 font-mono">کد کالا</th>
                                        <th className="p-3">نام و مشخصات کالا</th>
                                        <th className="p-3 w-36 text-center">دسته‌بندی</th>
                                        <th className="p-3 text-left w-44">مجموع وزن برگشتی (کیلوگرم)</th>
                                        <th className="p-3 text-center w-28">سهم از کل</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                    {analyzedData.detailedList.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                             <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                             <td className="p-3 font-mono font-bold text-slate-600 dark:text-zinc-400">{item.code}</td>
                                             <td className="p-3 font-extrabold text-slate-800 dark:text-zinc-200">{item.name}</td>
                                             <td className="p-3 text-center">
                                                 <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black ${
                                                     item.category === "production" ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300" :
                                                     item.category === "raw_material" ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300" :
                                                     "bg-slate-100 text-slate-700"
                                                 }`}>
                                                     {item.categoryLabel}
                                                 </span>
                                             </td>
                                             <td className="p-3 text-left font-black text-slate-900 dark:text-zinc-100 font-mono text-sm">
                                                 {Math.round(item.totalWeight).toLocaleString("fa-IR")}
                                             </td>
                                             <td className="p-3 text-center">
                                                 <span className="inline-block bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[11px] font-black font-mono px-2 py-0.5 rounded">
                                                     {analyzedData.totalWeight > 0 ? ((item.totalWeight / analyzedData.totalWeight) * 100).toFixed(1) : 0}%
                                                 </span>
                                             </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* View 2: Grouping */}
                    {prodReturnsGrouping === "group" && (
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full border-collapse text-right text-xs">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 font-black border-b border-slate-100 dark:border-zinc-800">
                                        <th className="p-3 w-14 text-center">ردیف</th>
                                        <th className="p-3 w-28 font-mono">پیشوند گروه</th>
                                        <th className="p-3">عنوان دسته‌بندی</th>
                                        <th className="p-3 text-center w-36">تعداد اقلام ثبت‌شده</th>
                                        <th className="p-3 text-left w-48">مجموع وزن برگشتی (کیلوگرم)</th>
                                        <th className="p-3 text-center w-28">سهم از کل</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                    {[...analyzedData.productionGroupsList, ...analyzedData.materialGroupsList].map((grp, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                            <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                            <td className="p-3 font-mono font-bold text-slate-600 dark:text-zinc-400">{grp.code}</td>
                                            <td className="p-3 font-extrabold text-slate-800 dark:text-zinc-200">{grp.name}</td>
                                            <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-zinc-300">{grp.itemsCount}</td>
                                            <td className="p-3 text-left font-black text-slate-900 dark:text-zinc-100 font-mono text-sm">
                                                {Math.round(grp.totalQty).toLocaleString("fa-IR")}
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className="inline-block bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 text-[11px] font-black font-mono px-2 py-0.5 rounded">
                                                    {analyzedData.totalWeight > 0 ? ((grp.totalQty / analyzedData.totalWeight) * 100).toFixed(1) : 0}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* View 3: Document list */}
                    {prodReturnsGrouping === "document" && (
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full border-collapse text-right text-xs">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 font-black border-b border-slate-100 dark:border-zinc-800">
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
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded cursor-pointer transition-colors"
                                                        title="مشاهده جزئیات سند"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handlePrintSingleDoc(doc)}
                                                        className="p-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded cursor-pointer transition-colors"
                                                        title="چاپ سند"
                                                    >
                                                        <Printer className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* View 4: Raw rows */}
                    {prodReturnsGrouping === "detail" && (
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full border-collapse text-right text-xs">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 font-black border-b border-slate-100 dark:border-zinc-800">
                                        <th className="p-3 w-14 text-center">ردیف</th>
                                        <th className="p-3 w-28 font-mono">شماره سند</th>
                                        <th className="p-3 w-28">تاریخ</th>
                                        <th className="p-3 w-32 font-mono">کد کالا</th>
                                        <th className="p-3">شرح کالا</th>
                                        <th className="p-3 text-left w-36">وزن (کیلوگرم)</th>
                                        <th className="p-3">انبار</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                    {analyzedData.filteredRaw.map((r, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                            <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                            <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{r.DocNo}</td>
                                            <td className="p-3 font-mono text-slate-500">{r.DocDate}</td>
                                            <td className="p-3 font-mono font-bold text-slate-600 dark:text-zinc-400">{r.ItemCode}</td>
                                            <td className="p-3 font-extrabold text-slate-800 dark:text-zinc-200">{resolveProdItemName(r.ItemCode, r.ItemName)}</td>
                                            <td className="p-3 text-left font-black text-slate-900 dark:text-zinc-100 font-mono text-sm">
                                                {Number(r.Weight || r.Quantity || 0).toLocaleString("fa-IR")}
                                            </td>
                                            <td className="p-3 text-slate-600 dark:text-zinc-400">{r.WarehouseName || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Document Detail Modal */}
            {selectedDocModal && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 animate-fade-in rtl">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950">
                            <div>
                                <h3 className="text-base font-black text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-indigo-600" />
                                    <span>جزئیات سند برگشت از تولید شماره {selectedDocModal.docNo}</span>
                                </h3>
                                <div className="text-xs text-slate-500 dark:text-zinc-400 mt-1 flex items-center gap-3">
                                    <span>تاریخ: {selectedDocModal.docDate}</span>
                                    <span>انبار: {selectedDocModal.warehouse}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedDocModal(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
                            <table className="w-full border-collapse text-right text-xs">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 font-black border-b border-slate-100 dark:border-zinc-800">
                                        <th className="p-3 w-12 text-center">ردیف</th>
                                        <th className="p-3 w-32 font-mono">کد کالا</th>
                                        <th className="p-3">شرح کالا</th>
                                        <th className="p-3 text-left w-36">وزن برگشتی</th>
                                        <th className="p-3 text-center w-24">واحد</th>
                                        <th className="p-3">توضیحات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                    {(selectedDocModal.rows || []).map((r: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                                            <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                            <td className="p-3 font-mono font-bold text-slate-600 dark:text-zinc-400">{r.ItemCode}</td>
                                            <td className="p-3 font-extrabold text-slate-800 dark:text-zinc-200">{resolveProdItemName(r.ItemCode, r.ItemName)}</td>
                                            <td className="p-3 text-left font-black text-slate-900 dark:text-zinc-100 font-mono text-sm">
                                                {Number(r.Weight || r.Quantity || 0).toLocaleString("fa-IR")}
                                            </td>
                                            <td className="p-3 text-center text-slate-600">{r.UnitName || "کیلوگرم"}</td>
                                            <td className="p-3 text-slate-500">{r.Description || "-"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center justify-between">
                            <div className="text-xs font-black text-slate-700 dark:text-zinc-300">
                                مجموع وزن سند: <span className="font-mono text-sm text-indigo-600">{Math.round(selectedDocModal.totalWeight).toLocaleString("fa-IR")}</span> کیلوگرم
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handlePrintSingleDoc(selectedDocModal)}
                                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-600/20"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>چاپ سند</span>
                                </button>
                                <button
                                    onClick={() => setSelectedDocModal(null)}
                                    className="px-3.5 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                >
                                    بستن
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
