const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const replacement = `

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

// --- SAYAN PRODUCTION REPORT ENDPOINTS ---`;

code = code.replace('// --- SAYAN PRODUCTION REPORT ENDPOINTS ---', replacement);
fs.writeFileSync('server.js', code);
console.log('Restored cron schedule.');
