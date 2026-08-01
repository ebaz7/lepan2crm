const axios = require('axios');
async function run() {
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: `
                SELECT TOP 5 
                    t24.Field_001 as ItemID,
                    t24.Field_008 as SanadID,
                    t24.Field_011 as FiscalYear,
                    t24.Field_006 as Bed,
                    t24.Field_007 as Bes,
                    t10.Field_006 as SanadNo,
                    t10.Field_008 as SanadDate,
                    t10.Field_009 as SomeCode
                FROM ACT_TBL_024 t24
                LEFT JOIN ACT_TBL_010 t10 ON (t24.Field_008 = t10.Field_001 AND t24.Field_011 = t10.Field_003)
                WHERE t24.Field_010 LIKE '11:111883%'
            `
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Statement test:", res.data.data);
    } catch(e) { console.error(e.response?.data || e.message); }
}
run();
