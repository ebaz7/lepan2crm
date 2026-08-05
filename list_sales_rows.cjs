const axios = require('axios');
async function run() {
    const sql = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_009 as OpCode,
            t11.Field_001 as ItemId,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            t11.Field_007 as Amount
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004
        WHERE (
            (t10.Field_009 IN ('3', '12', '23') AND t11.Field_007 > 0)
            OR
            (t10.Field_009 IN ('13'))
          )
          AND t10.Field_008 >= '2025-03-21T00:00:00.000Z'
          AND t10.Field_008 <= '2025-04-13T23:59:59.000Z'
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        
        const data = res.data.data || [];
        console.log("Total rows found:", data.length);
        
        // Print distinct DocId
        const docIds = [...new Set(data.map(d => d.DocId))];
        console.log("Distinct DocIds in STR_TBL_010:", docIds.length);
        
        // Let's inspect the dates inside data
        const dates = [...new Set(data.map(d => d.Date))];
        console.log("Distinct dates in data:", dates.sort());
    } catch(e) {
        console.error(e);
    }
}
run();
