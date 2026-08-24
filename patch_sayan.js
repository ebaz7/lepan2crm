const fs = require('fs');
const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));
if (!db.settings.sayanApiUrl) {
    db.settings.sayanApiUrl = "http://192.168.41.225:3000/api/external/v1";
}
if (!db.settings.sayanApiKey) {
    db.settings.sayanApiKey = "s_gate_live_urp2vvxzpik4";
}
fs.writeFileSync('database.json', JSON.stringify(db, null, 2));
console.log("Patched");
