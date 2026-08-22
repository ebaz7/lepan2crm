const axios = require('axios');
async function run() {
  const query = `
    SELECT DISTINCT SUBSTRING(RTRIM(LTRIM(Field_005)), 1, 4) as Prefix, COUNT(*) as Cnt
    FROM STR_TBL_011 t11
    GROUP BY SUBSTRING(RTRIM(LTRIM(Field_005)), 1, 4)
  `;
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log("Distinct prefixes in live stock table:", JSON.stringify(res.data.data, null, 2));
  } catch(e) { console.error(e.message); }
}
run();
