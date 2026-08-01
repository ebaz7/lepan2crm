const fs = require('fs');
let c = fs.readFileSync('components/SayanReports.tsx', 'utf8');

c = c.replace(
  `        </div>\n      );\n    }\n             sqlQuery = "SELECT TOP 1000 * FROM STR_TBL_001";`,
  `        </div>\n      );\n    }\n          } else if (activeTable === 'REPORT_INVENTORY') {\n             sqlQuery = "SELECT TOP 1000 * FROM STR_TBL_001";`
);

fs.writeFileSync('components/SayanReports.tsx', c);
