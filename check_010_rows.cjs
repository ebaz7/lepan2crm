const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
const str10 = schema['STR_TBL_010'];
if (str10) {
    const headers = str10[0];
    const data1 = str10[1];
    const data2 = str10[2];
    for (let i = 0; i < headers.length; i++) {
        console.log(`${headers[i]}: ${data1[i]} | ${data2 ? data2[i] : ''}`);
    }
}
