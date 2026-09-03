const fs = require('fs');

let serverCode = fs.readFileSync('server.js', 'utf8');

const newEndpoint = `
app.post('/api/bot/send-document', async (req, res) => {
    try {
        const { base64Data, filename, caption, platforms = ['telegram', 'bale'], customTargets } = req.body;
        if (!base64Data || !filename) {
            return res.status(400).json({ error: 'Missing required data' });
        }
        
        const buffer = Buffer.from(base64Data, 'base64');
        let targets = [];
        
        // If no custom targets, maybe use some default or require them?
        // Let's assume customTargets is passed or we broadcast to a default list.
        if (customTargets && customTargets.length > 0) {
            for (const t of customTargets) {
                targets.push({ platform: t.platform, id: t.groupId });
            }
        } else {
            // Default targets from settings if any?
            const settings = getSettings();
            if (settings.chatGroups) {
                targets = settings.chatGroups;
            }
        }
        
        const results = [];
        for (const target of targets) {
            if (!platforms.includes(target.platform)) continue;
            try {
                if (target.platform === 'telegram' && telegram) {
                    await telegram.sendBotDocument(target.id, buffer, filename, caption || '');
                    results.push({ platform: 'telegram', id: target.id, success: true });
                } else if (target.platform === 'bale' && bale) {
                    await bale.sendBotDocument(target.id, buffer, filename, caption || '');
                    results.push({ platform: 'bale', id: target.id, success: true });
                }
            } catch (err) {
                results.push({ platform: target.platform, id: target.id, success: false, error: err.message });
            }
        }
        
        res.json({ success: true, results });
    } catch (e) {
        console.error("Error in /api/bot/send-document:", e);
        res.status(500).json({ error: e.message });
    }
});
`;

if (!serverCode.includes('/api/bot/send-document')) {
    serverCode = serverCode.replace(
        "app.post('/api/bot/broadcast', async (req, res) => {", 
        newEndpoint + "\napp.post('/api/bot/broadcast', async (req, res) => {"
    );
    fs.writeFileSync('server.js', serverCode);
    console.log("Endpoint added successfully.");
} else {
    console.log("Endpoint already exists.");
}
