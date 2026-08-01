const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

const t7 = schema['ACT_TBL_007'] || [];
console.log("Total rows in ACT_TBL_007:", t7.length);

const matches = t7.filter(row => {
  const str = JSON.stringify(row);
  return str.includes('447') || str.includes('2447') || str.includes('حافظ') || str.includes('کشتیرانی');
});

console.log("Matching rows in ACT_TBL_007:", matches);

// Check if we have any other table like ACT_TBL_009 containing 2447 or 112447
const t9 = schema['ACT_TBL_009'] || [];
console.log("Total rows in ACT_TBL_009:", t9.length);
let count9 = 0;
for (let i = 1; i < t9.length; i++) {
  const str = JSON.stringify(t9[i]);
  if (str.includes('2447') || str.includes('447')) {
    count9++;
    if (count9 <= 5) {
      console.log(`ACT_TBL_009 row ${i}:`, t9[i]);
    }
  }
}
console.log("Total matches in ACT_TBL_009:", count9);
