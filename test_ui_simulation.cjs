const axios = require('axios');

async function query(sql) {
  const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sql }, {
    headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' }
  });
  return res.data.data;
}

const isActualProduct = (row) => {
  if (!row) return false;
  const code = String(row.ItemCode || '').trim();
  const name = String(row.ItemName || '').trim();
  const group = String(row.GroupName || '').trim();

  if (code === '050101' || code === '02020302' || code.startsWith('081001')) {
    return false;
  }

  const lowerName = name.toLowerCase();
  const lowerGroup = group.toLowerCase();

  const keywordsToExclude = [
    'کارتن', 'پالت', 'جعبه', 'حمل', 'کرایه', 'خدمات', 'هزینه', 'دوک خالی', 'کیسه خالی', 'بسته بندی', 'پلاستیک'
  ];

  for (const keyword of keywordsToExclude) {
    if (lowerName.includes(keyword) || lowerGroup.includes(keyword)) {
      return false;
    }
  }

  return true;
};

const allocateSalesRows = (rawRows) => {
  const invMap = new Map();
  rawRows.forEach(row => {
    const docId = row.DocId || 'unknown';
    if (!invMap.has(docId)) invMap.set(docId, []);
    invMap.get(docId).push(row);
  });

  const processed = [];
  invMap.forEach((rows) => {
    const headerPayable = parseFloat(rows[0].HeaderPayable || 0);

    const targetProductRows = rows.filter(r => {
      const code = String(r.ItemCode || '').trim();
      const qty = parseFloat(r.Quantity || 0);
      return qty > 0 && !code.startsWith('081001') && code !== '050101' && code !== '02020302';
    });

    const rowsToDistribute = targetProductRows.length > 0 ? targetProductRows : rows;
    const sumItemAmt = rowsToDistribute.reduce((s, r) => s + parseFloat(r.Amount || 0), 0);
    const sumItemQty = rowsToDistribute.reduce((s, r) => s + parseFloat(r.Quantity || 0), 0);

    rows.forEach(r => {
      const itemAmt = parseFloat(r.Amount || 0);
      const itemQty = parseFloat(r.Quantity || 0);
      const isTarget = rowsToDistribute.includes(r);

      let allocatedAmt = 0;
      if (isTarget && headerPayable > 0) {
        if (sumItemAmt > 0) {
          allocatedAmt = headerPayable * (itemAmt / sumItemAmt);
        } else if (sumItemQty > 0) {
          allocatedAmt = headerPayable * (itemQty / sumItemQty);
        } else {
          allocatedAmt = headerPayable / rowsToDistribute.length;
        }
      } else {
        allocatedAmt = itemAmt;
      }

      processed.push({
        ...r,
        Amount: allocatedAmt.toString()
      });
    });
  });
  return processed;
};

