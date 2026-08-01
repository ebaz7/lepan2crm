const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("Searching for 80000000...");
for (const [table, data] of Object.entries(schema)) {
  for (let r = 1; r < data.length; r++) {
    for (let c = 0; c < data[r].length; c++) {
      if (data[r][c] === 80000000 || data[r][c] === '80000000' || data[r][c] === 80000 || data[r][c] === '80000') {
         console.log(`Found in ${table} Row ${r} Col ${c} (${data[0][c]})`);
         if (r === 1) {
             console.log(`  Row data: ${data[r].slice(0, 15).join(', ')}`);
         }
      }
    }
  }
}
