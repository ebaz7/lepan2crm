const XLSX = require('xlsx');
try {
    const wb = XLSX.readFile('farvardin_sales.xlsx');
    console.log("Sheets:", wb.SheetNames);
    const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    console.log(`Rows: ${data.length}`);
    console.log("First 5 rows:");
    console.log(JSON.stringify(data.slice(0, 5), null, 2));
} catch (e) {
    console.error(e.message);
}
