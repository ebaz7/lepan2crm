const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
const str11 = schema['STR_TBL_011'];
if (str11) {
    const headers = str11[0];
    const data1 = str11[1];
    const data2 = str11[2];
    for (let i = 0; i < headers.length; i++) {
        console.log(`${headers[i]}: ${data1[i]} | ${data2 ? data2[i] : ''}`);
    }
}
