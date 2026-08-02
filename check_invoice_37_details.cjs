const axios = require('axios');
async function run() {
    // Query invoice 37 details for year 1404 (dates around April 2025)
    const sql = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_009 as OpCode,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            t11.Field_007 as Amount,
            t11.Field_031 as ItemNotes
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
        WHERE t10.Field_006 = '37' 
          AND t10.Field_009 IN ('3', '12', '23', '13')
          AND t10.Field_008 >= '2025-04-01T00:00:00.000Z' AND t10.Field_008 <= '2025-04-30T23:59:59.000Z'
        ORDER BY t10.Field_001, t11.Field_005
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Invoice 37 Items count:", res.data.data ? res.data.data.length : 0);
        console.log("Invoice 37 Items:", JSON.stringify(res.data.data, null, 2));
    } catch(e) {
        console.error(e.message);
    }
}
run();
