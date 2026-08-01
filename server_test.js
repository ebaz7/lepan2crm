
// --- SYSTEM RESTARTED TO RESOLVE DEPLOYMENT ERROR ---
import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import compression from 'compression'; 
import { fileURLToPath } from 'url';
import cron from 'node-cron'; 
import archiver from 'archiver';
import AdmZip from 'adm-zip';
import webpush from 'web-push';
import * as dbManager from './backend/db-manager.js';
import * as utils from './backend/utils.js';
import { notifyExitPermitStep, notifyPaymentOrderStep, notifyWarehouseBijak, notifyMeetingAnnouncement, notifyMeetingMinutes, notifyPurchaseRequestStep, runDailyReport, notifySecretariatLetter, getCustomerBalancesData } from './backend/bot-core.js';
import * as telegram from './backend/telegram.js';
import * as bale from './backend/bale.js';
import * as Renderer from './backend/renderer.js';
import mammoth from 'mammoth';
import { GoogleGenAI, Type } from '@google/genai';
import * as jalaali from 'jalaali-js';

const getDb = dbManager.getDb;
const saveDb = dbManager.saveDb;
const findNextGapNumber = utils.findNextGapNumber;
const checkForDuplicate = utils.checkForDuplicate;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = process.cwd(); 

// --- CRITICAL FIX FOR PUPPETEER PATH ---
const PUPPETEER_CACHE = path.join(ROOT_DIR, '.puppeteer');
if (!fs.existsSync(PUPPETEER_CACHE)) {
    try { fs.mkdirSync(PUPPETEER_CACHE, { recursive: true }); } catch(e) {}
}
process.env.PUPPETEER_CACHE_DIR = PUPPETEER_CACHE;

process.on('uncaughtException', (err) => {
    console.error('CRITICAL ERROR (Uncaught Exception):', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL ERROR (Unhandled Rejection):', reason);
});

// Safe Import Helper
const safeImport = async (modulePath) => {
    try {
        return await import(modulePath);
    } catch (e) {
        console.error(`⚠️ Failed to load module ${modulePath}:`, e.message);
        return null;
    }
};

const DB_FILE = path.join(ROOT_DIR, 'database.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups'); 

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

// --- WEB PUSH SETUP ---
const VAPID_FILE = path.join(ROOT_DIR, 'vapid.json');
let vapidKeys;
if (fs.existsSync(VAPID_FILE)) {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf8'));
} else {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys));
}

webpush.setVapidDetails(
    'mailto:admin@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); 
// Maximum compression for speed
app.use(compression({ level: 5 })); 
// INCREASED LIMIT TO 1GB TO SUPPORT FULL SYSTEM RESTORE (Files + DB)
app.use(express.json({ limit: '1024mb' })); 
app.use(express.urlencoded({ limit: '1024mb', extended: true }));

// --- ANTI-CACHE MIDDLEWARE (OPTIMIZED) ---
// We allow ETag/Last-Modified validation (no-cache) but remove no-store to allow 304 Not Modified.
// This significantly speeds up reloads on CDNs/Domains by avoiding full data transfer if unchanged.
app.use((req, res, next) => {
    if (req.method === 'GET') {
        res.set('Cache-Control', 'no-cache, must-revalidate, private');
        // Remove Pragma and Expires to allow ETag validation
    } else {
        // For mutations, we still want to be strict
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
    next();
});

// --- DYNAMIC MANIFEST.JSON ---
app.get('/manifest.json', (req, res) => {
    const db = getDb();
    const settings = db.settings || {};
    const appName = settings.appName || 'مدیریت کارخانه';
    const pwaIcon = settings.pwaIcon || '/icons/icon-512x512.png';

    const manifest = {
        name: appName,
        short_name: appName,
        description: appName,
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0d9488',
        icons: [
            {
                src: pwaIcon,
                sizes: "192x192",
                type: "image/png"
            },
            {
                src: pwaIcon,
                sizes: "512x512",
                type: "image/png"
            }
        ],
        share_target: {
            action: "/api/share-target",
            method: "POST",
            enctype: "multipart/form-data",
            params: {
                title: "title",
                text: "text",
                url: "url",
                files: [
                    {
                        name: "files",
                        accept: [
                            "image/*",
                            "video/*",
                            "audio/*",
                            "application/*",
                            "text/*"
                        ]
                    }
                ]
            }
        }
    };
    res.json(manifest);
});

app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '7d' })); // Cache uploads for speed

// --- SHARE TARGET FOR ANDROID AND PWA ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '_' + file.originalname;
        cb(null, uniqueSuffix);
    }
});
const upload = multer({ storage: storage });

app.post('/api/share-target', upload.single('files'), (req, res) => {
    const text = req.body.text || req.body.url || '';
    let sharedUrl = '';
    if (req.file) {
        sharedUrl = `/uploads/${req.file.filename}`;
    }
    const redirectUrl = `/?sharedFileUrl=${encodeURIComponent(sharedUrl)}&sharedText=${encodeURIComponent(text)}`;
    res.redirect(redirectUrl);
});

// Shared data logic moved to db-manager.js and utils.js

// --- AUTOMATIC BACKUP LOGIC ---
let activeBackupJob = null;

const performAutoBackup = () => {
    const db = getDb();
    const settings = db.settings || {};
    const mode = settings.backupMode || 'full'; // 'full' or 'db-only'
    
    console.log(`>>> Starting Automatic Backup (Mode: ${mode})...`);
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16); 
        const filename = `AutoBackup_${mode === 'full' ? 'Full' : 'DB'}_${timestamp}.zip`;
        const filePath = path.join(BACKUPS_DIR, filename);
        
        const output = fs.createWriteStream(filePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log(`✅ Auto Backup Created: ${filename} (${(archive.pointer() / 1024 / 1024).toFixed(2)} MB)`);
        });

        archive.on('error', (err) => { throw err; });
        archive.pipe(output);

        if (fs.existsSync(DB_FILE)) {
            archive.file(DB_FILE, { name: 'database.json' });
        }

        if (mode === 'full' && fs.existsSync(UPLOADS_DIR)) {
            archive.directory(UPLOADS_DIR, 'uploads');
        }

        archive.finalize();
        
        // Cleanup old backups (keep last 20)
        setTimeout(() => {
            try {
                const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('AutoBackup_')).sort();
                if (files.length > 20) {
                    const toDelete = files.slice(0, files.length - 20);
                    toDelete.forEach(f => fs.unlinkSync(path.join(BACKUPS_DIR, f)));
                    console.log(`🧹 Cleaned up ${toDelete.length} old backups.`);
                }
            } catch(e) { console.error("Cleanup error", e); }
        }, 10000); 

    } catch (e) {
        console.error("❌ Automatic Backup Failed:", e);
    }
};

const setupAutoBackup = () => {
    if (activeBackupJob) {
        activeBackupJob.stop();
        activeBackupJob = null;
    }
    
    const db = getDb();
    const intervalHours = Number(db.settings.backupIntervalHours) || 3;
    console.log(`>>> Scheduling Auto Backup every ${intervalHours} hours.`);
    
    // Convert hours to cron expression: 0 */X * * *
    activeBackupJob = cron.schedule(`0 */${intervalHours} * * *`, performAutoBackup);
};

