const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema_output2.json', 'utf8'));
['GNR_TBL_011', 'GNR_TBL_012', 'GNR_TBL_013', 'GNR_TBL_014', 'GNR_TBL_020', 'GNR_TBL_021', 'ACT_TBL_007', 'ACT_TBL_008'].forEach(tbl => {
    if(schema[tbl]) {
        console.log(`${tbl} Headers:`, schema[tbl][0]);
    }
});
