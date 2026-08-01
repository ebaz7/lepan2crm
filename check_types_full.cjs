const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
const types = schema['STR_TBL_006'];
if (types) {
    console.log("Types:");
    for (let i = 0; i < types.length; i++) {
        console.log(types[i][0] + " | " + types[i][1] + " | " + types[i][2]);
    }
} else {
    console.log("No STR_TBL_006 in schema");
}