const setupDailyReports = () => {
    // Schedule daily reports for 23:45 Tehran time
    // Cron runs in UTC. Tehran is UTC+3:30. So 23:45 Tehran is 20:15 UTC.
    cron.schedule('15 20 * * *', async () => {
        console.log(">>> Running Automatic Daily Reports...");
        const db = getDb();
        const settings = db.settings || {};
        
        // Get Tehran current date in Shamsi format for the report
        const now = new Date();
        const dateStr = utils.toShamsiFull(now.toISOString()).split(' ')[0].replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); // Normalize to English digits
        
        // Groups to notify
        const targets = [];
        
        // 1. Accounting Groups
        if (settings.botAccountingGroupIdTele) targets.push({ platform: 'telegram', id: settings.botAccountingGroupIdTele, type: 'accounting' });
        if (settings.botAccountingGroupIdBale) targets.push({ platform: 'bale', id: settings.botAccountingGroupIdBale, type: 'accounting' });
        if (settings.botAccountingGroupId) targets.push({ platform: 'telegram', id: settings.botAccountingGroupId, type: 'accounting' }); // Fallback

        // 2. Bijak Groups
        if (settings.botBijakGroupId) targets.push({ platform: 'telegram', id: settings.botBijakGroupId, type: 'bijak' });
        if (settings.botBijakGroupIdBale) targets.push({ platform: 'bale', id: settings.botBijakGroupIdBale, type: 'bijak' });

        // 3. Exit Permit Groups (First, Second, Third, and/or Dedicated based on configuration)
        const sendToFirst = settings.dailyExitReportSendToFirstGroup !== false;
        const sendToSecond = settings.dailyExitReportSendToSecondGroup === true;
        const sendToThird = settings.dailyExitReportSendToThirdGroup === true;
        const sendToDedicated = settings.dailyExitReportSendToDedicatedGroup === true;

        if (sendToFirst) {
            if (settings.exitPermitNotificationTelegramId) targets.push({ platform: 'telegram', id: settings.exitPermitNotificationTelegramId, type: 'exit' });
            if (settings.exitPermitNotificationBaleId) targets.push({ platform: 'bale', id: settings.exitPermitNotificationBaleId, type: 'exit' });
            
            if (settings.exitPermitFirstGroupConfig?.telegramId) targets.push({ platform: 'telegram', id: settings.exitPermitFirstGroupConfig.telegramId, type: 'exit' });
            if (settings.exitPermitFirstGroupConfig?.baleId) targets.push({ platform: 'bale', id: settings.exitPermitFirstGroupConfig.baleId, type: 'exit' });
        }
        
        if (sendToSecond) {
            if (settings.exitPermitSecondGroupConfig?.telegramId) targets.push({ platform: 'telegram', id: settings.exitPermitSecondGroupConfig.telegramId, type: 'exit' });
            if (settings.exitPermitSecondGroupConfig?.baleId) targets.push({ platform: 'bale', id: settings.exitPermitSecondGroupConfig.baleId, type: 'exit' });
        }

        if (sendToThird) {
            if (settings.exitPermitThirdGroupConfig?.telegramId) targets.push({ platform: 'telegram', id: settings.exitPermitThirdGroupConfig.telegramId, type: 'exit' });
            if (settings.exitPermitThirdGroupConfig?.baleId) targets.push({ platform: 'bale', id: settings.exitPermitThirdGroupConfig.baleId, type: 'exit' });
        }

        if (sendToDedicated) {
            if (settings.dailyExitReportDedicatedTelegramId) targets.push({ platform: 'telegram', id: settings.dailyExitReportDedicatedTelegramId, type: 'exit' });
            if (settings.dailyExitReportDedicatedBaleId) targets.push({ platform: 'bale', id: settings.dailyExitReportDedicatedBaleId, type: 'exit' });
        }

        // Remove duplicates
        const uniqueTargets = Array.from(new Set(targets.map(t => `${t.platform}:${t.id}`)))
            .map(uid => targets.find(t => `${t.platform}:${t.id}` === uid));

        for (const target of uniqueTargets) {
            try {
                const sendFn = async (id, txt, opts) => {
                    if (target.platform === 'telegram') return telegram.sendBotMessage(id, txt, opts);
                    if (target.platform === 'bale') return bale.sendBotMessage(id, txt, opts);
                };
                const sendDocFn = async (id, buf, name, cap) => {
                    if (target.platform === 'telegram') return telegram.sendBotDocument(id, buf, name, cap);
                    if (target.platform === 'bale') return bale.sendBotDocument(id, buf, name, cap);
                };
                
                console.log(`[Cron] Sending daily report to ${target.platform} group ${target.id}`);
                await runDailyReport(target.platform, target.id, dateStr, sendFn, sendDocFn);
            } catch (e) {
                console.error(`[Cron] Failed to send daily report to ${target.id}:`, e.message);
            }
        }
    });

// Helper to build Persian captioned production report
const buildProductionCaption = (dateStr, totals, waste) => {
    let dateObj = new Date();
    if (typeof dateStr === 'string' && dateStr.includes('/')) {
        const engDateStr = dateStr.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
        const parts = engDateStr.split('/').map(x => parseInt(x));
        if (parts.length === 3) {
            const { gy, gm, gd } = jalaali.toGregorian(parts[0], parts[1], parts[2]);
            dateObj = new Date(gy, gm - 1, gd, 12, 0, 0);
        }
    } else if (dateStr) {
        dateObj = new Date(dateStr);
    }

    const dayLabel = utils.toShamsiWeekdayAndDay(dateObj);
    const poyQty = utils.toPersianDigitsNoGrouping(totals.qty_61);
    const poyPct = utils.toPersianDigitsNoGrouping(waste.pct_61);
    const stretchQty = utils.toPersianDigitsNoGrouping(totals.qty_67);
    const stretchPct = utils.toPersianDigitsNoGrouping(waste.pct_67);
    const keshQty = utils.toPersianDigitsNoGrouping(totals.qty_79);
    const keshPct = utils.toPersianDigitsNoGrouping(waste.pct_79);
    const spandexQty = utils.toPersianDigitsNoGrouping(totals.qty_73);
    const spandexPct = utils.toPersianDigitsNoGrouping(waste.pct_73);
    const grandTotalVal = totals.grandTotal !== undefined && totals.grandTotal !== null ? totals.grandTotal : ((totals.qty_61 || 0) + (totals.qty_67 || 0) + (totals.qty_79 || 0) + (totals.qty_73 || 0));
    const totalWasteVal = waste.totalWaste !== undefined && waste.totalWaste !== null ? waste.totalWaste : ((waste.waste_61 || 0) + (waste.waste_67 || 0) + (waste.waste_79 || 0) + (waste.waste_73 || 0));
    
    const grandTotal = utils.toPersianDigitsNoGrouping(grandTotalVal);
    const totalWaste = utils.toPersianDigitsNoGrouping(totalWasteVal);

    return `تولید روز ${dayLabel}
کش:${keshQty}
درصد ضایعات:${keshPct}
اسپندکس:${spandexQty}
درصد ضایعات:${spandexPct}
استرچ:${stretchQty}
درصد ضایعات:${stretchPct}
پی او وای:${poyQty}
درصد ضایعات:${poyPct}
مجموع تولید:${grandTotal}
مجموع ضایعات:${totalWaste}`;
};

