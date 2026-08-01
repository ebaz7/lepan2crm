const fs = require('fs');
const db = JSON.parse(fs.readFileSync('schema_output.json', 'utf8'));
if(db['BUR_TBL_001']) console.log("BUR_TBL_001 cols:", db['BUR_TBL_001']);
if(db['BUR_TBL_002']) console.log("BUR_TBL_002 cols:", db['BUR_TBL_002']);
