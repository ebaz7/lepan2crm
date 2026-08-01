const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function runQuery(q) {
  try {
    const res = await fetch('http://localhost:3000/api/sayan-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q })
    });
    const json = await res.json();
    return json.data || json;
  } catch (e) {
    return { error: e.message };
  }
}

async function main() {
  console.log("=== Querying ACT_TBL_003 (Moein) for Bank/Cash ===");
  const qMoein = await runQuery("SELECT * FROM ACT_TBL_003 WHERE Field_004 LIKE N'%بانک%' OR Field_004 LIKE N'%صندوق%' OR Field_004 LIKE N'%نقد%'");
  console.log("Moein Bank/Cash:", JSON.stringify(qMoein, null, 2));

  console.log("=== Querying ACT_TBL_007 (Tafsili) for Bank ===");
  const qTafsili = await runQuery("SELECT TOP 20 * FROM ACT_TBL_007 WHERE Field_006 LIKE N'%بانک%' OR Field_004 = '12' OR Field_004 = '21'");
  console.log("Tafsili Bank:", JSON.stringify(qTafsili, null, 2));

  console.log("=== Querying GNR_TBL_004 (Banks) ===");
  const qGnr = await runQuery("SELECT TOP 20 * FROM GNR_TBL_004");
  console.log("GNR_TBL_004:", JSON.stringify(qGnr, null, 2));

  console.log("=== Querying BUR_TBL_012 (Cheques Bank) ===");
  const qBur12 = await runQuery("SELECT TOP 10 * FROM BUR_TBL_012");
  console.log("BUR_TBL_012:", JSON.stringify(qBur12, null, 2));

  console.log("=== Querying PAY_TBL_026 (Personnel Banks) ===");
  const qPay26 = await runQuery("SELECT TOP 10 * FROM PAY_TBL_026");
  console.log("PAY_TBL_026:", JSON.stringify(qPay26, null, 2));
}

main();
