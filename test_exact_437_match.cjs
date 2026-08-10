const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z'];

  console.log("=== Testing exact match for 437,398.63 kg in 1405 ===");

  // Let's get all item groups in IND_TBL_021 / IND_TBL_002
  const res = await query(`
    SELECT 
      t11.Field_005 as ItemCode,
      COALESCE(t22.Field_004, t02.Field_003, t11.Field_005) as ItemName,
      t02_parent.Field_003 as ParentGroup,
      t02.Field_003 as GroupName,
      SUM(TRY_CAST(t11.Field_006 AS FLOAT)) as Qty,
      SUM(TRY_CAST(t11.Field_007 AS FLOAT)) as Amt
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    LEFT JOIN (SELECT Field_005, MAX(Field_004) as Field_004 FROM IND_TBL_022 GROUP BY Field_005) t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN (
      SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as Field_003, MIN(t02_sub.Field_008) as GroupId
      FROM IND_TBL_021 t21_sub 
      LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008)) 
      GROUP BY t21_sub.Field_004
    ) t02 ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t02.ItemCode))
    LEFT JOIN IND_TBL_002 t02_parent ON t02.GroupId = t02_parent.Field_008
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND t10.Field_009 = '12'
      AND t11.Field_036 = '12'
      AND TRY_CAST(t11.Field_007 AS FLOAT) > TRY_CAST(t11.Field_006 AS FLOAT) * 1000
    GROUP BY t11.Field_005, COALESCE(t22.Field_004, t02.Field_003, t11.Field_005), t02_parent.Field_003, t02.Field_003
  `);

  console.log("Items count:", res.length);
  // Group by ParentGroup / GroupName
  const groupSums = new Map();
  res.forEach(r => {
    const g = r.GroupName || 'No Group';
    if (!groupSums.has(g)) groupSums.set(g, { qty: 0, amt: 0, items: [] });
    const e = groupSums.get(g);
    e.qty += r.Qty;
    e.amt += r.Amt;
    e.items.push(r.ItemName + ` (${r.ItemCode}): Qty=${r.Qty}`);
  });

  console.log("\nGroup Sums:");
  groupSums.forEach((val, key) => {
    console.log(`Group: [${key}] -> Qty = ${val.qty.toFixed(2)}, Amt = ${val.amt.toLocaleString()}`);
  });
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
