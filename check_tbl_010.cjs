const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
const str10 = schema['STR_TBL_010'];
if (str10) {
    const f004Idx = str10[0].indexOf('Field_004'); // This is what we use as typeId
    const counts = {};
    for (let i = 1; i < str10.length; i++) {
        const val = str10[i][f004Idx];
        counts[val] = (counts[val] || 0) + 1;
    }
    console.log("STR_TBL_010 Field_004 counts:", counts);
}
