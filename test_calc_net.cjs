const axios = require('axios');
const xlsx = require('xlsx');
const jalaali = require('jalaali-js');

async function run() {
    const wb = xlsx.readFileSync('farvardin_sales.xlsx');
    const excelRows = xlsx.utils.sheet_to_json(wb.Sheets['Data']);

    let excelSalesSum = 0;
    let excelReturnSum = 0;
    excelRows.forEach(r => {
        const op = String(r['کد عملیات']).trim();
        const payable = parseFloat(r['قابل پرداخت'] || 0);
        if (op === '12') excelSalesSum += payable;
        else if (op === '13') excelReturnSum += payable;
    });
    console.log("Excel Sales (Payable) Sum (op 12):", excelSalesSum);
    console.log("Excel Return (Payable) Sum (op 13):", excelReturnSum);
    console.log("Excel Net (Sales - Return):", excelSalesSum - excelReturnSum);

    const fromG = jalaali.toGregorian(1405, 1, 1);
    const toG = jalaali.toGregorian(1405, 1, 31);
    const gregFrom = `${fromG.gy}-${String(fromG.gm).padStart(2, '0')}-${String(fromG.gd).padStart(2, '0')}`;
    const gregTo = `${toG.gy}-${String(toG.gm).padStart(2, '0')}-${String(toG.gd).padStart(2, '0')}`;

    const sql = `
        SELECT 
            t10.Field_001 as RecId,
            t10.Field_004 as WhCode,
            t10.Field_005 as DocId,
            t10.Field_006 as InvoiceNum,
            t10.Field_008 as Date,
            t10.Field_009 as OpCode,
            t11.Field_005 as ItemCode,
            t11.Field_006 as Quantity,
            t11.Field_007 as Amount,
            t11.Field_008 as Discount,
            t11.Field_009 as NetAmount,
            t11.Field_010 as VAT,
            t11.Field_011 as Tax,
            t11.Field_012 as FinalAmount,
            t11.Field_031 as ItemNotes,
            t10.Field_029 as HeaderNotes
        FROM STR_TBL_010 t10
        INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 
                                  AND t11.Field_003 = t10.Field_004
                                  AND t11.Field_036 = t10.Field_009
        WHERE (t10.Field_009 = '12' OR t10.Field_009 = '13')
          AND t10.Field_008 >= '${gregFrom}T00:00:00.000Z' AND t10.Field_008 <= '${gregTo}T23:59:59.999Z'
    `;

    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', {
        query: sql
    }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }});

    const rows = res.data.data || [];
    
    let dbSalesSum = 0;
    let dbReturnSum = 0;
    let dbSalesQty = 0;
    let dbReturnQty = 0;

    const isOfficialSayanInvoice = (row) => {
        const h = row.HeaderNotes || '';
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

    rows.forEach(r => {
        const amt = parseFloat(r.Amount || 0);
        const qty = parseFloat(r.Quantity || 0);
        let baseAmt = amt;
        const isOfficial = isOfficialSayanInvoice(r);
        if (isOfficial) {
            baseAmt = baseAmt * 1.10;
        }
        const op = String(r.OpCode || '').trim();
        if (op === '12') {
            dbSalesSum += baseAmt;
            dbSalesQty += qty;
        } else if (op === '13') {
            dbReturnSum += baseAmt;
            dbReturnQty += qty;
        }
    });

    console.log("DB Calculated Sales Sum:", dbSalesSum);
    console.log("DB Calculated Return Sum:", dbReturnSum);
    console.log("DB Calculated Net Sum:", dbSalesSum - dbReturnSum);
    console.log("DB Calculated Sales Qty (Weight):", dbSalesQty);
    console.log("DB Calculated Return Qty:", dbReturnQty);
    console.log("DB Calculated Net Qty:", dbSalesQty - dbReturnQty);
}
run();
