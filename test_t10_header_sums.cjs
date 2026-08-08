const axios = require('axios');
const jalaali = require('jalaali-js');

async function run() {
    const fromG = jalaali.toGregorian(1405, 1, 1);
    const toG = jalaali.toGregorian(1405, 1, 31);
    const gregFrom = `${fromG.gy}-${String(fromG.gm).padStart(2, '0')}-${String(fromG.gd).padStart(2, '0')}`;
    const gregTo = `${toG.gy}-${String(toG.gm).padStart(2, '0')}-${String(toG.gd).padStart(2, '0')}`;

    const sql = `
        SELECT 
            SUM(CAST(t10.Field_026 AS FLOAT)) as SumT10_F26,
            SUM(CAST(t10.Field_037 AS FLOAT)) as SumT10_F37,
            SUM(CAST(t10.Field_040 AS FLOAT)) as SumT10_F40
        FROM STR_TBL_010 t10
        WHERE t10.Field_009 = '12'
          AND t10.Field_008 >= '${gregFrom}T00:00:00.000Z' AND t10.Field_008 <= '${gregTo}T23:59:59.999Z'
    `;

    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
        query: sql
    }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});

    console.log("STR_TBL_010 header sums (op 12):", res.data.data[0]);
}
run();
