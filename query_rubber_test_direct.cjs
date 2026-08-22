const axios = require('axios');

const url = 'http://80.210.31.176:5000/api/external/v1/query';
const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa', 'Content-Type': 'application/json' };

async function run() {
    // Let's get all transactions for rubber (0104%) in 1404
    const sql = `
        SELECT 
            t11.Field_005 as ItemCode,
            COALESCE(s04.Field_003, t22.Field_004, N'کالای بدون نام') as ItemName,
            RTRIM(LTRIM(t10.Field_009)) as DocType,
            t11.Field_006 as Quantity,
            t10.Field_008 as DocDate,
            t10.Field_005 as DocNo
        FROM STR_TBL_011 t11
        INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004 
                                  AND t11.Field_012 = t10.Field_018
        LEFT JOIN STR_TBL_004 s04 ON RTRIM(LTRIM(s04.Field_004)) = RTRIM(LTRIM(t11.Field_005))
        LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
        WHERE t10.Field_008 >= '2025-03-21T00:00:00.000Z'
          AND t10.Field_008 <= '2026-03-20T23:59:59.000Z'
          AND t11.Field_005 LIKE '0104%'
    `;

    try {
        const response = await axios.post(url, { query: sql }, { headers });
        const rows = response.data.data || [];
        console.log("Total rows found for 1404 rubber:", rows.length);
        
        // 1. Let's calculate sums using different formulas
        // Let's group by ItemCode and see each item's stock
        const grouped = {};
        let grandTotalFormulaStandard = 0; // IN('10','13') - IN('3','12','23')
        let grandTotalOnlyInflows = 0;     // Only IN('10','13')
        let grandTotalStandardPlusReturns = 0; // IN('10','13','12') - IN('3','23') -- assuming 12 is Sales Return and increases stock? Wait!
        let grandTotalAlternative = 0; // IN('10', '13') - IN('3', '23') -- ignoring '12'
        let grandTotalCustom1 = 0; // IN('10') - IN('3', '23') -- only receipt minus issues

        // DocTypes found
        const docTypes = new Set();

        rows.forEach(r => {
            const code = r.ItemCode;
            const docType = r.DocType;
            const qty = parseFloat(r.Quantity) || 0;
            docTypes.add(docType);

            if (!grouped[code]) {
                grouped[code] = { name: r.ItemName, rows: [], totalQty: 0 };
            }
            grouped[code].rows.push(r);

            // Standard formula:
            // Receipts (10, 13) are plus, Issues (3, 12, 23) are minus
            if (['10', '13'].includes(docType)) {
                grandTotalFormulaStandard += qty;
            } else if (['3', '12', '23'].includes(docType)) {
                grandTotalFormulaStandard -= qty;
            }

            // Only inflows
            if (['10', '13'].includes(docType)) {
                grandTotalOnlyInflows += qty;
            }

            // Custom 1
            if (['10'].includes(docType)) {
                grandTotalCustom1 += qty;
            } else if (['3', '23'].includes(docType)) {
                grandTotalCustom1 -= qty;
            }
        });

        console.log("DocTypes present in 1404 rubber:", Array.from(docTypes));
        console.log("-----------------------------------------");
        console.log("Grand Total (Standard Formula):", grandTotalFormulaStandard);
        console.log("Grand Total (Only Inflows):", grandTotalOnlyInflows);
        console.log("Grand Total (Custom 1):", grandTotalCustom1);
        
        // Let's print out the sum by DocType to see exactly what we have!
        const sumByDocType = {};
        rows.forEach(r => {
            const dt = r.DocType;
            const qty = parseFloat(r.Quantity) || 0;
            sumByDocType[dt] = (sumByDocType[dt] || 0) + qty;
        });
        console.log("Sums by DocType:", sumByDocType);

        // Let's test different combinations of plus/minus to see which one equals exactly 43924.26
        console.log("\n---- Testing Combinations to find 43924.26 ----");
        const docTypeKeys = Object.keys(sumByDocType);
        // We will generate all combinations of + / - / 0 for each docType
        const combCount = Math.pow(3, docTypeKeys.length);
        const target = 43924.26;
        const tolerance = 1.0; // 1 kg tolerance
        
        for (let i = 0; i < combCount; i++) {
            let currentSum = 0;
            let val = i;
            const formula = {};
            for (let j = 0; j < docTypeKeys.length; j++) {
                const key = docTypeKeys[j];
                const signVal = val % 3;
                val = Math.floor(val / 3);
                
                let sign = 0;
                if (signVal === 1) sign = 1;
                else if (signVal === 2) sign = -1;
                
                formula[key] = sign;
                currentSum += sign * sumByDocType[key];
            }
            if (Math.abs(currentSum - target) < tolerance) {
                console.log(`FOUND COMBINATION! Sum = ${currentSum} (Target: ${target})`);
                console.log("Formula details:", formula);
            }
        }

    } catch (e) {
        console.error("Error executing query:", e.message);
    }
}

run();
