const fs = require('fs');
let code = fs.readFileSync('components/CreateExitPermit.tsx', 'utf8');

code = code.replace(
`            // Call API
            await saveExitPermit(newPermit);
            
            // Navigate/clear immediately for instant response
            onSuccess();
            
            // Initiate Auto-Send Process asynchronously in background
            setTempPermit(newPermit);
            
            setTimeout(async () => {
                const elNoPrice = document.getElementById(\`print-permit-create-noprice-\${newPermit.id}\`);
                const elWithPrice = document.getElementById(\`print-permit-create-price-\${newPermit.id}\`);
                
                if (elNoPrice && elWithPrice) {
                    try {`,
`            // Call API
            await saveExitPermit(newPermit);
            
            // Initiate Auto-Send Process
            setTempPermit(newPermit);
            
            setTimeout(async () => {
                const elNoPrice = document.getElementById(\`print-permit-create-noprice-\${newPermit.id}\`);
                const elWithPrice = document.getElementById(\`print-permit-create-price-\${newPermit.id}\`);
                
                if (elNoPrice && elWithPrice) {
                    try {`
);

code = code.replace(
`                        if (g2StatusArray.includes('CREATE')) {
                            if (g2WA) await apiCall('/send-whatsapp', 'POST', { number: g2WA, message: captionNoPrice, mediaData: mediaNoPrice });
                            if (g2Bale) await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: g2Bale, caption: captionNoPrice, mediaData: mediaNoPrice });
                            if (g2Tg) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: g2Tg, caption: captionNoPrice, mediaData: mediaNoPrice });
                        }

                        const g3Config = settings?.exitPermitThirdGroupConfig;
                        const g3WA = g3Config?.groupId;
                        const g3Bale = g3Config?.baleId;
                        const g3Tg = g3Config?.telegramId;
                        
                        const g3StatusArray = g3Config?.activeStatuses || [];
                        if (g3StatusArray.includes('CREATE')) {
                            if (g3WA) await apiCall('/send-whatsapp', 'POST', { number: g3WA, message: captionNoPrice, mediaData: mediaNoPrice });
                            if (g3Bale) await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: g3Bale, caption: captionNoPrice, mediaData: mediaNoPrice });
                            if (g3Tg) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: g3Tg, caption: captionNoPrice, mediaData: mediaNoPrice });
                        }
                    } catch (e) { console.error("Notification Error", e); }
                }
            }, 300);`,
`                        if (g2StatusArray.includes('CREATE')) {
                            if (g2WA) await apiCall('/send-whatsapp', 'POST', { number: g2WA, message: captionNoPrice, mediaData: mediaNoPrice });
                            if (g2Bale) await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: g2Bale, caption: captionNoPrice, mediaData: mediaNoPrice });
                            if (g2Tg) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: g2Tg, caption: captionNoPrice, mediaData: mediaNoPrice });
                        }

                        const g3Config = settings?.exitPermitThirdGroupConfig;
                        const g3WA = g3Config?.groupId;
                        const g3Bale = g3Config?.baleId;
                        const g3Tg = g3Config?.telegramId;
                        
                        const g3StatusArray = g3Config?.activeStatuses || [];
                        if (g3StatusArray.includes('CREATE')) {
                            if (g3WA) await apiCall('/send-whatsapp', 'POST', { number: g3WA, message: captionNoPrice, mediaData: mediaNoPrice });
                            if (g3Bale) await apiCall('/send-bot-message', 'POST', { platform: 'bale', chatId: g3Bale, caption: captionNoPrice, mediaData: mediaNoPrice });
                            if (g3Tg) await apiCall('/send-bot-message', 'POST', { platform: 'telegram', chatId: g3Tg, caption: captionNoPrice, mediaData: mediaNoPrice });
                        }
                    } catch (e) { console.error("Notification Error", e); }
                }
                
                setIsSubmitting(false);
                onSuccess();
            }, 500);`
);

fs.writeFileSync('components/CreateExitPermit.tsx', code);
console.log('Create patched with onSuccess inside setTimeout');
