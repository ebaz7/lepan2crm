import XLSX from 'xlsx';

try {
  const workbook = XLSX.readFile('downloaded_new.xlsx');
  console.log("Sheets in Sayan_DB_Proper.xlsx:");
  workbook.SheetNames.forEach(name => {
    console.log("- " + name);
    const sheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log("  Headers:", data[0]);
    if (data.length > 1) {
       console.log("  Row 1:", data[1]);
    }
  });
} catch(e) {
  console.error(e);
}
