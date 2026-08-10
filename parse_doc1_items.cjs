const fs = require('fs');

const doc1 = fs.readFileSync('doc1_full.txt', 'utf8');

// Let's print doc1 text
console.log(doc1);
