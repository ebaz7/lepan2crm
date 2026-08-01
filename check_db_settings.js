import { getDb } from './backend/db-manager.js';

const db = getDb();
console.log("DB keys:", Object.keys(db));
console.log("Settings:", JSON.stringify(db.settings, null, 2));
