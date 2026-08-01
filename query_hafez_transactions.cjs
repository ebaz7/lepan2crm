const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const query = `
      SELECT 
        t9.Field_001 as RowId,
        t9.Field_003 as SanadId,
        t9.Field_004 as SanadNo,
        t9.Field_005 as SanadRow,
        t9.Field_006 as FiscalYear,
        t9.Field_007 as MoeinCode,
        t9.Field_009 as Bed,
        t9.Field_010 as Bes,
        t9.Field_011 as Description,
        t9.Field_015 as TafsiliRaw,
        t8.Field_008 as SanadDate
      FROM ACT_TBL_009 t9
      LEFT JOIN ACT_TBL_008 t8 ON t9.Field_004 = t8.Field_006 AND t9.Field_003 = t8.Field_004
      WHERE t9.Field_015 LIKE '%2447%' OR t9.Field_014 LIKE '%2447%'
      ORDER BY t8.Field_008 ASC, t9.Field_001 ASC
    `;
    
    const res = await axios.post(url, { query }, { headers });
    console.log("All transactions for Hafez Darya (2447):");
    console.log(res.data.data);
  } catch(e) {
    console.error("Error:", e.response?.data || e.message);
  }
}

run();
