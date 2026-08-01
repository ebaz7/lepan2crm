const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

if (schema['ACT_TBL_009']) {
  const table = schema['ACT_TBL_009'];
  console.log("ACT_TBL_009 Row Count:", table.length);
  const headers = table[0];
  console.log("Headers:", headers);
  
  const col15Idx = headers.indexOf('Field_015');
  const distinctField015 = new Set();
  
  let matchCount = 0;
  for (let i = 1; i < table.length; i++) {
    const val = table[i][col15Idx];
    if (val) {
      distinctField015.add(val);
      if (val.includes('2447') || val.includes('31:') || val.includes('11:')) {
        matchCount++;
        if (matchCount <= 20) {
          console.log(`Row ${i} matching value:`, val, JSON.stringify(table[i]));
        }
      }
    }
  }
  console.log("Distinct Field_015 values sample:", Array.from(distinctField015).slice(0, 15));
  console.log("Total matched rows in schema:", matchCount);
} else {
  console.log("ACT_TBL_009 not found in schema_output2.json");
}
