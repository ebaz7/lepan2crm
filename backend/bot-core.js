
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import * as Renderer from './renderer.js';
import * as dbManager from './db-manager.js';
import * as utils from './utils.js';
import * as whatsapp from './whatsapp.js';

const getDb = dbManager.getDb;
const saveDb = dbManager.saveDb;
const toShamsiYearMonth = utils.toShamsiYearMonth;
const toShamsiFull = utils.toShamsiFull;
const findNextGapNumber = utils.findNextGapNumber;
const sanitizeGroupId = utils.sanitizeGroupId;
const generateUUID = utils.generateUUID;
const getTehranDateString = utils.getTehranDateString;

const getRolePermissions = (userRole, settings, userObject) => {
    if (userRole === 'admin') {
        return {
            canViewCustomerBalances: true,
            canImportCustomerBalances: true
        };
    }
    const perms = {
        canViewCustomerBalances: false,
        canImportCustomerBalances: false
    };
    switch (userRole) {
        case 'ceo':
        case 'financial':
            perms.canViewCustomerBalances = true;
            perms.canImportCustomerBalances = true;
            break;
        case 'manager':
        case 'sales_manager':
            perms.canViewCustomerBalances = true;
            break;
    }
    if (settings && settings.customRoles && settings.customRoles[userRole]) {
        const r = settings.customRoles[userRole];
        if (r.canViewCustomerBalances !== undefined) perms.canViewCustomerBalances = !!r.canViewCustomerBalances;
        if (r.canImportCustomerBalances !== undefined) perms.canImportCustomerBalances = !!r.canImportCustomerBalances;
    }
    return perms;
};

const normalizeChannelId = (id) => {
    if (!id) return id;
    id = id.toString().trim();
    // Support links
    if (id.startsWith('http')) {
        const parts = id.split('/');
        id = parts[parts.length - 1] || id;
    }
    // Remove if @ is at the end (user typo like lepanbaft@)
    if (id.endsWith('@')) id = id.slice(0, -1);
    
    if (id.startsWith('-100') || id.startsWith('-')) return id;
    if (!id.startsWith('@') && isNaN(Number(id))) return `@${id}`;
    return id;
};

// Session memory
export const sessions = {}; 
const lastSentIds = new Map(); // Use Map to store { key: timestamp }
const NOTIFY_DEDUPE_WINDOW = 30000; // 30 seconds

const isDuplicateNotification = (key) => {
    const now = Date.now();
    const lastTime = lastSentIds.get(key);
    if (lastTime && (now - lastTime) < NOTIFY_DEDUPE_WINDOW) {
        return true;
    }
    lastSentIds.set(key, now);
    // Cleanup old keys occasionally
    if (lastSentIds.size > 1000) {
        for (const [k, v] of lastSentIds.entries()) {
            if (now - v > NOTIFY_DEDUPE_WINDOW * 2) lastSentIds.delete(k);
        }
    }
    return false;
};

const resolveUser = (db, platform, chatId) => {
    if (platform === 'telegram') return db.users.find(u => u.telegramChatId == chatId);
    if (platform === 'bale') return db.users.find(u => u.baleChatId == chatId);
    return null;
};

const runSayanQuery = async (db, queryStr) => {
    const settings = db.settings || {};
    const serverSayanBaseUrl = settings.sayanApiUrl;
    const serverSayanApiKey = settings.sayanApiKey;
    
    if (!serverSayanBaseUrl || !serverSayanApiKey) {
        throw new Error('تنظیمات اتصال به سرور سایان (آدرس و رمز API) در سیستم پیکربندی نشده است.');
    }
    
    const finalUrl = `${serverSayanBaseUrl.replace(/\/$/, '')}/query`;
    const response = await fetch(finalUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${serverSayanApiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: queryStr })
    });
    
    if (!response.ok) {
        const errDetails = await response.json().catch(() => ({}));
        throw new Error(errDetails.error || 'خطای اتصال به سرور سایان ERP');
    }
    
    const data = await response.json();
    return data.data || [];
};

export const hasSayanReportsAccess = (user, section) => {
    if (!user) return false;
    if (['admin', 'ceo', 'financial'].includes(user.role)) return true;
    
    // Check if overall report access is explicitly revoked
    if (user.canAccessBotReports === false && user.canViewSayanReports === false && user.canAccessSayanReports === false) {
        return false;
    }
    
    // Check granular sections if requested
    if (section === 'balances' && user.canAccessSayanBalances === false) return false;
    if (section === 'pending' && user.canAccessSayanPendingDocs === false) return false;
    if (section === 'daily_sales' && user.canAccessSayanDailySales === false) return false;
    if (section === 'compare_sales' && user.canAccessSayanCompareSales === false) return false;

    return true;
};

export const getSayanReportsKeyboard = (user) => {
    const buttons = [];
    if (hasSayanReportsAccess(user, 'balances')) {
        buttons.push([{ text: '💳 استعلام و مانده حساب مشتریان', callback_data: 'SALES_CUSTOMER_BALANCES' }]);
    }
    if (hasSayanReportsAccess(user, 'pending')) {
        buttons.push([{ text: '📜 گزارش اسناد و چک‌های آویزان (PDF)', callback_data: 'BOT_SAYAN_PENDING_DOCS' }]);
    }
    if (hasSayanReportsAccess(user, 'daily_sales')) {
        buttons.push([{ text: '🧾 فاکتور فروش روزانه سایان (PDF)', callback_data: 'BOT_SAYAN_DAILY_SALES' }]);
    }
    if (hasSayanReportsAccess(user, 'compare_sales')) {
        buttons.push([{ text: '⚖️ مقایسه تحلیل فروش دو بازه (PDF)', callback_data: 'BOT_SAYAN_COMPARE_SALES' }]);
    }
    if (hasSayanReportsAccess(user, 'balances')) {
        buttons.push([
            { text: '🔴 دانلود بدهکاران (PDF)', callback_data: 'SALES_BAL_DOWNLOAD_DEBTORS' },
            { text: '📊 اکسل بدهکاران', callback_data: 'SALES_BAL_DOWNLOAD_DEBTORS_XLSX' }
        ]);
        buttons.push([
            { text: '🟢 دانلود بستانکاران (PDF)', callback_data: 'SALES_BAL_DOWNLOAD_CREDITORS' },
            { text: '📈 اکسل بستانکاران', callback_data: 'SALES_BAL_DOWNLOAD_CREDITORS_XLSX' }
        ]);
    }
    buttons.push([{ text: '🔙 بازگشت به گزارشات مدیریتی', callback_data: 'MENU_REPORTS' }]);
    return { inline_keyboard: buttons };
};

export const matchAccountCode = (bCode, inputCode) => {
    if (!bCode || !inputCode) return false;
    const bc = String(bCode).trim().toLowerCase();
    const ic = String(inputCode).trim().toLowerCase();
    if (bc === ic) return true;
    
    // Compare without leading zeros
    const bcNoZeros = bc.replace(/^0+/, '');
    const icNoZeros = ic.replace(/^0+/, '');
    if (bcNoZeros && icNoZeros && bcNoZeros === icNoZeros) return true;
    
    return false;
};

export const getCustomerBalancesData = async (db) => {
    let list = [];

    if (db.settings?.sayanApiUrl) {
        try {
            // 1. Fetch Tafsilis
            const tafsiliSql = `
                SELECT DISTINCT 
                    Field_003 as Code, 
                    Field_006 as Name, 
                    Field_005 as TafsiliCode,
                    Field_004 as MoeinGroup
                FROM ACT_TBL_007 
                WHERE Field_004 LIKE '11%' OR Field_004 LIKE '31%' OR Field_003 LIKE '11%' OR Field_003 LIKE '31%'
            `;
            const tafsilis = await runSayanQuery(db, tafsiliSql);

            // 2. Fetch Traz
            const trazSql = `
                SELECT 
                    t24.Field_010 as TafsiliRaw,
                    SUM(CAST(t24.Field_006 AS FLOAT)) as TotalBed,
                    SUM(CAST(t24.Field_007 AS FLOAT)) as TotalBes
                FROM ACT_TBL_024 t24
                WHERE (t24.Field_010 LIKE '11%' OR t24.Field_010 LIKE '%-11%' OR t24.Field_010 LIKE '31%' OR t24.Field_010 LIKE '%-31%') 
                  AND t24.Field_010 NOT LIKE '%-12%'
                  AND t24.Field_010 NOT LIKE '%-13%'
                  AND t24.Field_005 NOT IN ('102', '103', '107', '109', '114', '116', '117')
                  AND t24.Field_003 <> '9'
                GROUP BY t24.Field_010
            `;
            const rawRows = await runSayanQuery(db, trazSql);

            // Helper to parse TafsiliRaw
            const parseTafsiliRaw = (raw) => {
                if (!raw) return { moein: '', code: '' };
                const parts = raw.split('-');
                for (const part of parts) {
                    const match = part.match(/^(11\d*|31\d*):(\d+)/);
                    if (match) {
                        return { moein: match[1], code: match[2] };
                    }
                }
                const match = raw.match(/(11\d*|31\d*):(\d+)/);
                if (match) {
                    return { moein: match[1], code: match[2] };
                }
                return { moein: '', code: '' };
            };

            // 3. Map and group
            const groupedMap = new Map();
            rawRows.forEach((row) => {
                const parsed = parseTafsiliRaw(row.TafsiliRaw);
                const code = parsed.code;
                if (!code) return;
                
                const tafsili = tafsilis.find(t => matchAccountCode(t.Code, code) || matchAccountCode(t.TafsiliCode, code));
                const name = tafsili ? tafsili.Name : `کد اشخاص ${code}`;
                const bed = parseFloat(row.TotalBed || 0);
                const bes = parseFloat(row.TotalBes || 0);
                
                if (groupedMap.has(code)) {
                    const existing = groupedMap.get(code);
                    existing.bed += bed;
                    existing.bes += bes;
                    existing.balance = existing.bed - existing.bes;
                } else {
                    groupedMap.set(code, {
                        accountCode: code,
                        name,
                        bed,
                        bes,
                        balance: bed - bes
                    });
                }
            });

            list = Array.from(groupedMap.values())
                .filter((r) => r.balance !== 0)
                .map((r) => ({
                    accountCode: r.accountCode,
                    name: r.name,
                    balance: Math.abs(r.balance),
                    type: r.balance > 0 ? 'بدهکار' : 'بستانکار',
                    rawBalance: r.balance,
                    updatedAt: Date.now()
                }));
        } catch (err) {
            console.error("Failed to query live Sayan balances:", err);
        }
    }

    if (list.length === 0) {
        return db.customerBalances || [];
    }
    return list;
};

const getTehranOffsetDateString = (offsetDays = 0) => {
    const now = new Date();
    const target = new Date(now.getTime() - offsetDays * 24 * 60 * 60 * 1000);
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return formatter.format(target);
};

const generateAndSendComparisonPDF = async (db, chatId, sendFn, sendDocFn, dateFromA, dateToA, dateFromB, dateToB, nameA = "بازه اول", nameB = "بازه دوم") => {
    await sendFn(chatId, `⏳ در حال محاسبه و استعلام گزارش مقایسه‌ای فروش سایان (${nameA} در برابر ${nameB})... لطفا شکیبا باشید.`);
    
    try {
        const buildSql = (from, to) => `
            SELECT 
                t10.Field_005 as DocId,
                t10.Field_006 as InvoiceNum,
                t10.Field_008 as Date,
                t11.Field_005 as ItemCode,
                t22.Field_004 as ItemName,
                t11.Field_006 as Quantity,
                t11.Field_007 as Amount,
                t_group.GroupName,
                t07.Field_006 as CustomerName
            FROM STR_TBL_010 t10
            INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
            LEFT JOIN IND_TBL_022 t22 ON t11.Field_005 = t22.Field_005
            LEFT JOIN (
                SELECT t21_sub.Field_004 as ItemCode, MIN(COALESCE(t02_parent.Field_003, t02_sub.Field_003)) as GroupName
                FROM IND_TBL_021 t21_sub
                LEFT JOIN IND_TBL_002 t02_sub ON t21_sub.Field_003 = t02_sub.Field_008
                LEFT JOIN IND_TBL_002 t02_parent ON t02_sub.Field_009 = t02_parent.Field_008
                GROUP BY t21_sub.Field_004
            ) t_group ON t11.Field_005 = t_group.ItemCode
            LEFT JOIN ACT_TBL_007 t07 ON t10.Field_010 = t07.Field_005 AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
            WHERE t10.Field_009 IN ('3', '12', '23')
              AND t11.Field_036 = t10.Field_009
              AND t11.Field_007 IS NOT NULL AND t11.Field_007 > 0
              AND t10.Field_008 BETWEEN '${from}' AND '${to}'
            ORDER BY t10.Field_008 DESC
        `;

        const [rowsA, rowsB] = await Promise.all([
            runSayanQuery(db, buildSql(dateFromA, dateToA)),
            runSayanQuery(db, buildSql(dateFromB, dateToB))
        ]);

        const groupMap = new Map();

        const processRows = (rows, isPeriodA) => {
            rows.forEach(r => {
                const grp = r.GroupName || 'سایر موارد';
                const qty = parseFloat(r.Quantity || 0);
                const amt = parseFloat(r.Amount || 0);

                if (!groupMap.has(grp)) {
                    groupMap.set(grp, { qtyA: 0, amtA: 0, qtyB: 0, amtB: 0 });
                }
                const entry = groupMap.get(grp);
                if (isPeriodA) {
                    entry.qtyA += qty;
                    entry.amtA += amt;
                } else {
                    entry.qtyB += qty;
                    entry.amtB += amt;
                }
            });
        };

        processRows(rowsA, true);
        processRows(rowsB, false);

        let sumQtyA = 0, sumAmtA = 0, sumQtyB = 0, sumAmtB = 0;
        const columns = ['ردیف', 'گروه کالا', `مقدار ${nameA}`, `مبلغ ${nameA} (ریال)`, `مقدار ${nameB}`, `مبلغ ${nameB} (ریال)`, 'تغییر مبلغ (%)'];

        const tableRows = [];
        let index = 1;

        groupMap.forEach((data, groupName) => {
            sumQtyA += data.qtyA;
            sumAmtA += data.amtA;
            sumQtyB += data.qtyB;
            sumAmtB += data.amtB;

            const diffAmt = data.amtA - data.amtB;
            const pct = data.amtB > 0 ? ((diffAmt / data.amtB) * 100).toFixed(1) : (data.amtA > 0 ? '+100' : '0');
            const pctStr = Number(pct) >= 0 ? `+${pct}%` : `${pct}%`;

            tableRows.push([
                (index++).toLocaleString('fa-IR'),
                groupName,
                data.qtyA.toLocaleString('fa-IR'),
                data.amtA.toLocaleString('fa-IR'),
                data.qtyB.toLocaleString('fa-IR'),
                data.amtB.toLocaleString('fa-IR'),
                pctStr
            ]);
        });

        const totalDiffAmt = sumAmtA - sumAmtB;
        const totalPct = sumAmtB > 0 ? ((totalDiffAmt / sumAmtB) * 100).toFixed(1) : (sumAmtA > 0 ? '+100' : '0');
        const totalPctStr = Number(totalPct) >= 0 ? `+${totalPct}%` : `${totalPct}%`;

        tableRows.push([
            'جمع کل',
            'خلاصه عملکرد',
            sumQtyA.toLocaleString('fa-IR'),
            sumAmtA.toLocaleString('fa-IR'),
            sumQtyB.toLocaleString('fa-IR'),
            sumAmtB.toLocaleString('fa-IR'),
            totalPctStr
        ]);

        const title = `گزارش مدیریتی مقایسه فروش Sayan ERP (${nameA} در برابر ${nameB})`;
        const pdfBuffer = await Renderer.generateReportPDF(title, columns, tableRows);
        const filename = `Sayan_Sales_Comparison_${dateFromA}_VS_${dateFromB}.pdf`;

        const caption = `📊 *گزارش مقایسه‌ای فروش Sayan ERP*\n\n` +
            `🔹 **${nameA} (${dateFromA} تا ${dateToA}):**\n` +
            `   📦 مقدار کل: ${sumQtyA.toLocaleString('fa-IR')} کیلوگرم\n` +
            `   💰 مبلغ کل: ${sumAmtA.toLocaleString('fa-IR')} ریال\n\n` +
            `🔸 **${nameB} (${dateFromB} تا ${dateToB}):**\n` +
            `   📦 مقدار کل: ${sumQtyB.toLocaleString('fa-IR')} کیلوگرم\n` +
            `   💰 مبلغ کل: ${sumAmtB.toLocaleString('fa-IR')} ریال\n\n` +
            `📈 **درصد تغییرات فروش:** ${totalPctStr}`;

        await sendDocFn(chatId, pdfBuffer, filename, caption);
    } catch (err) {
        console.error("Bot Comparative Sales Error:", err);
        sendFn(chatId, `❌ خطا در استعلام گزارش مقایسه‌ای سایان: ${err.message}`);
    }
};

const getAvailableYears = (list) => {
    const years = new Set();
    list.forEach(o => {
        const sh = toShamsiYearMonth(o.date);
        if (sh) years.add(sh.split('/')[0]);
    });
    const sorted = Array.from(years).sort().reverse();
    if (sorted.length === 0) return ['1403'];
    return sorted;
};

const generateExcelBuffer = (columns, rows, sheetName = "Report") => {
    const wsData = [columns, ...rows];
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet(wsData);
    
    // Set column widths so content is not truncated
    const maxCols = columns.length;
    const colWidths = [];
    for (let c = 0; c < maxCols; c++) {
        let maxLen = columns[c] ? columns[c].toString().length : 0;
        for (let r = 0; r < wsData.length; r++) {
            if (wsData[r] && wsData[r][c] !== undefined && wsData[r][c] !== null) {
                const len = wsData[r][c].toString().length;
                if (len > maxLen) maxLen = len;
            }
        }
        colWidths.push({ wch: Math.max(maxLen + 3, 10) });
    }
    ws['!cols'] = colWidths;
    
    xlsx.utils.book_append_sheet(wb, ws, sheetName);
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buffer;
};

