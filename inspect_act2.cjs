const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("ACT_TBL_002:", JSON.stringify(schema['ACT_TBL_002'], null, 2));
console.log("ACT_TBL_003:", JSON.stringify(schema['ACT_TBL_003'], null, 2));
