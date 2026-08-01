const fs = require('fs');

console.log('Sayan_DB.xlsx size:', fs.statSync('Sayan_DB.xlsx').size);
console.log('dl.xlsx size:', fs.statSync('dl.xlsx').size);
console.log('downloaded_new.xlsx size:', fs.statSync('downloaded_new.xlsx').size);