// Helper to generate and send daily sales report for a specific Date
const sendDailySalesReportForDate = async (db, dateObj, labelSuffix = '', targetsOverride = null) => {
    const settings = db.settings || {};
    const shamsiDate = utils.toShamsiFull(dateObj.toISOString()).split(' ')[0].replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); // Normalize to English digits
    const gregDate = utils.getTehranDateString(dateObj);

    const salesTargets = targetsOverride ? [...targetsOverride] : [];
    if (!targetsOverride) {
        if (settings.dailySalesTelegramGroupId) salesTargets.push({ platform: 'telegram', id: settings.dailySalesTelegramGroupId });
        if (settings.dailySalesBaleGroupId) salesTargets.push({ platform: 'bale', id: settings.dailySalesBaleGroupId });
        if (settings.dailySalesWhatsappGroupId) salesTargets.push({ platform: 'whatsapp', id: settings.dailySalesWhatsappGroupId });
        if (settings.botAccountingGroupIdTele) salesTargets.push({ platform: 'telegram', id: settings.botAccountingGroupIdTele });
        if (settings.botAccountingGroupIdBale) salesTargets.push({ platform: 'bale', id: settings.botAccountingGroupIdBale });
        if (settings.botAccountingGroupIdWhatsApp) salesTargets.push({ platform: 'whatsapp', id: settings.botAccountingGroupIdWhatsApp });
        if (settings.botAccountingGroupId) salesTargets.push({ platform: 'telegram', id: settings.botAccountingGroupId });
        if (settings.reportsGroupId) salesTargets.push({ platform: 'telegram', id: settings.reportsGroupId });
        if (settings.telegramReportsGroupId) salesTargets.push({ platform: 'telegram', id: settings.telegramReportsGroupId });
        if (settings.telegramReportsGroupId2) salesTargets.push({ platform: 'telegram', id: settings.telegramReportsGroupId2 });
        if (settings.baleReportsGroupId) salesTargets.push({ platform: 'bale', id: settings.baleReportsGroupId });
        if (settings.baleReportsGroupId2) salesTargets.push({ platform: 'bale', id: settings.baleReportsGroupId2 });
        if (settings.whatsappReportsGroupId) salesTargets.push({ platform: 'whatsapp', id: settings.whatsappReportsGroupId });
        if (settings.whatsappReportsGroupId2) salesTargets.push({ platform: 'whatsapp', id: settings.whatsappReportsGroupId2 });
        if (settings.telegramChatId) salesTargets.push({ platform: 'telegram', id: settings.telegramChatId });
        if (settings.baleChatId) salesTargets.push({ platform: 'bale', id: settings.baleChatId });

        if (db.groups && Array.isArray(db.groups)) {
            db.groups.forEach(g => {
                if (g.chatId) salesTargets.push({ platform: g.platform || 'telegram', id: g.chatId });
            });
        }
    }

    const uniqueSalesTargets = [];
    const seenMap = new Set();
    for (const t of salesTargets) {
        const cleanId = utils.sanitizeGroupId(t.id);
        if (!cleanId) continue;
        const key = `${t.platform}_${cleanId}`;
        if (!seenMap.has(key)) {
            seenMap.add(key);
            uniqueSalesTargets.push({ platform: t.platform, id: cleanId });
        }
    }

    if (uniqueSalesTargets.length === 0) {
        throw new Error('گروهی برای ارسال گزارش فروش (تلگرام یا بله) در تنظیمات سیستم ثبت نشده است.');
    }

    // Fetch sales and returns data from Sayan ERP
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
            t07.Field_006 as CustomerName,
            t10.Field_009 as OpCode
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
        WHERE (
            (t10.Field_009 IN ('3', '12', '23') AND t11.Field_036 = t10.Field_009 AND t11.Field_007 > 0)
            OR 
            (t10.Field_009 = '13' AND t11.Field_036 IN ('3', '12', '23', '13'))
          )
          AND (t10.Field_008 = '${gregDate}' OR t10.Field_008 LIKE '${gregDate}%' OR t10.Field_008 BETWEEN '${gregDate}T00:00:00.000Z' AND '${gregDate}T23:59:59.999Z')
        ORDER BY t10.Field_008 DESC
    `;

    const salesRows = await executeSayanQuery(db, sql);
    
    // Always create a PDF even if empty, or just return empty message. But wait, if salesRows is empty it's fine.
    if (salesRows.length > 0) {
        const title = `گزارش رسمی فروش روزانه سایان - مورخ ${shamsiDate} (${labelSuffix})`;
        const columns = ['ردیف', 'گروه / کالا', 'فروش (ک‌گ / ریال)', 'مرجوعی (ک‌گ / ریال)', 'خالص (ک‌گ / ریال)', 'فی نهایی (ریال)'];
        
        const groupedMap = new Map();
        let totalSalesQty = 0;
        let totalSalesAmt = 0;
        let totalReturnQty = 0;
        let totalReturnAmt = 0;
        
        salesRows.forEach(inv => {
            const key = `${inv.GroupName || ''}_${inv.ItemName || ''}`;
            const qty = parseFloat(inv.Quantity || 0);
            const amt = parseFloat(inv.Amount || 0);
            const isReturn = inv.OpCode === '13';
            
            if (isReturn) {
                totalReturnQty += qty;
                totalReturnAmt += amt;
            } else {
                totalSalesQty += qty;
                totalSalesAmt += amt;
            }
            
            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    itemName: inv.ItemName || 'کالای بدون نام',
                    groupName: inv.GroupName || 'سایر گروه‌ها',
                    salesQty: 0,
                    salesAmt: 0,
                    returnQty: 0,
                    returnAmt: 0
                });
            }
            
            const existing = groupedMap.get(key);
            if (isReturn) {
                existing.returnQty += qty;
                existing.returnAmt += amt;
            } else {
                existing.salesQty += qty;
                existing.salesAmt += amt;
            }
        });
        
        const groupedRows = Array.from(groupedMap.values());
        
        const tableRows = groupedRows.map((row, idx) => {
            const netQty = row.salesQty - row.returnQty;
            const netAmt = row.salesAmt - row.returnAmt;
            const finalPrice = netQty > 0 ? (netAmt / netQty) : 0;
            return [
                (idx + 1).toLocaleString('fa-IR'),
                `${row.groupName} - ${row.itemName}`,
                `${row.salesQty.toLocaleString('fa-IR')} / ${row.salesAmt.toLocaleString('fa-IR')}`,
                `${row.returnQty.toLocaleString('fa-IR')} / ${row.returnAmt.toLocaleString('fa-IR')}`,
                `${netQty.toLocaleString('fa-IR')} / ${netAmt.toLocaleString('fa-IR')}`,
                Math.round(finalPrice).toLocaleString('fa-IR')
            ];
        });
        
        const grandNetQty = totalSalesQty - totalReturnQty;
        const grandNetAmt = totalSalesAmt - totalReturnAmt;
        const grandFinalPrice = grandNetQty > 0 ? (grandNetAmt / grandNetQty) : 0;
        
        tableRows.push([
            'جمع کل',
            '-',
            `${totalSalesQty.toLocaleString('fa-IR')} / ${totalSalesAmt.toLocaleString('fa-IR')}`,
            `${totalReturnQty.toLocaleString('fa-IR')} / ${totalReturnAmt.toLocaleString('fa-IR')}`,
            `${grandNetQty.toLocaleString('fa-IR')} / ${grandNetAmt.toLocaleString('fa-IR')}`,
            Math.round(grandFinalPrice).toLocaleString('fa-IR')
        ]);
        
        const pdfBuffer = await Renderer.generateReportPDF(title, columns, tableRows, true); // Landscape
        
        const filename = `Sayan_Daily_Sales_${gregDate}_${labelSuffix === 'دیروز' ? 'Yesterday' : 'Today'}.pdf`;
        
        const caption = `📊 *گزارش فروش روزانه (${labelSuffix} - سایان ERP)*
