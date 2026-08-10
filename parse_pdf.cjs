const fs = require('fs');
const pdf = require('pdf-parse');

async function parse(file) {
  console.log(`\n=================== ${file} ===================`);
  let dataBuffer = fs.readFileSync(file);
  let data = await pdf(dataBuffer);
  console.log(data.text);
}

async function main() {
  await parse('doc1.pdf');
  await parse('doc2.pdf');
}

main().catch(console.error);
