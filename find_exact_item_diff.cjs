const fs = require('fs');
const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

// Let's parse all items from doc1_full.txt
function parseDoc1() {
  const text = fs.readFileSync('doc1_full.txt', 'utf8');
  // We want to match lines with item names and their numbers
  // Let's split text and find lines
  return text;
}

async function main() {
  const d1405 = ['2026-03-21T00:00:00.000Z', '2026-08-08T23:59:59.000Z'];

  // Query all item details for OpCode 12 and 13 in 1405 from Sayan DB
  const dbRows = await query(`
    SELECT 
      t10.Field_001 as DocId,
      t10.Field_006 as InvoiceNum,
      t10.Field_008 as Date,
      t10.Field_009 as OpCode,
      t11.Field_036 as LineOp,
      t11.Field_005 as ItemCode,
      COALESCE(t22.Field_004, t02.Field_003, t11.Field_005) as ItemName,
      TRY_CAST(t11.Field_006 AS FLOAT) as Qty,
      TRY_CAST(t11.Field_007 AS FLOAT) as Amt,
      TRY_CAST(t11.Field_010 AS FLOAT) as VAT,
      TRY_CAST(t11.Field_012 AS FLOAT) as FinalAmt
    FROM STR_TBL_010 t10
    JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN IND_TBL_021 t21 ON RTRIM(LTRIM(t21.Field_004)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN IND_TBL_002 t02 ON t02.Field_008 = t21.Field_003
    WHERE t10.Field_008 >= '${d1405[0]}' AND t10.Field_008 <= '${d1405[1]}'
      AND t10.Field_009 IN ('12', '13')
      AND TRY_CAST(t11.Field_007 AS FLOAT) > TRY_CAST(t11.Field_006 AS FLOAT) * 1000
  `);

  console.log("DB Rows count:", dbRows.length);

  // Group by ItemName
  const items = new Map();
  dbRows.forEach(r => {
    const name = r.ItemName;
    if (!items.has(name)) items.set(name, { qty12: 0, amt12: 0, vat12: 0, qty13: 0, amt13: 0, vat13: 0 });
    const e = items.get(name);
    if (r.OpCode === '12') {
      e.qty12 += r.Qty || 0;
      e.amt12 += r.Amt || 0;
      e.vat12 += r.VAT || 0;
    } else if (r.OpCode === '13') {
      e.qty13 += r.Qty || 0;
      e.amt13 += r.Amt || 0;
      e.vat13 += r.VAT || 0;
    }
  });

  console.log("Unique DB items count:", items.size);
  
  // Let's list items and compare with doc1_full.txt
  const doc1Text = parseDoc1();
  console.log("\nChecking which DB items are NOT mentioned in doc1_full.txt:");
  let extraQty = 0;
  let extraAmt = 0;
  items.forEach((val, name) => {
    // Clean name for searching
    const cleanName = name.replace(/\s+/g, ' ').trim();
    if (!doc1Text.includes(cleanName.substring(0, 15))) {
      console.log(`[NOT IN DOC1] ${name}: Qty12 = ${val.qty12}, Amt12 = ${val.amt12}`);
      extraQty += val.qty12;
      extraAmt += val.amt12;
    }
  });
  console.log(`Total Extra Qty NOT in doc1 = ${extraQty}, Extra Amt = ${extraAmt}`);
}

main().catch(err => console.error(err.response ? err.response.data : err.message));
