const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const replacement = `
// --- SAYAN PRODUCTION REPORT ENDPOINTS ---`;

const compareEndpoint = `
app.post('/api/sayan/sales-report/send-compare', async (req, res) => {
    try {
        const db = getDb();
        const settings = db.settings || {};
        const { chartData, dateFromA, dateToA, dateFromB, dateToB } = req.body;
        
        if (!chartData || chartData.length === 0) {
            return res.status(400).json({ error: 'داده‌ای برای ارسال وجود ندارد' });
        }

        const salesTargets = [];
        if (settings.dailySalesTelegramGroupId) salesTargets.push({ platform: 'telegram', id: settings.dailySalesTelegramGroupId });
        if (settings.dailySalesBaleGroupId) salesTargets.push({ platform: 'bale', id: settings.dailySalesBaleGroupId });
        if (settings.dailySalesWhatsappGroupId) salesTargets.push({ platform: 'whatsapp', id: settings.dailySalesWhatsappGroupId });
        if (settings.botAccountingGroupIdTele) salesTargets.push({ platform: 'telegram', id: settings.botAccountingGroupIdTele });
        if (settings.botAccountingGroupIdBale) salesTargets.push({ platform: 'bale', id: settings.botAccountingGroupIdBale });
        if (settings.botAccountingGroupIdWhatsApp) salesTargets.push({ platform: 'whatsapp', id: settings.botAccountingGroupIdWhatsApp });
        if (settings.botAccountingGroupId) salesTargets.push({ platform: 'telegram', id: settings.botAccountingGroupId });
        
        const uniqueSalesTargets = [];
        const seenMap = new Set();
        for (const t of salesTargets) {
            const cleanId = utils.sanitizeGroupId(t.id);
            if (!cleanId) continue;
            const key = \`\${t.platform}_\${cleanId}\`;
            if (!seenMap.has(key)) {
                seenMap.add(key);
                uniqueSalesTargets.push({ platform: t.platform, id: cleanId });
            }
        }
        
        if (uniqueSalesTargets.length === 0) {
            throw new Error('گروهی برای ارسال گزارش فروش (تلگرام یا بله) در تنظیمات سیستم ثبت نشده است.');
        }

        const title = \`گزارش مقایسه ای فروش (گروه کالا)\`;
        const columns = ['گروه کالا', 'مقدار A (kg)', 'مبلغ خالص A (ریال)', 'مقدار B (kg)', 'مبلغ خالص B (ریال)', 'تغییر مبلغ (%)'];
        
        let totalNetAmtA = 0;
        let totalNetAmtB = 0;

        const tableRows = chartData.map(row => {
            const amountDiff = row.netAmountB ? ((row.netAmountA - row.netAmountB) / row.netAmountB) * 100 : 0;
            totalNetAmtA += row.netAmountA || 0;
            totalNetAmtB += row.netAmountB || 0;
            
            return [
                row.name || 'سایر',
                (row.netWeightA || 0).toFixed(2),
                (row.netAmountA || 0).toLocaleString('fa-IR'),
                (row.netWeightB || 0).toFixed(2),
                (row.netAmountB || 0).toLocaleString('fa-IR'),
                (amountDiff > 0 ? '+' : '') + amountDiff.toFixed(1) + '%'
            ];
        });
        
        const totalDiff = totalNetAmtB ? ((totalNetAmtA - totalNetAmtB) / totalNetAmtB) * 100 : 0;
        tableRows.push([
            'جمع کل',
            '-',
            totalNetAmtA.toLocaleString('fa-IR'),
            '-',
            totalNetAmtB.toLocaleString('fa-IR'),
            (totalDiff > 0 ? '+' : '') + totalDiff.toFixed(1) + '%'
        ]);

        const pdfBuffer = await Renderer.generateReportPDF(title, columns, tableRows, true);
        const filename = \`Compare_Sales_\${Date.now()}.pdf\`;
        
        const caption = \`📊 *گزارش مقایسه ای فروش سایان*\n\n📅 بازه A: \${dateFromA || ''} الی \${dateToA || ''}\n📅 بازه B: \${dateFromB || ''} الی \${dateToB || ''}\n\n💵 جمع فروش A: \${totalNetAmtA.toLocaleString('fa-IR')} ریال\n💵 جمع فروش B: \${totalNetAmtB.toLocaleString('fa-IR')} ریال\n📈 رشد مبلغ فروش: \${totalDiff.toFixed(1)}%\`;

        let successfulSends = 0;
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
                console.error(\`Failed to send compare report to \${tgt.platform} group \${tgt.id}:\`, e.message);
            }
        }

        if (successfulSends === 0) {
            throw new Error('ارسال گزارش مقایسه‌ای ناموفق بود. خطا در پیام‌رسان‌ها.');
        }

        res.json({ success: true, message: 'گزارش مقایسه‌ای با موفقیت به پیام‌رسان‌ها ارسال شد.' });
    } catch (e) {
        console.error("Compare Sales Report Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- SAYAN PRODUCTION REPORT ENDPOINTS ---`;

code = code.replace(replacement, compareEndpoint);
fs.writeFileSync('server.js', code);
console.log('Compare endpoint added');
