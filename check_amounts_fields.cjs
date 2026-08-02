const axios = require('axios');
async function run() {
    // Select both Field_007 and Field_037 from STR_TBL_011 to see which one contains the price / amount
    const sql = `
        SELECT TOP 20
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_009 as OpCode,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            t11.Field_007 as Field7,
            t11.Field_037 as Field37,
            t11.Field_031 as ItemNotes
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
        WHERE t10.Field_008 >= '2025-03-21T00:00:00.000Z' AND t10.Field_008 <= '2025-04-13T23:59:59.000Z'
          AND t10.Field_009 IN ('3', '12', '23')
        ORDER BY t10.Field_008 ASC
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Rows:", res.data.data);
    } catch(e) {
        console.error(e.message);
    }
}
run();