async function testPeriod(dFrom, dTo) {
  const sql = `
    SELECT 
      t10.Field_001 as DocId,
      t10.Field_006 as InvoiceNum,
      t10.Field_008 as Date,
      t10.Field_029 as Notes,
      t10.Field_037 as HeaderPayable,
      t10.Field_009 as OpCode,
      t11.Field_005 as ItemCode,
      COALESCE(t22.Field_004, t_name.ItemName, t11.Field_005, 'کالای بدون نام') as ItemName,
      t11.Field_006 as Quantity,
      t11.Field_031 as ItemNotes,
      t11.Field_007 as Amount,
      t11.Field_008 as Discount,
      t11.Field_009 as NetAmount,
      t11.Field_010 as VAT,
      t11.Field_011 as Tax,
      t11.Field_012 as FinalAmount,
      t_group.GroupName,
      t07.Field_006 as CustomerName
    FROM STR_TBL_010 t10
    INNER JOIN STR_TBL_011 t11 ON t11.Field_004 = t10.Field_005 AND t11.Field_003 = t10.Field_004
    LEFT JOIN IND_TBL_022 t22 ON RTRIM(LTRIM(t22.Field_005)) = RTRIM(LTRIM(t11.Field_005))
    LEFT JOIN (
      SELECT RTRIM(LTRIM(t21_sub.Field_004)) as ItemCode, MIN(t02_sub.Field_003) as ItemName
      FROM IND_TBL_021 t21_sub
      LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
      GROUP BY t21_sub.Field_004
    ) t_name ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_name.ItemCode))
    LEFT JOIN (
      SELECT t21_sub.Field_004 as ItemCode, MIN(COALESCE(t02_grandparent.Field_003, t02_parent.Field_003, t02_sub.Field_003)) as GroupName
      FROM IND_TBL_021 t21_sub
      LEFT JOIN IND_TBL_002 t02_sub ON RTRIM(LTRIM(t21_sub.Field_003)) = RTRIM(LTRIM(t02_sub.Field_008))
      LEFT JOIN IND_TBL_002 t02_parent ON RTRIM(LTRIM(t02_sub.Field_009)) = RTRIM(LTRIM(t02_parent.Field_008))
      LEFT JOIN IND_TBL_002 t02_grandparent ON RTRIM(LTRIM(t02_parent.Field_009)) = RTRIM(LTRIM(t02_grandparent.Field_008))
      GROUP BY t21_sub.Field_004
    ) t_group ON RTRIM(LTRIM(t11.Field_005)) = RTRIM(LTRIM(t_group.ItemCode))
    LEFT JOIN ACT_TBL_007 t07 ON RTRIM(LTRIM(t10.Field_010)) = RTRIM(LTRIM(t07.Field_005)) AND (t07.Field_004 = '11' OR t07.Field_004 = '31')
    WHERE (
        (t10.Field_009 = '12' AND TRY_CAST(t11.Field_007 AS FLOAT) > TRY_CAST(t11.Field_006 AS FLOAT) * 1000)
        OR
        (t10.Field_009 = '13')
      )
      AND RTRIM(LTRIM(t11.Field_005)) NOT IN ('050101', '02020302')
      AND t10.Field_008 >= '${dFrom}T00:00:00.000Z' AND t10.Field_008 <= '${dTo}T23:59:59.000Z'
  `;

  const raw = await query(sql);
  const salesData = allocateSalesRows(raw);

  let rangeSalesAmt = 0, rangeSalesQty = 0, rangeRetAmt = 0, rangeRetQty = 0;
  salesData.forEach(row => {
    const qty = isActualProduct(row) ? (parseFloat(row.Quantity || 0) || 0) : 0;
    const amt = parseFloat(row.Amount || 0);
    const isReturn = row.OpCode === '13';

    if (isReturn) {
      rangeRetAmt += amt;
      rangeRetQty += qty;
    } else {
      rangeSalesAmt += amt;
      rangeSalesQty += qty;
    }
  });

  return {
    salesAmt: Math.round(rangeSalesAmt),
    retAmt: Math.round(rangeRetAmt),
    netAmt: Math.round(rangeSalesAmt - rangeRetAmt),
    salesQty: rangeSalesQty,
    retQty: rangeRetQty,
    netQty: rangeSalesQty - rangeRetQty
  };
}

async function main() {
  console.log("=== UI SIMULATION 1405 ===");
  const r1405 = await testPeriod('2026-03-21', '2026-08-08');
  console.log("Sales Amt with VAT:", r1405.salesAmt.toLocaleString(), " | Target: 2,392,474,573,191");
  console.log("Return Amt with VAT:", r1405.retAmt.toLocaleString(), " | Target: 8,290,234,255");
  console.log("Net Balance Amt:", r1405.netAmt.toLocaleString(), " | Target: 2,384,184,338,936");

  console.log("\n=== UI SIMULATION 1404 ===");
  const r1404 = await testPeriod('2025-03-21', '2025-08-08');
  console.log("Net Balance Amt 1404:", r1404.netAmt.toLocaleString(), " | Target: 31,259,201,479,120");
}

main().catch(console.error);