📅 *تاریخ:* ${shamsiDate}
🧾 تعداد اقلام: ${groupedRows.length}
✅ مجموع مقدار خالص: ${grandNetQty.toLocaleString('fa-IR')} کیلوگرم
💵 فروش خالص: ${grandNetAmt.toLocaleString('fa-IR')} ریال
➖ مرجوعی: ${totalReturnAmt.toLocaleString('fa-IR')} ریال`;

        let successfulSends = 0;
        let lastErr = null;
        for (const tgt of uniqueSalesTargets) {
            try {
                if (tgt.platform === 'telegram') {
                    await telegram.sendBotDocument(tgt.id, pdfBuffer, filename, caption);
                    successfulSends++;
                } else if (tgt.platform === 'bale') {
                    await bale.sendBotDocument(tgt.id, pdfBuffer, filename, caption);
                    successfulSends++;
                } else if (tgt.platform === 'whatsapp') {
                    const wa = await safeImport('./backend/whatsapp.js');
                    if (wa && wa.sendMessage) {
                        await wa.sendMessage(tgt.id, caption, {
                            data: pdfBuffer.toString('base64'),
                            mimeType: 'application/pdf',
                            filename: filename
                        });
                        successfulSends++;
                    }
                }
            } catch (e) {
                lastErr = e.message;
                console.error(`[Manual/Auto Sales Report] Failed to send to ${tgt.platform} group ${tgt.id}:`, e.message);
            }
        }

        if (successfulSends === 0) {
            throw new Error(`ارسال گزارش فروش ناموفق بود: ${lastErr || 'خطا در اتصال به پیام‌رسان‌ها'}`);
        }

        return { count: salesRows.length, totalSalesQty, totalSalesAmt, sent: true, successfulSends };

    } else {
        const emptyMsg = `⚠️ هیچ فاکتور فروشی برای ${labelSuffix} (${shamsiDate}) در سرور سایان ثبت نشده است.`;
        let successfulSends = 0;
        let lastErr = null;
        for (const tgt of uniqueSalesTargets) {
            try {
                if (tgt.platform === 'telegram') {
                    await telegram.sendBotMessage(tgt.id, emptyMsg);
                    successfulSends++;
                } else if (tgt.platform === 'bale') {
                    await bale.sendBotMessage(tgt.id, emptyMsg);
                    successfulSends++;
                } else if (tgt.platform === 'whatsapp') {
                    const wa = await safeImport('./backend/whatsapp.js');
                    if (wa && wa.sendMessage) {
                        await wa.sendMessage(tgt.id, emptyMsg);
                        successfulSends++;
                    }
                }
            } catch (e) {
                lastErr = e.message;
                console.error(`[Manual/Auto Sales Report] Failed to send empty msg to ${tgt.platform} group ${tgt.id}:`, e.message);
            }
        }

        if (successfulSends === 0) {
            throw new Error(`ارسال پیام عدم وجود فاکتور فروش ناموفق بود: ${lastErr || 'خطا در پیام‌رسان‌ها'}`);
        }

        return { count: 0, sent: true, successfulSends };
    }
};




// Schedule daily automated reports for 19:00 Tehran time (15:30 UTC)
cron.schedule('30 15 * * *', async () => {
    console.log(">>> Running Automated 19:00 Reports (Sales)...");
    const db = getDb();
    const settings = db.settings || {};

    try {
        const today = new Date();
        await sendDailySalesReportForDate(db, today, 'امروز', null);
    } catch (err) {
        console.error("[Cron 19:00] Daily sales (today) automatic cron error:", err);
    }
    
    try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        await sendDailySalesReportForDate(db, yesterday, 'دیروز', null);
    } catch (err) {
        console.error("[Cron 19:00] Daily sales (yesterday) automatic cron error:", err);
    }
});

// --- SAYAN PRODUCTION REPORT ENDPOINTS ---
const normalizeShamsiDate = (str) => {
    if (!str) return '';
    return String(str).trim()
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .replace(/-/g, '/');
};

const parseJalaliStrToGregorian = (jalaliStr) => {
    const clean = normalizeShamsiDate(jalaliStr);
    if (!clean) return null;
    const parts = clean.split('/').map(p => parseInt(p, 10));
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    try {
        const g = jalaali.toGregorian(parts[0], parts[1], parts[2]);
        const y = g.gy;
        const m = String(g.gm).padStart(2, '0');
        const d = String(g.gd).padStart(2, '0');
        return `${y}-${m}-${d}`;
    } catch (e) {
        return null;
    }
};

const executeSayanQuery = async (db, queryStr) => {
    const settings = db.settings || {};
    const serverSayanBaseUrl = settings.sayanApiUrl || process.env.SAYAN_API_URL;
    const serverSayanApiKey = settings.sayanApiKey || process.env.SAYAN_API_KEY;
    if (!serverSayanBaseUrl || !serverSayanApiKey) {
        throw new Error('تنظیمات آدرس API و کلید امنیتی سایان در بخش تنظیمات سیستم وارد نشده است.');
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
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'خطا در برقراری ارتباط با دیتابیس سایان ERP');
    }
    const data = await response.json();
    return data.data || [];
};

app.get('/api/sayan/production-report', async (req, res) => {
    try {
        const db = getDb();
        const rawFrom = req.query.dateFrom || '';
        const rawTo = req.query.dateTo || rawFrom;

        const dateFrom = normalizeShamsiDate(rawFrom);
        const dateTo = normalizeShamsiDate(rawTo) || dateFrom;

        if (!dateFrom) {
            return res.status(400).json({ error: 'تاریخ ابتدا مشخص نشده است' });
        }

        const gregFromDate = parseJalaliStrToGregorian(dateFrom);
        const gregToDate = parseJalaliStrToGregorian(dateTo);

        if (!gregFromDate || !gregToDate) {
            return res.status(400).json({ error: 'فرمت تاریخ شمسی وارد شده نامعتبر است (مثال: 1405/05/02)' });
        }

        const cleanDateFrom = dateFrom;
        const cleanDateTo = dateTo;

        const sql = `
            SELECT 
                t10.Field_001 as DocId,
                t10.Field_008 as Date,
                RTRIM(LTRIM(t10.Field_009)) as DocType,
                t11.Field_005 as ItemCode,
                COALESCE(t_name.ItemName, t22.Field_004, t11.Field_005, 'کالای بدون نام') as ItemName,
                t11.Field_006 as Quantity
            FROM STR_TBL_010 t10
            INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
            LEFT JOIN (
                SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as ItemName
                FROM IND_TBL_021 t21_sub
                LEFT JOIN IND_TBL_002 t02_sub ON t21_sub.Field_003 = t02_sub.Field_008
                GROUP BY t21_sub.Field_004
            ) t_name ON t_name.ItemCode = RTRIM(LTRIM(t11.Field_005))
            LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
            WHERE RTRIM(LTRIM(t10.Field_009)) IN ('61', '67', '79', '73')
              AND t10.Field_008 >= '${gregFromDate}T00:00:00.000Z'
              AND t10.Field_008 <= '${gregToDate}T23:59:59.999Z'
            ORDER BY COALESCE(t_name.ItemName, t22.Field_004, t11.Field_005, 'کالای بدون نام'), t10.Field_008
        `;

        const rawRows = await executeSayanQuery(db, sql);

        const itemsMap = new Map();
        let qty_61 = 0, qty_67 = 0, qty_79 = 0, qty_73 = 0;

        rawRows.forEach(r => {
            const itemCode = String(r.ItemCode || '').trim();
            let rawName = (r.ItemName || itemCode || 'کالای بدون نام').trim();
            const qty = parseFloat(r.Quantity || 0);
            const docType = String(r.DocType).trim();

            // Fallback for intermediate production codes that don't have registered names in master tables
            if (rawName === itemCode && itemCode) {
                if (docType === '61') rawName = `نخ POY (${itemCode})`;
                else if (docType === '67') rawName = `نخ DTY (${itemCode})`;
                else if (docType === '79') rawName = `نخ کش (${itemCode})`;
                else if (docType === '73') rawName = `نخ اسپاندکس (${itemCode})`;
            }

            if (!itemsMap.has(rawName)) {
                itemsMap.set(rawName, {
                    name: rawName,
                    unit: 'کیلوگرم',
                    qty_61: 0,
                    qty_67: 0,
                    qty_79: 0,
                    qty_73: 0,
                    total: 0
                });
            }

            const item = itemsMap.get(rawName);
            if (docType === '61') { item.qty_61 += qty; qty_61 += qty; }
            else if (docType === '67') { item.qty_67 += qty; qty_67 += qty; }
            else if (docType === '79') { item.qty_79 += qty; qty_79 += qty; }
            else if (docType === '73') { item.qty_73 += qty; qty_73 += qty; }
            item.total += qty;
        });

        const items = Array.from(itemsMap.values());
        const grandTotal = qty_61 + qty_67 + qty_79 + qty_73;

        const key = `${dateFrom}_${dateTo}`;
        db.productionReportWastes = db.productionReportWastes || {};
        db.productionWasteArchive = db.productionWasteArchive || [];

        let waste_61 = 0;
        let waste_67 = 0;
        let waste_79 = 0;
        let waste_73 = 0;
        let detailsList = [];
        let foundInArchive = false;

        const matchingEntries = db.productionWasteArchive.filter(entry => {
            return entry.dateFrom >= dateFrom && entry.dateTo <= dateTo;
        });

        if (matchingEntries.length > 0) {
            foundInArchive = true;
            matchingEntries.forEach(entry => {
                waste_61 += parseFloat(entry.waste_61 || 0);
                waste_67 += parseFloat(entry.waste_67 || 0);
                waste_79 += parseFloat(entry.waste_79 || 0);
                waste_73 += parseFloat(entry.waste_73 || 0);
                if (entry.details && entry.details.trim()) {
                    detailsList.push(`[${entry.dateFrom}]: ${entry.details}`);
                }
            });
        }

        if (!foundInArchive) {
            const storedWaste = db.productionReportWastes[key] || {
                waste_61: 0,
                waste_67: 0,
                waste_79: 0,
                waste_73: 0,
                details: ''
            };
            waste_61 = parseFloat(storedWaste.waste_61 || 0);
            waste_67 = parseFloat(storedWaste.waste_67 || 0);
            waste_79 = parseFloat(storedWaste.waste_79 || 0);
            waste_73 = parseFloat(storedWaste.waste_73 || 0);
            if (storedWaste.details && storedWaste.details.trim()) {
                detailsList.push(storedWaste.details);
            }
        }

        const totalWaste = waste_61 + waste_67 + waste_79 + waste_73;
        const pct_61 = qty_61 > 0 ? (waste_61 / qty_61) * 100 : 0;
        const pct_67 = qty_67 > 0 ? (waste_67 / qty_67) * 100 : 0;
        const pct_79 = qty_79 > 0 ? (waste_79 / qty_79) * 100 : 0;
        const pct_73 = qty_73 > 0 ? (waste_73 / qty_73) * 100 : 0;
        const totalPct = grandTotal > 0 ? (totalWaste / grandTotal) * 100 : 0;

        res.json({
            success: true,
            dateFrom,
            dateTo,
            items,
            totals: {
                qty_61,
                qty_67,
                qty_79,
                qty_73,
                grandTotal
            },
            waste: {
                waste_61,
                waste_67,
                waste_79,
                waste_73,
                totalWaste,
                pct_61,
                pct_67,
                pct_79,
                pct_73,
                totalPct,
                details: detailsList.join(' | ') || ''
            }
        });
    } catch (e) {
        console.error("Sayan Production Report Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/sayan/production-report/save-waste', (req, res) => {
    try {
        const db = getDb();
        const { dateFrom, dateTo, waste_61, waste_67, waste_79, waste_73, details, totals, items } = req.body;
        if (!dateFrom || !dateTo) {
            return res.status(400).json({ error: 'تاریخ ابتدا و انتها الزامی است' });
        }
        const key = `${dateFrom}_${dateTo}`;
        db.productionReportWastes = db.productionReportWastes || {};
        db.productionReportWastes[key] = {
            waste_61: parseFloat(waste_61 || 0),
            waste_67: parseFloat(waste_67 || 0),
            waste_79: parseFloat(waste_79 || 0),
            waste_73: parseFloat(waste_73 || 0),
            details: String(details || '').trim(),
            updatedAt: new Date().toISOString()
        };

        // Archive and persist history
        db.productionWasteArchive = db.productionWasteArchive || [];
        const existingIdx = db.productionWasteArchive.findIndex(entry => entry.dateFrom === dateFrom && entry.dateTo === dateTo);
        const w_61 = parseFloat(waste_61 || 0);
        const w_67 = parseFloat(waste_67 || 0);
        const w_79 = parseFloat(waste_79 || 0);
        const w_73 = parseFloat(waste_73 || 0);
        const totalW = w_61 + w_67 + w_79 + w_73;

        const archiveEntry = {
            id: existingIdx !== -1 ? db.productionWasteArchive[existingIdx].id : 'pwa_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            dateFrom,
            dateTo,
            waste_61: w_61,
            waste_67: w_67,
            waste_79: w_79,
            waste_73: w_73,
            totalWaste: totalW,
            details: String(details || '').trim(),
            totals: totals || null,
            items: items || null,
            updatedAt: new Date().toISOString()
        };

        if (existingIdx !== -1) {
            db.productionWasteArchive[existingIdx] = archiveEntry;
        } else {
            db.productionWasteArchive.push(archiveEntry);
        }

        saveDb(db);
        res.json({ success: true, message: 'اطلاعات ضایعات و آمار کل تولید با موفقیت در بایگانی ثبت گردید.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/sayan/production-report/archive', (req, res) => {
    try {
        const db = getDb();
        db.productionWasteArchive = db.productionWasteArchive || [];
        // Sort by dateFrom descending
        const sorted = [...db.productionWasteArchive].sort((a, b) => b.dateFrom.localeCompare(a.dateFrom));
        res.json({ success: true, archive: sorted });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/sayan/production-report/archive/:id', (req, res) => {
    try {
        const db = getDb();
        db.productionWasteArchive = db.productionWasteArchive || [];
        db.productionWasteArchive = db.productionWasteArchive.filter(entry => entry.id !== req.params.id);
        saveDb(db);
        res.json({ success: true, message: 'رکورد بایگانی با موفقیت حذف گردید.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/sayan/production-report/send-bot', async (req, res) => {
    try {
        const db = getDb();
        const { dateFrom, dateTo, items, totals, waste } = req.body;

        if (!dateFrom || !totals || !waste) {
            return res.status(400).json({ error: 'اطلاعات گزارش کامل نیست' });
        }

        const title = `گزارش آمار کل تولید و ضایعات (${dateFrom})`;
        const pdfBuffer = await Renderer.generateProductionReportPDF(title, dateFrom, dateTo, items, totals, waste);

        const caption = buildProductionCaption(dateFrom, totals, waste);

        const filename = `Production_Report_${dateFrom.replace(/[\/\\]/g, '-')}.pdf`;
        const settings = db.settings || {};
        
        // Collect target chat/group IDs
        const targetIds = [];
        if (settings.productionTelegramGroupId) targetIds.push({ platform: 'telegram', id: settings.productionTelegramGroupId });
        if (settings.productionBaleGroupId) targetIds.push({ platform: 'bale', id: settings.productionBaleGroupId });
        if (settings.productionWhatsappGroupId) targetIds.push({ platform: 'whatsapp', id: settings.productionWhatsappGroupId });
        if (settings.factoryGroupId) targetIds.push({ platform: 'telegram', id: settings.factoryGroupId });
        if (settings.accountingGroupId) targetIds.push({ platform: 'telegram', id: settings.accountingGroupId });
        if (settings.botAccountingGroupIdTele) targetIds.push({ platform: 'telegram', id: settings.botAccountingGroupIdTele });
        if (settings.botAccountingGroupIdBale) targetIds.push({ platform: 'bale', id: settings.botAccountingGroupIdBale });
        if (settings.botAccountingGroupIdWhatsApp) targetIds.push({ platform: 'whatsapp', id: settings.botAccountingGroupIdWhatsApp });
        if (settings.botAccountingGroupId) targetIds.push({ platform: 'telegram', id: settings.botAccountingGroupId });
        if (settings.reportsGroupId) targetIds.push({ platform: 'telegram', id: settings.reportsGroupId });
        if (settings.telegramReportsGroupId) targetIds.push({ platform: 'telegram', id: settings.telegramReportsGroupId });
        if (settings.telegramReportsGroupId2) targetIds.push({ platform: 'telegram', id: settings.telegramReportsGroupId2 });
        if (settings.baleReportsGroupId) targetIds.push({ platform: 'bale', id: settings.baleReportsGroupId });
        if (settings.baleReportsGroupId2) targetIds.push({ platform: 'bale', id: settings.baleReportsGroupId2 });
        if (settings.whatsappReportsGroupId) targetIds.push({ platform: 'whatsapp', id: settings.whatsappReportsGroupId });
        if (settings.whatsappReportsGroupId2) targetIds.push({ platform: 'whatsapp', id: settings.whatsappReportsGroupId2 });
        if (settings.telegramChatId) targetIds.push({ platform: 'telegram', id: settings.telegramChatId });
        if (settings.baleChatId) targetIds.push({ platform: 'bale', id: settings.baleChatId });
        
        // Add any subscribed groups from db
        if (db.groups && Array.isArray(db.groups)) {
            db.groups.forEach(g => {
                if (g.chatId) targetIds.push({ platform: g.platform || 'telegram', id: g.chatId });
            });
        }

        const uniqueTargets = [];
        const seenSet = new Set();
        for (const t of targetIds) {
            const cleanId = utils.sanitizeGroupId(t.id);
            if (!cleanId) continue;
            const key = `${t.platform}:${cleanId}`;
            if (!seenSet.has(key)) {
                seenSet.add(key);
                uniqueTargets.push({ platform: t.platform, id: cleanId });
            }
        }

        if (uniqueTargets.length === 0) {
            return res.status(400).json({ error: 'هیچ شناسه گروه یا چت باتی در تنظیمات سیستم یافت نشد.' });
        }

        let sentCount = 0;
        let lastError = null;
        for (const target of uniqueTargets) {
            try {
                if (target.platform === 'telegram') {
                    await telegram.sendBotDocument(target.id, pdfBuffer, filename, caption);
                    sentCount++;
                } else if (target.platform === 'bale') {
                    await bale.sendBotDocument(target.id, pdfBuffer, filename, caption);
                    sentCount++;
                } else if (target.platform === 'whatsapp') {
                    const wa = await safeImport('./backend/whatsapp.js');
                    if (wa && wa.sendMessage) {
                        await wa.sendMessage(target.id, caption, {
                            data: pdfBuffer.toString('base64'),
                            mimeType: 'application/pdf',
                            filename: filename
                        });
                        sentCount++;
                    }
                }
            } catch (err) {
                lastError = err.message;
                console.error(`[Send Production Report] Failed for ${target.platform}:${target.id}:`, err.message);
            }
        }

        if (sentCount === 0) {
            return res.status(400).json({ error: `ارسال گزارش آمار تولید ناموفق بود: ${lastError || 'خطای ناشناخته در اتصال به ربات'}` });
        }

        res.json({
            success: true,
            message: `گزارش با موفقیت به ${sentCount} گروه / چت در بات‌ها ارسال شد.`
        });
    } catch (e) {
        console.error("Send Production Report Bot Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/sayan/sales-report/send-manual', async (req, res) => {
    try {
        const db = getDb();
        const { targetDate } = req.body; // 'today' or 'yesterday'
        
        let dateObj = new Date();
        let label = 'امروز';
        if (targetDate === 'yesterday') {
            dateObj.setDate(dateObj.getDate() - 1);
            label = 'دیروز';
        }

        const result = await sendDailySalesReportForDate(db, dateObj, label);
        res.json({
            success: true,
            message: `گزارش فروش ${label} با موفقیت به پیام‌رسان‌ها ارسال شد.`,
            result
        });
    } catch (e) {
        console.error("Manual Sales Report Sending Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/users', (req, res) => { 
    const db = getDb(); 
    db.users.push(req.body); 
    saveDb(db); 
    res.json(db.users); 
});
app.put('/api/users/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.users.findIndex(u => u.id === req.params.id); 
    if(idx > -1) { 
        db.users[idx] = { ...db.users[idx], ...req.body }; 
        saveDb(db); 
        res.json(db.users); 
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/users/:id', (req, res) => { 
    const db = getDb(); 
    db.users = db.users.filter(u => u.id !== req.params.id); 
    saveDb(db); 
    res.json(db.users); 
});

app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

        const db = getDb();
        if (!db.users || !Array.isArray(db.users)) {
            console.error("CRITICAL: Users table missing or invalid", db.users);
            return res.status(500).json({ error: 'Database integrity error' });
        }

        const user = db.users.find(u => u.username === username && u.password === password);
        if (user) { 
            // Update Last Seen
            user.lastSeen = new Date().toISOString();
            saveDb(db);

            const { password, ...userWithoutPass } = user; 
            res.json(userWithoutPass); 
        } else { 
            res.status(401).json({ error: 'Invalid credentials' }); 
        }
    } catch (e) {
        console.error("Login Error:", e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// HEARTBEAT FOR LAST SEEN
app.post('/api/heartbeat', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).send('Missing username');
    
    const db = getDb();
    const user = db.users.find(u => u.username === username);
    if (user) {
        user.lastSeen = new Date().toISOString();
        
        // Keep active subscription timestamps fresh
        if (db.subscriptions) {
            let subUpdated = false;
            db.subscriptions.forEach(s => {
                if (s.username === username) {
                    s.updatedAt = Date.now();
                    subUpdated = true;
                }
            });
        }
        
        saveDb(db);
    }
    res.json({ success: true });
});

// BROADCAST TO BOT USERS
app.post('/api/bot/broadcast', async (req, res) => {
    try {
        const { message, platform = 'all', target = 'all' } = req.body;
        const db = getDb();
        
        let targetTargets = [];
        
        if (target === 'users') {
            targetTargets = db.users || [];
        } else if (target === 'contacts') {
            targetTargets = db.settings.savedContacts || [];
        } else if (target === 'all_subscribers') {
            const users = db.users || [];
            const contacts = db.settings.savedContacts || [];
            const subscribers = db.botSubscribers || []; // We'll add this
            targetTargets = [...users, ...contacts, ...subscribers];
        } else {
            // Default: All registered users who have linked their chat IDs
            targetTargets = db.users || [];
        }

        const botUsers = targetTargets.filter(u => u.telegramChatId || u.baleChatId || u.whatsappChatId || u.telegramId || u.baleId);
        
        let telegramCount = 0;
        let baleCount = 0;
        
        if (platform === 'all' || platform === 'telegram') {
            const telUsers = botUsers.filter(u => u.telegramChatId || u.telegramId);
            if (telUsers.length > 0) {
                const tgModule = await import('./backend/telegram.js');
                const uniqueIds = [...new Set(telUsers.map(u => u.telegramChatId || u.telegramId))];
                for (const chatId of uniqueIds) {
                    try { await tgModule.sendBotMessage(chatId, message); telegramCount++; } catch (e) { }
                }
            }
        }
        
        if (platform === 'all' || platform === 'bale') {
            const baleUsers = botUsers.filter(u => u.baleChatId || u.baleId);
            if (baleUsers.length > 0) {
                const baleModule = await import('./backend/bale.js');
                const uniqueIds = [...new Set(baleUsers.map(u => u.baleChatId || u.baleId))];
                for (const chatId of uniqueIds) {
                    try { await baleModule.sendBotMessage(chatId, message); baleCount++; } catch (e) { }
                }
            }
        }
        
        res.json({ success: true, count: telegramCount + baleCount });
    } catch (e) {
        console.error("Broadcast failed:", e);
        res.status(500).json({ error: 'Broadcast failed' });
    }
});

// 8. CHAT & COMMUNICATION
app.get('/api/chat', (req, res) => {
    res.json(getDb().messages || []);
});

app.get('/api/tickets', (req, res) => {
    res.json(getDb().tickets || []);
});

app.post('/api/tickets/:id/reply', async (req, res) => {
    const db = getDb();
    const ticketId = req.params.id;
    const { text, senderName } = req.body;
    
    db.tickets = db.tickets || [];
    const ticket = db.tickets.find(t => t.id === ticketId);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });

    const newMsg = {
        id: "msg_" + Math.random().toString(36).substr(2, 9),
        sender: 'admin',
        senderName: senderName || 'پشتیبانی',
        text: text,
        timestamp: new Date().toISOString()
    };
    ticket.messages.push(newMsg);
    ticket.updatedAt = Date.now();
    ticket.status = 'OPEN';
    saveDb(db);

    // Send to customer
    try {
        const replyMarkup = { inline_keyboard: [[{ text: '➕ ارسال پاسخ', callback_data: `GUEST_TICKET_REPLY_${ticket.id}` }]] };
        if (ticket.platform === 'telegram') {
            const tg = await safeImport('./backend/telegram.js');
            if (tg?.sendBotMessage) await tg.sendBotMessage(ticket.chatId, `📩 *پاسخ پشتیبانی به درخواست #${ticket.id}:*\n\n${text}`, { reply_markup: replyMarkup });
        } else if (ticket.platform === 'bale') {
            const bale = await safeImport('./backend/bale.js');
            if (bale?.sendBotMessage) await bale.sendBotMessage(ticket.chatId, `📩 *پاسخ پشتیبانی به درخواست #${ticket.id}:*\n\n${text}`, { reply_markup: replyMarkup });
        }
    } catch (e) { console.error("Ticket reply err:", e); }

    res.json(ticket);
});

