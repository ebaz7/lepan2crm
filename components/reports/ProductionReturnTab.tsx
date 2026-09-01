import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
    Loader2, RefreshCw, Printer, Download, Search, X, Eye, FileText, 
    ChevronDown, ChevronUp, Layers, Send, CheckCircle2, AlertTriangle, 
    AlertCircle, Sparkles, Building, BarChart2, PackageCheck, Archive, Filter, Undo2, FolderOpen, FileSpreadsheet, EyeOff 
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

export default function ProductionReturnTab({
    dateFrom,
    dateTo,
    currentUser,
    settings,
    getEffectiveApiUrl = (url: string) => url
}: ProductionReturnTabProps) {
    const [prodReturnsData, setProdReturnsData] = useState<any[]>([]);
    const [isFetchingProdReturns, setIsFetchingProdReturns] = useState(false);
    const [prodReturnsIsMock, setProdReturnsIsMock] = useState(false);
    const [prodReturnsGrouping, setProdReturnsGrouping] = useState<"archive" | "group" | "detail" | "document">("archive");
    const [selectedDocModal, setSelectedDocModal] = useState<any | null>(null);
    const [selectedDocRowKey, setSelectedDocRowKey] = useState<string | null>(null);
    const [prodReturnsSearch, setProdReturnsSearch] = useState("");
    const [selectedProductForReport, setSelectedProductForReport] = useState<string>("all");
    const [rawDocsSearch, setRawDocsSearch] = useState("");
    const [isSendingBot, setIsSendingBot] = useState(false);
    const [showRawDocsVerification, setShowRawDocsVerification] = useState(true);

        const fetchProdReturns = async () => {
        setIsFetchingProdReturns(true);
        try {
            const url = `/api/sayan/production-returns?dateFrom=${dateFrom}&dateTo=${dateTo}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setProdReturnsData(data.items || []);
                    setProdReturnsIsMock(!!data.isMock);
                } else {
                    toast.error(data.message || 'خطا در بارگذاری اطلاعات برگشت از تولید');
                }
            } else {
                toast.error('خطا در برقراری ارتباط با سرور');
            }
        } catch (err) {
            console.error("Failed to fetch production returns", err);
            toast.error('خطای ارتباط با سرور');
        } finally {
            setIsFetchingProdReturns(false);
        }
    };

    // --- PRODUCTION RETURNS HELPERS (Exactly matching Sayan ERP Chart of Accounts) ---
    const resolveProdItemName = (code: string, rawName: string): string => {
        const c = (code || '').trim();
        const n = (rawName || '').trim();
        
        // If rawName is meaningful text (contains Persian letters and is not just numeric code or placeholder)
        if (n && n !== c && !/^\d+$/.test(n) && !n.includes('کالای بدون نام')) {
            return n;
        }
        
        // Known fallback names matching Sayan
        if (c.startsWith('0401')) return `اسپاندکس (کاور) (${c})`;
        if (c.startsWith('0402')) return `کش (${c})`;
        if (c.startsWith('0403')) return `اسپاندکس جوشی ( ساپورت ) (${c})`;
        if (c.startsWith('0405')) return `پلی استر شوایتر (${c})`;
        if (c.startsWith('0407')) return `نایلون (${c})`;
        if (c.startsWith('0408')) return `نخ ملت (${c})`;
        if (c.startsWith('0409')) return `الیاف (${c})`;
        if (c.startsWith('0410')) return `FDY (${c})`;

        if (c.startsWith('0101')) return `چیپس (${c})`;
        if (c.startsWith('0102')) return `POY (${c})`;
        if (c.startsWith('0103')) return `dty یا پلی استر (${c})`;
        if (c.startsWith('0104')) return `لاستیک (${c})`;
        if (c.startsWith('0105')) return `لاکرا (${c})`;
        if (c.startsWith('0106')) return `پلی استر اسپان (${c})`;
        if (c.startsWith('0107')) return `مستر بچ (${c})`;
        if (c.startsWith('0108')) return `نایلون (${c})`;

        return n || `کالای کد ${c}`;
    };

    const getProdReturnsAnalyzed = () => {
        const classifyProductGroup = (itemCode: string, itemName: string) => {
            const code = (itemCode || '').trim();
            const name = (itemName || '').toLowerCase();
            
            // 1. محصولات (04xx)
            if (code.startsWith('0401') || name.includes('کاور')) {
                return { code: '0401', name: 'اسپاندکس (کاور)', isProduction: true };
            }
            if (code.startsWith('0402') || name.includes('کش') || name.includes('قیطان')) {
                return { code: '0402', name: 'کش', isProduction: true };
            }
            if (code.startsWith('0403') || name.includes('ساپورت') || name.includes('جوشی')) {
                return { code: '0403', name: 'اسپاندکس جوشی ( ساپورت )', isProduction: true };
            }
            if (code.startsWith('0405') || name.includes('شوایتر')) {
                return { code: '0405', name: 'پلی استر شوایتر', isProduction: true };
            }
            if (code.startsWith('0407')) {
                return { code: '0407', name: 'نایلون', isProduction: true };
            }
            if (code.startsWith('0408') || name.includes('ملت')) {
                return { code: '0408', name: 'نخ ملت', isProduction: true };
            }
            if (code.startsWith('0409') || name.includes('الیاف')) {
                return { code: '0409', name: 'الیاف', isProduction: true };
            }
            if (code.startsWith('0410') || name.includes('fdy')) {
                return { code: '0410', name: 'FDY', isProduction: true };
            }

            // 2. مواد اولیه (01xx)
            if (code.startsWith('0101') || name.includes('چیپس')) {
                return { code: '0101', name: 'چیپس', isProduction: false };
            }
            if (code.startsWith('0102') || name.includes('poy') || name.includes('پوی')) {
                return { code: '0102', name: 'POY', isProduction: false };
            }
            if (code.startsWith('0103') || name.includes('dty') || name.includes('دی تی وای') || name.includes('پلی استر')) {
                return { code: '0103', name: 'dty یا پلی استر', isProduction: false };
            }
            if (code.startsWith('0104') || name.includes('لاستیک')) {
                return { code: '0104', name: 'لاستیک', isProduction: false };
            }
            if (code.startsWith('0105') || name.includes('لاکرا')) {
                return { code: '0105', name: 'لاکرا', isProduction: false };
            }
            if (code.startsWith('0106') || name.includes('اسپان')) {
                return { code: '0106', name: 'پلی استر اسپان', isProduction: false };
            }
            if (code.startsWith('0107') || name.includes('مستر بچ') || name.includes('مستربچ')) {
                return { code: '0107', name: 'مستر بچ', isProduction: false };
            }
            if (code.startsWith('0108') || name.includes('نایلون')) {
                return { code: '0108', name: 'نایلون', isProduction: false };
            }

            return { code: code.substring(0, 4) || 'سایر', name: itemName || `کد ${code}`, isProduction: code.startsWith('04') };
        };

        const filteredRaw = prodReturnsData.filter(item => {
            const code = (item.ItemCode || '').trim();
            const rawName = (item.ItemName || '').toLowerCase();
            const resolvedName = resolveProdItemName(code, item.ItemName).toLowerCase();
            
            // Exclude Lycra (0105) and Rubber (0104) and related keywords from production returns
            if (code.startsWith('0104') || code.startsWith('0105') || 
                rawName.includes('لاکرا') || rawName.includes('لاستیک') || 
                rawName.includes('lycra') || rawName.includes('rubber') ||
                resolvedName.includes('لاکرا') || resolvedName.includes('لاستیک')) {
                return false;
            }

            // Support item-specific reports
            if (selectedProductForReport && selectedProductForReport !== 'all') {
                const productKey = `${code}_${resolveProdItemName(code, item.ItemName)}`;
                if (productKey !== selectedProductForReport) {
                    return false;
                }
            }

            if (!prodReturnsSearch) return true;
            const s = prodReturnsSearch.toLowerCase();
            const archiveNo = String(item.ArchiveNo || item.SubCode || '').toLowerCase();
            return (item.ItemName || '').toLowerCase().includes(s) || 
                   resolvedName.includes(s) ||
                   (item.ItemCode || '').toLowerCase().includes(s) || 
                   (item.DocId || '').toLowerCase().includes(s) ||
                   archiveNo.includes(s);
        });

        const totalWeight = filteredRaw.reduce((sum, item) => sum + parseFloat(item.Quantity || 0), 0);

        const productionGroupsMap = new Map<string, { code: string; name: string; itemsCount: number; totalQty: number }>();
        const materialGroupsMap = new Map<string, { code: string; name: string; itemsCount: number; totalQty: number }>();

        filteredRaw.forEach(item => {
            const resolvedName = resolveProdItemName(item.ItemCode, item.ItemName);
            const groupInfo = classifyProductGroup(item.ItemCode, resolvedName);
            const mapToUse = groupInfo.isProduction ? productionGroupsMap : materialGroupsMap;
            
            if (!mapToUse.has(groupInfo.code)) {
                mapToUse.set(groupInfo.code, {
                    code: groupInfo.code,
                    name: groupInfo.name,
                    itemsCount: 0,
                    totalQty: 0
                });
            }
            const grp = mapToUse.get(groupInfo.code)!;
            grp.itemsCount += 1;
            grp.totalQty += parseFloat(item.Quantity || 0);
        });

        const productionGroupsList = Array.from(productionGroupsMap.values()).sort((a, b) => b.totalQty - a.totalQty);
        const materialGroupsList = Array.from(materialGroupsMap.values()).sort((a, b) => b.totalQty - a.totalQty);

        const totalProdWeight = productionGroupsList.reduce((sum, g) => sum + g.totalQty, 0);
        const totalMatWeight = materialGroupsList.reduce((sum, g) => sum + g.totalQty, 0);

        const detailedMap = new Map<string, { code: string; name: string; groupName: string; color: string; dot: string; totalQty: number }>();
        filteredRaw.forEach(item => {
            const code = (item.ItemCode || '').trim();
            const resolvedName = resolveProdItemName(code, item.ItemName);
            const key = `${code}_${resolvedName}`;
            const groupInfo = classifyProductGroup(code, resolvedName);
            
            if (!detailedMap.has(key)) {
                detailedMap.set(key, {
                    code,
                    name: resolvedName,
                    groupName: groupInfo.name,
                    color: groupInfo.isProduction ? 'text-indigo-600 bg-indigo-50 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-800/30' : 'text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800/30',
                    dot: groupInfo.isProduction ? 'bg-indigo-500' : 'bg-blue-500',
                    totalQty: 0
                });
            }
            detailedMap.get(key)!.totalQty += parseFloat(item.Quantity || 0);
        });

        const detailedList = Array.from(detailedMap.values()).sort((a, b) => b.totalQty - a.totalQty);

        // Group by DocId (Document Number) and Archive Code
        const documentsMap = new Map<string, {
            key: string;
            docId: string;
            archiveNo: string;
            date: string;
            time: string;
            rawDate: string;
            opCode: string;
            opName: string;
            periodType: string;
            warehouseCode: string;
            warehouseName: string;
            description: string;
            approvalStatus: string;
            sendStatus: string;
            totalQty: number;
            itemsCount: number;
            items: any[];
        }>();

        filteredRaw.forEach(item => {
            const docId = String(item.DocNumber || item.DocId || item.SubCode || '—').trim();
            const archiveNo = String(item.ArchiveCode || item.ArchiveNo || item.DocId || '—').trim();
            const key = `${archiveNo}_${docId}`;
            
            let displayDate = '';
            let displayTime = '—';
            if (item.Date) {
                try {
                    const d = new Date(item.Date);
                    displayDate = d.toLocaleDateString('fa-IR');
                    if (item.Date.includes('T')) {
                        const timePart = item.Date.split('T')[1].substring(0, 8);
                        if (timePart) displayTime = timePart;
                    } else {
                        const hours = String(d.getHours()).padStart(2, '0');
                        const minutes = String(d.getMinutes()).padStart(2, '0');
                        const seconds = String(d.getSeconds()).padStart(2, '0');
                        displayTime = `${hours}:${minutes}:${seconds}`;
                    }
                } catch(e) {
                    displayDate = item.Date;
                }
            } else {
                displayDate = dateFrom;
            }

            if (!documentsMap.has(key)) {
                documentsMap.set(key, {
                    key,
                    docId,
                    archiveNo,
                    date: displayDate,
                    time: displayTime,
                    rawDate: item.Date,
                    opCode: item.DocType || '44',
                    opName: 'رسید کالای برگشتی از تولید',
                    periodType: 'طی دوره',
                    warehouseCode: String(item.WarehouseCode || '11').trim(),
                    warehouseName: 'انبار کارخانه',
                    description: item.HeaderDescription || item.DocDescription || 'برگردان',
                    approvalStatus: 'تایید شده',
                    sendStatus: 'طی دوره',
                    totalQty: 0,
                    itemsCount: 0,
                    items: []
                });
            }
            const doc = documentsMap.get(key)!;
            const qty = parseFloat(item.Quantity || 0);
            doc.totalQty += qty;
            doc.itemsCount += 1;
            const resolvedName = resolveProdItemName(item.ItemCode, item.ItemName);
            doc.items.push({
                lineId: item.LineId || `${doc.items.length + 1}`,
                itemCode: (item.ItemCode || '').trim(),
                itemName: resolvedName,
                quantity: qty,
                groupName: classifyProductGroup(item.ItemCode, resolvedName).name,
                lineNotes: item.LineNotes || item.DocDescription || '',
                date: displayDate,
                time: displayTime
            });
        });

        const documentsList = Array.from(documentsMap.values()).sort((a, b) => {
            const numA = parseInt(a.archiveNo, 10);
            const numB = parseInt(b.archiveNo, 10);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numB - numA; // newest/highest archive first
            }
            const docNumA = parseInt(a.docId, 10);
            const docNumB = parseInt(b.docId, 10);
            if (!isNaN(docNumA) && !isNaN(docNumB)) {
                return docNumB - docNumA;
            }
            return b.archiveNo.localeCompare(a.archiveNo);
        });

        // Detailed flat list of raw document rows for precise 104-row verification
        const rawDocumentRows = filteredRaw.map((item, idx) => {
            const code = (item.ItemCode || '').trim();
            const resolvedName = resolveProdItemName(code, item.ItemName);
            const grp = classifyProductGroup(code, resolvedName);
            let displayDate = '';
            let displayTime = '—';
            if (item.Date) {
                try {
                    const d = new Date(item.Date);
                    displayDate = d.toLocaleDateString('fa-IR');
                    if (item.Date.includes('T')) {
                        const timePart = item.Date.split('T')[1].substring(0, 8);
                        if (timePart) displayTime = timePart;
                    }
                } catch(e) {
                    displayDate = item.Date;
                }
            } else {
                displayDate = dateFrom;
            }
            return {
                id: item.LineId || `line_${idx}`,
                lineId: item.LineId || `${idx + 1}`,
                docId: String(item.DocNumber || item.DocId || '—').trim(),
                archiveNo: String(item.ArchiveCode || item.ArchiveNo || item.DocId || '—').trim(),
                date: displayDate,
                time: displayTime,
                rawDate: item.Date,
                itemCode: code,
                itemName: resolvedName,
                groupName: grp.name,
                groupCode: grp.code,
                warehouseCode: String(item.WarehouseCode || '11').trim(),
                warehouseName: 'انبار کارخانه',
                description: item.HeaderDescription || item.DocDescription || 'برگردان',
                quantity: parseFloat(item.Quantity || 0),
                lineNotes: item.LineNotes || item.DocDescription || ''
            };
        }).sort((a, b) => {
            const numDocA = parseInt(a.archiveNo, 10);
            const numDocB = parseInt(b.archiveNo, 10);
            if (!isNaN(numDocA) && !isNaN(numDocB) && numDocA !== numDocB) {
                return numDocB - numDocA;
            }
            return a.itemCode.localeCompare(b.itemCode);
        });

        return {
            filteredRaw,
            totalWeight,
            productionGroupsList,
            materialGroupsList,
            totalProdWeight,
            totalMatWeight,
            detailedList,
            documentsList,
            rawDocumentRows
        };
    };

    const handlePrintSingleDoc = (doc: any) => {
        if (!doc) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const html = `
            <!DOCTYPE html>
            <html dir="rtl" lang="fa">
            <head>
                <meta charset="UTF-8">
                <title>سند انبار شماره ${doc.docId} - کد بایگانی ${doc.archiveNo}</title>
                <style>
                    body { font-family: Tahoma, 'Segoe UI', Arial, sans-serif; direction: rtl; padding: 25px; color: #111; font-size: 12px; }
                    .header { border-bottom: 2px solid #222; padding-bottom: 12px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-start; }
                    .company-title { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
                    .doc-title { font-size: 14px; font-weight: bold; color: #4338ca; }
                    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; background: #f8fafc; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 15px; font-size: 11px; }
                    .meta-item { display: flex; flex-direction: column; gap: 2px; }
                    .meta-label { color: #64748b; font-size: 10px; }
                    .meta-value { font-weight: bold; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th { background: #f1f5f9; border: 1px solid #94a3b8; padding: 8px; font-weight: bold; text-align: right; }
                    td { border: 1px solid #cbd5e1; padding: 7px 8px; text-align: right; }
                    .num { font-family: monospace; font-weight: bold; direction: ltr; text-align: left; }
                    .total-row { background: #f8fafc; font-weight: bold; border-top: 2px solid #334155; }
                    .signatures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 50px; text-align: center; font-size: 11px; }
                    .sig-box { border-top: 1px dashed #64748b; padding-top: 8px; min-height: 60px; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <div class="company-title">شرکت لیان بافت</div>
                        <div class="doc-title">سند انبار: رسید کالای برگشتی از تولید (کد عملیات ۴۴)</div>
                    </div>
                    <div style="text-align: left; font-size: 11px;">
                        <div>شماره سند: <b>${doc.docId}</b></div>
                        <div>کد بایگانی: <b>${doc.archiveNo}</b></div>
                        <div>تاریخ ثبت: <b>${doc.date}</b> - ساعت: <b>${doc.time}</b></div>
                    </div>
                </div>

                <div class="meta-grid">
                    <div class="meta-item"><span class="meta-label">کد و نام انبار:</span><span class="meta-value">${doc.warehouseCode} - ${doc.warehouseName}</span></div>
                    <div class="meta-item"><span class="meta-label">نوع عملیات:</span><span class="meta-value">${doc.opCode} - ${doc.opName}</span></div>
                    <div class="meta-item"><span class="meta-label">نوع دوره / وضعیت:</span><span class="meta-value">${doc.periodType} / ${doc.approvalStatus}</span></div>
                    <div class="meta-item"><span class="meta-label">شرح و توضیحات سند:</span><span class="meta-value">${doc.description || '—'}</span></div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px; text-align: center;">ردیف</th>
                            <th style="width: 120px;">کد کالا</th>
                            <th>نام و شرح کالا</th>
                            <th style="width: 120px;">گروه کالا</th>
                            <th style="width: 110px; text-align: left;">وزن (kg)</th>
                            <th>مشخصات و توضیحات ردیف</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${doc.items.map((it: any, idx: number) => `
                            <tr>
                                <td style="text-align: center;">${idx + 1}</td>
                                <td class="num">${it.itemCode}</td>
                                <td><b>${it.itemName}</b></td>
                                <td>${it.groupName}</td>
                                <td class="num">${Math.round(it.quantity).toLocaleString('fa-IR')}</td>
                                <td style="font-size: 10px; color: #334155;">${it.lineNotes || '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td colspan="4" style="text-align: left; padding: 10px;"><b>مجموع وزن کل سند (${doc.items.length} ردیف کالا):</b></td>
                            <td class="num" style="color: #4338ca; font-size: 13px;"><b>${Math.round(doc.totalQty).toLocaleString('fa-IR')}</b></td>
                            <td>کیلوگرم</td>
                        </tr>
                    </tfoot>
                </table>

                <div class="signatures">
                    <div class="sig-box">تحویل دهنده (سالن تولید)</div>
                    <div class="sig-box">تحویل گیرنده (انبار)</div>
                    <div class="sig-box">مسئول انبارداری</div>
                    <div class="sig-box">مدیر کارخانه / حسابداری</div>
                </div>

                <script>
                    window.onload = () => { window.print(); }
                </script>
            </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handlePrintReturns = () => {
        const { productionGroupsList, materialGroupsList, totalProdWeight, totalMatWeight, detailedList, totalWeight, documentsList } = getProdReturnsAnalyzed();
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        let tablesHtml = '';

        if (prodReturnsGrouping === 'group') {
            tablesHtml = `
                <div class="section-title">گزارش برگشت از تولید (ادغام در سطح گروه کالا)</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50px;">ردیف</th>
                            <th>کد گروه</th>
                            <th>گروه کالا</th>
                            <th>تعداد اقلام</th>
                            <th>مجموع وزن برگشتی (کیلوگرم)</th>
                            <th>سهم از کل</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productionGroupsList.map((g, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${g.code}</td>
                                <td class="text-right">${g.name}</td>
                                <td>${g.itemsCount}</td>
                                <td style="font-weight: bold;">${Math.round(g.totalQty).toLocaleString('fa-IR')}</td>
                                <td>${totalWeight > 0 ? ((g.totalQty / totalWeight) * 100).toFixed(1) : 0}%</td>
                            </tr>
                        `).join('')}
                        <tr class="sum-row">
                            <td colspan="4">جمع کل برگشت از تولید</td>
                            <td>${Math.round(totalWeight).toLocaleString('fa-IR')}</td>
                            <td>100%</td>
                        </tr>
                    </tbody>
                </table>
            `;
        } else if (prodReturnsGrouping === 'detail') {
            tablesHtml = `
                <div class="section-title">گزارش ریز کالا (ادغام شده بر اساس نام کالا)</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 50px;">ردیف</th>
                            <th>کد کالا</th>
                            <th>نام کالا</th>
                            <th>گروه کالا</th>
                            <th>مجموع وزن برگشتی (کیلوگرم)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${detailedList.map((item, idx) => `
                            <tr>
                                <td>${idx + 1}</td>
                                <td>${item.code}</td>
                                <td class="text-right">${item.name}</td>
                                <td>${item.groupName}</td>
                                <td style="font-weight: bold;">${Math.round(item.totalQty).toLocaleString('fa-IR')}</td>
                            </tr>
                        `).join('')}
                        <tr class="sum-row">
                            <td colspan="4">جمع کل وزن برگشتی ریز اقلام</td>
                            <td>${Math.round(totalWeight).toLocaleString('fa-IR')}</td>
                        </tr>
                    </tbody>
                </table>
            `;
        } else {
            tablesHtml = `
                <div class="section-title">گزارش تفکیکی اسناد برگشت از تولید (کد عملیات ۴۴)</div>
                ${documentsList.map((doc) => `
                    <div style="margin-top: 15px; margin-bottom: 5px; font-weight: bold; background: #f2f2f2; padding: 8px 12px; border: 1px solid #000; display: flex; justify-content: space-between; font-size: 11px;">
                        <span>سند شماره: ${doc.docId} (بایگانی: ${doc.archiveNo})</span>
                        <span>تاریخ ثبت: ${doc.date}</span>
                        <span>مجموع وزن سند: ${Math.round(doc.totalQty).toLocaleString('fa-IR')} کیلوگرم</span>
                    </div>
                    <table style="margin-bottom: 15px;">
                        <thead>
                            <tr>
                                <th style="width: 50px;">ردیف</th>
                                <th style="width: 120px;">کد کالا</th>
                                <th>نام و شرح کالا</th>
                                <th style="width: 150px;">گروه کالا</th>
                                <th style="width: 120px;">وزن برگشتی (ک‌گ)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${doc.items.map((item, itemIdx) => `
                                <tr>
                                    <td>${itemIdx + 1}</td>
                                    <td>${item.itemCode}</td>
                                    <td class="text-right">${item.itemName}</td>
                                    <td>${item.groupName}</td>
                                    <td style="font-weight: bold;">${Math.round(item.quantity).toLocaleString('fa-IR')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `).join('')}
                <div style="font-weight: bold; font-size: 13px; text-align: left; padding: 12px; border-top: 2px solid #000; margin-top: 20px;">
                    جمع کل وزن برگشتی تمامی اسناد: ${Math.round(totalWeight).toLocaleString('fa-IR')} کیلوگرم
                </div>
            `;
        }

        const html = `
            <!DOCTYPE html>
            <html lang="fa" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>چاپ گزارش رسید برگشت از تولید کالا</title>
                <style>
                    body {
                        font-family: 'Tahoma', sans-serif;
                        direction: rtl;
                        padding: 40px;
                        background: #fff;
                        color: #000;
                        font-size: 12px;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 2px solid #000;
                        padding-bottom: 15px;
                        margin-bottom: 25px;
                    }
                    .title {
                        font-size: 18px;
                        font-weight: bold;
                    }
                    .subtitle {
                        font-size: 12px;
                        margin-top: 5px;
                        color: #555;
                    }
                    .meta-box {
                        display: flex;
                        justify-content: space-between;
                        margin-bottom: 20px;
                        font-weight: bold;
                    }
                    .section-title {
                        font-size: 13px;
                        font-weight: bold;
                        border-right: 3px solid #000;
                        padding-right: 8px;
                        margin-bottom: 10px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 25px;
                    }
                    th, td {
                        border: 1px solid #000;
                        padding: 8px;
                        text-align: center;
                    }
                    th {
                        background: #f2f2f2;
                    }
                    .text-right {
                        text-align: right;
                        padding-right: 12px;
                    }
                    .sum-row {
                        font-weight: bold;
                        background: #fafafa;
                    }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="title">گزارش رسید برگشت از تولید کالا (کد عملیات ۴۴)</div>
                    <div class="subtitle">دوره گزارش: از ${dateFrom} تا ${dateTo}</div>
                </div>
                <div class="meta-box">
                    <div>تاریخ چاپ: ${new Date().toLocaleDateString('fa-IR')}</div>
                    <div>مجموع وزن برگشتی: ${Math.round(totalWeight).toLocaleString('fa-IR')} کیلوگرم</div>
                </div>
                ${tablesHtml}
                <div style="margin-top: 50px; display: flex; justify-content: space-around; font-weight: bold;">
                    <div>امضا کننده ۱ (مسئول انبار تولید): _______________</div>
                    <div>امضا کننده ۲ (مدیر تولید): _______________</div>
                    <div>امضا کننده ۳ (مدیریت بازرگانی): _______________</div>
                </div>
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 500);
                    };
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleExportPDF = () => {
        const url = `/api/sayan/production-returns/pdf?dateFrom=${dateFrom}&dateTo=${dateTo}`;
        window.open(url, '_blank');
    };

    const handleSendReturnsBot = async () => {
        setIsSendingBot(true);
        try {
            const res = await fetch('/api/sayan/production-returns/send-bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dateFrom, dateTo })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'گزارش با موفقیت به گروه‌های منتخب ارسال شد ✅');
            } else {
                toast.error(data.error || 'خطا در ارسال گزارش به بات ❌');
            }
        } catch (err) {
            console.error("Failed to send bot report", err);
            toast.error('خطای ارتباط با سرور در ارسال به بات ❌');
        } finally {
            setIsSendingBot(false);
        }
    };

    useEffect(() => {
        fetchProdReturns();
    }, [dateFrom, dateTo]);

                        const { 
                        filteredRaw, 
                        totalWeight, 
                        productionGroupsList, 
                        materialGroupsList, 
                        totalProdWeight, 
                        totalMatWeight, 
                        detailedList,
                        documentsList,
                        rawDocumentRows
                    } = getProdReturnsAnalyzed();

                    const uniqueProducts = Array.from(
                        prodReturnsData.reduce((map, item) => {
                            const code = (item.ItemCode || '').trim();
                            const rawName = (item.ItemName || '').trim();
                            const resolvedName = resolveProdItemName(code, rawName);
                            
                            // Exclude Lycra (0105) and Rubber (0104) and related keywords from unique product options
                            if (code.startsWith('0104') || code.startsWith('0105') || 
                                rawName.toLowerCase().includes('لاکرا') || rawName.toLowerCase().includes('لاستیک') || 
                                rawName.toLowerCase().includes('lycra') || rawName.toLowerCase().includes('rubber') ||
                                resolvedName.toLowerCase().includes('لاکرا') || resolvedName.toLowerCase().includes('لاستیک')) {
                                return map;
                            }
                            
                            const key = `${code}_${resolvedName}`;
                            if (!map.has(key)) {
                                map.set(key, { code, name: resolvedName });
                            }
                            return map;
                        }, new Map<string, { code: string; name: string }>()).values()
                    ) as { code: string; name: string }[];

                    uniqueProducts.sort((a, b) => a.name.localeCompare(b.name, 'fa'));

                    const displayedRawRows = rawDocumentRows.filter(r => {
                        if (!rawDocsSearch) return true;
                        const s = rawDocsSearch.toLowerCase();
                        return r.docId.toLowerCase().includes(s) ||
                               r.archiveNo.toLowerCase().includes(s) ||
                               r.itemName.toLowerCase().includes(s) ||
                               r.itemCode.toLowerCase().includes(s) ||
                               r.groupName.toLowerCase().includes(s) ||
                               r.lineNotes.toLowerCase().includes(s);
                    });


                        return (
                        <div className="p-2 sm:p-6 space-y-4 sm:space-y-6 rtl">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-zinc-800 pb-4">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                                        <Undo2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                        گزارش رسید برگشت از تولید کالا (کد عملیات ۴۴)
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                                        پایش برخط و زنده رسیدهای برگشتی از تولید کارخانه و طبقه‌بندی هوشمند کالاها
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                                        prodReturnsIsMock 
                                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/30' 
                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/30'
                                    }`}>
                                        <span className={`w-2 h-2 rounded-full ${prodReturnsIsMock ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                                        {prodReturnsIsMock ? 'دیتای نمونه (آفلاین)' : 'برخط سایان ERP'}
                                    </span>

                                    <div className="bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg flex border border-slate-200 dark:border-zinc-700 mr-2">
                                        <button
                                            onClick={() => setProdReturnsGrouping('archive')}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                                                prodReturnsGrouping === 'archive'
                                                    ? 'bg-white dark:bg-zinc-700 text-indigo-700 dark:text-white shadow-sm'
                                                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                                            }`}
                                        >
                                            <Archive className="w-3.5 h-3.5" />
                                            <span>اسناد انبار (بایگانی)</span>
                                        </button>
                                        <button
                                            onClick={() => setProdReturnsGrouping('document')}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                                                prodReturnsGrouping === 'document'
                                                    ? 'bg-white dark:bg-zinc-700 text-indigo-700 dark:text-white shadow-sm'
                                                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                                            }`}
                                        >
                                            <Layers className="w-3.5 h-3.5" />
                                            <span>تفکیک کارتی اسناد</span>
                                        </button>
                                        <button
                                            onClick={() => setProdReturnsGrouping('group')}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                                prodReturnsGrouping === 'group'
                                                    ? 'bg-white dark:bg-zinc-700 text-indigo-700 dark:text-white shadow-sm'
                                                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                                            }`}
                                        >
                                            گروه‌بندی کالا
                                        </button>
                                        <button
                                            onClick={() => setProdReturnsGrouping('detail')}
                                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                                prodReturnsGrouping === 'detail'
                                                    ? 'bg-white dark:bg-zinc-700 text-indigo-700 dark:text-white shadow-sm'
                                                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                                            }`}
                                        >
                                            ریز کالا (تجمعی)
                                        </button>
                                    </div>

                                    {/* EXPORT ACTION BUTTONS */}
                                    <div className="flex items-center gap-1.5 mr-auto lg:mr-2">
                                        <button
                                            onClick={handlePrintReturns}
                                            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-slate-200 dark:border-zinc-700"
                                            title="چاپ مستقیم تراز"
                                        >
                                            <Printer className="w-3.5 h-3.5" />
                                            <span>چاپ</span>
                                        </button>
                                        <button
                                            onClick={handleExportPDF}
                                            className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-indigo-100 dark:border-indigo-900/30"
                                            title="دریافت فایل PDF رسمی"
                                        >
                                            <FileText className="w-3.5 h-3.5" />
                                            <span>خروجی PDF</span>
                                        </button>
                                        <button
                                            onClick={handleSendReturnsBot}
                                            disabled={isSendingBot}
                                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/60 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm shadow-emerald-600/10"
                                            title="ارسال تراز به پیام‌رسان‌های متصل"
                                        >
                                            {isSendingBot ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Send className="w-3.5 h-3.5" />
                                            )}
                                            <span>{isSendingBot ? 'در حال ارسال...' : 'ارسال به بات'}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Search and Quick Filters */}
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50 dark:bg-zinc-950/30 p-4 rounded-xl border border-slate-100 dark:border-zinc-800/50">
                                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                                    <div className="relative w-full sm:w-72">
                                        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                                        <input
                                            type="text"
                                            placeholder="جستجو در شرح، کد کالا یا سند..."
                                            value={prodReturnsSearch}
                                            onChange={e => setProdReturnsSearch(e.target.value)}
                                            className="w-full pl-3 pr-10 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                                        />
                                        {prodReturnsSearch && (
                                            <button 
                                                onClick={() => setProdReturnsSearch('')} 
                                                className="absolute left-3 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Product Specific Filter Dropdown */}
                                    <div className="w-full sm:w-80 flex items-center gap-1.5">
                                        <span className="text-[11px] font-black text-slate-500 whitespace-nowrap">فیلتر کالا:</span>
                                        <select
                                            value={selectedProductForReport}
                                            onChange={e => setSelectedProductForReport(e.target.value)}
                                            className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                        >
                                            <option value="all">   گزارش کلی (همه کالاها)</option>
                                            {uniqueProducts.map((p, pIdx) => (
                                                <option key={pIdx} value={`${p.code}_${p.name}`}>
                                                       {p.name} {p.name.includes(p.code) ? '' : `(کد: ${p.code})`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="text-xs text-slate-500 dark:text-zinc-400 font-bold flex items-center gap-1">
                                    <span>تعداد اقلام فیلتر شده:</span>
                                    <span className="text-slate-800 dark:text-zinc-200 font-mono text-sm font-black">{filteredRaw.length}</span>
                                    <span className="mr-3">مجموع وزن برگشتی:</span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-mono text-sm font-black">
                                        {totalWeight.toLocaleString('fa-IR')}
                                    </span>
                                    <span>کیلوگرم</span>
                                </div>
                            </div>

                            {/* Active Product Report Banner */}
                            {selectedProductForReport !== 'all' && (() => {
                                const activeProdName = selectedProductForReport.split('_')[1];
                                const activeProdCode = selectedProductForReport.split('_')[0];
                                return (
                                    <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-indigo-600 text-white rounded-lg">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-indigo-900 dark:text-indigo-200">گزارش تفکیکی و اختصاصی کالا</h4>
                                                <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 mt-0.5">
                                                    در حال مشاهده برگشت از تولید برای کالا: <span className="font-extrabold underline">{activeProdName}</span> با کد کالا: <span className="font-mono font-bold text-xs">{activeProdCode}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedProductForReport('all')}
                                            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-black transition-all shadow-sm cursor-pointer"
                                        >
                                            لغو فیلتر اختصاصی کالا
                                        </button>
                                    </div>
                                );
                            })()}

                            {/* Loading / Empty States */}
                            {isFetchingProdReturns ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3">
                                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                                    <span className="text-xs text-slate-500 font-bold">در حال استخراج رسیدهای برگشت از تولید از دیتابیس سایان...</span>
                                </div>
                            ) : filteredRaw.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl bg-slate-50/50 dark:bg-zinc-950/10">
                                    <Undo2 className="w-12 h-12 text-slate-300 dark:text-zinc-700 mb-3" />
                                    <h3 className="text-sm font-extrabold text-slate-700 dark:text-zinc-300">هیچ رسیدی در بازه زمانی تعیین‌شده یافت نشد</h3>
                                    <p className="text-xs text-slate-400 mt-1 max-w-md">لطفاً بازه زمانی تاریخ فیلتر بالای صفحه را بررسی کنید یا کلید بروزرسانی را کلیک نمایید.</p>
                                </div>
                            ) : (
                                prodReturnsGrouping === 'archive' ? (
                                    /* SAYAN ERP ARCHIVE GRID VIEW (جدول اسناد انبار در سیستم شایان/سایان) */
                                    <div className="space-y-3 animate-fade-in">
                                        {/* Sayan Action & Status Bar */}
                                        <div className="bg-slate-100 dark:bg-zinc-800/90 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700/80 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        const activeDoc = (selectedDocRowKey && documentsList.find(d => d.key === selectedDocRowKey)) || documentsList[0];
                                                        if (activeDoc) setSelectedDocModal(activeDoc);
                                                    }}
                                                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all shadow-sm shadow-indigo-600/20 cursor-pointer"
                                                    title="باز کردن ریز اقلام و مشخصات سند انبار"
                                                >
                                                    <FolderOpen className="w-4 h-4" />
                                                    <span>باز کردن سند انتخاب شده</span>
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        const activeDoc = (selectedDocRowKey && documentsList.find(d => d.key === selectedDocRowKey)) || documentsList[0];
                                                        if (activeDoc) handlePrintSingleDoc(activeDoc);
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-600 border border-slate-200 dark:border-zinc-600 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                                                    title="چاپ سند انبار انتخابی"
                                                >
                                                    <Printer className="w-3.5 h-3.5" />
                                                    <span>چاپ سند</span>
                                                </button>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600 dark:text-zinc-300">
                                                <span className="px-2.5 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg">
                                                    تعداد کل اسناد: <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">{documentsList.length}</span> سند
                                                </span>
                                                <span className="px-2.5 py-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg">
                                                    تعداد کل اقلام: <span className="font-mono font-black text-slate-800 dark:text-zinc-100">{rawDocumentRows.length}</span> ردیف
                                                </span>
                                                <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40 rounded-lg">
                                                    مجموع وزن: <span className="font-mono font-black text-indigo-700 dark:text-indigo-300">{Math.round(totalWeight).toLocaleString('fa-IR')}</span> کیلوگرم
                                                </span>
                                            </div>
                                        </div>

                                        {/* Sayan Main Document Table */}
                                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                                            <div className="overflow-x-auto custom-scrollbar">
                                                <table className="w-full border-collapse text-right text-xs">
                                                    <thead>
                                                        <tr className="bg-slate-100/90 dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 font-black border-b border-slate-200 dark:border-zinc-800 select-none">
                                                            <th className="p-3 w-12 text-center">ردیف</th>
                                                            <th className="p-3 w-24 text-center">کد بایگانی</th>
                                                            <th className="p-3 w-24 text-center">شماره سند</th>
                                                            <th className="p-3 w-20 text-center">کد عملیات</th>
                                                            <th className="p-3">عنوان عملیات انبار</th>
                                                            <th className="p-3 w-24 text-center">نوع دوره</th>
                                                            <th className="p-3 w-20 text-center">کد انبار</th>
                                                            <th className="p-3">نام انبار</th>
                                                            <th className="p-3 w-24 text-center">تاریخ</th>
                                                            <th className="p-3 w-20 text-center">ساعت</th>
                                                            <th className="p-3 w-24 text-center">وضعیت تایید</th>
                                                            <th className="p-3 min-w-36">توضیحات سند</th>
                                                            <th className="p-3 w-24 text-center">تعداد قلم</th>
                                                            <th className="p-3 text-left w-36">مجموع وزن (kg)</th>
                                                            <th className="p-3 w-28 text-center">عملیات</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                                        {documentsList.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={15} className="p-8 text-center text-slate-400 font-bold">هیچ سندی یافت نشد</td>
                                                            </tr>
                                                        ) : (
                                                            documentsList.map((doc, docIdx) => {
                                                                const isSelected = selectedDocRowKey === doc.key;
                                                                return (
                                                                    <tr
                                                                        key={docIdx}
                                                                        onClick={() => setSelectedDocRowKey(doc.key)}
                                                                        onDoubleClick={() => setSelectedDocModal(doc)}
                                                                        className={`transition-colors cursor-pointer ${
                                                                            isSelected
                                                                                ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100 font-semibold'
                                                                                : 'hover:bg-slate-50 dark:hover:bg-zinc-800/40'
                                                                        }`}
                                                                    >
                                                                        <td className="p-3 text-center font-mono font-bold text-slate-400">
                                                                            {docIdx + 1}
                                                                        </td>
                                                                        <td className="p-3 text-center">
                                                                            <span className="font-mono font-bold text-slate-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                                                                                {doc.archiveNo}
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-3 text-center">
                                                                            <span className="font-mono font-black text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/30">
                                                                                {doc.docId}
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-3 text-center font-mono font-bold text-slate-500">
                                                                            {doc.opCode}
                                                                        </td>
                                                                        <td className="p-3 font-extrabold text-slate-800 dark:text-zinc-200">
                                                                            {doc.opName}
                                                                        </td>
                                                                        <td className="p-3 text-center font-bold text-slate-600 dark:text-zinc-400 text-[11px]">
                                                                            {doc.periodType}
                                                                        </td>
                                                                        <td className="p-3 text-center font-mono font-bold text-slate-600 dark:text-zinc-400">
                                                                            {doc.warehouseCode}
                                                                        </td>
                                                                        <td className="p-3 font-bold text-slate-700 dark:text-zinc-300">
                                                                            {doc.warehouseName}
                                                                        </td>
                                                                        <td className="p-3 text-center font-mono font-medium text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                                                                            {doc.date}
                                                                        </td>
                                                                        <td className="p-3 text-center font-mono text-[11px] text-slate-500 dark:text-zinc-400 whitespace-nowrap">
                                                                            {doc.time}
                                                                        </td>
                                                                        <td className="p-3 text-center">
                                                                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30">
                                                                                {doc.approvalStatus}
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-3 text-slate-600 dark:text-zinc-300 text-[11px] max-w-xs truncate" title={doc.description}>
                                                                            {doc.description || '—'}
                                                                        </td>
                                                                        <td className="p-3 text-center font-mono font-bold text-slate-700 dark:text-zinc-300">
                                                                            {doc.items.length} قلم
                                                                        </td>
                                                                        <td className="p-3 text-left font-mono font-black text-slate-900 dark:text-zinc-100 text-sm">
                                                                            {Math.round(doc.totalQty).toLocaleString('fa-IR')}
                                                                        </td>
                                                                        <td className="p-3 text-center">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setSelectedDocModal(doc);
                                                                                }}
                                                                                className="flex items-center justify-center gap-1 w-full px-2.5 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-600 dark:hover:text-white rounded-md text-[11px] font-bold transition-all border border-indigo-100 dark:border-indigo-900/30 cursor-pointer shadow-xs"
                                                                                title="باز کردن و مشاهده ریز اقلام سند"
                                                                            >
                                                                                <FolderOpen className="w-3.5 h-3.5" />
                                                                                <span>باز کردن</span>
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })
                                                        )}
                                                    </tbody>
                                                    <tfoot className="bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 font-extrabold border-t border-slate-200 dark:border-zinc-700">
                                                        <tr>
                                                            <td colSpan={12} className="p-3 text-left font-black">
                                                                مجموع کل وزن اسناد ({documentsList.length} سند انبار):
                                                            </td>
                                                            <td className="p-3 text-center font-mono font-black">
                                                                {rawDocumentRows.length} قلم
                                                            </td>
                                                            <td className="p-3 text-left font-mono font-black text-indigo-700 dark:text-indigo-400 text-sm">
                                                                {Math.round(totalWeight).toLocaleString('fa-IR')}
                                                            </td>
                                                            <td className="p-3 text-center text-xs text-slate-500 font-bold">
                                                                کیلوگرم
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                ) : prodReturnsGrouping === 'document' ? (
                                    /* DOCUMENT-LEVEL CARD VIEW (تفکیک کارتی اسناد) */
                                    <div className="space-y-4 animate-fade-in">
                                        {documentsList.length === 0 ? (
                                            <div className="text-center py-12 text-slate-400 dark:text-zinc-500 font-bold">موردی یافت نشد</div>
                                        ) : (
                                            documentsList.map((doc, docIdx) => (
                                                <div key={docIdx} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition-all">
                                                    {/* Document Card Header */}
                                                    <div className="p-4 bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                                                        <div className="flex flex-wrap items-center gap-3">
                                                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/30">
                                                                سند شماره {doc.docId}
                                                            </span>
                                                            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
                                                                شماره بایگانی: <span className="font-mono">{doc.archiveNo}</span>
                                                            </span>
                                                            <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold">
                                                                تاریخ ثبت: <span className="font-mono">{doc.date}</span> {doc.time && <span className="font-mono text-[11px]">({doc.time})</span>}
                                                            </span>
                                                            <span className="text-xs text-slate-500 dark:text-zinc-400 font-bold">
                                                                انبار: <span className="font-bold text-slate-700 dark:text-zinc-300">{doc.warehouseName}</span>
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-xs text-slate-500 dark:text-zinc-400 font-bold ml-2">
                                                                وزن سند: <span className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400">{Math.round(doc.totalQty).toLocaleString('fa-IR')}</span> کیلوگرم
                                                            </div>
                                                            <button
                                                                onClick={() => setSelectedDocModal(doc)}
                                                                className="flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                                                            >
                                                                <FolderOpen className="w-3.5 h-3.5" />
                                                                <span>باز کردن سند</span>
                                                            </button>
                                                            <button
                                                                onClick={() => handlePrintSingleDoc(doc)}
                                                                className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-bold transition-all border border-slate-200 dark:border-zinc-700 cursor-pointer"
                                                                title="چاپ این سند"
                                                            >
                                                                <Printer className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {/* Document Card Content Table */}
                                                    <div className="overflow-x-auto custom-scrollbar">
                                                        <table className="w-full border-collapse text-right text-xs">
                                                            <thead>
                                                                <tr className="bg-slate-50/50 dark:bg-zinc-950/10 text-slate-500 dark:text-zinc-400 font-black border-b border-slate-100 dark:border-zinc-800">
                                                                    <th className="p-3 w-16 text-center">ردیف</th>
                                                                    <th className="p-3 w-32">کد کالا</th>
                                                                    <th className="p-3">نام و شرح کالا</th>
                                                                    <th className="p-3">گروه کالا</th>
                                                                    <th className="p-3 text-left w-36">وزن برگشتی (کیلوگرم)</th>
                                                                    <th className="p-3">توضیحات و مشخصات</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                                                {doc.items.map((item, itemIdx) => (
                                                                    <tr key={itemIdx} className="hover:bg-slate-50/20 dark:hover:bg-zinc-800/10 transition-colors">
                                                                        <td className="p-3 text-center text-slate-400 font-bold">{itemIdx + 1}</td>
                                                                        <td className="p-3 font-mono font-bold text-slate-600 dark:text-zinc-400">{item.itemCode}</td>
                                                                        <td className="p-3 font-extrabold text-slate-800 dark:text-zinc-200">{item.itemName}</td>
                                                                        <td className="p-3 font-bold text-slate-500 dark:text-zinc-400">{item.groupName}</td>
                                                                        <td className="p-3 text-left font-black text-slate-900 dark:text-zinc-100 font-mono text-xs">{Math.round(item.quantity).toLocaleString('fa-IR')}</td>
                                                                        <td className="p-3 text-slate-500 dark:text-zinc-400 text-[11px]">{item.lineNotes || '—'}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                ) : prodReturnsGrouping === 'group' ? (
                                    /* GROUPED VIEW (گروه‌بندی کالا در قالب جداول تفکیک‌شده) */
                                    <div className="space-y-6">
                                        <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                                            <div className="p-4 bg-slate-50 dark:bg-zinc-950/40 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                                                <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                                                    برگشت از تولید (ادغام در سطح گروه کالا)
                                                </h3>
                                                <span className="text-xs font-bold text-slate-500">
                                                    مجموع: <span className="font-mono text-indigo-600 dark:text-indigo-400 font-extrabold">{totalWeight.toLocaleString('fa-IR')}</span> کیلوگرم
                                                </span>
                                            </div>
                                            <div className="overflow-x-auto custom-scrollbar">
                                                <table className="w-full border-collapse text-right text-xs">
                                                    <thead>
                                                        <tr className="bg-slate-50/50 dark:bg-zinc-950/20 text-slate-500 dark:text-zinc-400 font-black border-b border-slate-100 dark:border-zinc-800">
                                                            <th className="p-3 w-16 text-center">ردیف</th>
                                                            <th className="p-3 w-32">کد گروه</th>
                                                            <th className="p-3">گروه کالا</th>
                                                            <th className="p-3 text-center">تعداد اقلام متمایز</th>
                                                            <th className="p-3 text-left">مجموع وزن برگشتی (کیلوگرم)</th>
                                                            <th className="p-3 text-center w-28">سهم از کل</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                                        {productionGroupsList.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={6} className="p-4 text-center text-slate-400 dark:text-zinc-500 font-medium">موردی یافت نشد</td>
                                                            </tr>
                                                        ) : (
                                                            productionGroupsList.map((g, idx) => (
                                                                <tr key={idx} className="hover:bg-slate-50/30 dark:hover:bg-zinc-800/10 transition-colors">
                                                                    <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                                                    <td className="p-3 font-mono font-bold text-slate-600 dark:text-zinc-400">{g.code}</td>
                                                                    <td className="p-3 font-extrabold text-slate-800 dark:text-zinc-200">{g.name}</td>
                                                                    <td className="p-3 text-center font-bold font-mono text-slate-700 dark:text-zinc-300">{g.itemsCount}</td>
                                                                    <td className="p-3 text-left font-black text-slate-900 dark:text-zinc-100 font-mono text-sm">{Math.round(g.totalQty).toLocaleString('fa-IR')}</td>
                                                                    <td className="p-3 text-center">
                                                                        <span className="inline-block bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 text-[11px] font-black font-mono px-2 py-0.5 rounded">
                                                                            {totalWeight > 0 ? ((g.totalQty / totalWeight) * 100).toFixed(1) : 0}%
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* DETAILED VIEW AGGREGATED BY PRODUCT NAME */
                                    <div className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto custom-scrollbar">
                                            <table className="w-full border-collapse text-right text-xs">
                                                <thead>
                                                    <tr className="bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 font-black border-b border-slate-100 dark:border-zinc-800">
                                                        <th className="p-3 w-16 text-center">ردیف</th>
                                                        <th className="p-3 w-36">کد کالا</th>
                                                        <th className="p-3">نام و شرح کالا (ادغام شده)</th>
                                                        <th className="p-3">دسته‌بندی هوشمند</th>
                                                        <th className="p-3 text-left w-48">مجموع وزن برگشتی (کیلوگرم)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                                    {detailedList.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={5} className="p-4 text-center text-slate-400 dark:text-zinc-500 font-medium">موردی یافت نشد</td>
                                                        </tr>
                                                    ) : (
                                                        detailedList.map((item, idx) => (
                                                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                                                <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                                                <td className="p-3 font-mono font-bold text-slate-600 dark:text-zinc-400">
                                                                    {item.code}
                                                                </td>
                                                                <td className="p-3 font-black text-slate-900 dark:text-zinc-100">
                                                                    {item.name}
                                                                </td>
                                                                <td className="p-3">
                                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold border ${item.color}`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                                                                        {item.groupName}
                                                                    </span>
                                                                </td>
                                                                <td className="p-3 text-left font-black text-indigo-600 dark:text-indigo-400 font-mono text-sm">
                                                                    {Math.round(item.totalQty).toLocaleString('fa-IR')}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )
                            )}

                            {/* RAW DOCUMENT ROWS VERIFICATION SECTION (نمایش ردیف‌های اسناد جهت راستی‌آزمایی دقیق) */}
                            <div className="mt-8 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                                <div className="p-4 bg-slate-50 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                                            <FileSpreadsheet className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-extrabold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
                                                ریز اسناد ثبت‌شده برگشت از تولید
                                                <span className="text-xs font-mono font-black px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-full">
                                                    {rawDocumentRows.length} ردیف سند
                                                </span>
                                            </h3>
                                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                                                نمایش ردیف‌های اسناد همراه با شماره سند، شماره بایگانی و وزن برگشتی جهت تطبیق و راستی‌آزمایی
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowRawDocsVerification(!showRawDocsVerification)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                                                showRawDocsVerification 
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/20' 
                                                    : 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800/80'
                                            }`}
                                        >
                                            {showRawDocsVerification ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            <span>{showRawDocsVerification ? 'بستن جدول ریز اسناد' : `مشاهده ریز اسناد (${rawDocumentRows.length} ردیف)`}</span>
                                        </button>
                                    </div>
                                </div>

                                {showRawDocsVerification && (
                                    <div className="p-4 space-y-3 animate-fade-in">
                                        {/* Search & Totals Summary */}
                                        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 dark:bg-zinc-950/30 p-2.5 rounded-lg border border-slate-100 dark:border-zinc-800">
                                            <div className="relative w-full sm:w-72">
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                                                <input
                                                    type="text"
                                                    placeholder="جستجو در شماره سند، بایگانی یا کالا..."
                                                    value={rawDocsSearch}
                                                    onChange={e => setRawDocsSearch(e.target.value)}
                                                    className="w-full pl-3 pr-9 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                                                />
                                                {rawDocsSearch && (
                                                    <button onClick={() => setRawDocsSearch('')} className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-zinc-400">
                                                <span>تعداد ردیف‌ها: <span className="font-mono text-slate-900 dark:text-zinc-100 font-extrabold">{displayedRawRows.length}</span></span>
                                                <span>|</span>
                                                <span>مجموع وزن ردیف‌ها: <span className="font-mono text-indigo-600 dark:text-indigo-400 font-extrabold">{Math.round(displayedRawRows.reduce((s, r) => s + r.quantity, 0)).toLocaleString('fa-IR')}</span> کیلوگرم</span>
                                            </div>
                                        </div>

                                        {/* Verification Table */}
                                        <div className="overflow-x-auto custom-scrollbar border border-slate-200/80 dark:border-zinc-800 rounded-lg max-h-[500px]">
                                            <table className="w-full border-collapse text-right text-xs">
                                                <thead className="sticky top-0 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-black z-10 shadow-sm">
                                                    <tr>
                                                        <th className="p-2.5 w-12 text-center">ردیف</th>
                                                        <th className="p-2.5 w-24 text-center">شماره سند</th>
                                                        <th className="p-2.5 w-24 text-center">شماره بایگانی</th>
                                                        <th className="p-2.5 w-24 text-center">تاریخ سند</th>
                                                        <th className="p-2.5">نام و شرح کالا</th>
                                                        <th className="p-2.5 w-28">کد کالا</th>
                                                        <th className="p-2.5 w-32">گروه کالا</th>
                                                        <th className="p-2.5 text-left w-32">وزن برگشتی (kg)</th>
                                                        <th className="p-2.5">توضیحات و مشخصات ردیف</th>
                                                        <th className="p-2.5 w-24 text-center">عملیات</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                                    {displayedRawRows.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={10} className="p-4 text-center text-slate-400 font-medium">موردی یافت نشد</td>
                                                        </tr>
                                                    ) : (
                                                        displayedRawRows.map((row, idx) => {
                                                            const parentDoc = documentsList.find(d => String(d.archiveNo) === String(row.archiveNo) && String(d.docId) === String(row.docId));
                                                            return (
                                                                <tr key={idx} className="hover:bg-indigo-50/20 dark:hover:bg-indigo-950/10 transition-colors">
                                                                    <td className="p-2.5 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                                                                    <td className="p-2.5 text-center">
                                                                        <span className="font-mono font-extrabold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/30">
                                                                            {row.docId}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-2.5 text-center">
                                                                        <span className="font-mono font-bold text-slate-700 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                                                                            {row.archiveNo}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-2.5 text-center font-mono text-slate-600 dark:text-zinc-400 font-medium whitespace-nowrap">
                                                                        {row.date}
                                                                    </td>
                                                                    <td className="p-2.5 font-bold text-slate-900 dark:text-zinc-100">
                                                                        {row.itemName}
                                                                    </td>
                                                                    <td className="p-2.5 font-mono text-slate-500 dark:text-zinc-400 text-[11px]">
                                                                        {row.itemCode}
                                                                    </td>
                                                                    <td className="p-2.5">
                                                                        <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                                                                            {row.groupName}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-2.5 text-left font-mono font-black text-slate-900 dark:text-zinc-100 text-sm">
                                                                        {Math.round(row.quantity).toLocaleString('fa-IR')}
                                                                    </td>
                                                                    <td className="p-2.5 text-slate-500 dark:text-zinc-400 text-[11px] max-w-xs truncate" title={row.lineNotes}>
                                                                        {row.lineNotes || '—'}
                                                                    </td>
                                                                    <td className="p-2.5 text-center">
                                                                        {parentDoc && (
                                                                            <button
                                                                                onClick={() => setSelectedDocModal(parentDoc)}
                                                                                className="flex items-center justify-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-600 rounded text-[10px] font-bold transition-all border border-indigo-100 dark:border-indigo-900/30 cursor-pointer"
                                                                                title="مشاهده کل سند"
                                                                            >
                                                                                <FolderOpen className="w-3 h-3" />
                                                                                <span>سند</span>
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })
                                                    )}
                                                </tbody>
                                                <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-zinc-800 font-extrabold text-slate-800 dark:text-zinc-100 border-t border-slate-200 dark:border-zinc-700 shadow-sm">
                                                    <tr>
                                                        <td colSpan={7} className="p-2.5 text-left">مجموع وزن ردیف‌های اسناد:</td>
                                                        <td className="p-2.5 text-left font-mono text-indigo-700 dark:text-indigo-400 font-black text-sm">
                                                            {Math.round(displayedRawRows.reduce((s, r) => s + r.quantity, 0)).toLocaleString('fa-IR')}
                                                        </td>
                                                        <td colSpan={2} className="p-2.5 text-slate-500 text-xs">کیلوگرم</td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* SAYAN ERP SINGLE DOCUMENT DRILL-DOWN MODAL (پاپ‌آپ کامل نمایش سند انبار با ریز اقلام) */}
                            {selectedDocModal && typeof document !== 'undefined' && createPortal(
                                <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in rtl">
                                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">
                                        {/* Modal Header */}
                                        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-950/80">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-600/20">
                                                    <FolderOpen className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-zinc-100">
                                                            سند انبار - رسید کالای برگشتی از تولید (کد عملیات ۴۴)
                                                        </h3>
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                                                            {selectedDocModal.approvalStatus}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-bold">
                                                        شماره سند: <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">{selectedDocModal.docId}</span> | 
                                                        کد بایگانی: <span className="font-mono font-black text-slate-800 dark:text-zinc-200">{selectedDocModal.archiveNo}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handlePrintSingleDoc(selectedDocModal)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-black transition-all border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                                                >
                                                    <Printer className="w-3.5 h-3.5" />
                                                    <span>چاپ رسمی سند</span>
                                                </button>
                                                <button
                                                    onClick={() => setSelectedDocModal(null)}
                                                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Modal Sayan Document Information Card */}
                                        <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar space-y-4">
                                            <div className="bg-slate-50 dark:bg-zinc-950/50 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                                <div>
                                                    <span className="text-slate-400 dark:text-zinc-500 font-bold block text-[11px]">شماره سند انبار:</span>
                                                    <span className="font-mono font-black text-indigo-700 dark:text-indigo-300 text-sm mt-0.5 block">{selectedDocModal.docId}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 dark:text-zinc-500 font-bold block text-[11px]">کد بایگانی سیستم:</span>
                                                    <span className="font-mono font-black text-slate-800 dark:text-zinc-200 text-sm mt-0.5 block">{selectedDocModal.archiveNo}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 dark:text-zinc-500 font-bold block text-[11px]">تاریخ و ساعت ثبت:</span>
                                                    <span className="font-mono font-bold text-slate-800 dark:text-zinc-200 mt-0.5 block">{selectedDocModal.date} {selectedDocModal.time && `— ${selectedDocModal.time}`}</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 dark:text-zinc-500 font-bold block text-[11px]">انبار مقصد:</span>
                                                    <span className="font-extrabold text-slate-800 dark:text-zinc-200 mt-0.5 block">{selectedDocModal.warehouseName} (کد {selectedDocModal.warehouseCode})</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 dark:text-zinc-500 font-bold block text-[11px]">عنوان و نوع عملیات:</span>
                                                    <span className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5 block">{selectedDocModal.opName} ({selectedDocModal.opCode})</span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400 dark:text-zinc-500 font-bold block text-[11px]">نوع دوره مالی:</span>
                                                    <span className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5 block">{selectedDocModal.periodType}</span>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-slate-400 dark:text-zinc-500 font-bold block text-[11px]">شرح / یادداشت سند:</span>
                                                    <span className="font-bold text-slate-800 dark:text-zinc-200 mt-0.5 block">{selectedDocModal.description || '—'}</span>
                                                </div>
                                            </div>

                                            {/* Modal Lines Table */}
                                            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                                                <div className="p-3 bg-slate-100/80 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                                                    <h4 className="text-xs font-black text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                                                        <span>  </span>
                                                        <span>ریز اقلام و کالاهای داخل سند ({selectedDocModal.items.length} قلم کالا)</span>
                                                    </h4>
                                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                                                        مجموع: {Math.round(selectedDocModal.totalQty).toLocaleString('fa-IR')} کیلوگرم
                                                    </span>
                                                </div>
                                                <div className="overflow-x-auto custom-scrollbar">
                                                    <table className="w-full border-collapse text-right text-xs">
                                                        <thead>
                                                            <tr className="bg-slate-50 dark:bg-zinc-950/60 text-slate-600 dark:text-zinc-400 font-black border-b border-slate-200 dark:border-zinc-800">
                                                                <th className="p-3 w-12 text-center">ردیف</th>
                                                                <th className="p-3 w-32 font-mono">کد کالا</th>
                                                                <th className="p-3">نام و شرح کالا</th>
                                                                <th className="p-3 w-32">گروه کالا</th>
                                                                <th className="p-3 text-left w-36">وزن برگشتی (kg)</th>
                                                                <th className="p-3 min-w-48">مشخصات فنی و شناسنامه ردیف</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                                                            {selectedDocModal.items.map((item, itemIdx) => {
                                                                const badges = item.lineNotes ? item.lineNotes.split('|').map(s => s.trim()).filter(Boolean) : [];
                                                                return (
                                                                    <tr key={itemIdx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-colors">
                                                                        <td className="p-3 text-center font-mono font-bold text-slate-400">{itemIdx + 1}</td>
                                                                        <td className="p-3 font-mono font-bold text-slate-700 dark:text-zinc-300">{item.itemCode}</td>
                                                                        <td className="p-3 font-black text-slate-900 dark:text-zinc-100">{item.itemName}</td>
                                                                        <td className="p-3">
                                                                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded text-[11px] font-bold text-slate-700 dark:text-zinc-300">
                                                                                {item.groupName}
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-3 text-left font-mono font-black text-indigo-600 dark:text-indigo-400 text-sm">
                                                                            {Math.round(item.quantity).toLocaleString('fa-IR')}
                                                                        </td>
                                                                        <td className="p-3">
                                                                            {badges.length > 0 ? (
                                                                                <div className="flex flex-wrap gap-1">
                                                                                    {badges.map((b, bIdx) => (
                                                                                        <span key={bIdx} className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded text-[10px] font-medium border border-slate-200 dark:border-zinc-700">
                                                                                            {b}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            ) : (
                                                                                <span className="text-slate-400">—</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                        <tfoot className="bg-slate-50 dark:bg-zinc-950 font-black text-slate-900 dark:text-zinc-100 border-t border-slate-200 dark:border-zinc-800">
                                                            <tr>
                                                                <td colSpan={4} className="p-3 text-left font-extrabold">مجموع وزن کل سند:</td>
                                                                <td className="p-3 text-left font-mono font-black text-indigo-700 dark:text-indigo-300 text-sm">
                                                                    {Math.round(selectedDocModal.totalQty).toLocaleString('fa-IR')}
                                                                </td>
                                                                <td className="p-3 text-slate-500 font-bold text-xs">کیلوگرم</td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Modal Footer */}
                                        <div className="p-3.5 sm:p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex items-center justify-between">
                                            <div className="text-xs text-slate-500 dark:text-zinc-400 font-bold">
                                                تعداد کل ردیف‌ها: <span className="font-mono font-black text-slate-800 dark:text-zinc-200">{selectedDocModal.items.length}</span> ردیف
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handlePrintSingleDoc(selectedDocModal)}
                                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all shadow-sm shadow-indigo-600/20 cursor-pointer flex items-center gap-1.5"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                    <span>چاپ این سند</span>
                                                </button>
                                                <button
                                                    onClick={() => setSelectedDocModal(null)}
                                                    className="px-4 py-2 bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-bold transition-all border border-slate-200 dark:border-zinc-700 cursor-pointer"
                                                >
                                                    بستن
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>,
                            document.body)}
                        </div>
        );
}
