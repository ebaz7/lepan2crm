const fs = require('fs');
const db = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
console.log(db['STR_TBL_011'].slice(0, 2)); 
