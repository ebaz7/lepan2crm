const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

for (const t of Object.keys(schema)) {
  if (t.startsWith('TBL_')) {
    console.log(`=== ${t} ===`);
    if(schema[t][0]) console.log("Headers:", schema[t][0].join(', '));
    for (let i = 1; i < Math.min(3, schema[t].length); i++) {
      console.log(`Row ${i}:`, schema[t][i].join(', '));
    }
  }
}
