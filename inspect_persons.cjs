const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

for (const t of ['ACT_TBL_004', 'ACT_TBL_005', 'GNR_TBL_001', 'GNR_TBL_010', 'COM_TBL_010', 'COM_TBL_008']) {
  if (schema[t]) {
    console.log(`=== ${t} ===`);
    console.log("Headers:", schema[t][0].join(', '));
    for (let i = 1; i < Math.min(3, schema[t].length); i++) {
      console.log(`Row ${i}:`, schema[t][i].join(', '));
    }
  }
}
