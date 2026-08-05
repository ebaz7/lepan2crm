const fs = require('fs');
let code = fs.readFileSync('components/ManageExitPermits.tsx', 'utf8');

code = code.replace(
`            // Group 1 IDs
            let g1WA = companyConfig?.warehouseGroup || settings?.exitPermitNotificationGroup || settings?.defaultWarehouseGroup;
            let g1Bale = companyConfig?.baleChannelId || settings?.exitPermitNotificationBaleId;
            let g1Tg = companyConfig?.telegramChannelId || settings?.exitPermitNotificationTelegramId;`,
`            // Group 1 IDs
            const g1Config = settings?.exitPermitFirstGroupConfig;
            let g1WA = companyConfig?.warehouseGroup || settings?.exitPermitNotificationGroup || settings?.defaultWarehouseGroup || g1Config?.groupId;
            let g1Bale = companyConfig?.baleChannelId || settings?.exitPermitNotificationBaleId || g1Config?.baleId;
            let g1Tg = companyConfig?.telegramChannelId || settings?.exitPermitNotificationTelegramId || g1Config?.telegramId;`
);

// We need to do this replace twice, because it exists in two places in ManageExitPermits.tsx!
code = code.replace(
`            // Group 1 IDs
            let g1WA = companyConfig?.warehouseGroup || settings?.exitPermitNotificationGroup || settings?.defaultWarehouseGroup;
            let g1Bale = companyConfig?.baleChannelId || settings?.exitPermitNotificationBaleId;
            let g1Tg = companyConfig?.telegramChannelId || settings?.exitPermitNotificationTelegramId;`,
`            // Group 1 IDs
            const g1Config = settings?.exitPermitFirstGroupConfig;
            let g1WA = companyConfig?.warehouseGroup || settings?.exitPermitNotificationGroup || settings?.defaultWarehouseGroup || g1Config?.groupId;
            let g1Bale = companyConfig?.baleChannelId || settings?.exitPermitNotificationBaleId || g1Config?.baleId;
            let g1Tg = companyConfig?.telegramChannelId || settings?.exitPermitNotificationTelegramId || g1Config?.telegramId;`
);

fs.writeFileSync('components/ManageExitPermits.tsx', code);
console.log('Manage patched');
