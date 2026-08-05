const fs = require('fs');
let content = fs.readFileSync('server.js', 'utf8');

const startStr = '    if (salesRows.length > 0) {';
const endStr = '} catch (e) {';
const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    const origBlock = content.substring(startIdx, endIdx + endStr.length);
    
    // Check if it's the right block (should have salesRows.forEach)
    if (origBlock.includes('salesRows.forEach')) {
        const replaceStr = `    if (salesRows.length > 0) {
        const titleDetailed = \`گزارش رسمی فروش ریز کالا سایان - مورخ \${shamsiDate} (\${labelSuffix})\`;
        const titleGrouped = \`گزارش رسمی فروش گروه کالا سایان - مورخ \${shamsiDate} (\${labelSuffix})\`;
        
        const columnsDetailed = ['ردیف', 'گروه / نام کالا', 'فروش ناخالص (ک‌گ / ریال)', 'مرجوعی کد ۱۳ (ک‌گ / ریال)', 'خالص (ک‌گ / ریال)', 'فی نهایی (ریال)'];
        const columnsGrouped = ['ردیف', 'گروه کالا', 'فروش ناخالص (ک‌گ / ریال)', 'مرجوعی کد ۱۳ (ک‌گ / ریال)', 'خالص (ک‌گ / ریال)', 'فی نهایی (ریال)'];
        
        const detailedMap = new Map();
        const groupMap = new Map();

        let totalSalesQty = 0;
        let totalSalesAmt = 0;
        let totalReturnQty = 0;
        let totalReturnAmt = 0;
        
        salesRows.forEach(inv => {
            const keyDetailed = \`\${inv.GroupName || ''}_\${inv.ItemName || ''}\`;
            const keyGrouped = \`\${inv.GroupName || 'سایر گروه‌ها'}\`;
            
            const qty = parseFloat(inv.Quantity || 0);
            let amt = parseFloat(inv.Amount || 0);
            
            const h = inv.Notes || '';
            const i = inv.ItemNotes || '';
            const isOfficial = h.includes('نوع: رسمی') || h.includes('نوع:رسمی') || i.includes('نوع: رسمی') || i.includes('نوع:رسمی') || (i.includes('ارزش افزوده:') && !i.includes('ارزش افزوده: 0') && !i.includes('ارزش افزوده:0'));
            if (isOfficial) {
                amt = amt * 1.10;
            }
            const isReturn = inv.OpCode === '13';
            
            if (isReturn) {
                totalReturnQty += qty;
                totalReturnAmt += amt;
            } else {
                totalSalesQty += qty;
                totalSalesAmt += amt;
            }
            
            // Detailed Map
            if (!detailedMap.has(keyDetailed)) {
                detailedMap.set(keyDetailed, {
                    itemName: inv.ItemName || 'کالای بدون نام',
                    groupName: inv.GroupName || 'سایر گروه‌ها',
                    salesQty: 0,
                    salesAmt: 0,
                    returnQty: 0,
                    returnAmt: 0
                });
            }
            const existingDetailed = detailedMap.get(keyDetailed);

            // Group Map
            if (!groupMap.has(keyGrouped)) {
                groupMap.set(keyGrouped, {
                    groupName: keyGrouped,
                    salesQty: 0,
                    salesAmt: 0,
                    returnQty: 0,
                    returnAmt: 0
                });
            }
            const existingGrouped = groupMap.get(keyGrouped);

            if (isReturn) {
                existingDetailed.returnQty += qty;
                existingDetailed.returnAmt += amt;
                existingGrouped.returnQty += qty;
                existingGrouped.returnAmt += amt;
            } else {
                existingDetailed.salesQty += qty;
                existingDetailed.salesAmt += amt;
                existingGrouped.salesQty += qty;
                existingGrouped.salesAmt += amt;
            }
        });
        
        const detailedRows = Array.from(detailedMap.values());
        const groupedRows = Array.from(groupMap.values());
        
        const grandNetQty = totalSalesQty - totalReturnQty;
        const grandNetAmt = totalSalesAmt - totalReturnAmt;
        const grandFinalPrice = grandNetQty > 0 ? (grandNetAmt / grandNetQty) : 0;
        
        const totalRowArr = [
            'جمع کل',
            '-',
            \`\${totalSalesQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ک‌گ / \${Math.round(totalSalesAmt).toLocaleString('fa-IR')} ریال\`,
            \`\${totalReturnQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ک‌گ / \${Math.round(totalReturnAmt).toLocaleString('fa-IR')} ریال\`,
            \`\${grandNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ک‌گ / \${Math.round(grandNetAmt).toLocaleString('fa-IR')} ریال\`,
            Math.round(grandFinalPrice).toLocaleString('fa-IR')
        ];

        const tableRowsDetailed = detailedRows.map((row, idx) => {
            const netQty = row.salesQty - row.returnQty;
            const netAmt = row.salesAmt - row.returnAmt;
            const finalPrice = netQty > 0 ? (netAmt / netQty) : 0;
            return [
                (idx + 1).toLocaleString('fa-IR'),
                \`\${row.groupName} - \${row.itemName}\`,
                \`\${row.salesQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ک‌گ / \${Math.round(row.salesAmt).toLocaleString('fa-IR')} ریال\`,
                \`\${row.returnQty > 0 ? row.returnQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0'} ک‌گ / \${Math.round(row.returnAmt).toLocaleString('fa-IR')} ریال\`,
                \`\${netQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ک‌گ / \${Math.round(netAmt).toLocaleString('fa-IR')} ریال\`,
                Math.round(finalPrice).toLocaleString('fa-IR')
            ];
        });
        tableRowsDetailed.push(totalRowArr);

        const tableRowsGrouped = groupedRows.map((row, idx) => {
            const netQty = row.salesQty - row.returnQty;
            const netAmt = row.salesAmt - row.returnAmt;
            const finalPrice = netQty > 0 ? (netAmt / netQty) : 0;
            return [
                (idx + 1).toLocaleString('fa-IR'),
                row.groupName,
                \`\${row.salesQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ک‌گ / \${Math.round(row.salesAmt).toLocaleString('fa-IR')} ریال\`,
                \`\${row.returnQty > 0 ? row.returnQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0'} ک‌گ / \${Math.round(row.returnAmt).toLocaleString('fa-IR')} ریال\`,
                \`\${netQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ک‌گ / \${Math.round(netAmt).toLocaleString('fa-IR')} ریال\`,
                Math.round(finalPrice).toLocaleString('fa-IR')
            ];
        });
        tableRowsGrouped.push(totalRowArr);
        
        const pdfBufferDetailed = await Renderer.generateReportPDF(titleDetailed, columnsDetailed, tableRowsDetailed, true);
        const pdfBufferGrouped = await Renderer.generateReportPDF(titleGrouped, columnsGrouped, tableRowsGrouped, true);
        
        if (!pdfBufferDetailed || !pdfBufferGrouped) {
            throw new Error('خطا در تولید فایل PDF گزارش. لطفاً اطمینان حاصل کنید که مرورگر Chrome یا Edge روی سرور نصب شده باشد.');
        }

        const filenameDetailed = \`Sayan_Sales_Detailed_\${gregDate}_\${labelSuffix === 'دیروز' ? 'Yesterday' : 'Today'}.pdf\`;
        const filenameGrouped = \`Sayan_Sales_Grouped_\${gregDate}_\${labelSuffix === 'دیروز' ? 'Yesterday' : 'Today'}.pdf\`;
        
        const captionDetailed = \`📊 *گزارش ریز کالا فروش سایان ERP*
📅 *تاریخ:* \${shamsiDate} (\${labelSuffix})
🧾 *تعداد اقلام:* \${detailedRows.length} مورد
📦 *وزن فروش ناخالص:* \${totalSalesQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
💵 *مبلغ فروش ناخالص:* \${Math.round(totalSalesAmt).toLocaleString('fa-IR')} ریال
🔄 *وزن مرجوعی (کد ۱۳):* \${totalReturnQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
❌ *مبلغ مرجوعی:* \${Math.round(totalReturnAmt).toLocaleString('fa-IR')} ریال
✅ *وزن خالص کل:* \${grandNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
💰 *فروش خالص کل:* \${Math.round(grandNetAmt).toLocaleString('fa-IR')} ریال
🏷️ *فی نهایی میانگین:* \${Math.round(grandFinalPrice).toLocaleString('fa-IR')} ریال/کیلوگرم\`;

        const captionGrouped = \`📊 *گزارش گروه کالا فروش سایان ERP*
📅 *تاریخ:* \${shamsiDate} (\${labelSuffix})
🧾 *تعداد گروه‌ها:* \${groupedRows.length} گروه
📦 *وزن فروش ناخالص:* \${totalSalesQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
💵 *مبلغ فروش ناخالص:* \${Math.round(totalSalesAmt).toLocaleString('fa-IR')} ریال
🔄 *وزن مرجوعی (کد ۱۳):* \${totalReturnQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
❌ *مبلغ مرجوعی:* \${Math.round(totalReturnAmt).toLocaleString('fa-IR')} ریال
✅ *وزن خالص کل:* \${grandNetQty.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم
💰 *فروش خالص کل:* \${Math.round(grandNetAmt).toLocaleString('fa-IR')} ریال
🏷️ *فی نهایی میانگین:* \${Math.round(grandFinalPrice).toLocaleString('fa-IR')} ریال/کیلوگرم\`;

        let successfulSends = 0;
        const sendDetails = [];
        let lastErr = null;

        for (const tgt of uniqueSalesTargets) {
            try {
                if (tgt.platform === 'telegram') {
                    await telegram.sendBotDocument(tgt.id, pdfBufferGrouped, filenameGrouped, captionGrouped);
                    await telegram.sendBotDocument(tgt.id, pdfBufferDetailed, filenameDetailed, captionDetailed);
                    successfulSends += 2;
                    sendDetails.push({ platform: 'telegram', id: tgt.id, status: 'success' });
                } else if (tgt.platform === 'bale') {
                    await bale.sendBotDocument(tgt.id, pdfBufferGrouped, filenameGrouped, captionGrouped);
                    await bale.sendBotDocument(tgt.id, pdfBufferDetailed, filenameDetailed, captionDetailed);
                    successfulSends += 2;
                    sendDetails.push({ platform: 'bale', id: tgt.id, status: 'success' });
                } else if (tgt.platform === 'whatsapp') {
                    const wa = await safeImport('./backend/whatsapp.js');
                    if (wa && wa.sendMessage) {
                        await wa.sendMessage(tgt.id, captionGrouped, {
                            data: pdfBufferGrouped.toString('base64'),
                            mimeType: 'application/pdf',
                            filename: filenameGrouped
                        });
                        await wa.sendMessage(tgt.id, captionDetailed, {
                            data: pdfBufferDetailed.toString('base64'),
                            mimeType: 'application/pdf',
                            filename: filenameDetailed
                        });
                        successfulSends += 2;
                        sendDetails.push({ platform: 'whatsapp', id: tgt.id, status: 'success' });
                    } else {
                        throw new Error('ماژول واتساپ در دسترس نیست');
                    }
                }
            } catch (e) {`;
        
        content = content.replace(origBlock, replaceStr);
        fs.writeFileSync('server.js', content, 'utf8');
        console.log('Successfully patched server.js!');
    } else {
        console.log("Original block doesn't look right.");
    }
} else {
    console.log("Could not find start or end index!");
}
