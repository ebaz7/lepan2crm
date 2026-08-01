const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
['ACT_TBL_010', 'ACT_TBL_011', 'ACT_TBL_001', 'ACT_TBL_002', 'GNR_TBL_010', 'GNR_TBL_011'].forEach(tbl => {
   if(schema[tbl]) console.log(`${tbl} Headers:`, schema[tbl][0]);
});
