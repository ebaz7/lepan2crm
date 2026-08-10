const axios = require('axios');
const fs = require('fs');

async function download(url, filename) {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } });
    fs.writeFileSync(filename, response.data);
    console.log(`Downloaded ${filename}: ${response.data.length} bytes`);
  } catch (err) {
    console.error(`Error downloading ${filename}:`, err.message);
  }
}

async function main() {
  await download('https://uploadkon.ir/uploads/e4de10_26405-jh-17.pdf', 'doc1.pdf');
  await download('https://uploadkon.ir/uploads/' + encodeURIComponent('101610_26گزارش2.pdf'), 'doc2.pdf');
}

main();
