const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("STR_TBL_010 headers:");
console.log(schema['STR_TBL_010'][0].slice(0, 15).join(' | '));
console.log("STR_TBL_010 row 1:");
console.log(schema['STR_TBL_010'][1].slice(0, 15).join(' | '));