app.put('/api/tickets/:id/status', (req, res) => {
    const db = getDb();
    const ticket = (db.tickets || []).find(t => t.id === req.params.id);
    if (!ticket) return res.status(404).json({ error: "Ticket not found" });
    ticket.status = req.body.status;
    ticket.updatedAt = Date.now();
    saveDb(db);
    res.json(ticket);
});

app.delete('/api/tickets/:id', (req, res) => {
    const db = getDb();
    db.tickets = (db.tickets || []).filter(t => t.id !== req.params.id);
    saveDb(db);
    res.json({ success: true });
});

app.post('/api/chat', async (req, res) => { 
    const db = getDb(); 
    const msg = req.body;
    if(!db.messages) db.messages=[]; 

    // Instantly append and resave database
    db.messages.push(msg); 
    saveDb(db); 
    
    // Instantly respond to client to maximize UI speed and responsiveness
    res.json(db.messages); 

    // Synchronize with external bots asynchronously in the background so it never blocks the user
    if (msg.recipient) {
        (async () => {
            const targetUser = db.users?.find(u => u.username === msg.recipient || u.fullName === msg.recipient);
            if (targetUser) {
                try {
                    let botRes = null;
                    let mutated = false;
                    if (targetUser.telegramChatId && db.settings?.telegramBotToken) {
                        const tg = await safeImport('./backend/telegram.js');
                        if (tg && tg.sendBotMessage) {
                            botRes = await tg.sendBotMessage(targetUser.telegramChatId, msg.message || '📎 فایل');
                            msg.botPlatform = 'telegram';
                            msg.botChatId = targetUser.telegramChatId;
                            msg.botMessageId = botRes?.message_id;
                            mutated = true;
                        }
                    } else if (targetUser.baleChatId && db.settings?.baleBotToken) {
                        const bale = await safeImport('./backend/bale.js');
                        if (bale && bale.sendBotMessage) {
                            botRes = await bale.sendBotMessage(targetUser.baleChatId, msg.message || '📎 فایل');
                            msg.botPlatform = 'bale';
                            msg.botChatId = targetUser.baleChatId;
                            msg.botMessageId = botRes?.result?.message_id;
                            mutated = true;
                        }
                    }
                    if (mutated) {
                        saveDb(db);
                    }
                } catch (e) {
                    console.error("Async Bot Sync Error:", e);
                }
            }
        })().catch(console.error);
    }

    // Broadcast notifications asynchronously in the background
    try {
        if (msg.recipient) {
            broadcastNotification(
                `پیام از ${msg.sender}`,
                `${msg.sender} پیام داد: ${msg.message || (msg.audioUrl ? '🎤 پیام صوتی' : '📎 فایل')}`,
                `/chat?pv=${msg.senderUsername}`,
                null,
                [msg.recipient],
                [msg.senderUsername] // Exclude sender
            );
        } else if (msg.groupId) {
            const group = db.groups?.find(g => g.id === msg.groupId);
            if (group) {
                broadcastNotification(
                    `${group.name}`,
                    `${msg.sender}: ${msg.message || (msg.audioUrl ? '🎤 پیام صوتی' : '📎 فایل')}`,
                    `/chat?group=${msg.groupId}`,
                    null,
                    group.members.filter(m => m !== msg.senderUsername),
                    [msg.senderUsername] // Exclude sender
                );
            }
        } else {
            // Public channel
            broadcastNotification(
                `گروه عمومی`,
                `${msg.sender}: ${msg.message || (msg.audioUrl ? '🎤 پیام صوتی' : '📎 فایل')}`,
                '/chat',
                null,
                null,
                [msg.senderUsername] // Exclude sender
            );
        }
    } catch (e) {
        console.error("Async broadcast notification error:", e);
    }
});
app.put('/api/chat/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.messages.findIndex(m => m.id === req.params.id); 
    if(idx > -1) { 
        db.messages[idx] = { ...db.messages[idx], ...req.body }; 
        saveDb(db); 
        res.json(db.messages); 
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/chat/:id', async (req, res) => { 
    const db = getDb(); 
    const id = req.params.id;
    const msgToDelete = (db.messages || []).find(m => m.id === id);

    if (msgToDelete) {
        const forEveryone = req.query.forEveryone === 'true';

        // Two-way deletion from Bots
        if (forEveryone && msgToDelete.botMessageId && msgToDelete.botChatId && msgToDelete.botPlatform) {
            try {
                if (msgToDelete.botPlatform === 'telegram') {
                    const tg = await safeImport('./backend/telegram.js');
                    if (tg && tg.deleteBotMessage) await tg.deleteBotMessage(msgToDelete.botChatId, msgToDelete.botMessageId);
                } else if (msgToDelete.botPlatform === 'bale') {
                    const bale = await safeImport('./backend/bale.js');
                    if (bale && bale.deleteBotMessage) await bale.deleteBotMessage(msgToDelete.botChatId, msgToDelete.botMessageId);
                }
            } catch (e) { console.error("Bot Remove Error:", e); }
        }

        // Collect file URLs to potentially delete
        const fileUrls = [];
        if (msgToDelete.attachment?.url) fileUrls.push(msgToDelete.attachment.url);
        if (msgToDelete.audioUrl) fileUrls.push(msgToDelete.audioUrl);

        // Delete from database
        db.messages = db.messages.filter(m => m.id !== id); 
        saveDb(db); 

        // Physical file deletion logic
        fileUrls.forEach(url => {
            // Only try to delete local uploads
            if (url.startsWith('/uploads/')) {
                // Check if any other message still references this file
                const stillInUse = db.messages.some(m => 
                    m.attachment?.url === url || m.audioUrl === url
                );

                if (!stillInUse) {
                    const fileName = url.replace('/uploads/', '');
                    const filePath = path.join(UPLOADS_DIR, fileName);
                    if (fs.existsSync(filePath)) {
                        try {
                            fs.unlinkSync(filePath);
                            console.log(`Deleted file: ${fileName}`);
                        } catch (err) {
                            console.error(`Error deleting file ${fileName}:`, err);
                        }
                    }
                }
            }
        });
    }

    res.json(db.messages || []); 
});

