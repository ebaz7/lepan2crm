const fs = require('fs');
const db = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("STR_TBL_010 columns:", db['STR_TBL_010'][0]);
console.log("Row 1:", db['STR_TBL_010'][1]);
