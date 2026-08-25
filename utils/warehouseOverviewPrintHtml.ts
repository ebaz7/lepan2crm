// Utility to generate printable and PDF-ready HTML for Warehouse Overview Report

export interface WarehousePrintDataset {
    summary: {
        reportDate?: string;
        report1Label?: string;
        report2Label?: string;
        lastYearYarnsWeight?: number;
        currentYarnsWeight?: number;
        lastYearRawWeight?: number;
        currentRawWeight?: number;
        lastYearTotalWeight?: number;
        currentTotalWeight?: number;
        containersTotal?: number | string;
        dollarsTotal?: number | string;
    };
    yarnItems: any[];
    rawItems: any[];
    logisticsItems: any[];
    growthItems: any[];
    negativeItems: any[];
    signature?: string;
}

export const buildWarehouseOverviewPrintHtml = (
    dataset: WarehousePrintDataset,
    mode: 'both' | 'overview_only' | 'variance_only' = 'both'
): string => {
    const {
        summary = {},
        yarnItems = [],
        rawItems = [],
        logisticsItems = [],
        growthItems = [],
        negativeItems = [],
        signature = 'انبارداری مرکزی و تامین خارجی'
    } = dataset;

    const fNum = (n: any, dec = 0) => {
        const num = parseFloat(n) || 0;
        return num.toLocaleString('fa-IR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    };

    const fTon = (n: any) => {
        const num = (parseFloat(n) || 0) / 1000;
        return num.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    };

    const reportDate = summary.reportDate || '۱۴۰۵/۰۵/۳۱';
    const r1Label = summary.report1Label || 'منتهی به سال ۱۴۰۴';
    const r2Label = summary.report2Label || 'وضعیت فعلی سال ۱۴۰۵';

    // Summary calculations
    const yLast = summary.lastYearYarnsWeight || 0;
    const yCurr = summary.currentYarnsWeight || 0;
    const yDiff = yCurr - yLast;
    const yPct = yLast ? (yDiff / yLast) * 100 : 0;

    const rLast = summary.lastYearRawWeight || 0;
    const rCurr = summary.currentRawWeight || 0;
    const rDiff = rCurr - rLast;
    const rPct = rLast ? (rDiff / rLast) * 100 : 0;

    const tLast = summary.lastYearTotalWeight || (yLast + rLast);
    const tCurr = summary.currentTotalWeight || (yCurr + rCurr);
    const tDiff = tCurr - tLast;
    const tPct = tLast ? (tDiff / tLast) * 100 : 0;

    // Build Table Rows
    const buildItemRows = (items: any[]) => {
        if (!items || items.length === 0) {
            return `<tr><td colspan="6" style="padding: 8px; text-align: center; color: #64748b;">موردی ثبت نشده است</td></tr>`;
        }
        return items.map((item, idx) => {
            const last = parseFloat(item.lastYearWeight) || 0;
            const curr = parseFloat(item.currentWeight) || 0;
            const diff = curr - last;
            const pct = last ? (diff / last) * 100 : 0;
            const isNeg = diff < 0;
            const pctColor = isNeg ? '#b91c1c' : (diff > 0 ? '#15803d' : '#475569');
            const badgeBg = isNeg ? '#fef2f2' : '#f0fdf4';

            return `
                <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-size: 8.5pt;">
                    <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
                    <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #1e293b;">
                        ${item.name || item.groupName || '-'}
                        ${item.code ? `<span style="font-size: 7pt; color: #64748b; margin-right: 4px;">(${item.code})</span>` : ''}
                    </td>
                    <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-family: Tahoma, 'Vazirmatn', sans-serif;">${fNum(last)}</td>
                    <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-family: Tahoma, 'Vazirmatn', sans-serif; font-weight: bold; color: #0f172a;">${fNum(curr)}</td>
                    <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-family: Tahoma, 'Vazirmatn', sans-serif; font-weight: bold; color: ${pctColor}; direction: ltr;">
                        ${diff >= 0 ? '+' : ''}${fNum(diff)}
                    </td>
                    <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-family: Tahoma, 'Vazirmatn', sans-serif; font-weight: bold; color: ${pctColor}; background: ${badgeBg};">
                        ${last ? `${pct >= 0 ? '+' : ''}${fNum(pct, 1)}%` : '-'}
                    </td>
                </tr>
            `;
        }).join('');
    };

    // Logistics Table Rows
    const buildLogisticsRows = (items: any[]) => {
        if (!items || items.length === 0) return '';
        return items.map((item, idx) => `
            <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-size: 8.5pt;">
                <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #64748b;">${idx + 1}</td>
                <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #1e293b;">${item.name || '-'}</td>
                <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">${item.status || 'در راه / گمرک'}</td>
                <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #0284c7;">${item.containers ? `${item.containers} کانتینر` : '-'}</td>
                <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">${item.currentValue || item.diffValue || '-'}</td>
                <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #475569;">${item.currency || 'ارزی'}</td>
            </tr>
        `).join('');
    };

    // Deficit / Negative Items Table Rows
    const buildNegativeRows = (items: any[]) => {
        if (!items || items.length === 0) {
            return `<tr><td colspan="7" style="padding: 12px; text-align: center; color: #15803d; background-color: #f0fdf4; font-weight: bold;">✅ هیچ کالایی با تراز وزنی منفی یافت نشد. تمامی اقلام در وضعیت رشد یا حفظ موجودی قرار دارند.</td></tr>`;
        }
        return items.map((item, idx) => {
            const last = parseFloat(item.lastYearWeight) || 0;
            const curr = parseFloat(item.currentWeight) || 0;
            const diff = parseFloat(item.diffWeight) || (curr - last);
            const ratio = parseFloat(item.ratio) || (last ? (diff / last) * 100 : 0);
            const cat = item.category === 'factory' ? '🧵 تولید کارخانه' : '📦 مواد اولیه / وارداتی';

            return `
                <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#fff1f2'}; font-size: 8.5pt;">
                    <td style="padding: 5px 6px; border: 1px solid #fecaca; text-align: center; color: #991b1b; font-weight: bold;">${idx + 1}</td>
                    <td style="padding: 5px 8px; border: 1px solid #fecaca; text-align: right; font-weight: bold; color: #991b1b;">
                        ${item.name || '-'}
                        ${item.code ? `<span style="font-size: 7pt; color: #64748b; margin-right: 4px;">(${item.code})</span>` : ''}
                    </td>
                    <td style="padding: 5px 6px; border: 1px solid #fecaca; text-align: center; font-size: 7.5pt; color: #475569;">${cat}</td>
                    <td style="padding: 5px 8px; border: 1px solid #fecaca; text-align: center; font-family: Tahoma, 'Vazirmatn', sans-serif;">${fNum(last)} kg</td>
                    <td style="padding: 5px 8px; border: 1px solid #fecaca; text-align: center; font-family: Tahoma, 'Vazirmatn', sans-serif; font-weight: bold; color: #1e293b;">${fNum(curr)} kg</td>
                    <td style="padding: 5px 8px; border: 1px solid #fecaca; text-align: center; font-family: Tahoma, 'Vazirmatn', sans-serif; font-weight: bold; color: #b91c1c; background: #fee2e2;">
                        ${fNum(diff)} kg <span style="font-size: 7pt; color: #991b1b;">(${fTon(diff)} تن)</span>
                    </td>
                    <td style="padding: 5px 8px; border: 1px solid #fecaca; text-align: center; font-family: Tahoma, 'Vazirmatn', sans-serif; font-weight: bold; color: #b91c1c; background: #fef2f2;">
                        ${fNum(ratio, 1)}%
                    </td>
                </tr>
            `;
        }).join('');
    };

    // Growth / Positive Items Table Rows
    const buildGrowthRows = (items: any[]) => {
        if (!items || items.length === 0) {
            return `<tr><td colspan="7" style="padding: 10px; text-align: center; color: #64748b;">موردی یافت نشد</td></tr>`;
        }
        return items.slice(0, 15).map((item, idx) => {
            const last = parseFloat(item.lastYearWeight) || 0;
            const curr = parseFloat(item.currentWeight) || 0;
            const diff = parseFloat(item.diffWeight) || (curr - last);
            const ratio = parseFloat(item.ratio) || (last ? (diff / last) * 100 : 0);
            const cat = item.category === 'factory' ? '🧵 تولید کارخانه' : '📦 مواد اولیه / وارداتی';

            return `
                <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f0fdf4'}; font-size: 8.5pt;">
                    <td style="padding: 5px 6px; border: 1px solid #bbf7d0; text-align: center; color: #166534; font-weight: bold;">${idx + 1}</td>
                    <td style="padding: 5px 8px; border: 1px solid #bbf7d0; text-align: right; font-weight: bold; color: #14532d;">
                        ${item.name || '-'}
                        ${item.code ? `<span style="font-size: 7pt; color: #64748b; margin-right: 4px;">(${item.code})</span>` : ''}
                    </td>
                    <td style="padding: 5px 6px; border: 1px solid #bbf7d0; text-align: center; font-size: 7.5pt; color: #475569;">${cat}</td>
                    <td style="padding: 5px 8px; border: 1px solid #bbf7d0; text-align: center; font-family: Tahoma, 'Vazirmatn', sans-serif;">${fNum(last)} kg</td>
                    <td style="padding: 5px 8px; border: 1px solid #bbf7d0; text-align: center; font-family: Tahoma, 'Vazirmatn', sans-serif; font-weight: bold; color: #1e293b;">${fNum(curr)} kg</td>
                    <td style="padding: 5px 8px; border: 1px solid #bbf7d0; text-align: center; font-family: Tahoma, 'Vazirmatn', sans-serif; font-weight: bold; color: #15803d; background: #dcfce7;">
                        +${fNum(diff)} kg <span style="font-size: 7pt; color: #166534;">(+${fTon(diff)} تن)</span>
                    </td>
                    <td style="padding: 5px 8px; border: 1px solid #bbf7d0; text-align: center; font-family: Tahoma, 'Vazirmatn', sans-serif; font-weight: bold; color: #15803d; background: #f0fdf4;">
                        +${fNum(ratio, 1)}%
                    </td>
                </tr>
            `;
        }).join('');
    };

    const renderPage1 = mode === 'both' || mode === 'overview_only';
    const renderPage2 = mode === 'both' || mode === 'variance_only';

    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="fa">
    <head>
        <meta charset="UTF-8">
        <title>گزارش وضعیت انبارداری و زنجیره تامین - ${reportDate}</title>
        <style>
            @page {
                size: A4 portrait;
                margin: 8mm;
            }
            @media print {
                html, body {
                    width: 100%;
                    margin: 0;
                    padding: 0;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .no-print {
                    display: none !important;
                }
                .page-break {
                    page-break-before: always !important;
                    break-before: page !important;
                }
            }
            * {
                box-sizing: border-box;
            }
            body {
                font-family: 'Vazirmatn', 'Tahoma', 'IRANSans', system-ui, -apple-system, sans-serif;
                margin: 0;
                padding: 12px;
                color: #0f172a;
                direction: rtl;
                background: #ffffff;
                -webkit-font-smoothing: antialiased;
            }
            .page-container {
                width: 100%;
                max-width: 210mm;
                margin: 0 auto;
                box-sizing: border-box;
            }
            
            /* Header */
            .header-banner {
                border: 1.5px solid #2563eb;
                border-radius: 8px;
                padding: 8px 12px;
                margin-bottom: 10px;
                background: #f8fafc;
            }
            .header-table {
                width: 100%;
                border-collapse: collapse;
            }
            .header-title {
                font-size: 13pt;
                font-weight: 900;
                color: #1e3a8a;
                text-align: right;
            }
            .header-subtitle {
                font-size: 8pt;
                color: #475569;
                margin-top: 2px;
            }
            .header-meta {
                font-size: 8pt;
                text-align: left;
                line-height: 1.6;
                color: #334155;
            }
            .badge {
                display: inline-block;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 7.5pt;
                font-weight: bold;
            }
            .badge-blue { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
            .badge-green { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
            .badge-red { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }

            /* KPI Cards */
            .kpi-grid {
                width: 100%;
                border-collapse: separate;
                border-spacing: 6px 0;
                margin-bottom: 10px;
            }
            .kpi-card {
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                padding: 6px 8px;
                background: #f8fafc;
                text-align: center;
            }
            .kpi-title {
                font-size: 7.5pt;
                font-weight: bold;
                color: #475569;
                margin-bottom: 3px;
            }
            .kpi-value {
                font-size: 10.5pt;
                font-weight: 900;
                color: #0f172a;
            }
            .kpi-diff {
                font-size: 7.5pt;
                font-weight: bold;
                margin-top: 2px;
            }

            /* Section Header */
            .section-head {
                font-size: 9.5pt;
                font-weight: 800;
                color: #1e3a8a;
                border-right: 4px solid #2563eb;
                padding-right: 6px;
                margin: 8px 0 4px 0;
                display: flex;
                align-items: center;
            }
            
            /* Tables */
            .data-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 8px;
                font-size: 8.5pt;
            }
            .data-table th {
                background-color: #f1f5f9;
                color: #0f172a;
                font-weight: 800;
                border: 1px solid #cbd5e1;
                padding: 5px 6px;
                text-align: center;
                font-size: 8pt;
            }
            .data-table td {
                border: 1px solid #cbd5e1;
                padding: 4px 6px;
            }
            .data-table .cat-row {
                background-color: #e2e8f0;
                font-weight: 800;
                color: #1e293b;
                font-size: 8.5pt;
            }
            .data-table .total-row {
                background-color: #1e3a8a;
                color: #ffffff;
                font-weight: 900;
                font-size: 9pt;
            }
            .data-table .total-row td {
                border: 1px solid #1e3a8a;
            }

            /* Signatures & Footer */
            .sig-table {
                width: 100%;
                margin-top: 15px;
                border-collapse: collapse;
            }
            .sig-box {
                width: 33.33%;
                text-align: center;
                font-size: 8pt;
                padding: 8px;
                vertical-align: top;
            }
            .sig-title {
                font-weight: bold;
                color: #334155;
                margin-bottom: 30px;
            }
            .sig-name {
                color: #64748b;
                font-size: 7.5pt;
                border-top: 1px dashed #cbd5e1;
                padding-top: 4px;
                display: inline-block;
                width: 80%;
            }
            .doc-footer {
                margin-top: 10px;
                border-top: 1px solid #e2e8f0;
                padding-top: 4px;
                text-align: center;
                font-size: 7pt;
                color: #94a3b8;
            }
        </style>
    </head>
    <body>

    ${renderPage1 ? `
        <!-- PAGE 1: OVERVIEW & SUPPLY CHAIN TABLES -->
        <div class="page-container">
            <div class="header-banner">
                <table class="header-table">
                    <tr>
                        <td style="width: 60%; vertical-align: middle;">
                            <div class="header-title">گزارش مدیریتی و تراز وزنی وضعیت انبارها و زنجیره تامین</div>
                            <div class="header-subtitle">سامانه یکپارچه مانیتورینگ کارخانجات، واردات و انبارهای سایان ERP</div>
                        </td>
                        <td style="width: 40%; vertical-align: middle;" class="header-meta">
                            <div><strong>📅 تاریخ استعلام:</strong> ${reportDate}</div>
                            <div><strong>📊 دوره مبنا:</strong> ${r1Label} ⬅️ <strong>دوره جاری:</strong> ${r2Label}</div>
                            <div><strong>🏷️ نوع سند:</strong> <span class="badge badge-blue">گزارش جامع تراز و انبارداری (صفحه ۱)</span></div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- KPI Metric Summary -->
            <table class="kpi-grid">
                <tr>
                    <td class="kpi-card" style="width: 25%;">
                        <div class="kpi-title">🧵 نخ‌های تولیدی کارخانه</div>
                        <div class="kpi-value">${fNum(yCurr)} kg</div>
                        <div class="kpi-diff" style="color: ${yDiff >= 0 ? '#15803d' : '#b91c1c'};">
                            ${yDiff >= 0 ? '+' : ''}${fNum(yDiff)} kg (${yPct >= 0 ? '+' : ''}${fNum(yPct, 1)}%)
                        </div>
                    </td>
                    <td class="kpi-card" style="width: 25%;">
                        <div class="kpi-title">📦 مواد اولیه، واردات و گمرک</div>
                        <div class="kpi-value">${fNum(rCurr)} kg</div>
                        <div class="kpi-diff" style="color: ${rDiff >= 0 ? '#15803d' : '#b91c1c'};">
                            ${rDiff >= 0 ? '+' : ''}${fNum(rDiff)} kg (${rPct >= 0 ? '+' : ''}${fNum(rPct, 1)}%)
                        </div>
                    </td>
                    <td class="kpi-card" style="width: 25%; background: ${tDiff >= 0 ? '#f0fdf4' : '#fff1f2'}; border-color: ${tDiff >= 0 ? '#bbf7d0' : '#fecaca'};">
                        <div class="kpi-title">🏢 سرجمع کل موجودی زنجیره</div>
                        <div class="kpi-value" style="color: ${tDiff >= 0 ? '#166534' : '#991b1b'};">${fNum(tCurr)} kg</div>
                        <div class="kpi-diff" style="color: ${tDiff >= 0 ? '#15803d' : '#b91c1c'};">
                            ${tDiff >= 0 ? 'رشد تراز +' : 'کسری تراز '}${fNum(tDiff)} kg (${fTon(tDiff)} تن)
                        </div>
                    </td>
                    <td class="kpi-card" style="width: 25%;">
                        <div class="kpi-title">🚢 کانتینرها و ارزش دلاری</div>
                        <div class="kpi-value" style="color: #0284c7;">${summary.containersTotal || '۰'} کانتینر</div>
                        <div class="kpi-diff" style="color: #475569;">${summary.dollarsTotal ? `${fNum(summary.dollarsTotal)} $` : '۰ $'} ارزش در راه</div>
                    </td>
                </tr>
            </table>

            <!-- Table 1: Factory Yarns -->
            <div class="section-head">۱. جدول نخ‌های تولیدی کارخانه (تولید داخلی)</div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 30px;">#</th>
                        <th style="text-align: right;">نام گروه کالا / شرح تولید</th>
                        <th style="width: 105px;">وزن سال قبل (kg)</th>
                        <th style="width: 105px;">وزن سال جاری (kg)</th>
                        <th style="width: 105px;">اختلاف وزنی (kg)</th>
                        <th style="width: 75px;">درصد تغییر</th>
                    </tr>
                </thead>
                <tbody>
                    ${buildItemRows(yarnItems)}
                    <tr class="cat-row">
                        <td colspan="2" style="text-align: right; padding-right: 8px;">جمع کل نخ‌های تولیدی کارخانه</td>
                        <td style="text-align: center;">${fNum(yLast)}</td>
                        <td style="text-align: center;">${fNum(yCurr)}</td>
                        <td style="text-align: center; color: ${yDiff >= 0 ? '#15803d' : '#b91c1c'};">${yDiff >= 0 ? '+' : ''}${fNum(yDiff)}</td>
                        <td style="text-align: center; color: ${yDiff >= 0 ? '#15803d' : '#b91c1c'};">${yLast ? `${yPct >= 0 ? '+' : ''}${fNum(yPct, 1)}%` : '-'}</td>
                    </tr>
                </tbody>
            </table>

            <!-- Table 2: Raw & Imported Materials -->
            <div class="section-head">۲. جدول مواد اولیه، اقلام وارداتی و انبار سایان</div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 30px;">#</th>
                        <th style="text-align: right;">نام گروه کالا / مواد اولیه وارداتی</th>
                        <th style="width: 105px;">وزن سال قبل (kg)</th>
                        <th style="width: 105px;">وزن سال جاری (kg)</th>
                        <th style="width: 105px;">اختلاف وزنی (kg)</th>
                        <th style="width: 75px;">درصد تغییر</th>
                    </tr>
                </thead>
                <tbody>
                    ${buildItemRows(rawItems)}
                    <tr class="cat-row">
                        <td colspan="2" style="text-align: right; padding-right: 8px;">جمع کل مواد اولیه و وارداتی</td>
                        <td style="text-align: center;">${fNum(rLast)}</td>
                        <td style="text-align: center;">${fNum(rCurr)}</td>
                        <td style="text-align: center; color: ${rDiff >= 0 ? '#15803d' : '#b91c1c'};">${rDiff >= 0 ? '+' : ''}${fNum(rDiff)}</td>
                        <td style="text-align: center; color: ${rDiff >= 0 ? '#15803d' : '#b91c1c'};">${rLast ? `${rPct >= 0 ? '+' : ''}${fNum(rPct, 1)}%` : '-'}</td>
                    </tr>
                </tbody>
            </table>

            <!-- Logistics Table if exists -->
            ${logisticsItems.length > 0 ? `
                <div class="section-head">۳. بارهای در راه، گمرک و خریدهای در جریان</div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 30px;">#</th>
                            <th style="text-align: right;">شرح محموله / پروفرما</th>
                            <th style="width: 110px;">وضعیت</th>
                            <th style="width: 90px;">تعداد کانتینر</th>
                            <th style="width: 110px;">مقدار / ارزش</th>
                            <th style="width: 75px;">نوع ارز</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${buildLogisticsRows(logisticsItems)}
                    </tbody>
                </table>
            ` : ''}

            <!-- Grand Total Row -->
            <table class="data-table" style="margin-top: 4px;">
                <tbody>
                    <tr class="total-row">
                        <td style="text-align: right; padding-right: 10px; width: 45%;">
                            🏢 سرجمع کل موجودی زنجیره تامین و کارخانجات
                        </td>
                        <td style="text-align: center; width: 18%;">${fNum(tLast)} kg (${fTon(tLast)} تن)</td>
                        <td style="text-align: center; width: 18%;">${fNum(tCurr)} kg (${fTon(tCurr)} تن)</td>
                        <td style="text-align: center; width: 19%;">
                            ${tDiff >= 0 ? '+' : ''}${fNum(tDiff)} kg (${tPct >= 0 ? '+' : ''}${fNum(tPct, 1)}%)
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="doc-footer">
                گزارش رسمی انبارداری و مقایسه زنجیره تامین سایان ERP | تاریخ استعلام: ${reportDate} | صفحه ۱ از ${mode === 'both' ? '۲' : '۱'}
            </div>
        </div>
    ` : ''}

    ${renderPage2 ? `
        <!-- PAGE 2: TREND ANALYSIS, DEFICIT & GROWTH MATRIX -->
        <div class="page-container ${renderPage1 ? 'page-break' : ''}">
            <div class="header-banner" style="border-color: #dc2626;">
                <table class="header-table">
                    <tr>
                        <td style="width: 60%; vertical-align: middle;">
                            <div class="header-title" style="color: #991b1b;">تحلیل روند تغییرات وزنی، اقلام منفی و ماتریس کسری‌ها</div>
                            <div class="header-subtitle">پایش تخصصی رشد و افت اقلام نسبت به دوره گذشته جهت تصمیم‌گیری مدیریت</div>
                        </td>
                        <td style="width: 40%; vertical-align: middle;" class="header-meta">
                            <div><strong>📅 تاریخ استعلام:</strong> ${reportDate}</div>
                            <div><strong>⚠️ اقلام دارای کسری:</strong> <span class="badge badge-red">${fNum(negativeItems.length)} قلم کالا</span></div>
                            <div><strong>📈 اقلام دارای رشد:</strong> <span class="badge badge-green">${fNum(growthItems.length)} قلم کالا</span></div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Section: Negative Items Alert -->
            <div class="section-head" style="color: #991b1b; border-color: #dc2626;">
                🚨 ۱. فهرست کالاهای دارای کسری و افت وزنی نسبت به سال قبل (تراز منفی)
            </div>
            <table class="data-table" style="border-color: #fecaca;">
                <thead>
                    <tr style="background-color: #fee2e2;">
                        <th style="width: 30px; background-color: #fee2e2; color: #991b1b; border-color: #fecaca;">#</th>
                        <th style="text-align: right; background-color: #fee2e2; color: #991b1b; border-color: #fecaca;">نام کالا / شرح</th>
                        <th style="width: 85px; background-color: #fee2e2; color: #991b1b; border-color: #fecaca;">دسته</th>
                        <th style="width: 95px; background-color: #fee2e2; color: #991b1b; border-color: #fecaca;">سال قبل</th>
                        <th style="width: 95px; background-color: #fee2e2; color: #991b1b; border-color: #fecaca;">سال جاری</th>
                        <th style="width: 120px; background-color: #fee2e2; color: #991b1b; border-color: #fecaca;">میزان افت وزنی</th>
                        <th style="width: 70px; background-color: #fee2e2; color: #991b1b; border-color: #fecaca;">درصد افت</th>
                    </tr>
                </thead>
                <tbody>
                    ${buildNegativeRows(negativeItems)}
                </tbody>
            </table>

            <!-- Section: Positive Growth Items -->
            <div class="section-head" style="color: #166534; border-color: #16a34a; margin-top: 12px;">
                📈 ۲. فهرست کالاهای دارای بیشترین رشد وزنی و افزایش موجودی (تراز مثبت)
            </div>
            <table class="data-table" style="border-color: #bbf7d0;">
                <thead>
                    <tr style="background-color: #dcfce7;">
                        <th style="width: 30px; background-color: #dcfce7; color: #166534; border-color: #bbf7d0;">#</th>
                        <th style="text-align: right; background-color: #dcfce7; color: #166534; border-color: #bbf7d0;">نام کالا / شرح</th>
                        <th style="width: 85px; background-color: #dcfce7; color: #166534; border-color: #bbf7d0;">دسته</th>
                        <th style="width: 95px; background-color: #dcfce7; color: #166534; border-color: #bbf7d0;">سال قبل</th>
                        <th style="width: 95px; background-color: #dcfce7; color: #166534; border-color: #bbf7d0;">سال جاری</th>
                        <th style="width: 120px; background-color: #dcfce7; color: #166534; border-color: #bbf7d0;">میزان رشد وزنی</th>
                        <th style="width: 70px; background-color: #dcfce7; color: #166534; border-color: #bbf7d0;">درصد رشد</th>
                    </tr>
                </thead>
                <tbody>
                    ${buildGrowthRows(growthItems)}
                </tbody>
            </table>

            <!-- Signatures Section -->
            <table class="sig-table">
                <tr>
                    <td class="sig-box">
                        <div class="sig-title">تنظیم و استعلام گزارش انبار</div>
                        <div class="sig-name">${signature}</div>
                    </td>
                    <td class="sig-box">
                        <div class="sig-title">مدیریت بازرگانی و تامین خارجی</div>
                        <div class="sig-name">سرپرستی تامین و زنجیره کالا</div>
                    </td>
                    <td class="sig-box">
                        <div class="sig-title">رویت و تاییدیه مدیریت عامل</div>
                        <div class="sig-name">جناب آقای مهندس سلیمی</div>
                    </td>
                </tr>
            </table>

            <div class="doc-footer">
                گزارش تحلیلی روند رشد و کسری انبار | تاریخ استعلام: ${reportDate} | صفحه ${mode === 'both' ? '۲ از ۲' : '۱ از ۱'}
            </div>
        </div>
    ` : ''}

    </body>
    </html>
    `;
};
