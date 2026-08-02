const fs = require('fs');
const db = JSON.parse(fs.readFileSync('database.json', 'utf8'));
console.log("Database root keys:", Object.keys(db));
if (db.groups) {
    console.log("db.groups count:", db.groups.length, "content:", db.groups);
}
if (db.botUsers) {
    console.log("db.botUsers count:", db.botUsers.length, "content:", db.botUsers);
}
if (db.settings) {
    // Look at all properties on settings that aren't empty
    const non_empty = {};
    for (const k in db.settings) {
        if (db.settings[k]) {
            non_empty[k] = db.settings[k];
        }
    }
    console.log("Non-empty settings:", non_empty);
}
