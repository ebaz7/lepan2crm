const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("=== BUR_TBL_009 ===");
const bur9 = schema['BUR_TBL_009'];
if (bur9) {
  const headers = bur9[0];
  console.log("Headers count:", headers.length);
  console.log("Headers:", headers.map((h, i) => `${i}: ${h}`).join(', '));
  
  // Let's look at unique values of Field_004 (index 2), and other fields to see what contains Persian text of "عامل" or "محل عملیات"
  const distinctFields = {};
  headers.forEach((h, idx) => {
    distinctFields[h] = new Set();
  });

  for (let i = 1; i < bur9.length; i++) {
    const row = bur9[i];
    headers.forEach((h, idx) => {
      if (row[idx] !== undefined && row[idx] !== null && String(row[idx]).trim() !== '') {
        distinctFields[h].add(String(row[idx]).trim());
      }
    });
  }

  console.log("\nDistinct count per field:");
  headers.forEach(h => {
    console.log(`${h}: ${distinctFields[h].size} distinct values`);
  });

  // Let's print some examples of rows with text or names
  console.log("\nSample Rows:");
  for (let i = 1; i < Math.min(20, bur9.length); i++) {
    const row = bur9[i];
    const nonEmpties = row.map((val, idx) => `${headers[idx]}: ${val}`).filter((v, idx) => row[idx] !== undefined && row[idx] !== null && String(row[idx]).trim() !== '');
    console.log(`Row ${i}:`, nonEmpties.join(' | '));
  }
}
