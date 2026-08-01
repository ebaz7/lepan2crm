const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("STR_TBL_011 headers:");
console.log(schema['STR_TBL_011'][0].slice(0, 15).join(' | '));
console.log("STR_TBL_011 row 1:");
console.log(schema['STR_TBL_011'][1].slice(0, 15).join(' | '));
