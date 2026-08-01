const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("STR_TBL_011:", JSON.stringify(schema['STR_TBL_011'] ? schema['STR_TBL_011'].slice(0, 5) : [], null, 2));
