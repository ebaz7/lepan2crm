const axios = require('axios');

async function run() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

    // Query all OpCode 12 and 13 documents in Farvardin 1405
    const sql = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_004 as DocType,
            t10.Field_005 as StrId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_009 as OpCode,
            t10.Field_029 as Notes,
            t10.Field_037 as HeaderPayable,
            t11.Field_003 as DetailDocType,
            t11.Field_004 as DetailStrId,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            t11.Field_007 as Amount,
            t11.Field_031 as ItemNotes
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004 AND t11.Field_001 = t10.Field_001 -- wait! How is t11 joined to t10?
    `;
    
    // Let's test the join condition!
    // In AccountingReports.tsx and server.js, the join was:
    // INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004 AND ...
    // Wait! Is Field_001 the Document Header ID?
}
