const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

if (schema['ACT_TBL_007']) {
  const table = schema['ACT_TBL_007'];
  console.log("ACT_TBL_007 Row Count:", table.length);
  console.log("Headers:", table[0]);
  
  // Find distinct values of Field_004
  const col4Idx = table[0].indexOf('Field_004');
  const distinctField004 = {};
  for (let i = 1; i < table.length; i++) {
    const val = table[i][col4Idx];
    distinctField004[val] = (distinctField004[val] || 0) + 1;
  }
  console.log("Distinct Field_004 values:", distinctField004);

  // Print first 10 rows
  console.log("First 15 Rows:");
  for (let i = 1; i < Math.min(16, table.length); i++) {
    console.log(`Row ${i}:`, JSON.stringify(table[i]));
  }
} else {
  console.log("ACT_TBL_007 not found in schema_output2.json");
}
