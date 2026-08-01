const axios = require('axios');
async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };
  const gregDate = '2026-06-29'; // try a date with both sales and returns
  const q = `
        SELECT 
            t10.Field_005 as DocId,
            t11.Field_005 as ItemCode,
            t22.Field_004 as ItemName,
            t11.Field_006 as Quantity,
            t11.Field_007 as Amount,
            t_group.GroupName,
            t10.Field_009 as OpCode
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                   AND t11.Field_003 = t10.Field_004
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN (
            SELECT t21_sub.Field_004 as ItemCode, MIN(COALESCE(t02_parent.Field_003, t02_sub.Field_003)) as GroupName
            FROM IND_TBL_021 t21_sub
            LEFT JOIN IND_TBL_002 t02_sub ON t21_sub.Field_003 = t02_sub.Field_008
            LEFT JOIN IND_TBL_002 t02_parent ON t02_sub.Field_009 = t02_parent.Field_008
            GROUP BY t21_sub.Field_004
        ) t_group ON t11.Field_005 = t_group.ItemCode
        WHERE (
            (t10.Field_009 IN ('3', '12', '23') AND t11.Field_036 = t10.Field_009 AND t11.Field_007 > 0)
            OR 
            (t10.Field_009 = '13' AND t11.Field_036 IN ('3', '12', '23', '13'))
          )
          AND (t10.Field_008 = '${gregDate}' OR t10.Field_008 LIKE '${gregDate}%' OR t10.Field_008 BETWEEN '${gregDate}T00:00:00.000Z' AND '${gregDate}T23:59:59.999Z')
  `;
  try {
    const res = await axios.post(url, { query: q }, { headers });
    let totalSales = 0;
    let totalReturns = 0;
    let totalReturnsAmt = 0;
    res.data.data.forEach(r => {
        if(r.OpCode === '13') { totalReturns += r.Quantity; totalReturnsAmt += r.Amount || 0; }
        else totalSales += r.Quantity;
    });
    console.log("Sales Qty:", totalSales, "Returns Qty:", totalReturns, "Returns Amt:", totalReturnsAmt);
  } catch(e) {}
}
run();
