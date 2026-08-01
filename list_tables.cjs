const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

console.log("Tables:");
Object.keys(schema).forEach(t => console.log(t));
