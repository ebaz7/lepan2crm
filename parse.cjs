const fs = require('fs');
const db = JSON.parse(fs.readFileSync('schema_output.json', 'utf8'));
console.log(db['STR_TBL_011'].slice(0, 15)); 
