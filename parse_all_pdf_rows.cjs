const fs = require('fs');

const doc1 = fs.readFileSync('doc1_full.txt', 'utf8');

// doc1 has 4 pages. Let's inspect all lines in doc1
console.log("=== DOC1 full text snippet ===");
const lines = doc1.split('\n');
console.log("Total lines in DOC1:", lines.length);

// Let's write a script to search for rows in doc1
// In doc1, the table has columns:
// کالا | واحد | فروش روزانه (or عملیات) | ... | فاکتور فروش (مقدار | ارزش افزوده | مبلغ با ارزش افزوده) | مرجوعی فروش (مقدار | ارزش افزوده | مبلغ با ارزش افزوده) | جمع (مقدار | ارزش افزوده | مبلغ با ارزش افزوده)
