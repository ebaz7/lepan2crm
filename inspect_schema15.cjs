const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("=== BUR_TBL_015 ===");
const bur15 = schema['BUR_TBL_015'];
if (bur15) {
  const headers = bur15[0];
  console.log("Headers:", headers.join(', '));
  for (let i = 1; i < Math.min(5, bur15.length); i++) {
    console.log(`Row ${i}:`, bur15[i].join(', '));
  }
}
