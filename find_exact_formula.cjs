const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    const sql = `
        SELECT 
            RTRIM(LTRIM(t10.Field_009)) as DocType,
            t11.Field_006 as Quantity
        FROM STR_TBL_011 t11
        INNER JOIN JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004 
                                  AND t11.Field_012 = t10.Field_018
        WHERE t10.Field_008 >= '2025-03-21T00:00:00.000Z'
          AND t10.Field_008 <= '2026-03-20T23:59:59.000Z'
          AND t11.Field_005 LIKE '0104%'
    `;

    // Wait, let's fix the JOIN syntax error (INNER JOIN JOIN)
    const sqlCorrect = `
        SELECT 
            RTRIM(LTRIM(t10.Field_009)) as DocType,
            t11.Field_006 as Quantity
        FROM STR_TBL_011 t11
        INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004 
                                  AND t11.Field_012 = t10.Field_018
        WHERE t10.Field_008 >= '2025-03-21T00:00:00.000Z'
          AND t10.Field_008 <= '2026-03-20T23:59:59.000Z'
          AND t11.Field_005 LIKE '0104%'
    `;

    try {
        const response = await axios.post(url, { query: sqlCorrect }, { headers });
        const rows = response.data.data || [];
        
        const sumByDocType = {};
        rows.forEach(r => {
            const dt = r.DocType || 'UNKNOWN';
            const qty = parseFloat(r.Quantity) || 0;
            sumByDocType[dt] = (sumByDocType[dt] || 0) + qty;
        });

        console.log("Sums by DocType for 1404:", sumByDocType);
        
        const target = 43924.26;
        const tolerance = 0.5; // 0.5 kg tolerance

        const keys = Object.keys(sumByDocType);
        console.log("Keys to check:", keys);

        // Recursive function to try all combinations (+1, -1, 0)
        function search(index, currentSum, formula) {
            if (index === keys.length) {
                if (Math.abs(currentSum - target) < tolerance) {
                    console.log(`FOUND! Sum = ${currentSum} (diff = ${currentSum - target})`);
                    console.log("Formula:", JSON.stringify(formula));
                }
                return;
            }

            const key = keys[index];
            const val = sumByDocType[key];

            // Try 0
            formula[key] = 0;
            search(index + 1, currentSum, formula);

            // Try +1
            formula[key] = 1;
            search(index + 1, currentSum + val, formula);

            // Try -1
            formula[key] = -1;
            search(index + 1, currentSum - val, formula);
        }

        search(0, 0, {});

    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
