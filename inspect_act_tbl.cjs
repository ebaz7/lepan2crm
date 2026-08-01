const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("ACT_TBL_004:", JSON.stringify(schema['ACT_TBL_004'], null, 2));
console.log("ACT_TBL_007:", JSON.stringify(schema['ACT_TBL_007'], null, 2));
