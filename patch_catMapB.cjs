const fs = require('fs');
let code = fs.readFileSync('components/sales/SayanSalesDashboard.tsx', 'utf8');

const oldCode1 = `    const catMapB = new Map<string, { salesWgt: number; salesAmt: number; retWgt: number; retAmt: number; }>();`;
const newCode1 = `    const catMapB = new Map<string, { salesWgt: number; salesAmt: number; retWgt: number; retAmt: number; itemsMap: Map<string, { itemName: string; salesWgt: number; salesAmt: number; retWgt: number; retAmt: number; }>; }>();`;

const oldCode2 = `      // Group Map B
      if (!catMapB.has(cat)) {
        catMapB.set(cat, { salesWgt: 0, salesAmt: 0, retWgt: 0, retAmt: 0 });
      }
      const catRecord = catMapB.get(cat)!;
      if (isReturn) {
        catRecord.retWgt += qty; catRecord.retAmt += amt;
      } else {
        catRecord.salesWgt += qty; catRecord.salesAmt += amt;
      }`;
const newCode2 = `      // Group Map B
      if (!catMapB.has(cat)) {
        catMapB.set(cat, { salesWgt: 0, salesAmt: 0, retWgt: 0, retAmt: 0, itemsMap: new Map() });
      }
      const catRecord = catMapB.get(cat)!;
      if (isReturn) {
        catRecord.retWgt += qty; catRecord.retAmt += amt;
      } else {
        catRecord.salesWgt += qty; catRecord.salesAmt += amt;
      }
      if (!catRecord.itemsMap.has(itemKey)) {
        catRecord.itemsMap.set(itemKey, { itemName: row.ItemName || 'کالای بدون نام', salesWgt: 0, salesAmt: 0, retWgt: 0, retAmt: 0 });
      }
      const catSubRecord = catRecord.itemsMap.get(itemKey)!;
      if (isReturn) {
        catSubRecord.retWgt += qty; catSubRecord.retAmt += amt;
      } else {
        catSubRecord.salesWgt += qty; catSubRecord.salesAmt += amt;
      }`;

code = code.replace(oldCode1, newCode1);
code = code.replace(oldCode2, newCode2);

fs.writeFileSync('components/sales/SayanSalesDashboard.tsx', code);
