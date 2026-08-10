const axios = require('axios');
async function run() {
  const query = `
    SELECT 
      t11.Field_005 as ItemCode,
      t22.Field_004 as ItemName,
      SUM(t11.Field_006) as TotalQty, 
      SUM(t11.Field_007) as TotalAmt
    FROM STR_TBL_011 t11
    LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
    WHERE t11.Field_004 = '264' AND t11.Field_003 = '3'
    GROUP BY t11.Field_005, t22.Field_004
  `;
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, {
        headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
    });
    console.log(res.data.data);
  } catch (e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
run();