app.get('/api/groups', (req, res) => res.json(getDb().groups || []));
app.post('/api/groups', (req, res) => { const db = getDb(); if(!db.groups) db.groups=[]; db.groups.push(req.body); saveDb(db); res.json(db.groups); });
app.put('/api/groups/:id', (req, res) => { const db = getDb(); const idx = db.groups.findIndex(g => g.id === req.params.id); if(idx > -1) { db.groups[idx] = { ...db.groups[idx], ...req.body }; saveDb(db); res.json(db.groups); } else res.status(404).send('Not Found'); });
app.delete('/api/groups/:id', (req, res) => { const db = getDb(); db.groups = db.groups.filter(g => g.id !== req.params.id); saveDb(db); res.json(db.groups); });

app.get('/api/task-groups', (req, res) => res.json(getDb().taskGroups || []));
app.post('/api/task-groups', (req, res) => { const db = getDb(); if(!db.taskGroups) db.taskGroups=[]; db.taskGroups.push(req.body); saveDb(db); res.json(db.taskGroups); });
app.put('/api/task-groups/:id', (req, res) => { const db = getDb(); const idx = db.taskGroups.findIndex(g => g.id === req.params.id); if(idx > -1) { db.taskGroups[idx] = { ...db.taskGroups[idx], ...req.body }; saveDb(db); res.json(db.taskGroups); } else res.status(404).send('Not Found'); });
app.delete('/api/task-groups/:id', (req, res) => { const db = getDb(); db.taskGroups = db.taskGroups.filter(g => g.id !== req.params.id); saveDb(db); res.json(db.taskGroups); });

