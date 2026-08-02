const axios = require('axios');
async function run() {
    // We will query for dates from 1404/01/01 (2025-03-21) to 1404/01/24 (2025-04-13)
    const sql = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_029 as Notes,
            t10.Field_009 as OpCode,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            t11.Field_031 as ItemNotes,
            t11.Field_007 as Amount
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004
        WHERE (
            (t10.Field_009 IN ('3', '12', '23') AND t11.Field_007 > 0)
            OR
            (t10.Field_009 IN ('13'))
          )
          AND t10.Field_008 >= '2025-03-21T00:00:00.000Z'
          AND t10.Field_008 <= '2025-04-13T23:59:59.000Z'
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        
        const data = res.data.data || [];
        console.log("Raw items count:", data.length);
        
        const isOfficialSayanInvoice = (row) => {
            const h = row.Notes || '';
            const i = row.ItemNotes || '';
            if (h.includes('نوع: رسمی') || h.includes('نوع:رسمی') || i.includes('نوع: رسمی') || i.includes('نوع:رسمی')) {
                return true;
            }
            if (i.includes('ارزش افزوده:')) {
                const match = i.match(/ارزش افزوده:\s*([0-9]+)/);
                if (match && parseInt(match[1], 10) > 0) return true;
            }
            return false;
        };

        let totalA = 0;
        data.forEach(row => {
            let baseAmt = row.Amount ? parseFloat(row.Amount) : 0;
            const official = isOfficialSayanInvoice(row);
            if (official) {
                baseAmt = baseAmt * 1.10;
            }
            if (row.OpCode === '13') {
                totalA -= baseAmt;
            } else {
                totalA += baseAmt;
            }
        });
        
        console.log("Calculated Net Sales:", totalA);
        console.log("Target is 35737966500");
    } catch(e) {
        console.error(e);
    }
}
run();
