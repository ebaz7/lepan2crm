const fs = require('fs');
const db = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
const cols = db['STR_TBL_011'][0];
for (let i = 1; i <= 3; i++) {
  const row = db['STR_TBL_011'][i];
  if (!row) continue;
  let obj = {};
  cols.forEach((c, idx) => {
    obj[c] = typeof row[idx] + " = " + row[idx];
  });
  console.log(obj);
}
