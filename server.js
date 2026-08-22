
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
import { notifyExitPermitStep, notifyPaymentOrderStep, notifyWarehouseBijak, notifyMeetingAnnouncement, notifyMeetingMinutes, notifyPurchaseRequestStep, runDailyReport, generateAndSendComparisonPDF, notifySecretariatLetter, getCustomerBalancesData, fetchProcessedSayanSalesData, isActualProduct, classifyMajorCategory, sendTreasuryChequesReport } from './backend/bot-core.js';
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
const PORT = process.argv.includes('--dev') ? 3000 : (process.env.PORT || 3000);

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
    const schweiterQty = utils.toPersianDigitsNoGrouping(totals.qty_schweiter || 0);
    const schweiterPct = utils.toPersianDigitsNoGrouping(waste.pct_schweiter || 0);
    const grandTotalVal = totals.grandTotal !== undefined && totals.grandTotal !== null ? totals.grandTotal : ((totals.qty_61 || 0) + (totals.qty_67 || 0) + (totals.qty_79 || 0) + (totals.qty_73 || 0) + (totals.qty_schweiter || 0));
    const totalWasteVal = waste.totalWaste !== undefined && waste.totalWaste !== null ? waste.totalWaste : ((waste.waste_61 || 0) + (waste.waste_67 || 0) + (waste.waste_79 || 0) + (waste.waste_73 || 0) + (waste.waste_schweiter || 0));
    
    const grandTotal = utils.toPersianDigitsNoGrouping(grandTotalVal);
    const totalWaste = utils.toPersianDigitsNoGrouping(totalWasteVal);

    return `تولید روز ${dayLabel}
کش:${keshQty}
درصد ضایعات:${keshPct}
اسپندکس:${spandexQty}
درصد ضایعات:${spandexPct}
استرچ:${stretchQty}
درصد ضایعات:${stretchPct}
شوایتر:${schweiterQty}
درصد ضایعات:${schweiterPct}
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
        { key: 'productionTelegramGroupId2', plat: 'telegram' },
        { key: 'productionBaleGroupId', plat: 'bale' },
        { key: 'productionBaleGroupId2', plat: 'bale' },
        { key: 'productionWhatsappGroupId', plat: 'whatsapp' },
        { key: 'productionWhatsappGroupId2', plat: 'whatsapp' },
        { key: 'factoryGroupId', plat: 'telegram' },
        { key: 'factoryGroupId2', plat: 'telegram' },
    ];

    const productionCompareKeys = [
        { key: 'productionCompareTelegramGroupId', plat: 'telegram' },
        { key: 'productionCompareBaleGroupId', plat: 'bale' },
        { key: 'productionCompareWhatsappGroupId', plat: 'whatsapp' },
    ];

    const warehouseKeys = [
        { key: 'warehouseTelegramGroupId', plat: 'telegram' },
        { key: 'warehouseBaleGroupId', plat: 'bale' },
        { key: 'warehouseWhatsappGroupId', plat: 'whatsapp' },
        { key: 'warehouseGroupId', plat: 'telegram' },
        { key: 'defaultWarehouseGroup', plat: 'telegram' },
        { key: 'productionCompareTelegramGroupId', plat: 'telegram' },
        { key: 'productionCompareBaleGroupId', plat: 'bale' },
        { key: 'productionTelegramGroupId', plat: 'telegram' },
        { key: 'productionBaleGroupId', plat: 'bale' },
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
    } else if (category === 'production_compare') {
        keysToUse = productionCompareKeys;
    } else if (category === 'warehouse') {
        keysToUse = warehouseKeys;
    } else if (category === 'sales') {
        keysToUse = salesKeys;
    } else if (category === 'accounting') {
        keysToUse = accountingKeys;
    } else {
        keysToUse = [...salesKeys, ...accountingKeys, ...productionKeys, ...productionCompareKeys, ...warehouseKeys, ...reportsKeys, ...generalKeys];
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

    // Fetch sales and returns data using fetchProcessedSayanSalesData
    let salesData;
    try {
        salesData = await fetchProcessedSayanSalesData(db, dateObj, dateObj);
    } catch (e) {
        console.warn("Sayan ERP query failed, attempting local invoices fallback:", e.message);
        const localInvs = Array.isArray(db.invoices) ? db.invoices : (Array.isArray(db.exitPermits) ? db.exitPermits : []);
        const rawSalesRows = localInvs.map(inv => ({
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
        
        salesData = {
            categoryList: [{
                name: 'سایر محصولات',
                salesQty: rawSalesRows.reduce((s, r) => s + parseFloat(r.Quantity || 0), 0),
                salesAmt: rawSalesRows.reduce((s, r) => s + parseFloat(r.Amount || 0), 0),
                returnQty: 0,
                returnAmt: 0,
                netWgt: rawSalesRows.reduce((s, r) => s + parseFloat(r.Quantity || 0), 0),
                netAmt: rawSalesRows.reduce((s, r) => s + parseFloat(r.Amount || 0), 0),
                netFee: 0
            }],
            summary: {
                totalSalesQty: rawSalesRows.reduce((s, r) => s + parseFloat(r.Quantity || 0), 0),
                totalSalesAmt: rawSalesRows.reduce((s, r) => s + parseFloat(r.Amount || 0), 0),
                totalReturnQty: 0,
                totalReturnAmt: 0,
                netWeight: rawSalesRows.reduce((s, r) => s + parseFloat(r.Quantity || 0), 0),
                netAmount: rawSalesRows.reduce((s, r) => s + parseFloat(r.Amount || 0), 0),
                avgFee: 0,
                invoiceCount: rawSalesRows.length,
                customerCount: 1,
                shamsiFrom: shamsiDate,
                shamsiTo: shamsiDate,
                gregFrom: gregDate,
                gregTo: gregDate
            }
        };
    }

    const { categoryList, summary } = salesData;

    if (categoryList.length > 0) {
        const title = `گزارش رسمی فروش روزانه و مرجوعی سایان - مورخ ${shamsiDate} (${labelSuffix})`;
        const columns = ['ردیف', 'سرفصل کالا', 'فروش (ک‌گ / ریال)', 'مرجوعی کد ۱۳ (ک‌گ / ریال)', 'خالص نهایی (ک‌گ / ریال)', 'فی متوسط (ریال)'];
        
        let idx = 1;
        const tableRows = categoryList.map(cat => [
            (idx++).toLocaleString('fa-IR'),
            cat.name,
            `${cat.salesQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / ${Math.round(cat.salesAmt).toLocaleString('fa-IR')}`,
            `${cat.returnQty > 0 ? cat.returnQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '۰'} / ${Math.round(cat.returnAmt).toLocaleString('fa-IR')}`,
            `${cat.netWgt.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / ${Math.round(cat.netAmt).toLocaleString('fa-IR')}`,
            Math.round(cat.netFee).toLocaleString('fa-IR')
        ]);
        
        tableRows.push([
            'جمع کل',
            'خلاصه عملکرد',
            `${summary.totalSalesQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / ${Math.round(summary.totalSalesAmt).toLocaleString('fa-IR')}`,
            `${summary.totalReturnQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / ${Math.round(summary.totalReturnAmt).toLocaleString('fa-IR')}`,
            `${summary.netWeight.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / ${Math.round(summary.netAmount).toLocaleString('fa-IR')}`,
            Math.round(summary.avgFee).toLocaleString('fa-IR')
        ]);
        
        const pdfBuffer = await Renderer.generateReportPDF(title, columns, tableRows, true); // Landscape
        
        if (!pdfBuffer) {
            throw new Error('خطا در تولید فایل PDF گزارش. لطفاً اطمینان حاصل کنید که مرورگر Chrome یا Edge روی سرور نصب شده باشد.');
        }

        const filename = `Sayan_Daily_Sales_${gregDate}_${labelSuffix === 'دیروز' ? 'Yesterday' : 'Today'}.pdf`;
        
        const caption = `📊 *گزارش فروش و مرجوعی روزانه سایان ERP*
📅 *تاریخ:* ${shamsiDate} (${labelSuffix})
📦 *وزن فروش ناخالص:* ${summary.totalSalesQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
💵 *مبلغ فروش ناخالص:* ${Math.round(summary.totalSalesAmt).toLocaleString('fa-IR')} ریال
🔄 *وزن مرجوعی (کد ۱۳):* ${summary.totalReturnQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
❌ *مبلغ مرجوعی:* ${Math.round(summary.totalReturnAmt).toLocaleString('fa-IR')} ریال
✅ *وزن خالص کل:* ${summary.netWeight.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
💰 *فروش خالص کل:* ${Math.round(summary.netAmount).toLocaleString('fa-IR')} ریال
🏷️ *فی نهایی میانگین:* ${Math.round(summary.avgFee).toLocaleString('fa-IR')} ریال/کیلوگرم`;

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




// Note: Automated daily reports (Sales & Cheques) are dynamically managed via setupDailyReports() in Tehran TimeZone (Asia/Tehran)

app.post('/api/sayan/sales-report/send-daily', async (req, res) => {
    try {
        const db = getDb();
        const { date, labelSuffix, customTargets, selectedPlatforms, includeYesterday } = req.body;
        const dateObj = date ? new Date(date) : new Date();
        const result = await sendDailySalesReportForDate(db, dateObj, labelSuffix || 'امروز', customTargets, selectedPlatforms);
        
        let yesterdayResult = null;
        if (includeYesterday) {
            const yesterdayDate = new Date(dateObj);
            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
            yesterdayResult = await sendDailySalesReportForDate(db, yesterdayDate, 'دیروز', customTargets, selectedPlatforms);
        }

        res.json({ success: true, today: result, yesterday: yesterdayResult });
    } catch (err) {
        console.error("Manual Daily Sales Send Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sayan/cheques-report/send-vault', async (req, res) => {
    try {
        const db = getDb();
        const { customTargets, selectedPlatforms, attachPdf, attachExcel, reportType, sortBy, sortOrder, filterBank, filterDrawer, customCheques, title } = req.body;
        const result = await sendTreasuryChequesReport(db, customTargets, selectedPlatforms, { 
            attachPdf, 
            attachExcel, 
            reportType: reportType || 'vault', 
            sortBy, 
            sortOrder, 
            filterBank, 
            filterDrawer, 
            customCheques, 
            title 
        });
        res.json(result);
    } catch (err) {
        console.error("Manual Treasury Cheques Send Error:", err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sayan/cheques-report/send', async (req, res) => {
    try {
        const db = getDb();
        const { customTargets, selectedPlatforms, attachPdf, attachExcel, reportType, sortBy, sortOrder, filterBank, filterDrawer, customCheques, title } = req.body;
        const result = await sendTreasuryChequesReport(db, customTargets, selectedPlatforms, { 
            attachPdf, 
            attachExcel, 
            reportType: reportType || 'vault', 
            sortBy, 
            sortOrder, 
            filterBank, 
            filterDrawer, 
            customCheques, 
            title 
        });
        res.json(result);
    } catch (err) {
        console.error("Manual Cheques Send Error:", err);
        res.status(500).json({ error: err.message });
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

app.get('/api/sayan/warehouse-inventory', async (req, res) => {
    try {
        const db = getDb();
        const settings = db.settings || {};
        const sayanUrl = settings.sayanApiUrl || process.env.SAYAN_API_URL;
        const sayanKey = settings.sayanApiKey || process.env.SAYAN_API_KEY;

        if (!sayanUrl || !sayanKey) {
            return res.json({ success: false, message: 'تنظیمات آدرس API یا کلید امنیتی سایان ثبت نشده است.', lastYearStock: [], currentStock: [] });
        }

        let lastYearDateTo = req.query.lastYearDateTo;
        if (!lastYearDateTo || !/^\d{4}-\d{2}-\d{2}$/.test(lastYearDateTo)) {
            lastYearDateTo = '2025-03-20';
        }
        let currentYearDateTo = req.query.currentYearDateTo;
        if (!currentYearDateTo || !/^\d{4}-\d{2}-\d{2}$/.test(currentYearDateTo)) {
            currentYearDateTo = new Date().toISOString().split('T')[0];
        }

        let lastYearDateFrom = req.query.lastYearDateFrom;
        if (lastYearDateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(lastYearDateFrom)) {
            lastYearDateFrom = undefined;
        }
        let currentYearDateFrom = req.query.currentYearDateFrom;
        if (currentYearDateFrom && !/^\d{4}-\d{2}-\d{2}$/.test(currentYearDateFrom)) {
            currentYearDateFrom = undefined;
        }

        const getWarehouseInventoryForDate = async (targetDate, fromDate) => {
            const dateFromFilter = fromDate ? `AND t10.Field_008 >= '${fromDate}T00:00:00.000Z'` : '';
            const sqlStockAndNames = `
                WITH GroupedStock AS (
                    SELECT 
                        t11.Field_005 as ItemCode,
                        SUM(CASE 
                            WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '24', '26', '29', '40', '44', '46', '83') THEN t11.Field_006 
                            WHEN RTRIM(LTRIM(t10.Field_009)) IN ('23', '25', '30', '37', '42', '84', '62', '68', '71', '74', '80') THEN -t11.Field_006 
                            ELSE 0 
                        END) as StockQty
                    FROM STR_TBL_011 t11
                    INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                                              AND t11.Field_003 = t10.Field_004 
                                              AND t11.Field_012 = t10.Field_018
                    WHERE t10.Field_008 <= '${targetDate}T23:59:59.000Z'
                      ${dateFromFilter}
                    GROUP BY t11.Field_005
                )
                SELECT 
                    gs.ItemCode,
                    gs.StockQty,
                    COALESCE(
                        NULLIF(RTRIM(LTRIM(s04.Field_003)), ''),
                        NULLIF(RTRIM(LTRIM(t22.Field_004)), ''),
                        NULLIF(RTRIM(LTRIM(t02_exact.Field_003)), ''),
                        NULLIF(RTRIM(LTRIM(t_name.ItemName)), ''),
                        NULLIF(RTRIM(LTRIM(t_group.GroupName)), ''),
                        NULLIF(RTRIM(LTRIM(c01.Field_003)), ''),
                        RTRIM(LTRIM(gs.ItemCode)),
                        N'کالای بدون نام'
                    ) as ItemName,
                    t_group.GroupName,
                    t_group.SubGroupName
                FROM GroupedStock gs
                LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(gs.ItemCode))
                LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(gs.ItemCode))
                LEFT JOIN IND_TBL_002 t02_exact ON RTRIM(LTRIM(t02_exact.Field_008)) = RTRIM(LTRIM(gs.ItemCode))
                LEFT JOIN COM_TBL_001 c01 ON RTRIM(LTRIM(c01.Field_004)) = RTRIM(LTRIM(gs.ItemCode))
                LEFT JOIN (
                    SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as ItemName
                    FROM IND_TBL_021 t21_sub
                    LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
                    GROUP BY t21_sub.Field_004
                ) t_name ON RTRIM(LTRIM(gs.ItemCode)) = RTRIM(LTRIM(t_name.ItemCode))
                LEFT JOIN (
                    SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, 
                           MIN(t02_sub.Field_003) as SubGroupName,
                           MIN(COALESCE(t02_grandparent.Field_003, t02_parent.Field_003, t02_sub.Field_003)) as GroupName
                    FROM IND_TBL_021 t21_sub
                    LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
                    LEFT JOIN IND_TBL_002 t02_parent ON RTRIM(LTRIM(t02_sub.Field_009)) = RTRIM(LTRIM(t02_parent.Field_008))
                    LEFT JOIN IND_TBL_002 t02_grandparent ON RTRIM(LTRIM(t02_parent.Field_009)) = RTRIM(LTRIM(t02_grandparent.Field_008))
                    GROUP BY t21_sub.Field_004
                ) t_group ON RTRIM(LTRIM(gs.ItemCode)) = RTRIM(LTRIM(t_group.ItemCode))
            `;

            const sqlCartonsOnly = `
                SELECT 
                    t11.Field_005 as ItemCode,
                    SUM(CASE 
                        WHEN RTRIM(LTRIM(t10.Field_009)) IN ('10', '24', '26', '29', '40', '44', '46', '83') THEN
                            TRY_CAST(
                                LEFT(
                                    LTRIM(SUBSTRING(t11.Field_031, CHARINDEX(N'تعداد کارتن:', t11.Field_031) + 12, 10)),
                                    PATINDEX('%[^0-9]%', LTRIM(SUBSTRING(t11.Field_031, CHARINDEX(N'تعداد کارتن:', t11.Field_031) + 12, 10)) + 'X') - 1
                                ) as float
                            )
                        WHEN RTRIM(LTRIM(t10.Field_009)) IN ('23', '25', '30', '37', '42', '84', '62', '68', '71', '74', '80') THEN
                            -TRY_CAST(
                                LEFT(
                                    LTRIM(SUBSTRING(t11.Field_031, CHARINDEX(N'تعداد کارتن:', t11.Field_031) + 12, 10)),
                                    PATINDEX('%[^0-9]%', LTRIM(SUBSTRING(t11.Field_031, CHARINDEX(N'تعداد کارتن:', t11.Field_031) + 12, 10)) + 'X') - 1
                                ) as float
                            )
                        ELSE 0
                    END) as CartonsQty
                FROM STR_TBL_011 t11
                INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                                          AND t11.Field_003 = t10.Field_004 
                                          AND t11.Field_012 = t10.Field_018
                WHERE t10.Field_008 <= '${targetDate}T23:59:59.000Z'
                  ${dateFromFilter}
                  AND t11.Field_031 LIKE N'%تعداد کارتن:%'
                GROUP BY t11.Field_005
            `;

            const [resStock, resCartons] = await Promise.all([
                executeSayanQuery(db, sqlStockAndNames),
                executeSayanQuery(db, sqlCartonsOnly)
            ]);

            const stockRows = resStock || [];
            const cartonRows = resCartons || [];

            const cartonsMap = {};
            cartonRows.forEach(r => {
                if (r.ItemCode) {
                    cartonsMap[r.ItemCode.trim()] = parseFloat(r.CartonsQty || 0);
                }
            });

            return stockRows.map(r => {
                const itemCodeTrimmed = r.ItemCode ? r.ItemCode.trim() : '';
                return {
                    itemCode: itemCodeTrimmed,
                    itemName: r.ItemName ? r.ItemName.trim() : 'کالای بدون نام',
                    groupName: r.GroupName ? r.GroupName.trim() : 'سایر گروه‌ها',
                    subGroupName: r.SubGroupName ? r.SubGroupName.trim() : '',
                    stockQty: parseFloat(r.StockQty || 0),
                    cartonsQty: cartonsMap[itemCodeTrimmed] || 0
                };
            });
        };

        const [lastYearStock, currentStock] = await Promise.all([
            getWarehouseInventoryForDate(lastYearDateTo, lastYearDateFrom),
            getWarehouseInventoryForDate(currentYearDateTo, currentYearDateFrom)
        ]);

        res.json({
            success: true,
            lastYearStock,
            currentStock
        });
    } catch (err) {
        console.error("Warehouse Inventory Fetch Error:", err);
        res.status(500).json({ error: err.message || 'خطا در دریافت موجودی از سایان' });
    }
});

app.get('/api/warehouse-overview/data', (req, res) => {
    try {
        const db = getDb();
        res.json(db.warehouseOverview || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/warehouse-overview/data', (req, res) => {
    try {
        const db = getDb();
        db.warehouseOverview = req.body;
        saveDb(db);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/warehouse-overview/send-negative-alert', async (req, res) => {
    try {
        const db = getDb();
        const settings = db.settings || {};
        const { negativeItems = [], summary = {}, targetGroup = null, platforms = ['telegram', 'bale'] } = req.body;

        // Collect destination targets
        let targets = [];
        if (targetGroup) {
            platforms.forEach(plat => {
                targets.push({ platform: plat, id: targetGroup });
            });
        } else {
            targets = collectBotTargets(db, { category: 'warehouse', platforms });
            if (targets.length === 0) {
                targets = collectBotTargets(db, { category: 'production_compare', platforms });
            }
            if (targets.length === 0) {
                targets = collectBotTargets(db, { category: 'production', platforms });
            }
            if (targets.length === 0) {
                targets = collectBotTargets(db, { category: 'all', platforms });
            }
        }

        if (!targets || targets.length === 0) {
            return res.status(400).json({ 
                error: 'هیچ شناسه گروه یا مقصدی برای ارسال پیام بات تنظیم نشده است. لطفاً در بخش تنظیمات یا فیلد ارسال، آیدی گروه را وارد نمایید.' 
            });
        }

        // Format Iranian Persian numbers helper
        const fNum = (n, maxDec = 1) => {
            const num = parseFloat(n) || 0;
            return num.toLocaleString('fa-IR', { maximumFractionDigits: maxDec });
        };
        const fTon = (n) => {
            const num = (parseFloat(n) || 0) / 1000;
            return num.toLocaleString('fa-IR', { maximumFractionDigits: 2 });
        };

        const reportDate = summary.reportDate || '۱۴۰۵/۰۵/۳۱';
        const r1Label = summary.report1Label || 'منتهی به سال ۱۴۰۴';
        const r2Label = summary.report2Label || 'وضعیت فعلی سال ۱۴۰۵';
        const signature = summary.signature || 'انبارداری مرکزی و تامین خارجی';

        // Prepare message
        let msg = `🚨 *هشدار تراز وزنی انبار و اقلام دارای رشد منفی* 🚨\n`;
        msg += `📅 *تاریخ استعلام:* ${reportDate}\n`;
        msg += `📊 *مقایسه دوره‌ها:* ${r2Label} نسبت به ${r1Label}\n`;
        msg += `➖➖➖➖➖➖➖➖➖➖➖➖\n`;
        msg += `⚖️ *خلاصه مقایسه وزنی زنجیره تامین و تولید:*\n\n`;

        if (summary.lastYearYarnsWeight !== undefined || summary.currentYarnsWeight !== undefined) {
            const yDiff = (summary.currentYarnsWeight || 0) - (summary.lastYearYarnsWeight || 0);
            const yRatio = summary.lastYearYarnsWeight > 0 ? (yDiff / summary.lastYearYarnsWeight) * 100 : 0;
            const yIcon = yDiff >= 0 ? '📈 رشد (+)' : '🔻 کاهش (-)';
            msg += `🧵 *۱. نخ‌های تولیدی کارخانه (تولید داخلی):*\n`;
            msg += `  • سال قبل: ${fNum(summary.lastYearYarnsWeight)} kg (${fTon(summary.lastYearYarnsWeight)} تن)\n`;
            msg += `  • سال جاری: ${fNum(summary.currentYarnsWeight)} kg (${fTon(summary.currentYarnsWeight)} تن)\n`;
            msg += `  • اختلاف وزنی: ${yDiff >= 0 ? '+' : ''}${fNum(yDiff)} kg (${yRatio >= 0 ? '+' : ''}${fNum(yRatio, 1)}%) [${yIcon}]\n\n`;
        }

        if (summary.lastYearRawWeight !== undefined || summary.currentRawWeight !== undefined) {
            const rDiff = (summary.currentRawWeight || 0) - (summary.lastYearRawWeight || 0);
            const rRatio = summary.lastYearRawWeight > 0 ? (rDiff / summary.lastYearRawWeight) * 100 : 0;
            const rIcon = rDiff >= 0 ? '📈 رشد (+)' : '🔻 کاهش (-)';
            msg += `📦 *۲. مواد اولیه، اقلام وارداتی و گمرک:*\n`;
            msg += `  • سال قبل: ${fNum(summary.lastYearRawWeight)} kg (${fTon(summary.lastYearRawWeight)} تن)\n`;
            msg += `  • سال جاری: ${fNum(summary.currentRawWeight)} kg (${fTon(summary.currentRawWeight)} تن)\n`;
            msg += `  • اختلاف وزنی: ${rDiff >= 0 ? '+' : ''}${fNum(rDiff)} kg (${rRatio >= 0 ? '+' : ''}${fNum(rRatio, 1)}%) [${rIcon}]\n\n`;
        }

        if (summary.lastYearTotalWeight !== undefined || summary.currentTotalWeight !== undefined) {
            const tDiff = (summary.currentTotalWeight || 0) - (summary.lastYearTotalWeight || 0);
            const tRatio = summary.lastYearTotalWeight > 0 ? (tDiff / summary.lastYearTotalWeight) * 100 : 0;
            const tIcon = tDiff >= 0 ? '✅ تراز مثبت' : '⚠️ تراز منفی';
            msg += `🏢 *۳. سرجمع کل موجودی زنجیره تامین:*\n`;
            msg += `  • سال قبل: ${fNum(summary.lastYearTotalWeight)} kg (${fTon(summary.lastYearTotalWeight)} تن)\n`;
            msg += `  • سال جاری: ${fNum(summary.currentTotalWeight)} kg (${fTon(summary.currentTotalWeight)} تن)\n`;
            msg += `  • تغییر کل: ${tDiff >= 0 ? '+' : ''}${fNum(tDiff)} kg (${tRatio >= 0 ? '+' : ''}${fNum(tRatio, 1)}%) [${tIcon}]\n`;
        }

        msg += `➖➖➖➖➖➖➖➖➖➖➖➖\n`;
        msg += `⚠️ *فهرست اقلام و کالاهای دارای کسری / افت وزنی (منفی):*\n\n`;

        if (negativeItems.length === 0) {
            msg += `✅ هیچ کالایی با تراز وزنی منفی یافت نشد. تمامی اقلام در وضعیت رشد یا برابر با سال گذشته می‌باشند.\n`;
        } else {
            negativeItems.forEach((item, idx) => {
                const num = fNum(idx + 1, 0);
                const diff = parseFloat(item.diffWeight) || 0;
                const ratio = parseFloat(item.ratio) || 0;
                const catLabel = item.category === 'factory' ? '🧵 تولیدی' : '📦 مواد اولیه / وارداتی';
                
                msg += `${num}. *${item.name}* ${item.code ? `(${item.code})` : ''} - ${catLabel}\n`;
                msg += `   🔻 افت وزنی: *${fNum(diff)} kg* (${fNum(ratio, 1)}%)\n`;
                msg += `   📊 سال قبل: ${fNum(item.lastYearWeight)} kg ⬅️ امسال: ${fNum(item.currentWeight)} kg\n\n`;
            });
        }

        msg += `➖➖➖➖➖➖➖➖➖➖➖➖\n`;
        msg += `🔍 *تعداد کل کالاهای دارای افت:* ${fNum(negativeItems.length, 0)} قلم کالا\n`;
        msg += `👤 *تنظیم گزارش:* ${signature}\n`;
        msg += `🤖 *ارسال شده توسط سامانه یکپارچه انبار و زنجیره تامین*`;

        // Send to targets
        let sentCount = 0;
        const sendErrors = [];

        for (const target of targets) {
            try {
                if (target.platform === 'telegram') {
                    const tg = await safeImport('./backend/telegram.js');
                    if (tg && tg.sendBotMessage) {
                        await tg.sendBotMessage(target.id, msg, { parse_mode: 'Markdown' });
                        sentCount++;
                    }
                } else if (target.platform === 'bale') {
                    const bale = await safeImport('./backend/bale.js');
                    if (bale && bale.sendBotMessage) {
                        await bale.sendBotMessage(target.id, msg);
                        sentCount++;
                    }
                } else if (target.platform === 'whatsapp') {
                    const wa = await safeImport('./backend/whatsapp.js');
                    if (wa && wa.sendMessage) {
                        await wa.sendMessage(target.id, msg);
                        sentCount++;
                    }
                }
            } catch (err) {
                console.error(`Error sending negative alert to ${target.platform} (${target.id}):`, err.message);
                sendErrors.push(`${target.platform} (${target.id}): ${err.message}`);
            }
        }

        if (sentCount === 0 && sendErrors.length > 0) {
            return res.status(500).json({ 
                error: `خطا در ارسال به ربات: ${sendErrors.join(', ')}` 
            });
        }

        res.json({ 
            success: true, 
            sentCount, 
            targetsCount: targets.length,
            errors: sendErrors.length > 0 ? sendErrors : undefined,
            messageText: msg
        });
    } catch (err) {
        console.error("Negative alert send fatal error:", err);
        res.status(500).json({ error: err.message });
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
                RTRIM(LTRIM(t11.Field_005)) as ItemCode,
                COALESCE(
                    NULLIF(RTRIM(LTRIM(s04.Field_003)), ''),
                    NULLIF(RTRIM(LTRIM(t22.Field_004)), ''),
                    NULLIF(RTRIM(LTRIM(t02_exact.Field_003)), ''),
                    NULLIF(RTRIM(LTRIM(t_name.ItemName)), ''),
                    NULLIF(RTRIM(LTRIM(t_group.GroupName)), ''),
                    NULLIF(RTRIM(LTRIM(c01.Field_003)), ''),
                    RTRIM(LTRIM(t11.Field_005)),
                    N'کالای بدون نام'
                ) as ItemName,
                t11.Field_006 as Quantity
            FROM STR_TBL_010 t10
            INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                      AND t11.Field_003 = t10.Field_004
                                      AND t11.Field_012 = t10.Field_018
            LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
            LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
            LEFT JOIN IND_TBL_002 t02_exact ON RTRIM(LTRIM(t02_exact.Field_008)) = RTRIM(LTRIM(t11.Field_005))
            LEFT JOIN COM_TBL_001 c01 ON RTRIM(LTRIM(c01.Field_004)) = RTRIM(LTRIM(t11.Field_005))
            LEFT JOIN (
                SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as ItemName
                FROM IND_TBL_021 t21_sub
                LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
                GROUP BY t21_sub.Field_004
            ) t_name ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_name.ItemCode))
            LEFT JOIN (
                SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(COALESCE(t02_grandparent.Field_003, t02_parent.Field_003, t02_sub.Field_003)) as GroupName
                FROM IND_TBL_021 t21_sub
                LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
                LEFT JOIN IND_TBL_002 t02_parent ON RTRIM(LTRIM(t02_sub.Field_009)) = RTRIM(LTRIM(t02_parent.Field_008))
                LEFT JOIN IND_TBL_002 t02_grandparent ON RTRIM(LTRIM(t02_parent.Field_009)) = RTRIM(LTRIM(t02_grandparent.Field_008))
                GROUP BY t21_sub.Field_004
            ) t_group ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_group.ItemCode))
            WHERE RTRIM(LTRIM(t10.Field_009)) IN ('61', '67', '79', '73', '70')
              AND t10.Field_008 >= '${gregFromDate}T00:00:00.000Z'
              AND t10.Field_008 <= '${gregToDate}T23:59:59.999Z'
            ORDER BY COALESCE(s04.Field_003, t22.Field_004, t02_exact.Field_003, t_name.ItemName, t_group.GroupName, t11.Field_005, N'کالای بدون نام'), t10.Field_008
        `;

        const rawRows = await executeSayanQuery(db, sql);

        const itemsMap = new Map();
        let qty_61 = 0, qty_67 = 0, qty_79 = 0, qty_73 = 0, qty_schweiter = 0;

        const getKnownYarnNameByCode = (code, docType) => {
            const c = String(code || '').replace(/[^0-9]/g, '');
            if (c.startsWith('01020203') || c.startsWith('010203')) return 'نخ شوایتر 150/48';
            if (c.startsWith('01020204') || c.startsWith('010204')) return 'نخ شوایتر 100/36';
            if (c.startsWith('01020205') || c.startsWith('010205')) return 'نخ شوایتر 75/36';
            if (c.startsWith('01020206') || c.startsWith('010206')) return 'نخ شوایتر 300/96';
            if (c.startsWith('01020209') || c.startsWith('010209')) return 'نخ شوایتر 150/144';
            if (c.startsWith('01020214') || c.startsWith('010214')) return 'نخ شوایتر 50/24';
            if (c.startsWith('01020216') || c.startsWith('010216')) return 'نخ شوایتر 75/72';
            if (c.startsWith('01030211') || c.startsWith('010311')) return 'نخ DTY 150/48';
            if (c.startsWith('010302') || c.startsWith('0103')) return 'نخ DTY';
            if (c.startsWith('0101')) return 'نخ POY';
            if (c.startsWith('0104')) return 'نخ کش';
            if (c.startsWith('0105')) return 'نخ اسپاندکس';
            if (c.startsWith('0102') || docType === '70') return 'نخ شوایتر 150';
            if (docType === '61') return 'نخ POY';
            if (docType === '67') return 'نخ DTY';
            if (docType === '79') return 'نخ کش';
            if (docType === '73') return 'نخ اسپاندکس';
            return 'کالای تولیدی';
        };

        rawRows.forEach(r => {
            const itemCode = String(r.ItemCode || '').trim();
            let rawName = String(r.ItemName || itemCode || 'کالای بدون نام').trim();
            const qty = parseFloat(r.Quantity || 0);
            const docType = String(r.DocType || '').trim();

            const hasPersianLetters = /[\u0600-\u06FF]/.test(rawName);
            const isPureCode = rawName === itemCode || !hasPersianLetters || /^\d+$/.test(rawName.replace(/[\s\-\_]/g, ''));

            if (isPureCode) {
                rawName = getKnownYarnNameByCode(itemCode, docType);
            }

            if (!itemsMap.has(rawName)) {
                itemsMap.set(rawName, {
                    name: rawName,
                    unit: 'کیلوگرم',
                    qty_61: 0,
                    qty_67: 0,
                    qty_79: 0,
                    qty_73: 0,
                    qty_schweiter: 0,
                    total: 0
                });
            }

            const item = itemsMap.get(rawName);
            if (docType === '61') { item.qty_61 += qty; qty_61 += qty; }
            else if (docType === '67') { item.qty_67 += qty; qty_67 += qty; }
            else if (docType === '79') { item.qty_79 += qty; qty_79 += qty; }
            else if (docType === '73') { item.qty_73 += qty; qty_73 += qty; }
            else if (docType === '70') { item.qty_schweiter += qty; qty_schweiter += qty; }
            item.total += qty;
        });

        const items = Array.from(itemsMap.values());
        const grandTotal = qty_61 + qty_67 + qty_79 + qty_73 + qty_schweiter;

        const key = `${dateFrom}_${dateTo}`;
        db.productionReportWastes = db.productionReportWastes || {};
        db.productionWasteArchive = db.productionWasteArchive || [];

        let waste_61 = 0;
        let waste_67 = 0;
        let waste_79 = 0;
        let waste_73 = 0;
        let waste_schweiter = 0;
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
                waste_schweiter += parseFloat(entry.waste_schweiter || 0);
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
                waste_schweiter: 0,
                details: ''
            };
            waste_61 = parseFloat(storedWaste.waste_61 || 0);
            waste_67 = parseFloat(storedWaste.waste_67 || 0);
            waste_79 = parseFloat(storedWaste.waste_79 || 0);
            waste_73 = parseFloat(storedWaste.waste_73 || 0);
            waste_schweiter = parseFloat(storedWaste.waste_schweiter || 0);
            if (storedWaste.details && storedWaste.details.trim()) {
                detailsList.push(storedWaste.details);
            }
        }

        const totalWaste = waste_61 + waste_67 + waste_79 + waste_73 + waste_schweiter;
        const pct_61 = qty_61 > 0 ? (waste_61 / qty_61) * 100 : 0;
        const pct_67 = qty_67 > 0 ? (waste_67 / qty_67) * 100 : 0;
        const pct_79 = qty_79 > 0 ? (waste_79 / qty_79) * 100 : 0;
        const pct_73 = qty_73 > 0 ? (waste_73 / qty_73) * 100 : 0;
        const pct_schweiter = qty_schweiter > 0 ? (waste_schweiter / qty_schweiter) * 100 : 0;
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
                qty_schweiter,
                grandTotal
            },
            waste: {
                waste_61,
                waste_67,
                waste_79,
                waste_73,
                waste_schweiter,
                totalWaste,
                pct_61,
                pct_67,
                pct_79,
                pct_73,
                pct_schweiter,
                totalPct,
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
        const { dateFrom, dateTo, waste_61, waste_67, waste_79, waste_73, waste_schweiter, details, totals, items } = req.body;
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
            waste_schweiter: parseFloat(waste_schweiter || 0),
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
        const w_schweiter = parseFloat(waste_schweiter || 0);
        const totalW = w_61 + w_67 + w_79 + w_73 + w_schweiter;

        const archiveEntry = {
            id: existingIdx !== -1 ? db.productionWasteArchive[existingIdx].id : 'pwa_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            dateFrom,
            dateTo,
            waste_61: w_61,
            waste_67: w_67,
            waste_79: w_79,
            waste_73: w_73,
            waste_schweiter: w_schweiter,
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

app.post('/api/sayan/production-report/send-compare-bot', async (req, res) => {
    try {
        const db = getDb();
        const { dateFromA, dateToA, dateFromB, dateToB, items } = req.body;

        if (!dateFromA || !items) {
            return res.status(400).json({ error: 'اطلاعات گزارش کامل نیست' });
        }

        const title = `گزارش مقایسه‌ای آمار تولید سایان`;
        const Renderer = await import('./backend/renderer.js');
        const pdfBuffer = await Renderer.generateProductionCompareReportPDF(title, dateFromA, dateToA, dateFromB, dateToB, items);

        // Build elegant caption
        const sumA = items.reduce((sum, item) => sum + (item.totalA || 0), 0);
        const sumB = items.reduce((sum, item) => sum + (item.totalB || 0), 0);
        const totalDiff = sumA - sumB;
        const totalDiffPct = sumB ? (totalDiff / sumB) * 100 : 0;

        let caption = `📊 *گزارش مقایسه‌ای آمار تولید کارخانه*

📅 *بازه اول (A):* ${dateFromA} تا ${dateToA}
📅 *بازه دوم (B):* ${dateFromB} تا ${dateToB}

📈 *خلاصه آمار تولید:*
🔹 مجموع تولید بازه اول (A): ${sumA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
🔸 مجموع تولید بازه دوم (B): ${sumB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
📊 تفاضل تولید (A - B): ${totalDiff.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg
📉 درصد تغییر: ${sumB ? `${totalDiffPct > 0 ? '+' : ''}${totalDiffPct.toFixed(1)}%` : '-'}

📎 جزئیات کامل ردیف‌های تولیدی در فایل PDF ضمیمه ارسال گردید.`;

        const filename = `Production_Compare_Report_${dateFromA.replace(/[\/\\]/g, '-')}.pdf`;
        const uniqueTargets = collectBotTargets(db, { category: 'production_compare' });

        if (uniqueTargets.length === 0) {
            return res.status(400).json({ error: 'هیچ شناسه گروه مقایسه آمار تولید (تلگرام، بله یا واتساپ) در تنظیمات سیستم یافت نشد. لطفاً در تنظیمات سیستم شناسه گروه مقایسه آمار تولید را وارد نمایید.' });
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
                console.error(`[Send Production Compare Report] Failed for ${target.platform}:${target.id}:`, err.message);
            }
        }

        if (sentCount === 0) {
            return res.status(400).json({ error: `ارسال گزارش مقایسه‌ای ناموفق بود: ${lastError || 'خطای ناشناخته در اتصال به ربات'}` });
        }

        res.json({
            success: true,
            message: `گزارش مقایسه‌ای با موفقیت به ${sentCount} گروه / چت در بات‌ها ارسال شد.`
        });
    } catch (e) {
        console.error("Send Production Compare Report Bot Error:", e);
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

// ==========================================
// SAYAN ONLINE FACTORY EXIT INTEGRATION ENDPOINTS
// ==========================================

const mapGradeCode = (code) => {
    if (!code) return 'AA';
    const s = String(code).trim();
    if (s === '00011001') return 'AA';
    if (s === '00011002') return 'A';
    if (s === '00011003') return 'B';
    if (s === '00011004') return 'C';
    if (s.length < 5) return s;
    return 'AA';
};

const mapTwistCode = (code) => {
    if (!code) return 'Z';
    const s = String(code).trim();
    if (s === '00021001') return 'Z';
    if (s === '00021002') return 'S';
    if (s.length < 5) return s;
    return 'Z';
};

const parseDetailNote = (note) => {
    const result = {
        bobbinCount: 0,
        cartonCount: 0,
        grossWeight: 0,
        netWeight: 0,
        grade: 'AA',
        twistDirection: 'Z',
        description: ''
    };
    if (!note || typeof note !== 'string') return result;
    
    const parts = note.split('|').map(p => p.trim());
    for (const p of parts) {
        if (p.includes('تعداد بوبین:')) {
            result.bobbinCount = parseInt(p.replace('تعداد بوبین:', '').trim(), 10) || 0;
        } else if (p.includes('تعداد کارتن:')) {
            result.cartonCount = parseInt(p.replace('تعداد کارتن:', '').trim(), 10) || 0;
        } else if (p.includes('وزن ناخالص:')) {
            result.grossWeight = parseFloat(p.replace('وزن ناخالص:', '').trim()) || 0;
        } else if (p.includes('وزن خالص:')) {
            result.netWeight = parseFloat(p.replace('وزن خالص:', '').trim()) || 0;
        } else if (p.includes('گرید:')) {
            const rawG = p.replace('گرید:', '').trim();
            result.grade = mapGradeCode(rawG);
        } else if (p.includes('جهت تاب:')) {
            const rawT = p.replace('جهت تاب:', '').trim();
            result.twistDirection = mapTwistCode(rawT);
        } else if (p.includes('توضیحات:')) {
            const d = p.replace('توضیحات:', '').trim();
            if (d) result.description = d;
        }
    }
    return result;
};

// Search persons across Sayan ERP (GNR_TBL_001)
app.all(['/api/sayan/search-persons', '/api/sayan-persons/search'], async (req, res) => {
    try {
        const db = getDb();
        const q = String(req.query.q || req.body.q || '').trim();
        if (!q) {
            return res.json({ success: true, persons: [] });
        }

        const sanitized = q.replace(/'/g, "''");
        const queryStr = `
            SELECT TOP 35
                Field_001 as Id,
                Field_003 as PersonCode,
                Field_005 as SecondaryCode,
                RTRIM(LTRIM(COALESCE(Field_006, ''))) as FirstName,
                RTRIM(LTRIM(COALESCE(Field_007, ''))) as LastName,
                RTRIM(LTRIM(COALESCE(Field_008, ''))) as FatherOrDetail,
                RTRIM(LTRIM(COALESCE(Field_009, ''))) as NationalCode,
                RTRIM(LTRIM(COALESCE(Field_015, ''))) as Mobile,
                RTRIM(LTRIM(COALESCE(Field_021, ''))) as AccountingCode,
                RTRIM(LTRIM(COALESCE(Field_030, ''))) as TafsiliCode,
                RTRIM(LTRIM(COALESCE(Field_013, ''))) as Address
            FROM GNR_TBL_001
            WHERE (
                Field_006 LIKE N'%${sanitized}%' OR
                Field_007 LIKE N'%${sanitized}%' OR
                Field_003 LIKE '%${sanitized}%' OR
                Field_005 LIKE '%${sanitized}%' OR
                Field_008 LIKE N'%${sanitized}%' OR
                Field_009 LIKE '%${sanitized}%' OR
                Field_015 LIKE '%${sanitized}%' OR
                Field_021 LIKE '%${sanitized}%' OR
                Field_030 LIKE '%${sanitized}%'
            )
            ORDER BY Field_001 DESC
        `;

        const rows = await executeSayanQuery(db, queryStr);
        const persons = rows.map(r => {
            const fullName = `${r.FirstName || ''} ${r.LastName || ''}`.trim() || r.FatherOrDetail || `شخص ${r.PersonCode}`;
            return {
                id: String(r.Id || ''),
                personCode: String(r.PersonCode || r.SecondaryCode || ''),
                name: fullName,
                firstName: r.FirstName || '',
                lastName: r.LastName || '',
                fatherOrDetail: r.FatherOrDetail || '',
                nationalCode: r.NationalCode || '',
                mobile: r.Mobile || '',
                accountingCode: String(r.AccountingCode || r.TafsiliCode || r.PersonCode || ''),
                tafsiliCode: String(r.TafsiliCode || ''),
                address: r.Address || ''
            };
        });

        res.json({ success: true, persons });
    } catch (e) {
        console.error("Sayan Search Persons Error:", e);
        res.status(500).json({ error: e.message, persons: [] });
    }
});

// Build robust conditions for matching names and remittance numbers in Sayan (taking into account Arabic/Persian character variations)
// Helper to extract 3-6 digit person code from recipientName and clean the name
function extractCodeAndCleanName(name) {
    if (!name) return { cleanName: '', extractedCode: null };
    // Match any 3 to 6 digit sequence
    const match = String(name).match(/\b\d{3,6}\b/);
    const extractedCode = match ? match[0] : null;
    let cleanName = String(name);
    if (extractedCode) {
        cleanName = cleanName.replace(extractedCode, '');
    }
    cleanName = cleanName
        .replace(/کد\s+مشتری/gi, '')
        .replace(/کد/gi, '')
        .replace(/مشتری/gi, '')
        .replace(/با/gi, '')
        .replace(/نام/gi, '')
        .replace(/گیرنده/gi, '')
        .replace(/[\-\:\(\)]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return { cleanName, extractedCode };
}

// Build robust conditions for matching names and remittance numbers in Sayan (taking into account Arabic/Persian character variations)
function getSayanMatchConditions({ personCode, recipientName, permitNumber }) {
    let groups = [];

    // Function to build SQL Server normalized column comparison
    const sqlNormalize = (col) => {
        return `REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${col}, ''), N'ي', N'ی'), N'ك', N'ک'), N'‌', N' '), N'أ', N'ا')`;
    };

    const jsNormalizePersian = (str) => {
        return String(str)
            .replace(/ي/g, 'ی')
            .replace(/ك/g, 'ک')
            .replace(/‌/g, ' ')
            .replace(/أ/g, 'ا')
            .replace(/'/g, "''")
            .trim();
    };

    let pCode = personCode;
    let rName = recipientName;
    if (!pCode && rName) {
        const { cleanName, extractedCode } = extractCodeAndCleanName(rName);
        if (extractedCode) {
            pCode = extractedCode;
            rName = cleanName;
        }
    }

    // 1. Person matching group (Code OR Name)
    let personConds = [];
    if (pCode) {
        const sCode = String(pCode).replace(/'/g, "''").trim();
        const numericCode = parseInt(sCode, 10);
        let codeConds = [
            `RTRIM(LTRIM(t10.Field_010)) = '${sCode}'`,
            `RTRIM(LTRIM(t10.Field_010)) = '0${sCode}'`,
            `RTRIM(LTRIM(t10.Field_010)) = '00${sCode}'`,
            `RTRIM(LTRIM(p.Field_003)) = '${sCode}'`,
            `RTRIM(LTRIM(p.Field_005)) = '${sCode}'`
        ];
        if (!isNaN(numericCode)) {
            codeConds.push(`TRY_CAST(t10.Field_010 AS INT) = ${numericCode}`);
        }
        personConds.push(`(${codeConds.join(' OR ')})`);
        personConds.push(`t10.Field_029 LIKE '%${sCode}%'`);
    }

    if (rName) {
        const normName = jsNormalizePersian(rName);
        if (normName && !/^\d+$/.test(normName)) {
            personConds.push(`${sqlNormalize('t10.Field_029')} LIKE N'%${normName}%'`);
            personConds.push(`${sqlNormalize('p.Field_006')} LIKE N'%${normName}%'`);
            personConds.push(`${sqlNormalize('p.Field_007')} LIKE N'%${normName}%'`);
        }
    }

    if (personConds.length > 0) {
        groups.push(`(${personConds.join(' OR ')})`);
    }

    // 2. Number matching group (DocNo OR RemittanceNo)
    let numberConds = [];
    let numVal = permitNumber || (rName && /^\d+$/.test(rName) ? rName : null);
    if (numVal) {
        const normNum = String(numVal).replace(/'/g, "''").trim();
        if (normNum) {
            numberConds.push(`t10.Field_005 = '${normNum}'`);
            numberConds.push(`t10.Field_006 = '${normNum}'`);
            numberConds.push(`t10.Field_005 LIKE '%${normNum}%'`);
            numberConds.push(`t10.Field_006 LIKE '%${normNum}%'`);
        }
    }

    if (numberConds.length > 0) {
        groups.push(`(${numberConds.join(' OR ')})`);
    }

    return groups;
}

// ==========================================
// SAYAN SALES REMITTANCES (حواله‌های فروش و انبار)
// ==========================================

// Complete Sayan Sales Remittances List & Explorer Endpoint
app.all('/api/sayan/sales-remittances', async (req, res) => {
    try {
        const db = getDb();
        const settings = db.settings || {};
        const sayanUrl = settings.sayanApiUrl || process.env.SAYAN_API_URL;
        const sayanKey = settings.sayanApiKey || process.env.SAYAN_API_KEY;

        if (!sayanUrl || !sayanKey) {
            return res.json({ success: false, message: 'تنظیمات آدرس API یا کلید امنیتی سایان در بخش تنظیمات سیستم ثبت نشده است.', remittances: [] });
        }

        const dateFrom = req.query.dateFrom || req.body.dateFrom;
        const dateTo = req.query.dateTo || req.body.dateTo;
        const search = String(req.query.search || req.body.search || '').trim();
        const docType = String(req.query.docType || req.body.docType || 'all').trim();
        const personCode = String(req.query.personCode || req.body.personCode || '').trim();
        const storeId = String(req.query.storeId || req.body.storeId || '').trim();
        const limit = Math.min(parseInt(req.query.limit || req.body.limit || '500', 10), 2000);

        let whereClauses = [];

        // DocType Filter
        if (docType && docType !== 'all') {
            if (docType === 'all_exit') {
                whereClauses.push(`RTRIM(LTRIM(t10.Field_009)) IN ('12', '23')`);
            } else {
                whereClauses.push(`RTRIM(LTRIM(t10.Field_009)) = '${docType.replace(/'/g, "''")}'`);
            }
        } else {
            whereClauses.push(`RTRIM(LTRIM(t10.Field_009)) IN ('12', '23', '3', '13')`);
        }

        // Date Range Filter
        if (dateFrom && dateTo) {
            const gregFrom = parseJalaliStrToGregorian(dateFrom) || (dateFrom.includes('-') ? dateFrom : null);
            const gregTo = parseJalaliStrToGregorian(dateTo) || (dateTo.includes('-') ? dateTo : null);
            if (gregFrom && gregTo) {
                whereClauses.push(`t10.Field_008 >= '${gregFrom}T00:00:00.000Z' AND t10.Field_008 <= '${gregTo}T23:59:59.999Z'`);
            }
        } else if (dateFrom) {
            const gregFrom = parseJalaliStrToGregorian(dateFrom) || (dateFrom.includes('-') ? dateFrom : null);
            if (gregFrom) {
                whereClauses.push(`t10.Field_008 >= '${gregFrom}T00:00:00.000Z'`);
            }
        }

        // Person Code Filter
        if (personCode) {
            const sanitizedPerson = personCode.replace(/'/g, "''");
            whereClauses.push(`(RTRIM(LTRIM(t10.Field_010)) = '${sanitizedPerson}' OR RTRIM(LTRIM(p.Field_003)) = '${sanitizedPerson}' OR RTRIM(LTRIM(p.Field_005)) = '${sanitizedPerson}')`);
        }

        // Store ID Filter
        if (storeId && storeId !== 'all') {
            whereClauses.push(`RTRIM(LTRIM(t10.Field_018)) = '${storeId.replace(/'/g, "''")}'`);
        }

        // Search Query (Multi-field fuzzy search)
        if (search) {
            const sanitized = search.replace(/'/g, "''");
            const sqlNormalize = (col) => `REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${col}, ''), N'ي', N'ی'), N'ك', N'ک'), N'‌', N' '), N'أ', N'ا')`;
            const jsNorm = String(search).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ').replace(/أ/g, 'ا').replace(/'/g, "''").trim();
            
            const searchConds = [
                `RTRIM(LTRIM(t10.Field_005)) LIKE N'%${sanitized}%'`,
                `RTRIM(LTRIM(t10.Field_006)) LIKE N'%${sanitized}%'`,
                `RTRIM(LTRIM(t10.Field_010)) LIKE N'%${sanitized}%'`,
                `${sqlNormalize('p.Field_006')} LIKE N'%${jsNorm}%'`,
                `${sqlNormalize('p.Field_007')} LIKE N'%${jsNorm}%'`,
                `${sqlNormalize('t07.Field_006')} LIKE N'%${jsNorm}%'`,
                `RTRIM(LTRIM(t11.Field_005)) LIKE N'%${sanitized}%'`,
                `${sqlNormalize('s04.Field_003')} LIKE N'%${jsNorm}%'`,
                `${sqlNormalize('t22.Field_004')} LIKE N'%${jsNorm}%'`,
                `${sqlNormalize('t10.Field_029')} LIKE N'%${jsNorm}%'`
            ];
            whereClauses.push(`(${searchConds.join(' OR ')})`);
        }

        const sql = `
            SELECT TOP ${limit}
                t10.Field_001 as ArchiveCode,
                t10.Field_004 as SubSystem,
                t10.Field_005 as DocNo,
                t10.Field_006 as RemittanceNumber,
                t10.Field_007 as SubCode,
                t10.Field_008 as DocDate,
                RTRIM(LTRIM(t10.Field_009)) as DocType,
                t10.Field_010 as PersonCode,
                t10.Field_018 as StoreId,
                t10.Field_029 as Note,
                COALESCE(
                    NULLIF(RTRIM(LTRIM(t07.Field_006)), ''),
                    t10.Field_010,
                    N'طرف‌حساب نامشخص'
                ) as PersonFullName,
                t11.Field_001 as LineId,
                RTRIM(LTRIM(t11.Field_005)) as ItemCode,
                COALESCE(
                    NULLIF(RTRIM(LTRIM(t22.Field_004)), ''),
                    NULLIF(RTRIM(LTRIM(t_name.ItemName)), ''),
                    RTRIM(LTRIM(t11.Field_005)),
                    N'کالای بدون نام'
                ) as ItemName,
                t11.Field_006 as NetQty,
                t11.Field_031 as DetailNote,
                t11.Field_034 as RowNo
            FROM STR_TBL_010 t10
            INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                      AND t11.Field_003 = t10.Field_004 
                                      AND t11.Field_012 = t10.Field_018
            LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
            LEFT JOIN (
                SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as ItemName
                FROM IND_TBL_021 t21_sub
                LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
                GROUP BY t21_sub.Field_004
            ) t_name ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_name.ItemCode))
            LEFT JOIN ACT_TBL_007 t07 ON RTRIM(LTRIM(t10.Field_010)) = RTRIM(LTRIM(t07.Field_005)) AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
            LEFT JOIN GNR_TBL_001 p ON p.Field_003 = t10.Field_010 OR p.Field_005 = t10.Field_010
            LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY t10.Field_008 DESC, t10.Field_005 DESC
        `;

        const rows = await executeSayanQuery(db, sql);
        
        // Group line items by Header (DocNo)
        const remittancesMap = new Map();
        
        const persianDays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];

        for (const row of rows) {
            const docKey = String(row.DocNo || row.ArchiveCode);
            if (!remittancesMap.has(docKey)) {
                let shamsiDateStr = '';
                let dayOfWeek = '';
                if (row.DocDate) {
                    try {
                        const d = new Date(row.DocDate);
                        if (!isNaN(d.getTime())) {
                            const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
                            shamsiDateStr = `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
                            dayOfWeek = persianDays[d.getDay()];
                        }
                    } catch (e) {}
                }

                const docTypeStr = String(row.DocType || '').trim();
                let docTypeLabel = 'حواله فروش';
                if (docTypeStr === '23') docTypeLabel = 'حواله فروش';
                else if (docTypeStr === '12') docTypeLabel = 'سایر حواله‌ها (۱۲)';
                else if (docTypeStr === '3') docTypeLabel = 'حواله انبار';
                else if (docTypeStr === '13') docTypeLabel = 'برگشت از فروش';
                else if (docTypeStr === '10') docTypeLabel = 'رسید انبار';

                remittancesMap.set(docKey, {
                    archiveCode: String(row.ArchiveCode || ''),
                    subSystem: String(row.SubSystem || ''),
                    docNo: String(row.DocNo || ''),
                    remittanceNumber: String(row.RemittanceNumber || row.DocNo || ''),
                    subCode: String(row.SubCode || ''),
                    docDate: row.DocDate || '',
                    shamsiDate: shamsiDateStr,
                    dayOfWeek,
                    docType: docTypeStr,
                    docTypeLabel,
                    personCode: String(row.PersonCode || ''),
                    personFullName: String(row.PersonFullName || '').trim(),
                    personAddress: '',
                    personPhone: '',
                    storeId: String(row.StoreId || ''),
                    note: String(row.Note || '').trim(),
                    headerPayable: 0,
                    items: [],
                    totalNetWeight: 0,
                    totalGrossWeight: 0,
                    totalCartons: 0,
                    totalBobbins: 0,
                    totalAmount: 0
                });
            }

            const rem = remittancesMap.get(docKey);
            const parsed = parseDetailNote(row.DetailNote);
            const netVal = parseFloat(row.NetQty || 0);
            const grossVal = parsed.grossWeight > 0 ? parsed.grossWeight : netVal;
            const unitPrice = 0;
            const totalPrice = 0;

            rem.totalNetWeight += netVal;
            rem.totalGrossWeight += grossVal;
            rem.totalCartons += parsed.cartonCount;
            rem.totalBobbins += parsed.bobbinCount;
            rem.totalAmount += totalPrice;

            rem.items.push({
                lineId: String(row.LineId || ''),
                docNo: String(row.DocNo || ''),
                itemCode: String(row.ItemCode || ''),
                goodsName: String(row.ItemName || row.ItemCode || `کالا ${rem.items.length + 1}`),
                netQty: parseFloat(netVal.toFixed(3)),
                grossQty: parseFloat(grossVal.toFixed(3)),
                unitPrice,
                totalPrice,
                cartonCount: parsed.cartonCount,
                bobbinCount: parsed.bobbinCount,
                grade: parsed.grade,
                twistDirection: parsed.twistDirection,
                description: parsed.description,
                detailNote: row.DetailNote || '',
                rowNo: parseInt(row.RowNo || (rem.items.length + 1), 10)
            });
        }

        const remittances = Array.from(remittancesMap.values()).map(r => {
            r.totalNetWeight = parseFloat(r.totalNetWeight.toFixed(3));
            r.totalGrossWeight = parseFloat(r.totalGrossWeight.toFixed(3));
            r.itemsCount = r.items.length;
            return r;
        });

        // Calculate Overview Summary
        const summary = {
            totalRemittances: remittances.length,
            totalNetWeight: parseFloat(remittances.reduce((s, r) => s + r.totalNetWeight, 0).toFixed(3)),
            totalGrossWeight: parseFloat(remittances.reduce((s, r) => s + r.totalGrossWeight, 0).toFixed(3)),
            totalCartons: remittances.reduce((s, r) => s + r.totalCartons, 0),
            totalBobbins: remittances.reduce((s, r) => s + r.totalBobbins, 0),
            totalAmount: remittances.reduce((s, r) => s + r.totalAmount, 0),
            uniqueCustomersCount: new Set(remittances.map(r => r.personCode || r.personFullName)).size
        };

        res.json({
            success: true,
            remittances,
            summary
        });
    } catch (e) {
        console.error("Fetch Sayan Sales Remittances Error:", e);
        res.status(500).json({ success: false, message: e.message, error: e.message, remittances: [] });
    }
});

// Lookup matching Sayan Sales Remittance (STR_TBL_010 / STR_TBL_011)
// Explore endpoint to return a list of matching headers for debugging and manual search
app.post('/api/sayan/sales-remittance/explore', async (req, res) => {
    try {
        const { query } = req.body;
        const db = getDb();
        if (!db.settings?.sayanApiUrl) {
            return res.json({ success: false, message: 'تنظیمات ارتباط با سایان ثبت نشده است.' });
        }

        let whereClauses = ["RTRIM(LTRIM(t10.Field_009)) IN ('12', '23', '3', '13')"];
        
        if (query && query.trim()) {
            const sanitized = String(query).replace(/'/g, "''").trim();
            const numericVal = parseInt(sanitized, 10);
            
            const jsNormalize = (str) => {
                return String(str).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ').replace(/أ/g, 'ا').replace(/'/g, "''").trim();
            };
            const normName = jsNormalize(sanitized);

            const sqlNormalize = (col) => {
                return `REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${col}, ''), N'ي', N'ی'), N'ك', N'ک'), N'‌', N' '), N'أ', N'ا')`;
            };

            let conditions = [];
            // Match DocNo or RemittanceNumber
            conditions.push(`RTRIM(LTRIM(t10.Field_005)) LIKE N'%${sanitized}%'`);
            conditions.push(`RTRIM(LTRIM(t10.Field_006)) LIKE N'%${sanitized}%'`);
            // Match Person Code
            conditions.push(`RTRIM(LTRIM(t10.Field_010)) LIKE N'%${sanitized}%'`);
            if (!isNaN(numericVal)) {
                conditions.push(`TRY_CAST(t10.Field_010 AS INT) = ${numericVal}`);
                conditions.push(`RTRIM(LTRIM(p.Field_003)) = '${sanitized}'`);
            }
            // Match Name
            if (normName && !/^\d+$/.test(normName)) {
                const parts = normName.split(/\s+/).filter(Boolean);
                if (parts.length > 0) {
                    const subParts = parts.map(part => {
                        return `(${sqlNormalize('p.Field_006')} LIKE N'%${part}%' OR ${sqlNormalize('p.Field_007')} LIKE N'%${part}%' OR ${sqlNormalize('t07.Field_006')} LIKE N'%${part}%')`;
                    });
                    conditions.push(`(${subParts.join(' AND ')})`);
                }
            } else {
                conditions.push(`${sqlNormalize('p.Field_006')} LIKE N'%${normName}%'`);
                conditions.push(`${sqlNormalize('p.Field_007')} LIKE N'%${normName}%'`);
                conditions.push(`${sqlNormalize('t07.Field_006')} LIKE N'%${normName}%'`);
            }

            whereClauses.push(`(${conditions.join(' OR ')})`);
        }

        const sql = `
            SELECT TOP 30
                t10.Field_001 as ArchiveCode,
                t10.Field_004 as SubSystem,
                t10.Field_005 as DocNo,
                t10.Field_006 as RemittanceNumber,
                t10.Field_008 as DocDate,
                RTRIM(LTRIM(t10.Field_009)) as DocType,
                t10.Field_010 as PersonCode,
                t10.Field_018 as StoreId,
                COALESCE(
                    NULLIF(RTRIM(LTRIM(COALESCE(p.Field_006, '') + ' ' + COALESCE(p.Field_007, ''))), ''),
                    NULLIF(RTRIM(LTRIM(t07.Field_006)), ''),
                    t10.Field_010,
                    N'طرف‌حساب نامشخص'
                ) as PersonFullName,
                p.Field_013 as PersonAddress
            FROM STR_TBL_010 t10
            LEFT JOIN GNR_TBL_001 p ON p.Field_003 = t10.Field_010 OR p.Field_005 = t10.Field_010
            LEFT JOIN ACT_TBL_007 t07 ON RTRIM(LTRIM(t10.Field_010)) = RTRIM(LTRIM(t07.Field_005)) AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY t10.Field_008 DESC, t10.Field_001 DESC
        `;

        const { executeSayanQuery } = await import('./backend/sayan.js').catch(e => require('./backend/sayan.js'));
        const headers = await executeSayanQuery(db, sql);
        
        res.json({ success: true, headers: headers || [] });
    } catch (e) {
        console.error("Explore Remittances Error:", e);
        res.status(500).json({ success: false, message: e.message, error: e.message });
    }
});

// Automatic Strict Match Endpoint
app.post('/api/sayan/sales-remittance/lookup', async (req, res) => {
    try {
        const db = getDb();
        const { personCode, recipientName, permitDate, permitNumber, docType } = req.body;

        if (!personCode && !recipientName && !permitNumber) {
            return res.status(400).json({ error: 'کد شخص، نام شخص یا شماره مجوز الزامی است' });
        }

        // Match conditions in STR_TBL_010
        let targetDocType = docType || 'all_exit'; // Default to 'all_exit' to look up only sales and exit remittances (12, 23)
        let whereClauses = [];
        if (targetDocType === 'all') {
            whereClauses.push("RTRIM(LTRIM(t10.Field_009)) IN ('12', '23', '3', '13')");
        } else if (targetDocType === 'all_exit') {
            whereClauses.push("RTRIM(LTRIM(t10.Field_009)) IN ('12', '23')");
        } else {
            whereClauses.push(`RTRIM(LTRIM(t10.Field_009)) = '${targetDocType.replace(/'/g, "''")}'`);
        }
        
        let pCode = personCode;
        let rName = recipientName;
        if (!pCode && rName) {
            const { cleanName, extractedCode } = extractCodeAndCleanName(rName);
            if (extractedCode) {
                pCode = extractedCode;
                rName = cleanName;
            }
        }

        // If there's a permitDate, it's an automatic lookup where we want STRICT matching of customer and date
        if (permitDate) {
            const gregDate = parseJalaliStrToGregorian(permitDate);
            if (gregDate) {
                whereClauses.push(`ABS(DATEDIFF(day, t10.Field_008, '${gregDate}')) <= 7`);
            } else {
                const sanitizedDate = String(permitDate).replace(/'/g, "''").trim();
                whereClauses.push(`ABS(DATEDIFF(day, t10.Field_008, '${sanitizedDate}')) <= 7`);
            }
        }

        let matchConditions = getSayanMatchConditions({ personCode: pCode, recipientName: rName, permitNumber });
        if (matchConditions.length > 0) {
            if (permitDate) {
                // Strict match: ALL provided constraints (Person AND Number) must match
                whereClauses.push(...matchConditions);
            } else {
                // Manual loose search: ANY of the provided constraints can match
                whereClauses.push(`(${matchConditions.join(' OR ')})`);
            }
        }

        const gregDate = permitDate ? parseJalaliStrToGregorian(permitDate) : null;
        const orderByClause = gregDate 
            ? `ABS(DATEDIFF(day, t10.Field_008, '${gregDate}')) ASC, t10.Field_008 DESC, t10.Field_001 DESC`
            : `t10.Field_008 DESC, t10.Field_001 DESC`;

        const queryHeaders = `
            SELECT TOP 10
                t10.Field_001 as ArchiveCode,
                t10.Field_004 as SubSystem,
                t10.Field_005 as DocNo,
                t10.Field_006 as RemittanceNumber,
                t10.Field_007 as SubCode,
                t10.Field_008 as DocDate,
                RTRIM(LTRIM(t10.Field_009)) as DocType,
                t10.Field_010 as PersonCode,
                t10.Field_018 as StoreId,
                t10.Field_029 as Note,
                COALESCE(
                    NULLIF(RTRIM(LTRIM(COALESCE(p.Field_006, '') + ' ' + COALESCE(p.Field_007, ''))), ''),
                    NULLIF(RTRIM(LTRIM(t07.Field_006)), ''),
                    t10.Field_010,
                    N'طرف‌حساب نامشخص'
                ) as PersonFullName,
                p.Field_013 as PersonAddress,
                p.Field_015 as PersonPhone
            FROM STR_TBL_010 t10
            LEFT JOIN GNR_TBL_001 p ON p.Field_003 = t10.Field_010 OR p.Field_005 = t10.Field_010
            LEFT JOIN ACT_TBL_007 t07 ON RTRIM(LTRIM(t10.Field_010)) = RTRIM(LTRIM(t07.Field_005)) AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
            WHERE ${whereClauses.join(' AND ')}
            ORDER BY ${orderByClause}
        `;

        const headers = await executeSayanQuery(db, queryHeaders);
        if (!headers || headers.length === 0) {
            return res.json({ success: false, message: 'هیچ حواله فروش مرتبطی در سایان یافت نشد' });
        }

        const h = headers[0];
        const queryDetails = `
            SELECT 
                t11.Field_001 as LineId,
                t11.Field_004 as DocNo,
                RTRIM(LTRIM(t11.Field_005)) as ItemCode,
                COALESCE(
                    NULLIF(RTRIM(LTRIM(s04.Field_003)), ''),
                    NULLIF(RTRIM(LTRIM(t22.Field_004)), ''),
                    NULLIF(RTRIM(LTRIM(t02.Field_003)), ''),
                    NULLIF(RTRIM(LTRIM(c01.Field_003)), ''),
                    NULLIF(RTRIM(LTRIM(t_name.ItemName)), ''),
                    RTRIM(LTRIM(t11.Field_005)),
                    N'کالای بدون نام'
                ) as ItemName,
                t11.Field_006 as NetQty,
                t11.Field_007 as UnitPrice,
                t11.Field_008 as TotalPrice,
                t11.Field_031 as DetailNote,
                t11.Field_034 as RowNo
            FROM STR_TBL_011 t11
            LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
            LEFT JOIN IND_TBL_021 t21 ON RTRIM(LTRIM(t21.Field_004)) = RTRIM(LTRIM(t11.Field_005))
            LEFT JOIN IND_TBL_002 t02 ON RTRIM(LTRIM(t02.Field_008)) = RTRIM(LTRIM(t21.Field_003)) OR RTRIM(LTRIM(t02.Field_008)) = RTRIM(LTRIM(t11.Field_005))
            LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
            LEFT JOIN COM_TBL_001 c01 ON RTRIM(LTRIM(c01.Field_004)) = RTRIM(LTRIM(t11.Field_005))
            LEFT JOIN (
                SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as ItemName
                FROM IND_TBL_021 t21_sub
                LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
                GROUP BY t21_sub.Field_004
            ) t_name ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_name.ItemCode))
            WHERE t11.Field_004 = '${h.DocNo}'
            ORDER BY t11.Field_034 ASC, t11.Field_001 ASC
        `;

        const detailRows = await executeSayanQuery(db, queryDetails);

        let totalNet = 0;
        let totalGross = 0;
        let totalCartons = 0;
        let totalBobbins = 0;

        const items = (detailRows || []).map((row, idx) => {
            const parsed = parseDetailNote(row.DetailNote);
            const netVal = parseFloat(row.NetQty || 0);
            const grossVal = parsed.grossWeight > 0 ? parsed.grossWeight : netVal;
            
            totalNet += netVal;
            totalGross += grossVal;
            totalCartons += parsed.cartonCount;
            totalBobbins += parsed.bobbinCount;

            return {
                lineId: String(row.LineId || ''),
                docNo: String(row.DocNo || ''),
                itemCode: String(row.ItemCode || ''),
                goodsName: String(row.ItemName || row.ItemCode || `کالا ${idx + 1}`),
                netQty: netVal,
                grossQty: grossVal,
                unitPrice: parseFloat(row.UnitPrice || 0),
                totalPrice: parseFloat(row.TotalPrice || 0),
                cartonCount: parsed.cartonCount,
                bobbinCount: parsed.bobbinCount,
                grade: parsed.grade,
                twistDirection: parsed.twistDirection,
                description: parsed.description,
                rowNo: parseInt(row.RowNo || (idx + 1), 10)
            };
        });

        // Shamsi Date conversion
        let shamsiDateStr = '';
        if (h.DocDate) {
            try {
                const d = new Date(h.DocDate);
                if (!isNaN(d.getTime())) {
                    const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
                    shamsiDateStr = `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
                }
            } catch (e) {}
        }

        const remittance = {
            archiveCode: String(h.ArchiveCode || ''),
            subSystem: String(h.SubSystem || ''),
            docNo: String(h.DocNo || ''),
            remittanceNumber: String(h.RemittanceNumber || h.DocNo || ''),
            subCode: String(h.SubCode || ''),
            docDate: h.DocDate || '',
            shamsiDate: shamsiDateStr,
            docType: String(h.DocType || ''),
            personCode: String(h.PersonCode || ''),
            personFullName: (h.PersonFullName || recipientName || '').trim(),
            personAddress: h.PersonAddress || '',
            personPhone: h.PersonPhone || '',
            storeId: String(h.StoreId || ''),
            note: h.Note || '',
            items,
            totalNetWeight: parseFloat(totalNet.toFixed(3)),
            totalGrossWeight: parseFloat(totalGross.toFixed(3)),
            totalCartons,
            totalBobbins
        };

        res.json({ success: true, remittance });
    } catch (e) {
        console.error("Sayan Remittance Lookup Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Auto-Sync and Finalize Exit Permit with Sayan Remittance
app.post('/api/sayan/exit-permits/:id/sync-remittance', async (req, res) => {
    try {
        const db = getDb();
        if (!db.exitPermits) db.exitPermits = [];
        const { id } = req.params;
        const { approverWarehouse, advanceToSecurity = true, customItems, remittanceData, attachmentDataUrl } = req.body;

        const idx = db.exitPermits.findIndex(p => p.id === id);
        if (idx === -1) {
            return res.status(404).json({ error: 'مجوز خروج مورد نظر یافت نشد' });
        }

        const permit = db.exitPermits[idx];
        let rem = remittanceData;

        // If not passed, lookup directly
        if (!rem) {
            let pCode = permit.sayanPersonCode || (permit.destinations?.[0]?.sayanPersonCode);
            let rName = permit.recipientName || (permit.destinations?.[0]?.recipientName);
            const pDate = permit.date;
            const pNum = permit.permitNumber;
            
            if (!pCode && rName) {
                const { cleanName, extractedCode } = extractCodeAndCleanName(rName);
                if (extractedCode) {
                    pCode = extractedCode;
                    rName = cleanName;
                }
            }
            
            let whereClauses = ["RTRIM(LTRIM(t10.Field_009)) IN ('12', '23')"];
            
            if (pDate) {
                const gregDate = parseJalaliStrToGregorian(pDate);
                if (gregDate) {
                    whereClauses.push(`ABS(DATEDIFF(day, t10.Field_008, '${gregDate}')) <= 5`);
                } else {
                    const sanitizedDate = String(pDate).replace(/'/g, "''").trim();
                    whereClauses.push(`ABS(DATEDIFF(day, t10.Field_008, '${sanitizedDate}')) <= 5`);
                }
            }

            // Utilize robust getSayanMatchConditions
            let matchConditions = getSayanMatchConditions({ personCode: pCode, recipientName: rName, permitNumber: pNum });
            if (matchConditions.length > 0) {
                whereClauses.push(...matchConditions);
            }

            const gregDateForOrder = pDate ? parseJalaliStrToGregorian(pDate) : null;
            const orderByClause = gregDateForOrder 
                ? `ABS(DATEDIFF(day, t10.Field_008, '${gregDateForOrder}')) ASC, t10.Field_008 DESC, t10.Field_001 DESC`
                : `t10.Field_008 DESC, t10.Field_001 DESC`;

            const queryHeaders = `
                SELECT TOP 1
                    t10.Field_001 as ArchiveCode,
                    t10.Field_004 as SubSystem,
                    t10.Field_005 as DocNo,
                    t10.Field_006 as RemittanceNumber,
                    t10.Field_007 as SubCode,
                    t10.Field_008 as DocDate,
                    t10.Field_009 as DocType,
                    t10.Field_010 as PersonCode,
                    t10.Field_018 as StoreId,
                    t10.Field_029 as Note,
                    COALESCE(p.Field_006, '') + ' ' + COALESCE(p.Field_007, '') as PersonFullName
                FROM STR_TBL_010 t10
                LEFT JOIN GNR_TBL_001 p ON p.Field_003 = t10.Field_010 OR p.Field_005 = t10.Field_010
                WHERE ${whereClauses.join(' AND ')}
                ORDER BY ${orderByClause}
            `;
                const foundHeaders = await executeSayanQuery(db, queryHeaders);
                if (foundHeaders && foundHeaders.length > 0) {
                    const fh = foundHeaders[0];
                    const queryDetails = `
                        SELECT 
                            t11.Field_001 as LineId,
                            t11.Field_004 as DocNo,
                            t11.Field_005 as ItemCode,
                            COALESCE(t02.Field_003, t22.Field_004, t21.Field_004, t11.Field_005) as ItemName,
                            t11.Field_006 as NetQty,
                            t11.Field_031 as DetailNote,
                            t11.Field_034 as RowNo
                        FROM STR_TBL_011 t11
                        LEFT JOIN IND_TBL_021 t21 ON RTRIM(LTRIM(t21.Field_004)) = RTRIM(LTRIM(t11.Field_005))
                        LEFT JOIN IND_TBL_002 t02 ON RTRIM(LTRIM(t02.Field_008)) = RTRIM(LTRIM(t21.Field_003))
                        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
                        WHERE t11.Field_004 = '${fh.DocNo}' AND t11.Field_012 = '${fh.StoreId}' AND t11.Field_036 = '${fh.DocType}'
                        ORDER BY t11.Field_034 ASC, t11.Field_001 ASC
                    `;
                    const fDetails = await executeSayanQuery(db, queryDetails);
                    let tNet = 0, tGross = 0, tCart = 0, tBob = 0;
                    const parsedItems = (fDetails || []).map((row, idx) => {
                        const parsed = parseDetailNote(row.DetailNote);
                        const netVal = parseFloat(row.NetQty || 0);
                        const grossVal = parsed.grossWeight > 0 ? parsed.grossWeight : netVal;
                        tNet += netVal;
                        tGross += grossVal;
                        tCart += parsed.cartonCount;
                        tBob += parsed.bobbinCount;
                        return {
                            goodsName: String(row.ItemName || row.ItemCode || `کالا ${idx + 1}`),
                            netQty: netVal,
                            grossQty: grossVal,
                            cartonCount: parsed.cartonCount,
                            bobbinCount: parsed.bobbinCount,
                            grade: parsed.grade,
                            twistDirection: parsed.twistDirection,
                            description: parsed.description,
                            itemCode: row.ItemCode
                        };
                    });

                    let shamsi = '';
                    if (fh.DocDate) {
                        try {
                            const d = new Date(fh.DocDate);
                            const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
                            shamsi = `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
                        } catch (e) {}
                    }

                    rem = {
                        archiveCode: String(fh.ArchiveCode || ''),
                        remittanceNumber: String(fh.RemittanceNumber || fh.DocNo || ''),
                        subCode: String(fh.SubCode || ''),
                        shamsiDate: shamsi,
                        personFullName: fh.PersonFullName || rName,
                        items: parsedItems,
                        totalNetWeight: tNet,
                        totalGrossWeight: tGross,
                        totalCartons: tCart,
                        totalBobbins: tBob
                    };
                }
            }

        // Apply to permit
        if (rem) {
            permit.sayanRemittanceNumber = String(rem.remittanceNumber || '');
            permit.sayanSubCode = String(rem.subCode || '');
            permit.sayanArchiveCode = String(rem.archiveCode || '');
            permit.sayanSyncedAt = Date.now();
            permit.sayanRemittanceDoc = rem;

            // Update items if available from Sayan
            if (Array.isArray(rem.items) && rem.items.length > 0) {
                permit.items = rem.items.map((it, i) => ({
                    id: permit.items?.[i]?.id || `sayan-${Date.now()}-${i}`,
                    goodsName: it.goodsName || `کالا ${i + 1}`,
                    cartonCount: it.cartonCount || 0,
                    weight: it.netQty || it.weight || 0,
                    deliveredCartonCount: it.cartonCount || 0,
                    deliveredWeight: it.netQty || it.weight || 0,
                    grossWeight: it.grossQty || it.grossWeight || it.netQty || 0,
                    bobbinCount: it.bobbinCount || 0,
                    grade: it.grade || 'AA',
                    twistDirection: it.twistDirection || 'Z',
                    itemCode: it.itemCode || '',
                    description: it.description || ''
                }));
                permit.cartonCount = rem.totalCartons || permit.items.reduce((s, x) => s + (x.cartonCount || 0), 0);
                permit.weight = rem.totalNetWeight || permit.items.reduce((s, x) => s + (x.weight || 0), 0);
            }
        }

        if (attachmentDataUrl) {
            permit.attachments = permit.attachments || [];
            const fileName = `حواله_فروش_سایان_${permit.sayanRemittanceNumber || permit.permitNumber}.png`;
            permit.attachments = permit.attachments.filter(a => !a.fileName.includes('حواله_فروش_سایان'));
            permit.attachments.push({
                fileName,
                data: attachmentDataUrl
            });
        }

        if (approverWarehouse) {
            permit.approverWarehouse = approverWarehouse;
        }

        if (advanceToSecurity) {
            permit.status = 'در انتظار خروج (انتظامات)'; // PENDING_SECURITY
        }

        permit.updatedAt = Date.now();
        db.exitPermits[idx] = permit;
        saveDb(db);

        // Background Bot Notification
        setImmediate(async () => {
            try {
                const refreshedDb = getDb();
                await notifyExitPermitStep(permit, null, approverWarehouse, null, refreshedDb, 'تایید انبار با اتصال سایان', 'WAREHOUSE');
            } catch (err) {
                console.error("Background notifyExitPermitStep error on sync-remittance:", err);
            }
        });

        res.json({ success: true, permit });
    } catch (e) {
        console.error("Sayan Exit Permit Sync Error:", e);
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

// WEB PUSH SUBSCRIPTION ENDPOINTS
const getVapidKeyHandler = (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
};
app.get('/api/vapid-key', getVapidKeyHandler);
app.get('/vapid-key', getVapidKeyHandler);

const subscribeHandler = (req, res) => {
    try {
        const db = getDb();
        if (!db.subscriptions) db.subscriptions = [];
        const body = req.body || {};
        
        const endpoint = body.endpoint || (body.subscription && body.subscription.endpoint) || body.token;
        if (!endpoint) {
            return res.status(400).json({ error: 'Endpoint or token is required' });
        }
        
        const existingIdx = db.subscriptions.findIndex(s => s.endpoint === endpoint || (s.subscription && s.subscription.endpoint === endpoint));
        
        const subObject = body.subscription || (body.endpoint && body.keys ? { endpoint: body.endpoint, keys: body.keys } : null);
        
        const record = {
            endpoint: endpoint,
            subscription: subObject,
            username: body.username || null,
            role: body.role || null,
            deviceType: body.deviceType || body.type || 'web',
            token: body.token || null,
            updatedAt: Date.now()
        };
        
        if (existingIdx > -1) {
            db.subscriptions[existingIdx] = { ...db.subscriptions[existingIdx], ...record };
        } else {
            db.subscriptions.push(record);
        }
        
        saveDb(db);
        res.json({ success: true, subscriptionsCount: db.subscriptions.length });
    } catch (e) {
        console.error("Subscribe endpoint error:", e);
        res.status(500).json({ error: "Failed to subscribe" });
    }
};
app.post('/api/subscribe', subscribeHandler);
app.post('/subscribe', subscribeHandler);

const unsubscribeHandler = (req, res) => {
    try {
        const db = getDb();
        if (!db.subscriptions) db.subscriptions = [];
        const { endpoint, username } = req.body || {};
        
        if (endpoint) {
            db.subscriptions = db.subscriptions.filter(s => s.endpoint !== endpoint && (!s.subscription || s.subscription.endpoint !== endpoint));
        } else if (username) {
            db.subscriptions = db.subscriptions.filter(s => s.username !== username);
        }
        saveDb(db);
        res.json({ success: true });
    } catch (e) {
        console.error("Unsubscribe endpoint error:", e);
        res.status(500).json({ error: "Failed to unsubscribe" });
    }
};
app.post('/api/unsubscribe', unsubscribeHandler);
app.post('/unsubscribe', unsubscribeHandler);

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

// --- IN-APP & WEBPUSH NOTIFICATION ENGINE ---
export async function broadcastNotification(title, body, url = null, targetRoles = null, targetUsernames = null, excludeUsernames = null) {
    try {
        const db = getDb();
        if (!db.notifications) db.notifications = [];

        const notif = {
            id: utils.generateUUID ? utils.generateUUID() : Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            title,
            body,
            url,
            targetRoles: targetRoles ? (Array.isArray(targetRoles) ? targetRoles : [targetRoles]) : null,
            targetUsernames: targetUsernames ? (Array.isArray(targetUsernames) ? targetUsernames : [targetUsernames]) : null,
            excludeUsernames: excludeUsernames ? (Array.isArray(excludeUsernames) ? excludeUsernames : [excludeUsernames]) : null,
            createdAt: Date.now(),
            readBy: []
        };

        db.notifications.push(notif);
        if (db.notifications.length > 1000) {
            db.notifications = db.notifications.slice(-500);
        }
        saveDb(db);

        if (db.subscriptions && Array.isArray(db.subscriptions) && db.subscriptions.length > 0) {
            const payload = JSON.stringify({ title, body, url, id: notif.id });
            const targetRolesArray = targetRoles ? (Array.isArray(targetRoles) ? targetRoles : [targetRoles]) : null;
            const targetUsernamesArray = targetUsernames ? (Array.isArray(targetUsernames) ? targetUsernames : [targetUsernames]) : null;
            const excludeUsernamesArray = excludeUsernames ? (Array.isArray(excludeUsernames) ? excludeUsernames : [excludeUsernames]) : null;

            const lowerRoles = targetRolesArray ? targetRolesArray.map(r => String(r).toLowerCase()) : null;
            const lowerTargets = targetUsernamesArray ? targetUsernamesArray.map(u => String(u).toLowerCase()) : null;
            const lowerExcludes = excludeUsernamesArray ? excludeUsernamesArray.map(u => String(u).toLowerCase()) : [];

            db.subscriptions.forEach(sub => {
                const subUsername = sub.username ? String(sub.username).toLowerCase() : null;
                const subRole = sub.role ? String(sub.role).toLowerCase() : null;

                // 1. Excluded User Guard: Never send to the actor/sender
                if (subUsername && lowerExcludes.includes(subUsername)) {
                    return;
                }

                // 2. Flexible Permission & Cartable Guard:
                const hasRoleRestriction = lowerRoles && lowerRoles.length > 0;
                const hasTargetRestriction = lowerTargets && lowerTargets.length > 0;

                let isMatch = false;

                if (!hasRoleRestriction && !hasTargetRestriction) {
                    // No restrictions defined -> General broadcast to ALL users (e.g., Production Meetings, Public Chat)
                    isMatch = true;
                } else {
                    // Targeted User Match: If the item is in the user's cartable / specifically for them, notify them regardless of role
                    if (hasTargetRestriction && subUsername && lowerTargets.includes(subUsername)) {
                        isMatch = true;
                    }
                    // Role Match: If the user holds an authorized role for this module
                    if (hasRoleRestriction && subRole && lowerRoles.includes(subRole)) {
                        isMatch = true;
                    }
                }

                if (!isMatch) {
                    return; // Skip if neither directly targeted nor holding an allowed role
                }

                // 3. Dispatch Web Push
                const pushSub = sub.subscription || (sub.endpoint && sub.keys ? { endpoint: sub.endpoint, keys: sub.keys } : null);
                if (pushSub && pushSub.endpoint) {
                    webpush.sendNotification(pushSub, payload).catch(err => {
                        console.warn("WebPush send error for endpoint:", sub.endpoint, err.message);
                        if (err.statusCode === 404 || err.statusCode === 410) {
                            db.subscriptions = db.subscriptions.filter(s => s.endpoint !== sub.endpoint);
                            saveDb(db);
                        }
                    });
                }
            });
        }
        return notif;
    } catch (e) {
        console.error("broadcastNotification error:", e);
    }
}

app.get('/api/notifications', (req, res) => {
    try {
        const db = getDb();
        const username = req.query.username;
        const role = req.query.role;
        const list = db.notifications || [];

        if (!username && !role) {
            return res.json(list.slice(-100));
        }

        const filtered = list.filter(n => {
            if (n.deletedForUsernames && Array.isArray(n.deletedForUsernames) && n.deletedForUsernames.includes(username)) {
                return false;
            }
            if (n.excludeUsernames && Array.isArray(n.excludeUsernames) && n.excludeUsernames.includes(username)) {
                return false;
            }
            let matchRole = true;
            if (n.targetRoles && Array.isArray(n.targetRoles) && n.targetRoles.length > 0) {
                matchRole = role ? n.targetRoles.includes(role) : true;
            }
            let matchUser = true;
            if (n.targetUsernames && Array.isArray(n.targetUsernames) && n.targetUsernames.length > 0) {
                matchUser = username ? n.targetUsernames.includes(username) : true;
            }
            return matchRole && matchUser;
        });

        const result = filtered.slice(-100).map(n => ({
            ...n,
            read: Array.isArray(n.readBy) ? n.readBy.includes(username) : false
        }));

        res.json(result);
    } catch (e) {
        console.error("GET /api/notifications error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/notifications/read', (req, res) => {
    try {
        const db = getDb();
        const { username, id } = req.body;
        if (!db.notifications) db.notifications = [];

        if (id === 'all') {
            db.notifications.forEach(n => {
                if (!n.readBy) n.readBy = [];
                if (username && !n.readBy.includes(username)) n.readBy.push(username);
            });
        } else if (id) {
            const notif = db.notifications.find(n => n.id === id);
            if (notif) {
                if (!notif.readBy) notif.readBy = [];
                if (username && !notif.readBy.includes(username)) notif.readBy.push(username);
            }
        }
        saveDb(db);
        res.json({ success: true });
    } catch (e) {
        console.error("POST /api/notifications/read error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/notifications/delete', (req, res) => {
    try {
        const db = getDb();
        const { username, id } = req.body;
        if (!db.notifications) db.notifications = [];

        if (id === 'all') {
            db.notifications.forEach(n => {
                if (!n.deletedForUsernames) n.deletedForUsernames = [];
                if (username && !n.deletedForUsernames.includes(username)) n.deletedForUsernames.push(username);
            });
        } else if (id) {
            const notif = db.notifications.find(n => n.id === id);
            if (notif) {
                if (!notif.deletedForUsernames) n.deletedForUsernames = [];
                if (username && !notif.deletedForUsernames.includes(username)) n.deletedForUsernames.push(username);
            }
        }
        saveDb(db);
        res.json({ success: true });
    } catch (e) {
        console.error("POST /api/notifications/delete error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/notifications/add', async (req, res) => {
    try {
        const { title, body, url, targetRoles, targetUsernames, excludeUsernames } = req.body;
        const notif = await broadcastNotification(title, body, url, targetRoles, targetUsernames, excludeUsernames);
        res.json({ success: true, notification: notif });
    } catch (e) {
        console.error("POST /api/notifications/add error:", e);
        res.status(500).json({ error: e.message });
    }
});

// 8. CHAT & COMMUNICATION
app.get('/api/chat', (req, res) => {
    res.json(getDb().messages || []);
});

app.post('/api/chat/read-batch', (req, res) => {
    const db = getDb();
    const { username, messageIds } = req.body;
    if (!username || !Array.isArray(messageIds)) {
        return res.status(400).json({ error: 'Username and messageIds required' });
    }
    const idSet = new Set(messageIds);
    let changed = false;
    (db.messages || []).forEach(m => {
        if (idSet.has(m.id)) {
            if (!m.readBy) m.readBy = [];
            if (!m.readBy.includes(username)) {
                m.readBy.push(username);
                changed = true;
            }
        }
    });
    if (changed) saveDb(db);
    res.json({ success: true, count: messageIds.length });
});

app.post('/api/chat/read-all', (req, res) => {
    const db = getDb();
    const { username, channelId, type } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });
    
    let changed = false;
    (db.messages || []).forEach(m => {
        if (m.senderUsername?.toLowerCase() === username.toLowerCase()) return;
        if (m.readBy?.includes(username)) return;

        let shouldMark = false;
        if (!channelId || channelId === 'all') {
            shouldMark = true;
        } else if (type === 'public' || channelId === 'public') {
            shouldMark = (!m.recipient && !m.groupId);
        } else if (type === 'private') {
            shouldMark = (m.senderUsername?.toLowerCase() === channelId?.toLowerCase() && m.recipient?.toLowerCase() === username.toLowerCase());
        } else if (type === 'group' || type === 'task_group') {
            shouldMark = (m.groupId === channelId);
        }

        if (shouldMark) {
            if (!m.readBy) m.readBy = [];
            m.readBy.push(username);
            changed = true;
        }
    });
    if (changed) saveDb(db);
    res.json({ success: true });
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
            const targetUser = db.users?.find(u => 
                (u.username && u.username.toLowerCase() === msg.recipient.toLowerCase()) || 
                (u.fullName && u.fullName.toLowerCase() === msg.recipient.toLowerCase())
            );
            const targets = [msg.recipient];
            if (targetUser) {
                if (targetUser.username && !targets.includes(targetUser.username)) targets.push(targetUser.username);
                if (targetUser.fullName && !targets.includes(targetUser.fullName)) targets.push(targetUser.fullName);
            }
            broadcastNotification(
                `پیام از ${msg.sender}`,
                `${msg.sender}: ${msg.message || (msg.audioUrl ? '🎤 پیام صوتی' : '📎 فایل')}`,
                `/chat?pv=${msg.senderUsername}`,
                null,
                targets,
                [msg.senderUsername] // Exclude sender
            );
        } else if (msg.groupId) {
            const group = db.groups?.find(g => g.id === msg.groupId) || db.taskGroups?.find(g => g.id === msg.groupId);
            if (group) {
                const memberList = Array.isArray(group.members) ? [...group.members] : [];
                if (group.createdBy && !memberList.includes(group.createdBy)) memberList.push(group.createdBy);
                broadcastNotification(
                    `${group.name}`,
                    `${msg.sender}: ${msg.message || (msg.audioUrl ? '🎤 پیام صوتی' : '📎 فایل')}`,
                    `/chat?group=${msg.groupId}`,
                    null,
                    memberList.filter(m => String(m).toLowerCase() !== String(msg.senderUsername).toLowerCase()),
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
    
    // Automatically re-initialize bots and schedule cron jobs on settings save
    try {
        setupDailyReports();
    } catch (e) {
        console.error("Failed to run setupDailyReports from settings save:", e);
    }

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
            broadcastNotification(
                `✨ اعلان برگزاری جلسه تولید #${meeting.meetingNumber || ''}`,
                `جلسه تولید شماره ${meeting.meetingNumber || ''} روز ${meeting.date || ''} ساعت ${meeting.time || '۱۲:۰۰'} برگزار می‌شود.`,
                '/production-meetings',
                null, // targetRoles = null -> broadcast to ALL
                null  // targetUsernames = null -> broadcast to ALL
            );
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
            broadcastNotification(
                `📝 ارسال صورتجلسه تولید #${meeting.meetingNumber || ''}`,
                `صورتجلسه شماره ${meeting.meetingNumber || ''} ثبت و ابلاغ گردید.`,
                '/production-meetings',
                null, // targetRoles = null -> broadcast to ALL
                null  // targetUsernames = null -> broadcast to ALL
            );
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
    { route: 'security/logs', dbKey: 'securityLogs' },
    { route: 'security/delays', dbKey: 'personnelDelays' },
    { route: 'security/incidents', dbKey: 'securityIncidents' },
    { route: 'warehouse/items', dbKey: 'warehouseItems' },
    { route: 'trade', dbKey: 'tradeRecords' },
    { route: 'notes', dbKey: 'notes' },
    { route: 'meetings', dbKey: 'meetings' },
    { route: 'part-master-data', dbKey: 'partMasterData' },
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

// Dedicated Payment Orders Endpoints with Automated Notifications
app.get('/api/orders', (req, res) => {
    const db = getDb();
    res.json(db.orders || []);
});

app.post('/api/orders', async (req, res) => {
    try {
        const db = getDb();
        if (!db.orders) db.orders = [];
        const item = req.body;
        if (!item.fiscalYearId && db.settings?.activeFiscalYearId) {
            item.fiscalYearId = db.settings.activeFiscalYearId;
        }
        if (!item.createdAt) item.createdAt = Date.now();

        const existingIdx = db.orders.findIndex(x => x.id === item.id);
        const isEdit = existingIdx > -1;

        if (isEdit) {
            db.orders[existingIdx] = { ...db.orders[existingIdx], ...item };
        } else {
            db.orders.push(item);
        }
        saveDb(db);
        res.json(db.orders);

        setImmediate(async () => {
            try {
                const freshDb = getDb();
                const order = (freshDb.orders || []).find(x => x.id === item.id) || item;
                const eventType = isEdit ? 'EDIT' : 'CREATE';
                const stepName = isEdit ? 'ویرایش دستور پرداخت' : 'ثبت اولیه';
                
                await notifyPaymentOrderStep(order, freshDb, stepName, false, eventType);

                const totalFormatted = Number(order.totalAmount || 0).toLocaleString();
                await broadcastNotification(
                    isEdit ? `✏️ ویرایش دستور پرداخت #${order.trackingNumber || order.id}` : `💸 دستور پرداخت جدید #${order.trackingNumber || order.id}`,
                    `شرکت: ${order.payingCompany || '-'} | درخواست‌کننده: ${order.requester || '-'} | مبلغ: ${totalFormatted} ریال | ذینفع: ${order.payee || '-'}`,
                    '/manage',
                    ['admin', 'financial', 'manager', 'ceo'],
                    null,
                    order.requester ? [order.requester] : null
                );
            } catch (err) {
                console.error("Background notifyPaymentOrderStep error on POST /api/orders:", err);
            }
        });
    } catch (e) {
        console.error("POST /api/orders error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/orders/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db.orders) db.orders = [];
        const idx = db.orders.findIndex(x => x.id === req.params.id);
        const isEdit = req.body.isEdit || false;
        let updatedItem;

        if (idx > -1) {
            db.orders[idx] = { ...db.orders[idx], ...req.body };
            updatedItem = db.orders[idx];
        } else {
            updatedItem = { id: req.params.id, ...req.body };
            db.orders.push(updatedItem);
        }
        saveDb(db);
        res.json(db.orders);

        setImmediate(async () => {
            try {
                const freshDb = getDb();
                const order = (freshDb.orders || []).find(x => x.id === req.params.id) || updatedItem;
                const eventType = isEdit ? 'EDIT' : 'STEP';
                const stepName = isEdit ? 'ویرایش دستور پرداخت' : (order.status || 'بروزرسانی وضعیت');
                const isFinal = order.status === 'پرداخت شده' || order.status === 'تایید مدیرعامل';

                await notifyPaymentOrderStep(order, freshDb, stepName, isFinal, eventType);

                const totalFormatted = Number(order.totalAmount || 0).toLocaleString();
                await broadcastNotification(
                    `🔄 بروزرسانی دستور پرداخت #${order.trackingNumber || order.id}`,
                    `مرحله: ${stepName} | شرکت: ${order.payingCompany || '-'} | مبلغ: ${totalFormatted} ریال | ذینفع: ${order.payee || '-'}`,
                    '/manage',
                    ['admin', 'financial', 'manager', 'ceo'],
                    null,
                    null
                );
            } catch (err) {
                console.error("Background notifyPaymentOrderStep error on PUT /api/orders:", err);
            }
        });
    } catch (e) {
        console.error("PUT /api/orders error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/orders/:id', (req, res) => {
    try {
        const db = getDb();
        if (!db.orders) db.orders = [];
        const orderToDelete = db.orders.find(x => x.id === req.params.id);
        db.orders = db.orders.filter(x => x.id !== req.params.id);
        saveDb(db);
        res.json(db.orders);

        if (orderToDelete) {
            setImmediate(async () => {
                try {
                    const freshDb = getDb();
                    await notifyPaymentOrderStep(orderToDelete, freshDb, 'حذف دستور پرداخت', false, 'DELETE');
                    await broadcastNotification(
                        `❌ حذف دستور پرداخت #${orderToDelete.trackingNumber || orderToDelete.id}`,
                        `دستور پرداخت مربوط به ${orderToDelete.payee || '-'} حذف گردید.`,
                        '/manage',
                        ['admin', 'financial', 'manager', 'ceo']
                    );
                } catch (err) {
                    console.error("Background notifyPaymentOrderStep error on DELETE /api/orders:", err);
                }
            });
        }
    } catch (e) {
        console.error("DELETE /api/orders error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Dedicated Warehouse Transactions / Bijak Endpoints with Automated Notifications
app.get('/api/warehouse/transactions', (req, res) => {
    const db = getDb();
    res.json(db.warehouseTransactions || []);
});

app.post('/api/warehouse/transactions', async (req, res) => {
    try {
        const db = getDb();
        if (!db.warehouseTransactions) db.warehouseTransactions = [];
        const item = req.body;
        if (!item.createdAt) item.createdAt = Date.now();

        const existingIdx = db.warehouseTransactions.findIndex(x => x.id === item.id);
        const isEdit = existingIdx > -1;

        if (isEdit) {
            db.warehouseTransactions[existingIdx] = { ...db.warehouseTransactions[existingIdx], ...item };
        } else {
            db.warehouseTransactions.push(item);
        }
        saveDb(db);
        res.json(db.warehouseTransactions);

        setImmediate(async () => {
            try {
                const freshDb = getDb();
                const tx = (freshDb.warehouseTransactions || []).find(x => x.id === item.id) || item;
                const eventType = isEdit ? 'EDIT' : 'CREATE';
                const stepName = isEdit ? 'ویرایش حواله انبار' : 'ثبت اولیه';

                await notifyWarehouseBijak(tx, freshDb, stepName, eventType);

                const isOut = tx.type === 'OUT';
                const title = isOut ? `🚨 حواله خروج انبار (بیجک) #${tx.number}` : `📥 حواله ورود انبار #${tx.number}`;
                await broadcastNotification(
                    title,
                    `شرکت: ${tx.company || '-'} | تحویل‌گیرنده/دهنده: ${tx.delivererOrReceiver || '-'} | وضعیت: ${tx.status || 'در انتظار'}`,
                    '/warehouse',
                    ['admin', 'warehouse', 'factory_manager', 'ceo', 'manager'],
                    null,
                    tx.createdBy ? [tx.createdBy] : null
                );
            } catch (err) {
                console.error("Background notifyWarehouseBijak error on POST /api/warehouse/transactions:", err);
            }
        });
    } catch (e) {
        console.error("POST /api/warehouse/transactions error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/warehouse/transactions/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db.warehouseTransactions) db.warehouseTransactions = [];
        const idx = db.warehouseTransactions.findIndex(x => x.id === req.params.id);
        const isEdit = req.body.isEdit || false;
        let updatedItem;

        if (idx > -1) {
            db.warehouseTransactions[idx] = { ...db.warehouseTransactions[idx], ...req.body };
            updatedItem = db.warehouseTransactions[idx];
        } else {
            updatedItem = { id: req.params.id, ...req.body };
            db.warehouseTransactions.push(updatedItem);
        }
        saveDb(db);
        res.json(db.warehouseTransactions);

        setImmediate(async () => {
            try {
                const freshDb = getDb();
                const tx = (freshDb.warehouseTransactions || []).find(x => x.id === req.params.id) || updatedItem;
                const eventType = isEdit ? 'EDIT' : 'STEP';
                const stepName = isEdit ? 'ویرایش حواله انبار' : (tx.status || 'بروزرسانی وضعیت');

                await notifyWarehouseBijak(tx, freshDb, stepName, eventType);

                const isOut = tx.type === 'OUT';
                const title = isOut ? `🔄 بروزرسانی حواله خروج (بیجک) #${tx.number}` : `🔄 بروزرسانی ورود انبار #${tx.number}`;
                await broadcastNotification(
                    title,
                    `مرحله: ${stepName} | شرکت: ${tx.company || '-'} | تحویل‌گیرنده/دهنده: ${tx.delivererOrReceiver || '-'}`,
                    '/warehouse',
                    ['admin', 'warehouse', 'factory_manager', 'ceo', 'manager'],
                    null,
                    null
                );
            } catch (err) {
                console.error("Background notifyWarehouseBijak error on PUT /api/warehouse/transactions:", err);
            }
        });
    } catch (e) {
        console.error("PUT /api/warehouse/transactions error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/warehouse/transactions/:id', (req, res) => {
    try {
        const db = getDb();
        if (!db.warehouseTransactions) db.warehouseTransactions = [];
        const txToDelete = db.warehouseTransactions.find(x => x.id === req.params.id);
        db.warehouseTransactions = db.warehouseTransactions.filter(x => x.id !== req.params.id);
        saveDb(db);
        res.json(db.warehouseTransactions);

        if (txToDelete) {
            setImmediate(async () => {
                try {
                    const freshDb = getDb();
                    await notifyWarehouseBijak(txToDelete, freshDb, 'حذف بیجک/حواله', 'DELETE');
                    await broadcastNotification(
                        `❌ حذف حواله/بیجک انبار #${txToDelete.number}`,
                        `سند انبار شماره ${txToDelete.number} مربوط به شرکت ${txToDelete.company || '-'} حذف گردید.`,
                        '/warehouse',
                        ['admin', 'warehouse', 'factory_manager', 'ceo', 'manager']
                    );
                } catch (err) {
                    console.error("Background notifyWarehouseBijak error on DELETE /api/warehouse/transactions:", err);
                }
            });
        }
    } catch (e) {
        console.error("DELETE /api/warehouse/transactions error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Dedicated Purchase Requests Endpoints with Automated Notifications
app.get('/api/purchase-requests', (req, res) => {
    const db = getDb();
    res.json(db.purchaseRequests || []);
});

app.post('/api/purchase-requests', async (req, res) => {
    try {
        const db = getDb();
        if (!db.purchaseRequests) db.purchaseRequests = [];
        const item = req.body;
        if (!item.createdAt) item.createdAt = Date.now();

        const existingIdx = db.purchaseRequests.findIndex(x => x.id === item.id);
        const isEdit = existingIdx > -1;

        if (isEdit) {
            db.purchaseRequests[existingIdx] = { ...db.purchaseRequests[existingIdx], ...item };
        } else {
            db.purchaseRequests.push(item);
        }
        saveDb(db);
        res.json(db.purchaseRequests);

        setImmediate(async () => {
            try {
                const freshDb = getDb();
                const reqItem = (freshDb.purchaseRequests || []).find(x => x.id === item.id) || item;
                const eventType = isEdit ? 'EDIT' : 'CREATE';
                const stepName = isEdit ? 'ویرایش درخواست خرید' : 'ثبت اولیه';

                await notifyPurchaseRequestStep(reqItem, null, null, null, freshDb, stepName, eventType);
                await broadcastNotification(
                    isEdit ? `✏️ ویرایش درخواست خرید #${reqItem.requestNumber || reqItem.id}` : `🛒 درخواست خرید جدید #${reqItem.requestNumber || reqItem.id}`,
                    `عنوان: ${reqItem.title || '-'} | درخواست‌کننده: ${reqItem.requester || '-'} | شرکت: ${reqItem.company || '-'}`,
                    '/purchase',
                    ['admin', 'ceo', 'manager', 'commercial', 'financial'],
                    null,
                    reqItem.requester ? [reqItem.requester] : null
                );
            } catch (err) {
                console.error("Background notifyPurchaseRequestStep error:", err);
            }
        });
    } catch (e) {
        console.error("POST /api/purchase-requests error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/purchase-requests/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db.purchaseRequests) db.purchaseRequests = [];
        const idx = db.purchaseRequests.findIndex(x => x.id === req.params.id);
        const isEdit = req.body.isEdit || false;
        let updatedItem;

        if (idx > -1) {
            db.purchaseRequests[idx] = { ...db.purchaseRequests[idx], ...req.body };
            updatedItem = db.purchaseRequests[idx];
        } else {
            updatedItem = { id: req.params.id, ...req.body };
            db.purchaseRequests.push(updatedItem);
        }
        saveDb(db);
        res.json(db.purchaseRequests);

        setImmediate(async () => {
            try {
                const freshDb = getDb();
                const reqItem = (freshDb.purchaseRequests || []).find(x => x.id === req.params.id) || updatedItem;
                const eventType = isEdit ? 'EDIT' : 'STEP';
                const stepName = isEdit ? 'ویرایش درخواست خرید' : (reqItem.status || 'بروزرسانی وضعیت');

                const targets = Array.from(new Set([reqItem.requester, reqItem.username, reqItem.createdBy].filter(Boolean)));

                await notifyPurchaseRequestStep(reqItem, null, null, null, freshDb, stepName, eventType);
                await broadcastNotification(
                    `🔄 بروزرسانی درخواست خرید #${reqItem.requestNumber || reqItem.id}`,
                    `وضعیت/مرحله: ${stepName} | عنوان: ${reqItem.title || '-'}`,
                    '/purchase',
                    ['admin', 'ceo', 'manager', 'commercial', 'financial'],
                    targets.length > 0 ? targets : null
                );
            } catch (err) {
                console.error("Background notifyPurchaseRequestStep error:", err);
            }
        });
    } catch (e) {
        console.error("PUT /api/purchase-requests error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/purchase-requests/:id', (req, res) => {
    try {
        const db = getDb();
        if (!db.purchaseRequests) db.purchaseRequests = [];
        const itemToDelete = db.purchaseRequests.find(x => x.id === req.params.id);
        db.purchaseRequests = db.purchaseRequests.filter(x => x.id !== req.params.id);
        saveDb(db);
        res.json(db.purchaseRequests);

        if (itemToDelete) {
            setImmediate(async () => {
                try {
                    const freshDb = getDb();
                    await notifyPurchaseRequestStep(itemToDelete, null, null, null, freshDb, 'حذف درخواست خرید', 'DELETE');
                    await broadcastNotification(
                        `❌ حذف درخواست خرید #${itemToDelete.requestNumber || itemToDelete.id}`,
                        `درخواست خرید با عنوان "${itemToDelete.title || '-'}" حذف شد.`,
                        '/purchase',
                        ['admin', 'ceo', 'manager', 'commercial', 'financial']
                    );
                } catch (err) {
                    console.error("Background notifyPurchaseRequestStep delete error:", err);
                }
            });
        }
    } catch (e) {
        console.error("DELETE /api/purchase-requests error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Dedicated Secretariat Letters Endpoints with Automated Notifications
app.get('/api/secretariat-letters', (req, res) => {
    const db = getDb();
    res.json(db.secretariatLetters || []);
});

app.post('/api/secretariat-letters', async (req, res) => {
    try {
        const db = getDb();
        if (!db.secretariatLetters) db.secretariatLetters = [];
        const item = req.body;
        if (!item.createdAt) item.createdAt = Date.now();

        const existingIdx = db.secretariatLetters.findIndex(x => x.id === item.id);
        const isEdit = existingIdx > -1;

        if (isEdit) {
            db.secretariatLetters[existingIdx] = { ...db.secretariatLetters[existingIdx], ...item };
        } else {
            db.secretariatLetters.push(item);
        }
        saveDb(db);
        res.json(db.secretariatLetters);

        setImmediate(async () => {
            try {
                const freshDb = getDb();
                const letter = (freshDb.secretariatLetters || []).find(x => x.id === item.id) || item;
                const targets = Array.from(new Set([letter.sender, letter.receiver, letter.createdBy, letter.assignedTo].filter(Boolean)));
                await notifySecretariatLetter(letter, freshDb);
                await broadcastNotification(
                    `✉️ نامه اداری جدید #${letter.letterNumber}`,
                    `موضوع: ${letter.subject || '-'} | فرستنده: ${letter.sender || '-'} | گیرنده: ${letter.receiver || '-'}`,
                    '/secretariat',
                    ['admin', 'ceo', 'manager', 'office'],
                    targets.length > 0 ? targets : null
                );
            } catch (err) {
                console.error("Background notifySecretariatLetter error:", err);
            }
        });
    } catch (e) {
        console.error("POST /api/secretariat-letters error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/secretariat-letters/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db.secretariatLetters) db.secretariatLetters = [];
        const idx = db.secretariatLetters.findIndex(x => x.id === req.params.id);
        let updatedItem;

        if (idx > -1) {
            db.secretariatLetters[idx] = { ...db.secretariatLetters[idx], ...req.body };
            updatedItem = db.secretariatLetters[idx];
        } else {
            updatedItem = { id: req.params.id, ...req.body };
            db.secretariatLetters.push(updatedItem);
        }
        saveDb(db);
        res.json(db.secretariatLetters);

        setImmediate(async () => {
            try {
                const freshDb = getDb();
                const letter = (freshDb.secretariatLetters || []).find(x => x.id === req.params.id) || updatedItem;
                const targets = Array.from(new Set([letter.sender, letter.receiver, letter.createdBy, letter.assignedTo].filter(Boolean)));
                await notifySecretariatLetter(letter, freshDb);
                await broadcastNotification(
                    `🔄 بروزرسانی نامه اداری #${letter.letterNumber}`,
                    `موضوع: ${letter.subject || '-'} | وضعیت/تاییدها بروزرسانی شد.`,
                    '/secretariat',
                    ['admin', 'ceo', 'manager', 'office'],
                    targets.length > 0 ? targets : null
                );
            } catch (err) {
                console.error("Background notifySecretariatLetter error:", err);
            }
        });
    } catch (e) {
        console.error("PUT /api/secretariat-letters error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/secretariat-letters/:id', (req, res) => {
    try {
        const db = getDb();
        if (!db.secretariatLetters) db.secretariatLetters = [];
        const letterToDelete = db.secretariatLetters.find(x => x.id === req.params.id);
        db.secretariatLetters = db.secretariatLetters.filter(x => x.id !== req.params.id);
        saveDb(db);
        res.json(db.secretariatLetters);

        if (letterToDelete) {
            setImmediate(async () => {
                try {
                    await broadcastNotification(
                        `❌ حذف نامه اداری #${letterToDelete.letterNumber}`,
                        `نامه اداری با موضوع "${letterToDelete.subject || '-'}" حذف گردید.`,
                        '/secretariat',
                        ['admin', 'ceo', 'manager', 'office']
                    );
                } catch (err) {
                    console.error("Background notifySecretariatLetter delete error:", err);
                }
            });
        }
    } catch (e) {
        console.error("DELETE /api/secretariat-letters error:", e);
        res.status(500).json({ error: e.message });
    }
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
        
        res.json(db.exitPermits);

        setImmediate(async () => {
            try {
                const freshDb = getDb();
                const permit = (freshDb.exitPermits || []).find(x => x.id === item.id) || item;
                const eventType = isEdit ? 'EDIT' : 'CREATE';
                const stepName = isEdit ? 'ویرایش سند' : 'ثبت اولیه';
                const targets = Array.from(new Set([permit.requester, permit.createdBy, permit.recipientName].filter(Boolean)));

                await notifyExitPermitStep(permit, null, null, null, freshDb, stepName, eventType);

                await broadcastNotification(
                    isEdit ? `✏️ ویرایش برگه خروج کالا #${permit.permitNumber}` : `🚛 برگه خروج کالا از کارخانه #${permit.permitNumber}`,
                    `شرکت: ${permit.company || '-'} | گیرنده: ${permit.recipientName || '-'} | راننده: ${permit.driverName || '-'} (پلاک: ${permit.plateNumber || '-'})`,
                    '/manage-exit',
                    ['admin', 'ceo', 'manager', 'factory_manager', 'warehouse', 'security', 'sales_manager'],
                    targets.length > 0 ? targets : null
                );
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
                const targets = Array.from(new Set([permit.requester, permit.createdBy, permit.recipientName].filter(Boolean)));

                await notifyExitPermitStep(permit, null, null, null, freshDb, stepName, eventType);

                await broadcastNotification(
                    `🔄 بروزرسانی برگه خروج کالا #${permit.permitNumber}`,
                    `مرحله: ${stepName} | وضعیت: ${permit.status || '-'} | گیرنده: ${permit.recipientName || '-'}`,
                    '/manage-exit',
                    ['admin', 'ceo', 'manager', 'factory_manager', 'warehouse', 'security', 'sales_manager'],
                    targets.length > 0 ? targets : null
                );
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

                    await broadcastNotification(
                        `❌ حذف برگه خروج کالا #${permitToDelete.permitNumber}`,
                        `برگه خروج شماره ${permitToDelete.permitNumber} مربوط به شرکت ${permitToDelete.company || '-'} حذف گردید.`,
                        '/manage-exit',
                        ['admin', 'ceo', 'manager', 'factory_manager', 'warehouse', 'security', 'sales_manager']
                    );
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
app.delete('/api/groups/:id', (req, res) => { 
    const db = getDb(); 
    db.groups = (db.groups || []).filter(g => g.id !== req.params.id); 
    if (db.messages) db.messages = db.messages.filter(m => m.groupId !== req.params.id);
    saveDb(db); 
    res.json(db.groups); 
});

app.get('/api/task-groups', (req, res) => res.json(getDb().taskGroups || []));
app.post('/api/task-groups', (req, res) => { const db = getDb(); if(!db.taskGroups) db.taskGroups=[]; db.taskGroups.push(req.body); saveDb(db); res.json(db.taskGroups); });
app.put('/api/task-groups/:id', (req, res) => { const db = getDb(); const idx = db.taskGroups.findIndex(g => g.id === req.params.id); if(idx > -1) { db.taskGroups[idx] = { ...db.taskGroups[idx], ...req.body }; saveDb(db); res.json(db.taskGroups); } else res.status(404).send('Not Found'); });
app.delete('/api/task-groups/:id', (req, res) => { 
    const db = getDb(); 
    db.taskGroups = (db.taskGroups || []).filter(g => g.id !== req.params.id); 
    if (db.messages) db.messages = db.messages.filter(m => m.groupId !== req.params.id);
    if (db.tasks) db.tasks = db.tasks.filter(t => t.groupId !== req.params.id);
    saveDb(db); 
    res.json(db.taskGroups); 
});

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
        const settings = db.settings || {};
        
        // Seed initial default jobs if list is empty
        if (db.reportDeliveryJobs.length === 0) {
            const defaultSalesTime = settings.dailySalesSendTime || '19:00';
            const [dsh, dsm] = defaultSalesTime.split(':').map(x => parseInt(x, 10) || 0);

            const defaultChequeTime = settings.chequeVaultSendTime || '09:00';
            const [cqh, cqm] = defaultChequeTime.split(':').map(x => parseInt(x, 10) || 0);

            db.reportDeliveryJobs = [
                {
                    id: 'job_daily_sales_custom',
                    title: 'گزارش روزانه ارشد مدیریتی فروش سایان ERP (امروز)',
                    module: 'sales',
                    reportType: 'daily_sales',
                    botPlatforms: ['telegram', 'bale'],
                    destinationGroup: settings.dailySalesTelegramGroupId || settings.telegramGroupId || '',
                    telegramGroup: settings.dailySalesTelegramGroupId || '',
                    baleGroup: settings.dailySalesBaleGroupId || '',
                    whatsappGroup: settings.dailySalesWhatsAppGroupId || '',
                    scheduleType: 'daily_custom',
                    sendTime: defaultSalesTime,
                    sendHour: dsh || 19,
                    sendMinute: dsm || 0,
                    cronExpression: `${dsm || 0} ${dsh || 19} * * *`,
                    attachPdf: true,
                    attachExcel: true,
                    attachImage: true,
                    enabled: settings.dailySalesAutoSendEnabled ?? true,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'job_daily_comparison_custom',
                    title: 'گزارش پایش مقایسه‌ای فروش (امروز با دیروز)',
                    module: 'sales',
                    reportType: 'sales_comparison',
                    botPlatforms: ['telegram', 'bale'],
                    destinationGroup: settings.dailySalesTelegramGroupId || settings.telegramGroupId || '',
                    telegramGroup: settings.dailySalesTelegramGroupId || '',
                    baleGroup: settings.dailySalesBaleGroupId || '',
                    whatsappGroup: settings.dailySalesWhatsAppGroupId || '',
                    scheduleType: 'daily_custom',
                    sendTime: defaultSalesTime,
                    sendHour: dsh || 19,
                    sendMinute: dsm || 0,
                    cronExpression: `${dsm || 0} ${dsh || 19} * * *`,
                    attachPdf: true,
                    attachExcel: true,
                    attachImage: true,
                    enabled: settings.dailySalesAutoSendEnabled ?? true,
                    createdAt: new Date().toISOString()
                },
                {
                    id: 'job_cheques_treasury_vault',
                    title: 'گزارش وضعیت چک‌های نزد صندوق خزانه‌داری (سال ۱۴۰۴)',
                    module: 'accounting',
                    reportType: 'cheque_vault',
                    botPlatforms: ['telegram', 'bale'],
                    destinationGroup: settings.chequeVaultTelegramGroupId || settings.botAccountingGroupIdTele || '',
                    telegramGroup: settings.chequeVaultTelegramGroupId || '',
                    baleGroup: settings.chequeVaultBaleGroupId || '',
                    whatsappGroup: settings.chequeVaultWhatsappGroupId || '',
                    scheduleType: 'daily_custom',
                    sendTime: defaultChequeTime,
                    sendHour: cqh || 9,
                    sendMinute: cqm || 0,
                    cronExpression: `${cqm || 0} ${cqh || 9} * * *`,
                    attachPdf: settings.chequeVaultAttachPdf ?? true,
                    attachExcel: settings.chequeVaultAttachExcel ?? true,
                    attachImage: false,
                    enabled: settings.chequeVaultAutoSendEnabled ?? true,
                    createdAt: new Date().toISOString()
                }
            ];
            saveDb(db);
        } else {
            // Dynamically synchronize existing default jobs with the settings page fields
            let modified = false;
            
            const salesTime = settings.dailySalesSendTime || '19:00';
            const [salesHour, salesMin] = salesTime.split(':').map(x => parseInt(x, 10) || 0);

            const chequeTime = settings.chequeVaultSendTime || '09:00';
            const [chequeHour, chequeMin] = chequeTime.split(':').map(x => parseInt(x, 10) || 0);

            db.reportDeliveryJobs.forEach(job => {
                if (job.id === 'job_daily_sales_custom' || job.id === 'job_daily_comparison_custom') {
                    if (job.sendTime !== salesTime || job.sendHour !== salesHour || job.sendMinute !== salesMin) {
                        job.sendTime = salesTime;
                        job.sendHour = salesHour;
                        job.sendMinute = salesMin;
                        job.cronExpression = `${salesMin} ${salesHour} * * *`;
                        modified = true;
                    }
                    const salesEnabled = settings.dailySalesAutoSendEnabled ?? true;
                    if (job.enabled !== salesEnabled) {
                        job.enabled = salesEnabled;
                        modified = true;
                    }
                    const tgGroup = settings.dailySalesTelegramGroupId || settings.telegramGroupId || '';
                    if (job.telegramGroup !== tgGroup) {
                        job.telegramGroup = tgGroup;
                        modified = true;
                    }
                    const bGroup = settings.dailySalesBaleGroupId || '';
                    if (job.baleGroup !== bGroup) {
                        job.baleGroup = bGroup;
                        modified = true;
                    }
                    const wGroup = settings.dailySalesWhatsAppGroupId || '';
                    if (job.whatsappGroup !== wGroup) {
                        job.whatsappGroup = wGroup;
                        modified = true;
                    }
                } else if (job.id === 'job_cheques_treasury_vault') {
                    if (job.sendTime !== chequeTime || job.sendHour !== chequeHour || job.sendMinute !== chequeMin) {
                        job.sendTime = chequeTime;
                        job.sendHour = chequeHour;
                        job.sendMinute = chequeMin;
                        job.cronExpression = `${chequeMin} ${chequeHour} * * *`;
                        modified = true;
                    }
                    const chequesEnabled = settings.chequeVaultAutoSendEnabled ?? true;
                    if (job.enabled !== chequesEnabled) {
                        job.enabled = chequesEnabled;
                        modified = true;
                    }
                    const tgGroup = settings.chequeVaultTelegramGroupId || settings.botAccountingGroupIdTele || '';
                    if (job.telegramGroup !== tgGroup) {
                        job.telegramGroup = tgGroup;
                        modified = true;
                    }
                    const bGroup = settings.chequeVaultBaleGroupId || '';
                    if (job.baleGroup !== bGroup) {
                        job.baleGroup = bGroup;
                        modified = true;
                    }
                    const wGroup = settings.chequeVaultWhatsappGroupId || '';
                    if (job.whatsappGroup !== wGroup) {
                        job.whatsappGroup = wGroup;
                        modified = true;
                    }
                    const attachP = settings.chequeVaultAttachPdf ?? true;
                    if (job.attachPdf !== attachP) {
                        job.attachPdf = attachP;
                        modified = true;
                    }
                    const attachE = settings.chequeVaultAttachExcel ?? true;
                    if (job.attachExcel !== attachE) {
                        job.attachExcel = attachE;
                        modified = true;
                    }
                }
            });

            if (modified) {
                saveDb(db);
            }
        }

        // Register cron triggers for all enabled jobs in Asia/Tehran timezone
        db.reportDeliveryJobs.forEach(job => {
            if (!job.enabled) return;

            let cronPattern = '0 19 * * *';

            // Check if exact sendHour and sendMinute or sendTime is configured
            if (job.sendHour !== undefined && job.sendMinute !== undefined) {
                cronPattern = `${parseInt(job.sendMinute, 10) || 0} ${parseInt(job.sendHour, 10) || 0} * * *`;
            } else if (job.sendTime && typeof job.sendTime === 'string' && job.sendTime.includes(':')) {
                const [h, m] = job.sendTime.split(':').map(x => parseInt(x, 10) || 0);
                cronPattern = `${m} ${h} * * *`;
            } else if (job.cronExpression && job.cronExpression.trim()) {
                cronPattern = job.cronExpression.trim();
            } else if (job.scheduleType === 'daily_1900' || job.scheduleType === 'daily_comp_1900') {
                cronPattern = '0 19 * * *';
            } else if (job.scheduleType === 'weekly') {
                cronPattern = '0 19 * * 6'; // Saturday 19:00 Tehran
            } else if (job.scheduleType === 'monthly') {
                cronPattern = '0 19 1 * *'; // 1st of month 19:00 Tehran
            }

            try {
                const task = cron.schedule(cronPattern, async () => {
                    console.log(`⏰ [Tehran Time Cron] Executing Scheduled Report Job: ${job.title} (${job.id}) at ${new Date().toLocaleTimeString('fa-IR')}`);
                    await executeReportJob(job);
                }, {
                    timezone: "Asia/Tehran"
                });
                scheduledReportCronTasks.push(task);
                console.log(`📌 Scheduled Report [${job.title}] with cron pattern "${cronPattern}" (Tehran Time)`);
            } catch (err) {
                console.error(`Failed to schedule report job ${job.id}:`, err);
            }
        });

        console.log(`✅ Loaded ${db.reportDeliveryJobs.length} report delivery jobs (${scheduledReportCronTasks.length} active cron schedules in Tehran Time).`);
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
        const isChequeJob = job.module === 'accounting' || 
            job.reportType === 'cheque_vault' || 
            job.reportType === 'cheque_not_due' || 
            job.reportType === 'cheque_overdue' || 
            job.reportType === 'cheque_matured' || 
            job.reportType === 'cheques_treasury' || 
            job.reportType === 'cheque_alerts';

        const defaultTgGroup = isChequeJob
            ? (db.settings?.chequeVaultTelegramGroupId || db.settings?.botAccountingGroupIdTele || db.settings?.telegramGroupId)
            : (isProdJob
                ? (db.settings?.productionTelegramGroupId || db.settings?.factoryGroupId)
                : (isSalesJob ? (db.settings?.dailySalesTelegramGroupId || db.settings?.botDailySalesGroupIdTele) : (db.settings?.botAccountingGroupIdTele || db.settings?.telegramGroupId)));

        const defaultBaleGroup = isChequeJob
            ? (db.settings?.chequeVaultBaleGroupId || db.settings?.botAccountingGroupIdBale || db.settings?.baleGroupId)
            : (isProdJob
                ? db.settings?.productionBaleGroupId
                : (isSalesJob ? (db.settings?.dailySalesBaleGroupId || db.settings?.botDailySalesGroupIdBale) : (db.settings?.botAccountingGroupIdBale || db.settings?.baleGroupId)));

        const defaultWaGroup = isChequeJob
            ? (db.settings?.chequeVaultWhatsappGroupId || db.settings?.botBijakGroupIdWhatsApp)
            : (isProdJob
                ? db.settings?.productionWhatsappGroupId
                : (isSalesJob ? (db.settings?.dailySalesWhatsappGroupId || db.settings?.botDailySalesGroupIdWhatsApp) : (db.settings?.botBijakGroupIdWhatsApp || db.settings?.defaultWarehouseGroup)));

        const teleGroup = job.telegramGroup || job.destinationGroup || defaultTgGroup;
        const baleGroup = job.baleGroup || job.destinationGroup || defaultBaleGroup;
        const waGroup = job.whatsappGroup || job.destinationGroup || defaultWaGroup;

        const customTargets = [];
        if (job.botPlatforms?.includes('telegram') && teleGroup) {
            customTargets.push({ platform: 'telegram', id: teleGroup });
        }
        if (job.botPlatforms?.includes('bale') && baleGroup) {
            customTargets.push({ platform: 'bale', id: baleGroup });
        }
        if (job.botPlatforms?.includes('whatsapp') && waGroup) {
            customTargets.push({ platform: 'whatsapp', id: waGroup });
        }

        if (job.reportType === 'cheque_vault' || job.reportType === 'cheque_not_due' || job.reportType === 'cheque_overdue' || job.reportType === 'cheque_matured' || job.reportType === 'cheques_treasury' || job.reportType === 'cheque_alerts') {
            // Send Vault Cheques Report matching Sayan ERP criteria
            let rType = 'vault';
            if (job.reportType === 'cheque_not_due') rType = 'not_due';
            else if (job.reportType === 'cheque_overdue') rType = 'overdue';
            else if (job.reportType === 'cheque_matured') rType = 'matured';
            
            const res = await sendTreasuryChequesReport(db, customTargets.length > 0 ? customTargets : null, job.botPlatforms, {
                attachPdf: job.attachPdf ?? true,
                attachExcel: job.attachExcel ?? true,
                reportType: rType
            });
            console.log(`✅ Cheques report (${rType}) dispatched successfully: ${res.count} cheques found.`);
        } else if (job.scheduleType === 'daily_comp_1900' || job.reportType === 'sales_comparison') {
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
            // Standard daily sales report
            const timeLabel = job.sendTime ? `ساعت ${job.sendTime}` : 'گزارش روزانه';
            await sendDailySalesReportForDate(db, new Date(), timeLabel, customTargets.length > 0 ? customTargets : null, job.botPlatforms);
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
