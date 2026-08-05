const fs = require('fs');
let code = fs.readFileSync('components/CreateExitPermit.tsx', 'utf8');

code = code.replace(
`                        const g1WA = companyConfig?.warehouseGroup || settings?.exitPermitNotificationGroup || settings?.defaultWarehouseGroup;
                        const g1Bale = companyConfig?.baleChannelId || settings?.exitPermitNotificationBaleId;
                        const g1Tg = companyConfig?.telegramChannelId || settings?.exitPermitNotificationTelegramId;`,
`                        const g1Config = settings?.exitPermitFirstGroupConfig;
                        const g1WA = companyConfig?.warehouseGroup || settings?.exitPermitNotificationGroup || settings?.defaultWarehouseGroup || g1Config?.groupId;
                        const g1Bale = companyConfig?.baleChannelId || settings?.exitPermitNotificationBaleId || g1Config?.baleId;
                        const g1Tg = companyConfig?.telegramChannelId || settings?.exitPermitNotificationTelegramId || g1Config?.telegramId;`
);

const thirdGroupStr = `                        const g3Config = settings?.exitPermitThirdGroupConfig;
                        const g3WA = g3Config?.groupId;
                        const g3Bale = g3Config?.baleId;
                        const g3Tg = g3Config?.telegramId;
                        
                        const g3StatusArray = g3Config?.activeStatuses || [];
                        if (g3StatusArray.includes('CREATE')) {
                            if (g3WA) await apiCall('/send-whatsapp', 'POST', { number: g3WA, message: captionNoPrice, mediaData: mediaNoPrice });
                            if (g3Bale) await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: g3Bale, caption: captionNoPrice, mediaData: mediaNoPrice });
                            if (g3Tg) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: g3Tg, caption: captionNoPrice, mediaData: mediaNoPrice });
                        }`;

code = code.replace(
`                        const g2StatusArray = settings?.exitPermitSecondGroupConfig?.activeStatuses || [];
                        if (g2StatusArray.includes('CREATE')) {
                            if (g2WA) await apiCall('/send-whatsapp', 'POST', { number: g2WA, message: captionNoPrice, mediaData: mediaNoPrice });
                            if (g2Bale) await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: g2Bale, caption: captionNoPrice, mediaData: mediaNoPrice });
                            if (g2Tg) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: g2Tg, caption: captionNoPrice, mediaData: mediaNoPrice });
                        }`,
`                        const g2StatusArray = settings?.exitPermitSecondGroupConfig?.activeStatuses || [];
                        if (g2StatusArray.includes('CREATE')) {
                            if (g2WA) await apiCall('/send-whatsapp', 'POST', { number: g2WA, message: captionNoPrice, mediaData: mediaNoPrice });
                            if (g2Bale) await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: g2Bale, caption: captionNoPrice, mediaData: mediaNoPrice });
                            if (g2Tg) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: g2Tg, caption: captionNoPrice, mediaData: mediaNoPrice });
                        }

${thirdGroupStr}`
);
fs.writeFileSync('components/CreateExitPermit.tsx', code);
console.log('Create patched');
