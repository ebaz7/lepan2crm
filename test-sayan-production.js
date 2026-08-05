async function test() {
    const gregFrom = '2024-07-22'; // 1403-05-01
    const gregTo = '2024-08-21';   // 1403-05-31
    const sql = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_008 as Date,
            RTRIM(LTRIM(t10.Field_009)) as DocType,
            t11.Field_005 as ItemCode,
            COALESCE(t22.Field_004, t11.Field_031, t_name.ItemName, t11.Field_005, 'کالای بدون نام') as ItemName,
            t11.Field_006 as Quantity
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004 AND t11.Field_036 = t10.Field_009
        LEFT JOIN (
            SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as ItemName
            FROM IND_TBL_021 t21_sub
            LEFT JOIN IND_TBL_002 t02_sub ON t21_sub.Field_003 = t02_sub.Field_008
            GROUP BY t21_sub.Field_004
        ) t_name ON t_name.ItemCode = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        WHERE RTRIM(LTRIM(t10.Field_009)) IN ('61', '67', '79', '73')
          AND t10.Field_008 >= '${gregFrom}T00:00:00.000Z'
          AND t10.Field_008 <= '${gregTo}T23:59:59.999Z'
    `;
    
    const res = await fetch('http://localhost:3000/api/sayan-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            path: '/query',
            method: 'POST',
            body: { query: sql }
        })
    });
    console.log(res.status);
    const data = await res.json();
    console.log(data);
}
test();
