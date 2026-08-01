const fs = require('fs');
const db = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
const cols = db['STR_TBL_010'][0];
const row = db['STR_TBL_010'][1];
let obj = {};
cols.forEach((c, idx) => obj[c] = row[idx]);
console.log(obj);
