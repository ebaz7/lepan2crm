const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

for (const [table, data] of Object.entries(schema)) {
  for (let r = 1; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      if (typeof data[r][c] === 'string' && (data[r][c].includes('بدهی') || data[r][c].includes('اشخاص'))) {
         console.log(`Found match in ${table} Row ${r} Col ${c} (${data[0][c]}) => ${data[r][c]}`);
      }
    }
  }
}
