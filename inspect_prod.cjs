const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("STR_TBL_008 (Products?):", JSON.stringify(schema['STR_TBL_008'] ? schema['STR_TBL_008'].slice(0, 3) : [], null, 2));
console.log("IND_TBL_002 (Groups?):", JSON.stringify(schema['IND_TBL_002'] ? schema['IND_TBL_002'].slice(0, 3) : [], null, 2));
console.log("IND_TBL_022 (Items?):", JSON.stringify(schema['IND_TBL_022'] ? schema['IND_TBL_022'].slice(0, 3) : [], null, 2));
console.log("IND_TBL_006:", JSON.stringify(schema['IND_TBL_006'] ? schema['IND_TBL_006'].slice(0, 3) : [], null, 2));
console.log("IND_TBL_007:", JSON.stringify(schema['IND_TBL_007'] ? schema['IND_TBL_007'].slice(0, 3) : [], null, 2));

