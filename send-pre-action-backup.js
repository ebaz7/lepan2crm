import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';
import TelegramBot from 'node-telegram-bot-api';
import https from 'https';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = __dirname;
const DB_FILE = path.join(ROOT_DIR, 'database.json');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');

const action = process.argv[2] || 'backup'; // 'update' or 'uninstall' or 'backup'
const reasonLabel = action === 'update' ? 'عملیات آپدیت سیستم' : (action === 'uninstall' ? 'عملیات آنیستال سیستم' : 'عملیات پشتیبان‌گیری');

async function main() {
    console.log(`>>> Starting pre-action backup for: ${action}`);
    
    if (!fs.existsSync(DB_FILE)) {
        console.error("database.json not found!");
        process.exit(0); // exit gracefully so we don't block the rest of bat
    }

    let db;
    try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (e) {
        console.error("Failed to parse database.json", e);
        process.exit(0);
    }

    const settings = db.settings || {};
    const tgToken = settings.telegramBotToken;
    const baleToken = settings.baleBotToken;
    const tgChatId = settings.backupAdminTelegramChatId;
    const baleChatId = settings.backupAdminBaleChatId;

    if (!tgToken && !baleToken) {
        console.log("No Telegram or Bale bot token configured in database settings. Skipping bot backup.");
        process.exit(0);
    }

    if (!tgChatId && !baleChatId) {
        console.log("No Admin Telegram or Bale Chat ID configured in database settings. Skipping bot backup.");
        process.exit(0);
    }

    const mode = settings.backupMode || 'full';
    console.log(`Creating ZIP backup. Mode: ${mode}`);

    if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const filename = `PreActionBackup_${action}_${mode === 'full' ? 'Full' : 'DB'}_${timestamp}.zip`;
    const filePath = path.join(BACKUPS_DIR, filename);

    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', async () => {
        const sizeMb = (archive.pointer() / 1024 / 1024).toFixed(2);
        console.log(`✅ Pre-action Backup ZIP Created: ${filename} (${sizeMb} MB)`);
        
        const buffer = fs.readFileSync(filePath);
        const caption = `⚠️ نسخه پشتیبان اضطراری (${reasonLabel})\n⏰ تاریخ: ${new Date().toLocaleString('fa-IR')}\n💾 نام فایل: ${filename}`;

        // Send to Telegram
        if (tgToken && tgChatId) {
            try {
                console.log(`Sending to Telegram Admin Chat ID: ${tgChatId}...`);
                const requestOptions = { agentOptions: { keepAlive: true, family: 4 }, timeout: 30000 };
                if (process.env.PROXY_URL) requestOptions.proxy = process.env.PROXY_URL;
                const bot = new TelegramBot(tgToken, { polling: false, request: requestOptions });
                
                const contentType = 'application/zip';
                await bot.sendDocument(tgChatId, buffer, { caption }, { filename, contentType });
                console.log("Backup sent to Telegram successfully ✅");
            } catch (tgErr) {
                console.error("Failed to send backup to Telegram:", tgErr.message);
            }
        }

        // Send to Bale
        if (baleToken && baleChatId) {
            try {
                console.log(`Sending to Bale Admin Chat ID: ${baleChatId}...`);
                const form = new FormData();
                form.append('chat_id', baleChatId);
                form.append('document', buffer, { filename, contentType: 'application/zip' });
                form.append('caption', caption);

                await new Promise((resolve, reject) => {
                    const options = {
                        hostname: 'tapi.bale.ai',
                        path: `/bot${baleToken}/sendDocument`,
                        method: 'POST',
                        headers: form.getHeaders(),
                        timeout: 30000
                    };

                    const req = https.request(options, (res) => {
                        let body = '';
                        res.on('data', c => body += c);
                        res.on('end', () => {
                            try {
                                const parsed = JSON.parse(body);
                                if (parsed && parsed.ok === false) {
                                    return reject(new Error(parsed.description || "Bale error"));
                                }
                                resolve(parsed);
                            } catch (e) {
                                resolve({ raw: body });
                            }
                        });
                    });

                    req.on('error', (e) => reject(e));
                    req.on('timeout', () => {
                        req.destroy();
                        reject(new Error("Bale upload timeout"));
                    });

                    form.pipe(req);
                });
                console.log("Backup sent to Bale successfully ✅");
            } catch (baleErr) {
                console.error("Failed to send backup to Bale:", baleErr.message);
            }
        }

        console.log("Pre-action bot backup sending completed!");
        process.exit(0);
    });

    archive.on('error', (err) => {
        console.error("Archive error", err);
        process.exit(0);
    });

    archive.pipe(output);

    if (fs.existsSync(DB_FILE)) {
        archive.file(DB_FILE, { name: 'database.json' });
    }

    if (mode === 'full' && fs.existsSync(UPLOADS_DIR)) {
        archive.directory(UPLOADS_DIR, 'uploads');
    }

    archive.finalize();
}

main().catch(err => {
    console.error("Fatal in main pre-action-backup", err);
    process.exit(0);
});
