
import TelegramBot from 'node-telegram-bot-api';
import * as BotCore from './bot-core.js';
import { getDb } from './db-manager.js';

let bot = null;

let currentToken = null;

const ensureBotActive = async () => {
    if (!bot) {
        try {
            const token = getDb()?.settings?.telegramBotToken;
            if (token) {
                await initTelegram(token);
            }
        } catch (e) {
            console.error("Auto init Telegram failed:", e.message);
        }
    }
};

export const initTelegram = async (token) => {
    if (!token) {
        if(bot) {
            try { await bot.stopPolling(); bot = null; currentToken = null; } catch(e){}
        }
        return;
    }
    
    // Do not restart if token is unchanged
    if (bot && currentToken === token) {
        return;
    }

    if (bot) {
        try { await bot.stopPolling(); } catch(e){ console.error("Error stopping old bot", e); }
        bot = null;
    }

    currentToken = token;

    const requestOptions = { agentOptions: { keepAlive: true, family: 4 }, timeout: 30000 };
    if (process.env.PROXY_URL) requestOptions.proxy = process.env.PROXY_URL;

    try {
        bot = new TelegramBot(token, { polling: true, request: requestOptions });
        console.log(">>> Telegram Bot Started ✅");

        // Set Persistent Menu Commands
        bot.setMyCommands([
            { command: 'start', description: 'شروع و منوی اصلی' },
            { command: 'menu', description: 'نمایش منو' }
        ]).catch(e => console.error("TG SetCommands Err:", e.message));

        const sendFn = (id, txt, opts) => bot.sendMessage(id, txt, opts).catch(e => console.error("TG Send Err:", e.message));
        const sendPhotoFn = (platform, id, buf, cap, opts) => bot.sendPhoto(id, buf, { caption: cap, ...opts }).catch(e => console.error("TG Photo Err:", e.message));
        
        // FIXED: Ensure options { filename } is passed as fileOptions with 3-attempt retry system
        const sendDocFn = async (id, buf, name, cap, attempt = 1) => {
            try {
                return await bot.sendDocument(id, buf, { caption: cap }, { filename: name });
            } catch (e) {
                console.error(`TG Doc Err (Attempt ${attempt}/3):`, e.message);
                if (attempt < 3) {
                    await new Promise(r => setTimeout(r, 2000 * attempt));
                    return sendDocFn(id, buf, name, cap, attempt + 1);
                }
                throw e; // Propagate error for Core to handle
            }
        };

        const checkMembershipFn = async (userId, channelId) => {
            try {
                const res = await bot.getChatMember(channelId, userId);
                return ['creator', 'administrator', 'member'].includes(res.status);
            } catch(e) {
                console.error("Membership check error", e.message);
                return false;
            }
        };

        bot.on('message', async (msg) => {
            try {
                if (!msg.text) return;
                
                // Allow /id command in groups
                if (msg.text.startsWith('/id') || msg.text === 'آیدی') {
                    return bot.sendMessage(msg.chat.id, `🆔 شناسه این چت: \`${msg.chat.id}\``, { parse_mode: 'Markdown' });
                }

                // Allow registration only in private chat
                const isPrivate = msg.chat.type === 'private';
                const isCommand = msg.text.startsWith('/');
                const isDaily = msg.text.toLowerCase().includes('daily') || msg.text.includes('گزارش روزانه');
                const hasActiveSession = BotCore.sessions[msg.chat.id] && BotCore.sessions[msg.chat.id].state !== 'IDLE';

                if (isPrivate || isCommand || isDaily || hasActiveSession || msg.reply_to_message) {
                    await BotCore.handleMessage('telegram', msg.chat.id, msg.text, sendFn, sendPhotoFn, sendDocFn, checkMembershipFn, msg.from.id, msg);
                }
            } catch (e) {
                console.error("TG Msg Handle Error:", e);
                bot.sendMessage(msg.chat.id, "⚠️ خطا در پردازش درخواست.").catch(()=>{});
            }
        });

        bot.on('callback_query', async (query) => {
            try {
                await BotCore.handleCallback('telegram', query.message.chat.id, query.from.id, query.data, sendFn, sendPhotoFn, sendDocFn, checkMembershipFn);
                await bot.answerCallbackQuery(query.id);
            } catch (e) {
                console.error("TG Callback Handle Error:", e);
                bot.answerCallbackQuery(query.id).catch(()=>{});
            }
        });
        
        bot.on('polling_error', (error) => {
            console.error(`[Telegram Polling Error] ${error.code}: ${error.message}`);
        });

    } catch (e) { console.error("Telegram Init Error", e); }
};

export const sendBotMessage = async (chatId, text, opts) => {
    await ensureBotActive();
    if (!bot) return Promise.reject("Bot Telegram not initialized");
    return bot.sendMessage(chatId, text, opts);
};

export const sendBotPhoto = async (chatId, buffer, caption, opts) => {
    await ensureBotActive();
    if (!bot) return Promise.reject("Bot Telegram not initialized");
    const safeCaption = caption && caption.length > 1000 ? caption.slice(0, 995) + '...' : caption;
    const fileOptions = { filename: opts?.filename || 'image.png', contentType: opts?.contentType || 'image/png' };
    return bot.sendPhoto(chatId, buffer, { caption: safeCaption, ...opts }, fileOptions);
};

export const sendBotDocument = async (chatId, buffer, name, caption) => {
    await ensureBotActive();
    if (!bot) return Promise.reject(new Error("Bot Telegram not initialized - توکن ربات تلگرام در تنظیمات ثبت نشده است"));
    const safeCaption = caption && caption.length > 1000 ? caption.slice(0, 995) + '...' : caption;
    return bot.sendDocument(chatId, buffer, { caption: safeCaption }, { filename: name || 'document.pdf', contentType: 'application/pdf' });
};

export const deleteBotMessage = async (chatId, messageId) => {
    await ensureBotActive();
    if (!bot) return Promise.reject("Bot Telegram not initialized");
    return bot.deleteMessage(chatId, messageId).catch(e => console.error("TG delete error:", e.message));
};
