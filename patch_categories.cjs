const fs = require('fs');
let code = fs.readFileSync('components/sales/SayanSalesDashboard.tsx', 'utf8');

// 1. Remove MAJOR_CATEGORIES initialization
code = code.replace(/    \/\/ Initialize all 15 Major Categories to preserve order[\s\S]*?    \}\);\n/m, '');

// 2. Change classifyMajorCategory to just return groupName or 'سایر'
const oldClassify = `export function classifyMajorCategory(groupName: string = '', itemName: string = ''): string {
  const text = \`\${groupName} \${itemName}\`.toLowerCase();
  
  if (text.includes('کاور') || text.includes('کاورینگ') || (text.includes('اسپاندکس') && text.includes('کاور'))) return 'اسپاندکس (کاور)';
  if (text.includes('ساپورت') || text.includes('پوشش') || (text.includes('اسپاندکس') && text.includes('پوشش'))) return 'اسپاندکس پوشش (ساپورت)';
  if (text.includes('شواتیز') || (text.includes('پلی استر') && text.includes('شواتیز'))) return 'پلی استر شواتیز';
  if (text.includes('120') || text.includes('۱۲۰')) return 'نخ ۱۲۰ پلی استر';
  if (text.includes('180') || text.includes('۱۸۰') || text.includes('اسپان')) return 'نخ ۱۸۰ پلی استر اسپان';
  if (text.includes('fdy') || text.includes('اف دی ای')) return 'FDY';
  if (text.includes('poy') || text.includes('پی او وای')) return 'POY';
  if (text.includes('ملت') || text.includes('melt')) return 'نخ ملت';
  if (text.includes('نایلون') || text.includes('nylon')) return 'نایلون';
  if (text.includes('چیپس') || text.includes('chip')) return 'چیپس';
  if (text.includes('لایکرا') || text.includes('lycra')) return 'لایکرا';
  if (text.includes('لاکرا')) return 'لاکرا';
  if (text.includes('مستربچ') || text.includes('masterbatch')) return 'مستربچ';
  if (text.includes('لاستیک') || text.includes('rubber')) return 'لاستیک';
  if (text.includes('کش') || text.includes('elastic')) return 'کش';
  if (text.includes('اسپاندکس') || text.includes('spandex')) return 'اسپاندکس (کاور)';

  return groupName || 'سایر محصولات';
}`;

const newClassify = `export function classifyMajorCategory(groupName: string = '', itemName: string = ''): string {
  return groupName ? groupName.trim() : 'سایر محصولات';
}`;

code = code.replace(oldClassify, newClassify);

// 3. Fix Mode 1 group comparison rows (Predefined Major Categories + active dynamic categories)
code = code.replace(/const activeCategoriesSet = new Set<string>\(MAJOR_CATEGORIES\);/g, 'const activeCategoriesSet = new Set<string>();');

// 4. Sort categoryList by netAmt descending
const oldSort = `    const categoryList = Array.from(categoryMap.values()).map(c => {`;
const newSort = `    const categoryList = Array.from(categoryMap.values()).map(c => {`;
// Wait, we can just sort categoryList after mapping
const oldCatListSort = `        sharePct: sSharePct
      };
    });

    itemsList.sort((a, b) => b.netAmt - a.netAmt);

    return {
      name: c.name,
      salesAmt: c.salesAmt,
      salesWgt: c.salesWgt,
      retAmt: c.retAmt,
      retWgt: c.retWgt,
      netAmt,
      netWgt,
      netFee,
      sharePct,
      items: itemsList
    };
  });`;

const newCatListSort = `        sharePct: sSharePct
      };
    });

    itemsList.sort((a, b) => b.netAmt - a.netAmt);

    return {
      name: c.name,
      salesAmt: c.salesAmt,
      salesWgt: c.salesWgt,
      retAmt: c.retAmt,
      retWgt: c.retWgt,
      netAmt,
      netWgt,
      netFee,
      sharePct,
      items: itemsList
    };
  }).sort((a, b) => b.netAmt - a.netAmt);`;

code = code.replace(oldCatListSort, newCatListSort);

fs.writeFileSync('components/sales/SayanSalesDashboard.tsx', code);
