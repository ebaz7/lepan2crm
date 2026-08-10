const fs = require('fs');
const pdf = require('pdf-parse');

async function parse() {
  const data1 = await pdf(fs.readFileSync('file1.pdf'));
  console.log("=== FILE 1 ===");
  console.log(data1.text.substring(0, 1500));
  
  const data2 = await pdf(fs.readFileSync('file2.pdf'));
  console.log("\n=== FILE 2 ===");
  console.log(data2.text.substring(0, 1500));
}
parse().catch(console.error);
