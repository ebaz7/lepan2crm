const fs = require('fs');
let code = fs.readFileSync('components/sales/SayanSalesDashboard.tsx', 'utf8');

const oldCode = `      return {
        catName,
        grossAmtA: catA.salesAmt,
        retAmtA: catA.retAmt,
        netAmtA: catA.netAmt,
        grossWgtA: catA.salesWgt,
        retWgtA: catA.retWgt,
        netWgtA: catA.netWgt,
        netFeeA: catA.netFee,
        sharePctA,
        grossAmtB,
        retAmtB: retAmtB_row,
        netAmtB: catBNetAmt,
        grossWgtB,
        retWgtB: retWgtB_row,
        netWgtB: catBNetWgt,
        netFeeB: catBNetFee,
        sharePctB,
        diffAmt,
        growthPct,
        diffWgt,
        wgtGrowthPctRow,
        diffFee,
        variance: getVariance(diffAmt, diffWgt, diffFee)
      };
    }).filter(r => Math.abs(r.netAmtA) > 0 || Math.abs(r.netAmtB) > 0);`;

const newCode = `      const subItemKeys = new Set<string>();
      (catA.items || []).forEach((i: any) => subItemKeys.add(i.itemName));
      if (catBRecord && catBRecord.itemsMap) {
        Array.from(catBRecord.itemsMap.keys()).forEach(k => subItemKeys.add(k));
      }

      const itemsList = Array.from(subItemKeys).map(itemName => {
        const subA = (catA.items || []).find((i: any) => i.itemName === itemName) || { salesAmt: 0, retAmt: 0, netAmt: 0, salesWgt: 0, retWgt: 0, netWgt: 0, netFee: 0 };
        const subBRecord = (catBRecord && catBRecord.itemsMap) ? catBRecord.itemsMap.get(itemName) : null;
        
        const subGrossAmtB = subBRecord ? subBRecord.salesAmt : 0;
        const subRetAmtB = subBRecord ? subBRecord.retAmt : 0;
        const subGrossWgtB = subBRecord ? subBRecord.salesWgt : 0;
        const subRetWgtB = subBRecord ? subBRecord.retWgt : 0;
        const subNetAmtB = subGrossAmtB - subRetAmtB;
        const subNetWgtB = subGrossWgtB - subRetWgtB;
        const subNetFeeB = subNetWgtB > 0 ? (subNetAmtB / subNetWgtB) : 0;

        const subDiffAmt = subA.netAmt - subNetAmtB;
        const subGrowthPct = subNetAmtB ? ((subDiffAmt / subNetAmtB) * 100) : 0;
        const subDiffWgt = subA.netWgt - subNetWgtB;
        const subDiffFee = subA.netFee - subNetFeeB;

        const subSharePctA = netAmtA > 0 ? ((subA.netAmt / netAmtA) * 100) : 0;
        const subSharePctB = netAmtB > 0 ? ((subNetAmtB / netAmtB) * 100) : 0;

        return {
          itemName,
          netAmtA: subA.netAmt,
          netWgtA: subA.netWgt,
          netFeeA: subA.netFee,
          sharePctA: subSharePctA,
          netAmtB: subNetAmtB,
          netWgtB: subNetWgtB,
          netFeeB: subNetFeeB,
          sharePctB: subSharePctB,
          diffAmt: subDiffAmt,
          growthPct: subGrowthPct,
          variance: getVariance(subDiffAmt, subDiffWgt, subDiffFee)
        };
      }).sort((a, b) => b.netAmtA - a.netAmtA);

      return {
        catName,
        grossAmtA: catA.salesAmt,
        retAmtA: catA.retAmt,
        netAmtA: catA.netAmt,
        grossWgtA: catA.salesWgt,
        retWgtA: catA.retWgt,
        netWgtA: catA.netWgt,
        netFeeA: catA.netFee,
        sharePctA,
        grossAmtB,
        retAmtB: retAmtB_row,
        netAmtB: catBNetAmt,
        grossWgtB,
        retWgtB: retWgtB_row,
        netWgtB: catBNetWgt,
        netFeeB: catBNetFee,
        sharePctB,
        diffAmt,
        growthPct,
        diffWgt,
        wgtGrowthPctRow,
        diffFee,
        variance: getVariance(diffAmt, diffWgt, diffFee),
        items: itemsList
      };
    }).filter(r => Math.abs(r.netAmtA) > 0 || Math.abs(r.netAmtB) > 0);`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('components/sales/SayanSalesDashboard.tsx', code);
