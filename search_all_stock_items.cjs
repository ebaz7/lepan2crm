const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    const sql = `
        SELECT 
            t11.Field_005 as ItemCode,
            COALESCE(
                NULLIF(RTRIM(LTRIM(s04.Field_003)), ''),
                NULLIF(RTRIM(LTRIM(t22.Field_004)), ''),
                NULLIF(RTRIM(LTRIM(t02_exact.Field_003)), ''),
                N'کالای بدون نام'
            ) as ItemName,
            t10.Field_008 as DocDate,
            RTRIM(LTRIM(t10.Field_009)) as DocType,
            t11.Field_006 as Quantity
        FROM STR_TBL_011 t11
        INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004 
                                  AND t11.Field_012 = t10.Field_018
        LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_002 t02_exact ON RTRIM(LTRIM(t02_exact.Field_008)) = RTRIM(LTRIM(t11.Field_005))
        WHERE t10.Field_008 <= '2026-03-20T23:59:59.000Z'
    `;

    try {
        const response = await axios.post(url, { query: sql }, { headers });
        const rows = response.data.data || [];
        
        const items = {};
        rows.forEach(r => {
            const code = r.ItemCode;
            if (!items[code]) {
                items[code] = {
                    name: r.ItemName,
                    bounded1404: 0,
                    cumulative: 0
                };
            }
            
            const dt = r.DocType;
            const qty = parseFloat(r.Quantity) || 0;
            const is1404 = r.DocDate >= '2025-03-21T00:00:00.000Z';
            
            let coef = 0;
            if (['10', '13'].includes(dt)) coef = 1;
            else if (['3', '12', '23'].includes(dt)) coef = -1;
            
            if (is1404) {
                items[code].bounded1404 += coef * qty;
            }
            items[code].cumulative += coef * qty;
        });

        console.log("ALL ITEMS AND THEIR STOCKS IN 1404:");
        for (const [code, info] of Object.entries(items)) {
            if (info.bounded1404 !== 0 || info.cumulative !== 0) {
                console.log(`Code: ${code} | Name: ${info.name} | Bounded 1404: ${info.bounded1404.toFixed(2)} | Cumulative: ${info.cumulative.toFixed(2)}`);
            }
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
