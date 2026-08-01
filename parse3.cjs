const fs = require('fs');
const db = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
const cols = db['STR_TBL_011'][0];
for (let i = 1; i <= 5; i++) {
  const row = db['STR_TBL_011'][i];
  let obj = {};
  cols.forEach((c, idx) => obj[c] = row[idx]);
  console.log(obj);
}
