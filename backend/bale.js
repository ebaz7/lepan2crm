
import https from 'https';
import FormData from 'form-data';
import * as BotCore from './bot-core.js';
import { getDb } from './db-manager.js';

let pollingActive = false;
let lastOffset = 0;
let botToken = null;

const ensureBaleActive = () => {
    if (!botToken) {
        try {
            const token = getDb()?.settings?.baleBotToken;
            if (token) {
                initBaleBot(token);
            }
        } catch (e) {
            console.error("Auto init Bale failed:", e.message);
        }
    }
};

const callApi = (method, data, isMultipart = false) => {
    return new Promise((resolve, reject) => {
        if (!botToken) return reject("No Token");
        const options = {
            hostname: 'tapi.bale.ai',
            path: `/bot${botToken}/${method}`,
            method: 'POST',
            headers: isMultipart ? data.getHeaders() : { 'Content-Type': 'application/json' },
            timeout: 15000 // 15 seconds timeout
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    if (parsed && parsed.ok === false) {
                        return reject(new Error(parsed.description || `خطای بله: ${parsed.error_code || 'نامشخص'}`));
                    }
                    resolve(parsed);
                } catch(e) {
                    resolve({ raw: body });
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error("Request timeout"));
        });

        if (isMultipart) data.pipe(req);
        else {
            if(data) req.write(JSON.stringify(data));
            req.end();
        }
    });
};

export const initBaleBot = (token) => {
    if (!token) {
        pollingActive = false;
        botToken = null;
        return;
    }
    if (botToken === token && pollingActive) return;

    botToken = token;
    
    if (!pollingActive) {
        pollingActive = true;
        poll();
        console.log(">>> Bale Bot Started ✅");
    }

    // Try to set commands for Bale (similar to Telegram)
    callApi('setMyCommands', {
        commands: [
            { command: 'start', description: 'شروع و منوی اصلی' },
            { command: 'menu', description: 'نمایش منو' }
        ]
    }).catch(() => {});
};

