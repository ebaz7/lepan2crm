const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

for (const t of ['STR_TBL_008', 'STR_TBL_015', 'STR_TBL_021', 'STR_TBL_023', 'STR_TBL_027']) {
  if (schema[t]) {
    console.log(`=== ${t} ===`);
    console.log("Headers:", schema[t][0].join(', '));
    for (let i = 1; i < Math.min(3, schema[t].length); i++) {
      console.log(`Row ${i}:`, schema[t][i].join(', '));
    }
  }
}
