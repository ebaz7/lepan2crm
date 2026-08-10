const fs = require('fs');

const text = fs.readFileSync('pdf_parsed.txt', 'utf8');
const doc1Part = text.split('=================== doc2.pdf ===================')[0];

console.log("=== DOC1 Content snippet ===");
console.log(doc1Part.substring(0, 3000));