const poll = async () => {
    if (!pollingActive) return;
    try {
        const res = await callApi('getUpdates', { offset: lastOffset + 1 });
        if (res.ok && res.result && res.result.length > 0) {
            for (const u of res.result) {
                lastOffset = u.update_id;
                
                const sendFn = (id, txt, opts) => callApi('sendMessage', { chat_id: id, text: txt, ...opts }).catch(e => console.error("Bale Send Err", e.message));
                
                const sendPhotoFn = (platform, id, buffer, caption, opts) => {
                    const form = new FormData();
                    form.append('chat_id', id);
                    form.append('photo', buffer, { filename: 'image.png' });
                    form.append('caption', caption);
                    if (opts && opts.reply_markup) form.append('reply_markup', JSON.stringify(opts.reply_markup));
                    return callApi('sendPhoto', form, true).catch(e => console.error("Bale Photo Err", e.message));
                };

                // FIXED: Ensure buffer is appended correctly with filename and 3-attempt retry system
                const sendDocFn = async (id, buffer, name, caption, attempt = 1) => {
                    try {
                        const form = new FormData();
                        form.append('chat_id', id);
                        form.append('document', buffer, { filename: name || 'document.pdf' });
                        form.append('caption', caption || '');
                        const res = await callApi('sendDocument', form, true);
                        if (!res || !res.ok) {
                            throw new Error(res ? res.description : "Empty reply");
                        }
                        return res;
                    } catch (e) {
                        console.error(`Bale Doc Err (Attempt ${attempt}/3):`, e.message);
                        if (attempt < 3) {
                            await new Promise(r => setTimeout(r, 2000 * attempt));
                            return sendDocFn(id, buffer, name, caption, attempt + 1);
                        }
                        throw e;
                    }
                }

                const checkMembershipFn = async (userId, channelId) => {
                    try {
                        let cleanId = channelId;
                        if (typeof cleanId === 'string' && cleanId.startsWith('@')) {
                            cleanId = cleanId.substring(1);
                        }
                        
                        // First try with original
                        let res = await callApi('getChatMember', { chat_id: channelId, user_id: userId });
                        
                        // If not successful, try without @ prefix which is common in Bale
                        if ((!res || !res.ok) && channelId.toString().startsWith('@')) {
                            res = await callApi('getChatMember', { chat_id: cleanId, user_id: userId });
                        }

                        console.log(`[Bale Membership] User: ${userId}, Channel: ${channelId}, Res Status: ${res && res.result ? res.result.status : 'ERR'}, Full:`, JSON.stringify(res));

                        if (res && res.result && res.result.status) {
                            const status = res.result.status;
                            return ['creator', 'administrator', 'member', 'restricted'].includes(status);
                        }
                        return false;
                    } catch(e) {
                        console.error("[Bale Membership Error]", e.message);
                        return false;
                    }
                };

                try {
                    if (u.message && u.message.text) {
                        const text = u.message.text;
                        const chatId = u.message.chat.id;

                        // Allow /id in groups
                        if (text.startsWith('/id') || text === 'آیدی') {
                            sendFn(chatId, `🆔 شناسه این چت: ${chatId}`);
                            continue;
                        }

                        const isDaily = text.toLowerCase().includes('daily') || text.includes('گزارش روزانه');
                        const hasActiveSession = BotCore.sessions[chatId] && BotCore.sessions[chatId].state !== 'IDLE';

                        const senderId = u.message.from ? u.message.from.id : chatId;
                        const isReply = !!u.message.reply_to_message;

                        // Ignore group messages unless it's a command, part of active session, report request, or a reply
                        if (u.message.chat.type && u.message.chat.type !== 'private' && !text.startsWith('/') && !hasActiveSession && !isDaily && !isReply) continue;

                        // Run handling in background to not block the poll loop
                        BotCore.handleMessage('bale', chatId, text, sendFn, sendPhotoFn, sendDocFn, checkMembershipFn, senderId, u.message).catch(e => console.error("Bale Core Handle Err", e));
                    } else if (u.callback_query) {
                        const userId = u.callback_query.from ? u.callback_query.from.id : u.callback_query.message.chat.id;
                        BotCore.handleCallback('bale', u.callback_query.message.chat.id, userId, u.callback_query.data, sendFn, sendPhotoFn, sendDocFn, checkMembershipFn).catch(e => console.error("Bale Callback Err", e));
                    }
                } catch (err) {
                    console.error("Bale Message Handler Error:", err);
                }
            }
        }
    } catch (e) { /* Ignore poll errors */ }
    setTimeout(poll, 2000);
};

export const sendBotMessage = (chatId, text, opts) => {
    ensureBaleActive();
    return callApi('sendMessage', { chat_id: chatId, text: text, ...opts });
};

export const sendBotPhoto = (chatId, buffer, caption, opts) => {
    ensureBaleActive();
    const safeCaption = caption && caption.length > 1000 ? caption.slice(0, 995) + '...' : caption;
    const form = new FormData();
    form.append('chat_id', chatId);
    const filename = (opts && opts.filename) ? opts.filename : 'image.png';
    form.append('photo', buffer, { filename });
    form.append('caption', safeCaption || '');
    if (opts && opts.reply_markup) form.append('reply_markup', JSON.stringify(opts.reply_markup));
    return callApi('sendPhoto', form, true);
};

export const sendBotDocument = (chatId, buffer, name, caption) => {
    ensureBaleActive();
    const safeCaption = caption && caption.length > 1000 ? caption.slice(0, 995) + '...' : caption;
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('document', buffer, { filename: name || 'document.pdf' });
    form.append('caption', safeCaption || '');
    return callApi('sendDocument', form, true);
};

export const deleteBotMessage = (chatId, messageId) => {
    return callApi('deleteMessage', { chat_id: chatId, message_id: messageId }).catch(e => console.error("Bale delete error:", e.message));
};
