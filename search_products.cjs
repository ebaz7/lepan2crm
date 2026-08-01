const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("Looking for product name tables...");
for (const [table, data] of Object.entries(schema)) {
  let found = 0;
  for (let r = 1; r < data.length && r < 50; r++) {
    for (let c = 0; c < data[r].length; c++) {
      if (typeof data[r][c] === 'string' && data[r][c].includes('نخ')) {
         found++;
      }
    }
  }
  if (found > 0) {
     console.log(`Table ${table} has ${found} occurrences of 'نخ' in first 50 rows. Example:`);
     console.log(data.slice(0, 3).map(r => r.join(' | ')).join('\n'));
     console.log("---");
  }
}
