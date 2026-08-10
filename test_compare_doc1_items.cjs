const fs = require('fs');
const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z'];

  // Let's get items in DB grouped by item name
  const dbItems = await query(`
    SELECT 
      COALESCE(t22.Field_004, t02.Field_003, t11.Field_005) as ItemName,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_006 ELSE 0 END) as Qty12,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_007 ELSE 0 END) as Amt12,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_006 ELSE 0 END) as Qty13,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_007 ELSE 0 END) as Amt13
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN IND_TBL_021 t21 ON RTRIM(LTRIM(t21.Field_004)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN IND_TBL_002 t02 ON t02.Field_008 = t21.Field_003
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND (
        (t10.Field_009 = '12' AND t11.Field_007 > t11.Field_006 * 1000)
        OR
        (t10.Field_009 = '13' AND t11.Field_007 > t11.Field_006 * 1000)
      )
    GROUP BY COALESCE(t22.Field_004, t02.Field_003, t11.Field_005)
  `);

  console.log("DB Items count:", dbItems.length);

  // Let's print each DB item and its Qty12
  let totalQty12 = 0;
  dbItems.forEach(i => {
    totalQty12 += i.Qty12;
    if (i.Qty12 > 0) {
      console.log(`[DB Item] ${i.ItemName}: Qty12 = ${i.Qty12}, Amt12 = ${i.Amt12}`);
    }
  });
  console.log("Total DB Qty12 =", totalQty12);
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
