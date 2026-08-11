const axios = require('axios');

async function test15Groups() {
    const url = 'http://80.210.31.176:5000/api/external/v1/query';
    const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

    const sql = `
        SELECT 
            t11.Field_005 as ItemCode,
            COALESCE(t_gnr.ItemName, t11.Field_005) as ItemName,
            COALESCE(t_grp15.GroupName, 'سایر گروه‌ها') as GroupName15
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004
                                  AND t11.Field_012 = t10.Field_018
                                  AND t11.Field_036 = t10.Field_009
        LEFT JOIN (
            SELECT RTRIM(LTRIM(Field_003)) as ItemCode, MIN(Field_008) as ItemName
            FROM GNR_TBL_003
            WHERE Field_003 IS NOT NULL AND Field_003 <> ''
            GROUP BY RTRIM(LTRIM(Field_003))
        ) t_gnr ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_gnr.ItemCode))

        LEFT JOIN (
            SELECT RTRIM(LTRIM(Field_003)) as GroupCode, MIN(Field_008) as GroupName
            FROM GNR_TBL_003
            WHERE Field_003 IS NOT NULL AND Field_003 <> ''
            GROUP BY RTRIM(LTRIM(Field_003))
        ) t_grp15 ON SUBSTRING(RTRIM(LTRIM(t11.Field_005)), 1, 4) = t_grp15.GroupCode

        WHERE t10.Field_009 IN ('12', '13')
          AND t10.Field_008 >= '2026-03-21 00:00:00'
          AND t10.Field_008 <= '2026-04-20 23:59:59'
        GROUP BY t11.Field_005, t_gnr.ItemName, t_grp15.GroupName
    `;

    try {
        const res = await axios.post(url, { query: sql }, { headers });
        console.log("=== Testing 15 Groups Mapping ===");
        console.table(res.data.data);
    } catch (e) {
        console.error(e.message);
    }
}

test15Groups();
