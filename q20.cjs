const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `
                SELECT TOP 5 
                    t24.Field_001 as ItemID,
                    t24.Field_006 as Bed,
                    t24.Field_010 as Tafsili,
                    t9.Field_004 as SanadID,
                    t9.Field_014 as Date,
                    t9.Field_011 as Desc9,
                    t24.Field_015 as Desc24
                FROM ACT_TBL_024 t24
                LEFT JOIN ACT_TBL_009 t9 ON CAST(t24.Field_001 AS NVARCHAR(MAX)) = CAST(t9.Field_001 AS NVARCHAR(MAX))
                WHERE t24.Field_010 LIKE '11:112237%'
            `
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("ACT_TBL_024 JOIN ACT_TBL_009:", res.data.data);
    } catch(e) { console.error(e.response?.data || e.message); }
}
run();
