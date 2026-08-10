const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z'];
  const d1404 = ['2025-03-21T00:00:00.000Z', '2025-08-08T23:59:59.000Z'];

  console.log("=== Testing different filters in STR_TBL_010 / STR_TBL_011 ===");

  // Let's check fields in STR_TBL_010 for filtering: Field_004 (Store/Warehouse), Field_009 (OpCode), Field_003, Field_010 (Customer), Field_024, etc.
  // Also in STR_TBL_011: Field_036 (LineOpCode), Field_005 (ItemCode)
  // Let's list all STR_TBL_010 Field_004 (Warehouse/Store) values in 1405 for OpCode 12 and 13!
  const stores = await query(`
    SELECT 
      t10.Field_004 as StoreCode,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_006 ELSE 0 END) as Qty12,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_007 ELSE 0 END) as Amt12,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_006 ELSE 0 END) as Qty13,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_007 ELSE 0 END) as Amt13
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND t10.Field_009 IN ('12', '13')
    GROUP BY t10.Field_004
  `);
  console.log("Stores breakdown in 1405 (OpCode 12, 13):");
  console.table(stores);

  // Let's also check t11.Field_036 values for OpCode 12 in 1405!
  const lineOps = await query(`
    SELECT 
      t11.Field_036 as LineOp,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_006 ELSE 0 END) as Qty12,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_007 ELSE 0 END) as Amt12
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND t10.Field_009 = '12'
    GROUP BY t11.Field_036
  `);
  console.log("LineOps for OpCode 12 in 1405:");
  console.table(lineOps);
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
