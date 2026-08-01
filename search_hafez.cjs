const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

// Search ACT_TBL_007 (Tafsili/Details)
const t7 = schema['ACT_TBL_007'] || [];
console.log("ACT_TBL_007 columns:", t7[0]);
const hafezRows = t7.filter(row => JSON.stringify(row).includes('حافظ') || JSON.stringify(row).includes('112447') || JSON.stringify(row).includes('2447'));
console.log("Hafez in ACT_TBL_007:", hafezRows);

// Search ACT_TBL_009 (Transactions)
const t9 = schema['ACT_TBL_009'] || [];
const headers = t9[0] || [];
console.log("ACT_TBL_009 columns:", headers);

const matchingRows9 = [];
for (let i = 1; i < t9.length; i++) {
  const rowStr = JSON.stringify(t9[i]);
  if (rowStr.includes('حافظ') || rowStr.includes('112447') || rowStr.includes('2447')) {
    matchingRows9.push({ idx: i, row: t9[i] });
  }
}
console.log(`Found ${matchingRows9.length} matching rows in ACT_TBL_009:`);
matchingRows9.forEach(item => {
  console.log(`Row ${item.idx}:`, item.row);
});
