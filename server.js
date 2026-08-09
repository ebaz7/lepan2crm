
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
import { notifyExitPermitStep, notifyPaymentOrderStep, notifyWarehouseBijak, notifyMeetingAnnouncement, notifyMeetingMinutes, notifyPurchaseRequestStep, runDailyReport, generateAndSendComparisonPDF, notifySecretariatLetter, getCustomerBalancesData } from './backend/bot-core.js';
import * as telegram from './backend/telegram.js';
import * as bale from './backend/bale.js';
import * as Renderer from './backend/renderer.js';
import mammoth from 'mammoth';
import { GoogleGenAI, Type } from '@google/genai';
import * as jalaali from 'jalaali-js';

const getDb = dbManager.getDb;
const saveDb = dbManager.saveDb;
const findNextGapNumber = utils.findNextGapNumber;
const findNextMaxNumber = utils.findNextMaxNumber;
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

const setupLegacyDailyReports = () => {
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
}; // End of setupDailyReports

// Helper to build Persian captioned production report
const buildProductionCaption = (dateStr, totals, waste) => {
    let dateObj = new Date();
    if (typeof dateStr === 'string' && (dateStr.includes('/') || dateStr.includes('.') || dateStr.includes('-'))) {
        const gregStr = parseJalaliStrToGregorian(dateStr);
        if (gregStr) {
            const parts = gregStr.split('-').map(x => parseInt(x, 10));
            dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
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

// Unified Helper to collect configured bot targets for specific categories (sales, production, accounting, or all)
const collectBotTargets = (db, { category = 'all', platforms = ['telegram', 'bale', 'whatsapp'], customTargets = null } = {}) => {
    if (customTargets && Array.isArray(customTargets) && customTargets.length > 0) {
        return customTargets;
    }
    const settings = db.settings || {};
    const salesTargets = [];

    const salesKeys = [
        { key: 'dailySalesTelegramGroupId', plat: 'telegram' },
        { key: 'dailySalesBaleGroupId', plat: 'bale' },
        { key: 'dailySalesWhatsappGroupId', plat: 'whatsapp' },
        { key: 'botDailySalesGroupIdTele', plat: 'telegram' },
        { key: 'botDailySalesGroupIdBale', plat: 'bale' },
        { key: 'botDailySalesGroupIdWhatsApp', plat: 'whatsapp' },
        { key: 'botDailySalesGroupId', plat: 'telegram' },
        { key: 'dailySalesGroupId', plat: 'telegram' },
        { key: 'salesGroupId', plat: 'telegram' },
    ];

    const accountingKeys = [
        { key: 'botAccountingGroupIdTele', plat: 'telegram' },
        { key: 'botAccountingGroupIdBale', plat: 'bale' },
        { key: 'botAccountingGroupIdWhatsApp', plat: 'whatsapp' },
        { key: 'botAccountingGroupId', plat: 'telegram' },
        { key: 'accountingGroupId', plat: 'telegram' },
    ];

    const productionKeys = [
        { key: 'productionTelegramGroupId', plat: 'telegram' },
        { key: 'productionBaleGroupId', plat: 'bale' },
        { key: 'productionWhatsappGroupId', plat: 'whatsapp' },
        { key: 'factoryGroupId', plat: 'telegram' },
    ];

    const reportsKeys = [
        { key: 'reportsGroupId', plat: 'telegram' },
        { key: 'telegramReportsGroupId', plat: 'telegram' },
        { key: 'telegramReportsGroupId2', plat: 'telegram' },
        { key: 'baleReportsGroupId', plat: 'bale' },
        { key: 'baleReportsGroupId2', plat: 'bale' },
        { key: 'whatsappReportsGroupId', plat: 'whatsapp' },
        { key: 'whatsappReportsGroupId2', plat: 'whatsapp' },
    ];

    const generalKeys = [
        { key: 'telegramChatId', plat: 'telegram' },
        { key: 'baleChatId', plat: 'bale' },
        { key: 'telegramGroupId', plat: 'telegram' },
        { key: 'baleGroupId', plat: 'bale' },
        { key: 'whatsappGroupId', plat: 'whatsapp' }
    ];

    let keysToUse = [];
    if (category === 'production') {
        keysToUse = productionKeys;
    } else if (category === 'sales') {
        keysToUse = salesKeys;
    } else if (category === 'accounting') {
        keysToUse = accountingKeys;
    } else {
        keysToUse = [...salesKeys, ...accountingKeys, ...productionKeys, ...reportsKeys, ...generalKeys];
    }

    keysToUse.forEach(({ key, plat }) => {
        const val = settings[key];
        if (val && platforms.includes(plat)) {
            salesTargets.push({ platform: plat, id: val });
        }
    });

    if (category === 'all') {
        if (db.groups && Array.isArray(db.groups)) {
            db.groups.forEach(g => {
                if (g.chatId) {
                    const plat = g.platform || 'telegram';
                    if (platforms.includes(plat)) {
                        salesTargets.push({ platform: plat, id: g.chatId });
                    }
                }
            });
        }

        if (db.botUsers && Array.isArray(db.botUsers)) {
            db.botUsers.forEach(u => {
                if (u.telegramChatId && platforms.includes('telegram')) {
                    salesTargets.push({ platform: 'telegram', id: u.telegramChatId });
                }
                if (u.baleChatId && platforms.includes('bale')) {
                    salesTargets.push({ platform: 'bale', id: u.baleChatId });
                }
                if (u.whatsappChatId && platforms.includes('whatsapp')) {
                    salesTargets.push({ platform: 'whatsapp', id: u.whatsappChatId });
                }
                if (u.chatId && !u.telegramChatId && !u.baleChatId && !u.whatsappChatId) {
                    const plat = u.platform || 'telegram';
                    if (platforms.includes(plat)) {
                        salesTargets.push({ platform: plat, id: u.chatId });
                    }
                }
            });
        }
    }

    if (db.reportDeliveryJobs && Array.isArray(db.reportDeliveryJobs)) {
        db.reportDeliveryJobs.forEach(job => {
            const isMatch = category === 'all' ||
                (category === 'production' && (job.module === 'inventory' || job.module === 'production' || job.reportType === 'production' || job.reportType === 'inventory_stock')) ||
                (category === 'sales' && (job.module === 'sales' || job.reportType === 'daily_sales' || job.reportType === 'sales_comparison')) ||
                (category === 'accounting' && (job.module === 'accounting' || job.reportType === 'customer_balances' || job.reportType === 'cheque_alerts'));

            if (isMatch && Array.isArray(job.botPlatforms)) {
                job.botPlatforms.forEach(plat => {
                    if (platforms.includes(plat)) {
                        let id = null;
                        if (plat === 'telegram') id = job.telegramGroup || job.destinationGroup;
                        else if (plat === 'bale') id = job.baleGroup || job.destinationGroup;
                        else if (plat === 'whatsapp') id = job.whatsappGroup || job.destinationGroup;
                        else id = job.destinationGroup;

                        if (id) {
                            salesTargets.push({ platform: plat, id });
                        }
                    }
                });
            }
        });
    }

    if (category === 'all' && settings.savedContacts && Array.isArray(settings.savedContacts)) {
        settings.savedContacts.forEach(c => {
            if (c.telegramId && platforms.includes('telegram')) {
                salesTargets.push({ platform: 'telegram', id: c.telegramId });
            }
            if (c.baleId && platforms.includes('bale')) {
                salesTargets.push({ platform: 'bale', id: c.baleId });
            }
            if (c.number && platforms.includes('whatsapp')) {
                salesTargets.push({ platform: 'whatsapp', id: c.number });
            }
        });
    }

    const uniqueSalesTargets = [];
    const seenMap = new Set();
    for (const t of salesTargets) {
        const cleanId = utils.sanitizeGroupId ? utils.sanitizeGroupId(t.id) : String(t.id).trim();
        if (!cleanId) continue;
        const key = `${t.platform}_${cleanId}`;
        if (!seenMap.has(key)) {
            seenMap.add(key);
            uniqueSalesTargets.push({ platform: t.platform, id: cleanId });
        }
    }

    return uniqueSalesTargets;
};

// Helper to generate and send daily sales report for a specific Date
const sendDailySalesReportForDate = async (db, dateObj, labelSuffix = '', targetsOverride = null, selectedPlatforms = null) => {
    const settings = db.settings || {};
    const shamsiFull = utils.toShamsiFull(dateObj.toISOString());
    const shamsiDate = shamsiFull ? shamsiFull.split(' ')[0].replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)) : ''; // e.g. "1404/05/07"
    const gregDate = utils.getTehranDateString(dateObj); // e.g. "2026-07-29"

    const platforms = selectedPlatforms && selectedPlatforms.length > 0 ? selectedPlatforms : ['telegram', 'bale', 'whatsapp'];
    const uniqueSalesTargets = collectBotTargets(db, { category: 'sales', platforms, customTargets: targetsOverride });

    if (uniqueSalesTargets.length === 0) {
        throw new Error('شناسه گروه اطلاع‌رسانی مالی/فروش در تنظیمات ثبت نشده است! جهت ارسال گزارش فروش، لطفاً به بخش «تنظیمات سیستم ⚙️ -> تب ربات‌ها -> تنظیمات اطلاع‌رسانی مالی و خروج» بروید و شناسه چت یا گروه تلگرام/بله (مانند 100123456789- یا آیدی عددی) را وارد نمایید.');
    }

    // Check if tokens exist for requested platforms
    const hasTgToken = !!settings.telegramBotToken;
    const hasBaleToken = !!settings.baleBotToken;
    const tgTargets = uniqueSalesTargets.filter(t => t.platform === 'telegram');
    const baleTargets = uniqueSalesTargets.filter(t => t.platform === 'bale');

    if (tgTargets.length > 0 && !hasTgToken && baleTargets.length === 0) {
        throw new Error('توکن ربات تلگرام در تنظیمات سیستم ثبت نشده است! لطفاً ابتدا توکن ربات تلگرام را در «تنظیمات سیستم -> تب ربات‌ها» وارد نمایید.');
    }
    if (baleTargets.length > 0 && !hasBaleToken && tgTargets.length === 0) {
        throw new Error('توکن ربات بله در تنظیمات سیستم ثبت نشده است! لطفاً ابتدا توکن ربات بله را در «تنظیمات سیستم -> تب ربات‌ها» وارد نمایید.');
    }

    // Fetch sales and returns data from Sayan ERP with local fallback
    const shamsiClean = shamsiDate.replace(/\//g, '');
    const shamsiDash = shamsiDate.replace(/\//g, '-');
    const gregSlash = gregDate.replace(/-/g, '/');
    
    const sql = `
        SELECT 
            t10.Field_005 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_029 as Notes,
            t10.Field_037 as HeaderPayable,
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
            SELECT t21_sub.Field_004 as ItemCode, MIN(COALESCE(t02_grandparent.Field_003, t02_parent.Field_003, t02_sub.Field_003)) as GroupName
            FROM IND_TBL_021 t21_sub
            LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
            LEFT JOIN IND_TBL_002 t02_parent ON RTRIM(LTRIM(t02_sub.Field_009)) = RTRIM(LTRIM(t02_parent.Field_008))
            LEFT JOIN IND_TBL_002 t02_grandparent ON RTRIM(LTRIM(t02_parent.Field_009)) = RTRIM(LTRIM(t02_grandparent.Field_008))
            GROUP BY t21_sub.Field_004
        ) t_group ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_group.ItemCode))
        LEFT JOIN ACT_TBL_007 t07 ON RTRIM(LTRIM(t10.Field_010)) = RTRIM(LTRIM(t07.Field_005)) AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
        WHERE (
            t10.Field_009 IN ('3', '12', '23')
            OR 
            t10.Field_009 IN ('13')
          )
          AND (
            t10.Field_008 LIKE '${gregDate}%'
            OR t10.Field_008 LIKE '${gregSlash}%'
            ${shamsiDate ? `OR t10.Field_008 LIKE '${shamsiDate}%'` : ''}
            ${shamsiClean ? `OR t10.Field_008 LIKE '${shamsiClean}%'` : ''}
            ${shamsiDash ? `OR t10.Field_008 LIKE '${shamsiDash}%'` : ''}
            OR t10.Field_008 BETWEEN '${gregDate}T00:00:00.000Z' AND '${gregDate}T23:59:59.999Z'
            OR t10.Field_008 BETWEEN '${gregDate} 00:00:00' AND '${gregDate} 23:59:59'
          )
        ORDER BY t10.Field_008 DESC
    `;

    let rawSalesRows = [];
    try {
        rawSalesRows = await executeSayanQuery(db, sql);
    } catch (e) {
        console.warn("Sayan ERP query failed, attempting local invoices fallback:", e.message);
        const localInvs = Array.isArray(db.invoices) ? db.invoices : (Array.isArray(db.exitPermits) ? db.exitPermits : []);
        rawSalesRows = localInvs.map(inv => ({
            DocId: inv.id || inv.number,
            InvoiceNum: inv.number || inv.id,
            Date: inv.date || gregDate,
            Notes: inv.description || '',
            HeaderPayable: inv.amount || inv.totalPrice || 0,
            ItemCode: inv.itemCode || '',
            ItemName: inv.itemName || inv.productName || 'کالا',
            Quantity: inv.quantity || inv.weight || 0,
            Amount: inv.amount || inv.totalPrice || 0,
            GroupName: inv.groupName || inv.category || 'سایر گروه‌ها',
            CustomerName: inv.customerName || inv.recipientName || 'مشتری',
            OpCode: inv.opCode || '3'
        }));
    }

    // Allocate HeaderPayable proportionally across item rows per invoice
    const invMap = new Map();
    rawSalesRows.forEach(row => {
        const docId = row.DocId || 'unknown';
        if (!invMap.has(docId)) invMap.set(docId, []);
        invMap.get(docId).push(row);
    });

    const salesRows = [];
    invMap.forEach((rows) => {
        const headerPayable = parseFloat(rows[0].HeaderPayable || rows[0].Amount || 0);
        const sumItemAmt = rows.reduce((s, r) => s + parseFloat(r.Amount || 0), 0);
        const sumItemQty = rows.reduce((s, r) => s + parseFloat(r.Quantity || 0), 0);

        rows.forEach(r => {
            const itemAmt = parseFloat(r.Amount || 0);
            const itemQty = parseFloat(r.Quantity || 0);
            let allocatedAmt = 0;
            if (headerPayable > 0) {
                if (sumItemAmt > 0) {
                    allocatedAmt = headerPayable * (itemAmt / sumItemAmt);
                } else if (sumItemQty > 0) {
                    allocatedAmt = headerPayable * (itemQty / sumItemQty);
                } else {
                    allocatedAmt = headerPayable / rows.length;
                }
            } else {
                allocatedAmt = itemAmt;
            }
            salesRows.push({
                ...r,
                Amount: allocatedAmt
            });
        });
    });
    
    if (salesRows.length > 0) {
        const title = `گزارش رسمی فروش روزانه و مرجوعی سایان - مورخ ${shamsiDate} (${labelSuffix})`;
        const columns = ['ردیف', 'گروه / نام کالا', 'فروش ناخالص (ک‌گ / ریال)', 'مرجوعی کد ۱۳ (ک‌گ / ریال)', 'خالص (ک‌گ / ریال)', 'فی نهایی (ریال)'];
        
        const groupedMap = new Map();
        let totalSalesQty = 0;
        let totalSalesAmt = 0;
        let totalReturnQty = 0;
        let totalReturnAmt = 0;
        
        salesRows.forEach(inv => {
            const key = `${inv.GroupName || ''}_${inv.ItemName || ''}`;
            const qty = parseFloat(inv.Quantity || 0);
            let amt = parseFloat(inv.Amount || 0);
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
                `${row.salesQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ک‌گ / ${Math.round(row.salesAmt).toLocaleString('fa-IR')} ریال`,
                `${row.returnQty > 0 ? row.returnQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0'} ک‌گ / ${Math.round(row.returnAmt).toLocaleString('fa-IR')} ریال`,
                `${netQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ک‌گ / ${Math.round(netAmt).toLocaleString('fa-IR')} ریال`,
                Math.round(finalPrice).toLocaleString('fa-IR')
            ];
        });
        
        const grandNetQty = totalSalesQty - totalReturnQty;
        const grandNetAmt = totalSalesAmt - totalReturnAmt;
        const grandFinalPrice = grandNetQty > 0 ? (grandNetAmt / grandNetQty) : 0;
        
        tableRows.push([
            'جمع کل',
            '-',
            `${totalSalesQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ک‌گ / ${Math.round(totalSalesAmt).toLocaleString('fa-IR')} ریال`,
            `${totalReturnQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ک‌گ / ${Math.round(totalReturnAmt).toLocaleString('fa-IR')} ریال`,
            `${grandNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ک‌گ / ${Math.round(grandNetAmt).toLocaleString('fa-IR')} ریال`,
            Math.round(grandFinalPrice).toLocaleString('fa-IR')
        ]);
        
        const pdfBuffer = await Renderer.generateReportPDF(title, columns, tableRows, true); // Landscape
        
        if (!pdfBuffer) {
            throw new Error('خطا در تولید فایل PDF گزارش. لطفاً اطمینان حاصل کنید که مرورگر Chrome یا Edge روی سرور نصب شده باشد.');
        }

        const filename = `Sayan_Daily_Sales_${gregDate}_${labelSuffix === 'دیروز' ? 'Yesterday' : 'Today'}.pdf`;
        
        const caption = `📊 *گزارش فروش و مرجوعی روزانه سایان ERP*
📅 *تاریخ:* ${shamsiDate} (${labelSuffix})
🧾 *تعداد اقلام:* ${groupedRows.length} مورد
📦 *وزن فروش ناخالص:* ${totalSalesQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
💵 *مبلغ فروش ناخالص:* ${Math.round(totalSalesAmt).toLocaleString('fa-IR')} ریال
🔄 *وزن مرجوعی (کد ۱۳):* ${totalReturnQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
❌ *مبلغ مرجوعی:* ${Math.round(totalReturnAmt).toLocaleString('fa-IR')} ریال
✅ *وزن خالص کل:* ${grandNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
💰 *فروش خالص کل:* ${Math.round(grandNetAmt).toLocaleString('fa-IR')} ریال
🏷️ *فی نهایی میانگین:* ${Math.round(grandFinalPrice).toLocaleString('fa-IR')} ریال/کیلوگرم`;

        let successfulSends = 0;
        const sendDetails = [];
        let lastErr = null;
        for (const tgt of uniqueSalesTargets) {
            try {
                if (tgt.platform === 'telegram') {
                    await telegram.sendBotDocument(tgt.id, pdfBuffer, filename, caption);
                    successfulSends++;
                    sendDetails.push({ platform: 'telegram', id: tgt.id, status: 'success' });
                } else if (tgt.platform === 'bale') {
                    await bale.sendBotDocument(tgt.id, pdfBuffer, filename, caption);
                    successfulSends++;
                    sendDetails.push({ platform: 'bale', id: tgt.id, status: 'success' });
                } else if (tgt.platform === 'whatsapp') {
                    const wa = await safeImport('./backend/whatsapp.js');
                    if (wa && wa.sendMessage) {
                        await wa.sendMessage(tgt.id, caption, {
                            data: pdfBuffer.toString('base64'),
                            mimeType: 'application/pdf',
                            filename: filename
                        });
                        successfulSends++;
                        sendDetails.push({ platform: 'whatsapp', id: tgt.id, status: 'success' });
                    } else {
                        throw new Error('ماژول واتساپ در دسترس نیست');
                    }
                }
            } catch (e) {
                lastErr = e.message;
                console.error(`[Manual/Auto Sales Report] Failed to send to ${tgt.platform} group ${tgt.id}:`, e.message);
                sendDetails.push({ platform: tgt.platform, id: tgt.id, status: 'failed', error: e.message });
            }
        }

        if (successfulSends === 0) {
            throw new Error(`ارسال گزارش فروش ناموفق بود: ${lastErr || 'خطا در اتصال به پیام‌رسان‌ها'}`);
        }

        return { count: salesRows.length, totalSalesQty, totalSalesAmt, grandNetAmt, grandNetQty, grandFinalPrice, sent: true, successfulSends, totalTargets: uniqueSalesTargets.length, sendDetails };

    } else {
        const emptyMsg = `⚠️ هیچ فاکتور فروشی برای ${labelSuffix} (${shamsiDate}) در سرور سایان ثبت نشده است.`;
        let successfulSends = 0;
        const sendDetails = [];
        let lastErr = null;
        for (const tgt of uniqueSalesTargets) {
            try {
                if (tgt.platform === 'telegram') {
                    await telegram.sendBotMessage(tgt.id, emptyMsg);
                    successfulSends++;
                    sendDetails.push({ platform: 'telegram', id: tgt.id, status: 'success' });
                } else if (tgt.platform === 'bale') {
                    await bale.sendBotMessage(tgt.id, emptyMsg);
                    successfulSends++;
                    sendDetails.push({ platform: 'bale', id: tgt.id, status: 'success' });
                } else if (tgt.platform === 'whatsapp') {
                    const wa = await safeImport('./backend/whatsapp.js');
                    if (wa && wa.sendMessage) {
                        await wa.sendMessage(tgt.id, emptyMsg);
                        successfulSends++;
                        sendDetails.push({ platform: 'whatsapp', id: tgt.id, status: 'success' });
                    } else {
                        throw new Error('ماژول واتساپ در دسترس نیست');
                    }
                }
            } catch (e) {
                lastErr = e.message;
                console.error(`[Manual/Auto Sales Report] Failed to send empty msg to ${tgt.platform} group ${tgt.id}:`, e.message);
                sendDetails.push({ platform: tgt.platform, id: tgt.id, status: 'failed', error: e.message });
            }
        }

        if (successfulSends === 0) {
            throw new Error(`ارسال پیام عدم وجود فاکتور فروش ناموفق بود: ${lastErr || 'خطا در پیام‌رسان‌ها'}`);
        }

        return { count: 0, sent: true, successfulSends, totalTargets: uniqueSalesTargets.length, sendDetails };
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


app.post('/api/sayan/sales-report/send-compare', async (req, res) => {
    try {
        const db = getDb();
        const settings = db.settings || {};
        const { chartData, dateFromA, dateToA, dateFromB, dateToB, selectedPlatforms, customTargets } = req.body;
        
        if (!chartData || chartData.length === 0) {
            return res.status(400).json({ error: 'داده‌ای برای ارسال وجود ندارد' });
        }

        const platforms = selectedPlatforms && selectedPlatforms.length > 0 ? selectedPlatforms : ['telegram', 'bale', 'whatsapp'];
        const uniqueSalesTargets = collectBotTargets(db, { category: 'sales', platforms, customTargets });
        
        if (uniqueSalesTargets.length === 0) {
            throw new Error('گروهی برای ارسال گزارش فروش (تلگرام یا بله) در تنظیمات سیستم ثبت نشده است. لطفاً در تنظیمات سیستم -> تب ربات‌ها آیدی گروه مقصد را وارد نمایید.');
        }

        const title = `گزارش تحلیلی و مقایسه‌ای فروش (دوره A vs دوره B)`;
        const columns = ['ردیف', 'گروه اصلی کالا', 'وزن A (ک‌گ)', 'مبلغ A (ریال)', 'وزن B (ک‌گ)', 'مبلغ B (ریال)', 'تغییر وزن %', 'تغییر مبلغ %', 'تغییر فی %'];
        
        let totalNetWgtA = 0;
        let totalNetAmtA = 0;
        let totalNetWgtB = 0;
        let totalNetAmtB = 0;

        const tableRows = chartData.map((row, idx) => {
            const wgtA = row.netWeightA ?? row.netWgtA ?? row.grossWgtA ?? 0;
            const amtA = row.netAmountA ?? row.netAmtA ?? 0;
            const feeA = row.netFeeA ?? (wgtA > 0 ? amtA / wgtA : 0);

            const wgtB = row.netWeightB ?? row.netWgtB ?? row.grossWgtB ?? 0;
            const amtB = row.netAmountB ?? row.netAmtB ?? 0;
            const feeB = row.netFeeB ?? (wgtB > 0 ? amtB / wgtB : 0);

            totalNetWgtA += wgtA;
            totalNetAmtA += amtA;
            totalNetWgtB += wgtB;
            totalNetAmtB += amtB;

            const diffWgt = wgtA - wgtB;
            const wgtPct = wgtB > 0 ? ((diffWgt / wgtB) * 100).toFixed(1) : (wgtA > 0 ? '+100' : '0');
            const wgtPctStr = (Number(wgtPct) >= 0 ? '+' : '') + wgtPct + '%';

            const diffAmt = amtA - amtB;
            const amtPct = amtB > 0 ? ((diffAmt / amtB) * 100).toFixed(1) : (amtA > 0 ? '+100' : '0');
            const amtPctStr = (Number(amtPct) >= 0 ? '+' : '') + amtPct + '%';

            const diffFee = feeA - feeB;
            const feePct = feeB > 0 ? ((diffFee / feeB) * 100).toFixed(1) : (feeA > 0 ? '+100' : '0');
            const feePctStr = (Number(feePct) >= 0 ? '+' : '') + feePct + '%';

            return [
                (idx + 1).toLocaleString('fa-IR'),
                row.name || row.catName || 'سایر',
                wgtA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ک‌گ',
                Math.round(amtA).toLocaleString('fa-IR') + ' ریال',
                wgtB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ک‌گ',
                Math.round(amtB).toLocaleString('fa-IR') + ' ریال',
                wgtPctStr,
                amtPctStr,
                feePctStr
            ];
        });
        
        const avgFeeA = totalNetWgtA > 0 ? totalNetAmtA / totalNetWgtA : 0;
        const avgFeeB = totalNetWgtB > 0 ? totalNetAmtB / totalNetWgtB : 0;

        const totalDiffWgt = totalNetWgtA - totalNetWgtB;
        const totalWgtPct = totalNetWgtB > 0 ? ((totalDiffWgt / totalNetWgtB) * 100).toFixed(1) : (totalNetWgtA > 0 ? '+100' : '0');
        const totalWgtPctStr = (Number(totalWgtPct) >= 0 ? '+' : '') + totalWgtPct + '%';

        const totalDiffAmt = totalNetAmtA - totalNetAmtB;
        const totalAmtPct = totalNetAmtB > 0 ? ((totalDiffAmt / totalNetAmtB) * 100).toFixed(1) : (totalNetAmtA > 0 ? '+100' : '0');
        const totalAmtPctStr = (Number(totalAmtPct) >= 0 ? '+' : '') + totalAmtPct + '%';

        const totalDiffFee = avgFeeA - avgFeeB;
        const totalFeePct = avgFeeB > 0 ? ((totalDiffFee / avgFeeB) * 100).toFixed(1) : (avgFeeA > 0 ? '+100' : '0');
        const totalFeePctStr = (Number(totalFeePct) >= 0 ? '+' : '') + totalFeePct + '%';

        tableRows.push([
            'جمع کل',
            'خلاصه کل عملکرد',
            totalNetWgtA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ک‌گ',
            Math.round(totalNetAmtA).toLocaleString('fa-IR') + ' ریال',
            totalNetWgtB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ک‌گ',
            Math.round(totalNetAmtB).toLocaleString('fa-IR') + ' ریال',
            totalWgtPctStr,
            totalAmtPctStr,
            totalFeePctStr
        ]);

        const pdfBuffer = await Renderer.generateReportPDF(title, columns, tableRows, true);
        
        if (!pdfBuffer) {
            throw new Error('خطا در تولید فایل PDF گزارش. لطفاً اطمینان حاصل کنید که مرورگر Chrome یا Edge روی سرور نصب شده باشد.');
        }

        const filename = `Compare_Sales_${Date.now()}.pdf`;
        
        const caption = `📊 *گزارش مدیریتی مقایسه‌ای فروش (سایان ERP)*

📅 *دوره A (پایه):* ${dateFromA || '---'} الی ${dateToA || '---'}
📅 *دوره B (تطبیقی):* ${dateFromB || '---'} الی ${dateToB || '---'}

📦 *وزن کل A:* ${totalNetWgtA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
💵 *فروش کل A:* ${Math.round(totalNetAmtA).toLocaleString('fa-IR')} ریال
🏷 *فی متوسط A:* ${Math.round(avgFeeA).toLocaleString('fa-IR')} ریال/ک‌گ

📦 *وزن کل B:* ${totalNetWgtB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
💵 *فروش کل B:* ${Math.round(totalNetAmtB).toLocaleString('fa-IR')} ریال
🏷 *فی متوسط B:* ${Math.round(avgFeeB).toLocaleString('fa-IR')} ریال/ک‌گ

📈 *تغییرات وزن:* ${totalWgtPctStr}
💵 *تغییرات مبلغ:* ${totalAmtPctStr}
📊 *تغییرات فی متوسط:* ${totalFeePctStr}`;

        let successfulSends = 0;
        const sendDetails = [];
        let lastErr = null;
        for (const tgt of uniqueSalesTargets) {
            try {
                if (tgt.platform === 'telegram') {
                    await telegram.sendBotDocument(tgt.id, pdfBuffer, filename, caption);
                    successfulSends++;
                    sendDetails.push({ platform: 'telegram', id: tgt.id, status: 'success' });
                } else if (tgt.platform === 'bale') {
                    await bale.sendBotDocument(tgt.id, pdfBuffer, filename, caption);
                    successfulSends++;
                    sendDetails.push({ platform: 'bale', id: tgt.id, status: 'success' });
                } else if (tgt.platform === 'whatsapp') {
                    const wa = await safeImport('./backend/whatsapp.js');
                    if (wa && wa.sendMessage) {
                        await wa.sendMessage(tgt.id, caption, {
                            data: pdfBuffer.toString('base64'),
                            mimeType: 'application/pdf',
                            filename: filename
                        });
                        successfulSends++;
                        sendDetails.push({ platform: 'whatsapp', id: tgt.id, status: 'success' });
                    } else {
                        throw new Error('ماژول واتساپ در دسترس نیست');
                    }
                }
            } catch (e) {
                lastErr = e.message;
                console.error(`Failed to send compare report to ${tgt.platform} group ${tgt.id}:`, e.message);
                sendDetails.push({ platform: tgt.platform, id: tgt.id, status: 'failed', error: e.message });
            }
        }

        if (successfulSends === 0) {
            throw new Error(`ارسال گزارش مقایسه‌ای ناموفق بود: ${lastErr || 'خطا در ارسال به پیام‌رسان‌ها'}`);
        }

        res.json({ 
            success: true, 
            message: 'گزارش مقایسه‌ای با موفقیت به پیام‌رسان‌ها ارسال گردید.',
            sendDetails,
            successfulSends,
            totalTargets: uniqueSalesTargets.length
        });
    } catch (e) {
        console.error("Compare Sales Report Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/sayan/sales-report/download-compare-pdf', async (req, res) => {
    try {
        const { compareType, chartData, dateFromA, dateToA, dateFromB, dateToB } = req.body;
        if (!chartData || chartData.length === 0) {
            return res.status(400).json({ error: 'داده‌ای برای تولید PDF وجود ندارد' });
        }

        const isItems = compareType === 'items';
        const title = isItems
            ? `گزارش تفکیکی و مقایسه‌ای فروش ریز کالاها (دوره A: ${dateFromA || '---'} تا ${dateToA || '---'} / دوره B: ${dateFromB || '---'} تا ${dateToB || '---'})`
            : `گزارش تحلیلی و مقایسه‌ای فروش خلاصه گروه‌ها (دوره A: ${dateFromA || '---'} تا ${dateToA || '---'} / دوره B: ${dateFromB || '---'} تا ${dateToB || '---'})`;

        const columns = isItems
            ? ['ردیف', 'نام کالا', 'گروه اصلی', 'وزن A (ک‌گ)', 'مبلغ A (ریال)', 'وزن B (ک‌گ)', 'مبلغ B (ریال)', 'تغییر وزن %', 'تغییر مبلغ %', 'تغییر فی %']
            : ['ردیف', 'گروه اصلی کالا', 'وزن A (ک‌گ)', 'مبلغ A (ریال)', 'وزن B (ک‌گ)', 'مبلغ B (ریال)', 'تغییر وزن %', 'تغییر مبلغ %', 'تغییر فی %'];
        
        let totalNetWgtA = 0;
        let totalNetAmtA = 0;
        let totalNetWgtB = 0;
        let totalNetAmtB = 0;

        const tableRows = chartData.map((row, idx) => {
            const wgtA = row.netWeightA ?? row.netWgtA ?? row.grossWgtA ?? 0;
            const amtA = row.netAmountA ?? row.netAmtA ?? 0;
            const feeA = row.netFeeA ?? (wgtA > 0 ? amtA / wgtA : 0);

            const wgtB = row.netWeightB ?? row.netWgtB ?? row.grossWgtB ?? 0;
            const amtB = row.netAmountB ?? row.netAmtB ?? 0;
            const feeB = row.netFeeB ?? (wgtB > 0 ? amtB / wgtB : 0);

            totalNetWgtA += wgtA;
            totalNetAmtA += amtA;
            totalNetWgtB += wgtB;
            totalNetAmtB += amtB;

            const diffWgt = wgtA - wgtB;
            const wgtPct = wgtB > 0 ? ((diffWgt / wgtB) * 100).toFixed(1) : (wgtA > 0 ? '+100' : '0');
            const wgtPctStr = (Number(wgtPct) >= 0 ? '+' : '') + wgtPct + '%';

            const diffAmt = amtA - amtB;
            const amtPct = amtB > 0 ? ((diffAmt / amtB) * 100).toFixed(1) : (amtA > 0 ? '+100' : '0');
            const amtPctStr = (Number(amtPct) >= 0 ? '+' : '') + amtPct + '%';

            const diffFee = feeA - feeB;
            const feePct = feeB > 0 ? ((diffFee / feeB) * 100).toFixed(1) : (feeA > 0 ? '+100' : '0');
            const feePctStr = (Number(feePct) >= 0 ? '+' : '') + feePct + '%';

            if (isItems) {
                return [
                    (idx + 1).toLocaleString('fa-IR'),
                    row.name || 'نامشخص',
                    row.category || 'سایر',
                    wgtA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ک‌گ',
                    Math.round(amtA).toLocaleString('fa-IR') + ' ریال',
                    wgtB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ک‌گ',
                    Math.round(amtB).toLocaleString('fa-IR') + ' ریال',
                    wgtPctStr,
                    amtPctStr,
                    feePctStr
                ];
            } else {
                return [
                    (idx + 1).toLocaleString('fa-IR'),
                    row.name || row.catName || 'سایر',
                    wgtA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ک‌گ',
                    Math.round(amtA).toLocaleString('fa-IR') + ' ریال',
                    wgtB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ک‌گ',
                    Math.round(amtB).toLocaleString('fa-IR') + ' ریال',
                    wgtPctStr,
                    amtPctStr,
                    feePctStr
                ];
            }
        });
        
        const avgFeeA = totalNetWgtA > 0 ? totalNetAmtA / totalNetWgtA : 0;
        const avgFeeB = totalNetWgtB > 0 ? totalNetAmtB / totalNetWgtB : 0;

        const totalDiffWgt = totalNetWgtA - totalNetWgtB;
        const totalWgtPct = totalNetWgtB > 0 ? ((totalDiffWgt / totalNetWgtB) * 100).toFixed(1) : (totalNetWgtA > 0 ? '+100' : '0');
        const totalWgtPctStr = (Number(totalWgtPct) >= 0 ? '+' : '') + totalWgtPct + '%';

        const totalDiffAmt = totalNetAmtA - totalNetAmtB;
        const totalAmtPct = totalNetAmtB > 0 ? ((totalDiffAmt / totalNetAmtB) * 100).toFixed(1) : (totalNetAmtA > 0 ? '+100' : '0');
        const totalAmtPctStr = (Number(totalAmtPct) >= 0 ? '+' : '') + totalAmtPct + '%';

        const totalDiffFee = avgFeeA - avgFeeB;
        const totalFeePct = avgFeeB > 0 ? ((totalDiffFee / avgFeeB) * 100).toFixed(1) : (avgFeeA > 0 ? '+100' : '0');
        const totalFeePctStr = (Number(totalFeePct) >= 0 ? '+' : '') + totalFeePct + '%';

        if (isItems) {
            tableRows.push([
                'جمع کل',
                'خلاصه عملکرد ریز کالاها',
                '-',
                totalNetWgtA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ک‌گ',
                Math.round(totalNetAmtA).toLocaleString('fa-IR') + ' ریال',
                totalNetWgtB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ک‌گ',
                Math.round(totalNetAmtB).toLocaleString('fa-IR') + ' ریال',
                totalWgtPctStr,
                totalAmtPctStr,
                totalFeePctStr
            ]);
        } else {
            tableRows.push([
                'جمع کل',
                'خلاصه کل عملکرد',
                totalNetWgtA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ک‌گ',
                Math.round(totalNetAmtA).toLocaleString('fa-IR') + ' ریال',
                totalNetWgtB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' ک‌گ',
                Math.round(totalNetAmtB).toLocaleString('fa-IR') + ' ریال',
                totalWgtPctStr,
                totalAmtPctStr,
                totalFeePctStr
            ]);
        }

        const pdfBuffer = await Renderer.generateReportPDF(title, columns, tableRows, true);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Compare_Sales_Report_${Date.now()}.pdf"`);
        res.send(pdfBuffer);
    } catch (e) {
        console.error("Download Compare PDF Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/sayan/sales-report/send-executive', async (req, res) => {
    try {
        const db = getDb();
        const settings = db.settings || {};
        const { dateFrom, dateTo, summary, groupData, customTargets, selectedPlatforms } = req.body;

        const title = `داشبورد مدیریتی گزارش فروش سایان ERP (${dateFrom || 'امروز'} تا ${dateTo || 'امروز'})`;

        const platforms = selectedPlatforms && selectedPlatforms.length > 0 ? selectedPlatforms : ['telegram', 'bale', 'whatsapp'];
        const uniqueTargets = collectBotTargets(db, { category: 'sales', platforms, customTargets });

        if (uniqueTargets.length === 0) {
            throw new Error('هیچ شناسه گروه یا چت مقصد برای پیام‌رسان‌های انتخاب شده یافت نشد. لطفاً در بخش «تنظیمات سیستم ⚙️ -> تب ربات‌ها» شناسه چت یا گروه تلگرام/بله را وارد نمایید.');
        }

        const columns = ['ردیف', 'گروه اصلی کالا', 'وزن خالص (ک‌گ)', 'فروش خالص (ریال)', 'فی نهایی (ریال/ک‌گ)', 'سهم %'];
        const tableRows = (groupData || []).map((g, idx) => [
            (idx + 1).toLocaleString('fa-IR'),
            g.name || 'سایر',
            (g.netWgt || 0).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
            Math.round(g.netAmt || 0).toLocaleString('fa-IR'),
            Math.round(g.netFee || 0).toLocaleString('fa-IR'),
            `${(g.sharePct || 0).toFixed(1)}%`
        ]);

        if (summary) {
            tableRows.push([
                'جمع کل',
                '-',
                (summary.netWeight || 0).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                Math.round(summary.netAmount || 0).toLocaleString('fa-IR'),
                Math.round(summary.avgFee || 0).toLocaleString('fa-IR'),
                '100%'
            ]);
        }

        const pdfBuffer = await Renderer.generateReportPDF(title, columns, tableRows, true);
        
        if (!pdfBuffer) {
            throw new Error('خطا در تولید فایل PDF گزارش. لطفاً اطمینان حاصل کنید که مرورگر Chrome یا Edge روی سرور نصب شده باشد.');
        }

        const filename = `Executive_Sales_Report_${Date.now()}.pdf`;

        const caption = `📊 *گزارش مدیریتی فروش سایان ERP*
📅 *بازه گزارش:* از ${dateFrom || '-'} تا ${dateTo || '-'}

💰 *فروش خالص کل:* ${Math.round(summary?.netAmount || 0).toLocaleString('fa-IR')} ریال
📦 *وزن خالص کل:* ${(summary?.netWeight || 0).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
🏷️ *فی خالص میانگین:* ${Math.round(summary?.avgFee || 0).toLocaleString('fa-IR')} ریال/کیلوگرم
🧾 *تعداد فاکتورها:* ${summary?.invoiceCount || 0} عدد | 👥 *تعداد مشتریان:* ${summary?.customerCount || 0} نفر
💵 *میانگین هر فاکتور:* ${Math.round(summary?.avgInvoiceAmt || 0).toLocaleString('fa-IR')} ریال

⭐ *پرفروش‌ترین گروه:* ${summary?.topGroup || 'نامشخص'}
🏆 *پرفروش‌ترین کالا:* ${summary?.topProduct || 'نامشخص'}
🔻 *میزان مرجوعی:* ${Math.round(summary?.returnAmount || 0).toLocaleString('fa-IR')} ریال (${(summary?.returnWeight || 0).toFixed(1)} ک‌گ)

📎 فایل کامل PDF شامل جزئیات گروه‌های کالا پیوست گردید.`;

        let successfulSends = 0;
        const sendDetails = [];
        let lastErr = null;
        for (const tgt of uniqueTargets) {
            try {
                if (tgt.platform === 'telegram') {
                    await telegram.sendBotDocument(tgt.id, pdfBuffer, filename, caption);
                    successfulSends++;
                    sendDetails.push({ platform: 'telegram', id: tgt.id, status: 'success' });
                } else if (tgt.platform === 'bale') {
                    await bale.sendBotDocument(tgt.id, pdfBuffer, filename, caption);
                    successfulSends++;
                    sendDetails.push({ platform: 'bale', id: tgt.id, status: 'success' });
                } else if (tgt.platform === 'whatsapp') {
                    const wa = await safeImport('./backend/whatsapp.js');
                    if (wa && wa.sendMessage) {
                        await wa.sendMessage(tgt.id, caption, {
                            data: pdfBuffer.toString('base64'),
                            mimeType: 'application/pdf',
                            filename: filename
                        });
                        successfulSends++;
                        sendDetails.push({ platform: 'whatsapp', id: tgt.id, status: 'success' });
                    } else {
                        throw new Error('ماژول واتساپ در دسترس نیست');
                    }
                }
            } catch (e) {
                lastErr = e.message;
                console.error(`Failed to send executive report to ${tgt.platform} group ${tgt.id}:`, e.message);
                sendDetails.push({ platform: tgt.platform, id: tgt.id, status: 'failed', error: e.message });
            }
        }

        if (successfulSends === 0) {
            throw new Error(`ارسال گزارش به پیام‌رسان‌ها ناموفق بود: ${lastErr || 'خطای شبکه'}`);
        }

        res.json({ 
            success: true, 
            message: `گزارش مدیریتی با موفقیت به پیام‌رسان‌ها ارسال گردید.`,
            sendDetails,
            successfulSends,
            totalTargets: uniqueTargets.length
        });
    } catch (e) {
        console.error("Executive Sales Report Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- SAYAN PRODUCTION REPORT ENDPOINTS ---
const normalizeShamsiDate = (str) => {
    if (!str) return '';
    return String(str).trim()
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
};

const parseJalaliStrToGregorian = (jalaliStr) => {
    if (!jalaliStr) return null;
    try {
        const clean = normalizeShamsiDate(jalaliStr);
        const parts = clean.split(/[\/\.\-]/).map(p => parseInt(p, 10)).filter(n => !isNaN(n));
        if (parts.length !== 3) return null;

        let jy = 0, jm = 0, jd = 0;

        if (parts[0] >= 1300 || parts[0] === 404 || parts[0] === 405 || (parts[0] >= 100 && parts[0] < 1000)) {
            jy = parts[0]; jm = parts[1]; jd = parts[2];
        } else if (parts[2] >= 1300 || parts[2] === 404 || parts[2] === 405 || parts[2] >= 100) {
            jy = parts[2]; jm = parts[1]; jd = parts[0];
        } else {
            if (parts[0] > 12) {
                jd = parts[0]; jm = parts[1]; jy = parts[2];
            } else {
                jy = parts[2]; jm = parts[1]; jd = parts[0];
            }
        }

        if (jy < 100) jy += 1400;
        else if (jy >= 100 && jy < 1000) jy += 1000;

        if (jm > 12 && jd <= 12) {
            const temp = jm; jm = jd; jd = temp;
        }

        const g = jalaali.toGregorian(jy, jm, jd);
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

app.post('/api/sayan-proxy', async (req, res) => {
    try {
        const db = getDb();
        const settings = db.settings || {};
        const serverSayanBaseUrl = settings.sayanApiUrl || process.env.SAYAN_API_URL;
        const serverSayanApiKey = settings.sayanApiKey || process.env.SAYAN_API_KEY;

        if (!serverSayanBaseUrl || !serverSayanApiKey) {
            return res.status(400).json({ error: 'تنظیمات آدرس API و کلید امنیتی سایان در بخش تنظیمات سیستم وارد نشده است.' });
        }

        const { path: targetPath, method: targetMethod, body: targetBody } = req.body;
        if (!targetPath) {
            return res.status(400).json({ error: 'مسیر درخواست (path) الزامی است.' });
        }

        const cleanPath = targetPath.replace(/^\//, '');
        const finalUrl = `${serverSayanBaseUrl.replace(/\/$/, '')}/${cleanPath}`;

        const headers = {
            'Authorization': `Bearer ${serverSayanApiKey}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        const fetchOptions = {
            method: targetMethod || 'GET',
            headers
        };

        if (targetBody && (targetMethod === 'POST' || targetMethod === 'PUT')) {
            fetchOptions.body = JSON.stringify(targetBody);
        }

        const response = await fetch(finalUrl, fetchOptions);
        const data = await response.json().catch(() => null);

        if (!response.ok) {
            return res.status(response.status).json(data || { error: `Sayan Server returned error status ${response.status}` });
        }

        res.json(data);
    } catch (err) {
        console.error("Sayan Proxy Error:", err);
        res.status(500).json({ error: err.message || 'خطا در برقراری ارتباط با وب‌سرویس سایان' });
    }
});

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
        
        const uniqueTargets = collectBotTargets(db, { category: 'production' });

        if (uniqueTargets.length === 0) {
            return res.status(400).json({ error: 'هیچ شناسه گروه آمار تولید (تلگرام، بله یا واتساپ) در تنظیمات سیستم یافت نشد. لطفاً در «تنظیمات سیستم -> اطلاع‌رسانی ربات» شناسه گروه آمار تولید را وارد نمایید.' });
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
        const { targetDate, date, label, selectedPlatforms, customTargets, activeYear } = req.body;
        
        let dateObj = new Date();
        let labelSuffix = label || 'امروز';

        if (targetDate === 'today' || targetDate === 'yesterday') {
            const today = new Date();
            const jToday = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
            let targetY = activeYear ? parseInt(activeYear, 10) : jToday.jy;
            if (isNaN(targetY)) targetY = jToday.jy;

            let targetJalaliStr = '';
            if (targetDate === 'today') {
                targetJalaliStr = `${targetY}/${String(jToday.jm).padStart(2, '0')}/${String(jToday.jd).padStart(2, '0')}`;
                labelSuffix = label || `امروز (${targetJalaliStr})`;
            } else if (targetDate === 'yesterday') {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const jYest = jalaali.toJalaali(yesterday.getFullYear(), yesterday.getMonth() + 1, yesterday.getDate());
                targetJalaliStr = `${targetY}/${String(jYest.jm).padStart(2, '0')}/${String(jYest.jd).padStart(2, '0')}`;
                labelSuffix = label || `دیروز (${targetJalaliStr})`;
            }

            if (targetJalaliStr) {
                const gregStr = parseJalaliStrToGregorian(targetJalaliStr);
                if (gregStr) {
                    const parts = gregStr.split('-').map(x => parseInt(x, 10));
                    dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
                }
            }
        } else if (date) {
            if (typeof date === 'string' && (date.includes('/') || date.includes('.') || date.includes('-'))) {
                // Shamsi date passed e.g. "1404/05/10" or "1.1.404"
                const gregStr = parseJalaliStrToGregorian(date);
                if (gregStr) {
                    const parts = gregStr.split('-').map(x => parseInt(x, 10));
                    dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
                }
            } else {
                dateObj = new Date(date);
            }
            labelSuffix = label || date;
        }

        const result = await sendDailySalesReportForDate(db, dateObj, labelSuffix, customTargets, selectedPlatforms);
        res.json({
            success: true,
            message: `گزارش فروش ${labelSuffix} با موفقیت به پیام‌رسان‌ها ارسال شد.`,
            result
        });
    } catch (e) {
        console.error("Manual Sales Report Sending Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/users', (req, res) => {
    const db = getDb();
    res.json(db.users || []);
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

// --- SETTINGS AND DATABASE CONFIGURATION ENDPOINTS ---
app.get('/api/settings', (req, res) => {
    const db = getDb();
    res.json(db.settings || {});
});

app.post('/api/settings', async (req, res) => {
    const db = getDb();
    db.settings = { ...(db.settings || {}), ...req.body };
    saveDb(db);
    
    // Automatically re-initialize bots on settings save
    try {
        if (db.settings.telegramBotToken) {
            const tg = await safeImport('./backend/telegram.js');
            if (tg && tg.initTelegram) {
                await tg.initTelegram(db.settings.telegramBotToken);
            }
        }
        if (db.settings.baleBotToken) {
            const bale = await safeImport('./backend/bale.js');
            if (bale && bale.initBaleBot) {
                await bale.initBaleBot(db.settings.baleBotToken);
            }
        }
    } catch (err) {
        console.error("Auto-restart bots from settings save failed:", err);
    }

    res.json(db.settings);
});

// --- NUMBER SEQUENCE GENERATORS ---
app.get('/api/next-exit-permit-number', (req, res) => {
    const db = getDb();
    const permits = db.exitPermits || [];
    const company = req.query.company || db.settings?.defaultCompany || '';
    let startNum = db.settings?.currentExitPermitNumber || 1000;
    let activeYear = null;
    if (db.settings?.activeFiscalYearId) {
        activeYear = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (activeYear) {
            if (activeYear.companySequences && company) {
                const target = company.trim().replace(/\s+/g, ' ');
                const foundKey = Object.keys(activeYear.companySequences).find(k => k.trim().replace(/\s+/g, ' ') === target);
                if (foundKey && activeYear.companySequences[foundKey]) {
                    const seqVal = activeYear.companySequences[foundKey].startExitPermitNumber;
                    if (seqVal) startNum = parseInt(String(seqVal)) || startNum;
                }
            }
        }
    }

    let filteredPermits = permits;
    if (activeYear) {
        filteredPermits = permits.filter(p => {
            if (p.fiscalYearId) return p.fiscalYearId === activeYear.id;
            if (activeYear.label) {
                const shamsiYM = utils.toShamsiYearMonth(p.date);
                if (shamsiYM && shamsiYM.startsWith(activeYear.label + '/')) return true;
            }
            if (activeYear.startDate && activeYear.endDate && p.date) {
                return p.date >= activeYear.startDate && p.date <= activeYear.endDate;
            }
            return true;
        });
    }

    const nextNum = findNextMaxNumber(filteredPermits, company, 'permitNumber', startNum);
    res.json({ nextNumber: nextNum });
});

app.get('/api/next-tracking-number', (req, res) => {
    const db = getDb();
    const company = req.query.company || db.settings?.defaultCompany || '';
    let startNum = db.settings?.currentTrackingNumber || 1000;
    let activeYear = null;
    if (db.settings?.activeFiscalYearId) {
        activeYear = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (activeYear) {
            if (company && activeYear.companySequences) {
                const target = company.trim().replace(/\s+/g, ' ');
                const foundKey = Object.keys(activeYear.companySequences).find(k => k.trim().replace(/\s+/g, ' ') === target);
                if (foundKey && activeYear.companySequences[foundKey]) {
                    const seqVal = activeYear.companySequences[foundKey].startTrackingNumber;
                    if (seqVal) startNum = parseInt(String(seqVal)) || startNum;
                }
            }
        }
    }
    
    // Filter orders to only include those in the current fiscal year (by fiscalYearId, label, or date range)
    let filteredOrders = db.orders || [];
    if (activeYear) {
        filteredOrders = filteredOrders.filter(o => {
            if (o.fiscalYearId) {
                return o.fiscalYearId === activeYear.id;
            }
            if (activeYear.label) {
                const shamsiYM = utils.toShamsiYearMonth(o.date);
                if (shamsiYM && shamsiYM.startsWith(activeYear.label + '/')) {
                    return true;
                }
            }
            if (activeYear.startDate && activeYear.endDate && o.date) {
                return o.date >= activeYear.startDate && o.date <= activeYear.endDate;
            }
            return false;
        });
    }

    const nextNum = findNextMaxNumber(filteredOrders, company, 'trackingNumber', startNum);
    res.json({ nextTrackingNumber: nextNum });
});

app.get('/api/next-bijak-number', (req, res) => {
    const db = getDb();
    const company = req.query.company || db.settings?.defaultCompany || '';
    const txs = db.warehouseTransactions || [];
    let startNum = 1000;
    let activeYear = null;
    if (db.settings?.activeFiscalYearId) {
        activeYear = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (activeYear && company) {
            if (activeYear.companySequences) {
                const target = company.trim().replace(/\s+/g, ' ');
                const foundKey = Object.keys(activeYear.companySequences).find(k => k.trim().replace(/\s+/g, ' ') === target);
                if (foundKey && activeYear.companySequences[foundKey]) {
                    const seqVal = activeYear.companySequences[foundKey].startBijakNumber;
                    if (seqVal) startNum = parseInt(String(seqVal)) || startNum;
                }
            }
        }
    }

    // Filter transactions to only include OUT (Bijaks) that fall within the active fiscal year
    let filteredTxs = txs.filter(tx => tx.type === 'OUT');
    if (activeYear) {
        filteredTxs = filteredTxs.filter(tx => {
            if (activeYear.label) {
                const shamsiYM = utils.toShamsiYearMonth(tx.date);
                if (shamsiYM && shamsiYM.startsWith(activeYear.label + '/')) {
                    return true;
                }
            }
            if (activeYear.startDate && activeYear.endDate && tx.date) {
                return tx.date >= activeYear.startDate && tx.date <= activeYear.endDate;
            }
            return false;
        });
    }

    const nextNum = findNextMaxNumber(filteredTxs, company, 'number', startNum);
    res.json({ nextNumber: nextNum });
});

app.get('/api/next-meeting-number', (req, res) => {
    const db = getDb();
    const meetings = db.meetings || [];
    let maxNum = 1000;
    meetings.forEach(m => {
        if (m.number && m.number.startsWith('M-')) {
            const num = parseInt(m.number.replace('M-', ''));
            if (!isNaN(num) && num > maxNum) maxNum = num;
        }
    });
    res.json({ nextNumber: `M-${maxNum + 1}` });
});

app.get('/api/next-purchase-request-number', (req, res) => {
    const db = getDb();
    const reqs = db.purchaseRequests || [];
    let maxNum = 1000;
    reqs.forEach(r => {
        if (r.number && r.number.startsWith('PR-')) {
            const num = parseInt(r.number.replace('PR-', ''));
            if (!isNaN(num) && num > maxNum) maxNum = num;
        }
    });
    res.json({ nextNumber: `PR-${maxNum + 1}` });
});

app.get('/api/next-cheque-receipt-number', (req, res) => {
    const db = getDb();
    const company = req.query.company || '';
    const receipts = db.chequeReceipts || [];
    let startNum = db.settings?.currentChequeReceiptNumber ? parseInt(String(db.settings.currentChequeReceiptNumber)) || 1000 : 1000;
    if (db.settings?.activeFiscalYearId && company) {
        const year = (db.settings.fiscalYears || []).find(y => y.id === db.settings.activeFiscalYearId);
        if (year && year.companySequences && year.companySequences[company]) {
            startNum = parseInt(String(year.companySequences[company].startChequeReceiptNumber)) || startNum;
        }
    }
    
    const existingNumbers = new Set();
    receipts.forEach(r => {
        const rComp = r.company || '';
        if (rComp === company) {
            let numStr = r.number || '';
            if (numStr.startsWith('CR-')) {
                numStr = numStr.replace('CR-', '');
            }
            const num = parseInt(numStr);
            if (!isNaN(num) && num >= startNum) {
                existingNumbers.add(num);
            }
        }
    });
    
    let expected = startNum;
    while (existingNumbers.has(expected)) { expected++; }
    res.json({ nextNumber: `CR-${expected}` });
});

// --- MEETINGS BOT ACTIONS ---
app.post('/api/meetings/:id/announce', async (req, res) => {
    try {
        const db = getDb();
        const meeting = (db.meetings || []).find(m => m.id === req.params.id);
        if (meeting) {
            await notifyMeetingAnnouncement(meeting, db);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'صورتجلسه یافت نشد' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/meetings/:id/send-minutes', async (req, res) => {
    try {
        const db = getDb();
        const meeting = (db.meetings || []).find(m => m.id === req.params.id);
        if (meeting) {
            await notifyMeetingMinutes(meeting, db);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'صورتجلسه یافت نشد' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- FULL-STACK DATA SYNCHRONIZATION ENDPOINTS ---
const CRUD_COLLECTIONS = [
    { route: 'orders', dbKey: 'orders' },
    { route: 'security/logs', dbKey: 'securityLogs' },
    { route: 'security/delays', dbKey: 'personnelDelays' },
    { route: 'security/incidents', dbKey: 'securityIncidents' },
    { route: 'warehouse/items', dbKey: 'warehouseItems' },
    { route: 'warehouse/transactions', dbKey: 'warehouseTransactions' },
    { route: 'trade', dbKey: 'tradeRecords' },
    { route: 'notes', dbKey: 'notes' },
    { route: 'meetings', dbKey: 'meetings' },
    { route: 'purchase-requests', dbKey: 'purchaseRequests' },
    { route: 'part-master-data', dbKey: 'partMasterData' },
    { route: 'secretariat-letters', dbKey: 'secretariatLetters' },
    { route: 'secretariat-settings', dbKey: 'secretariatSettings' },
    { route: 'secretariat-templates', dbKey: 'secretariatTemplates' },
    { route: 'cheque-receipts', dbKey: 'chequeReceipts' },
    { route: 'customer-balances', dbKey: 'customerBalances' },
    { route: 'customer-balances/chat-codes', dbKey: 'customerChatCodes' }
];

CRUD_COLLECTIONS.forEach(({ route, dbKey }) => {
    // GET
    app.get(`/api/${route}`, (req, res) => {
        const db = getDb();
        if (!db[dbKey]) db[dbKey] = [];
        res.json(db[dbKey]);
    });

    // POST
    app.post(`/api/${route}`, (req, res) => {
        const db = getDb();
        if (!db[dbKey]) db[dbKey] = [];
        const item = req.body;
        const existingIdx = db[dbKey].findIndex(x => x.id === item.id);
        if (existingIdx > -1) {
            db[dbKey][existingIdx] = item;
        } else {
            db[dbKey].push(item);
        }
        saveDb(db);
        res.json(db[dbKey]);
    });

    // PUT
    app.put(`/api/${route}/:id`, (req, res) => {
        const db = getDb();
        if (!db[dbKey]) db[dbKey] = [];
        const idx = db[dbKey].findIndex(x => x.id === req.params.id);
        if (idx > -1) {
            db[dbKey][idx] = { ...db[dbKey][idx], ...req.body };
            saveDb(db);
            res.json(db[dbKey]);
        } else {
            db[dbKey].push({ id: req.params.id, ...req.body });
            saveDb(db);
            res.json(db[dbKey]);
        }
    });

    // DELETE
    app.delete(`/api/${route}/:id`, (req, res) => {
        const db = getDb();
        if (!db[dbKey]) db[dbKey] = [];
        db[dbKey] = db[dbKey].filter(x => x.id !== req.params.id);
        saveDb(db);
        res.json(db[dbKey]);
    });
});

// Dedicated Exit Permits Endpoints with Automated Notifications
app.get('/api/exit-permits', (req, res) => {
    const db = getDb();
    res.json(db.exitPermits || []);
});

app.post('/api/exit-permits', async (req, res) => {
    try {
        const db = getDb();
        if (!db.exitPermits) db.exitPermits = [];
        const item = req.body;
        if (!item.fiscalYearId && db.settings?.activeFiscalYearId) {
            item.fiscalYearId = db.settings.activeFiscalYearId;
        }
        if (!item.createdAt) {
            item.createdAt = Date.now();
        }
        const existingIdx = db.exitPermits.findIndex(x => x.id === item.id);
        const isEdit = existingIdx > -1;
        
        if (isEdit) {
            db.exitPermits[existingIdx] = { ...db.exitPermits[existingIdx], ...item };
        } else {
            db.exitPermits.push(item);
        }
        saveDb(db);
        
        // Return response immediately
        res.json(db.exitPermits);

        // Asynchronously trigger bot notifications based on settings & ticks
        setImmediate(async () => {
            try {
                const freshDb = getDb();
                const permit = (freshDb.exitPermits || []).find(x => x.id === item.id) || item;
                const eventType = isEdit ? 'EDIT' : 'CREATE';
                const stepName = isEdit ? 'ویرایش سند' : 'ثبت اولیه';
                await notifyExitPermitStep(permit, null, null, null, freshDb, stepName, eventType);
            } catch (err) {
                console.error("Background notifyExitPermitStep error on POST /api/exit-permits:", err);
            }
        });
    } catch (e) {
        console.error("POST /api/exit-permits error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/exit-permits/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db.exitPermits) db.exitPermits = [];
        const idx = db.exitPermits.findIndex(x => x.id === req.params.id);
        const isEdit = req.body.isEdit || false;
        let updatedItem;
        
        if (idx > -1) {
            db.exitPermits[idx] = { ...db.exitPermits[idx], ...req.body };
            updatedItem = db.exitPermits[idx];
        } else {
            updatedItem = { id: req.params.id, ...req.body };
            db.exitPermits.push(updatedItem);
        }
        saveDb(db);
        
        res.json(db.exitPermits);

        setImmediate(async () => {
            try {
                const freshDb = getDb();
                const permit = (freshDb.exitPermits || []).find(x => x.id === req.params.id) || updatedItem;
                const eventType = isEdit ? 'EDIT' : 'STEP';
                const stepName = isEdit ? 'ویرایش سند' : (permit.status || 'بروزرسانی وضعیت');
                await notifyExitPermitStep(permit, null, null, null, freshDb, stepName, eventType);
            } catch (err) {
                console.error("Background notifyExitPermitStep error on PUT /api/exit-permits:", err);
            }
        });
    } catch (e) {
        console.error("PUT /api/exit-permits error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/exit-permits/:id', (req, res) => {
    try {
        const db = getDb();
        if (!db.exitPermits) db.exitPermits = [];
        const permitToDelete = db.exitPermits.find(x => x.id === req.params.id);
        db.exitPermits = db.exitPermits.filter(x => x.id !== req.params.id);
        saveDb(db);
        res.json(db.exitPermits);

        if (permitToDelete) {
            setImmediate(async () => {
                try {
                    const freshDb = getDb();
                    await notifyExitPermitStep(permitToDelete, null, null, null, freshDb, 'حذف برگه خروج', 'DELETE');
                } catch (err) {
                    console.error("Background notifyExitPermitStep error on DELETE /api/exit-permits:", err);
                }
            });
        }
    } catch (e) {
        console.error("DELETE /api/exit-permits error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Custom endpoint for manual exit permit notification via bot
app.post('/api/exit-permits/:id/bot-notify', async (req, res) => {
    try {
        const db = getDb();
        const { id } = req.params;
        const permit = (db.exitPermits || []).find(p => p.id === id);
        if (!permit) {
            return res.status(404).json({ error: 'برگه خروج یافت نشد' });
        }
        
        // Trigger bot core helper for exit permit notifications with 'MANUAL' type to skip deduplication
        await notifyExitPermitStep(permit, null, null, null, db, 'ارسال دستی', 'MANUAL');
        res.json({ success: true });
    } catch (e) {
        console.error("Manual bot notify error in server.js:", e);
        res.status(500).json({ error: e.message });
    }
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

app.get('/api/quote/random', async (req, res) => {
    const fetchWithTimeout = async (url, ms = 3000) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ms);
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            return response;
        } catch (e) {
            clearTimeout(timer);
            throw e;
        }
    };

    const fallbacks = [
        { text: "سعدیا مرد نکونام نمیرد هرگز\nمرده آن است که نامش به نکویی نبرند", author: "سعدی" },
        { text: "بنی آدم اعضای یک پیکرند\nکه در آفرینش ز یک گوهرند", author: "سعدی" },
        { text: "در نومیدی بسی امید است\nپایان شب سیه سپید است", author: "نظامی" },
        { text: "هر که در او جوهر دانایی است\nبر همه چیزش توانایی است", author: "نظامی" },
        { text: "جهان یادگار است و ما رفتنی\nبه گیتی نماند به جز مردمی", author: "فردوسی" },
        { text: "تو نیکی می‌کن و در دجله انداز\nکه ایزد در بیابانت دهد باز", author: "سعدی" },
        { text: "آسایش دو گیتی تفسیر این دو حرف است\nبا دوستان مروت با دشمنان مدارا", author: "حافظ" },
        { text: "عیب رندان مکن ای زاهد پاکیزه سرشت\nکه گناه دگران بر تو نخواهند نوشت", author: "حافظ" },
        { text: "صبر و ظفر هر دو دوستان قدیمند\nبر اثر صبر نوبت ظفر آید", author: "حافظ" },
        { text: "خدا کشتی آنجا که خواهد برد\nوگر ناخدا جامه بر تن درد", author: "سعدی" },
        { text: "هرگز نمیرد آن که دلش زنده شد به عشق\nثبت است بر جریده عالم دوام ما", author: "حافظ" },
        { text: "بشنو از نی چون حکایت می‌کند\nاز جدایی‌ها شکایت می‌کند", author: "مولانا" },
        { text: "ای هیچ برای هیچ بر هیچ مپیچ\nدانی که پس از عمر چه ماند باقی؟\nمهر است و محبت است و باقی همه هیچ", author: "مولانا" },
        { text: "کار ما نیست شناسایی راز گل سرخ\nکار ما شاید این است\nکه در افسون گل سرخ شناور باشیم", author: "سهراب سپهری" },
        { text: "زندگی خالی نیست\nمهربانی هست، سیب هست، ایمان هست\nآری تا شقایق هست زندگی باید کرد", author: "سهراب سپهری" },
        { text: "چشم‌ها را باید شست، جور دیگر باید دید\nواژه‌ها را باید شست", author: "سهراب سپهری" },
        { text: "تو مگو همه به جنگند و ز صلح من چه آید\nتو یکی نه‌ای هزاری تو چراغ خود برافروز", author: "مولانا" },
        { text: "توانا بود هر که دانا بود\nز دانش دل پیر برنا بود", author: "فردوسی" },
        { text: "چون عهده نمی‌شود کسی فردا را\nحالی خوش کن تو این دل شیدا را", author: "خیام" },
        { text: "از حادثه لرزند به خود قصرنشینان\nما خانه به دوشان غم طوفان نداریم", author: "صائب تبریزی" },
        { text: "به راه بادیه رفتن به از نشستن باطل\nکه گر مراد نیابم به قدر وسع بکوشم", author: "سعدی" },
        { text: "روزگار است این که گه عزت دهد گه خار دارد\nچرخ بازیگر از این بازیچه‌ها بسیار دارد", author: "قائم مقام فراهانی" },
        { text: "عمر برف است و آفتاب تموز\nاندکی ماند و خواجه غره هنوز", author: "سعدی" },
        { text: "مکن ز غصه شکایت که در طریق طلب\nبه راحتی نرسید آن که زحمتی نکشید", author: "حافظ" },
        { text: "درخت دوستی بنشان که کام دل به بار آرد\nنهال دشمنی برکن که رنج بی‌شمار آرد", author: "حافظ" },
        { text: "همت بلند دار که مردان روزگار\nاز همت بلند به جایی رسیده‌اند", author: "سعدی" },
        { text: "گوهر پاک بباید که دگرگون نشود\nورنه هر سنگ و گلی گوهر نایاب شد", author: "پروین اعتصامی" },
        { text: "اندیشه کردن به کار نکو\nسودمندتر از خود کار نکوست", author: "امیرخسرو دهلوی" },
        { text: "گرت پایداری است در کار خویش\nشوی کامران سر فراز از پس خویش", author: "فردوسی" },
        { text: "هیچ گنجی به از هنر نبود\nپیش دانا نکوتر از زر نبود", author: "فردوسی" },
        { text: "مردی آن نیست که بر تن بکشی جامهٔ زر\nمردی آن است که بر خلق خدا سود رسد", author: "سعدی" },
        { text: "به رنج اندر است ای خردمند گنج\nنیابد کسی گنج نابرده رنج", author: "فردوسی" },
        { text: "اگر هنر داری و فضل و کمال\nبه کوش و دگرگون مکن این جمال", author: "سعدی" }
    ];

    const sources = [
        async () => {
            // Source 1: Ganjoor Random Single Verse (c.ganjoor.net/beyt-json.php) - highly fast and reliable
            const res = await fetchWithTimeout('https://c.ganjoor.net/beyt-json.php', 3000);
            if (res.ok) {
                const data = await res.json();
                if (data && data.m1 && data.m2) {
                    return {
                        text: `${data.m1}\n${data.m2}`,
                        author: data.poet || 'شاعر پارسی‌گو',
                        source: 'تک‌بیت تصادفی (c.ganjoor.net)',
                        title: 'گنجور آنلاین'
                    };
                }
            }
            throw new Error("Invalid response from beyt-json.php");
        },
        async () => {
            // Source 2: Ganjoor Poem API
            const res = await fetchWithTimeout('https://api.ganjoor.net/api/ganjoor/poem/random', 3000);
            if (res.ok) {
                const data = await res.json();
                let poet = 'شاعر پارسی‌گو';
                if (data.fullTitle) {
                    poet = data.fullTitle.split(' » ')[0].trim();
                }
                let lines = (data.plainText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                if (lines.length > 4) {
                    const maxStart = Math.max(0, lines.length - 4);
                    const startIdx = Math.floor(Math.random() * (maxStart + 1));
                    lines = lines.slice(startIdx, startIdx + 4);
                }
                if (lines.length >= 2) {
                    return {
                        text: lines.join('\n'),
                        author: poet,
                        source: 'شعر تصادفی (api.ganjoor.net)',
                        title: data.title || data.fullTitle
                    };
                }
            }
            throw new Error("Invalid response from poem/random");
        },
        async () => {
            // Source 3: Ganjoor Hafez Fal API
            const res = await fetchWithTimeout('https://api.ganjoor.net/api/ganjoor/hafez/faal', 3000);
            if (res.ok) {
                const data = await res.json();
                let lines = (data.plainText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                if (lines.length > 4) {
                    const maxStart = Math.max(0, lines.length - 4);
                    const startIdx = Math.floor(Math.random() * (maxStart + 1));
                    lines = lines.slice(startIdx, startIdx + 4);
                }
                if (lines.length >= 2) {
                    return {
                        text: lines.join('\n'),
                        author: 'حافظ شیرازی',
                        source: 'فال حافظ (api.ganjoor.net)',
                        title: data.title || data.fullTitle
                    };
                }
            }
            throw new Error("Invalid response from hafez/faal");
        }
    ];

    // Shuffle sources to rotate requests nicely
    const shuffledSources = [...sources].sort(() => Math.random() - 0.5);

    for (const fetchSource of shuffledSources) {
        try {
            const quote = await fetchSource();
            if (quote && quote.text) {
                return res.json(quote);
            }
        } catch (e) {
            console.log("Online source fetch failed, trying next. Error:", e.message);
        }
    }

    // Curated offline fallback if all online attempts fail
    const randomIdx = Math.floor(Math.random() * fallbacks.length);
    const selected = fallbacks[randomIdx];
    res.json({
        ...selected,
        source: 'دیوان اشعار پارسی (آفلاین)',
        title: 'شعر پارسی'
    });
});

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

// --- CENTRALIZED REPORT DELIVERY ENGINE & SCHEDULER ---
let scheduledReportCronTasks = [];



function setupDailyReports() {
    try {
        scheduledReportCronTasks.forEach(t => t.stop());
        scheduledReportCronTasks = [];

        const db = getDb();
        if (!db.reportDeliveryJobs) db.reportDeliveryJobs = [];
        
        // Seed initial default jobs if list is empty
        if (db.reportDeliveryJobs.length === 0) {
            db.reportDeliveryJobs = [
                {
                    id: 'job_daily_sales_1900',
                    title: 'گزارش روزانه ارشد مدیریتی فروش سایان ERP',
                    module: 'sales',
                    reportType: 'daily_sales',
                    botPlatforms: ['telegram', 'bale'],
                    destinationGroup: db.settings?.telegramGroupId || db.settings?.baleGroupId || '-100123456789',
                    scheduleType: 'daily_1900',
                    cronExpression: '0 19 * * *',
                    attachPdf: true,
                    attachExcel: true,
                    attachImage: true,
                    enabled: true,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'job_daily_comparison_1900',
                    title: 'گزارش پایش مقایسه‌ای فروش (دیروز با امروز)',
                    module: 'sales',
                    reportType: 'sales_comparison',
                    botPlatforms: ['telegram', 'bale'],
                    destinationGroup: db.settings?.telegramGroupId || db.settings?.baleGroupId || '-100123456789',
                    scheduleType: 'daily_comp_1900',
                    cronExpression: '0 19 * * *',
                    attachPdf: true,
                    attachExcel: true,
                    attachImage: true,
                    enabled: true,
                    createdAt: new Date().toISOString()
                }
            ];
            saveDb(db);
        }

        // Register cron triggers for all enabled jobs
        db.reportDeliveryJobs.forEach(job => {
            if (!job.enabled) return;

            let cronPattern = job.cronExpression || '0 19 * * *';
            if (job.scheduleType === 'daily_1900' || job.scheduleType === 'daily_comp_1900') {
                cronPattern = '30 15 * * *'; // 19:00 Iran time in UTC (15:30 UTC) or 0 19 local
            } else if (job.scheduleType === 'weekly') {
                cronPattern = '30 15 * * 6'; // Saturday 19:00
            } else if (job.scheduleType === 'monthly') {
                cronPattern = '30 15 1 * *'; // 1st of month 19:00
            }

            try {
                const task = cron.schedule(cronPattern, async () => {
                    console.log(`⏰ Executing Scheduled Report Job: ${job.title} (${job.id})`);
                    await executeReportJob(job);
                });
                scheduledReportCronTasks.push(task);
            } catch (err) {
                console.error(`Failed to schedule report job ${job.id}:`, err);
            }
        });

        console.log(`✅ Loaded ${db.reportDeliveryJobs.length} report delivery jobs (${scheduledReportCronTasks.length} active cron schedules).`);
    } catch (e) {
        console.error("setupDailyReports Error:", e);
    }
}

async function executeReportJob(job) {
    const db = getDb();
    try {
        console.log(`🚀 Dispatching Scheduled Report Job [${job.title}] to platforms [${(job.botPlatforms || []).join(', ')}]...`);
        
        const isProdJob = job.module === 'inventory' || job.module === 'production' || job.reportType === 'production' || job.reportType === 'inventory_stock';
        const isSalesJob = job.module === 'sales' || job.reportType === 'daily_sales' || job.reportType === 'sales_comparison';

        const defaultTgGroup = isProdJob
            ? (db.settings?.productionTelegramGroupId || db.settings?.factoryGroupId)
            : (isSalesJob ? (db.settings?.dailySalesTelegramGroupId || db.settings?.botDailySalesGroupIdTele) : (db.settings?.botAccountingGroupIdTele || db.settings?.telegramGroupId));

        const defaultBaleGroup = isProdJob
            ? db.settings?.productionBaleGroupId
            : (isSalesJob ? (db.settings?.dailySalesBaleGroupId || db.settings?.botDailySalesGroupIdBale) : (db.settings?.botAccountingGroupIdBale || db.settings?.baleGroupId));

        const defaultWaGroup = isProdJob
            ? db.settings?.productionWhatsappGroupId
            : (isSalesJob ? (db.settings?.dailySalesWhatsappGroupId || db.settings?.botDailySalesGroupIdWhatsApp) : (db.settings?.botBijakGroupIdWhatsApp || db.settings?.defaultWarehouseGroup));

        const teleGroup = job.telegramGroup || job.destinationGroup || defaultTgGroup;
        const baleGroup = job.baleGroup || job.destinationGroup || defaultBaleGroup;
        const waGroup = job.whatsappGroup || job.destinationGroup || defaultWaGroup;

        if (job.scheduleType === 'daily_comp_1900' || job.reportType === 'sales_comparison') {
            const sendFn = async (chatId, text, opts) => {
                if (job.botPlatforms?.includes('telegram') && teleGroup) {
                    try { await telegram.sendBotMessage(teleGroup, text, opts); } catch(e){ console.error("TG Send err:", e.message); }
                }
                if (job.botPlatforms?.includes('bale') && baleGroup) {
                    try { await bale.sendBotMessage(baleGroup, text, opts); } catch(e){ console.error("Bale Send err:", e.message); }
                }
                if (job.botPlatforms?.includes('whatsapp') && waGroup) {
                    try { await whatsapp.sendMessage(waGroup, text); } catch(e){ console.error("WA Send err:", e.message); }
                }
            };

            const sendDocFn = async (chatId, buffer, filename, caption) => {
                if (job.botPlatforms?.includes('telegram') && teleGroup) {
                    try { await telegram.sendBotDocument(teleGroup, buffer, filename, caption); } catch(e){ console.error("TG Send Doc err:", e.message); }
                }
                if (job.botPlatforms?.includes('bale') && baleGroup) {
                    try { await bale.sendBotDocument(baleGroup, buffer, filename, caption); } catch(e){ console.error("Bale Send Doc err:", e.message); }
                }
                if (job.botPlatforms?.includes('whatsapp') && waGroup) {
                    try {
                        const b64 = buffer.toString('base64');
                        await whatsapp.sendMessage(waGroup, caption || '', { data: b64, mimeType: 'application/pdf', filename: filename });
                    } catch(e){ console.error("WA Send Doc err:", e.message); }
                }
            };

            const todayTehran = utils.getTehranDateString ? utils.getTehranDateString() : new Date().toISOString().split('T')[0];
            const yesterdayDate = new Date();
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            const yesterdayTehran = utils.getTehranDateString ? utils.getTehranDateString(yesterdayDate) : yesterdayDate.toISOString().split('T')[0];

            await generateAndSendComparisonPDF(db, teleGroup || baleGroup || waGroup || 'default', sendFn, sendDocFn, todayTehran, todayTehran, yesterdayTehran, yesterdayTehran, "امروز", "دیروز");
        } else {
            // Standard daily sales report or other module
            const customTargets = [];
            if (job.botPlatforms?.includes('telegram')) {
                const tgId = job.telegramGroup || job.destinationGroup;
                if (tgId) customTargets.push({ platform: 'telegram', id: tgId });
            }
            if (job.botPlatforms?.includes('bale')) {
                const baleId = job.baleGroup || job.destinationGroup;
                if (baleId) customTargets.push({ platform: 'bale', id: baleId });
            }
            if (job.botPlatforms?.includes('whatsapp')) {
                const waId = job.whatsappGroup || job.destinationGroup;
                if (waId) customTargets.push({ platform: 'whatsapp', id: waId });
            }

            await sendDailySalesReportForDate(db, new Date(), 'روزانه ۱۹:۰۰', customTargets.length > 0 ? customTargets : null, job.botPlatforms);
        }

        // Update last run timestamp
        const jobIndex = db.reportDeliveryJobs?.findIndex(j => j.id === job.id);
        if (jobIndex > -1) {
            db.reportDeliveryJobs[jobIndex].lastRunAt = new Date().toLocaleString('fa-IR');
            saveDb(db);
        }
        return { success: true };
    } catch (err) {
        console.error(`Error executing report job ${job.id}:`, err);
        throw err;
    }
}

// API Routes for Report Delivery Engine
app.get('/api/report-delivery/jobs', (req, res) => {
    const db = getDb();
    res.json(db.reportDeliveryJobs || []);
});

app.post('/api/report-delivery/jobs', (req, res) => {
    const db = getDb();
    if (!db.reportDeliveryJobs) db.reportDeliveryJobs = [];
    const newJob = {
        id: 'job_' + Date.now(),
        createdAt: new Date().toISOString(),
        ...req.body
    };
    db.reportDeliveryJobs.push(newJob);
    saveDb(db);
    setupDailyReports();
    res.json(newJob);
});

app.put('/api/report-delivery/jobs/:id', (req, res) => {
    const db = getDb();
    if (!db.reportDeliveryJobs) db.reportDeliveryJobs = [];
    const idx = db.reportDeliveryJobs.findIndex(j => j.id === req.params.id);
    if (idx > -1) {
        db.reportDeliveryJobs[idx] = { ...db.reportDeliveryJobs[idx], ...req.body };
        saveDb(db);
        setupDailyReports();
        res.json(db.reportDeliveryJobs[idx]);
    } else {
        res.status(404).json({ error: 'Job not found' });
    }
});

app.delete('/api/report-delivery/jobs/:id', (req, res) => {
    const db = getDb();
    if (!db.reportDeliveryJobs) db.reportDeliveryJobs = [];
    db.reportDeliveryJobs = db.reportDeliveryJobs.filter(j => j.id !== req.params.id);
    saveDb(db);
    setupDailyReports();
    res.json({ success: true });
});

app.post('/api/report-delivery/execute-now', async (req, res) => {
    const { jobId } = req.body;
    const db = getDb();
    const job = (db.reportDeliveryJobs || []).find(j => j.id === jobId);
    if (!job) {
        return res.status(404).json({ error: 'زمان‌بندی یافت نشد' });
    }

    try {
        await executeReportJob(job);
        res.json({ success: true, message: `گزارش [${job.title}] با موفقیت تولید و ارسال شد.` });
    } catch (err) {
        res.status(500).json({ error: 'خطا در اجرای گزارش: ' + err.message });
    }
});

const DIST_DIR = path.join(ROOT_DIR, 'dist');
const isExplicitDev = process.argv.includes("--dev") || process.env.NODE_ENV === "development";

if (isExplicitDev || !fs.existsSync(DIST_DIR)) {
    console.log("Starting in Development mode with Vite Middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
    });
    app.use(vite.middlewares);
} else {
    let buildTime = "Unknown";
    try {
        const stats = fs.statSync(path.join(DIST_DIR, 'index.html'));
        buildTime = stats.mtime.toLocaleString('fa-IR');
    } catch(e){}
    console.log(`Starting in Production mode serving built assets from dist (Build Date: ${buildTime})...`);
    app.use(express.static(DIST_DIR, {
        maxAge: '1d',
        setHeaders: (res, filePath) => {
            // Never cache HTML, Service Worker, JS or Manifest files to ensure instant updates
            if (filePath.endsWith('.html') || filePath.endsWith('sw.js') || filePath.endsWith('manifest.json') || filePath.endsWith('.js')) {
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
            }
        }
    }));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API endpoint not found' });
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
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
        setupAutoBackup();
        setupDailyReports();
        setupLegacyDailyReports();
    }, 1000);
});
