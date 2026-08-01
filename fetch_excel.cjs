const https = require('https');
const fs = require('fs');

const url = 'https://my.uupload.ir/dl/mbJYz1xj';

https.get(url, (res) => {
    console.log("Status Code:", res.statusCode);
    console.log("Headers:", res.headers);
    
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log("Redirecting to:", res.headers.location);
        https.get(res.headers.location, (res2) => {
             const file = fs.createWriteStream("downloaded.xlsx");
             res2.pipe(file);
             file.on('finish', () => {
                 file.close();
                 console.log("Download complete");
             });
        });
    } else {
        const file = fs.createWriteStream("downloaded.xlsx");
        res.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log("Download complete");
        });
    }
}).on('error', (e) => {
    console.error(e);
});