// --- KEYBOARDS ---
const KEYBOARDS = {
    MAIN: {
        inline_keyboard: [
            [{ text: '💰 مدیریت پرداخت', callback_data: 'MENU_PAY' }, { text: '🚛 مدیریت خروج', callback_data: 'MENU_EXIT' }],
            [{ text: '📦 انبار و موجودی', callback_data: 'MENU_WH' }, { text: '🌍 بازرگانی', callback_data: 'MENU_TRADE' }],
            [{ text: '🛒 فروش', callback_data: 'MENU_SALES' }, { text: '📂 دبیرخانه اداری', callback_data: 'MENU_SEC' }],
            [{ text: '📊 گزارشات مدیریتی', callback_data: 'MENU_REPORTS' }, { text: 'ℹ️ اطلاعات شرکت و بانک‌ها', callback_data: 'ACT_KNOWLEDGE' }],
            [{ text: '👤 پروفایل', callback_data: 'MENU_PROFILE' }]
        ]
    },
    SECRETARIAT: {
        inline_keyboard: [
            [{ text: '📥 نامه‌های منتظر تایید من', callback_data: 'SEC_PENDING' }],
            [{ text: '📂 آخرین نامه‌های کارتابل', callback_data: 'SEC_CARTABLE_LATEST' }],
            [{ text: '🔎 جستجو در نامه‌ها', callback_data: 'SEC_SEARCH' }],
            [{ text: '➕ ثبت نامه جدید (ارسال فایل)', callback_data: 'SEC_NEW_LETTER_FLOW' }],
            [{ text: '🔙 بازگشت به منوی اصلی', callback_data: 'MENU_MAIN' }]
        ]
    },
    SALES: {
        inline_keyboard: [
            [{ text: '💳 استعلام و مانده حساب مشتریان', callback_data: 'SALES_CUSTOMER_BALANCES' }],
            [{ text: '🔍 جستجوی کالا (نام/کد)', callback_data: 'SALES_SEARCH' }],
            [{ text: '🔖 دسته‌بندی محصولات (هرمی)', callback_data: 'SALES_GROUPS' }],
            [{ text: '📦 لیست کامل قیمت محصولات', callback_data: 'SALES_LIST_ALL' }],
            [{ text: '📢 ارسال پیام گروهی به مشتریان', callback_data: 'SALES_BROADCAST' }],
            [{ text: '🛒 ورود به بخش مشتریان', callback_data: 'GUEST_MAIN' }],
            [{ text: '🏢 ارسال اطلاعات شرکت به مشتری', callback_data: 'ACT_SEND_CO_INFO' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    PAYMENT: {
        inline_keyboard: [
            [{ text: '➕ ثبت دستور پرداخت', callback_data: 'ACT_PAY_NEW' }],
            [{ text: '📂 کارتابل پرداخت (تایید)', callback_data: 'ACT_PAY_CARTABLE' }],
            [{ text: '🔎 جستجو با شماره', callback_data: 'ACT_SEARCH_ID_PAY' }, { text: '🗄️ آرشیو تاریخی', callback_data: 'ACT_ARCHIVE_PAY' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    EXIT: {
        inline_keyboard: [
            [{ text: '➕ ثبت مجوز خروج', callback_data: 'ACT_EXIT_NEW' }],
            [{ text: '📂 کارتابل خروج (تایید/رد)', callback_data: 'ACT_EXIT_CARTABLE' }],
            [{ text: '🔎 جستجو با شماره', callback_data: 'ACT_SEARCH_ID_EXIT' }, { text: '🗄️ آرشیو تاریخی', callback_data: 'ACT_ARCHIVE_EXIT' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    WAREHOUSE: {
        inline_keyboard: [
            [{ text: '➕ ثبت بیجک خروج', callback_data: 'ACT_WH_NEW_BIJAK' }],
            [{ text: '📂 کارتابل انبار (تایید/رد)', callback_data: 'ACT_WH_CARTABLE' }], 
            [{ text: '🔎 جستجو بیجک (شماره)', callback_data: 'ACT_SEARCH_ID_WH' }],
            [{ text: '🗄️ آرشیو بیجک‌ها', callback_data: 'ACT_ARCHIVE_WH_OUT' }, { text: '🗄️ آرشیو رسیدها', callback_data: 'ACT_ARCHIVE_WH_IN' }],
            [{ text: '📦 گزارش موجودی (PDF)', callback_data: 'WH_RPT_STOCK' }, { text: '📊 گزارش خروج (PDF/Excel)', callback_data: 'WH_RPT_DISPATCH_PROMPT' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    TRADE: {
        inline_keyboard: [
            [{ text: '📂 لیست پرونده‌های فعال (PDF)', callback_data: 'TRD_RPT_ACTIVE' }],
            [{ text: '⏳ گزارش صف تخصیص ارز (PDF)', callback_data: 'TRD_RPT_ALLOCATION' }],
            [{ text: '💰 گزارش خرید ارز (PDF)', callback_data: 'TRD_RPT_CURRENCY' }],
            [{ text: '🛡️ گزارش تضامین و بیمه (PDF)', callback_data: 'TRD_RPT_INSURANCE' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ]
    },
    REPORTS: { 
        inline_keyboard: [
            [{ text: '📊 خلاصه وضعیت امور جاری', callback_data: 'RPT_DAILY' }],
            [{ text: '🗓 عملکرد ماه جاری سیستم', callback_data: 'RPT_MONTHLY' }],
            [{ text: '🏢 گزارشات حسابداری و ERP سایان (مانده، آویزان و فروش)', callback_data: 'SAYAN_REPORTS_MENU' }],
            [{ text: '⏳ وضعیت کارتابل‌ها (پاسخ‌نشده)', callback_data: 'RPT_PENDING' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]
        ] 
    },
    SAYAN_REPORTS: {
        inline_keyboard: [
            [{ text: '💳 استعلام و مانده حساب مشتریان', callback_data: 'SALES_CUSTOMER_BALANCES' }],
            [{ text: '📜 گزارش اسناد و چک‌های آویزان (PDF)', callback_data: 'BOT_SAYAN_PENDING_DOCS' }],
            [{ text: '🧾 فاکتور فروش روزانه سایان (PDF)', callback_data: 'BOT_SAYAN_DAILY_SALES' }],
            [{ text: '⚖️ مقایسه تحلیل فروش دو بازه (PDF)', callback_data: 'BOT_SAYAN_COMPARE_SALES' }],
            [{ text: '🔴 دانلود لیست بدهکاران (PDF)', callback_data: 'SALES_BAL_DOWNLOAD_DEBTORS' }, { text: '📊 اکسل بدهکاران', callback_data: 'SALES_BAL_DOWNLOAD_DEBTORS_XLSX' }],
            [{ text: '🟢 دانلود لیست بستانکاران (PDF)', callback_data: 'SALES_BAL_DOWNLOAD_CREDITORS' }, { text: '📈 اکسل بستانکاران', callback_data: 'SALES_BAL_DOWNLOAD_CREDITORS_XLSX' }],
            [{ text: '🔙 بازگشت به گزارشات مدیریتی', callback_data: 'MENU_REPORTS' }]
        ]
    },
    BACK: { inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'MENU_MAIN' }]] }
};

// --- GENERIC SEARCH FUNCTION ---
const searchAndSendResults = async (db, company, query, mode, type, platform, chatId, sendFn, sendPhotoFn) => {
    let sourceData = [];
    let imageType = '';
    
    if (type === 'PAYMENT') { sourceData = db.orders || []; imageType = 'PAYMENT'; }
    else if (type === 'EXIT') { sourceData = db.exitPermits || []; imageType = 'EXIT'; }
    else if (type === 'WH_OUT' || type === 'WH_BIJAK') { sourceData = (db.warehouseTransactions || []).filter(t => t.type === 'OUT'); imageType = 'BIJAK'; }
    else if (type === 'WH_IN') { sourceData = (db.warehouseTransactions || []).filter(t => t.type === 'IN'); imageType = 'RECEIPT'; }

    const results = sourceData.filter(o => {
        // ID Search Logic
        if (mode === 'ID') {
            const num = (o.trackingNumber || o.permitNumber || o.number || '').toString();
            return num.includes(query);
        }

        const itemCompany = o.company || o.payingCompany;
        if (company && itemCompany !== company) return false;
        
        if (mode === 'MONTH') {
            const shamsiMonth = toShamsiYearMonth(o.date);
            return shamsiMonth === query;
        } else if (mode === 'EXACT_DAY') {
            try {
                const d = new Date(o.date);
                const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran' });
                const parts = formatter.formatToParts(d);
                const y = parts.find(p=>p.type==='year')?.value;
                const m = parts.find(p=>p.type==='month')?.value;
                const d_ = parts.find(p=>p.type==='day')?.value;
                return `${y}/${m}/${d_}` === query;
            } catch(e) { return false; }
        }
        return false;
    });

    if (results.length === 0) {
        return sendFn(chatId, `❌ موردی یافت نشد.`);
    }

    await sendFn(chatId, `✅ تعداد ${results.length} سند یافت شد. در حال ارسال...`);

    // Limit results to 10 to avoid spamming
    const limitedResults = results.slice(0, 10);

    for (const item of limitedResults) {
        try {
            const img = await Renderer.generateRecordImage(item, imageType, { forceHidePrices: false });
            
            let caption = '';
            let pdfCallback = '';

            if (type === 'PAYMENT') {
                caption = `📄 *شماره ${item.trackingNumber}*\n🏢 شرکت: ${item.payingCompany || '-'}\n📅 تاریخ: ${toShamsiFull(item.date)}\n👤 ذینفع: ${item.payee}\n💰 مبلغ: ${parseInt(item.totalAmount).toLocaleString()} ریال\n📝 بابت: ${item.description}\n🔄 وضعیت: ${item.status}\n👤 درخواست‌کننده: ${item.requester || '-'}`;
                pdfCallback = `GEN_PDF_ORDER_${item.id}`;
            } else if (type === 'EXIT') {
                const totalReqCount = (item.items && item.items.length > 0) 
                    ? item.items.reduce((sum, i) => sum + (Number(i.cartonCount) || 0), 0)
                    : (Number(item.cartonCount) || 0);
                const showDeliv = item.items && item.items.some(i => i.deliveredCartonCount !== undefined);
                const totalDelivCount = showDeliv ? (item.items||[]).reduce((sum, i) => sum + (Number(i.deliveredCartonCount) || 0), 0) : totalReqCount;
                
                caption = `🚛 *مجوز خروج کالا #${item.permitNumber}*\n🏢 شرکت: ${item.company || '-'}\n📅 تاریخ: ${toShamsiFull(item.date)}\n👤 گیرنده: ${item.recipientName}\n📦 کالا: ${item.goodsName || 'چند مورد'}\n🔢 تعداد درخواستی: ${totalReqCount} ${showDeliv ? `\n✅ تعداد خروجی (انبار): ${totalDelivCount}` : ''}\n🔄 وضعیت: ${item.status}\n👤 درخواست‌کننده: ${item.requester || '-'}`;
                pdfCallback = `GEN_PDF_EXIT_${item.id}`;
            } else if (type === 'WH_OUT' || type === 'WH_BIJAK') {
                caption = `📦 *حواله انبار (بیجک) #${item.number}*\n📅 تاریخ: ${toShamsiFull(item.date)}\n👤 گیرنده: ${item.recipientName}\n🚛 راننده: ${item.driverName||'-'}`;
                pdfCallback = `GEN_PDF_BIJAK_${item.id}`;
            } else if (type === 'WH_IN') {
                caption = `📥 *رسید ورود #${item.proformaNumber}*\n📅 تاریخ: ${toShamsiFull(item.date)}\n📦 اقلام: ${item.items.length} ردیف`;
            }

            const kb = pdfCallback ? { inline_keyboard: [[{ text: '📥 دریافت PDF', callback_data: pdfCallback }]] } : undefined;

            if (img && img.length > 0) {
                await sendPhotoFn(platform, chatId, img, caption, { reply_markup: kb });
            } else {
                await sendFn(chatId, caption, { reply_markup: kb });
            }
        } catch (e) { console.error(e); }
    }
    
    if (results.length > 10) {
        await sendFn(chatId, `⚠️ ... و ${results.length - 10} مورد دیگر. لطفا جستجو را محدودتر کنید.`);
    }
    
    const endMenu = (platform === 'telegram' || platform === 'bale') && (chatId.toString().startsWith('-') || chatId.toString().length > 10) ? undefined : KEYBOARDS.MAIN;
    await sendFn(chatId, "✅ پایان لیست.", { reply_markup: endMenu });
};

export const runDailyReport = async (platform, chatId, dateStr, sendFn, sendDocFn) => {
    const db = getDb();
    const settings = db.settings || {};

    const toEnglishDigits = (str) => {
        if (typeof str !== 'string') return str;
        return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    };

    const normalizeDateString = (str) => {
        if (!str) return str;
        return str.split('/').map(part => part.padStart(2, '0')).join('/');
    };

    const matchesDate = (dateVal) => {
        if (!dateVal) return false;
        const normalizedInput = normalizeDateString(toEnglishDigits(String(dateVal)));
        if (normalizedInput.includes('/') && normalizedInput.length >= 8) {
             // It's likely already a shamsi string
             return normalizedInput.startsWith(dateStr) || normalizedInput === dateStr;
        }
        try {
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return false;
            
            // Explicitly format in Tehran timezone to avoid UTC shifts
            const fmt = new Intl.DateTimeFormat('fa-IR', { 
                year: 'numeric', month: '2-digit', day: '2-digit', 
                timeZone: 'Asia/Tehran' 
            });
            const shamsiRaw = fmt.format(d);
            return normalizeDateString(toEnglishDigits(shamsiRaw)) === dateStr;
        } catch(e) { return false; }
    };

    // Determine which reports to show. If it's a recognized group, show only that module.
    // If it's not a recognized group (e.g. ad-hoc request), show all available for that date.
    
    const matchesId = (cid, sid) => {
        if (!sid) return false;
        const n1 = normalizeChannelId(cid);
        const n2 = normalizeChannelId(sid);
        return n1 && n2 && n1 === n2;
    };

    const g1 = settings.exitPermitFirstGroupConfig || {};
    const g2 = settings.exitPermitSecondGroupConfig || {};
    const g3 = settings.exitPermitThirdGroupConfig || {};

    const isKnownAccounting = 
        (platform === 'telegram' && (matchesId(chatId, settings.botAccountingGroupIdTele) || matchesId(chatId, settings.botAccountingGroupId))) ||
        (platform === 'bale' && matchesId(chatId, settings.botAccountingGroupIdBale)) ||
        (platform === 'whatsapp' && (matchesId(chatId, settings.botAccountingGroupIdWhatsApp) || matchesId(chatId, settings.botAccountingGroupId)));

    const isKnownBijak = 
        (platform === 'telegram' && matchesId(chatId, settings.botBijakGroupId)) ||
        (platform === 'bale' && matchesId(chatId, settings.botBijakGroupIdBale)) ||
        (platform === 'whatsapp' && matchesId(chatId, settings.botBijakGroupIdWhatsApp));

    const isKnownLogistics = 
        (platform === 'telegram' && (matchesId(chatId, settings.exitPermitNotificationTelegramId) || matchesId(chatId, settings.botSecurityGroupId) || matchesId(chatId, g1.telegramId) || matchesId(chatId, g2.telegramId) || matchesId(chatId, g3.telegramId) || matchesId(chatId, settings.dailyExitReportDedicatedTelegramId))) ||
        (platform === 'bale' && (matchesId(chatId, settings.exitPermitNotificationBaleId) || matchesId(chatId, g1.baleId) || matchesId(chatId, g2.baleId) || matchesId(chatId, g3.baleId) || matchesId(chatId, settings.dailyExitReportDedicatedBaleId))) ||
        (platform === 'whatsapp' && (matchesId(chatId, settings.exitPermitNotificationGroup) || matchesId(chatId, g1.groupId) || matchesId(chatId, g2.groupId) || matchesId(chatId, g3.groupId) || matchesId(chatId, settings.dailyExitReportDedicatedWhatsAppId)));

    const isRecognized = isKnownAccounting || isKnownBijak || isKnownLogistics;

    const isGroup = chatId.toString().startsWith('-') || 
                  (platform === 'bale' && (chatId.toString().startsWith('g') || chatId.toString().length > 10)) ||
                  chatId.toString().includes('@') ||
                  isRecognized;

    const isPrivate = !isGroup;

    // Determine which reports to show based on group context
    // If it's a recognized group, ONLY show that specific module.
    // If it's a private chat and not recognized as a specific group, show everything.
    const showPayments = isKnownAccounting || (isPrivate && !isRecognized);
    const showBijaks = isKnownBijak || (isPrivate && !isRecognized);
    const showLogistics = isKnownLogistics || (isPrivate && !isRecognized);
    
    const showAll = isPrivate && !isRecognized;

    console.log(`[DailyReport] Platform: ${platform}, Chat: ${chatId}, Private: ${isPrivate}, Recognized: ${isRecognized}`);
    console.log(`[DailyReport] Roles: Accounting=${isKnownAccounting}, Bijak=${isKnownBijak}, Logistics=${isKnownLogistics}`);

    // If it's a group but UNRECOGNIZED, warn the user
    if (isGroup && !isRecognized) {
        return sendFn(chatId, `⚠️ این گروه در تنظیمات بات شناسایی نشد.\n🆔 شناسه چت: \`${chatId}\`\n✅ لطفا این شناسه را در بخش پیکربندی بات برای گروه‌های مربوطه (حسابداری، خروج یا بیجک) وارد کنید.`);
    }

    // 1. PAYMENT REPORT
    if (showPayments || showAll) {
        console.log(`[DailyReport] checking payments for date ${dateStr}`);
        const finalPayments = (db.orders || []).filter(p => matchesDate(p.date));
        if (finalPayments.length > 0) {
            console.log(`[DailyReport] found ${finalPayments.length} payments`);
            let reportMsg = `💰 *گزارش پرداختی‌های ${dateStr}*\n\n`;
            finalPayments.forEach((p, idx) => {
                const amount = Number(p.totalAmount || 0).toLocaleString();
                let paymentBankInfo = 'صندوق / نقدی';
                if (p.paymentDetails && p.paymentDetails.length > 0) {
                    const banks = [...new Set(p.paymentDetails.map(d => d.bankName || d.method).filter(Boolean))];
                    if (banks.length > 0) paymentBankInfo = banks.join('، ');
                }
                reportMsg += `${idx + 1}. *#${p.trackingNumber}* | بانک: ${paymentBankInfo}\n💵 مبلغ: ${amount} ریال\n👤 در وجه: ${p.payee}\n📝 بابت: ${p.description}\n📊 وضعیت: ${p.status}\n------------------\n`;
            });
            if (sendFn) await sendFn(chatId, reportMsg);

            if (sendFn) sendFn(chatId, `⏳ در حال تولید فایل PDF از تصاویر ${finalPayments.length} پرداخت...`).catch(()=>{});
            try {
                console.log(`[DailyReport] Generating Payment PDF for ${finalPayments.length} items...`);
                const htmlParts = [];
                for (const p of finalPayments) {
                    try {
                        const imgBuffer = await Renderer.generateRecordImage(p, 'PAYMENT', { forceHidePrices: false });
                        if (imgBuffer) {
                            const b64 = imgBuffer.toString('base64');
                            htmlParts.push(`<div style="page-break-after: always; text-align: center; height: 100vh; display: flex; align-items: center; justify-content: center;"><img src="data:image/png;base64,${b64}" style="max-height: 95vh; max-width: 95vw;" /></div>`);
                        }
                    } catch(e) { console.error(`[DailyReport] Failed to generate image for payment ${p.trackingNumber}:`, e.message); }
                }
                if (htmlParts.length > 0) {
                    console.log(`[DailyReport] HTML composed, calling generatePdfBuffer...`);
                    const pdfBuffer = await Renderer.generatePdfBuffer(htmlParts.join(''));
                    console.log(`[DailyReport] PDF buffer ready (${pdfBuffer.length} bytes). Sending...`);
                    if (sendDocFn) {
                        const res = await sendDocFn(chatId, pdfBuffer, `Payment_Report_${dateStr.replace(/[\/\\]/g,'-')}.pdf`, `💰 گزارش تصاویر پرداختی‌ها ${dateStr}`);
                        console.log(`[DailyReport] PDF send result:`, res ? "Success" : "Failed/Empty");
                    } else {
                        console.error(`[DailyReport] sendDocFn is not defined for ${platform}`);
                    }
                } else {
                    console.warn(`[DailyReport] No images generated for Payment PDF.`);
                }
            } catch (e) { console.error("PDF generation failed:", e); }
        } else if (isKnownAccounting) {
            if (sendFn) await sendFn(chatId, `📭 در تاریخ ${dateStr} پرداختی ثبت نشده است.`);
        }
    }

    // 2. BIJAK / LOGISTICS REPORT
    if (showBijaks || showLogistics || showAll) {
        // If it's logistics group or general request, show Exit Permits report, else if Bijak group show Bijak report
        const sBijak = showBijaks || showAll;
        const sLogistics = showLogistics || showAll;

        if (sBijak) {
            const finalBijaks = (db.warehouseTransactions || []).filter(t => t.type === 'OUT' && matchesDate(t.date));
            if (finalBijaks.length > 0) {
                const grouped = finalBijaks.reduce((acc, b) => {
                    const comp = b.company || 'بدون شرکت';
                    acc[comp] = acc[comp] || [];
                    acc[comp].push(b);
                    return acc;
                }, {});
                
                let reportMsg = `📦 *گزارش بیجک‌های انبار ${dateStr}*\n\n`;
                for (const [comp, bijaks] of Object.entries(grouped)) {
                    reportMsg += `🏢 *شرکت: ${comp}*\n`;
                    bijaks.forEach((b, idx) => {
                        reportMsg += `  ${idx + 1}. بیجک #${b.number} | گیرنده: ${b.recipientName} | راننده: ${b.driverName || '---'}\n`;
                    });
                    reportMsg += `------------------\n`;
                }
                
                if (sendFn) await sendFn(chatId, reportMsg).catch(e => console.error("Error sending Bijak msg:", e));

                if (sendFn) sendFn(chatId, `⏳ در حال تولید فایل PDF از تصاویر ${finalBijaks.length} بیجک...`).catch(()=>{});
                try {
                    console.log(`[DailyReport] Generating Bijak PDF for ${finalBijaks.length} items...`);
                    const htmlParts = [];
                    for (const b of finalBijaks) {
                        try {
                            const imgBuffer = await Renderer.generateRecordImage(b, 'BIJAK', { forceHidePrices: true });
                            if (imgBuffer) {
                                const b64 = imgBuffer.toString('base64');
                                htmlParts.push(`<div style="page-break-after: always; text-align: center; height: 100vh; display: flex; align-items: center; justify-content: center;"><img src="data:image/png;base64,${b64}" style="max-height: 95vh; max-width: 95vw;" /></div>`);
                            }
                        } catch(e) { console.error("Error generating image for bijak", b.id, e); }
                    }
                    if (htmlParts.length > 0) {
                        console.log(`[DailyReport] Bijak HTML composed, calling generatePdfBuffer...`);
                        const pdfBuffer = await Renderer.generatePdfBuffer(htmlParts.join(''));
                        console.log(`[DailyReport] Bijak PDF buffer ready (${pdfBuffer.length} bytes). Sending...`);
                        if (sendDocFn) {
                            await sendDocFn(chatId, pdfBuffer, `Bijak_Report_${dateStr.replace(/[\/\\]/g,'-')}.pdf`, `📦 گزارش تصاویر بیجک‌ها ${dateStr}`);
                        }
                    }
                } catch (e) { console.error("Bijak PDF generation failed:", e); }
            } else if (isKnownBijak) {
                if (sendFn) await sendFn(chatId, `📭 در تاریخ ${dateStr} بیجکی ثبت نشده است.`);
            }
        }

        // 3. EXIT PERMITS REPORT
        if (sLogistics) {
            console.log(`[DailyReport] checking exit permits for date ${dateStr}`);
            const finalExits = (db.exitPermits || []).filter(p => matchesDate(p.date));
            if (finalExits.length > 0) {
                console.log(`[DailyReport] found ${finalExits.length} exit permits`);
                const hidePrice = true; // Logistics groups always hide prices
                let reportMsg = `🚛 *گزارش مجوزهای خروج ${dateStr}*\n\n`;
                finalExits.forEach((p, idx) => {
                    const totalOutCount = (p.items||[]).reduce((sum, i) => sum + (Number(i.deliveredCartonCount ?? i.cartonCount) || 0), p.cartonCount || 0);
                    let goodsInfo = (p.items && p.items.length > 0) ? p.items.map(it => it.goodsName).join('، ') : (p.goodsName || 'چند مورد');
                    reportMsg += `${idx + 1}. *مجوز #${p.permitNumber}*\n🏢 شرکت: ${p.company || 'نامشخص'}\n👤 گیرنده: ${p.recipientName}\n📦 کالا: ${goodsInfo} (${totalOutCount} عدد)\n📊 وضعیت: ${p.status}\n------------------\n`;
                });
                if (sendFn) await sendFn(chatId, reportMsg);
                if (sendFn) sendFn(chatId, `⏳ در حال تولید فایل PDF از تصاویر ${finalExits.length} خروج...`).catch(()=>{});
                
                try {
                    console.log(`[DailyReport] Generating Exit PDF for ${finalExits.length} items...`);
                    const htmlParts = [];
                    for (const p of finalExits) {
                        try {
                            const imgBuffer = await Renderer.generateRecordImage(p, 'EXIT', { forceHidePrices: hidePrice });
                            if (imgBuffer) {
                                const b64 = imgBuffer.toString('base64');
                                htmlParts.push(`<div style="page-break-after: always; text-align: center; height: 100vh; display: flex; align-items: center; justify-content: center;"><img src="data:image/png;base64,${b64}" style="max-height: 95vh; max-width: 95vw;" /></div>`);
                            }
                        } catch(e) { console.error("Error generating image for permit", p.id, e); }
                    }
                    if (htmlParts.length > 0) {
                        console.log(`[DailyReport] Exit HTML composed, calling generatePdfBuffer...`);
                        const pdfBuffer = await Renderer.generatePdfBuffer(htmlParts.join(''));
                        console.log(`[DailyReport] Exit PDF buffer ready (${pdfBuffer.length} bytes). Sending...`);
                        if (sendDocFn) {
                            await sendDocFn(chatId, pdfBuffer, `Exit_Report_${dateStr.replace(/[\/\\]/g,'-')}.pdf`, `🚛 گزارش تصاویر خروج ${dateStr}`);
                        }
                    }
                } catch (e) { console.error("PDF generation failed:", e); }
            } else if (isKnownLogistics) {
                if (sendFn) await sendFn(chatId, `📭 در تاریخ ${dateStr} مجوزی ثبت نشده است.`);
            }
        }
    } 
    
    if (isUnrecognizedGroup) {
        // PV or Unregistered context
        // if we are here and nothing was sent (checked elsewhere or just fallback)
    }
};

// --- PRODUCT HELPERS ---
const formatProduct = (p) => {
    const priceTxt = p.hidePrice ? "📞 تماس با فروش" : `${Number(p.price || 0).toLocaleString()} ریال`;
    const stockTxt = p.hideStock ? "📞 تماس با فروش" : `${p.stock || 0} ${p.unit || 'عدد'}`;
    
    return `📁 گروه: ${p.group || 'بدون گروه'}\n🔹 زیرگروه: ${p.subgroup || 'سایر'}\n📦 کالا: ${p.name}\n💰 قیمت: ${priceTxt}\n📊 موجودی: ${stockTxt}\n`;
};

// --- MAIN HANDLERS ---

// --- PHONE SEARCH & SEND ---
export const sendBotMessageByPhone = async (phone, text, photoBase64 = null) => {
    if (!phone) return false;
    const db = getDb();
    const cleanPhone = phone.toString().replace(/[^0-9]/g, '').slice(-10); // Last 10 digits
    
    // Find subscriber
    const sub = (db.botSubscribers || []).find(s => {
        if (!s.mobile) return false;
        const subPhone = s.mobile.toString().replace(/[^0-9]/g, '').slice(-10);
        return subPhone === cleanPhone;
    });

    if (!sub) return false;

    try {
        const platform = sub.platform;
        const chatId = platform === 'telegram' ? sub.telegramChatId : sub.baleChatId;
        if (!chatId) return false;

        const baleModule = await import('./bale.js');
        const tgModule = await import('./telegram.js');

        if (photoBase64) {
            const buffer = Buffer.from(photoBase64, 'base64');
            if (platform === 'telegram') await tgModule.sendBotPhoto(chatId, buffer, text);
            else if (platform === 'bale') await baleModule.sendBotPhoto(chatId, buffer, text);
        } else {
            if (platform === 'telegram') await tgModule.sendBotMessage(chatId, text);
            else if (platform === 'bale') await baleModule.sendBotMessage(chatId, text);
        }
        return true;
    } catch (e) {
        console.error(`[BotCore] Failed to send to ${phone}:`, e.message);
        return false;
    }
};

export const handleMessage = async (platform, chatId, text, sendFn, sendPhotoFn, sendDocFn, checkMembershipFn, senderId, rawMsg = null) => {
    const db = getDb();
    
    // Default Settings
    const settings = db.settings || {};

    const user = resolveUser(db, platform, senderId || chatId);
    const isGroup = chatId.toString().startsWith('-') || 
                  (platform === 'bale' && (chatId.toString().length > 10 || chatId.toString().startsWith('g') || chatId.toString().includes('@group'))) ||
                  (senderId && senderId.toString() !== chatId.toString());

    if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
    const session = sessions[chatId];

    // --- GROUP BEHAVIOR ---
    if (isGroup) {
        if (text === '/id' || text === 'آیدی') {
            return sendFn(chatId, `🆔 شناسه چت فعلی شما در ${platform === 'telegram' ? 'تلگرام' : 'بله'}: \`${chatId}\`\n\n⚠️ *توجه برای کارمندان:* برای استفاده از امکانات اختصاصی (مانند گزارش‌ها) بدون نیاز به عضویت در کانال‌های اجباری، این کد را در بخش "پیکربندی سیستم" یا "پروفایل من" در داخل نرم‌افزار مقابل نام خود وارد کنید.`);
        }

        const toEnglishDigits = (str) => {
            if (typeof str !== 'string') return str;
            return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
        };

        const normalizeDateString = (str) => {
            if (!str) return str;
            return str.split('/').map(part => part.padStart(2, '0')).join('/');
        };

        // --- DIRECT DATE HANDLER ---
        const cleanedText = normalizeDateString(toEnglishDigits(text));
        if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(cleanedText)) {
            await runDailyReport(platform, chatId, cleanedText, sendFn, sendDocFn);
            return;
        }

        if (text.startsWith('/daily_report') || text.startsWith('/report') || text.startsWith('/repot') || text.toLowerCase() === 'daily' || text.toLowerCase() === 'repot' || text === 'گزارش روزانه') {
            const args = text.split(' ');
            
            let dateStr = normalizeDateString(toEnglishDigits(new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran' }).format(new Date())));

            if (args.length > 1) {
                // Find the argument that looks like a date (e.g., 1403/02/01 or 1403/2/1)
                // Skip the first argument which is the command itself
                const dateArg = args.slice(1).find(a => a.includes('/'));
                if (dateArg) {
                    dateStr = normalizeDateString(toEnglishDigits(dateArg));
                }
            }
            
            await runDailyReport(platform, chatId, dateStr, sendFn, sendDocFn);
            return;
        }

        // Silent for all other group messages as per user request
        return;
    }

    if (text.startsWith('/daily_report') || text.startsWith('/report') || text.startsWith('/repot') || text.toLowerCase() === 'daily' || text.toLowerCase() === 'repot' || text === 'گزارش روزانه') {
        const toEnglishDigits = (str) => {
            if (typeof str !== 'string') return str;
            return str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
        };
        const normalizeDateString = (str) => {
            if (!str) return str;
            return str.split('/').map(part => part.padStart(2, '0')).join('/');
        };
        const args = text.split(' ');
        let dateStr = normalizeDateString(toEnglishDigits(new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tehran' }).format(new Date())));
        if (args.length > 1) {
            const dateArg = args.slice(1).find(a => a.includes('/'));
            if (dateArg) dateStr = normalizeDateString(toEnglishDigits(dateArg));
        }
        await runDailyReport(platform, chatId, dateStr, sendFn, sendDocFn);
        return;
    }

    if (text.startsWith('/start') || text === 'شروع' || text === 'منو') {
        session.state = 'IDLE';
        session.data = {};

        // TRACK SUBSCRIBER
        if (!db.botSubscribers) db.botSubscribers = [];
        const existingSub = db.botSubscribers.find(s => (platform === 'telegram' && s.telegramChatId == chatId) || (platform === 'bale' && s.baleChatId == chatId));
        if (!existingSub) {
            const newSub = { id: generateUUID(), platform, joinedAt: new Date().toISOString() };
            if (platform === 'telegram') newSub.telegramChatId = chatId;
            if (platform === 'bale') newSub.baleChatId = chatId;
            db.botSubscribers.push(newSub);
            saveDb(db);
        } else {
            // Already sub, check if we should continue onboarding
        }
        
        // --- SALES REPLY HANDLER ---
        const isSalesUser = (settings.salesNotificationUsers || []).some(item => {
            const u = typeof item === 'string' ? item : item.username;
            return (user && user.username === u) || String(chatId) === u || String(senderId) === u;
        });
        const isAdminUser = user && user.role === 'admin';
        
        if (text.startsWith('/reply ') || text.startsWith('پاسخ ') || (rawMsg && rawMsg.reply_to_message && (isSalesUser || isAdminUser))) {
            if (isSalesUser || isAdminUser) {
                let targetChatId = null;
                let replyText = text;
                
                if (text.startsWith('/reply ') || text.startsWith('پاسخ ')) {
                    const parts = text.split(' ');
                    if (parts.length >= 3) {
                        targetChatId = parts[1];
                        replyText = parts.slice(2).join(' ');
                    }
                } else if (rawMsg && rawMsg.reply_to_message && rawMsg.reply_to_message.text) {
                    const match = rawMsg.reply_to_message.text.match(/شناسه:\s*`?(\d+)`?/);
                    if (match) {
                        targetChatId = match[1];
                    }
                }
                
                if (targetChatId) {
                    try {
                        const baleModule = await import('./bale.js');
                        const tgModule = await import('./telegram.js');
                        
                        db.tickets = db.tickets || [];
                        const ticket = db.tickets.find(t => t.id === targetChatId);

                        let actualChatId = targetChatId;
                        let prefixMsg = `📩 *پاسخ از طرف پشتیبانی:*\n\n${replyText}`;
                        
                        if (ticket) {
                            actualChatId = ticket.chatId;
                            ticket.messages.push({
                                id: generateUUID(),
                                sender: 'admin',
                                text: replyText,
                                timestamp: new Date().toISOString()
                            });
                            ticket.updatedAt = Date.now();
                            ticket.status = 'OPEN';
                            saveDb(db);
                            prefixMsg = `📩 *پاسخ پشتیبانی به درخواست #${ticket.id}:*\n\n${replyText}`;
                        }
                        
                        let sent = false;
                        try {
                            await tgModule.sendBotMessage(actualChatId, prefixMsg);
                            sent = true;
                        } catch (e) {}
                        
                        try {
                            await baleModule.sendBotMessage(actualChatId, prefixMsg);
                            sent = true;
                        } catch (e) {}

                        if (sent) return sendFn(chatId, `✅ پاسخ شما با موفقیت به شناسه/تیکت ${targetChatId} ارسال شد.`);
                        else return sendFn(chatId, "❌ خطا در ارسال پاسخ (شناسه یافت نشد یا ربات بلاک شده است).");
                    } catch (e) {
                        return sendFn(chatId, "❌ خطای سیستمی در ارسال پاسخ.");
                    }
                } else if (text.startsWith('/reply ') || text.startsWith('پاسخ ')) {
                    return sendFn(chatId, "💡 روش استفاده: `/reply [ID] [Message]` یا ریپلای کردن روی پیام دریافتی");
                } else if (rawMsg && rawMsg.reply_to_message) {
                    // Do nothing, let it fall through if it's not a reply to a customer message.
                }
            }
        }
        
        // --- CHANNEL JOIN CHECK ---
        if (!user && !isGroup && (platform === 'telegram' || platform === 'bale') && settings.botForceJoinEnabled && settings.botForceJoinChannels && settings.botForceJoinChannels.length > 0) {
            if (checkMembershipFn) {
                const missingChannels = [];
            
            // Parallelize checks for performance
            const checkPromises = settings.botForceJoinChannels.map(async (ch) => {
                if (ch.id && (!ch.platform || ch.platform === platform || ch.platform === 'all')) {
                    try {
                        const normalizedId = normalizeChannelId(ch.id);
                        const isMember = await checkMembershipFn(chatId, normalizedId);
                        return { ch, isMember };
                    } catch (e) {
                        return { ch, isMember: false };
                    }
                }
                return { ch, isMember: true };
            });

            const results = await Promise.all(checkPromises);
            results.forEach(res => { if (!res.isMember) missingChannels.push(res.ch); });

            if (missingChannels.length > 0) {
                const btns = missingChannels.map(ch => {
                        let link = ch.link;
                        if (!link) {
                            let id = (ch.id || '').toString();
                            if (id.startsWith('http')) {
                                link = id;
                            } else {
                                const cleanId = id.replace('@', '');
                                if (platform === 'bale') link = `https://ble.ir/${cleanId}`;
                                else link = `https://t.me/${cleanId}`;
                            }
                        }
                        return [{ text: `عضویت در ${ch.name || 'کانال'}`, url: link }];
                    });
                    btns.push([{ text: '✅ عضو شدم', callback_data: 'CHECK_JOIN' }]);
                    return sendFn(chatId, `⚠️ برای استفاده از ربات در ${platform === 'bale' ? 'بله' : 'تلگرام'}، ابتدا باید در کانال زیر عضو شوید:\nپس از عضویت دکمه تایید را بزنید.`, {
                        reply_markup: { inline_keyboard: btns }
                    });
                }
            }
        }

        // --- ONBOARDING FOR GUESTS ---
        if (!user && !isGroup && session.state === 'IDLE') {
            const sub = db.botSubscribers.find(s => (platform === 'telegram' && s.telegramChatId == chatId) || (platform === 'bale' && s.baleChatId == chatId));
            
            // If sub exists but lacks info, and we haven't asked yet or user just started
            if (sub && !sub.fullName && !sub.mobile && !sub.birthday && session.state === 'IDLE') {
                session.state = 'GUEST_REG_CONFIRM';
                return sendFn(chatId, `🎉 خوش آمدید! آیا مایل هستید پروفایل خود را تکمیل کنید تا از خدمات بهتر ما بهره‌مند شوید؟ (اختیاری)`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✅ بله، تکمیل مشخصات', callback_data: 'GUEST_START_REG' }],
                            [{ text: 'خیر، بعداً', callback_data: 'GUEST_MAIN' }]
                        ]
                    }
                });
            }
        }

        if (!user && !isGroup && session.state === 'IDLE') {
            const guestMenu = [
                [{ text: '📦 لیست محصولات و قیمت', callback_data: 'GUEST_PRODUCTS' }],
                [{ text: '🛒 ثبت سفارش خرید', callback_data: 'GUEST_ORDER' }],
                [{ text: '📞 ارتباط با بخش فروش (تیکت)', callback_data: 'GUEST_CONTACT' }],
                [{ text: '💰 استعلام مانده حساب من', callback_data: 'GUEST_BALANCE_REQUEST' }],
                [{ text: '🔍 پیگیری درخواست', callback_data: 'GUEST_TRACK' }],
                [{ text: '🏢 اطلاعات شرکت', callback_data: 'GUEST_COMPANY_INFO' }]
            ];
            
            guestMenu.push([{ text: '🆔 نمایش شناسه چت من', callback_data: 'GUEST_SHOW_ID' }]);
            
            if (settings.botStoreLinks && settings.botStoreLinks.length > 0) {
                settings.botStoreLinks.forEach(link => {
                    guestMenu.push([{ text: `🌐 ${link.title}`, url: link.url }]);
                });
            }

            return sendFn(chatId, `👋 خوش آمدید کاربر گرامی.\n\nشما به عنوان کاربر مهمان/مشتری وارد شده‌اید. لطفاً یکی از گزینه‌های زیر را انتخاب کنید:`, {
                reply_markup: {
                    inline_keyboard: guestMenu
                }
            });
        }
        
        if (isGroup) {
            if (!user) {
                return sendFn(chatId, "⚠️ برای دسترسی به پنل مدیریت در گروه، باید ابتدا بصورت کاربر در سیستم ثبت شده باشید.\nاما سایر دستورات عمومی (مانند DAILY) فعال هستند.");
            }
            return sendFn(chatId, `👋 سلام ${user.fullName}\nبرای استفاده از منوی مدیریت، لطفاً در چت خصوصی با ربات در ارتباط باشید.`);
        }

        return sendFn(chatId, `👋 سلام ${user.fullName}\nبه سیستم مدیریت یکپارچه خوش آمدید.\nلطفاً یک گزینه را انتخاب کنید:`, { reply_markup: KEYBOARDS.MAIN });
    }
    if (!isGroup) {
        // Handle guest states
        
        // --- GUEST REGISTRATION STATES ---
        if (session.state === 'GUEST_REG_NAME') {
            const sub = db.botSubscribers.find(s => (platform === 'telegram' && s.telegramChatId == chatId) || (platform === 'bale' && s.baleChatId == chatId));
            if (sub) {
                sub.fullName = text;
                saveDb(db);
            }
            session.state = 'GUEST_REG_MOBILE';
            return sendFn(chatId, "📱 لطفاً شماره موبایل خود را وارد کنید (اختیاری):", {
                reply_markup: { inline_keyboard: [[{ text: '⏩ رد کردن', callback_data: 'SKIP_REG_MOBILE' }]] }
            });
        }

        if (session.state === 'GUEST_REG_MOBILE') {
            const sub = db.botSubscribers.find(s => (platform === 'telegram' && s.telegramChatId == chatId) || (platform === 'bale' && s.baleChatId == chatId));
            if (sub) {
                sub.mobile = text;
                saveDb(db);
            }
            session.state = 'GUEST_REG_BIRTHDAY';
            return sendFn(chatId, "🎂 لطفاً تاریخ تولد خود را وارد کنید (مثال: 1370/05/12) (اختیاری):", {
                reply_markup: { inline_keyboard: [[{ text: '⏩ رد کردن', callback_data: 'SKIP_REG_BIRTHDAY' }]] }
            });
        }

        if (session.state === 'GUEST_REG_BIRTHDAY') {
            const sub = db.botSubscribers.find(s => (platform === 'telegram' && s.telegramChatId == chatId) || (platform === 'bale' && s.baleChatId == chatId));
            if (sub) {
                sub.birthday = text;
                saveDb(db);
            }
            session.state = 'IDLE';
            return sendFn(chatId, "✅ با تشکر! اطلاعات شما ثبت شد.", {
                reply_markup: { inline_keyboard: [[{ text: '🏠 منوی اصلی', callback_data: 'GUEST_MAIN' }]] }
            });
        }

        if (session.state === 'GUEST_WAIT_CONTACT_MSG') {
            const ticketId = Math.floor(10000 + Math.random() * 90000).toString();
            
            let messageText = text;
            if (!text && rawMsg) {
                if (rawMsg.photo) messageText = '📷 یک عکس ارسال شد';
                else if (rawMsg.document) messageText = '📎 یک فایل ارسال شد';
                else if (rawMsg.voice) messageText = '🎤 یک پیام صوتی ارسال شد';
            }

            const newTicket = {
                id: ticketId,
                chatId: chatId,
                platform: platform,
                customerName: rawMsg?.from?.first_name || 'مشتری',
                messages: [{
                    id: generateUUID(),
                    sender: 'customer',
                    text: messageText,
                    timestamp: new Date().toISOString()
                }],
                status: 'OPEN',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            
            db.tickets = db.tickets || [];
            db.tickets.push(newTicket);
            saveDb(db);
            session.state = 'GUEST_ACTIVE_TICKET';
            session.data.ticketId = ticketId;
            
            // Forward to sales notification users
            if (settings.salesNotificationUsers && settings.salesNotificationUsers.length > 0) {
                 const forwardText = `📞 *تیکت جدید (کد پیگیری: ${ticketId})*\n👤 کاربر: ${newTicket.customerName}\n💬 متن:\n${messageText}`;
                 const baleModule = await import('./bale.js');
                 const tgModule = await import('./telegram.js');
                 
                 for (const item of settings.salesNotificationUsers) {
                     const username = typeof item === 'string' ? item : item.username;
                     const platforms = typeof item === 'string' ? ['telegram', 'bale'] : item.platforms;
                     
                     // Try to find as system user
                     const targetUser = db.users.find(u => u.username === username);
                     
                     if (targetUser) {
                         if (platforms.includes('telegram') && targetUser.telegramChatId) {
                             tgModule.sendBotMessage(targetUser.telegramChatId, forwardText).catch(e => {});
                         }
                         if (platforms.includes('bale') && targetUser.baleChatId) {
                             baleModule.sendBotMessage(targetUser.baleChatId, forwardText).catch(e => {});
                         }
                     } else {
                         // If not a system user, check if username is a numeric Chat ID
                         if (!isNaN(Number(username))) {
                             if (platforms.includes('telegram')) tgModule.sendBotMessage(username, forwardText).catch(e => {});
                             if (platforms.includes('bale')) baleModule.sendBotMessage(username, forwardText).catch(e => {});
                         }
                     }
                 }
            }
            
            return sendFn(chatId, `✅ تیکت شما ایجاد شد.\n🔖 شناسه تیکت: \`${ticketId}\`\n\nهم‌اکنون مستقیماً به چت پشتیبانی متصل هستید و مدیران شرکت پیام شما را دریافت کردند. می‌توانید ادامه پیام‌ها یا فایل‌های خود را همینجا ارسال کنید. جهت خروج از حالت پشتیبانی، روی دکمه زیر کلیک کنید:`, {
                reply_markup: { inline_keyboard: [[{ text: '🔙 پایان مکالمه', callback_data: 'GUEST_MAIN' }]] }
            });
        }

        if (session.state === 'GUEST_ACTIVE_TICKET' || session.state === 'GUEST_WAIT_TICKET_REPLY') {
            db.tickets = db.tickets || [];
            const ticket = db.tickets.find(t => t.id === session.data.ticketId);
            if (ticket) {
                if (ticket.status !== 'OPEN') {
                    session.state = 'IDLE';
                    return sendFn(chatId, `❌ این تیکت بسته شده است.`);
                }
                
                let messageText = text;
                if (!text && rawMsg) {
                    if (rawMsg.photo) messageText = '📷 یک عکس ارسال شد';
                    else if (rawMsg.document) messageText = '📎 یک فایل ارسال شد';
                    else if (rawMsg.voice) messageText = '🎤 یک پیام صوتی ارسال شد';
                }

                ticket.messages.push({
                    id: generateUUID(),
                    sender: 'customer',
                    text: messageText || '📎 مدیا',
                    timestamp: new Date().toISOString()
                });
                ticket.updatedAt = Date.now();
                saveDb(db);
                
                if (settings.salesNotificationUsers && settings.salesNotificationUsers.length > 0) {
                     const forwardText = `📞 *پاسخ کاربر در تیکت #${ticket.id}*\n👤 کاربر: ${ticket.customerName}\n💬 متن:\n${messageText}`;
                     const baleModule = await import('./bale.js');
                     const tgModule = await import('./telegram.js');
                     for (const item of settings.salesNotificationUsers) {
                         const username = typeof item === 'string' ? item : item.username;
                         const platforms = typeof item === 'string' ? ['telegram', 'bale'] : item.platforms;
                         const targetUser = db.users.find(u => u.username === username);
                         if (targetUser) {
                             if (platforms.includes('telegram') && targetUser.telegramChatId) tgModule.sendBotMessage(targetUser.telegramChatId, forwardText).catch(e => {});
                             if (platforms.includes('bale') && targetUser.baleChatId) baleModule.sendBotMessage(targetUser.baleChatId, forwardText).catch(e => {});
                         } else if (!isNaN(Number(username))) {
                             if (platforms.includes('telegram')) tgModule.sendBotMessage(username, forwardText).catch(e => {});
                             if (platforms.includes('bale')) baleModule.sendBotMessage(username, forwardText).catch(e => {});
                         }
                     }
                }
                
                session.state = 'GUEST_ACTIVE_TICKET';
                return sendFn(chatId, `✅ ارسال شد.`, {
                    reply_markup: { inline_keyboard: [[{ text: '🔙 پایان مکالمه', callback_data: 'GUEST_MAIN' }]] }
                });
            } else {
                session.state = 'IDLE';
            }
        }

        if (session.state === 'GUEST_WAIT_TRACK_CODE') {
            const trackId = text.trim();
            db.tickets = db.tickets || [];
            db.customerOrders = db.customerOrders || [];
            
            const ticket = db.tickets.find(t => t.id === trackId && t.chatId === chatId);
            const order = db.customerOrders.find(o => o.id === trackId && o.chatId === chatId);
            
            if (!ticket && !order) {
                return sendFn(chatId, "❌ کد پیگیری نامعتبر است یا متعلق به شما نمی‌باشد. لطفاً مجدداً تلاش کنید:", {
                   reply_markup: { inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'GUEST_MAIN' }]] }
                });
            }
            
            if (ticket) {
                let historyText = `📋 *تاریخچه درخواست تیکت #${ticket.id}*\nوضعیت: ${ticket.status === 'OPEN' ? 'باز' : 'بسته'}\n\n`;
                ticket.messages.forEach(m => {
                    const isCustomer = m.sender === 'customer';
                    historyText += `${isCustomer ? '👤 شما:' : 'پشتیبانی:'}\n${m.text}\n---\n`;
                });
                
                session.state = 'IDLE';
                return sendFn(chatId, historyText, {
                    reply_markup: { inline_keyboard: [
                        ticket.status === 'OPEN' ? [{ text: '➕ ارسال پاسخ جدید', callback_data: `GUEST_TICKET_REPLY_${ticket.id}` }] : [],
                        [{ text: '🔙 بازگشت', callback_data: 'GUEST_MAIN' }]
                    ]}
                });
            } else {
                // It's an order
                let statusColor = '⏳';
                if (order.status === 'APPROVED') statusColor = '✅';
                if (order.status === 'REJECTED') statusColor = '❌';
                
                let textRes = `📦 *جزئیات سفارش #${order.id}*\n`;
                textRes += `وضعیت: ${statusColor} ${order.status}\n`;
                textRes += `تاریخ: ${order.date}\n\n`;
                textRes += `*محصولات:*\n`;
                order.items.forEach(it => {
                    textRes += `- ${it.name} (${it.quantity} ${it.unit || 'عدد'})\n`;
                });
                if (order.description) textRes += `\n💬 توضیحات: ${order.description}`;
                
                session.state = 'IDLE';
                return sendFn(chatId, textRes, {
                    reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'GUEST_MAIN' }]] }
                });
            }
        }
        

        if (session.state === 'GUEST_WAIT_ORDER_DESC') {
            const selectedProduct = session.data.selectedProduct;
            const orderDoc = {
                id: generateUUID(),
                customerChatId: chatId,
                productId: selectedProduct?.id,
                productName: selectedProduct?.name,
                description: text,
                status: 'pending',
                date: new Date().toISOString()
            };
            db.customerOrders = db.customerOrders || [];
            db.customerOrders.push(orderDoc);
            saveDb(db);
            session.state = 'IDLE';
            
             // Forward to sales notification users
            if (settings.salesNotificationUsers && settings.salesNotificationUsers.length > 0) {
                 const forwardText = `🛒 *درخواست خرید جدید*\n👤 مشتری: \`${chatId}\`\n📦 کالا: ${selectedProduct?.name || 'نامشخص'}\n📝 توضیحات: ${text}`;
                 const baleModule = await import('./bale.js');
                 const tgModule = await import('./telegram.js');
                 
                 for (const item of settings.salesNotificationUsers) {
                     const username = typeof item === 'string' ? item : item.username;
                     const platforms = typeof item === 'string' ? ['telegram', 'bale'] : item.platforms;
                     
                     const targetUser = db.users.find(u => u.username === username);
                     if (targetUser) {
                         if (platforms.includes('telegram') && targetUser.telegramChatId) tgModule.sendBotMessage(targetUser.telegramChatId, forwardText).catch(e => {});
                         if (platforms.includes('bale') && targetUser.baleChatId) baleModule.sendBotMessage(targetUser.baleChatId, forwardText).catch(e => {});
                     } else {
                         if (!isNaN(Number(username))) {
                             if (platforms.includes('telegram')) tgModule.sendBotMessage(username, forwardText).catch(e => {});
                             if (platforms.includes('bale')) baleModule.sendBotMessage(username, forwardText).catch(e => {});
                         }
                     }
                 }
            }

            return sendFn(chatId, `✅ سفارش شما برای محصول *${selectedProduct?.name}* ثبت شد و در اسرع وقت بررسی می‌گردد.\nکد پیگیری: \`${orderDoc.id.split('-')[0]}\``, {
                reply_markup: { inline_keyboard: [[{ text: '🏠 منوی اصلی', callback_data: 'GUEST_MAIN' }]] }
            });
        }

        if (session.state === 'GUEST_SUBMIT_ACCOUNT_CODE') {
            const code = text.trim();
            if (!code) {
                return sendFn(chatId, "⚠️ لطفاً یک کد حسابداری معتبر ارسال کنید:");
            }
            if (!db.customerChatCodes) db.customerChatCodes = [];
            db.customerChatCodes = db.customerChatCodes.filter(c => !(c.chatId === String(chatId) && c.platform === platform));
            db.customerChatCodes.push({
                chatId: String(chatId),
                platform: platform,
                accountCode: code,
                updatedAt: Date.now()
            });
            saveDb(db);
            session.state = 'IDLE';

            const rawList = await getCustomerBalancesData(db);
            const rec = rawList.find(b => matchAccountCode(b.accountCode, code));
            if (rec) {
                const balanceStr = Number(rec.balance).toLocaleString('fa-IR');
                const successMsg = `✅ *ارتباط با حسابداری برقرار شد!*\n\n👤 *مشتری:* ${rec.name}\n🔢 کد حسابداری: \`${rec.accountCode}\`\n\n💰 *مانده حساب شما (آنلاین سایان):* ${balanceStr} ریال (${rec.type})\n📅 آخرین بروزرسانی: ${new Date(rec.updatedAt || Date.now()).toLocaleDateString('fa-IR')}\n\n💬 مانده حساب شما ذخیره شد و در پرسش‌های بعدی با زدن دکمه مربوطه مستقیماً نشان داده خواهد شد.`;
                return sendFn(chatId, successMsg, { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'GUEST_MAIN' }]] } });
            } else {
                let name = 'مشتری سایان';
                let balanceStr = '۰';
                let type = 'تسویه شده';
                let foundAny = false;
                if (db.settings?.sayanApiUrl) {
                    try {
                        const sql = `
                            SELECT 
                                t07.Field_005 as accountCode,
                                t07.Field_006 as name,
                                SUM(CAST(t24.Field_006 AS FLOAT)) - SUM(CAST(t24.Field_007 AS FLOAT)) as balance
                            FROM ACT_TBL_024 t24
                            INNER JOIN ACT_TBL_007 t07 ON t24.Field_010 LIKE '%' + RTRIM(LTRIM(t07.Field_003)) + '%'
                            WHERE (t07.Field_005 = '${code}' OR t07.Field_003 = '${code}' OR t07.Field_005 LIKE '%${code}' OR t07.Field_003 LIKE '%${code}')
                              AND (t24.Field_010 LIKE '11%' OR t24.Field_010 LIKE '%-11%' OR t24.Field_010 LIKE '31%' OR t24.Field_010 LIKE '%-31%') 
                              AND t24.Field_010 NOT LIKE '%-12%'
                              AND t24.Field_010 NOT LIKE '%-13%'
                              AND t24.Field_005 NOT IN ('102', '103', '107', '109', '114', '116', '117')
                              AND t24.Field_003 <> '9'
                            GROUP BY t07.Field_005, t07.Field_006
                        `;
                        const res = await runSayanQuery(db, sql);
                        if (res && res.length > 0) {
                            name = res[0].name || name;
                            const bal = Number(res[0].balance || 0);
                            balanceStr = Math.abs(bal).toLocaleString('fa-IR');
                            type = bal > 0 ? 'بدهکار' : (bal < 0 ? 'بستانکار' : 'تسویه شده');
                            foundAny = true;
                        }
                    } catch (err) {
                        console.error(err);
                    }
                }
                if (foundAny) {
                    const successMsg = `✅ *ارتباط با حسابداری برقرار شد!*\n\n👤 *مشتری:* ${name}\n🔢 کد حسابداری: \`${code}\`\n\n💰 *مانده حساب شما (آنلاین سایان):* ${balanceStr} ریال (${type})\n💬 مانده حساب شما ذخیره شد و در پرسش‌های بعدی مستقیماً نشان داده خواهد شد.`;
                    return sendFn(chatId, successMsg, { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'GUEST_MAIN' }]] } });
                } else {
                    const successMsg = `✅ *پیوند حساب برقرار شد!*\n🔢 کد حسابداری شما \`${code}\` با موفقیت در ربات ذخیره گردید.\n\n⚠️ اما در حال حاضر رکوردی با این کد در سرور حسابداری سایان یافت نشد. به محض برقراری اتصال یا تصحیح کد، مانده حساب شما نمایش داده خواهد شد.`;
                    return sendFn(chatId, successMsg, { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'GUEST_MAIN' }]] } });
                }
            }
        }

        if (session.state === 'BOT_SAYAN_WAIT_COMPARE_DATES') {
            const val = text.trim();
            // Expected format: YYYY-MM-DD, YYYY-MM-DD | YYYY-MM-DD, YYYY-MM-DD
            const parts = val.split('|');
            if (parts.length !== 2) {
                return sendFn(chatId, "⚠️ فرمت وارد شده اشتباه است. لطفاً دقیقاً مانند الگو بنویسید:\n\nتاریخ شروع بازه ۱, تاریخ پایان بازه ۱ | تاریخ شروع بازه ۲, تاریخ پایان بازه ۲\n\nمثال:\n2023-10-01, 2023-10-10 | 2023-11-01, 2023-11-10", { reply_markup: { inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'BOT_SAYAN_COMPARE_SALES' }]] } });
            }
            
            const rangeA = parts[0].split(',').map(s => s.trim());
            const rangeB = parts[1].split(',').map(s => s.trim());
            
            if (rangeA.length !== 2 || rangeB.length !== 2) {
                return sendFn(chatId, "⚠️ فرمت وارد شده برای تاریخ‌های بازه اول یا دوم ناقص است. مثال:\n2023-10-01, 2023-10-10 | 2023-11-01, 2023-11-10", { reply_markup: { inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'BOT_SAYAN_COMPARE_SALES' }]] } });
            }
            
            const dateFromA = rangeA[0];
            const dateToA = rangeA[1];
            const dateFromB = rangeB[0];
            const dateToB = rangeB[1];
            
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(dateFromA) || !dateRegex.test(dateToA) || !dateRegex.test(dateFromB) || !dateRegex.test(dateToB)) {
                return sendFn(chatId, "⚠️ لطفاً از فرمت میلادی معتبر YYYY-MM-DD (مثال: 2023-10-01) استفاده کنید.", { reply_markup: { inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'BOT_SAYAN_COMPARE_SALES' }]] } });
            }
            
            session.state = 'IDLE';
            await generateAndSendComparisonPDF(db, chatId, sendFn, sendDocFn, dateFromA, dateToA, dateFromB, dateToB, "بازه انتخابی اول", "بازه انتخابی دوم");
            return;
        }

        if (session.state === 'FIN_WAIT_CUSTOMER_BALANCE_SEARCH') {
            const query = text.trim();
            if (!query) {
                return sendFn(chatId, "⚠️ لطفا یک عبارت معتبر برای جستجو وارد کنید:");
            }
            
            // Query Sayan live balances
            const balances = await getCustomerBalancesData(db);

            const terms = query.split(/\s+/).filter(Boolean);
            let found = balances.filter(b => {
                return terms.every(term => {
                    const normTerm = term.toLowerCase();
                    return (b.accountCode || '').toLowerCase().includes(normTerm) || 
                           (b.name || '').toLowerCase().includes(normTerm);
                });
            }).sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));

            // Fallback: If no match with non-zero balance, let's search Sayan for ANY matching customer (even with zero balance)
            if (found.length === 0 && db.settings?.sayanApiUrl) {
                try {
                    const sql = `
                        SELECT 
                            t07.Field_005 as accountCode,
                            t07.Field_006 as name,
                            SUM(CAST(ISNULL(t24.Field_006, 0) AS FLOAT)) - SUM(CAST(ISNULL(t24.Field_007, 0) AS FLOAT)) as balance
                        FROM ACT_TBL_007 t07
                        LEFT JOIN ACT_TBL_024 t24 ON t24.Field_010 LIKE '%' + RTRIM(LTRIM(t07.Field_003)) + '%'
                          AND (t24.Field_010 LIKE '11%' OR t24.Field_010 LIKE '%-11%' OR t24.Field_010 LIKE '31%' OR t24.Field_010 LIKE '%-31%') 
                          AND t24.Field_010 NOT LIKE '%-12%'
                          AND t24.Field_010 NOT LIKE '%-13%'
                          AND t24.Field_005 NOT IN ('102', '103', '107', '109', '114', '116', '117')
                          AND t24.Field_003 <> '9'
                        WHERE (t07.Field_004 = '11' OR t07.Field_004 = '31')
                          AND (t07.Field_005 LIKE '%${query}%' OR t07.Field_006 LIKE N'%${query}%')
                        GROUP BY t07.Field_005, t07.Field_006
                    `;
                    const sayanCustomers = await runSayanQuery(db, sql);
                    if (sayanCustomers && sayanCustomers.length > 0) {
                        found = sayanCustomers.map(sc => {
                            const bal = Number(sc.balance || 0);
                            return {
                                accountCode: sc.accountCode,
                                name: sc.name || 'مشتری سایان',
                                balance: Math.abs(bal),
                                type: bal > 0 ? 'بدهکار' : (bal < 0 ? 'بستانکار' : 'بی‌حساب / تسویه شده'),
                                rawBalance: bal,
                                updatedAt: Date.now()
                            };
                        });
                    }
                } catch (err) {
                    console.error("Sayan customer search fallback error:", err);
                }
            }

            if (found.length === 0) {
                return sendFn(chatId, `❌ هیچ مشتری با عبارت "${query}" در لیست مانده حساب‌ها یا سرور سایان یافت نشد.\n\n🔍 تلاش مجدد (نام یا کد):`, { reply_markup: { inline_keyboard: [[{ text: '🔙 انصراف و بازگشت', callback_data: 'SALES_CUSTOMER_BALANCES' }]] } });
            }

            if (found.length === 1) {
                session.state = 'IDLE';
                const rec = found[0];
                const balanceStr = Number(rec.balance).toLocaleString('fa-IR');
                const updateStr = new Date(rec.updatedAt || Date.now()).toLocaleDateString('fa-IR');
                
                let msg = `👤 *مشخصات مشتری*\n\n`;
                msg += `👤 *نام:* ${rec.name}\n`;
                msg += `🔢 *کد حسابداری:* \`${rec.accountCode}\`\n`;
                msg += `💰 *مانده حساب:* *${balanceStr}* ریال (${rec.type})\n`;
                msg += `📅 *آخرین بروزرسانی:* ${updateStr}\n\n`;
                
                const statements = db.customerStatements || [];
                const hasStatement = statements.some(s => s.accountCode === rec.accountCode);
                
                const kb = [
                    [
                        { text: '📄 دانلود آخرین صورتحساب تفصیلی (Excel/PDF)', callback_data: `SALES_BAL_STMT_DOWNLOAD_${rec.accountCode}` }
                    ],
                    [
                        { text: '📥 دانلود فرم تاییدیه حساب (PDF)', callback_data: `SALES_BAL_MAKE_CONFIRMATION_${rec.accountCode}` }
                    ],
                    [
                        { text: '🔍 جستجوی مجدد', callback_data: 'SALES_BAL_SPECIFIC_SEARCH' },
                        { text: '🔙 منوی قبلی', callback_data: 'SALES_CUSTOMER_BALANCES' }
                    ]
                ];
                
                if (!hasStatement) {
                    kb.shift();
                }
                
                return sendFn(chatId, msg, { reply_markup: { inline_keyboard: kb } });
            }

            // Multiple matches
            session.state = 'IDLE';
            let resMsg = `🔍 نتایج جستجو برای عبارت "${query}" (${found.length} مورد یافت شد):\n`;
            resMsg += `لطفاً مشتری مد نظر خود را جهت استعلام انتخاب نمایید:`;
            
            const buttons = found.slice(0, 10).map(rec => [{
                text: `👤 ${rec.name} (${rec.accountCode})`,
                callback_data: `SALES_BAL_VIEW_${rec.accountCode}`
            }]);
            
            if (found.length > 10) {
                resMsg += `\n\n⚠️ تعداد کل یافت شده‌ها ${found.length} مورد است. برای مشاهده مابقی، لطفاً جستجوی دقیق‌تری انجام دهید.`;
            }
            
            buttons.push([
                { text: '🔍 جستجوی مجدد', callback_data: 'SALES_BAL_SPECIFIC_SEARCH' },
                { text: '🔙 بازگشت به منو', callback_data: 'SALES_CUSTOMER_BALANCES' }
            ]);
            
            return sendFn(chatId, resMsg, { reply_markup: { inline_keyboard: buttons } });
        }
        
        if (text === '/start' || text === 'شروع' || text === 'منو') return; // Handled above helper logic

        if (isGroup) return;
        return sendFn(chatId, `امکانات ربات: لطفا /start را بزنید.`);
    }

    // --- SECRETARIAT STATES ---
    if (session.state === 'SEC_WAIT_FILE') {
        if (rawMsg && rawMsg.document) {
            session.data.fileName = rawMsg.document.file_name;
            session.data.fileId = rawMsg.document.file_id;
            
            const companies = db.settings?.companies || [];
            if (companies.length === 0) {
                session.state = 'IDLE';
                return sendFn(chatId, "❌ خطایی رخ داد: هیچ شرکتی در سیستم تعریف نشده است.");
            }
            
            session.state = 'SEC_WAIT_COMPANY';
            const inline_keyboard = companies.map(c => [{ text: `🏢 ${c.name}`, callback_data: `SEC_SET_CO_${c.id}` }]);
            inline_keyboard.push([{ text: '❌ انصراف', callback_data: 'MENU_SEC' }]);
            
            return sendFn(chatId, `📎 فایل دریافت شد: *${rawMsg.document.file_name}*\n\n🏢 لطفا شرکت مربوط به این نامه را انتخاب کنید:`, {
                reply_markup: { inline_keyboard }
            });
        } else {
            return sendFn(chatId, "⚠️ لطفا فایل نامه (PDF یا Word/DOCX) را به عنوان یک فایل (Document) ارسال کنید. در صورت انصراف، منوی اصلی را انتخاب کنید یا دستور /start را بفرستید.");
        }
    }

    if (session.state === 'SEC_WAIT_SENDER') {
        session.data.sender = text.trim();
        session.state = 'SEC_WAIT_RECEIVER';
        return sendFn(chatId, `👤 فرستنده ثبت شد: *${text}*\n\n👥 لطفا نام گیرنده نامه را ارسال کنید:`);
    }

    if (session.state === 'SEC_WAIT_RECEIVER') {
        session.data.receiver = text.trim();
        session.state = 'SEC_WAIT_SUBJECT';
        return sendFn(chatId, `👥 گیرنده ثبت شد: *${text}*\n\n📝 لطفا موضوع نامه را ارسال کنید:`);
    }

    if (session.state === 'SEC_WAIT_SUBJECT') {
        session.data.subject = text.trim();
        session.state = 'SEC_WAIT_CONTENT';
        return sendFn(chatId, `📝 موضوع ثبت شد: *${text}*\n\n💬 لطفا خلاصه متن نامه را ارسال کنید (یا کلمه /skip را جهت رد کردن بفرستید):`);
    }

    if (session.state === 'SEC_WAIT_CONTENT') {
        const hasContent = text.trim().toLowerCase() !== '/skip';
        session.data.content = hasContent ? text.trim() : '';
        
        session.state = 'IDLE';
        try {
            if (!db.secretariatLetters) db.secretariatLetters = [];
            
            const companies = db.settings?.companies || [];
            const company = companies.find(c => c.id === session.data.companyId);
            const companyName = company ? company.name : '';
            const companySettings = (db.secretariatSettings || []).find(s => s.companyId === session.data.companyId);
            
            const count = (db.secretariatLetters || []).filter(l => l.companyId === session.data.companyId).length + 1;
            const prefix = companySettings?.letterNumberPrefix || 'A';
            const yearStr = new Intl.DateTimeFormat('fa-IR', { year: 'numeric' }).format(new Date()).replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)]);
            const letterNumber = `${prefix}/${yearStr}/${String(count).padStart(4, '0')}`;
            
            const shamsiDate = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
            
            const newLetter = {
                id: generateUUID(),
                companyId: session.data.companyId,
                section: session.data.section,
                letterNumber: letterNumber,
                date: shamsiDate,
                sender: session.data.sender,
                receiver: session.data.receiver,
                subject: session.data.subject,
                content: session.data.content,
                status: 'PENDING',
                type: 'incoming',
                attachments: [
                    {
                        fileName: session.data.fileName,
                        url: `bot_file_id:${session.data.fileId}`
                    }
                ],
                referredTo: [],
                approvedBy: [],
                signatureImageUrls: [],
                createdBy: user ? user.fullName : 'سیستم (بات)',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            
            db.secretariatLetters.unshift(newLetter);
            saveDb(db);
            
            notifySecretariatLetter(newLetter, db).catch(e => console.error("Bot Secretariat notification error:", e));
            
            const confirmationMsg = `✅ *نامه اداری با موفقیت ثبت شد!*\n\n` +
                                   `🔢 *شماره نامه:* ${letterNumber}\n` +
                                   `🏢 *شرکت:* ${companyName}\n` +
                                   `📍 *بخش:* ${session.data.section === 'headquarters' ? 'دفتر مرکزی' : 'کارخانه'}\n` +
                                   `📅 *تاریخ ثبت:* ${shamsiDate}\n` +
                                   `👤 *فرستنده:* ${session.data.sender}\n` +
                                   `👥 *گیرنده:* ${session.data.receiver}\n` +
                                   `📝 *موضوع:* ${session.data.subject}`;
                                   
            return sendFn(chatId, confirmationMsg, {
                reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت به منوی دبیرخانه', callback_data: 'MENU_SEC' }]] }
            });
        } catch (e) {
            console.error("Bot register letter error:", e);
            return sendFn(chatId, "❌ متأسفانه در ثبت نامه خطایی رخ داد. مجدداً تلاش کنید.");
        }
    }

    if (session.state === 'SEC_WAIT_SEARCH_QUERY') {
        session.state = 'IDLE';
        const query = text.trim().toLowerCase();
        const letters = db.secretariatLetters || [];
        
        const results = letters.filter(l => 
            userHasLetterAccess(user, l, db) &&
            (
                l.subject.toLowerCase().includes(query) ||
                l.sender.toLowerCase().includes(query) ||
                l.receiver.toLowerCase().includes(query) ||
                l.letterNumber.toLowerCase().includes(query) ||
                (l.content && l.content.toLowerCase().includes(query))
            )
        ).slice(0, 5);
        
        if (results.length === 0) {
            return sendFn(chatId, `❌ هیچ نامه‌ای با عبارت "${text}" یافت نشد.`, {
                reply_markup: { inline_keyboard: [[{ text: '🔍 جستجوی مجدد', callback_data: 'SEC_SEARCH' }], [{ text: '🔙 بازگشت', callback_data: 'MENU_SEC' }]] }
            });
        }
        
        await sendFn(chatId, `🔎 نتایج جستجو برای عبارت *"${text}"*:`);
        for (const l of results) {
            const inline_keyboard = [
                [
                    { text: '📥 دریافت PDF', callback_data: `SEC_GET_PDF_${l.id}` },
                    { text: '📥 دریافت Word', callback_data: `SEC_GET_DOC_${l.id}` }
                ]
            ];
            
            const msg = `✉️ *نامه شماره ${l.letterNumber}*\n` +
                        `📅 تاریخ: ${l.date}\n` +
                        `👤 فرستنده: ${l.sender}\n` +
                        `👥 گیرنده: ${l.receiver}\n` +
                        `📝 موضوع: ${l.subject}\n` +
                        `وضعیت: ${l.status === 'APPROVED' ? '✅ تایید شده' : l.status === 'REJECTED' ? '❌ رد شده' : '⏳ در حال بررسی'}`;
                        
            await sendFn(chatId, msg, { reply_markup: { inline_keyboard } });
        }
        return;
    }

    if (session.state === 'SALES_WAIT_BROADCAST_MSG') {
        session.state = 'IDLE';
        // Broadcast
        let count = 0;
        const baleModule = await import('./bale.js');
        const tgModule = await import('./telegram.js');

        for (const u of db.users) {
            if (u.telegramChatId) {
                try { await tgModule.sendBotMessage(u.telegramChatId, text); count++; } catch (e) {}
            }
            if (u.baleChatId) {
                try { await baleModule.sendBotMessage(u.baleChatId, text); count++; } catch (e) {}
            }
        }
        return sendFn(chatId, `✅ پیام به ${count} کاربر ارسال شد.`);
    }

    if (session.state === 'SALES_WAIT_SEARCH_QUERY') {
        const query = text.trim().toLowerCase();
        if (query.length < 2) return sendFn(chatId, "⚠️ لطفاً حداقل ۲ کاراکتر وارد کنید:");
        
        const products = (db.products || []).filter(p => 
            p.name.toLowerCase().includes(query) || 
            (p.code && p.code.toLowerCase().includes(query))
        );

        if (products.length === 0) {
            return sendFn(chatId, `❌ کالایی با عبارت "${text}" یافت نشد.`, {
                reply_markup: { inline_keyboard: [[{ text: '🔍 جستجوی مجدد', callback_data: 'SALES_SEARCH' }], [{ text: '🔙 بازگشت', callback_data: 'MENU_SALES' }]] }
            });
        }

        let res = `🔎 *نتایج جستجو برای:* "${text}"\n\n`;
        products.slice(0, 15).forEach(p => {
            res += formatProduct(p) + "------------------\n";
        });

        if (products.length > 15) res += `⚠️ ${products.length - 15} مورد دیگر یافت شد. لطفا جستجو را دقیق‌تر کنید.`;
        
        session.state = 'IDLE';
        return sendFn(chatId, res, { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'MENU_SALES' }]] } });
    }


    // --- SEARCH BY ID HANDLER ---
    if (session.state === 'WAIT_FOR_SEARCH_ID') {
        const num = text.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).trim(); // Persian numbers support
        if (!num) return sendFn(chatId, "❌ لطفا شماره سند را وارد کنید:");
        
        await searchAndSendResults(db, null, num, 'ID', session.data.targetType, platform, chatId, sendFn, sendPhotoFn);
        session.state = 'IDLE';
        return;
    }

    // --- STATE MACHINES ---

    // 1. Manual Date Search
    if (session.state === 'ARCHIVE_WAIT_DATE') {
        const dateRegex = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
        const match = text.match(dateRegex);
        if (!match) return sendFn(chatId, "⚠️ فرمت صحیح نیست. لطفا به صورت yyyy/mm/dd وارد کنید (مثال: 1403/02/15):");
        
        const normalizedDate = `${match[1]}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}`;
        await sendFn(chatId, `🔎 جستجو برای ${normalizedDate}...`);
        
        await searchAndSendResults(db, session.data.company, normalizedDate, 'EXACT_DAY', session.data.targetType, platform, chatId, sendFn, sendPhotoFn);
        session.state = 'IDLE';
        return;
    }

    // 2. Payment Registration
    if (session.state === 'PAY_AMOUNT') {
        const cleanText = text.replace(/,/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
        const amt = parseInt(cleanText);
        if (isNaN(amt) || amt <= 0) return sendFn(chatId, "❌ مبلغ نامعتبر است. لطفا عدد وارد کنید:");
        session.data.amount = amt;
        session.state = 'PAY_PAYEE';
        return sendFn(chatId, "👤 نام گیرنده وجه (ذینفع) را وارد کنید:");
    }
    if (session.state === 'PAY_PAYEE') {
        session.data.payee = text;
        session.state = 'PAY_DESC';
        return sendFn(chatId, "📝 بابت (شرح پرداخت) را وارد کنید:");
    }
    if (session.state === 'PAY_DESC') {
        const company = session.data.company || db.settings.defaultCompany || '';
        let minStart = db.settings.currentTrackingNumber || 1000;
        if (db.settings.activeFiscalYearId && company) {
            const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
            if (year && year.companySequences && year.companySequences[company]) {
                minStart = year.companySequences[company].startTrackingNumber || minStart;
            }
        }
        
        let trackingNumber = utils.findNextGapNumber(db.orders, company, 'trackingNumber', minStart);
        
        // Final Duplicate Check
        while (utils.checkForDuplicate(db.orders, 'trackingNumber', trackingNumber, 'payingCompany', company)) {
            trackingNumber++;
        }

        const order = {
            id: generateUUID(),
            trackingNumber: trackingNumber,
            date: getTehranDateString(),
            payee: session.data.payee,
            totalAmount: session.data.amount,
            description: text,
            status: 'در انتظار بررسی مالی',
            requester: user ? user.fullName : 'کاربر ربات',
            payingCompany: company,
            createdAt: Date.now(),
            paymentDetails: [{ id: generateUUID(), method: 'حواله بانکی', amount: session.data.amount }]
        };
        if(!db.orders) db.orders = [];
        db.orders.unshift(order);
        dbManager.saveDb(db);
        console.log(`[Bot] Registered Payment #${order.trackingNumber} for user ${user ? user.fullName : chatId}`);
        session.state = 'IDLE';
        await sendFn(chatId, `✅ دستور پرداخت #${order.trackingNumber} با موفقیت ثبت شد.`);
        return;
    }

    // 3. Exit Permit Registration
    if (session.state === 'EXIT_RECIPIENT') {
        session.data.recipient = text;
        session.state = 'EXIT_ITEM';
        return sendFn(chatId, "📦 نام کالا را وارد کنید:");
    }
    if (session.state === 'EXIT_ITEM') {
        session.data.item = text;
        session.state = 'EXIT_COUNT';
        return sendFn(chatId, "🔢 تعداد/مقدار را وارد کنید:");
    }
    if (session.state === 'EXIT_COUNT') {
        const company = session.data.company || db.settings.defaultCompany || '';
        
        let minStart = db.settings.currentExitPermitNumber || 1000;
        if (db.settings.activeFiscalYearId && company) {
            const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
            if (year && year.companySequences && year.companySequences[company]) {
                minStart = year.companySequences[company].startExitPermitNumber || minStart;
            }
        }
        
        let permitNumber = utils.findNextGapNumber(db.exitPermits, company, 'permitNumber', minStart);
        
        // Final Duplicate Check
        while (utils.checkForDuplicate(db.exitPermits, 'permitNumber', permitNumber, 'company', company)) {
            permitNumber++;
        }

        const permit = {
            id: generateUUID(),
            permitNumber: permitNumber,
            date: getTehranDateString(),
            company: company,
            requester: user.fullName,
            recipientName: session.data.recipient,
            goodsName: session.data.item,
            cartonCount: parseInt(text) || 0,
            weight: 0,
            status: 'در انتظار تایید مدیرعامل',
            createdAt: Date.now(),
            items: [{ id: generateUUID(), goodsName: session.data.item, cartonCount: parseInt(text) || 0, weight: 0 }],
            destinations: [{ id: generateUUID(), recipientName: session.data.recipient, address: '', phone: '' }]
        };
        if(!db.exitPermits) db.exitPermits = [];
        db.exitPermits.push(permit);
        dbManager.saveDb(db);
        session.state = 'IDLE';

        // Notify first step (CEO)
        try {
            await notifyExitPermitStep(permit, platform, chatId, sendPhotoFn, db, 'ثبت توسط ربات');
        } catch (e) { console.error("Initial Notify Error:", e); }

        return sendFn(chatId, `✅ مجوز خروج #${permit.permitNumber} ثبت شد.`);
    }

    // 4. Warehouse Bijak Registration
    if (session.state === 'WH_BIJAK_COUNT') {
        const count = parseInt(text.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
        if(isNaN(count)) return sendFn(chatId, "❌ لطفا عدد وارد کنید:");
        session.data.count = count;
        session.state = 'WH_BIJAK_ITEM';
        return sendFn(chatId, "📦 نام کالا را وارد کنید:");
    }
    if (session.state === 'WH_BIJAK_ITEM') {
        session.data.itemName = text;
        session.state = 'WH_BIJAK_RECIPIENT';
        return sendFn(chatId, "👤 نام تحویل گیرنده:");
    }
    if (session.state === 'WH_BIJAK_RECIPIENT') {
        session.data.recipient = text;
        session.state = 'WH_BIJAK_PRICE';
        return sendFn(chatId, "💰 فی (قیمت واحد) را وارد کنید:\n(در صورت عدم نیاز به قیمت، عدد 0 را وارد کنید)");
    }

    if (session.state === 'WH_BIJAK_PRICE') {
        const cleanPrice = text.replace(/,/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
        let price = parseInt(cleanPrice);
        if(isNaN(price) || price < 0) return sendFn(chatId, "❌ لطفا یک عدد معتبر برای قیمت وارد کنید:");

        const company = session.data.company || db.settings.defaultCompany || '';
        let minStart = 1000;
        if (db.settings.activeFiscalYearId && company) {
            const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
            if (year && year.companySequences && year.companySequences[company]) {
                minStart = year.companySequences[company].startBijakNumber || 1000;
            }
        }
        let nextSeq = utils.findNextGapNumber(db.warehouseTransactions, company, 'number', minStart);
        
        // Final Duplicate Check
        while (utils.checkForDuplicate(db.warehouseTransactions, 'number', nextSeq, 'company', company)) {
            nextSeq++;
        }

        const tx = {
            id: generateUUID(),
            type: 'OUT',
            date: getTehranDateString(),
            company: company,
            number: nextSeq,
            recipientName: session.data.recipient,
            items: [{
                itemId: 'bot_gen',
                itemName: session.data.itemName,
                quantity: session.data.count,
                weight: 0,
                unitPrice: price
            }],
            createdAt: Date.now(),
            createdBy: user.fullName + ' (Bot)',
            status: 'APPROVED',
            approvedBy: user.fullName + ' (Bot)'
        };
        if(!db.warehouseTransactions) db.warehouseTransactions = [];
        db.warehouseTransactions.unshift(tx);
        dbManager.saveDb(db);
        session.state = 'IDLE';
        
        notifyWarehouseBijak(tx, db, 'تایید نهایی').catch(e => console.error("Bot Bijak Notify Error:", e));

        return sendFn(chatId, `✅ بیجک خروج #${nextSeq} ثبت و تایید نهایی شد.`);
    }

    if (isGroup) return; // Silent for groups on unrecognized messages
    
    return sendFn(chatId, "دستور نامفهوم. از منو استفاده کنید.", { 
        reply_markup: user ? KEYBOARDS.MAIN : {
            inline_keyboard: [[{ text: '🏠 منوی اصلی', callback_data: 'GUEST_MAIN' }]]
        }
    });
};

export const notifyExitPermitStep = async (p, platform, chatId, sendPhotoFn, db, stepName, eventType = 'STEP') => {
    try {
        const isEdit = eventType === 'EDIT';
        const isDelete = eventType === 'DELETE';
        
        // Deduplicate the same permit + status notification to avoid "Machine Gun" bursts
        const dedupeKey = `EXIT_${p.id}_${p.status}_${eventType}`;
        if (isDuplicateNotification(dedupeKey) && eventType !== 'MANUAL') return;
        
        const imgPrice = await Renderer.generateRecordImage(p, 'EXIT', { isEdit, isDelete, forceHidePrices: false });
        const imgNoPrice = await Renderer.generateRecordImage(p, 'EXIT', { isEdit, isDelete, forceHidePrices: true });
        
        const itemsToCalculate = (p.items && p.items.length > 0) ? p.items : [{ cartonCount: p.cartonCount || 0, weight: p.weight || 0, deliveredCartonCount: undefined, deliveredWeight: undefined }];
        const totalReqCount = itemsToCalculate.reduce((sum, i) => sum + (Number(i.cartonCount) || 0), 0);
        const totalReqWeight = itemsToCalculate.reduce((sum, i) => sum + (Number(i.weight) || 0), 0);
        
        const showDeliv = itemsToCalculate.some(i => i.deliveredCartonCount !== undefined);
        const totalDelivCount = showDeliv ? itemsToCalculate.reduce((sum, i) => sum + (Number(i.deliveredCartonCount) || 0), 0) : totalReqCount;
        const totalDelivWeight = showDeliv ? itemsToCalculate.reduce((sum, i) => sum + (Number(i.deliveredWeight) || 0), 0) : totalReqWeight;

        const settings = db.settings || {};

        const isLogisticsGroup = (id) => {
            if (!id) return false;
            const s = settings;
            const logisticsIds = [
                s.botSecurityGroupId,
                s.botBijakGroupId,
                s.botBijakGroupIdBale,
                s.botBijakGroupIdWhatsApp,
                s.exitPermitNotificationTelegramId,
                s.exitPermitNotificationBaleId,
                s.exitPermitNotificationGroup,
                s.defaultWarehouseGroup,
                s.exitPermitFirstGroupConfig?.groupId,
                s.exitPermitFirstGroupConfig?.telegramId,
                s.exitPermitFirstGroupConfig?.baleId,
                s.exitPermitSecondGroupConfig?.groupId,
                s.exitPermitSecondGroupConfig?.telegramId,
                s.exitPermitSecondGroupConfig?.baleId
            ].filter(Boolean).map(x => String(x));
            
            const strId = String(id);
            // Also detect by ID pattern (Telegram groups start with -)
            return logisticsIds.includes(strId) || strId.startsWith('-') || strId.includes('@g.us');
        };

        const generateCaption = (targetGroupId) => {
            const hidePrice = isLogisticsGroup(targetGroupId);
            let goodsList = '';
            if (p.items && p.items.length > 0) {
                goodsList = p.items.map((it, idx) => {
                    // Force hide price if it's a logistics group or as per general rule for factory groups
                    const priceTxt = (!hidePrice && it.price) ? ` (فی: ${Number(it.price).toLocaleString()} ریال)` : '';
                    return `${idx + 1}. ${it.goodsName} (${it.cartonCount} عدد)${priceTxt}`;
                }).join('\n');
            } else if (p.goodsName) {
                goodsList = `1. ${p.goodsName} (${p.cartonCount || 0} عدد)`;
            } else {
                goodsList = 'نامشخص';
            }

            const isFinalStep = p.status === 'خارج شده (بایگانی)';
            let header = isDelete ? `❌ *حذف شد: مجوز خروج کالا*` : (isEdit ? `✏️ *ویرایش شد: مجوز خروج کالا*` : `🚛 *مجوز خروج کالا از کارخانه*`);
            if (isFinalStep && !isDelete && !isEdit) header = `✅ *خروج کارخانه (تکمیل شده)*`;
            
            let approvers = [];
            if (p.approverCeo) approvers.push(`مدیرعامل / تایید فروش: ${p.approverCeo}`);
            if (p.approverFactory) approvers.push(`مدیر کارخانه / مجوز ورود و بارگیری: ${p.approverFactory}`);
            if (p.approverWarehouse) approvers.push(`سرپرست انبار / انجام بارگیری: ${p.approverWarehouse}`);
            if (p.approverSecurity) approvers.push(`سرپرست انتظامات / بازرسی و تایید بارگیری: ${p.approverSecurity}`);
            if (p.approverFactoryFinal) approvers.push(`مدیر کارخانه / تایید نهایی خروج: ${p.approverFactoryFinal}`);
            const approversLine = approvers.length > 0 ? `\n✅ *تاییدها:* \n${approvers.join('\n')}` : '';

            const countLine = `🔢 تعداد درخواستی: ${totalReqCount} واحد/کارتن ${totalReqWeight > 0 ? `(${totalReqWeight} کیلوگرم)` : ''} ${showDeliv ? `\n✅ ارسالی از انبار: ${totalDelivCount} واحد/کارتن ${totalDelivWeight > 0 ? `(${totalDelivWeight} کیلوگرم)` : ''}` : ''}`;
            
            return `${header}\n🏢 شرکت: ${p.company || '-'}\n🔢 شماره: ${p.permitNumber}\n📅 تاریخ: ${toShamsiFull(p.date)}\n👤 گیرنده: ${p.recipientName || '-'}\n📦 کالاها:\n${goodsList}\n${countLine}\n👤 ثبت کننده: ${p.requester || '-'}\n📍 مقصد: ${p.destinationAddress || '-'}\n🚛 راننده: ${p.driverName || '-'} (پلاک: ${p.plateNumber || '-'}) | تماس: ${p.driverPhone || '-'}${p.status === 'خارج شده (بایگانی)' && p.exitTime ? `\n🕒 ساعت خروج نهایی: ${p.exitTime}` : (p.exitTime ? `\n🕒 ساعت خروج: ${p.exitTime}` : '')}${approversLine}\n📝 توضیحات: ${p.description || '-'}\n\n✅ *مرحله:* ${stepName}\n🔄 *وضعیت:* ${p.status}${isEdit ? '\n⚠️ *این یک پیام ویرایشی است*' : ''}${isDelete ? '\n⚠️ *این سند حذف شده است*' : ''}`;
        };

        // Notify the user who did the action (if possible)
        if (chatId && sendPhotoFn) {
            const userCaption = generateCaption(chatId);
            const userImg = isLogisticsGroup(chatId) ? imgNoPrice : imgPrice;
            sendPhotoFn(platform, chatId, userImg, userCaption).catch(e => console.error("User Notify Error:", e));
        }

        // Map Persian Status to Internal Key for checking settings
        let statusKey = p.status;
        if (eventType === 'DELETE') {
            statusKey = 'REJECTED'; 
        } else if (stepName === 'ثبت اولیه' || stepName === 'ثبت توسط ربات' || p.status === 'در انتظار تایید مدیرعامل') {
            statusKey = 'CREATE';
        } else if (p.status === 'خارج شده (بایگانی)' || p.status === 'خارج شد') {
            // This is the final archived state
            statusKey = 'ARCHIVED'; 
        }

        let targetGroups = [];

        // Group 1 logic (Settings-based routing)
        const g1Config = settings.exitPermitFirstGroupConfig || { activeStatuses: [] };
        if (g1Config.activeStatuses && g1Config.activeStatuses.includes(statusKey)) {
            targetGroups.push(1);
        }
        
        // Group 2 logic (Settings-based routing)
        const g2Config = settings.exitPermitSecondGroupConfig || { activeStatuses: [] };
        if (g2Config.activeStatuses && g2Config.activeStatuses.includes(statusKey)) {
            targetGroups.push(2);
        }

        // Group 3 logic (Settings-based routing)
        const g3Config = settings.exitPermitThirdGroupConfig || { activeStatuses: [] };
        if (g3Config.activeStatuses && g3Config.activeStatuses.includes(statusKey)) {
            targetGroups.push(3);
        }

        // --- NEW: Customer Notification with Proforma Image ---
        if (p.status === 'خارج شده (بایگانی)' && !isEdit && !isDelete) {
            const customerPhone = (p.destinations && p.destinations[0]) ? p.destinations[0].phone : (p.driverPhone || null);
            if (customerPhone) {
                (async () => {
                    try {
                        const amount = (p.items||[]).reduce((sum, item) => sum + ((item.deliveredCartonCount ?? item.cartonCount ?? 0) * (item.price || 0)), 0);
                        const customerCaption = `✨ *فاکتور نهایی خروج کالا #${p.permitNumber}*\n\n` +
                                              `👤 خریدار: *${p.recipientName || '-'}*\n` +
                                              `⚖️ وزن کل: ${p.weight} کیلوگرم\n` +
                                              `📦 تعداد کل: ${p.cartonCount} کارتن\n` +
                                              `💵 مبلغ کل: ${amount.toLocaleString()} ریال\n` +
                                              (p.driverName ? `👨‍✈️ راننده: ${p.driverName}\n` : '') +
                                              (p.plateNumber ? `🆔 پلاک: ${p.plateNumber}\n` : '') +
                                              `🕒 ساعت خروج: ${p.exitTime || '-'}\n\n` +
                                              `✅ کالای شما با موفقیت بارگیری و از کارخانه خارج شد. تصویر فاکتور رسمی پیوست گردید.\n\nبا سپاس از اعتماد شما 🙏`;
                        
                        const customerImg = await Renderer.generateRecordImage(p, 'CUSTOMER_INVOICE');
                        const imgB64 = customerImg.toString('base64');

                        // 1. WhatsApp
                        if (whatsapp && typeof whatsapp.sendMessage === 'function') {
                            await whatsapp.sendMessage(customerPhone, customerCaption, {
                                data: imgB64,
                                mimeType: 'image/png',
                                filename: `invoice-${p.permitNumber}.png`
                            });
                        }

                        // 2. Telegram / Bale (Via bot-core helper)
                        await sendBotMessageByPhone(customerPhone, customerCaption, imgB64);

                        console.log(`✅ Professional proforma sent to customer: ${customerPhone}`);
                    } catch (e) {
                        console.error("❌ Customer proforma notification failed:", e.message);
                    }
                })();
            }
        }

        // Distinctly and separately fire off to all targets, without await to prevent blocking
        for (const gNum of targetGroups) {
            let tgGroupId = '';
            let baleGroupId = '';
            let waGroupId = '';
            let companyConfig = settings.companyNotifications?.[p.company] || {};

            if (gNum === 1) {
                const g1Config = settings.exitPermitFirstGroupConfig || {};
                tgGroupId = g1Config.telegramId || companyConfig.telegramChannelId || settings.exitPermitNotificationTelegramId || '';
                baleGroupId = g1Config.baleId || companyConfig.baleChannelId || settings.exitPermitNotificationBaleId || '';
                waGroupId = g1Config.groupId || companyConfig.warehouseGroup || settings.exitPermitNotificationGroup || settings.defaultWarehouseGroup || '';
            } else if (gNum === 2) {
                tgGroupId = g2Config.telegramId;
                baleGroupId = g2Config.baleId;
                waGroupId = g2Config.groupId;
            } else if (gNum === 3) {
                const g3Config = settings.exitPermitThirdGroupConfig || {};
                tgGroupId = g3Config.telegramId;
                baleGroupId = g3Config.baleId;
                waGroupId = g3Config.groupId;
            }

            // Fire Telegram
            if (tgGroupId && settings.telegramBotToken) {
                const cleanId = sanitizeGroupId(tgGroupId);
                const targetCaption = generateCaption(cleanId);
                const targetImg = isLogisticsGroup(cleanId) ? imgNoPrice : imgPrice;
                import('./telegram.js').then(mod => {
                    if (mod?.sendBotPhoto) mod.sendBotPhoto(cleanId, targetImg, targetCaption).catch(e => console.error("TG Group Notify Error:", e));
                }).catch(e => console.error("TG Import Error", e));
            }

            // Fire Bale
            if (baleGroupId && settings.baleBotToken) {
                const cleanId = sanitizeGroupId(baleGroupId);
                const targetCaption = generateCaption(cleanId);
                const targetImg = isLogisticsGroup(cleanId) ? imgNoPrice : imgPrice;
                import('./bale.js').then(mod => {
                    if (mod?.sendBotPhoto) mod.sendBotPhoto(cleanId, targetImg, targetCaption).catch(e => console.error("Bale Group Notify Error:", e));
                }).catch(e => console.error("Bale Import Error", e));
            }

            // Fire WhatsApp
            if (waGroupId && settings.whatsappEnabled) {
                const targetCaption = generateCaption(waGroupId);
                const targetImg = isLogisticsGroup(waGroupId) ? imgNoPrice : imgPrice;
                import('./whatsapp.js').then(mod => {
                    if (mod?.sendMessage) {
                        const buffer = Buffer.from(targetImg);
                        const b64 = buffer.toString('base64');
                        mod.sendMessage(waGroupId, targetCaption, { data: b64, mimeType: 'image/png', filename: 'permit.png' })
                            .catch(e => console.error("WA Group Notify Error:", e));
                    }
                }).catch(e => console.error("WA Import Error", e));
            }
        }
    } catch (e) { console.error("Notification Helper Error:", e); }
};

export const notifyPaymentOrderStep = async (o, db, stepName, isFinal = false, eventType = 'STEP') => {
    try {
        const isEdit = eventType === 'EDIT';
        const isDelete = eventType === 'DELETE';
        
        const dedupeKey = `PAYMENT_${o.id}_${o.status}_${eventType}`;
        if (isDuplicateNotification(dedupeKey)) return;
        const settings = db.settings || {};
        
        // DEFAULTING TO 'after_submit' based on repeated user request for accounting group behavior
        const mode = settings.botPaymentNotificationMode || 'after_submit';
        
        // CRITICAL: Mode filtering for ACCOUNTING GROUP
        // Based on user request: If mode is 'after_submit', ONLY send the initial registration message to the group.
        // We trim the stepName to avoid whitespace issues.
        const normalizedStep = (stepName || '').trim();
        
        if (mode === 'after_submit') {
            // When in 'after_submit' mode, block everything EXCEPT the initial creation
            if (normalizedStep !== 'ثبت اولیه') {
                // If it's a step change (not create/edit/delete), we block it for the group
                if (eventType === 'STEP') return;
                // If it's an EDIT or DELETE, we might want to send it, but let's be strict as per user request
                // The user says "only on initial registration mode", so we block others too if needed
                if (eventType === 'EDIT') return; // User doesn't want updates to flood the group
            }
        }
        
        // If mode is after_final, only send if it's the final approval
        if (mode === 'after_final' && !isFinal && eventType === 'STEP') return;

        const tgGroupId = settings.botAccountingGroupIdTele || settings.botAccountingGroupId || '';
        const baleGroupId = settings.botAccountingGroupIdBale || '';
        const waGroupId = settings.botAccountingGroupIdWhatsApp || '';

        if (!tgGroupId && !baleGroupId && !waGroupId) return; // No targets

        let paymentBankInfo = '-';
        if (o.paymentDetails && o.paymentDetails.length > 0) {
            const banks = [...new Set(o.paymentDetails.map(d => d.bankName || d.method).filter(Boolean))];
            if (banks.length > 0) {
                paymentBankInfo = banks.join('، ');
            }
        }

        let header = isDelete ? `❌ *حذف شد: دستور پرداخت*` : (isEdit ? `✏️ *ویرایش شد: دستور پرداخت*` : `💸 *دستور پرداخت*`);
        let caption = `${header}\n🏢 شرکت: ${o.payingCompany || '-'}\n🔢 شماره: ${o.trackingNumber || o.id}\n📅 تاریخ پرداخت: ${o.date ? toShamsiFull(o.date) : '-'}\n💰 مبلغ: ${Number(o.totalAmount || 0).toLocaleString()} ریال\n🏦 بانک پرداختی: ${paymentBankInfo}\n💳 نوع پرداختی: ${(o.paymentDetails&&o.paymentDetails.length>0) ? o.paymentDetails[0].method : '-'}\n👤 ذینفع: ${o.payee || '-'}\n📍 محل پرداخت: ${o.paymentPlace || '-'}\n📝 توضیحات: ${o.description || '-'}\n\n✅ *مرحله:* ${stepName}\n🔄 *وضعیت:* ${o.status}${isEdit ? '\n⚠️ *این یک پیام ویرایشی است*' : ''}${isDelete ? '\n⚠️ *این سند حذف شده است*' : ''}`;
        
        const attachFiles = o.attachments && o.attachments.length > 0;
        if (attachFiles) caption += `\n📎 همراه با ${o.attachments.length} فایل/سند الحاقی`;

        // Fire Telegram
        if (tgGroupId && settings.telegramBotToken) {
            const cleanId = sanitizeGroupId(tgGroupId);
            import('./telegram.js').then(mod => {
                if (mod?.sendBotMessage) mod.sendBotMessage(cleanId, caption).catch(e => console.error("TG Payment Notify Error:", e));
            }).catch(e => console.error("TG Import Error", e));
        }

        // Fire Bale
        if (baleGroupId && settings.baleBotToken) {
            const cleanId = sanitizeGroupId(baleGroupId);
            import('./bale.js').then(mod => {
                if (mod?.sendBotMessage) mod.sendBotMessage(cleanId, caption).catch(e => console.error("Bale Payment Notify Error:", e));
            }).catch(e => console.error("Bale Import Error", e));
        }

        // Fire WhatsApp
        if (waGroupId && settings.whatsappEnabled) {
            import('./whatsapp.js').then(mod => {
                if (mod?.sendMessage) {
                    mod.sendMessage(waGroupId, caption).catch(e => console.error("WA Payment Notify Error:", e));
                }
            }).catch(e => console.error("WA Import Error", e));
        }
    } catch (e) { console.error("Payment Notification Helper Error:", e); }
};

export const notifyWarehouseBijak = async (tx, db, stepName, eventType = 'STEP') => {
    try {
        const isEdit = eventType === 'EDIT';
        const isDelete = eventType === 'DELETE';

        const dedupeKey = `BIJAK_${tx.id}_${tx.status}_${eventType}`;
        if (isDuplicateNotification(dedupeKey)) return;
        
        const settings = db.settings || {};
        
        // Calculate remaining balance for items in this Bijak
        const txs = Array.isArray(db.warehouseTransactions) ? db.warehouseTransactions : [];
        const stockInfo = (tx.items || []).map(item => {
            let qty = 0; let weight = 0;
            txs.filter(t => t.company === tx.company && t.status !== 'REJECTED').forEach(t => {
                if (Array.isArray(t.items)) {
                    t.items.forEach(ti => {
                        if (ti.itemId === item.itemId || ti.itemName === item.itemName) {
                            if (t.type === 'IN') { qty += (ti.quantity || 0); weight += (ti.weight || 0); }
                            else { qty -= (ti.quantity || 0); weight -= (ti.weight || 0); }
                        }
                    });
                }
            });
            return { name: item.itemName, qty, weight };
        });

        // Use full date helper if available
        const dateStr = toShamsiFull ? toShamsiFull(tx.date) : new Date(tx.date).toLocaleDateString('fa-IR');
        
        // Generate images using Renderer
        const Renderer = await import('./renderer.js');
        const imgWithPrice = await Renderer.generateRecordImage(tx, 'BIJAK', { isEdit, isDelete, forceHidePrices: false, stockInfo });
        const imgNoPrice = await Renderer.generateRecordImage(tx, 'BIJAK', { isEdit, isDelete, forceHidePrices: true, stockInfo });
        
        let header = isDelete ? `❌ *حذف شد: حواله خروج انبار (بیجک)*` : (isEdit ? `✏️ *ویرایش شد: حواله خروج انبار*` : `🚨 *حواله خروج انبار (بیجک)*`);
        let footerText = stepName === 'ثبت اولیه' ? '⚠️ *لطفا جهت بررسی و تایید به کارتابل انبار مراجعه فرمایید.*' : `✅ *تایید نهایی توسط:* ${tx.approvedBy || '-'}`;
        
        let commonDetails = `🔢 *شماره:* ${tx.number}\n`;
        commonDetails += `🏢 *شرکت:* ${tx.company || '-'}\n`;
        commonDetails += `📅 *تاریخ:* ${dateStr}\n`;
        commonDetails += `👤 *گیرنده:* ${tx.recipientName || '-'}\n`;
        commonDetails += `📍 *مقصد:* ${tx.destination || '-'}\n`;
        commonDetails += `🚚 *راننده:* ${tx.driverName || '-'}\n`;
        commonDetails += `🆔 *پلاک:* \`${tx.plateNumber || '-'}\`\n`;
        commonDetails += `━━━━━━━━━━━━━━\n`;

        const getItemsText = (showPrice) => {
            let text = `📦 *اقلام حواله:* \n`;
            tx.items.forEach((it, idx) => {
                text += `${idx + 1}. ${it.itemName} | ${it.quantity} ${it.unit || 'واحد'}${showPrice && it.unitPrice ? ` | في: ${Number(it.unitPrice).toLocaleString()}` : ''}\n`;
            });
            return text;
        };

        const stockText = `━━━━━━━━━━━━━━\n📊 *مانده موجودی این کالاها:* \n${stockInfo.map(s => `🔹 ${s.name}: ${s.qty.toFixed(2)} واحد | ${s.weight.toFixed(2)} KG`).join('\n')}\n`;
        
        const footer = `━━━━━━━━━━━━━━\n${tx.description ? `📝 *توضیحات:* ${tx.description}\n━━━━━━━━━━━━━━\n` : ''}🔄 *وضعیت:* ${tx.status || 'PENDING'}\n📢 *مرحله:* ${stepName}\n${footerText}`;

        const privateCaption = `${header}\n━━━━━━━━━━━━━━\n${commonDetails}${getItemsText(true)}${stockText}${footer}`;
        const groupCaption = `${header}\n━━━━━━━━━━━━━━\n${commonDetails}${getItemsText(false)}${stockText}${footer}`;

        const mediaDataNoPrice = { data: imgNoPrice.toString('base64'), filename: `Bijak_${tx.number}.png`, mimeType: 'image/png' };
        const mediaDataWithPrice = { data: imgWithPrice.toString('base64'), filename: `Bijak_${tx.number}_Price.png`, mimeType: 'image/png' };

        // Helper to send based on target type
        const sendToTarget = async (t, isPrivate) => {
            const img = isPrivate ? imgWithPrice : imgNoPrice;
            const caption = isPrivate ? privateCaption : groupCaption;
            const media = isPrivate ? mediaDataWithPrice : mediaDataNoPrice;

            if (t.type === 'wa' && settings.whatsappEnabled) {
                const mod = await import('./whatsapp.js');
                mod.sendMessage(t.id, caption, media).catch(console.error);
            }
            if (t.type === 'tg' && settings.telegramBotToken) {
                const mod = await import('./telegram.js');
                mod.sendBotPhoto(sanitizeGroupId(t.id), img, caption).catch(console.error);
            }
            if (t.type === 'bale' && settings.baleBotToken) {
                const mod = await import('./bale.js');
                mod.sendBotPhoto(sanitizeGroupId(t.id), img, caption).catch(console.error);
            }
        };

        // 1. Send to Global Bijak Groups (if configured) -> NO PRICE
        const tgGroupId = settings.botBijakGroupId || '';
        const baleGroupId = settings.botBijakGroupIdBale || '';
        const waGroupId = settings.botBijakGroupIdWhatsApp || '';

        if (tx.status === 'APPROVED' || isDelete || isEdit) {
            if (tgGroupId) sendToTarget({ type: 'tg', id: tgGroupId }, false);
            if (baleGroupId) sendToTarget({ type: 'bale', id: baleGroupId }, false);
            if (waGroupId) sendToTarget({ type: 'wa', id: waGroupId }, false);
        }

        // 2. Send to Company-Specific Groups/Managers -> GROUPS NO PRICE
        const companyConfig = settings.companyNotifications?.[tx.company];
        if (companyConfig) {
            // Group notifications
            if (tx.status === 'APPROVED' && companyConfig.warehouseGroup) sendToTarget({ type: 'wa', id: companyConfig.warehouseGroup }, false);
            if (tx.status === 'APPROVED' && companyConfig.telegramChannelId) sendToTarget({ type: 'tg', id: companyConfig.telegramChannelId }, false);
            if (tx.status === 'APPROVED' && companyConfig.baleChannelId) sendToTarget({ type: 'bale', id: companyConfig.baleChannelId }, false);
            
            // Sales Manager notifications on Approval
            if (tx.status === 'APPROVED' && companyConfig.salesManager) sendToTarget({ type: 'wa', id: companyConfig.salesManager }, true);
            if (tx.status === 'APPROVED' && companyConfig.salesManagerBale) sendToTarget({ type: 'bale', id: companyConfig.salesManagerBale }, true);
            if (tx.status === 'APPROVED' && companyConfig.salesManagerTelegram) sendToTarget({ type: 'tg', id: companyConfig.salesManagerTelegram }, true);

            if (stepName === 'ثبت اولیه' && companyConfig.salesManager) sendToTarget({ type: 'wa', id: companyConfig.salesManager }, true);
            if (stepName === 'ثبت اولیه' && companyConfig.salesManagerBale) sendToTarget({ type: 'bale', id: companyConfig.salesManagerBale }, true);
            if (stepName === 'ثبت اولیه' && companyConfig.salesManagerTelegram) sendToTarget({ type: 'tg', id: companyConfig.salesManagerTelegram }, true);
        }

        // 3. If Pending, Notify CEO/Managers (Private) -> WITH PRICE
        if (tx.status === 'PENDING' && stepName === 'ثبت اولیه') {
            const managers = (db.users || []).filter(u => u.role === 'ceo' || u.role === 'admin');
            for (const mgr of managers) {
                if (mgr.telegramId) sendToTarget({ type: 'tg', id: mgr.telegramId }, true);
                if (mgr.baleId) sendToTarget({ type: 'bale', id: mgr.baleId }, true);
            }
        }

    } catch (e) {
        console.error("notifyWarehouseBijak Error:", e);
    }
};

export const handleCallback = async (platform, chatId, userId, data, sendFn, sendPhotoFn, sendDocFn, checkMembershipFn) => {
    const db = getDb();
    const settings = db.settings || {};
    const user = resolveUser(db, platform, userId);
    const isGroup = chatId.toString().startsWith('-') || 
                  (platform === 'bale' && (chatId.toString().length > 10 || chatId.toString().startsWith('g') || chatId.toString().includes('@group'))) ||
                  (userId && userId.toString() !== chatId.toString());

    if (!sessions[userId]) sessions[userId] = { state: 'IDLE', data: {} };
    const session = sessions[userId];
    
    // --- GROUP SILENCE POLICY ---
    if (isGroup && !data.startsWith('APP_') && !data.startsWith('REJ_') && !data.startsWith('GEN_PDF_') && data !== 'CHECK_JOIN') {
        return; 
    }
    
    // GUEST HANDLERS / PRE-AUTH HANDLERS
    if (data === 'CHECK_JOIN') {
        if (!user && !isGroup && (platform === 'telegram' || platform === 'bale') && settings.botForceJoinEnabled && settings.botForceJoinChannels) {
            if (checkMembershipFn) {
                const missingChannels = [];
                for (const ch of settings.botForceJoinChannels) {
                    if (ch.id && (!ch.platform || ch.platform === platform || ch.platform === 'all')) {
                        try {
                            const normalizedId = normalizeChannelId(ch.id);
                            const isMember = await checkMembershipFn(userId, normalizedId);
                            console.log(`[Join Callback] User ${userId} on ${platform} for channel ${normalizedId}: ${isMember}`);
                            if (!isMember) missingChannels.push(ch);
                        } catch (e) {
                            console.error(`[Join Callback Err] ${e.message}`);
                            missingChannels.push(ch);
                        }
                    }
                }
                if (missingChannels.length > 0) {
                    const btns = missingChannels.map(ch => {
                        let link = ch.link;
                        if (!link) {
                            let id = (ch.id || '').toString();
                            if (id.startsWith('http')) {
                                link = id;
                            } else {
                                const cleanId = id.replace('@', '');
                                if (platform === 'bale') link = `https://ble.ir/${cleanId}`;
                                else link = `https://t.me/${cleanId}`;
                            }
                        }
                        return [{ text: `عضویت در ${ch.name || 'کانال'}`, url: link }];
                    });
                    btns.push([{ text: '✅ عضو شدم', callback_data: 'CHECK_JOIN' }]);
                    
                    let debugInfo = "";
                    if (platform === 'bale') {
                        debugInfo = `\n\n🔍 اطلاعات بررسی:\nآیدی شما: ${userId}\nآیدی کانال: ${missingChannels[0].id}`;
                    }

                    return sendFn(chatId, `⚠️ تایید عضویت شما در ${platform === 'bale' ? 'بله' : 'تلگرام'} ناموفق بود.\n\nلطفاً ابتدا در کانال عضو شده و حدود ۱۰ ثانیه صبر کنید، سپس مجدداً دکمه تایید را بزنید.${debugInfo}`, {
                        reply_markup: { inline_keyboard: btns }
                    });
                } else {
                    // Success! 
                    await sendFn(chatId, "✅ عضویت شما تایید شد. خوش آمدید!");
                    return handleMessage(platform, chatId, '/start', sendFn, sendPhotoFn, sendDocFn, checkMembershipFn);
                }
            }
        }
        return;
    }

    // --- REGISTRATION BUTTONS ---
    if (data === 'GUEST_START_REG') {
        if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
        sessions[chatId].state = 'GUEST_REG_NAME';
        return sendFn(chatId, "👤 لطفاً نام و نام خانوادگی خود را وارد کنید (اختیاری):", {
            reply_markup: { inline_keyboard: [[{ text: '⏩ رد کردن', callback_data: 'SKIP_REG_NAME' }]] }
        });
    }
    if (data === 'SKIP_REG_NAME') {
        if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
        sessions[chatId].state = 'GUEST_REG_MOBILE';
        return sendFn(chatId, "📱 لطفاً شماره موبایل خود را وارد کنید (اختیاری):", {
            reply_markup: { inline_keyboard: [[{ text: '⏩ رد کردن', callback_data: 'SKIP_REG_MOBILE' }, { text: '⏹️ توقف ثبت‌نام', callback_data: 'SKIP_REG_BIRTHDAY' }]] }
        });
    }
    if (data === 'SKIP_REG_MOBILE') {
        if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
        sessions[chatId].state = 'GUEST_REG_BIRTHDAY';
        return sendFn(chatId, "🎂 لطفاً تاریخ تولد خود را وارد کنید (مثال: 1370/05/12) (اختیاری):", {
            reply_markup: { inline_keyboard: [[{ text: '⏩ رد کردن', callback_data: 'SKIP_REG_BIRTHDAY' }, { text: '⏹️ توقف ثبت‌نام', callback_data: 'SKIP_REG_BIRTHDAY' }]] }
        });
    }
    if (data === 'SKIP_REG_BIRTHDAY') {
        if (!sessions[chatId]) sessions[chatId] = { state: 'IDLE', data: {} };
        sessions[chatId].state = 'IDLE';
        return sendFn(chatId, "✅ ثبت‌نام متوقف شد. خوش آمدید!", {
            reply_markup: { inline_keyboard: [[{ text: '🏠 منوی اصلی', callback_data: 'GUEST_MAIN' }]] }
        });
    }

    // Allow Guest callbacks even for registered users (Admin access to customer menus)
    if (data.startsWith('GUEST_') || data.startsWith('SALES_GROUP_') || data.startsWith('SALES_SUB')) {
        if (data === 'GUEST_MAIN') {
            session.state = 'IDLE';
            const guestMenu = [
                [{ text: '📦 لیست محصولات و قیمت', callback_data: 'GUEST_PRODUCTS' }],
                [{ text: '🛒 ثبت سفارش خرید', callback_data: 'GUEST_ORDER' }],
                [{ text: '🎫 ثبت تیکت / ارتباط با پشتیبانی', callback_data: 'GUEST_CONTACT_FLOW' }],
                [{ text: '💰 استعلام مانده حساب من', callback_data: 'GUEST_BALANCE_REQUEST' }],
                [{ text: '🔍 پیگیری تیکت یا سفارش', callback_data: 'GUEST_TRACK' }],
                [{ text: '🏢 اطلاعات شرکت و حساب‌ها', callback_data: 'GUEST_COMPANY_INFO' }]
            ];
            
            if (settings.botStoreLinks && settings.botStoreLinks.length > 0) {
                settings.botStoreLinks.forEach(link => {
                    guestMenu.push([{ text: `🌐 ${link.title}`, url: link.url }]);
                });
            }

            return sendFn(userId, `لطفاً یکی از گزینه‌های زیر را انتخاب کنید:`, {
                reply_markup: {
                    inline_keyboard: guestMenu
                }
            });
        }

        if (data === 'GUEST_BALANCE_REQUEST') {
            let code = null;
            let source = 'direct';
            const mapped = (db.customerChatCodes || []).find(c => c.chatId === String(userId) && c.platform === platform);
            if (mapped) {
                code = mapped.accountCode;
            } else {
                // Try searching in settings.salesContacts
                const salesContacts = (db.settings && db.settings.salesContacts) || [];
                // Find contact by platform ID match
                let matchedContact = salesContacts.find(c => 
                    (platform === 'telegram' && c.telegramId && String(c.telegramId).replace('@','').toLowerCase() === String(userId).toLowerCase()) ||
                    (platform === 'bale' && c.baleId && String(c.baleId).replace('@','').toLowerCase() === String(userId).toLowerCase())
                );
                
                // If not found, look at botSubscribers to get their phone number, then match with salesContacts
                if (!matchedContact) {
                    const sub = (db.botSubscribers || []).find(s => s.chatId === String(userId) && s.platform === platform);
                    if (sub && sub.mobile) {
                        const cleanedSubMobile = String(sub.mobile).replace(/\D/g, '').slice(-10);
                        matchedContact = salesContacts.find(c => {
                            const cleanedCMobile = String(c.mobile).replace(/\D/g, '').slice(-10);
                            return cleanedCMobile && cleanedCMobile === cleanedSubMobile;
                        });
                    }
                }
                
                if (matchedContact && matchedContact.accountCode) {
                    code = matchedContact.accountCode;
                    source = 'crm';
                    
                    // Automatically persist the mapped code into customerChatCodes to make it faster next time!
                    if (!db.customerChatCodes) db.customerChatCodes = [];
                    db.customerChatCodes.push({
                        chatId: String(userId),
                        platform: platform,
                        accountCode: code,
                        updatedAt: Date.now()
                    });
                    saveDb(db);
                }
            }

            if (code) {
                const rawList = await getCustomerBalancesData(db);
                const rec = rawList.find(b => matchAccountCode(b.accountCode, code));
                
                // Fetch statements for this accountCode
                const statements = db.customerStatements || [];
                const matchedStatements = statements.filter(s => matchAccountCode(s.accountCode, code));
                
                const inline_keyboard = [];
                if (matchedStatements.length > 0) {
                    // Button to receive the latest statement file!
                    inline_keyboard.push([{ text: '📄 دریافت آخرین صورتحساب پیوست مالی', callback_data: `GUEST_STMT_${code}` }]);
                }
                inline_keyboard.push([{ text: '🔙 بازگشت', callback_data: 'GUEST_MAIN' }]);

                if (rec) {
                    const balanceStr = Number(rec.balance).toLocaleString('fa-IR');
                    
                    const displayTime = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }).format(new Date(rec.updatedAt || Date.now()));

                    const msg = `👤 *مشتری گرامی:* ${rec.name}\n🔢 کد حسابداری: \`${rec.accountCode}\`\n\n💰 *مانده حساب شما (آنلاین سایان):* ${balanceStr} ریال (${rec.type})\n📅 زمان استعلام زنده: ${displayTime}\n\n💬 در صورت هرگونه مغایرت، لطفاً به پشتیبانی یا واحد مالی اطلاع دهید.`;
                    return sendFn(userId, msg, { reply_markup: { inline_keyboard } });
                } else {
                    // Try to query Sayan directly for this specific customer in case they have zero balance
                    let name = 'مشتری سایان';
                    let balanceStr = '۰';
                    let type = 'تسویه شده';
                    let foundAny = false;
                    if (db.settings?.sayanApiUrl) {
                        try {
                            const sql = `
                                SELECT 
                                    t07.Field_005 as accountCode,
                                    t07.Field_006 as name,
                                    SUM(CAST(t24.Field_006 AS FLOAT)) - SUM(CAST(t24.Field_007 AS FLOAT)) as balance
                                FROM ACT_TBL_024 t24
                                INNER JOIN ACT_TBL_007 t07 ON t24.Field_010 LIKE '%' + RTRIM(LTRIM(t07.Field_003)) + '%'
                                WHERE (t07.Field_005 = '${code}' OR t07.Field_003 = '${code}' OR t07.Field_005 LIKE '%${code}' OR t07.Field_003 LIKE '%${code}')
                                  AND (t24.Field_010 LIKE '11%' OR t24.Field_010 LIKE '%-11%' OR t24.Field_010 LIKE '31%' OR t24.Field_010 LIKE '%-31%') 
                                  AND t24.Field_010 NOT LIKE '%-12%'
                                  AND t24.Field_010 NOT LIKE '%-13%'
                                  AND t24.Field_005 NOT IN ('102', '103', '107', '109', '114', '116', '117')
                                  AND t24.Field_003 <> '9'
                                GROUP BY t07.Field_005, t07.Field_006
                            `;
                            const res = await runSayanQuery(db, sql);
                            if (res && res.length > 0) {
                                name = res[0].name || name;
                                const bal = Number(res[0].balance || 0);
                                balanceStr = Math.abs(bal).toLocaleString('fa-IR');
                                type = bal > 0 ? 'بدهکار' : (bal < 0 ? 'بستانکار' : 'تسویه شده');
                                foundAny = true;
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    }
                    if (foundAny) {
                        const displayTime = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tehran' }).format(new Date());
                        const msg = `👤 *مشتری گرامی:* ${name}\n🔢 کد حسابداری: \`${code}\`\n\n💰 *مانده حساب شما (آنلاین سایان):* ${balanceStr} ریال (${type})\n📅 زمان استعلام زنده: ${displayTime}\n\n💬 در صورت هرگونه مغایرت، لطفاً به پشتیبانی یا واحد مالی اطلاع دهید.`;
                        return sendFn(userId, msg, { reply_markup: { inline_keyboard } });
                    } else {
                        const msg = `⚠️ *توجه!*\nکد حسابداری شما \`${code}\` است، اما رکوردی با این کد در سرور حسابداری سایان یافت نشد.\n\n💬 لطفا به پشتیبانی پیام دهید تا موضوع بررسی شود.`;
                        return sendFn(userId, msg, { reply_markup: { inline_keyboard } });
                    }
                }
            } else {
                session.state = 'GUEST_SUBMIT_ACCOUNT_CODE';
                const msg = `⚠️ *توجه!*\nشما هنوز کد حسابداری خود را ثبت نکرده‌اید.\n\n💬 لطفا ابتدا به پشتیبانی ما پیام دهید و *«کد حسابداری»* خود را دریافت نمایید.\n\nپس از دریافت، کد حسابداری اختصاصی خود را (تنها به صورت عدد انگلیسی یا کاراکتر کد) در پاسخ به این پیام ارسال نمایید تا پیوند حساب شما برقرار شود.`;
                return sendFn(userId, msg, { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'GUEST_MAIN' }]] } });
            }
        }

        if (data.startsWith('GUEST_STMT_')) {
            const code = data.replace('GUEST_STMT_', '');
            const statements = db.customerStatements || [];
            // Sort by uploadedAt desc to get the latest
            const matched = statements
                .filter(s => s.accountCode === code)
                .sort((a, b) => b.uploadedAt - a.uploadedAt);
                
            if (matched.length > 0) {
                const stmt = matched[0];
                try {
                    await sendFn(userId, `🔄 در حال دریافت آخرین صورتحساب پیوست مالی شما با شناسه \`${stmt.id}\`... منتظر بمانید.`);
                    const fileBuffer = Buffer.from(stmt.fileData, 'base64');
                    await sendDocFn(chatId, fileBuffer, stmt.fileName, `📄 صورتحساب تفصیلی تفکیک شده حسابداری: ${stmt.fileName}`);
                    return;
                } catch (e) {
                    console.error("Statement sendDocFn error: ", e);
                    return sendFn(userId, `❌ خطایی در ارسال فایل صورتحساب رخ داد. لطفاً با پشتیبانی تماس بگیرید.`);
                }
            } else {
                return sendFn(userId, `⚠️ صورتحساب بارگذاری‌شده‌ای برای کد حسابداری شما یافت نشد.`);
            }
        }

        if (data === 'GUEST_PRODUCTS') {
            const products = db.products || [];
            if (products.length === 0) {
                return sendFn(userId, "لیست محصولات در حال حاضر خالی است.", {
                    reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'GUEST_MAIN' }]] }
                });
            }
            
            const groups = [...new Set(products.map(p => p.group || 'بدون گروه'))].sort();
            const buttons = groups.map(g => [{ text: `📁 ${g}`, callback_data: `SALES_GROUP_${g}` }]);
            buttons.push([{ text: '🔙 بازگشت', callback_data: 'GUEST_MAIN' }]);
            
            return sendFn(userId, "🔖 انتخاب گروه کالا:", { reply_markup: { inline_keyboard: buttons } });
        }

        if (data.startsWith('SALES_GROUP_')) {
            const group = data.replace('SALES_GROUP_', '');
            const products = (db.products || []).filter(p => (p.group || 'بدون گروه') === group);
            const subgroups = [...new Set(products.map(p => p.subgroup || 'سایر'))].sort();
            
            const buttons = subgroups.map(sg => [
                { text: `🔹 ${sg}`, callback_data: `SALES_SUB|${group}|${sg}` }
            ]);
            const backBtn = (session.state || '').startsWith('GUEST_ORDER') ? 'GUEST_ORDER' : 'GUEST_PRODUCTS';
            buttons.push([{ text: '🔙 بازگشت', callback_data: backBtn }]);
            
            return sendFn(userId, `📁 *گروه: ${group}*\nلطفاً زیرگروه را انتخاب کنید:`, { reply_markup: { inline_keyboard: buttons } });
        }

        if (data.startsWith('SALES_SUB|')) {
            const parts = data.split('|');
            const group = parts[1];
            const subgroup = parts[2];
            const products = (db.products || []).filter(p => (p.group || 'بدون گروه') === group && (p.subgroup || 'سایر') === subgroup);
            
            if (session.state === 'GUEST_ORDER_SELECT_PRODUCT') {
                 const buttons = products.map(p => [{ text: `🛒 انتخاب ${p.name}`, callback_data: `GUEST_ORDER_PICK_${p.id}` }]);
                 buttons.push([{ text: '🔙 بازگشت', callback_data: `SALES_GROUP_${group}` }]);
                 return sendFn(userId, `🛍️ انتخاب کالا از ${subgroup}:`, { reply_markup: { inline_keyboard: buttons } });
            }

            let res = `📁 ${group} > 🔹 ${subgroup}\n\n`;
            products.forEach(p => {
                res += formatProduct(p) + "------------------\n";
            });
            
            return sendFn(userId, res, { reply_markup: { inline_keyboard: [[{ text: '🔙 انتخاب زیرگروه دیگر', callback_data: `SALES_GROUP_${group}` }], [{ text: '🔙 منوی اصلی', callback_data: 'GUEST_MAIN' }]] } });
        }

        if (data === 'GUEST_ORDER') {
            const products = db.products || [];
            if (products.length === 0) return sendFn(userId, "لیست محصولات خالی است.");
            
            session.state = 'GUEST_ORDER_SELECT_PRODUCT';
            const groups = [...new Set(products.map(p => p.group || 'بدون گروه'))].sort();
            const buttons = groups.map(g => [{ text: `📁 ${g}`, callback_data: `SALES_GROUP_${g}` }]);
            buttons.push([{ text: '🔙 انصراف', callback_data: 'GUEST_MAIN' }]);
            
            return sendFn(userId, "🛒 مرحله ۱: انتخاب محصول\nلطفاً گروه محصول مورد نظر خود را انتخاب کنید:", { reply_markup: { inline_keyboard: buttons } });
        }

        if (data.startsWith('GUEST_ORDER_PICK_')) {
            const pid = data.replace('GUEST_ORDER_PICK_', '');
            const product = (db.products || []).find(p => p.id === pid);
            if (!product) return sendFn(userId, "❌ کالا یافت نشد.");
            
            session.data.selectedProduct = product;
            session.state = 'GUEST_WAIT_ORDER_DESC';
            return sendFn(userId, `🛍️ محصول انتخاب شده: *${product.name}*\n\n📝 مرحله ۲: توضیحات\nلطفاً نام، شماره تماس و هرگونه توضیحات تکمیلی (تعداد، رنگ، و ...) را ارسال کنید:`, {
                reply_markup: { inline_keyboard: [[{ text: '🔙 تغییر محصول', callback_data: 'GUEST_ORDER' }]] }
            });
        }

        if (data === 'GUEST_CONTACT_FLOW') {
            const defaultMsg = "💬 شما در حال ارتباط با بخش پشتیبانی هستید.\n\nبرای ثبت تیکت جدید و دریافت کد پیگیری، روی دکمه زیر کلیک کنید:";
            const contactMsg = settings.salesContactMessage || "برای تماس مستقیم با شماره‌های زیر در ارتباط باشید...";
            
            return sendFn(userId, `${contactMsg}\n\n${defaultMsg}`, {
                reply_markup: { inline_keyboard: [[{ text: '📝 ثبت تیکت جدید', callback_data: 'GUEST_CONTACT' }], [{ text: '🔙 بازگشت', callback_data: 'GUEST_MAIN' }]] }
            });
        }

        if (data === 'GUEST_CONTACT') {
            session.state = 'GUEST_WAIT_CONTACT_MSG';
            const defaultMsg = "لطفاً پیام خود را شرح دهید (در صورت نیاز فایل یا عکس نیز می‌توانید ارسال کنید):";
            return sendFn(userId, defaultMsg, {
                reply_markup: { inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'GUEST_MAIN' }]] }
            });
        }
        
        if (data === 'GUEST_TRACK') {
            session.state = 'GUEST_WAIT_TRACK_CODE';
            return sendFn(userId, "🔍 لطفاً کد پیگیری درخواست خود را وارد کنید:", {
                reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'GUEST_MAIN' }]] }
            });
        }

        if (data.startsWith('GUEST_TICKET_REPLY_')) {
            const ticketId = data.replace('GUEST_TICKET_REPLY_', '');
            session.state = 'GUEST_WAIT_TICKET_REPLY';
            session.data.ticketId = ticketId;
            return sendFn(userId, "📩 لطفاً پاسخ خود را بنویسید:");
        }

        if (data === 'GUEST_COMPANY_INFO') {
            const companies = settings.companies || [];
            const customItems = settings.knowledgeBaseItems || [];
            
            // If admin enabled guest access or no specific host info, show the list
            if (settings.botAllowGuestKnowledgeBase || (companies.length > 0 && !settings.companyAddress && !settings.companyPhone)) {
                const btns = [];
                companies.slice(0, 10).forEach(c => {
                    btns.push([{ text: `🏢 ${c.name}`, callback_data: `GUEST_KNOWLEDGE_CO_${c.id}` }]);
                });
                customItems.slice(0, 5).forEach(c => {
                    btns.push([{ text: `📄 ${c.title}`, callback_data: `GUEST_KNOWLEDGE_CUST_${c.id}` }]);
                });
                btns.push([{ text: '🔙 بازگشت', callback_data: 'GUEST_MAIN' }]);
                
                return sendFn(userId, "🏢 اطلاعات شرکت‌ها و حساب‌ها\nلطفاً مورد مورد نظر را انتخاب کنید:", { reply_markup: { inline_keyboard: btns } });
            }

            const parts = [];
            if (settings.botCompanyInfo) parts.push(`ℹ️ *درباره ما:*\n${settings.botCompanyInfo}`);
            if (settings.companyAddress) parts.push(`📍 *آدرس:*\n${settings.companyAddress}`);
            if (settings.companyPhone) parts.push(`📞 *شماره تماس:*\n${settings.companyPhone}`);
            if (settings.companyBank) parts.push(`💳 *اطلاعات حساب:*\n${settings.companyBank}`);
            
            const info = parts.length > 0 ? parts.join('\n\n') : "🏢 اطلاعات شرکت هنوز تنظیم نشده است.";
            return sendFn(userId, info, {
                reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'GUEST_MAIN' }]] }
            });
        }

        if (data.startsWith('GUEST_KNOWLEDGE_CO_')) {
            const id = data.replace('GUEST_KNOWLEDGE_CO_', '');
            const company = (settings.companies || []).find(c => c.id === id);
            if (!company) return sendFn(userId, "❌ یافت نشد.");
            
            let text = `🏢 *مشخصات ${company.name}*\n\n`;
            if (company.nationalId) text += `▫️ شناسه ملی: \`${company.nationalId}\`\n`;
            if (company.phone) text += `▫️ تلفن: \`${company.phone}\`\n`;
            if (company.address) text += `▫️ آدرس: ${company.address}\n`;
            
            const btns = [];
            if (company.banks && company.banks.length > 0) {
                text += `\n*حساب‌های بانکی:*`;
                company.banks.forEach(b => {
                    btns.push([{ text: `🏦 ${b.bankName} (${b.accountNumber.slice(-4)})`, callback_data: `GUEST_KNOW_BANK_${company.id}_${b.id}` }]);
                });
            }
            btns.push([{ text: '🔙 بازگشت', callback_data: 'GUEST_COMPANY_INFO' }]);
            return sendFn(userId, text, { reply_markup: { inline_keyboard: btns } });
        }

        if (data.startsWith('GUEST_KNOW_BANK_')) {
            const parts = data.replace('GUEST_KNOW_BANK_', '').split('_');
            const companyId = parts[0];
            const bankId = parts[1];
            const company = (settings.companies || []).find(c => c.id === companyId);
            const bank = (company?.banks || []).find(b => b.id === bankId);
            if (!bank) return sendFn(userId, "❌ یافت نشد.");
            
            let text = `💳 *اطلاعات حساب بانکی*\n\n`;
            text += `👤 صاحب حساب: *${company.name}*\n`;
            text += `🏦 بانک: *${bank.bankName}*\n`;
            text += `🔸 شماره حساب: \`${bank.accountNumber}\`\n`;
            if (bank.cardNumber) text += `🔸 شماره کارت: \`${bank.cardNumber}\`\n`;
            if (bank.sheba) text += `🔸 شبا: \`IR${bank.sheba.replace(/^IR/i, '')}\`\n`;
            
            return sendFn(userId, text, { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: `GUEST_KNOWLEDGE_CO_${company.id}` }]] } });
        }

        if (data.startsWith('GUEST_KNOWLEDGE_CUST_')) {
            const id = data.replace('GUEST_KNOWLEDGE_CUST_', '');
            const item = (settings.knowledgeBaseItems || []).find(c => c.id === id);
            if (!item) return sendFn(userId, "❌ یافت نشد.");
            return sendFn(userId, `📌 *${item.title}*\n\n${item.content}`, { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'GUEST_COMPANY_INFO' }]] } });
        }
        
        if (data === 'GUEST_SHOW_ID') {
             return sendFn(userId, `🆔 شناسه چت شما: \`${userId}\``, {
                reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'GUEST_MAIN' }]] }
            });
        }

        return;
    }

    if (!user) {
        if (isGroup) return; // Silent in groups
        return sendFn(userId, `⛔ امکان انجام این عملیات وجود ندارد. شناسه شما (\`${userId}\`) ثبت نشده است.`);
    }

    // --- NAVIGATION ---
    if (data.startsWith('MENU_') || data === 'SALES_FIN_REPORTS' || data === 'SAYAN_REPORTS_MENU') {
        if (isGroup) return; // Silent in groups
        session.state = 'IDLE';
        if (data === 'MENU_MAIN') return sendFn(chatId, "🏠 منوی اصلی:", { reply_markup: KEYBOARDS.MAIN });
        if (data === 'MENU_PAY') return sendFn(chatId, "💰 مدیریت پرداخت:", { reply_markup: KEYBOARDS.PAYMENT });
        if (data === 'MENU_EXIT') return sendFn(chatId, "🚛 مدیریت خروج:", { reply_markup: KEYBOARDS.EXIT });
        if (data === 'MENU_WH') return sendFn(chatId, "📦 مدیریت انبار:", { reply_markup: KEYBOARDS.WAREHOUSE });
        if (data === 'MENU_TRADE') return sendFn(chatId, "🌍 مدیریت بازرگانی:", { reply_markup: KEYBOARDS.TRADE });
        if (data === 'MENU_SEC') {
            const isSecAdmin = user && (user.role === 'admin' || user.role === 'ceo' || user.canManageSecretariatSettings);
            const hasSecAccess = user && (isSecAdmin || user.canAccessSecretariat);
            if (!hasSecAccess) {
                return sendFn(chatId, "⛔ شما به دبیرخانه اداری دسترسی ندارید. لطفا با مدیر سیستم تماس بگیرید.");
            }
            return sendFn(chatId, "📂 دبیرخانه اداری:\nلطفاً یکی از گزینه‌های زیر را انتخاب کنید:", { reply_markup: KEYBOARDS.SECRETARIAT });
        }
        
        if (data === 'MENU_SALES') {
            session.lastFinMenu = 'MENU_SALES';
            return sendFn(chatId, "🛒 مدیریت فروش:", { reply_markup: KEYBOARDS.SALES });
        }
        
        if (data === 'MENU_REPORTS') {
            session.lastFinMenu = 'MENU_REPORTS';
            return sendFn(chatId, "📊 گزارشات مدیریتی:", { reply_markup: KEYBOARDS.REPORTS });
        }

        if (data === 'SAYAN_REPORTS_MENU' || data === 'SALES_FIN_REPORTS') {
            if (!hasSayanReportsAccess(user)) {
                return sendFn(chatId, "❌ شما دسترسی لازم جهت دریافت گزارشات مالی و ERP سایان را ندارید.");
            }
            session.lastFinMenu = 'SAYAN_REPORTS_MENU';
            const userKb = getSayanReportsKeyboard(user);
            return sendFn(chatId, "🏢 *گزارشات و اطلاعات مالی ERP سایان*\n\nلطفاً یکی از گزینه‌های تخصصی زیر را انتخاب نمایید:", { reply_markup: userKb, parse_mode: 'Markdown' });
        }
    }

    // --- SECRETARIAT ACTIONS ---
    if (data.startsWith('SEC_')) {
        const isSecAdmin = user && (user.role === 'admin' || user.role === 'ceo' || user.canManageSecretariatSettings);
        const hasSecAccess = user && (isSecAdmin || user.canAccessSecretariat);
        if (!hasSecAccess) {
            return sendFn(chatId, "⛔ شما به دبیرخانه اداری دسترسی ندارید.");
        }

        if (data === 'SEC_PENDING') {
            const letters = db.secretariatLetters || [];
            const pending = letters.filter(l => 
                l.status === 'PENDING' && 
                (l.referredTo || []).includes(user.id) && 
                !(l.approvedBy || []).includes(user.id)
            );
            
            if (pending.length === 0) {
                return sendFn(chatId, "📥 هیچ نامه منتظر تایید یا امضایی برای شما یافت نشد.", {
                    reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'MENU_SEC' }]] }
                });
            }
            
            await sendFn(chatId, `📥 تعداد ${pending.length} نامه منتظر اقدام شما یافت شد:`);
            for (const l of pending) {
                const inline_keyboard = [
                    [
                        { text: '📥 دریافت PDF', callback_data: `SEC_GET_PDF_${l.id}` },
                        { text: '📥 دریافت Word', callback_data: `SEC_GET_DOC_${l.id}` }
                    ],
                    [{ text: '✍️ تایید و امضای واقعی', callback_data: `SEC_APPROVE_${l.id}` }]
                ];
                
                const msg = `✉️ *نامه شماره ${l.letterNumber}*\n` +
                            `📅 تاریخ: ${l.date}\n` +
                            `👤 فرستنده: ${l.sender}\n` +
                            `👥 گیرنده: ${l.receiver}\n` +
                            `📝 موضوع: ${l.subject}\n` +
                            `------------------\n` +
                            `خلاصه: ${l.content ? l.content.slice(0, 100) + '...' : 'بدون متن'}`;
                            
                await sendFn(chatId, msg, { reply_markup: { inline_keyboard } });
            }
            return;
        }

        if (data === 'SEC_CARTABLE_LATEST') {
            const letters = db.secretariatLetters || [];
            const myLetters = letters.filter(l => userHasLetterAccess(user, l, db)).slice(0, 5);
            
            if (myLetters.length === 0) {
                return sendFn(chatId, "📂 کارتابل شما خالی است.", {
                    reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'MENU_SEC' }]] }
                });
            }
            
            await sendFn(chatId, `📂 آخرین نامه‌های کارتابل شما:`);
            for (const l of myLetters) {
                const inline_keyboard = [
                    [
                        { text: '📥 دریافت PDF', callback_data: `SEC_GET_PDF_${l.id}` },
                        { text: '📥 دریافت Word', callback_data: `SEC_GET_DOC_${l.id}` }
                    ]
                ];
                
                const msg = `✉️ *نامه شماره ${l.letterNumber}*\n` +
                            `📅 تاریخ: ${l.date}\n` +
                            `👤 فرستنده: ${l.sender}\n` +
                            `👥 گیرنده: ${l.receiver}\n` +
                            `📝 موضوع: ${l.subject}\n` +
                            `وضعیت: ${l.status === 'APPROVED' ? '✅ تایید شده' : l.status === 'REJECTED' ? '❌ رد شده' : '⏳ در حال بررسی'}`;
                            
                await sendFn(chatId, msg, { reply_markup: { inline_keyboard } });
            }
            return;
        }

        if (data === 'SEC_SEARCH') {
            session.state = 'SEC_WAIT_SEARCH_QUERY';
            return sendFn(chatId, "🔍 لطفا کلمه کلیدی، شماره نامه، موضوع یا فرستنده مورد نظر خود را ارسال کنید:", {
                reply_markup: { inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'MENU_SEC' }]] }
            });
        }

        if (data === 'SEC_NEW_LETTER_FLOW') {
            session.state = 'SEC_WAIT_FILE';
            session.data = {};
            return sendFn(chatId, "📥 لطفا فایل ضمیمه نامه اداری جدید (PDF یا Word/DOCX) را با فرمت Document ارسال کنید:", {
                reply_markup: { inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'MENU_SEC' }]] }
            });
        }

        if (data.startsWith('SEC_GET_PDF_') || data.startsWith('SEC_GET_DOC_')) {
            const isPdf = data.startsWith('SEC_GET_PDF_');
            const letterId = data.replace(isPdf ? 'SEC_GET_PDF_' : 'SEC_GET_DOC_', '');
            const letters = db.secretariatLetters || [];
            const letter = letters.find(l => l.id === letterId);
            
            if (!letter) return sendFn(chatId, "❌ نامه یافت نشد.");
            if (!userHasLetterAccess(user, letter, db)) {
                return sendFn(chatId, "⛔ شما به این نامه دسترسی ندارید.");
            }
            
            await sendFn(chatId, `⏳ در حال تولید فایل ${isPdf ? 'PDF' : 'Word'} نامه...`);
            try {
                const company = (settings.companies || []).find(c => c.id === letter.companyId);
                const companyName = company ? company.name : '';
                const companySettings = (db.secretariatSettings || []).find(s => s.companyId === letter.companyId);
                
                if (isPdf) {
                    const buf = await Renderer.generateSecretariatLetterPDF(letter, companyName, companySettings);
                    const filename = `Letter_${letter.letterNumber.replace(/[\/\\]/g, '_')}.pdf`;
                    await sendDocFn(chatId, buf, filename, `📄 فایل PDF رسمی نامه شماره ${letter.letterNumber}`);
                } else {
                    const buf = await Renderer.generateSecretariatLetterDoc(letter, companyName, companySettings);
                    const filename = `Letter_${letter.letterNumber.replace(/[\/\\]/g, '_')}.doc`;
                    await sendDocFn(chatId, buf, filename, `📝 فایل Word رسمی نامه شماره ${letter.letterNumber}`);
                }
            } catch (e) {
                console.error("Bot export letter error:", e);
                await sendFn(chatId, "❌ خطا در تولید یا ارسال فایل نامه اداری.");
            }
            return;
        }

        if (data.startsWith('SEC_APPROVE_')) {
            const letterId = data.replace('SEC_APPROVE_', '');
            const letters = db.secretariatLetters || [];
            const letterIdx = letters.findIndex(l => l.id === letterId);
            
            if (letterIdx === -1) return sendFn(chatId, "❌ نامه یافت نشد.");
            const letter = letters[letterIdx];
            
            if (!(letter.referredTo || []).includes(user.id)) {
                return sendFn(chatId, "⛔ این نامه به شما ارجاع داده نشده است.");
            }
            
            if ((letter.approvedBy || []).includes(user.id)) {
                return sendFn(chatId, "⚠️ شما قبلاً این نامه را تایید کرده‌اید.");
            }
            
            if (!user.signatureUrl) {
                return sendFn(chatId, "⚠️ تصویر امضای واقعی شما در پروفایلتان بارگذاری نشده است. لطفاً ابتدا از منوی کاربران در پنل وب نسبت به آپلود امضا اقدام کنید.");
            }
            
            const currentApprovers = letter.approvedBy || [];
            const currentSignatures = letter.signatureImageUrls || [];
            
            letter.approvedBy = [...currentApprovers, user.id];
            letter.signatureImageUrls = [...currentSignatures, user.signatureUrl];
            letter.status = 'APPROVED';
            letter.updatedAt = Date.now();
            
            saveDb(db);
            await sendFn(chatId, `✅ نامه شماره ${letter.letterNumber} با موفقیت توسط امضای واقعی شما تایید و امضا شد.`);
            
            // Notify creator!
            const creator = db.users.find(u => u.fullName === letter.createdBy);
            if (creator) {
                const notifyMsg = `🔔 *امضای نامه دبیرخانه*:\n` +
                                  `نامه شماره ${letter.letterNumber} با موضوع "${letter.subject}" توسط *${user.fullName}* تایید و امضا شد.`;
                                  
                const baleModule = await import('./bale.js');
                const tgModule = await import('./telegram.js');
                if (creator.telegramChatId) {
                    try { await tgModule.sendBotMessage(creator.telegramChatId, notifyMsg); } catch(e){}
                }
                if (creator.baleChatId) {
                    try { await baleModule.sendBotMessage(creator.baleChatId, notifyMsg); } catch(e){}
                }
            }
            return;
        }

        if (data.startsWith('SEC_SET_CO_')) {
            const coId = data.replace('SEC_SET_CO_', '');
            session.data.companyId = coId;
            
            session.state = 'SEC_WAIT_SECTION';
            const inline_keyboard = [
                [
                    { text: '🏢 دفتر مرکزی', callback_data: 'SEC_SET_SEC_hq' },
                    { text: '🏭 کارخانه', callback_data: 'SEC_SET_SEC_fc' }
                ],
                [{ text: '❌ انصراف', callback_data: 'MENU_SEC' }]
            ];
            
            const company = (settings.companies || []).find(c => c.id === coId);
            return sendFn(chatId, `🏢 شرکت انتخاب شد: *${company ? company.name : ''}*\n\n📍 لطفا بخش مربوط به این نامه اداری را مشخص کنید:`, {
                reply_markup: { inline_keyboard }
            });
        }
        
        if (data.startsWith('SEC_SET_SEC_')) {
            const isHq = data === 'SEC_SET_SEC_hq';
            session.data.section = isHq ? 'headquarters' : 'factory';
            
            session.state = 'SEC_WAIT_SENDER';
            return sendFn(chatId, `📍 بخش انتخاب شد: *${isHq ? 'دفتر مرکزی' : 'کارخانه'}*\n\n👤 لطفا نام فرستنده نامه را ارسال کنید (مثال: شرکت پارس، یا نام شخص):`);
        }
    }

    // Knowledge Base logic
    if (data === 'ACT_KNOWLEDGE') {
        const companies = settings.companies || [];
        const customItems = settings.knowledgeBaseItems || [];
        
        if (companies.length === 0 && customItems.length === 0) {
            return sendFn(chatId, "ℹ️ هیچ اطلاعاتی ثبت نشده است.", { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]] } });
        }
        
        const btns = [];
        companies.forEach(c => {
            btns.push([{ text: `🏢 شرکت/فرد: ${c.name}`, callback_data: `KNOWLEDGE_CO_${c.id}` }]);
        });
        customItems.forEach(c => {
            btns.push([{ text: `📄 یادداشت: ${c.title}`, callback_data: `KNOWLEDGE_CUST_${c.id}` }]);
        });
        btns.push([{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]);
        
        return sendFn(chatId, "ℹ️ اطلاعات شرکت و حساب‌ها\nموردی را برای مشاهده انتخاب کنید:", { reply_markup: { inline_keyboard: btns } });
    }

    if (data.startsWith('KNOWLEDGE_CO_')) {
        const id = data.replace('KNOWLEDGE_CO_', '');
        const company = (settings.companies || []).find(c => c.id === id);
        if (!company) return sendFn(chatId, "❌ یافت نشد.");
        
        let text = `📌 *مشخصات ${company.name}*\n\n`;
        if (company.nationalId) text += `▫️ شناسه ملی: \`${company.nationalId}\`\n`;
        if (company.registrationNumber) text += `▫️ شماره ثبت: \`${company.registrationNumber}\`\n`;
        if (company.phone) text += `▫️ تلفن: \`${company.phone}\`\n`;
        if (company.address) text += `▫️ آدرس: ${company.address}\n`;
        
        const btns = [];
        if (company.banks && company.banks.length > 0) {
            text += `\n*برای مشاهده اطلاعات کامل هر حساب، روی دکمه‌های زیر کلیک کنید:*`;
            company.banks.forEach(b => {
                btns.push([{ text: `🏦 ${b.bankName} (${b.accountNumber.slice(-4)})`, callback_data: `KNOW_BANK_${company.id}_${b.id}` }]);
            });
        } else {
            text += `\n⚠️ (حساب بانکی ثبت نشده)\n`;
        }
        
        btns.push([{ text: '🔙 بازگشت', callback_data: 'ACT_KNOWLEDGE' }]);
        return sendFn(chatId, text, { reply_markup: { inline_keyboard: btns } });
    }

    if (data.startsWith('KNOW_BANK_')) {
        const parts = data.replace('KNOW_BANK_', '').split('_');
        const companyId = parts[0];
        const bankId = parts[1];
        
        const company = (settings.companies || []).find(c => c.id === companyId);
        if (!company) return sendFn(chatId, "❌ یافت نشد.");
        
        const bank = (company.banks || []).find(b => b.id === bankId);
        if (!bank) return sendFn(chatId, "❌ یافت نشد.");
        
        let text = `💳 *اطلاعات حساب بانکی*\n\n`;
        text += `👤 صاحب حساب: *${company.name}*\n`;
        text += `🏦 بانک: *${bank.bankName}*\n`;
        text += `🔸 شماره حساب: \`${bank.accountNumber}\`\n`;
        if (bank.cardNumber) text += `🔸 شماره کارت: \`${bank.cardNumber}\`\n`;
        if (bank.sheba) text += `🔸 شبا: \`IR${bank.sheba.replace(/^IR/i, '')}\`\n`;
        
        return sendFn(chatId, text, { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: `KNOWLEDGE_CO_${company.id}` }]] } });
    }

    if (data.startsWith('KNOWLEDGE_CUST_')) {
        const id = data.replace('KNOWLEDGE_CUST_', '');
        const item = (settings.knowledgeBaseItems || []).find(c => c.id === id);
        if (!item) return sendFn(chatId, "❌ یافت نشد.");
        
        const text = `📌 *${item.title}*\n\n${item.content || '...'}`;
        return sendFn(chatId, text, { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'ACT_KNOWLEDGE' }]] } });
    }

    // Sales logic
    if (data === 'ACT_SEND_CO_INFO') {
        const keyboard = [
            [{ text: '📢 ارسال همه موارد', callback_data: 'SEND_INFO_ALL' }],
            [{ text: '📍 آدرس و تلفن', callback_data: 'SEND_INFO_ADDR' }],
            [{ text: '💳 اطلاعات بانکی', callback_data: 'SEND_INFO_BANK' }],
            [{ text: '🏢 درباره شرکت', callback_data: 'SEND_INFO_ABOUT' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_SALES' }]
        ];
        return sendFn(chatId, "🏢 کدام اطلاعات را مایلید برای مشتری ارسال کنم؟\nپس از انتخاب، روی پیام ارسال شده ریپلای کنید و شناسه مشتری را وارد کنید.", { reply_markup: { inline_keyboard: keyboard } });
    }

    if (data.startsWith('SEND_INFO_')) {
        const type = data.replace('SEND_INFO_', '');
        const parts = [];
        if (type === 'ALL' || type === 'ABOUT') if (settings.botCompanyInfo) parts.push(`ℹ️ *درباره ما:*\n${settings.botCompanyInfo}`);
        if (type === 'ALL' || type === 'ADDR') {
            if (settings.companyAddress) parts.push(`📍 *آدرس:*\n${settings.companyAddress}`);
            if (settings.companyPhone) parts.push(`📞 *شماره تماس:*\n${settings.companyPhone}`);
        }
        if (type === 'ALL' || type === 'BANK') if (settings.companyBank) parts.push(`💳 *اطلاعات حساب:*\n${settings.companyBank}`);
        
        const infoMsg = parts.length > 0 ? parts.join('\n\n') : "اطلاعاتی ثبت نشده است.";
        return sendFn(chatId, `🏢 *اطلاعات شرکت:*\n\n${infoMsg}\n\nجهت ارسال به مشتری، روی این پیام ریپلی (Reply) کرده و کد پیگیری یا شناسه مشتری را وارد کنید.`);
    }

    if (data === 'SALES_BROADCAST') {
        if (!['admin', 'sales_manager'].includes(user.role)) return sendFn(chatId, "⛔ دسترسی ندارید.");
        session.state = 'SALES_WAIT_BROADCAST_MSG';
        return sendFn(chatId, "📢 پیام خود را برای ارسال به همه کاربران وارد کنید:");
    }

    if (data === 'SALES_LIST_ALL') {
        const products = db.products || [];
        if (products.length === 0) return sendFn(chatId, "❌ لیست قیمت در حال حاضر خالی است.");
        let res = "📢 *لیست کامل قیمت*\n\n";
        
        const grouped = {};
        products.forEach(p => {
            const g = p.group || 'بدون گروه';
            const sg = p.subgroup || 'سایر';
            if (!grouped[g]) grouped[g] = {};
            if (!grouped[g][sg]) grouped[g][sg] = [];
            grouped[g][sg].push(p);
        });

        Object.keys(grouped).sort().forEach(g => {
            res += `📁 *${g}*\n`;
            Object.keys(grouped[g]).sort().forEach(sg => {
                res += `   🔹 *${sg}*\n`;
                grouped[g][sg].forEach(p => {
                    const price = p.hidePrice ? "تماس" : p.price.toLocaleString();
                    res += `      ▫️ ${p.name}: ${price}\n`;
                });
            });
            res += "\n";
        });
        return sendFn(chatId, res, { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'MENU_SALES' }]] } });
    }

    if (data === 'SALES_SEARCH') {
        session.state = 'SALES_WAIT_SEARCH_QUERY';
        return sendFn(chatId, "🔎 نام کالا یا کد کالا را وارد کنید:", { reply_markup: { inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'MENU_SALES' }]] } });
    }

    if (data === 'SALES_CUSTOMER_BALANCES') {
        const perms = settings ? getRolePermissions(user?.role, settings, user) : {};
        const isAuthorized = user && (['admin', 'financial', 'ceo', 'manager', 'sales_manager'].includes(user.role) || perms.canViewCustomerBalances === true || hasSayanReportsAccess(user, 'balances'));
        if (!isAuthorized) {
            return sendFn(chatId, "⚠️ شما دسترسی به بخش مانده حساب مشتریان را ندارید.", { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'MENU_SALES' }]] } });
        }
        
        session.state = 'IDLE';
        
        const inline_keyboard = [
            [
                { text: '🔴 دانلود بدهکاران (PDF)', callback_data: 'SALES_BAL_DOWNLOAD_DEBTORS' },
                { text: '🟢 دانلود بستانکاران (PDF)', callback_data: 'SALES_BAL_DOWNLOAD_CREDITORS' }
            ],
            [
                { text: '📊 دانلود بدهکاران (Excel)', callback_data: 'SALES_BAL_DOWNLOAD_DEBTORS_XLSX' },
                { text: '📈 دانلود بستانکاران (Excel)', callback_data: 'SALES_BAL_DOWNLOAD_CREDITORS_XLSX' }
            ],
            [
                { text: '🔍 جستجوی مشتری (خاص)', callback_data: 'SALES_BAL_SPECIFIC_SEARCH' }
            ],
            [
                { text: '🔙 بازگشت', callback_data: session.lastFinMenu === 'MENU_REPORTS' ? 'MENU_REPORTS' : (session.lastFinMenu || 'MENU_SALES') }
            ]
        ];
        
        return sendFn(chatId, "💰 *منوی استعلام مانده حساب مشتریان*\n\nلطفاً یکی از گزینه‌های زیر را جهت عملکرد سیستم انتخاب نمایید:", { reply_markup: { inline_keyboard } });
    }

    if (data === 'SALES_BAL_SPECIFIC_SEARCH') {
        session.state = 'FIN_WAIT_CUSTOMER_BALANCE_SEARCH';
        return sendFn(chatId, "🔍 لطفاً نام مشتری یا کد حسابداری وی را جهت استعلام وارد نمایید:", { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'SALES_CUSTOMER_BALANCES' }]] } });
    }

    if (data === 'SALES_BAL_DOWNLOAD_DEBTORS' || data === 'SALES_BAL_DOWNLOAD_CREDITORS') {
        const isDebtors = data === 'SALES_BAL_DOWNLOAD_DEBTORS';
        const rawList = await getCustomerBalancesData(db);
        const filtered = rawList
            .filter(b => isDebtors ? b.type === 'بدهکار' : b.type === 'بستانکار')
            .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));
        
        if (filtered.length === 0) {
            return sendFn(chatId, `⚠️ هیچ رکوردی برای لیست ${isDebtors ? "بدهکاران" : "بستانکاران"} یافت نشد.`, { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'SALES_CUSTOMER_BALANCES' }]] } });
        }
        
        sendFn(chatId, "⏳ در حال تولید فایل PDF گزارش... لطفاً شکیبا باشید.");
        
        const title = isDebtors ? 'گزارش مشتریان بدهکار (طلبکار از آنها)' : 'گزارش مشتریان بستانکار (بدهکار به آنها)';
        const columns = ['کد حسابداری', 'نام مشتری', 'مانده حساب (ریال)', 'نوع'];
        const rows = filtered.map(b => [
            b.accountCode || '',
            b.name || '',
            Number(b.balance || 0).toLocaleString('fa-IR'),
            b.type || (Number(b.balance || 0) > 0 ? 'بدهکار' : 'بستانکار')
        ]);
        
        try {
            const pdfBuffer = await Renderer.generateReportPDF(title, columns, rows);
            const filename = `Report_${isDebtors ? 'Debtors' : 'Creditors'}_${Date.now()}.pdf`;
            await sendDocFn(chatId, pdfBuffer, filename, `📄 ${title}\nتعداد مشتریان: ${filtered.length}\n📅 تاریخ گزارش: ${toShamsiFull(new Date())}`);
        } catch (err) {
            console.error(err);
            sendFn(chatId, "❌ متاسفانه در تولید فایل گزارش خطایی رخ داد.");
        }
        return;
    }

    if (data === 'SALES_BAL_DOWNLOAD_DEBTORS_XLSX' || data === 'SALES_BAL_DOWNLOAD_CREDITORS_XLSX') {
        const isDebtors = data === 'SALES_BAL_DOWNLOAD_DEBTORS_XLSX';
        const rawList = await getCustomerBalancesData(db);
        const filtered = rawList
            .filter(b => isDebtors ? b.type === 'بدهکار' : b.type === 'بستانکار')
            .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0));
        
        if (filtered.length === 0) {
            return sendFn(chatId, `⚠️ هیچ رکوردی برای لیست ${isDebtors ? "بدهکاران" : "بستانکاران"} یافت نشد.`, { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'SALES_CUSTOMER_BALANCES' }]] } });
        }
        
        sendFn(chatId, "⏳ در حال تولید فایل اکسل گزارش... لطفاً منتظر بمانید.");
        
        const columns = ['کد حسابداری', 'نام مشتری', 'مانده حساب (ریال)', 'نوع'];
        const rows = filtered.map(b => [
            b.accountCode || '',
            b.name || '',
            Number(b.balance || 0),
            b.type || (Number(b.balance || 0) > 0 ? 'بدهکار' : 'بستانکار')
        ]);
        
        try {
            const buffer = generateExcelBuffer(columns, rows, isDebtors ? "Debtors" : "Creditors");
            const filename = `Report_${isDebtors ? 'Debtors' : 'Creditors'}_${Date.now()}.xlsx`;
            await sendDocFn(chatId, buffer, filename, `📊 گزارش اکسل ${isDebtors ? 'مشتریان بدهکار' : 'مشتریان بستانکار'}`);
        } catch (err) {
            console.error(err);
            sendFn(chatId, "❌ خطا در تولید یا ارسال فایل اکسل.");
        }
        return;
    }

    if (data.startsWith('SALES_BAL_VIEW_')) {
        const code = data.replace('SALES_BAL_VIEW_', '');
        const rawList = await getCustomerBalancesData(db);
        const rec = rawList.find(b => matchAccountCode(b.accountCode, code));
        
        if (!rec) {
            return sendFn(chatId, "❌ مشتری یافت نشد.", { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'SALES_CUSTOMER_BALANCES' }]] } });
        }
        
        const balanceStr = Number(rec.balance).toLocaleString('fa-IR');
        const updateStr = new Date(rec.updatedAt || Date.now()).toLocaleDateString('fa-IR');
        
        let msg = `👤 *مشخصات مشتری*\n\n`;
        msg += `👤 *نام:* ${rec.name}\n`;
        msg += `🔢 *کد حسابداری:* \`${rec.accountCode}\`\n`;
        msg += `💰 *مانده حساب:* *${balanceStr}* ریال (${rec.type})\n`;
        msg += `📅 *آخرین بروزرسانی:* ${updateStr}\n\n`;
        
        const statements = db.customerStatements || [];
        const hasStatement = statements.some(s => matchAccountCode(s.accountCode, code));
        
        const kb = [
            [
                { text: '📄 دانلود آخرین صورتحساب تفصیلی (Excel/PDF)', callback_data: `SALES_BAL_STMT_DOWNLOAD_${code}` }
            ],
            [
                { text: '📥 دانلود فرم تاییدیه حساب (PDF)', callback_data: `SALES_BAL_MAKE_CONFIRMATION_${code}` }
            ],
            [
                { text: '🔍 جستجوی مجدد', callback_data: 'SALES_BAL_SPECIFIC_SEARCH' },
                { text: '🔙 منوی قبلی', callback_data: 'SALES_CUSTOMER_BALANCES' }
            ]
        ];
        
        if (!hasStatement) {
            kb.shift();
        }
        
        return sendFn(chatId, msg, { reply_markup: { inline_keyboard: kb } });
    }

    if (data.startsWith('SALES_BAL_STMT_DOWNLOAD_')) {
        const code = data.replace('SALES_BAL_STMT_DOWNLOAD_', '');
        const statements = db.customerStatements || [];
        const matched = statements
            .filter(s => matchAccountCode(s.accountCode, code))
            .sort((a, b) => b.uploadedAt - a.uploadedAt);
            
        if (matched.length > 0) {
            const stmt = matched[0];
            try {
                await sendFn(chatId, `🔄 در حال دریافت آخرین صورتحساب پیوست مالی شما با شناسه \`${stmt.id}\`... منتظر بمانید.`);
                const fileBuffer = Buffer.from(stmt.fileData, 'base64');
                await sendDocFn(chatId, fileBuffer, stmt.fileName, `📄 صورتحساب تفصیلی تفکیک شده حسابداری: ${stmt.fileName}`);
                return;
            } catch (e) {
                console.error("Statement sendDocFn error: ", e);
                return sendFn(chatId, `❌ خطایی در ارسال فایل صورتحساب رخ داد.`);
            }
        } else {
            return sendFn(chatId, `⚠️ صورتحساب بارگذاری‌شده‌ای برای کد حسابداری شما یافت نشد.`, { reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: `SALES_BAL_VIEW_${code}` }]] } });
        }
    }

    if (data.startsWith('SALES_BAL_MAKE_CONFIRMATION_')) {
        const code = data.replace('SALES_BAL_MAKE_CONFIRMATION_', '');
        const rawList = await getCustomerBalancesData(db);
        const rec = rawList.find(b => matchAccountCode(b.accountCode, code));
        
        if (!rec) {
            return sendFn(chatId, "❌ مشتری یافت نشد.");
        }
        
        sendFn(chatId, "⏳ در حال تولید تاییدیه حساب... لطفاً کمی صبر کنید.");
        
        const title = 'فرم رسمی تاییدیه مانده حساب';
        const columns = ['ردیف', 'مشخصه حساب', 'جزئیات ثبتی'];
        const rows = [
            ['۱', 'نام کامل مشتری / شرکت', rec.name || ''],
            ['۲', 'شناسه / کد حسابداری', rec.accountCode || ''],
            ['۳', 'نوع طلب/بدهی شرکت', rec.type || (Number(rec.balance || 0) > 0 ? 'بدهکار' : 'بستانکار')],
            ['۴', 'مبلغ کل مانده به ریال', Number(rec.balance || 0).toLocaleString('fa-IR')],
            ['۵', 'مبنای ثبت تاریخی', toShamsiFull(new Date(rec.updatedAt || Date.now()))],
            ['۶', 'تاریخ رسمی استعلام سیستم', toShamsiFull(new Date())]
        ];
        
        try {
            const pdfBuffer = await Renderer.generateReportPDF(title, columns, rows);
            const filename = `Confirmation_${code}_${Date.now()}.pdf`;
            await sendDocFn(chatId, pdfBuffer, filename, `📥 فرم رسمی تاییدیه حساب صادر شده از طرف شرکت جهت استعلام مانده حساب مشتری گرامی.`);
        } catch (err) {
            console.error(err);
            sendFn(chatId, "❌ متاسفانه خطایی در ساخت تاییدیه حساب پیش آمد.");
        }
        return;
    }

    if (data === 'SALES_GROUPS') {
        const products = db.products || [];
        const groups = [...new Set(products.map(p => p.group || 'بدون گروه'))].sort();
        const buttons = groups.map(g => [{ text: `📁 ${g}`, callback_data: `SALES_GROUP_${g}` }]);
        buttons.push([{ text: '🔙 بازگشت', callback_data: 'MENU_SALES' }]);
        return sendFn(chatId, "🔖 انتخاب گروه کالا:", { reply_markup: { inline_keyboard: buttons } });
    }

    if (data.startsWith('SALES_GROUP_')) {
        const group = data.replace('SALES_GROUP_', '');
        const products = (db.products || []).filter(p => (p.group || 'بدون گروه') === group);
        const subgroups = [...new Set(products.map(p => p.subgroup || 'سایر'))].sort();

        const buttons = subgroups.map(sg => [
            { text: `🔹 ${sg}`, callback_data: `SALES_SUB|${group}|${sg}` }
        ]);
        buttons.push([{ text: '🔙 انتخاب گروه دیگر', callback_data: 'SALES_GROUPS' }]);

        return sendFn(chatId, `📁 *گروه: ${group}*\nلطفاً زیرگروه را انتخاب کنید:`, { reply_markup: { inline_keyboard: buttons } });
    }

    if (data.startsWith('SALES_SUB|')) {
        const parts = data.split('|');
        const group = parts[1];
        const subgroup = parts[2];
        const products = (db.products || []).filter(p => (p.group || 'بدون گروه') === group && (p.subgroup || 'سایر') === subgroup);
        
        let res = `📁 ${group} > 🔹 ${subgroup}\n\n`;
        products.forEach(p => {
            res += formatProduct(p) + "------------------\n";
        });
        
        return sendFn(chatId, res, { reply_markup: { inline_keyboard: [[{ text: '🔙 انتخاب زیرگروه دیگر', callback_data: `SALES_GROUP_${group}` }], [{ text: '🔙 منوی اصلی فروش', callback_data: 'MENU_SALES' }]] } });
    }
    // --- NEW: SEARCH BY ID INIT ---
    if (['ACT_SEARCH_ID_PAY', 'ACT_SEARCH_ID_EXIT', 'ACT_SEARCH_ID_WH'].includes(data)) {
        let type = 'PAYMENT';
        if (data === 'ACT_SEARCH_ID_EXIT') type = 'EXIT';
        if (data === 'ACT_SEARCH_ID_WH') type = 'WH_BIJAK';
        
        session.data.targetType = type;
        session.state = 'WAIT_FOR_SEARCH_ID';
        return sendFn(chatId, "🔢 شماره سند / حواله / بیجک را وارد کنید:");
    }

    // --- MANAGEMENT REPORTS HANDLERS ---
    if (data === 'BOT_SAYAN_PENDING_DOCS') {
        if (!hasSayanReportsAccess(user, 'pending')) {
            return sendFn(chatId, "❌ شما دسترسی لازم جهت دریافت گزارش اسناد آویزان سایان را ندارید.");
        }

        await sendFn(chatId, "⏳ در حال استعلام و استخراج اسناد و چک‌های آویزان از سرور سایان... لطفا شکیبا باشید.");

        try {
            let rows = [];
            if (db.settings?.sayanApiUrl) {
                try {
                    const sql = `
                        SELECT 
                            Field_001 as Id,
                            Field_005 as ChequeNo,
                            Field_006 as DueDate,
                            Field_009 as BankName,
                            Field_011 as DrawerName,
                            Field_013 as Amount,
                            Field_015 as StatusDesc
                        FROM BUR_TBL_012
                        ORDER BY Field_006 ASC
                    `;
                    rows = await runSayanQuery(db, sql);
                } catch (err) {
                    console.error("Sayan query error for pending docs:", err);
                }
            }

            let totalAmt = 0;
            let tableRows = [];

            if (rows && rows.length > 0) {
                tableRows = rows.map((r, idx) => {
                    const amt = parseFloat(r.Amount || 0);
                    totalAmt += amt;
                    return [
                        (idx + 1).toLocaleString('fa-IR'),
                        r.ChequeNo || String(r.Id || '-'),
                        r.DueDate || '-',
                        r.DrawerName || 'نامشخص',
                        r.BankName || '-',
                        amt.toLocaleString('fa-IR'),
                        r.StatusDesc || 'آویزان / در جریان'
                    ];
                });
            } else {
                // Fallback to local cheque receipts or pending records
                const localCheques = db.chequeReceipts || [];
                tableRows = localCheques.map((c, idx) => {
                    const amt = parseFloat(c.amount || 0);
                    totalAmt += amt;
                    return [
                        (idx + 1).toLocaleString('fa-IR'),
                        c.chequeNumber || '-',
                        c.dueDate || '-',
                        c.payerName || '-',
                        c.bankName || '-',
                        amt.toLocaleString('fa-IR'),
                        'آویزان / نزد صندوق'
                    ];
                });
            }

            if (tableRows.length === 0) {
                return sendFn(chatId, "⚠️ هیچ سند یا چک آویزانی در سیستم یافت نشد.", {
                    reply_markup: { inline_keyboard: [[{ text: '🔙 بازگشت', callback_data: 'SAYAN_REPORTS_MENU' }]] }
                });
            }

            tableRows.push([
                'جمع کل',
                '-',
                '-',
                '-',
                '-',
                totalAmt.toLocaleString('fa-IR'),
                '-'
            ]);

            const title = `گزارش اسناد و چک‌های آویزان سایان ERP - ${toShamsiFull(new Date())}`;
            const columns = ["ردیف", "شماره چک / سند", "سررسید / تاریخ", "صادرکننده / طرف حساب", "بانک / شعبه", "مبلغ (ریال)", "وضعیت سند / چک"];
            const pdfBuffer = await Renderer.generateReportPDF(title, columns, tableRows);
            const filename = `Sayan_Pending_Docs_${getTehranDateString()}.pdf`;

            await sendDocFn(chatId, pdfBuffer, filename, `📜 *گزارش رسمی اسناد و چک‌های آویزان سایان ERP*\n\n📊 تعداد ردیف‌ها: ${(tableRows.length - 1).toLocaleString('fa-IR')}\n💰 مجموع مبلغ: ${totalAmt.toLocaleString('fa-IR')} ریال`);
        } catch (err) {
            console.error("Bot Pending Docs Error:", err);
            sendFn(chatId, `❌ خطا در استعلام اسناد آویزان: ${err.message}`);
        }
        return;
    }

    if (data === 'BOT_SAYAN_DAILY_SALES') {
        if (!hasSayanReportsAccess(user, 'daily_sales')) {
            return sendFn(chatId, "❌ شما دسترسی لازم جهت دریافت گزارش فاکتور فروش روزانه سایان را ندارید.");
        }
        
        await sendFn(chatId, "⏳ در حال استعلام اطلاعات فروش امروز از سرور سایان و تولید فرم چاپی... لطفا شکیبا باشید.");
        
        try {
            const todayStr = getTehranDateString();
            
            const sql = `
                SELECT 
                    t10.Field_005 as DocId,
                    t10.Field_006 as InvoiceNum,
                    t10.Field_008 as Date,
                    t10.Field_029 as Notes,
                    t11.Field_005 as ItemCode,
                    t22.Field_004 as ItemName,
                    t11.Field_006 as Quantity,
                    t11.Field_031 as ItemNotes,
                    t11.Field_007 as Amount,
                    t_group.GroupName,
                    t07.Field_006 as CustomerName
                FROM STR_TBL_010 t10
                INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                          AND t11.Field_003 = t10.Field_004
                LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
                LEFT JOIN (
                    SELECT t21_sub.Field_004 as ItemCode, MIN(COALESCE(t02_parent.Field_003, t02_sub.Field_003)) as GroupName
                    FROM IND_TBL_021 t21_sub
                    LEFT JOIN IND_TBL_002 t02_sub ON t21_sub.Field_003 = t02_sub.Field_008
                    LEFT JOIN IND_TBL_002 t02_parent ON t02_sub.Field_009 = t02_parent.Field_008
                    GROUP BY t21_sub.Field_004
                ) t_group ON t11.Field_005 = t_group.ItemCode
                LEFT JOIN ACT_TBL_007 t07 ON t10.Field_010 = t07.Field_005 AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
                WHERE t10.Field_009 IN ('3', '12', '23')
                  AND t11.Field_036 = t10.Field_009
                  AND t11.Field_007 IS NOT NULL AND t11.Field_007 > 0
                  AND (t10.Field_008 = '${todayStr}' OR t10.Field_008 LIKE '${todayStr}%' OR t10.Field_008 BETWEEN '${todayStr}T00:00:00.000Z' AND '${todayStr}T23:59:59.999Z')
                ORDER BY t10.Field_008 DESC
            `;
            
            const salesRows = await runSayanQuery(db, sql);
            
            if (salesRows.length === 0) {
                return sendFn(chatId, `⚠️ هیچ فاکتور فروشی برای امروز (${toShamsiFull(new Date())}) در سرور سایان ثبت نشده است.`);
            }
            
            const title = `گزارش رسمی فروش روزانه سایان - مورخ ${toShamsiFull(new Date())}`;
            const columns = ['ردیف', 'گروه کالا', 'نام کالا / محصول', 'جمع وزنی (ک‌گ)', 'جمع ریالی (ریال)'];
            
            const groupedMap = new Map();
            let totalQty = 0;
            let totalAmt = 0;
            
            salesRows.forEach(inv => {
                const key = `${inv.GroupName || ''}_${inv.ItemName || ''}`;
                const qty = parseFloat(inv.Quantity || 0);
                const amt = parseFloat(inv.Amount || 0);
                totalQty += qty;
                totalAmt += amt;
                
                if (groupedMap.has(key)) {
                    const existing = groupedMap.get(key);
                    existing.totalQty += qty;
                    existing.totalAmt += amt;
                } else {
                    groupedMap.set(key, {
                        itemName: inv.ItemName || 'کالای بدون نام',
                        groupName: inv.GroupName || 'سایر گروه‌ها',
                        totalQty: qty,
                        totalAmt: amt
                    });
                }
            });
            
            const groupedRows = Array.from(groupedMap.values());
            
            const tableRows = groupedRows.map((row, idx) => {
                return [
                    (idx + 1).toLocaleString('fa-IR'),
                    row.groupName,
                    row.itemName,
                    row.totalQty.toLocaleString('fa-IR'),
                    row.totalAmt.toLocaleString('fa-IR')
                ];
            });
            
            tableRows.push([
                'جمع کل',
                '-',
                '-',
                totalQty.toLocaleString('fa-IR'),
                totalAmt.toLocaleString('fa-IR')
            ]);
            
            const pdfBuffer = await Renderer.generateReportPDF(title, columns, tableRows);
            const filename = `Sayan_Daily_Sales_${todayStr}.pdf`;
            
            await sendDocFn(chatId, pdfBuffer, filename, `Sayan ERP 🧾 ${title}\n تعداد اقلام فروخته شده: ${groupedRows.length}\n مجموع مقدار: ${totalQty.toLocaleString('fa-IR')} کیلوگرم\n جمع مبلغ: ${totalAmt.toLocaleString('fa-IR')} ریال`);
        } catch (err) {
            console.error("Bot Daily Sales Error:", err);
            sendFn(chatId, `❌ خطا در تهیه گزارش فروش سایان: ${err.message}`);
        }
        return;
    }

    if (data === 'BOT_SAYAN_COMPARE_SALES') {
        if (!hasSayanReportsAccess(user, 'compare_sales')) {
            return sendFn(chatId, "❌ شما دسترسی لازم جهت دریافت گزارش مقایسه‌ای فروش سایان را ندارید.");
        }
        
        const kb = [
            [{ text: '🔄 مقایسه دیروز با امروز', callback_data: 'BOT_SAYAN_COMPARE_PRESETS_YESTERDAY_TODAY' }],
            [{ text: '📅 مقایسه این هفته با هفته قبل', callback_data: 'BOT_SAYAN_COMPARE_PRESETS_WEEK' }],
            [{ text: '🗓 مقایسه این ماه با ماه قبل', callback_data: 'BOT_SAYAN_COMPARE_PRESETS_MONTH' }],
            [{ text: '⌨️ ورود بازه زمانی دلخواه (تایپ)', callback_data: 'BOT_SAYAN_COMPARE_CUSTOM' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_REPORTS' }]
        ];
        return sendFn(chatId, "⚖️ *انتخاب بازه مقایسه فروش سایان*\nیکی از بازه‌های پیش‌فرض زیر را انتخاب کنید یا بازه زمانی دلخواه خود را وارد نمایید:", { reply_markup: { inline_keyboard: kb }, parse_mode: 'Markdown' });
    }

    if (data === 'BOT_SAYAN_COMPARE_PRESETS_YESTERDAY_TODAY') {
        const dateFromA = getTehranOffsetDateString(0);
        const dateToA = getTehranOffsetDateString(0);
        const dateFromB = getTehranOffsetDateString(1);
        const dateToB = getTehranOffsetDateString(1);
        await generateAndSendComparisonPDF(db, chatId, sendFn, sendDocFn, dateFromA, dateToA, dateFromB, dateToB, "امروز", "دیروز");
        return;
    }

    if (data === 'BOT_SAYAN_COMPARE_PRESETS_WEEK') {
        const dateFromA = getTehranOffsetDateString(6);
        const dateToA = getTehranOffsetDateString(0);
        const dateFromB = getTehranOffsetDateString(13);
        const dateToB = getTehranOffsetDateString(7);
        await generateAndSendComparisonPDF(db, chatId, sendFn, sendDocFn, dateFromA, dateToA, dateFromB, dateToB, "۷ روز اخیر", "۷ روز قبل از آن");
        return;
    }

    if (data === 'BOT_SAYAN_COMPARE_PRESETS_MONTH') {
        const dateFromA = getTehranOffsetDateString(29);
        const dateToA = getTehranOffsetDateString(0);
        const dateFromB = getTehranOffsetDateString(59);
        const dateToB = getTehranOffsetDateString(30);
        await generateAndSendComparisonPDF(db, chatId, sendFn, sendDocFn, dateFromA, dateToA, dateFromB, dateToB, "۳۰ روز اخیر", "۳۰ روز قبل از آن");
        return;
    }

    if (data === 'BOT_SAYAN_COMPARE_CUSTOM') {
        session.state = 'BOT_SAYAN_WAIT_COMPARE_DATES';
        return sendFn(chatId, "⌨️ *لطفاً بازه‌های مقایسه‌ای خود را دقیقاً با فرمت زیر به صورت تاریخ میلادی بنویسید:*\n\nتاریخ شروع بازه ۱, تاریخ پایان بازه ۱ | تاریخ شروع بازه ۲, تاریخ پایان بازه ۲\n\nالگوی نمونه:\n`2024-01-01, 2024-01-10 | 2024-02-01, 2024-02-10`", { reply_markup: { inline_keyboard: [[{ text: '🔙 انصراف', callback_data: 'BOT_SAYAN_COMPARE_SALES' }]] }, parse_mode: 'Markdown' });
    }

    if (data === 'RPT_DAILY') {
        const today = getTehranDateString(); // YYYY-MM-DD
        const shamsiToday = toShamsiFull(new Date());
        
        const payToday = db.orders.filter(o => o.date.startsWith(today));
        const totalPay = payToday.reduce((sum, o) => sum + o.totalAmount, 0);
        
        const exitToday = db.exitPermits.filter(p => p.date.startsWith(today));
        const bijakToday = db.warehouseTransactions.filter(t => t.type === 'OUT' && t.date.startsWith(today));

        let msg = `📊 *گزارش خلاصه وضعیت امروز* (${shamsiToday})\n`;
        msg += `--------------------------\n`;
        msg += `💰 *پرداخت‌ها:* ${payToday.length} مورد\n`;
        msg += `💵 *جمع مبلغ:* ${parseInt(totalPay).toLocaleString()} ریال\n`;
        msg += `--------------------------\n`;
        msg += `🚛 *مجوزهای خروج:* ${exitToday.length} مورد\n`;
        msg += `📦 *بیجک‌های صادر شده:* ${bijakToday.length} مورد\n`;
        
        return sendFn(chatId, msg);
    }

    if (data === 'RPT_MONTHLY') {
        const today = new Date();
        const currentMonth = toShamsiYearMonth(today.toISOString()); // "1403/02"
        
        // Filter by Shamsi Month string comparison
        const payMonth = db.orders.filter(o => toShamsiYearMonth(o.date) === currentMonth);
        const totalPay = payMonth.reduce((sum, o) => sum + o.totalAmount, 0);
        
        const exitMonth = db.exitPermits.filter(p => toShamsiYearMonth(p.date) === currentMonth);
        const bijakMonth = db.warehouseTransactions.filter(t => t.type === 'OUT' && t.date.startsWith(today));

        let msg = `🗓 *عملکرد ماه جاری* (${currentMonth})\n`;
        msg += `--------------------------\n`;
        msg += `💰 *کل پرداخت‌ها:* ${payMonth.length} فقره\n`;
        msg += `💵 *جمع کل:* ${parseInt(totalPay).toLocaleString()} ریال\n`;
        msg += `--------------------------\n`;
        msg += `🚛 *مجوز خروج:* ${exitMonth.length} فقره\n`;
        msg += `📦 *بیجک انبار:* ${bijakMonth.length} فقره\n`;

        return sendFn(chatId, msg);
    }

    if (data === 'RPT_PENDING') {
        // Count Pending Items by Status
        const payPendingFin = db.orders.filter(o => o.status === 'در انتظار بررسی مالی').length;
        const payPendingMgr = db.orders.filter(o => o.status === 'تایید مالی / در انتظار مدیریت').length;
        const payPendingCeo = db.orders.filter(o => o.status === 'تایید مدیریت / در انتظار مدیرعامل').length;

        const exitPendingCeo = db.exitPermits.filter(p => p.status === 'در انتظار تایید مدیرعامل').length;
        const exitPendingFac = db.exitPermits.filter(p => p.status === 'در انتظار مدیر کارخانه').length;
        const exitPendingWh = db.exitPermits.filter(p => p.status === 'در انتظار تایید انبار').length;
        const exitPendingSec = db.exitPermits.filter(p => p.status === 'در انتظار خروج').length;

        let msg = `⏳ *وضعیت کارتابل‌ها (اسناد باز)*\n`;
        msg += `--------------------------\n`;
        msg += `💰 *دستور پرداخت:*\n`;
        msg += `   ▫️ مالی: ${payPendingFin}\n`;
        msg += `   ▫️ مدیریت: ${payPendingMgr}\n`;
        msg += `   ▫️ مدیرعامل: ${payPendingCeo}\n`;
        msg += `--------------------------\n`;
        msg += `🚛 *مجوز خروج:*\n`;
        msg += `   ▫️ مدیرعامل: ${exitPendingCeo}\n`;
        msg += `   ▫️ کارخانه: ${exitPendingFac}\n`;
        msg += `   ▫️ انبار: ${exitPendingWh}\n`;
        msg += `   ▫️ انتظامات: ${exitPendingSec}\n`;

        return sendFn(chatId, msg);
    }

    // --- PAYMENT ACTIONS ---
    if (data === 'ACT_PAY_NEW') {
        session.state = 'PAY_AMOUNT';
        return sendFn(chatId, "💵 مبلغ پرداختی (ریال) را وارد کنید:");
    }

    if (data === 'ACT_PAY_CARTABLE') {
        // Logic to show pending payments based on role
        let pendingOrders = [];
        if (user.role === 'financial') pendingOrders = db.orders.filter(o => o.status === 'در انتظار بررسی مالی');
        else if (user.role === 'manager') pendingOrders = db.orders.filter(o => o.status === 'تایید مالی / در انتظار مدیریت');
        else if (user.role === 'ceo') pendingOrders = db.orders.filter(o => o.status === 'تایید مدیریت / در انتظار مدیرعامل');
        else if (user.role === 'admin') pendingOrders = db.orders.filter(o => !o.status.includes('نهایی') && !o.status.includes('رد'));

        if (pendingOrders.length === 0) return sendFn(chatId, "✅ کارتابل شما خالی است.");

        for (const order of pendingOrders) {
            let paymentBankInfo = 'نامشخص';
            if (order.paymentDetails && order.paymentDetails.length > 0) {
                const banks = [...new Set(order.paymentDetails.map(d => d.bankName).filter(Boolean))];
                if (banks.length > 0) paymentBankInfo = banks.join('، ');
            }
            
            let detailsText = '';
            if (order.paymentDetails && order.paymentDetails.length > 0) {
                detailsText = '\n📋 *جزئیات پرداخت:*';
                order.paymentDetails.forEach((d, i) => {
                    detailsText += `\n   ${i+1}. ${d.method} (${Number(d.amount).toLocaleString()} ریال)${d.bankName ? ' - بانک ' + d.bankName : ''}${d.chequeNumber ? ' - چک ' + d.chequeNumber : ''}${d.chequeDate ? ' (' + d.chequeDate + ')' : ''}`;
                });
            }
            
            const methodType = (order.paymentDetails && order.paymentDetails.length > 0) ? order.paymentDetails[0].method : '-';
            const caption = `💸 *دستور پرداخت کارتابل*
--------------------------
🏢 *شرکت:* ${order.payingCompany || '-'}
🔢 *شماره سند:* #${order.trackingNumber || order.id}
📅 *تاریخ ثبت:* ${order.date ? toShamsiFull(order.date) : '-'}
👤 *ذینفع:* ${order.payee || '-'}
📍 *محل پرداخت:* ${order.paymentPlace || '-'}
💳 *روش اصلی:* ${methodType}
🏦 *بانک صادرکننده:* ${paymentBankInfo}
💰 *مبلغ کل:* ${Number(order.totalAmount || 0).toLocaleString()} ریال
📝 *بابت/توضیحات:* ${order.description || '-'}
🔄 *وضعیت فعلی:* ${order.status}${detailsText}`;
            const kb = {
                inline_keyboard: [
                    [
                        { text: '✅ تایید', callback_data: `APP_PAY_${order.id}` },
                        { text: '❌ رد', callback_data: `REJ_PAY_${order.id}` }
                    ]
                ]
            };
            await sendFn(chatId, caption, { reply_markup: kb });
        }
        return;
    }

    // Payment Approval Logic
    if (data.startsWith('APP_PAY_')) {
        const id = data.replace('APP_PAY_', '');
        const order = db.orders.find(o => o.id === id);
        if (order) {
            let canApprove = false;
            if (order.status === 'در انتظار بررسی مالی' && ['financial', 'admin'].includes(user.role)) canApprove = true;
            else if (order.status === 'تایید مالی / در انتظار مدیریت' && ['manager', 'admin'].includes(user.role)) canApprove = true;
            else if (order.status === 'تایید مدیریت / در انتظار مدیرعامل' && ['ceo', 'admin'].includes(user.role)) canApprove = true;

            if (!canApprove) return sendFn(userId, "⛔ شما دسترسی لازم برای این مرحله را ندارید.");

            if (order.status === 'در انتظار بررسی مالی') {
                order.status = 'تایید مالی / در انتظار مدیریت';
                order.approverFinancial = user.fullName;
            } else if (order.status === 'تایید مالی / در انتظار مدیریت') {
                order.status = 'تایید مدیریت / در انتظار مدیرعامل';
                order.approverManager = user.fullName;
            } else if (order.status === 'تایید مدیریت / در انتظار مدیرعامل') {
                order.status = 'تایید نهایی';
                order.approverCeo = user.fullName;
            }
            
            saveDb(db);
            sendFn(chatId, `✅ سند #${order.trackingNumber} تایید شد.`);

            const isFinal = order.status === 'تایید نهایی' || order.status === 'پرداخت شده';
            notifyPaymentOrderStep(order, db, order.status, isFinal).catch(e => console.error("Bot Callback Notify Error:", e));
        }
        return;
    }
    if (data.startsWith('REJ_PAY_')) {
        const id = data.replace('REJ_PAY_', '');
        const order = db.orders.find(o => o.id === id);
        if (order) {
            let canReject = false;
            if (order.status === 'در انتظار بررسی مالی' && ['financial', 'admin'].includes(user.role)) canReject = true;
            else if (order.status === 'تایید مالی / در انتظار مدیریت' && ['manager', 'admin'].includes(user.role)) canReject = true;
            else if (order.status === 'تایید مدیریت / در انتظار مدیرعامل' && ['ceo', 'admin'].includes(user.role)) canReject = true;

            if (!canReject) return sendFn(userId, "⛔ شما دسترسی لازم برای رد این مرحله را ندارید.");

            order.status = 'رد شده';
            order.rejectedBy = user.fullName;
            order.rejectionReason = 'رد شده از طریق ربات پیام‌رسان';
            saveDb(db);
            sendFn(chatId, `❌ سند #${order.trackingNumber} رد شد.`);
            
            notifyPaymentOrderStep(order, db, 'رد شده', false).catch(e => console.error("Bot Callback Reject Notify Error:", e));
        }
        return;
    }

    // --- EXIT ACTIONS ---
    if (data === 'ACT_EXIT_NEW') {
        session.state = 'EXIT_RECIPIENT';
        return sendFn(chatId, "👤 نام گیرنده کالا را وارد کنید:");
    }

    if (data === 'ACT_EXIT_CARTABLE') {
        let pendingPermits = [];
        if (user.role === 'ceo') pendingPermits = db.exitPermits.filter(p => p.status === 'در انتظار تایید مدیرعامل');
        else if (user.role === 'factory_manager') pendingPermits = db.exitPermits.filter(p => p.status === 'در انتظار مدیر کارخانه' || p.status === 'در انتظار تایید نهایی مدیر کارخانه');
        else if (user.role === 'warehouse_keeper') pendingPermits = db.exitPermits.filter(p => p.status === 'در انتظار تایید انبار');
        else if (user.role === 'security_head' || user.role === 'security_guard') pendingPermits = db.exitPermits.filter(p => p.status === 'در انتظار خروج (انتظامات)');
        else if (user.role === 'admin') pendingPermits = db.exitPermits.filter(p => !p.status.includes('بایگانی') && !p.status.includes('خارج شد') && !p.status.includes('رد'));

        if (pendingPermits.length === 0) return sendFn(chatId, "✅ کارتابل خروج خالی است.");

        for (const p of pendingPermits) {
            const isFinalStep = p.status === 'در انتظار تایید نهایی مدیر کارخانه';
            const caption = `🚛 مجوز #${p.permitNumber}\n👤 گیرنده: ${p.recipientName}\n📦 کالا: ${p.goodsName}\n🔄 وضعیت: ${isFinalStep ? 'در انتظار تایید نهایی خروج' : p.status}`;
            const kb = {
                inline_keyboard: [
                    [
                        { text: isFinalStep ? '✅ تایید نهایی خروج' : '✅ تایید', callback_data: `APP_EXIT_${p.id}` },
                        { text: '❌ رد', callback_data: `REJ_EXIT_${p.id}` }
                    ]
                ]
            };
            await sendFn(chatId, caption, { reply_markup: kb });
        }
        return;
    }

    if (data.startsWith('APP_EXIT_')) {
        const id = data.replace('APP_EXIT_', '');
        const p = db.exitPermits.find(x => x.id === id);
        if (p) {
            let canApprove = false;
            if (p.status === 'در انتظار تایید مدیرعامل' && ['ceo', 'admin'].includes(user.role)) canApprove = true;
            else if (p.status === 'در انتظار مدیر کارخانه' && ['factory_manager', 'admin'].includes(user.role)) canApprove = true;
            else if (p.status === 'در انتظار تایید انبار' && ['warehouse_keeper', 'admin'].includes(user.role)) canApprove = true;
            else if (p.status === 'در انتظار خروج (انتظامات)' && ['security_head', 'security_guard', 'admin'].includes(user.role)) canApprove = true;
            else if (p.status === 'در انتظار تایید نهایی مدیر کارخانه' && ['factory_manager', 'admin'].includes(user.role)) canApprove = true;

            if (!canApprove) {
                return sendFn(userId, "⛔ شما دسترسی لازم برای تایید این مرحله را ندارید.");
            }

            if (p.status === 'در انتظار تایید انبار') {
                return sendFn(chatId, "⚠️ جهت تایید انبار و الزام ثبت مقادیر واقعی (توزین نهایی)، لطفا حتما از طریق وب‌اپلیکیشن اقدام نمایید.");
            }
            if (p.status === 'در انتظار خروج (انتظامات)') {
                return sendFn(chatId, "⚠️ جهت ثبت مشخصات راننده و پلاک خودرو، لطفا حتما از طریق وب‌اپلیکیشن اقدام نمایید.");
            }

            const oldStatus = p.status;
            let stepName = '';

            if (p.status === 'در انتظار تایید مدیرعامل') {
                p.status = 'در انتظار مدیر کارخانه';
                stepName = 'مدیرعامل';
                p.approverCeo = user.fullName;
            } else if (p.status === 'در انتظار مدیر کارخانه') {
                p.status = 'در انتظار تایید انبار';
                stepName = 'مدیر کارخانه';
                p.approverFactory = user.fullName;
            } else if (p.status === 'در انتظار تایید نهایی مدیر کارخانه') {
                p.status = 'خارج شده (بایگانی)';
                p.exitTime = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
                stepName = 'تایید نهایی مدیر کارخانه (خروج کالا)';
                p.approverFactoryFinal = user.fullName;
                // Note: Customer WhatsApp with proforma image is now sent automatically via notifyExitPermitStep
            }
            
            saveDb(db);
            sendFn(chatId, `✅ مجوز #${p.permitNumber} تایید شد.`);

            if (stepName) {
                await notifyExitPermitStep(p, platform, chatId, sendPhotoFn, db, stepName);
            }
        }
        return;
    }

    if (data.startsWith('REJ_EXIT_')) {
        const id = data.replace('REJ_EXIT_', '');
        const p = db.exitPermits.find(x => x.id === id);
        if (p) {
            let canReject = false;
            if (p.status === 'در انتظار تایید مدیرعامل' && ['ceo', 'admin'].includes(user.role)) canReject = true;
            else if (p.status === 'در انتظار مدیر کارخانه' && ['factory_manager', 'admin'].includes(user.role)) canReject = true;
            else if (p.status === 'در انتظار تایید انبار' && ['warehouse_keeper', 'admin'].includes(user.role)) canReject = true;
            else if (p.status === 'در انتظار خروج (انتظامات)' && ['security_head', 'security_guard', 'admin'].includes(user.role)) canReject = true;
            else if (p.status === 'در انتظار تایید نهایی مدیر کارخانه' && ['factory_manager', 'admin'].includes(user.role)) canReject = true;

            if (!canReject) {
                return sendFn(userId, "⛔ شما دسترسی لازم برای رد این مرحله را ندارید.");
            }

            p.status = 'رد شده';
            saveDb(db);
            sendFn(chatId, `❌ مجوز #${p.permitNumber} رد شد.`);
        }
        return;
    }

    // --- WAREHOUSE ACTIONS ---
    if (data === 'ACT_WH_NEW_BIJAK') {
        session.data.targetType = 'WH_BIJAK'; // Context for Company Select
        
        const companies = [...new Set((db.warehouseTransactions||[]).map(o=>o.company).filter(Boolean))];
        if (companies.length === 0 && db.settings.companyNames) companies.push(...db.settings.companyNames);
        
        if (companies.length === 0) {
             session.state = 'WH_BIJAK_COUNT';
             return sendFn(chatId, "تعداد کالا را وارد کنید:");
        }

        const buttons = companies.map(c => [{ text: c, callback_data: `SEL_COMP_BIJAK_${c}` }]);
        buttons.push([{ text: '🔙 بازگشت', callback_data: 'MENU_WH' }]);
        return sendFn(chatId, "🏢 شرکت صادرکننده بیجک را انتخاب کنید:", { reply_markup: { inline_keyboard: buttons } });
    }

    if (data.startsWith('SEL_COMP_BIJAK_')) {
        session.data.company = data.replace('SEL_COMP_BIJAK_', '');
        session.state = 'WH_BIJAK_COUNT';
        return sendFn(chatId, `🏢 شرکت: ${session.data.company}\n🔢 تعداد کالا را وارد کنید:`);
    }

    if (data === 'ACT_WH_CARTABLE') {
        const pendingBijaks = (db.warehouseTransactions || []).filter(t => t.type === 'OUT' && t.status === 'PENDING');
        
        if (pendingBijaks.length === 0) return sendFn(chatId, "✅ کارتابل انبار خالی است.");

        // Only Admin or CEO (or Managers with access) can approve via bot ideally, 
        // but here we allow basic check if user role fits (Admin/CEO) or if we want open access for ease.
        // Assuming Admin/CEO role check:
        const canApprove = ['admin', 'ceo', 'manager'].includes(user.role);
        
        for (const tx of pendingBijaks) {
            const caption = `📦 *بیجک انبار #${tx.number}*\n📅 ${toShamsiFull(tx.date)}\n🏢 ${tx.company}\n👤 گیرنده: ${tx.recipientName}\n🔢 اقلام: ${tx.items.length} ردیف`;
            const kb = canApprove ? {
                inline_keyboard: [
                    [
                        { text: '✅ تایید نهایی', callback_data: `APP_WH_${tx.id}` },
                        { text: '❌ رد', callback_data: `REJ_WH_${tx.id}` }
                    ]
                ]
            } : undefined;
            await sendFn(chatId, caption, { reply_markup: kb });
        }
        return;
    }

    if (data.startsWith('APP_WH_')) {
        const id = data.replace('APP_WH_', '');
        const tx = db.warehouseTransactions.find(t => t.id === id);
        if (tx) {
            tx.status = 'APPROVED';
            tx.approvedBy = user.fullName + ' (Bot)';
            saveDb(db);
            sendFn(chatId, `✅ بیجک #${tx.number} تایید نهایی شد.`);
            notifyWarehouseBijak(tx, db, 'تایید نهایی').catch(e => console.error("Bot Bijak Notify Error:", e));
        }
        return;
    }

    if (data.startsWith('REJ_WH_')) {
        const id = data.replace('REJ_WH_', '');
        const tx = db.warehouseTransactions.find(t => t.id === id);
        if (tx) {
            tx.status = 'REJECTED';
            tx.rejectedBy = user.fullName + ' (Bot)';
            saveDb(db);
            sendFn(chatId, `❌ بیجک #${tx.number} رد شد.`);
        }
        return;
    }

    // --- WAREHOUSE STOCK REPORT ---
    if (data === 'WH_RPT_DISPATCH_PROMPT') {
        const kb = [
            [{ text: '📅 گزارش امروز', callback_data: 'WH_RPT_DISPATCH_TODAY' }],
            [{ text: '📅 گزارش هفته جاری', callback_data: 'WH_RPT_DISPATCH_WEEK' }],
            [{ text: '📅 گزارش ماه جاری', callback_data: 'WH_RPT_DISPATCH_MONTH' }],
            [{ text: '📋 تمام بیجک‌ها', callback_data: 'WH_RPT_DISPATCH_ALL' }],
            [{ text: '🔙 بازگشت', callback_data: 'MENU_WH' }]
        ];
        return sendFn(chatId, "بازه زمانی گزارش خروج را انتخاب کنید:", { reply_markup: { inline_keyboard: kb } });
    }

    if (data.startsWith('WH_RPT_DISPATCH_') && data !== 'WH_RPT_DISPATCH_PROMPT') {
        const rangeType = data.replace('WH_RPT_DISPATCH_', '');
        await sendFn(chatId, "⏳ در حال استخراج و تولید گزارش خروج (PDF و Excel)...");
        
        try {
            const txs = Array.isArray(db.warehouseTransactions) ? db.warehouseTransactions : [];
            let outTxs = txs.filter(t => t.type === 'OUT');
            
            let titleRange = 'تمام دوره‌ها';
            
            if (rangeType === 'TODAY') {
                const todayStr = getTehranDateString(); 
                outTxs = outTxs.filter(t => t.date && t.date.startsWith(todayStr));
                titleRange = 'امروز';
            } else if (rangeType === 'WEEK') {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                outTxs = outTxs.filter(t => t.date && new Date(t.date) >= weekAgo);
                titleRange = 'هفته جاری';
            } else if (rangeType === 'MONTH') {
                const monthAgo = new Date();
                monthAgo.setDate(monthAgo.getDate() - 30);
                outTxs = outTxs.filter(t => t.date && new Date(t.date) >= monthAgo);
                titleRange = 'ماه جاری';
            }

            outTxs.sort((a,b) => new Date(b.date) - new Date(a.date));

            const columns = ["ردیف", "تاریخ", "شماره", "شرکت", "کالا", "تعداد", "وزن", "گیرنده", "راننده", "پلاک", "توضیحات"];
            const rows = [];
            
            let rowIdx = 1;
            outTxs.forEach(tx => {
                if (tx.items && tx.items.length > 0) {
                    tx.items.forEach(item => {
                        let fDate = '-';
                        try {
                            if (tx.date) fDate = new Intl.DateTimeFormat('fa-IR', { year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date(tx.date));
                        } catch(e){}
                        rows.push([
                            rowIdx++,
                            fDate,
                            tx.number || '-',
                            tx.company || '-',
                            item.itemName || '-',
                            item.quantity || '0',
                            item.weight || '0',
                            tx.recipientName || '-',
                            tx.driverName || '-',
                            tx.plateNumber || '-',
                            tx.description || '-'
                        ]);
                    });
                }
            });

            if (rows.length === 0) {
                return sendFn(chatId, `هیچ بیجک خروجی در بازه "${titleRange}" یافت نشد.`);
            }

            const title = `گزارش خروج کالا (بیجک‌ها) - ${titleRange}`;
            
            // 1. Generate PDF
            const pdfBuffer = await Renderer.generateReportPDF(title, columns, rows, true);
            const pdfFilename = `Dispatch_Report_${rangeType}_${Date.now()}.pdf`;
            await sendDocFn(chatId, pdfBuffer, pdfFilename, `📄 فایل PDF گزارش خروج (${titleRange})\nتعداد رکورد: ${rows.length}`);

            // 2. Generate Excel
            const excelBuffer = generateExcelBuffer(columns, rows, "خروج کالا");
            const excelFilename = `Dispatch_Report_${rangeType}_${Date.now()}.xlsx`;
            await sendDocFn(chatId, excelBuffer, excelFilename, `📊 فایل Excel گزارش خروج (${titleRange})`);
            
        } catch (e) {
            console.error("Dispatch Report Gen Error:", e);
            return sendFn(chatId, "❌ خطا در تولید گزارش.");
        }
        return;
    }

    if (data === 'WH_RPT_STOCK') {
        await sendFn(chatId, "⏳ در حال محاسبه موجودی و تولید PDF...");
        try {
            const items = Array.isArray(db.warehouseItems) ? db.warehouseItems : [];
            const txs = Array.isArray(db.warehouseTransactions) ? db.warehouseTransactions : [];
            const companies = [...new Set(txs.map(t => t.company).filter(Boolean))];
            
            const reportData = companies.map(company => {
                const companyItems = items.map(catItem => {
                    let qty = 0; let weight = 0;
                    txs.filter(t => t.company === company && t.status !== 'REJECTED').forEach(t => {
                        if (Array.isArray(t.items)) {
                            t.items.forEach(ti => {
                                if (ti.itemId === catItem.id) {
                                    if (t.type === 'IN') { qty += (ti.quantity || 0); weight += (ti.weight || 0); }
                                    else { qty -= (ti.quantity || 0); weight -= (ti.weight || 0); }
                                }
                            });
                        }
                    });
                    const cap = catItem.containerCapacity || 0;
                    const containerCount = (cap > 0 && qty > 0) ? (qty / cap) : 0;
                    return { name: catItem.name, quantity: qty, weight: weight, containerCount };
                }).filter(i => Math.abs(i.quantity) > 0.001 || Math.abs(i.weight) > 0.001);
                return { company, items: companyItems };
            });

            // Generate HTML designed for A4 Landscape
            let html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><style>
                @page { size: A4 landscape; margin: 0; }
                body { font-family: 'Vazirmatn', sans-serif; background: white; margin: 0; }
            </style></head><body>
            <div style="width: 290mm; min-height: 200mm; direction: rtl; padding: 5mm; box-sizing: border-box; margin: 0 auto; color: black;">
                <div style="text-align: center; background-color: #fde047; border: 2px solid black; padding: 8px; margin-bottom: 10px; font-weight: 900; font-size: 20px;">موجودی کلی انبارها</div>
                <table style="width: 100%; border-collapse: collapse; border: 2px solid black; table-layout: fixed;">
                    <thead>
                        <tr>
                            ${reportData.map((group, index) => {
                                const headerColor = index === 0 ? '#d8b4fe' : index === 1 ? '#fdba74' : '#93c5fd';
                                return `
                                    <th style="border-left: 2px solid black; vertical-align: top; padding: 0;">
                                        <div style="background-color: ${headerColor}; color: black; padding: 8px; border-bottom: 2px solid black; font-size: 14px; font-weight: 900;">${group.company}</div>
                                        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                                            <thead>
                                                <tr style="background-color: #f3f4f6;">
                                                    <th style="width: 40%; border-left: 1px solid black; border-bottom: 1px solid black; padding: 4px;">نخ / کالا</th>
                                                    <th style="width: 20%; border-left: 1px solid black; border-bottom: 1px solid black; padding: 4px;">کارتن</th>
                                                    <th style="width: 20%; border-left: 1px solid black; border-bottom: 1px solid black; padding: 4px;">وزن</th>
                                                    <th style="width: 20%; border-bottom: 1px solid black; padding: 4px;">کانتینر</th>
                                                </tr>
                                            </thead>
                                        </table>
                                    </th>
                                `;
                            }).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            ${reportData.map((group, index) => {
                                return `
                                    <td style="border-left: 2px solid black; vertical-align: top; padding: 0;">
                                        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                                            <tbody>
                                                ${group.items.map((item, i) => `
                                                    <tr style="border-bottom: 1px solid #d1d5db;">
                                                        <td style="width: 40%; border-left: 1px solid black; padding: 4px; text-align: right; font-weight: bold; overflow: hidden; white-space: nowrap;">${item.name}</td>
                                                        <td style="width: 20%; border-left: 1px solid black; padding: 4px; text-align: center; font-family: monospace; font-weight: bold;">${item.quantity.toFixed(2)}</td>
                                                        <td style="width: 20%; border-left: 1px solid black; padding: 4px; text-align: center; font-family: monospace;">${item.weight > 0 ? item.weight.toFixed(2) : '0.00'}</td>
                                                        <td style="width: 20%; padding: 4px; text-align: center; font-family: monospace; color: #6b7280;">
                                                            ${item.containerCount > 0 ? item.containerCount.toFixed(2) : '-'}
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                                ${group.items.length > 0 ? `
                                                    <tr style="background-color: #f9fafb; border-top: 2px solid black;">
                                                        <td style="width: 40%; border-left: 1px solid black; padding: 6px; text-align: right; font-weight: 900; font-size: 12px;">جمع کل</td>
                                                        <td style="width: 20%; border-left: 1px solid black; padding: 6px; text-align: center; font-weight: 900; font-size: 12px; border-bottom: 2px double black;">
                                                            ${group.items.reduce((sum, i) => sum + (i.quantity || 0), 0).toFixed(2)}
                                                        </td>
                                                        <td style="width: 20%; border-left: 1px solid black; padding: 6px; text-align: center; font-weight: 900; font-size: 12px; border-bottom: 2px double black;">
                                                        ${group.items.reduce((sum, i) => sum + (i.weight || 0), 0).toFixed(2)}
                                                    </td>
                                                    <td style="width: 20%; padding: 6px; text-align: center;"></td>
                                                </tr>
                                            ` : ''}
                                            ${group.items.length === 0 ? `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #9ca3af;">موجودی صفر</td></tr>` : ''}
                                        </tbody>
                                    </table>
                                </td>
                            `;
                        }).join('')}
                    </tr>
                </tbody>
            </table>
                <div style="text-align: center; background-color: #fde047; border: 2px solid black; border-top: none; padding: 4px; font-weight: bold; font-size: 12px;">
                    گزارش سیستم مدیریت انبار - تاریخ چاپ: ${new Date().toLocaleDateString('fa-IR')}
                </div>
            </div>
            </body></html>`;

            const pdfBuffer = await Renderer.generatePdfBuffer(html, { landscape: true });
            if (pdfBuffer && pdfBuffer.length > 100) {
                await sendDocFn(chatId, pdfBuffer, `Stock_Report_${Date.now()}.pdf`, 'گزارش موجودی انبار');
            } else {
                await sendFn(chatId, "⚠️ خطا در تولید PDF.\n(خروجی خالی)");
            }
        } catch (e) {
            console.error("Stock Report Error:", e);
            await sendFn(chatId, `⚠️ خطا در تولید گزارش: ${e.message}`);
        }
        return;
    }

    // --- ARCHIVE & SEARCH LOGIC (GENERIC) ---
    const ARCHIVE_TYPES = {
        'ACT_ARCHIVE_PAY': 'PAYMENT',
        'ACT_ARCHIVE_EXIT': 'EXIT',
        'ACT_ARCHIVE_WH_OUT': 'WH_OUT',
        'ACT_ARCHIVE_WH_IN': 'WH_IN'
    };

    if (ARCHIVE_TYPES[data]) {
        const type = ARCHIVE_TYPES[data];
        session.data.targetType = type;
        
        let companies = [];
        if (type === 'PAYMENT') companies = [...new Set((db.orders||[]).map(o=>o.payingCompany).filter(Boolean))];
        else if (type === 'EXIT') companies = [...new Set((db.exitPermits||[]).map(o=>o.company).filter(Boolean))];
        else companies = [...new Set((db.warehouseTransactions||[]).map(o=>o.company).filter(Boolean))];

        if (companies.length === 0) return sendFn(chatId, "❌ داده‌ای برای جستجو یافت نشد.");
        
        const buttons = companies.map(c => [{ text: c, callback_data: `ARC_SEL_COMP_${c}` }]);
        buttons.push([{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]);
        
        return sendFn(chatId, `🏢 شرکت را انتخاب کنید (${type}):`, { reply_markup: { inline_keyboard: buttons } });
    }

    if (data.startsWith('ARC_SEL_COMP_')) {
        const company = data.replace('ARC_SEL_COMP_', '');
        session.data.company = company;
        const type = session.data.targetType || 'PAYMENT';

        let sourceList = [];
        if (type === 'PAYMENT') sourceList = (db.orders||[]).filter(o => o.payingCompany === company);
        else if (type === 'EXIT') sourceList = (db.exitPermits||[]).filter(o => o.company === company);
        else sourceList = (db.warehouseTransactions||[]).filter(o => o.company === company);

        const years = getAvailableYears(sourceList);
        
        const buttons = [];
        for(let i=0; i<years.length; i+=3) {
            const row = years.slice(i, i+3).map(y => ({ text: y, callback_data: `ARC_SEL_YEAR_${y}` }));
            buttons.push(row);
        }
        buttons.push([{ text: '📅 جستجوی روز دقیق', callback_data: 'ARCHIVE_INPUT_DATE' }]);
        buttons.push([{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]);

        return sendFn(chatId, `🗓 سال را انتخاب کنید (${company}):`, { reply_markup: { inline_keyboard: buttons } });
    }

    if (data === 'ARCHIVE_INPUT_DATE') {
        session.state = 'ARCHIVE_WAIT_DATE';
        return sendFn(chatId, "⌨️ تاریخ دقیق را وارد کنید (yyyy/mm/dd):");
    }

    if (data.startsWith('ARC_SEL_YEAR_')) {
        const year = data.replace('ARC_SEL_YEAR_', '');
        session.data.year = year;
        const months = [
            { text: 'فروردین', id: '01' }, { text: 'اردیبهشت', id: '02' }, { text: 'خرداد', id: '03' },
            { text: 'تیر', id: '04' }, { text: 'مرداد', id: '05' }, { text: 'شهریور', id: '06' },
            { text: 'مهر', id: '07' }, { text: 'آبان', id: '08' }, { text: 'آذر', id: '09' },
            { text: 'دی', id: '10' }, { text: 'بهمن', id: '11' }, { text: 'اسفند', id: '12' }
        ];
        const buttons = [];
        for(let i=0; i<months.length; i+=3) {
            const row = months.slice(i, i+3).map(m => ({ text: m.text, callback_data: `ARC_EXEC_MONTH_${m.id}` }));
            buttons.push(row);
        }
        buttons.push([{ text: '🔙 بازگشت', callback_data: 'MENU_MAIN' }]);
        return sendFn(chatId, `🗓 ماه را انتخاب کنید (${year}):`, { reply_markup: { inline_keyboard: buttons } });
    }

    if (data.startsWith('ARC_EXEC_MONTH_')) {
        const month = data.replace('ARC_EXEC_MONTH_', '');
        const targetDateStr = `${session.data.year}/${month}`;
        await sendFn(chatId, `⏳ جستجو در ${targetDateStr}...`);
        await searchAndSendResults(db, session.data.company, targetDateStr, 'MONTH', session.data.targetType, platform, chatId, sendFn, sendPhotoFn);
        return;
    }

    // --- PDF GENERATION ---
    if (data.startsWith('GEN_PDF_ORDER_')) {
        const id = data.replace('GEN_PDF_ORDER_', '');
        const item = db.orders.find(o => o.id === id);
        if(item) await sendPdf(item, 'PAYMENT', chatId, sendFn, sendDocFn);
    }
    if (data.startsWith('GEN_PDF_EXIT_')) {
        const id = data.replace('GEN_PDF_EXIT_', '');
        const item = db.exitPermits.find(o => o.id === id);
        if(item) await sendPdf(item, 'EXIT', chatId, sendFn, sendDocFn);
    }
    if (data.startsWith('GEN_PDF_BIJAK_')) {
        const id = data.replace('GEN_PDF_BIJAK_', '');
        const item = db.warehouseTransactions.find(o => o.id === id);
        if(item) await sendPdf(item, 'BIJAK', chatId, sendFn, sendDocFn);
    }
};

const sendPdf = async (item, type, chatId, sendFn, sendDocFn) => {
    await sendFn(chatId, "⏳ در حال تولید PDF...");
    try {
        let pdf = null;
        let filename = 'document.pdf';
        
        if (type === 'PAYMENT') {
            pdf = await Renderer.generateVoucherPDF(item);
            filename = `Voucher_${item.trackingNumber}.pdf`;
        } else if (type === 'EXIT') {
            pdf = await Renderer.generateExitPermitPDF(item);
            filename = `Permit_${item.permitNumber}.pdf`;
        } else if (type === 'BIJAK') {
            pdf = await Renderer.generateBijakPDF(item);
            filename = `Bijak_${item.number}.pdf`;
        }

        if (pdf && pdf.length > 100) {
            await sendDocFn(chatId, pdf, filename, 'فایل PDF سند');
        } else {
            await sendFn(chatId, "⚠️ خطا در تولید PDF: خروجی خالی است.");
        }
    } catch (e) {
        console.error("PDF Error:", e);
        // Provide the actual error message to the user for better diagnostics
        await sendFn(chatId, `⚠️ خطا در تولید PDF: ${e.message}`);
    }
};

// --- MEETING NOTIFICATIONS ---

export const notifyMeetingAnnouncement = async (meeting, db) => {
    const dedupeKey = `MEETING_ANN_${meeting.id}`;
    if (isDuplicateNotification(dedupeKey)) return;
    
    console.log(`>>> Meeting Announcement triggered for ${meeting.meetingNumber}`);
    const s = db.settings;
    if (!s) {
        console.error("No settings found in DB for meeting announcement");
        return;
    }

    const attendeesList = (meeting.attendees || []).map(a => `• ${a.fullName} (${a.role || 'عضو'})`).join('\n');
    const message = `✨️ اعلان برگزاری جلسه تولید؛\n\n⚜️ با عرض سلام و احترام،\n\nجلسه تولید شماره *${meeting.meetingNumber}* روز ${meeting.date} راس ساعت *${meeting.time || '۱۲:۰۰'}* در ${meeting.location || 'محل دائمی جلسات کارخانه'}، برگزار خواهد شد.\n\nرئیس جلسه:\n${meeting.chairman || 'سیّد علی احمدی'}\nدبیر جلسه:\n${meeting.secretary || 'پریسا مرادی'}\n\n🔆 اعضای حاضر / مدعوین:\n${attendeesList || 'موردی ثبت نشده است'}`;

    let announcementImg = null;
    try {
        announcementImg = await Renderer.generateMeetingAnnouncementImage(meeting);
    } catch(e) { console.error("Error generating meeting image", e); }

    // Send to Telegram
    const teleId = normalizeChannelId(s.botMeetingAnnouncementTelegramId || s.botMeetingAnnouncementGroupId || s.botAccountingGroupIdTele);
    if (teleId) {
        console.log(`Sending meeting announcement to Telegram: ${teleId}`);
        import('./telegram.js').then(m => {
            if (announcementImg) m.sendBotPhoto(teleId, announcementImg, message).catch(e => console.error("Tele meeting photo fail:", e));
            else m.sendMessage(teleId, message).catch(e => console.error("Tele meeting msg fail:", e));
        }).catch(e => console.error("Tele import fail:", e));
    } else {
        console.warn("No Telegram ID found for meeting announcement");
    }

    // Send to Bale
    const baleId = normalizeChannelId(s.botMeetingAnnouncementBaleId || s.botMeetingAnnouncementGroupId || s.botAccountingGroupIdBale);
    if (baleId) {
        console.log(`Sending meeting announcement to Bale: ${baleId}`);
        import('./bale.js').then(m => {
            if (announcementImg) m.sendBotPhoto(baleId, announcementImg, message).catch(e => console.error("Bale meeting photo fail:", e));
            else m.sendMessage(baleId, message).catch(e => console.error("Bale meeting msg fail:", e));
        }).catch(e => console.error("Bale import fail:", e));
    } else {
        console.warn("No Bale ID found for meeting announcement");
    }

    // Send to WhatsApp (if available)
    const waId = s.botMeetingAnnouncementGroupId || s.botAccountingGroupIdWhatsApp;
    if (waId) {
        import('./whatsapp.js').then(m => m.sendMessage(waId, message).catch(e => console.error("WA meeting fail:", e))).catch(e => console.error("WA import fail:", e));
    }
};

export const notifyMeetingMinutes = async (meeting, db) => {
    const dedupeKey = `MEETING_MIN_${meeting.id}`;
    if (isDuplicateNotification(dedupeKey)) return;
    
    const s = db.settings;
    if (!s) return;

    const generateResolutionsText = (platform) => {
        return (meeting.items || []).map((item, idx) => {
            let text = `${idx + 1}. ${item.description}`;
            if (item.responsiblePerson) {
                const user = (db.users || []).find(u => u.fullName === item.responsiblePerson || u.username === item.responsiblePerson);
                if (user) {
                    if (platform === 'telegram' && user.telegramChatId) {
                        text += ` (👤 مسئول: [${user.fullName}](tg://user?id=${user.telegramChatId}))`;
                    } else if (platform === 'bale' && user.baleChatId) {
                        // Bale sometimes supports tagging with [name](id) but the deep link tg:// is also common
                        // We will use the common approach first
                        text += ` (👤 مسئول: [${user.fullName}](tg://user?id=${user.baleChatId}))`;
                    } else {
                        text += ` (👤 مسئول: ${item.responsiblePerson})`;
                    }
                } else {
                    text += ` (👤 مسئول: ${item.responsiblePerson})`;
                }
            }
            if (item.duration) text += ` [⏳ مهلت: ${item.duration}]`;
            return text;
        }).join('\n');
    };

    const generateFullMessage = (platform) => {
        let resolutionsText = generateResolutionsText(platform);
        if (resolutionsText.length > 900) {
            resolutionsText = resolutionsText.substring(0, 900) + '... (ادامه در فایل پیوست)';
        }
        return `🏁 *صورتجلسه نهایی و مصوبات تایید شده* 🏁\n\n📄 شماره: *${meeting.meetingNumber}*\n📅 تاریخ: *${meeting.date}*\n\n✅ این صورتجلسه به تایید الکترونیکی تمامی حاضرین رسیده است.\n\n📝 *لیست مصوبات و تصمیمات*:\n${resolutionsText}\n\n📎 فایل PDF پیوست جهت بایگانی ارسال شد.`;
    };

    try {
        const pdfBuffer = await Renderer.generateMeetingMinutesPDF(meeting);
        const fileName = `Meeting_${meeting.meetingNumber}_Minutes.pdf`;

        // Send to Production Group (Tele/Bale/WA)
        const teleId = s.botMeetingMinutesTelegramId || s.botMeetingMinutesGroupId;
        if (teleId && s.telegramBotToken) {
            const msg = generateFullMessage('telegram');
            const cleanId = sanitizeGroupId(teleId);
            import('./telegram.js').then(m => m.sendBotDocument(cleanId, pdfBuffer, fileName, msg, { parse_mode: 'Markdown' })).catch(e => {});
        }

        const teleId2 = s.botMeetingMinutesSecondGroupIdTele;
        if (teleId2 && s.telegramBotToken) {
            const msg = generateFullMessage('telegram');
            const cleanId = sanitizeGroupId(teleId2);
            import('./telegram.js').then(m => m.sendBotDocument(cleanId, pdfBuffer, fileName, msg, { parse_mode: 'Markdown' })).catch(e => {});
        }

        const baleId = s.botMeetingMinutesBaleId || s.botMeetingMinutesGroupId;
        if (baleId && s.baleBotToken) {
            const msg = generateFullMessage('bale');
            const cleanId = sanitizeGroupId(baleId);
            import('./bale.js').then(m => m.sendBotDocument(cleanId, pdfBuffer, fileName, msg)).catch(e => {});
        }

        const baleId2 = s.botMeetingMinutesSecondGroupIdBale;
        if (baleId2 && s.baleBotToken) {
            const msg = generateFullMessage('bale');
            const cleanId = sanitizeGroupId(baleId2);
            import('./bale.js').then(m => m.sendBotDocument(cleanId, pdfBuffer, fileName, msg)).catch(e => {});
        }

        const waId = s.botMeetingMinutesWhatsAppId || s.botMeetingMinutesGroupId;
        if (waId && s.whatsappEnabled) {
            const msg = generateFullMessage('whatsapp');
            import('./whatsapp.js').then(m => m.sendMessage(waId, msg, {
                data: pdfBuffer.toString('base64'),
                mimeType: 'application/pdf',
                filename: fileName
            })).catch(e => {});
        }

        const waId2 = s.botMeetingMinutesSecondGroupIdWhatsApp;
        if (waId2 && s.whatsappEnabled) {
            const msg = generateFullMessage('whatsapp');
            import('./whatsapp.js').then(m => m.sendMessage(waId2, msg, {
                data: pdfBuffer.toString('base64'),
                mimeType: 'application/pdf',
                filename: fileName
            })).catch(e => {});
        }
    } catch (err) {
        console.error("Meeting PDF Generation/Sending Error:", err);
        // Fallback to text message if PDF fails
        const teleId = s.botMeetingMinutesTelegramId || s.botMeetingMinutesGroupId;
        if (teleId) {
            const msg = generateFullMessage('telegram');
            import('./telegram.js').then(m => m.sendMessage(teleId, msg, { parse_mode: 'Markdown' })).catch(e => {});
        }
        const teleId2 = s.botMeetingMinutesSecondGroupIdTele;
        if (teleId2) {
            const msg = generateFullMessage('telegram');
            import('./telegram.js').then(m => m.sendMessage(teleId2, msg, { parse_mode: 'Markdown' })).catch(e => {});
        }

        const baleId = s.botMeetingMinutesBaleId || s.botMeetingMinutesGroupId;
        if (baleId) {
            const msg = generateFullMessage('bale');
            import('./bale.js').then(m => m.sendMessage(baleId, msg)).catch(e => {});
        }
        const baleId2 = s.botMeetingMinutesSecondGroupIdBale;
        if (baleId2) {
            const msg = generateFullMessage('bale');
            import('./bale.js').then(m => m.sendMessage(baleId2, msg)).catch(e => {});
        }

        const waId = s.botMeetingMinutesGroupId;
        if (waId) {
            const msg = generateFullMessage('whatsapp');
            import('./whatsapp.js').then(m => m.sendMessage(waId, msg)).catch(e => {});
        }
        const waId2 = s.botMeetingMinutesSecondGroupIdWhatsApp;
        if (waId2) {
            const msg = generateFullMessage('whatsapp');
            import('./whatsapp.js').then(m => m.sendMessage(waId2, msg)).catch(e => {});
        }
    }
};

export const notifyPurchaseRequestStep = async (p, platform, chatId, sendPhotoFn, db, stepName, eventType = 'STEP') => {
    try {
        const isEdit = eventType === 'EDIT';
        const isDelete = eventType === 'DELETE';
        
        const dedupeKey = `PURCHASE_${p.id}_${p.status}_${eventType}`;
        if (isDuplicateNotification(dedupeKey)) return;

        let header = isDelete ? `❌ *حذف شد: درخواست خرید*` : (isEdit ? `✏️ *ویرایش شد: درخواست خرید*` : `🛒 *درخواست خرید*`);
        const caption = `${header}\n🔢 شماره: ${p.requestNumber || '-'}\n📅 تاریخ: ${p.date || '-'}\n👤 درخواست‌کننده: ${p.requester || '-'}\n📦 کالا: ${p.itemName || '-'}\n📂 گروه: ${p.category || '-'} - ${p.subCategory || '-'}\n🔢 مقدار: ${p.quantity} ${p.unit}\n📝 توضیحات: ${p.specifications || '-'}\n\n✅ *مرحله:* ${stepName}\n🔄 *وضعیت:* ${p.status}${isEdit ? '\n⚠️ *این پیام ویرایشی است*' : ''}`;
        
        if (chatId && sendPhotoFn) {
            sendPhotoFn(platform, chatId, 'https://placehold.co/800x400/4f46e5/ffffff?text=Purchase+Request', caption).catch(e => {});
        }

        const settings = db.settings || {};
        const telGroupId = sanitizeGroupId(settings.purchaseTelegramGroup);
        const baleGroupId = sanitizeGroupId(settings.purchaseBaleGroup);
        const waGroupId = settings.purchaseWhatsappGroup ? String(settings.purchaseWhatsappGroup).trim() : null;

        import('./telegram.js').then(m => {
            if (telGroupId && m.sendMessage) m.sendMessage(telGroupId, caption).catch(e=>{});
        }).catch(err => {});

        import('./bale.js').then(m => {
            if (baleGroupId && m.sendMessage) m.sendMessage(baleGroupId, caption).catch(e=>{});
        }).catch(err => {});

        import('./whatsapp.js').then(m => {
            if (waGroupId && m.sendMessage) m.sendMessage(waGroupId, caption).catch(e=>{});
        }).catch(err => {});
    } catch (e) {
        console.error('Error in notifyPurchase:', e);
    }
};

export const userHasLetterAccess = (user, letter, db) => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'ceo' || user.canManageSecretariatSettings) return true;
    if (!user.canAccessSecretariat) return false;
    
    const companySettings = (db.secretariatSettings || []).find(s => s.companyId === letter.companyId);
    if (!companySettings) return true; // Default to true if not configured yet
    
    const tokens = letter.section === 'headquarters'
        ? companySettings.headquartersAccessTokens || []
        : companySettings.factoryAccessTokens || [];
    return tokens.includes(user.id);
};

export const notifySecretariatLetter = async (letter, db) => {
    try {
        const company = (db.settings?.companies || []).find(c => c.id === letter.companyId);
        const companyName = company ? company.name : 'نامشخص';
        const sectionName = letter.section === 'headquarters' ? 'دفتر مرکزی' : 'کارخانه';
        
        let userIdsToNotify = [];
        if (letter.referredTo && letter.referredTo.length > 0) {
            userIdsToNotify = [...letter.referredTo];
        } else {
            const companySettings = (db.secretariatSettings || []).find(s => s.companyId === letter.companyId);
            if (companySettings) {
                userIdsToNotify = letter.section === 'headquarters'
                    ? [...(companySettings.headquartersAccessTokens || [])]
                    : [...(companySettings.factoryAccessTokens || [])];
            }
        }
        
        // Also add signers if they are users and have not approved yet
        if (letter.signers && letter.signers.length > 0) {
            const signerUserIds = letter.signers.map(s => s.userId).filter(Boolean);
            for (const suid of signerUserIds) {
                if (!userIdsToNotify.includes(suid)) {
                    userIdsToNotify.push(suid);
                }
            }
        }
        
        // Filter out those who already approved
        userIdsToNotify = userIdsToNotify.filter(uid => !(letter.approvedBy || []).includes(uid));
        
        if (userIdsToNotify.length === 0) return;
        
        const text = `✉️ *اطلاعیه کارتابل دبیرخانه اداری*\n` +
                     `یک نامه اداری جدید منتظر بررسی یا امضای شماست:\n\n` +
                     `🏢 *شرکت:* ${companyName}\n` +
                     `📍 *بخش:* ${sectionName}\n` +
                     `🔢 *شماره نامه:* ${letter.letterNumber}\n` +
                     `📅 *تاریخ:* ${letter.date}\n` +
                     `👤 *فرستنده:* ${letter.sender}\n` +
                     `👥 *گیرنده:* ${letter.receiver}\n` +
                     `📝 *موضوع:* ${letter.subject}\n\n` +
                     `💡 جهت مشاهده و تایید واقعی، وارد سامانه شوید یا از دکمه‌های زیر در ربات استفاده کنید:`;
                     
        const inline_keyboard = [
            [
                { text: '📥 دریافت PDF', callback_data: `SEC_GET_PDF_${letter.id}` },
                { text: '📥 دریافت Word', callback_data: `SEC_GET_DOC_${letter.id}` }
            ],
            [{ text: '✍️ تایید و امضا', callback_data: `SEC_APPROVE_${letter.id}` }]
        ];
        
        // --- IN-APP NOTIFICATION ---
        const targetUsernames = userIdsToNotify.map(uid => db.users.find(u => u.id === uid)?.username).filter(Boolean);
        if (targetUsernames.length > 0) {
            if (!db.notifications) db.notifications = [];
            db.notifications.push({
                id: utils.generateUUID(),
                title: "نامه اداری جدید",
                body: `نامه با موضوع "${letter.subject}" منتظر بررسی یا امضای شماست.`,
                url: "/secretariat",
                targetRoles: null,
                targetUsernames: targetUsernames,
                excludeUsernames: null,
                createdAt: Date.now(),
                readBy: []
            });
            if (db.notifications.length > 2000) db.notifications = db.notifications.slice(-1000);
            dbManager.saveDb(db);
        }
        
        const baleModule = await import('./bale.js');
        const tgModule = await import('./telegram.js');
        
        for (const uid of userIdsToNotify) {
            const u = db.users.find(usr => usr.id === uid);
            if (!u) continue;
            
            if (u.telegramChatId) {
                try {
                    await tgModule.sendBotMessage(u.telegramChatId, text, { reply_markup: { inline_keyboard } });
                } catch(e) {
                    console.error(`Failed to notify ${u.fullName} via Telegram:`, e.message);
                }
            }
            if (u.baleChatId) {
                try {
                    await baleModule.sendBotMessage(u.baleChatId, text, { reply_markup: { inline_keyboard } });
                } catch(e) {
                    console.error(`Failed to notify ${u.fullName} via Bale:`, e.message);
                }
            }
        }
    } catch (err) {
        console.error("notifySecretariatLetter error:", err);
    }
};
