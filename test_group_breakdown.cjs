const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z'];

  console.log("=== Group & Unit breakdown for HeaderOp 12 in 1405 ===");

  const groups = await query(`
    SELECT 
      t02.Field_003 as GroupName,
      t02_parent.Field_003 as ParentGroup,
      t11.Field_036 as LineOp,
      COUNT(*) as Cnt,
      SUM(t11.Field_006) as TotalQty,
      SUM(t11.Field_007) as TotalAmt
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    LEFT JOIN IND_TBL_021 t21 ON RTRIM(LTRIM(t21.Field_004)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN IND_TBL_002 t02 ON t02.Field_008 = t21.Field_003
    LEFT JOIN IND_TBL_002 t02_parent ON t02.Field_009 = t02_parent.Field_008
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND t10.Field_009 = '12'
    GROUP BY t02.Field_003, t02_parent.Field_003, t11.Field_036
    ORDER BY TotalQty DESC
  `);
  
  console.table(groups);
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
