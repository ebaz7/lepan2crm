const axios = require('axios');

async function run() {
  const url = 'http://80.210.31.176:5000/api/external/v1/query';
  const headers = { 'Authorization': 'Bearer s_gate_live_vgr182bwtpoa' };

  try {
    console.log("Searching for Field_001 = '2716' in STR_TBL_010 for OpCode 44...");
    const res1 = await axios.post(url, {
      query: `
        SELECT TOP 10 * 
        FROM STR_TBL_010 
        WHERE Field_009 = '44' AND Field_001 = '2716'
      `
    }, { headers });
    console.log("Search Result by Field_001 (Archive Code) in STR_TBL_010:", res1.data.data);

    if (res1.data.data && res1.data.data.length > 0) {
      const doc = res1.data.data[0];
      console.log("Found header. Let's find detail rows in STR_TBL_011 with Field_037 =", doc.Field_001);
      const resDetails = await axios.post(url, {
        query: `
          SELECT * 
          FROM STR_TBL_011 
          WHERE Field_037 = '${doc.Field_001}'
        `
      }, { headers });
      console.log("Details via Field_037:", resDetails.data.data);

      console.log("Let's find details via classic join (Field_004, Field_003, Field_012):");
      const resDetailsClassic = await axios.post(url, {
        query: `
          SELECT * 
          FROM STR_TBL_011 
          WHERE Field_004 = '${doc.Field_005}' AND Field_003 = '${doc.Field_004}'
        `
      }, { headers });
      console.log("Details via classic join:", resDetailsClassic.data.data);
    } else {
      console.log("Archive Code '2716' not found for OpCode 44. Let's search STR_TBL_010 for Field_005 = '2716'...");
      const res2 = await axios.post(url, {
        query: `
          SELECT TOP 10 * 
          FROM STR_TBL_010 
          WHERE Field_009 = '44' AND Field_005 = '2716'
        `
      }, { headers });
      console.log("Search Result by Field_005 (DocNo) in STR_TBL_010:", res2.data.data);

      if (res2.data.data && res2.data.data.length > 0) {
        const doc = res2.data.data[0];
        console.log("Found header by Field_005. Let's find detail rows in STR_TBL_011...");
        const resDetails = await axios.post(url, {
          query: `
            SELECT * 
            FROM STR_TBL_011 
            WHERE Field_037 = '${doc.Field_001}'
          `
        }, { headers });
        console.log("Details via Field_037:", resDetails.data.data);
      } else {
        console.log("Let's search STR_TBL_011 for any item with Quantity close to 393.2 or item name like 'پلی استر'...");
        const res3 = await axios.post(url, {
          query: `
            SELECT TOP 20 t10.Field_001 as ArchiveCode, t10.Field_005 as DocNo, t10.Field_008 as Date, t11.Field_005 as ItemCode, t11.Field_006 as Quantity
            FROM STR_TBL_010 t10
            INNER JOIN STR_TBL_011 t11 ON t11.Field_037 = t10.Field_001
            WHERE t10.Field_009 = '44' AND (t11.Field_006 BETWEEN 390 AND 395)
          `
        }, { headers });
        console.log("Search Result by Quantity:", res3.data.data);
      }
    }
  } catch(e) {
    console.error("Error executing query:", e.message, e.response && e.response.data);
  }
}

run();
