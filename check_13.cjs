const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  const q = `
    SELECT TOP 10
      t10.Field_005 as DocId,
      t10.Field_009 as OpCode,
      t10.Field_006 as DocNum,
      t11.*
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_009 = '13' AND t11.Field_007 IS NOT NULL
  `;
  try {
    const res = await axios.post(url, { query: q }, { headers });
    console.log(res.data.data.map(d => ({ q: d.Field_006, amt: d.Field_007, t11Op: d.Field_036, docId: d.DocId, allKeys: Object.keys(d).filter(k => d[k] !== null && d[k] !== '') })));
  } catch(e) {
    console.error(e.message);
  }
}
run();
