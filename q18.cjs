const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `
                SELECT TOP 5 
                    t24.Field_001 as ItemID,
                    t24.Field_008 as SanadID,
                    t8.Field_001 as T8SanadID,
                    t8.Field_008 as SanadDate
                FROM ACT_TBL_024 t24
                LEFT JOIN ACT_TBL_008 t8 ON t24.Field_008 = CAST(t8.Field_001 AS NVARCHAR(MAX))
                WHERE t24.Field_010 LIKE '11:111883%'
            `
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Statement test 3:", res.data.data);
    } catch(e) { console.error(e.response?.data || e.message); }
}
run();
