const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

for (const [tableName, rows] of Object.entries(schema)) {
    if (!rows || rows.length < 2) continue;
    let foundStr = [];
    for(let r=1; r<rows.length; r++) {
        for(let c=0; c<rows[r].length; c++) {
            const val = rows[r][c];
            if(typeof val === 'string' && val.length > 2) {
                foundStr.push(val);
            }
        }
    }
    if (foundStr.length > 0) {
        console.log(`${tableName} => ${foundStr.slice(0, 3).join(' | ')}`);
    }
}
