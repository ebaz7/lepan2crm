const fs = require('fs');

const schema = JSON.parse(fs.readFileSync('schema_output.json', 'utf8'));

console.log("=== Searching columns in BUR_TBL_009 and BUR_TBL_012 ===");

function searchTerms(tableName) {
  const table = schema[tableName];
  if (!table) return;
  console.log(`\nTable: ${tableName}`);
  table.forEach(col => {
    // If it contains columns
    console.log("  Column:", col);
  });
}

searchTerms('BUR_TBL_009');
searchTerms('BUR_TBL_012');
