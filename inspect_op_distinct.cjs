const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("=== BUR_TBL_009 Distinct Values ===");
const bur9 = schema['BUR_TBL_009'];
if (bur9) {
  const headers = bur9[0];
  const col4Idx = headers.indexOf('Field_004');
  const col10Idx = headers.indexOf('Field_010');
  const col20Idx = headers.indexOf('Field_020'); // we saw this had "صندوق_*: 11001"
  
  const f4Values = new Set();
  const f10Values = new Set();
  const f20Values = new Set();

  for (let i = 1; i < bur9.length; i++) {
    const row = bur9[i];
    f4Values.add(row[col4Idx]);
    f10Values.add(row[col10Idx]);
    f20Values.add(row[col20Idx]);
  }

  console.log("Field_004 (عامل?):", Array.from(f4Values));
  console.log("Field_010 (محل عملیات ID?):", Array.from(f10Values));
  console.log("Field_020 (محل عملیات Name?):", Array.from(f20Values));
}
