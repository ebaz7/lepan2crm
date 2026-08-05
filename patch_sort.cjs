const fs = require('fs');
let code = fs.readFileSync('components/sales/SayanSalesDashboard.tsx', 'utf8');

const oldCode = `      }).filter(item => Math.abs(item.netAmt) > 0 || Math.abs(item.netWgt) > 0);

      return {
        name: c.name,
        salesWgt: c.salesWgt,
        retWgt: c.retWgt,
        netWgt,
        salesAmt: c.salesAmt,
        retAmt: c.retAmt,
        netAmt,
        netFee,
        sharePct,
        items: itemsList
      };
    }).filter(c => Math.abs(c.netAmt) > 0 || Math.abs(c.netWgt) > 0 || c.salesAmt > 0);`;

const newCode = `      }).filter(item => Math.abs(item.netAmt) > 0 || Math.abs(item.netWgt) > 0);

      itemsList.sort((a, b) => b.netAmt - a.netAmt);

      return {
        name: c.name,
        salesWgt: c.salesWgt,
        retWgt: c.retWgt,
        netWgt,
        salesAmt: c.salesAmt,
        retAmt: c.retAmt,
        netAmt,
        netFee,
        sharePct,
        items: itemsList
      };
    }).filter(c => Math.abs(c.netAmt) > 0 || Math.abs(c.netWgt) > 0 || c.salesAmt > 0)
      .sort((a, b) => b.netAmt - a.netAmt);`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('components/sales/SayanSalesDashboard.tsx', code);
