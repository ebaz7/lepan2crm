const fs = require('fs');

const sayanTsxPath = 'components/SayanReports.tsx';
let content = fs.readFileSync(sayanTsxPath, 'utf8');

const mappingStr = fs.readFileSync('new_dict.txt', 'utf8');

content = content.replace(
  /const TABLE_DICTIONARY: Record<string, string> = {[\s\S]*?};\n/,
  `const TABLE_DICTIONARY: Record<string, string> = {\n  'invoices': 'لیست فاکتورها (Invoices)',\n${mappingStr}\n};\n`
);

fs.writeFileSync(sayanTsxPath, content);
console.log('Done!');
