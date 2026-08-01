const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));

const searchTerms = ['حافظ', 'کشتیرانی', '112447', '2447', 'حافط', 'کشتيراني', 'کشتی رانی'];

for (const tableName in schema) {
  const table = schema[tableName];
  if (!Array.isArray(table)) continue;
  
  let matchCount = 0;
  for (let i = 0; i < table.length; i++) {
    const rowStr = JSON.stringify(table[i]);
    const matched = searchTerms.some(term => rowStr.includes(term));
    if (matched) {
      matchCount++;
      if (matchCount <= 5) {
        console.log(`Match in table [${tableName}] Row ${i}:`, table[i]);
      }
    }
  }
  if (matchCount > 0) {
    console.log(`--> Table [${tableName}] has total ${matchCount} matching rows.`);
  }
}
