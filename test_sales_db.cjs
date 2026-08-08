const axios = require('axios');
const jalaali = require('jalaali-js');

async function run() {
    const fromG = jalaali.toGregorian(1405, 1, 1);
    const toG = jalaali.toGregorian(1405, 12, 29);
    
    const fromStr = `${fromG.gy}-${String(fromG.gm).padStart(2, '0')}-${String(fromG.gd).padStart(2, '0')}`;
    const toStr = `${toG.gy}-${String(toG.gm).padStart(2, '0')}-${String(toG.gd).padStart(2, '0')}`;

    const sqlA = `
        SELECT 
            t10.Field_001 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_029 as Notes,
            t10.Field_009 as OpCode,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            t11.Field_031 as ItemNotes
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004
        WHERE (
            (t10.Field_009 = '12' AND t11.Field_007 > 0)
            OR
            (t10.Field_009 = '13')
          )
          AND t10.Field_008 >= '${fromStr}T00:00:00.000Z' AND t10.Field_008 <= '${toStr}T23:59:59.000Z'
    `;

    try {
        const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
            query: sqlA
        }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});
        
        const data = res.data.data || [];
        
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
        
        let officialSalesWgt = 0;
        let officialRetWgt = 0;
        let unofficialSalesWgt = 0;
        let unofficialRetWgt = 0;
        
        data.forEach(row => {
            const qty = parseFloat(row.Quantity || 0);
            const isReturn = String(row.OpCode || '').trim() === '13';
            const official = isOfficialSayanInvoice(row);
            
            if (official) {
                if (isReturn) {
                    officialRetWgt += qty;
                } else {
                    officialSalesWgt += qty;
                }
            } else {
                if (isReturn) {
                    unofficialRetWgt += qty;
                } else {
                    unofficialSalesWgt += qty;
                }
            }
        });
        
        console.log("Official Invoices:");
        console.log(`Sales Weight: ${officialSalesWgt}`);
        console.log(`Returns Weight: ${officialRetWgt}`);
        console.log(`Net Weight: ${officialSalesWgt - officialRetWgt}`);
        
        console.log("\nUnofficial Invoices:");
        console.log(`Sales Weight: ${unofficialSalesWgt}`);
        console.log(`Returns Weight: ${unofficialRetWgt}`);
        console.log(`Net Weight: ${unofficialSalesWgt - unofficialRetWgt}`);
        
    } catch (e) {
        console.error(e);
    }
}

run();
