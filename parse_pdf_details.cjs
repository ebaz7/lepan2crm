const fs = require('fs');
const pdf = require('pdf-parse');

async function main() {
  const d1 = await pdf(fs.readFileSync('doc1.pdf'));
  console.log("=== DOC1 TOTAL PAGES ===", d1.numpages);
  fs.writeFileSync('doc1_full.txt', d1.text);

  const d2 = await pdf(fs.readFileSync('doc2.pdf'));
  console.log("=== DOC2 TOTAL PAGES ===", d2.numpages);
  fs.writeFileSync('doc2_full.txt', d2.text);

  console.log("=== DOC1 END OF FILE (Last 2000 chars) ===");
  console.log(d1.text.substring(d1.text.length - 2000));

  console.log("=== DOC2 END OF FILE (Last 2000 chars) ===");
  console.log(d2.text.substring(d2.text.length - 2000));
}

main().catch(console.error);
