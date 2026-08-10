const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

async function main() {
  console.log("--- Testing t11.Field_036 = t10.Field_009 for OpCode 12 and 13 in 1405 ---");
  const items = await query(`
    SELECT 
      COALESCE(t22.Field_004, t02.Field_003) as ItemName,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_006 ELSE 0 END) as Qty12,
      SUM(CASE WHEN t10.Field_009 = '12' THEN t11.Field_007 ELSE 0 END) as Amt12,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_006 ELSE 0 END) as Qty13,
      SUM(CASE WHEN t10.Field_009 = '13' THEN t11.Field_007 ELSE 0 END) as Amt13
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN IND_TBL_021 t21 ON RTRIM(LTRIM(t21.Field_004)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN IND_TBL_002 t02 ON t02.Field_008 = t21.Field_003
    WHERE t10.Field_008 >= '2026-03-21T00:00:00.000Z' AND t10.Field_008 <= '2026-08-08T23:59:59.000Z'
      AND (
        (t10.Field_009 = '12' AND t11.Field_036 = '12')
        OR
        (t10.Field_009 = '13' AND t11.Field_036 = '13')
      )
    GROUP BY COALESCE(t22.Field_004, t02.Field_003)
  `);
  
  console.log("Matching items from doc1.pdf:");
  const targets = [
    'FDY 50/24',
    'POY 160/48 سفید',
    'POY 160/48 مشکی',
    'POY 500/96 سفید',
    'اسپاندکس جوشی FSE )ساپورت سفید(',
    'اسپاندکس سفید )P( )کاور HFT('
  ];
  items.filter(i => targets.some(t => i.ItemName && i.ItemName.includes(t.split(' ')[0]))).forEach(i => console.log(i));
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
