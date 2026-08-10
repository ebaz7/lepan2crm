const axios = require('axios');
async function run() {
  const query = `
    SELECT 
      t10.Field_001 as DocId,
      t10.Field_006 as InvoiceNum,
      t10.Field_009 as OpCode,
      t10.Field_010 as DocType,
      t11.Field_005 as ItemCode,
      t11.Field_006 as Quantity,
      t11.Field_007 as Amount,
      t10.Field_008 as Date,
      t22.Field_004 as ItemName
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
    WHERE t10.Field_008 >= '2026-03-21T00:00:00.000Z'
      AND (t11.Field_007 = 837978000 OR t11.Field_006 = 992 OR t11.Field_006 = 992.000)
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
