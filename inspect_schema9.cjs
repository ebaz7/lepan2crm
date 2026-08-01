const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("=== BUR_TBL_009 ===");
const bur9 = schema['BUR_TBL_009'];
if (bur9) {
  const headers = bur9[0];
  console.log("Headers:", headers.join(', '));
  for (let i = 1; i < Math.min(5, bur9.length); i++) {
    console.log(`Row ${i}:`, bur9[i].join(', '));
  }
}
