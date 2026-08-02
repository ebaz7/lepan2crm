const axios = require('axios');
async function run() {
    // Let's test the total sum for OpCode '12' only
    const sql = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t11.Field_007 as Amount,
            t10.Field_029 as Notes,
            t11.Field_031 as ItemNotes
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004
        WHERE t10.Field_009 = '12'
          AND t10.Field_008 >= '2025-03-21T00:00:00.000Z'
          AND t10.Field_008 <= '2025-04-13T23:59:59.000Z'
        ORDER BY t10.Field_008 ASC
    `;
    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sql
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        
        const data = res.data.data || [];
        console.log("Raw items count for OpCode 12:", data.length);
        
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

        let total = 0;
        data.forEach(row => {
            let baseAmt = row.Amount ? parseFloat(row.Amount) : 0;
            const official = isOfficialSayanInvoice(row);
            if (official) {
                baseAmt = baseAmt * 1.10;
            }
            total += baseAmt;
        });
        
        console.log("OpCode 12 Calculated Sales:", total);
        console.log("Target is 35737966500");
    } catch(e) {
        console.error(e.message);
    }
}
run();
