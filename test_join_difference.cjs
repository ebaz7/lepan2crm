const axios = require('axios');
async function run() {
    // Let's test the join on Field_005 vs Field_006
    const query = (joinCol) => `
        SELECT TOP 5
            t10.Field_001 as DocId,
            t10.Field_005 as Field5,
            t10.Field_006 as Field6,
            t11.Field_004 as t11_Field4,
            t10.Field_008 as Date
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.${joinCol} AND t11.Field_003 = t10.Field_004
        WHERE t10.Field_008 >= '2025-03-21T00:00:00.000Z' AND t10.Field_009 IN ('3', '12', '23')
    `;
    try {
        const res5 = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: query('Field_005')
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Join on Field_005 sample:", res5.data.data);

        const res6 = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: query('Field_006')
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Join on Field_006 sample:", res6.data.data);
    } catch(e) {
        console.error(e.message);
    }
}
run();
