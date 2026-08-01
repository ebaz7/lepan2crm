const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  
  try {
    const query = `
      SELECT 
        t9.Field_001 as RowId,
        t9.Field_004 as SanadNo,
        t9.Field_005 as GroupCode,
        t9.Field_007 as MoeinCode,
        t9.Field_009 as Bed,
        t9.Field_010 as Bes,
        t9.Field_011 as Description
      FROM ACT_TBL_009 t9
      WHERE (t9.Field_015 LIKE '%2447%' OR t9.Field_014 LIKE '%2447%')
        AND t9.Field_005 <> '9'
    `;
    
    const res = await axios.post(url, { query }, { headers });
    const rows = res.data.data || [];
    
    let totalBed = 0;
    let totalBes = 0;
    console.log("Transactions with GroupCode <> '9':");
    rows.forEach(r => {
      const bed = parseFloat(r.Bed || 0);
      const bes = parseFloat(r.Bes || 0);
      totalBed += bed;
      totalBes += bes;
      console.log(`  Row: Sanad ${r.SanadNo} | Moein ${r.MoeinCode} | Group ${r.GroupCode} | Bed: ${bed} | Bes: ${bes} | Desc: ${r.Description}`);
    });
    console.log("--> Total Bed:", totalBed);
    console.log("--> Total Bes:", totalBes);
    console.log("--> Net Balance (Bed - Bes):", totalBed - totalBes);
  } catch(e) {
    console.error("Error:", e.message);
  }
}

run();
