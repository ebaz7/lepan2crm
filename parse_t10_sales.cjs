const fs = require('fs');
const db = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
const cols10 = db['STR_TBL_010'][0];
let salesDoc = null;
for(let i=1; i<db['STR_TBL_010'].length; i++) {
  const row = db['STR_TBL_010'][i];
  if(row[5] === '15' || row[5] === '19') { // Field_006 is index 5
    salesDoc = row;
    break;
  }
}
let obj = {};
cols10.forEach((c, idx) => obj[c] = salesDoc[idx]);
console.log("Sales Doc STR_TBL_010:", obj);

const cols11 = db['STR_TBL_011'][0];
const salesId = obj.Field_001;
for(let i=1; i<db['STR_TBL_011'].length; i++) {
  const row = db['STR_TBL_011'][i];
  if(row[2] === salesId) { // Field_004 is index 2?
    let obj11 = {};
    cols11.forEach((c, idx) => obj11[c] = row[idx]);
    console.log("Sales Details STR_TBL_011:", obj11);
    break;
  }
}
