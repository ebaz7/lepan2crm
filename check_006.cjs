const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
console.log("STR_TBL_006 Headers:", schema['STR_TBL_006'][0]);