app.get('/api/tasks', (req, res) => res.json(getDb().tasks || []));
app.post('/api/tasks', (req, res) => { 
    const db = getDb(); 
    if(!db.tasks) db.tasks=[]; 
    const task = req.body;
    db.tasks.push(task); 
    saveDb(db); 
    res.json(db.tasks); 

    // Send notification
    try {
        const taskGroup = db.taskGroups?.find(tg => tg.id === task.groupId);
        const groupName = taskGroup ? taskGroup.name : 'گروه کاری';
        let targets = null;
        if (task.assignedTo && task.assignedTo.length > 0) {
            targets = [...task.assignedTo];
        } else if (taskGroup && taskGroup.members) {
            targets = [...taskGroup.members];
        }
        const exclude = task.createdBy ? [task.createdBy] : null;

        broadcastNotification(
            `تسک جدید: ${task.title}`,
            `یک تسک جدید در گروه "${groupName}" ثبت شد.`,
            `/chat?group=${task.groupId}&task=${task.id}`,
            null,
            targets,
            exclude
        ).catch(err => console.error("Task creation broadcast error:", err));
    } catch(e) {
        console.error("Task creation notification error:", e);
    }
});
app.put('/api/tasks/:id', (req, res) => { 
    const db = getDb(); 
    const idx = db.tasks.findIndex(t => t.id === req.params.id); 
    if(idx > -1) { 
        const currentTask = db.tasks[idx];
        const updatedTask = req.body;
        const statusChanged = updatedTask.status && updatedTask.status !== currentTask.status;
        const repliesChanged = updatedTask.replies && (!currentTask.replies || updatedTask.replies.length > currentTask.replies.length);

        db.tasks[idx] = { ...currentTask, ...updatedTask }; 
        saveDb(db); 
        res.json(db.tasks); 

        // Send notifications
        try {
            const taskGroup = db.taskGroups?.find(tg => tg.id === currentTask.groupId);
            const groupName = taskGroup ? taskGroup.name : 'گروه کاری';

            if (statusChanged && updatedTask.status === 'completed') {
                const completedBy = updatedTask.completedBy || 'کاربر';
                let targets = [currentTask.createdBy];
                if (currentTask.assignedTo) {
                    targets = [...targets, ...currentTask.assignedTo];
                }
                targets = Array.from(new Set(targets));
                const exclude = updatedTask.completedBy ? [updatedTask.completedBy] : null;

                broadcastNotification(
                    `تسک انجام شد: ${currentTask.title}`,
                    `تسک "${currentTask.title}" در گروه "${groupName}" توسط ${completedBy} انجام شد.`,
                    `/chat?group=${currentTask.groupId}&task=${currentTask.id}`,
                    null,
                    targets,
                    exclude
                ).catch(err => console.error("Task completed broadcast error:", err));
            } else if (repliesChanged) {
                const lastReply = updatedTask.replies[updatedTask.replies.length - 1];
                const sender = lastReply.sender || 'کاربر';
                const senderUsername = lastReply.senderUsername;
                
                let targets = [currentTask.createdBy];
                if (currentTask.assignedTo) {
                    targets = [...targets, ...currentTask.assignedTo];
                }
                targets = Array.from(new Set(targets));

                broadcastNotification(
                    `دیدگاه جدید روی تسک: ${currentTask.title}`,
                    `${sender}: ${lastReply.message}`,
                    `/chat?group=${currentTask.groupId}&task=${currentTask.id}`,
                    null,
                    targets,
                    [senderUsername]
                ).catch(err => console.error("Task reply broadcast error:", err));
            }
        } catch(e) {
            console.error("Task update notification error:", e);
        }
    } else res.status(404).send('Not Found'); 
});
app.delete('/api/tasks/:id', (req, res) => { const db = getDb(); db.tasks = db.tasks.filter(t => t.id !== req.params.id); saveDb(db); res.json(db.tasks); });

app.get('/api/announcements', (req, res) => res.json(getDb().announcements || []));
app.post('/api/announcements', (req, res) => { const db = getDb(); if(!db.announcements) db.announcements=[]; db.announcements.push(req.body); saveDb(db); res.json(db.announcements); });
app.delete('/api/announcements/:id', (req, res) => { const db = getDb(); db.announcements = db.announcements.filter(a => a.id !== req.params.id); saveDb(db); res.json(db.announcements); });

// 9. FILE UPLOAD
app.post('/api/upload', (req, res) => {
    const { fileName, fileData } = req.body;
    if (!fileName || !fileData) return res.status(400).send('Missing data');
    // Fix Regex to handle complex MIME types (e.g. audio/webm;codecs=opus)
    const base64Data = fileData.replace(/^data:.*;base64,/, '');
    const uniqueName = `${Date.now()}_${fileName}`;
    const filePath = path.join(UPLOADS_DIR, uniqueName);
    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) return res.status(500).send('Upload failed');
        res.json({ fileName, url: `/uploads/${uniqueName}` });
    });
});

app.get('/api/upload-get-base64', (req, res) => {
    const fileUrl = req.query.url;
    if (!fileUrl) {
        return res.status(400).json({ error: 'آدرس فایل ارسال نشده است' });
    }

    let filename = '';
    if (fileUrl.startsWith('/uploads/')) {
        filename = fileUrl.replace('/uploads/', '');
    } else {
        filename = path.basename(fileUrl);
    }

    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'فایل یافت نشد' });
    }

    try {
        const fileBuffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        let mimeType = 'application/octet-stream';
        if (ext === '.pdf') mimeType = 'application/pdf';
        else if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
        else if (ext === '.gif') mimeType = 'image/gif';

        const base64 = fileBuffer.toString('base64');
        const fileData = `data:${mimeType};base64,${base64}`;
        res.json({ fileData });
    } catch (e) {
        console.error('Error reading file for base64:', e);
        res.status(500).json({ error: 'خطا در خواندن فایل: ' + e.message });
    }
});

const chunkTempDir = path.join(ROOT_DIR, 'chunk-temp');
if (!fs.existsSync(chunkTempDir)) fs.mkdirSync(chunkTempDir, { recursive: true });

