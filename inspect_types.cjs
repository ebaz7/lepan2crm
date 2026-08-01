const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

const str006 = schema['STR_TBL_006'] || [];
console.log("STR_TBL_006:");
str006.slice(0, 10).forEach(r => console.log(r.slice(0, 5).join(' | ')));

console.log("\nSTR_TBL_010 types (Field_004 => count):");
const str010 = schema['STR_TBL_010'] || [];
const f004Idx = str010[0].indexOf('Field_004');
const counts = {};
str010.slice(1).forEach(r => {
    const val = r[f004Idx];
    counts[val] = (counts[val] || 0) + 1;
});
console.log(counts);
