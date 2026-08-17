const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("=== BUR_TBL_012 ===");
const bur12 = schema['BUR_TBL_012'];
if (bur12) {
  const headers = bur12[0];
  console.log("Headers count:", headers.length);
  console.log("Headers:", headers.map((h, i) => `${i}: ${h}`).join(', '));
  
  const distinctFields = {};
  headers.forEach((h, idx) => {
    distinctFields[h] = new Set();
  });

  for (let i = 1; i < bur12.length; i++) {
    const row = bur12[i];
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

  console.log("\nSample Rows:");
  for (let i = 1; i < Math.min(5, bur12.length); i++) {
    const row = bur12[i];
    const nonEmpties = row.map((val, idx) => `${headers[idx]}: ${val}`).filter((v, idx) => row[idx] !== undefined && row[idx] !== null && String(row[idx]).trim() !== '');
    console.log(`Row ${i}:`, nonEmpties.join(' | '));
  }
}
