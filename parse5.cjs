const fs = require('fs');
const db = JSON.parse(fs.readFileSync('schema_output.json', 'utf8'));
const tables = Object.keys(db).filter(t => t.startsWith('INV_TBL'));
console.log(tables);
