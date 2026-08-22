const axios = require('axios');

const sqlCartonParseTest = `
    SELECT TOP 10
        t11.Field_005 as ItemCode,
        t11.Field_031 as DetailNote,
        t10.Field_009 as DocType,
        CASE 
            WHEN t11.Field_031 LIKE N'%تعداد کارتن:%' THEN
                -- Locate the part after "تعداد کارتن:"
                TRY_CAST(
                    LEFT(
                        LTRIM(SUBSTRING(t11.Field_031, CHARINDEX(N'تعداد کارتن:', t11.Field_031) + 12, 10)),
                        PATINDEX('%[^0-9]%', LTRIM(SUBSTRING(t11.Field_031, CHARINDEX(N'تعداد کارتن:', t11.Field_031) + 12, 10)) + 'X') - 1
                    ) as float
                )
            ELSE 0
        END as ParsedCartons
    FROM STR_TBL_011 t11
    INNER JOIN STR_TBL_010 t10 ON t11.Field_004 = t10.Field_005 
                              AND t11.Field_003 = t10.Field_004 
                              AND t11.Field_012 = t10.Field_018
    WHERE t11.Field_031 LIKE N'%تعداد کارتن:%'
`;

async function run() {
  try {
    const res = await axios.post('http://80.210.31.176:5000/api/external/v1/query', { query: sqlCartonParseTest }, { headers: { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' } });
    console.log("Samples of parsed cartons:");
    console.log(JSON.stringify(res.data.data, null, 2));
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
