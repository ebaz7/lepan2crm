const axios = require('axios');
async function run() {
    const gregFrom = '2025-03-21';
    const sql = `
        SELECT TOP 10
            t10.Field_001 as DocId,
            t10.Field_008 as Date,
            t10.Field_029 as Notes,
            t11.Field_005 as ItemCode,
            t22.Field_004 as ItemName,
            t11.Field_006 as Quantity,
            t11.Field_031 as ItemNotes,
            t11.Field_037 as Amount
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_006 
                                  AND t11.Field_003 = t10.Field_004 
                                  AND t11.Field_036 = t10.Field_009
        LEFT JOIN IND_TBL_022 t22 ON t11.Field_005 = t22.Field_005
        WHERE t10.Field_009 IN ('12', '23')
          AND t10.Field_008 >= '${gregFrom}T00:00:00.000Z'
        ORDER BY t10.Field_008 DESC
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Correct Join Row count:", res.data.data ? res.data.data.length : 0);
        if (res.data.data && res.data.data.length > 0) {
            console.log("Sample correct row:", res.data.data[0]);
        }
    } catch(e) {
        console.error("Error running query:", e.response ? e.response.data : e.message);
    }
}
run();
