const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("STR_TBL_006 (Doc Types):");
if(schema['STR_TBL_006']) {
  console.log(schema['STR_TBL_006'].slice(0, 10).map(r => r.join(' | ')).join('\n'));
}

console.log("\nSTR_TBL_010 (Invoices):");
if(schema['STR_TBL_010']) {
  const data = schema['STR_TBL_010'];
  const headers = data[0];
  const f003Idx = headers.indexOf('Field_003');
  const f004Idx = headers.indexOf('Field_004');
  console.log(`Headers: ${headers.join(' | ')}`);
  console.log(data.slice(1, 15).map(r => `Row: F003=${r[f003Idx]}, F004=${r[f004Idx]}`).join('\n'));
}