app.post('/api/upload-chunk', (req, res) => {
    const { uploadId, chunkIndex, chunkData } = req.body;
    if (!uploadId || chunkIndex === undefined || !chunkData) return res.status(400).send('Missing chunk data');
    const base64Data = chunkData.replace(/^data:.*;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filePath = path.join(chunkTempDir, `${uploadId}_${chunkIndex}`);
    fs.writeFileSync(filePath, buffer);
    res.json({ success: true });
});

app.post('/api/upload-finish', async (req, res) => {
    const { uploadId, fileName, totalChunks } = req.body;
    if (!uploadId || !fileName || !totalChunks) return res.status(400).send('Missing finish data');
    const uniqueName = `${Date.now()}_${fileName}`;
    const finalPath = path.join(UPLOADS_DIR, uniqueName);
    const writeStream = fs.createWriteStream(finalPath);
    
    // Append all chunks sequentially, using async/await to avoid blocking event loop
    try {
        // Verify all chunks exist first
        for(let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(chunkTempDir, `${uploadId}_${i}`);
            if(!fs.existsSync(chunkPath)) {
                console.error(`Missing chunk ${i} for upload ${uploadId}`);
                return res.status(400).send(`Chunk ${i} missing. Please try again.`);
            }
        }

        for(let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(chunkTempDir, `${uploadId}_${i}`);
            await new Promise((resolve, reject) => {
                const readStream = fs.createReadStream(chunkPath);
                readStream.pipe(writeStream, { end: false });
                readStream.on('end', () => {
                    try { fs.unlinkSync(chunkPath); } catch(e) {}
                    resolve();
                });
                readStream.on('error', reject);
            });
        }
        writeStream.end();
        
        writeStream.on('finish', () => {
            res.json({ fileName, url: `/uploads/${uniqueName}` });
        });
        writeStream.on('error', (err) => {
            res.status(500).send('Finalize failed');
        });
    } catch (err) {
        console.error('Error combining chunks:', err);
        res.status(500).send('Server Error');
    }
});

// 10. BOTS (Telegram/Bale/WhatsApp)
app.post('/api/restart-bot', async (req, res) => {
    const { type } = req.body;
    const db = getDb();
    if (type === 'telegram' && db.settings.telegramBotToken) { const mod = await safeImport('./backend/telegram.js'); if(mod) mod.initTelegram(db.settings.telegramBotToken); }
    if (type === 'bale' && db.settings.baleBotToken) { const mod = await safeImport('./backend/bale.js'); if(mod) mod.initBaleBot(db.settings.baleBotToken); }
    if (type === 'whatsapp') { const mod = await safeImport('./backend/whatsapp.js'); if (mod) mod.restartSession(path.join(ROOT_DIR, 'wauth')); }
    res.json({ success: true });
});

app.post('/api/send-bot-message', async (req, res) => {
    const { platform, chatId, caption, mediaData } = req.body;
    try {
        if (platform === 'telegram') {
            const tg = await safeImport('./backend/telegram.js');
            if (tg && tg.sendBotPhoto && mediaData) {
                const buffer = Buffer.from(mediaData.data, 'base64');
                await tg.sendBotPhoto(chatId, buffer, caption, { filename: mediaData.filename || 'image.png' });
            } else if (tg && tg.sendBotMessage) {
                await tg.sendBotMessage(chatId, caption);
            }
        } else if (platform === 'bale') {
            const bale = await safeImport('./backend/bale.js');
            if (bale && bale.sendBotPhoto && mediaData) {
                const buffer = Buffer.from(mediaData.data, 'base64');
                await bale.sendBotPhoto(chatId, buffer, caption, { filename: mediaData.filename || 'image.png' });
            } else if (bale && bale.sendBotMessage) {
                await bale.sendBotMessage(chatId, caption);
            }
        }
        res.json({ success: true });
    } catch (e) {
        console.error("Bot Send Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- UPDATED BACKUP ENDPOINTS ---

app.get('/api/backups/list', (req, res) => {
    try {
        if (!fs.existsSync(BACKUPS_DIR)) return res.json([]);
        const files = fs.readdirSync(BACKUPS_DIR)
            .filter(f => f.startsWith('AutoBackup_') || f.startsWith('Full_Backup_') || f.endsWith('.zip'))
            .map(f => {
                const stat = fs.statSync(path.join(BACKUPS_DIR, f));
                return { name: f, size: stat.size, date: stat.mtime };
            })
            .sort((a, b) => b.date - a.date);
        res.json(files);
    } catch(e) { res.status(500).json({error: "Failed"}); }
});

app.get('/api/backups/download/:filename', (req, res) => {
    const filename = req.params.filename;
    if (filename.includes('/') || filename.includes('..')) return res.status(400).send("Invalid");
    const filePath = path.join(BACKUPS_DIR, filename);
    if (fs.existsSync(filePath)) res.download(filePath);
    else res.status(404).send("Not found");
});

// FULL BACKUP (ZIP with DB + UPLOADS) - MANUAL TRIGGER
app.get('/api/full-backup', (req, res) => {
    try {
        const archive = archiver('zip', { zlib: { level: 9 } });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `Full_Backup_${timestamp}.zip`;
        
        res.attachment(filename);
        archive.pipe(res);
        
        if (fs.existsSync(DB_FILE)) archive.file(DB_FILE, { name: 'database.json' });
        if (fs.existsSync(UPLOADS_DIR)) archive.directory(UPLOADS_DIR, 'uploads');
        
        archive.finalize();
    } catch (e) {
        console.error("Manual Backup Error:", e);
        res.status(500).send("Backup Generation Failed");
    }
});

// FULL RESTORE (ZIP OR JSON) - SMART HANDLING
app.post('/api/emergency-restore', (req, res) => {
    const { fileData } = req.body;
    if (!fileData) return res.status(400).json({ success: false, error: 'No data' });
    
    try {
        const base64Data = fileData.replace(/^data:.*,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // 1. Check Magic Number to see if ZIP (PK..)
        const isZip = buffer[0] === 0x50 && buffer[1] === 0x4B;

        if (isZip) {
            console.log(">>> Restoring from ZIP archive...");
            const tempZip = path.join(ROOT_DIR, 'temp_restore.zip');
            fs.writeFileSync(tempZip, buffer);

            const zip = new AdmZip(tempZip);
            
            // Extract database.json
            const dbEntry = zip.getEntry('database.json');
            if (dbEntry) {
                const dbContent = zip.readAsText(dbEntry);
                fs.writeFileSync(DB_FILE, dbContent);
                // UPDATE MEMORY
                const parsed = JSON.parse(dbContent);
                dbManager.saveDbImmediate(parsed); 
                console.log("✅ Database restored.");
            }
            
            // Extract Uploads
            if (zip.getEntry('uploads/')) {
                zip.extractEntryTo("uploads/", ROOT_DIR, true, true); 
                console.log("✅ Uploads restored.");
            }
            
            fs.unlinkSync(tempZip);
            res.json({ success: true, mode: 'zip' });
        } else {
            console.log(">>> Restoring from JSON text...");
            const jsonStr = buffer.toString('utf-8');
            const parsed = JSON.parse(jsonStr);
            if (!parsed.settings && !parsed.users) throw new Error("Invalid backup file");
            
            dbManager.saveDbImmediate(parsed);
            
            res.json({ success: true, mode: 'json' });
        }
    } catch (e) {
        console.error("Restore failed:", e);
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/version', (req, res) => { res.json({ version: '1.3.1' }); });

app.get('/manifest.json', (req, res) => {
    const db = getDb();
    const settings = db.settings || {};
    const iconUrl = settings.pwaIcon || "https://cdn-icons-png.flaticon.com/512/3135/3135706.png";
    const appName = settings.appName || "سامانه مالی و بازرگانی";
    
    const manifest = {
        name: appName,
        short_name: settings.appName || "سامانه مالی",
        description: "سیستم جامع مدیریت پرداخت ها و مجوزهای خروج کالا",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f8fafc",
        theme_color: "#2563eb",
        orientation: "portrait",
        lang: "fa",
        dir: "rtl",
        categories: ["finance", "business", "productivity"],
        icons: [
            {
                src: iconUrl,
                sizes: "192x192",
                type: "image/png",
                purpose: "any"
            },
            {
                src: iconUrl,
                sizes: "192x192",
                type: "image/png",
                purpose: "maskable"
            },
            {
                src: iconUrl,
                sizes: "512x512",
                type: "image/png",
                purpose: "any"
            },
            {
                src: iconUrl,
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable"
            }
        ],
        screenshots: [
            {
                src: iconUrl,
                sizes: "512x512",
                type: "image/png",
                form_factor: "wide",
                label: appName
            },
            {
                src: iconUrl,
                sizes: "512x512",
                type: "image/png",
                form_factor: "narrow",
                label: appName
            }
        ],
        prefer_related_applications: false,
        share_target: {
            action: "/api/share-target",
            method: "POST",
            enctype: "multipart/form-data",
            params: {
                title: "title",
                text: "text",
                url: "url",
                files: [
                    {
                        name: "files",
                        accept: [
                            "image/*",
                            "video/*",
                            "audio/*",
                            "application/*",
                            "text/*"
                        ]
                    }
                ]
            }
        }
    };
    res.setHeader('Content-Type', 'application/manifest+json');
    res.send(JSON.stringify(manifest));
});

}
const DIST_DIR = path.join(ROOT_DIR, 'dist');
if (process.env.NODE_ENV !== "production") {
    console.log("Starting in Development mode with Vite Middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
    });
    app.use(vite.middlewares);
} else {
    if (fs.existsSync(DIST_DIR)) {
        app.use(express.static(DIST_DIR, { maxAge: '1d' })); // Cache static assets
        app.get('*', (req, res) => {
            if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API endpoint not found' });
            res.sendFile(path.join(DIST_DIR, 'index.html'));
        });
    } else {
        app.get('*', (req, res) => res.send(`<h1>Frontend Not Built</h1>`));
    }
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on ${PORT}`);
    setTimeout(async () => {
        try {
            const db = getDb(); // Initial load to memory
            if(db.settings?.telegramBotToken) {
                const tgModule = await safeImport('./backend/telegram.js');
                if(tgModule) tgModule.initTelegram(db.settings.telegramBotToken);
            }
            if(db.settings?.baleBotToken) {
                const baleModule = await safeImport('./backend/bale.js');
                if(baleModule) baleModule.initBaleBot(db.settings.baleBotToken);
            }
            const waAuthPath = path.join(ROOT_DIR, 'wauth');
            if (fs.existsSync(waAuthPath) && process.env.DISABLE_WHATSAPP_DEV !== 'true') {
                const waModule = await safeImport('./backend/whatsapp.js');
                if (waModule) waModule.initWhatsApp(waAuthPath);
            }
        } catch (err) {
            console.error("Background services initialization error:", err);
        }
    }, 1000);
});
}
