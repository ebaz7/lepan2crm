const axios = require('axios');
async function run() {
    // Check mismatches between t11.Field_036 and t10.Field_009
    const sql = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_005 as DocSerial,
            t10.Field_008 as DocDate,
            t10.Field_009 as OpCode,
            t11.Field_001 as ItemId,
            t11.Field_004 as ItemDocSerial,
            t11.Field_036 as ItemOpCode,
            t11.Field_007 as Amount
        FROM STR_TBL_011 t11
        INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
        WHERE t10.Field_008 >= '2025-03-21T00:00:00.000Z'
          AND t10.Field_008 <= '2025-04-13T23:59:59.000Z'
          AND t10.Field_009 IN ('3', '12', '23', '13')
          AND t11.Field_036 != t10.Field_009
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Mismatches found:", res.data.data.length);
        if (res.data.data.length > 0) {
            console.log("Sample mismatch:", res.data.data[0]);
        }
    } catch(e) {
        console.error(e);
    }
}
run();
