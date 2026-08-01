const axios = require('axios');
async function run() {
    const sql = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_007 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_029 as Notes,
            t11.Field_005 as ItemCode,
            t22.Field_004 as ItemName,
            t11.Field_006 as Quantity,
            t11.Field_031 as ItemNotes,
            t11.Field_037 as Amount,
            t02.Field_003 as GroupName,
            t07.Field_006 as CustomerName
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_006 
                                  AND t11.Field_003 = t10.Field_004
        LEFT JOIN IND_TBL_022 t22 ON t11.Field_005 = t22.Field_005
        LEFT JOIN IND_TBL_021 t21 ON t11.Field_005 = t21.Field_004
        LEFT JOIN IND_TBL_002 t02 ON t21.Field_003 = t02.Field_008
        LEFT JOIN ACT_TBL_007 t07 ON t10.Field_010 = t07.Field_005 AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
        WHERE t10.Field_009 IN ('3', '12', '23')
          AND t11.Field_036 = t10.Field_009
          AND t10.Field_008 >= '2026-07-19T00:00:00.000Z'
        ORDER BY t10.Field_008 DESC
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Success! Count:", res.data.data ? res.data.data.length : 0);
        if (res.data.data) {
            console.log(JSON.stringify(res.data.data, null, 2));
        }
    } catch(e) {
        if (e.response) {
            console.error("Response Error:", e.response.status, e.response.data);
        } else {
            console.error("Error:", e.message);
        }
    }
}
run();
