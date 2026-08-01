const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

for (const t of ['COM_TBL_008', 'COM_TBL_009', 'COM_TBL_010', 'COM_TBL_011', 'COM_TBL_014', 'COM_TBL_019', 'COM_TBL_032']) {
  if (schema[t]) {
    console.log(`=== ${t} ===`);
    console.log("Headers:", schema[t][0].join(', '));
    for (let i = 1; i < Math.min(3, schema[t].length); i++) {
      console.log(`Row ${i}:`, schema[t][i].join(', '));
    }
  }
}
