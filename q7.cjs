const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
const tables = Object.keys(schema).filter(k => k.startsWith('ACT'));
console.log(tables);
