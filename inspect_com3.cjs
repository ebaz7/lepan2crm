const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

if (schema['COM_TBL_003']) {
  console.log("=== COM_TBL_003 ===");
  console.log("Headers:", schema['COM_TBL_003'][0].join(', '));
  for (let i = 1; i < Math.min(3, schema['COM_TBL_003'].length); i++) {
    console.log(`Row ${i}:`, schema['COM_TBL_003'][i].join(', '));
  }
}
