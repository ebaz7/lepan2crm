const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

if (schema['BUR_TBL_004']) {
  console.log("=== BUR_TBL_004 ===");
  for (let i = 1; i < Math.min(5, schema['BUR_TBL_004'].length); i++) {
    console.log(schema['BUR_TBL_004'][i].join(', '));
  }
}
if (schema['BUR_TBL_005']) {
  console.log("=== BUR_TBL_005 ===");
  for (let i = 1; i < Math.min(5, schema['BUR_TBL_005'].length); i++) {
    console.log(schema['BUR_TBL_005'][i].join(', '));
  }
}
