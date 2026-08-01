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
                    t8.Field_006 as SanadNo,
                    t8.Field_008 as SanadDate,
                    t8.Field_005 as SanadAtf
                FROM ACT_TBL_024 t24
                LEFT JOIN ACT_TBL_008 t8 ON (t24.Field_008 = t8.Field_001 AND t24.Field_011 = t8.Field_004)
                WHERE t24.Field_010 LIKE '11:111883%'
            `
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        console.log("Statement test 2:", res.data.data);
    } catch(e) { console.error(e.response?.data || e.message); }
}
run();
