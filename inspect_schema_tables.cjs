const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
console.log("Tables in schema_output2.json:", Object.keys(schema));
