const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
console.log("IND_TBL_002:", JSON.stringify(schema['IND_TBL_002'] ? schema['IND_TBL_002'].slice(0, 10) : [], null, 2));
