const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

const str10 = schema['STR_TBL_010'];
const head10 = str10[0];
const f001Idx = head10.indexOf('Field_001');

const has241 = str10.some(r => r[f001Idx] == '241');
console.log("Has 241 in STR_TBL_010:", has241);
