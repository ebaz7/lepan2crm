const fs = require('fs');
const db = JSON.parse(fs.readFileSync('schema_output.json', 'utf8'));
const tables = Object.keys(db).filter(t => t.startsWith('SAL_') || t.startsWith('INV_') || t.startsWith('FCT_') || t.startsWith('FAC_'));
console.log(tables);
