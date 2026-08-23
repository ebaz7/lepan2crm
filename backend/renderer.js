import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Correctly resolve root directory from backend folder
const ROOT_DIR = path.resolve(__dirname, "..");

let browser = null;

// --- DYNAMIC PERSIAN DIGIT CONVERTER ---
const toPersianDigits = (str) => {
  if (str === undefined || str === null) return "";
  const englishDigits = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  let result = String(str);
  for (let i = 0; i < 10; i++) {
    result = result.replace(
      new RegExp(englishDigits[i], "g"),
      persianDigits[i],
    );
  }
  return result;
};

// --- URL TO ABSOLUTE PATH / BASE64 CONVERTER ---
const makeAbsolute = (url) => {
  if (!url) return "";
  if (url.startsWith("data:")) return url;

  // Check if it is a local upload (contains '/uploads/')
  if (url.includes("/uploads/")) {
    try {
      const parts = url.split("/uploads/");
      const fileName = parts[parts.length - 1].split("?")[0]; // strip query strings
      const fullPath = path.join(process.cwd(), "uploads", fileName);

      if (fs.existsSync(fullPath)) {
        const ext = path.extname(fullPath).toLowerCase().replace(".", "");
        const mimeType =
          ext === "png"
            ? "image/png"
            : ext === "gif"
              ? "image/gif"
              : ext === "jpg" || ext === "jpeg"
                ? "image/jpeg"
                : "image/png";
        const base64 = fs.readFileSync(fullPath).toString("base64");
        return `data:${mimeType};base64,${base64}`;
      } else {
        console.error(
          `[Renderer] Local upload file not found on disk: ${fullPath}`,
        );
      }
    } catch (e) {
      console.error(
        "[Renderer] Error reading file for PDF base64 conversion:",
        e.message,
      );
    }
  }

  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  return `http://127.0.0.1:3000${cleanUrl}`;
};

// --- FONT LOADER (ROBUST OFFLINE SUPPORT) ---
const getFontBase64 = () => {
  try {
    const pathsToCheck = [
      path.join(ROOT_DIR, "public", "fonts", "Vazirmatn-Regular.woff2"),
      path.join(ROOT_DIR, "dist", "fonts", "Vazirmatn-Regular.woff2"),
      path.join(process.cwd(), "public", "fonts", "Vazirmatn-Regular.woff2"),
    ];

    for (const p of pathsToCheck) {
      if (fs.existsSync(p)) {
        return fs.readFileSync(p).toString("base64");
      }
    }
  } catch (e) {
    console.warn("[Renderer] Error loading font:", e.message);
  }
  return null;
};

const fontBase64 = getFontBase64();
const fontFaceRule = fontBase64
  ? `@font-face { font-family: 'Vazirmatn'; src: url(data:font/woff2;base64,${fontBase64}) format('woff2'); font-weight: normal; font-style: normal; }`
  : `/* No Local Font Found */`;

// --- SYSTEM CHROME DETECTION (WINDOWS) ---
const findSystemChrome = () => {
  const commonPaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Users\\" +
      (process.env.USERNAME || "") +
      "\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Chromium\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Chromium\\Application\\chrome.exe",
  ];

  // Check environment variable first if user set it
  if (
    process.env.PUPPETEER_EXECUTABLE_PATH &&
    fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)
  ) {
    console.log(
      `[Renderer] Using configured executable: ${process.env.PUPPETEER_EXECUTABLE_PATH}`,
    );
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      console.log(`[Renderer] Found System Chrome: ${p}`);
      return p;
    }
  }
  return null;
};

const getBrowser = async () => {
  // Check if browser process is still alive and connected
  if (browser && !browser.isConnected()) {
    console.warn("[Renderer] Browser disconnected, recreating instance...");
    try {
      await browser.close();
    } catch (e) {}
    browser = null;
  }

  if (!browser) {
    try {
      console.log("[Renderer] Launching Puppeteer...");

      // Build Launch Config
      const launchConfig = {
        headless: "new",
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--font-render-hinting=none",
          "--disable-extensions",
          "--disable-background-networking",
          "--disable-default-apps",
          "--disable-sync",
          "--hide-scrollbars",
          "--metrics-recording-only",
          "--mute-audio",
          "--no-first-run",
          "--safebrowsing-disable-auto-update",
        ],
        timeout: 60000,
      };

      // Try to find system chrome if local one might be missing
      // This is safer for Windows Service or non-standard environments
      const systemChrome = findSystemChrome();
      if (systemChrome) {
        launchConfig.executablePath = systemChrome;
      } else {
        console.log(
          "[Renderer] No System Chrome found, trying default bundled Chromium...",
        );
      }

      browser = await puppeteer.launch(launchConfig);
      console.log("[Renderer] Puppeteer Launched Successfully.");
    } catch (e) {
      console.error("⚠️ Puppeteer Launch Failed:", e.message);
      // Re-throw to let the caller know exactly why it failed
      throw new Error(
        `Puppeteer Launch Failed: ${e.message}\nIf running as Service, ensure 'chrome.exe' is installed or 'npm install' was run.`,
      );
    }
  }
  return browser;
};

// --- STYLES ---
const BASE_STYLE = `
    ${fontFaceRule}
    * { box-sizing: border-box; }
    body { 
        font-family: 'Vazirmatn', 'Tahoma', sans-serif !important; 
        background: #fff; 
        padding: 40px; 
        direction: rtl; 
        margin: 0;
    }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
    .title { font-size: 24px; font-weight: 900; color: #1e3a8a; }
    .meta { display: flex; justify-content: space-between; margin-top: 10px; font-size: 14px; color: #555; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
    th { background: #f3f4f6; padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: 900; color: #333; }
    td { padding: 10px; border: 1px solid #ddd; text-align: center; color: #444; }
    tr:nth-child(even) { background-color: #fafafa; }
    .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
    .amount { font-family: monospace; font-weight: bold; font-size: 14px; direction: ltr; }
    
    /* VOUCHER / PERMIT STYLE */
    .voucher-container { border: 2px solid #000; padding: 20px; position: relative; min-height: 500px; }
    .voucher-header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
    .voucher-title { font-size: 22px; font-weight: 900; }
    .voucher-meta div { margin-bottom: 5px; font-weight: bold; }
    .voucher-row { display: flex; margin-bottom: 10px; border: 1px solid #eee; padding: 10px; border-radius: 5px; background: #fcfcfc; }
    .voucher-label { width: 120px; font-weight: bold; color: #555; }
    .voucher-val { flex: 1; font-weight: bold; color: #000; }
    .voucher-signatures { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; font-size: 12px; font-weight: bold; }
    .sig-box { width: 100px; height: 60px; border-bottom: 1px solid #000; margin: 0 auto; }
`;

// --- TEMPLATES ---
const generateRecordCardHTML = (title, data, type) => {
  let headerColor = "#1e40af"; // Blue
  if (type === "EXIT") headerColor = "#c2410c"; // Orange
  if (type === "BIJAK") headerColor = "#b91c1c"; // Red
  if (type === "RECEIPT") headerColor = "#15803d"; // Green

  return `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
    <meta charset="UTF-8">
    <style>
        ${BASE_STYLE}
        body { padding: 20px; width: 800px; display: block; }
        .card { background: white; border-radius: 20px; box-shadow: none; border: 1px solid #333; overflow: hidden; }
        .card-header { background: ${headerColor}; color: white; padding: 25px; text-align: center; }
        .card-title { font-size: 32px; font-weight: 900; margin: 0; }
        .row { display: flex; justify-content: space-between; border-bottom: 2px dashed #ccc; padding: 15px 20px; font-size: 20px; }
        .label { color: #555; font-weight: bold; }
        .value { color: #000; font-weight: 900; }
    </style>
    </head>
    <body>
        <div class="card">
            <div class="card-header">
                <div class="card-title">${title}</div>
                <div style="margin-top:5px; opacity:0.9; font-size: 16px;">${new Date().toLocaleDateString("fa-IR")}</div>
            </div>
            ${data}
        </div>
    </body>
    </html>`;
};

// --- EXPORTED FUNCTIONS ---

export const generateRecordImage = async (record, type, options = {}) => {
  try {
    const { isEdit, isDelete } = options;
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1000, deviceScaleFactor: 2 });

    let htmlData = "";
    let title = "";

    const renderPlate = (plate) => {
      if (!plate || plate === "-")
        return '<div style="font-size: 14px; color: #999;">-</div>';

      // Expected format: 12A34567 where A is persian char
      const match = plate.match(
        /^(\d{2})([آابپتثجچحخدذرزژسشصضطظعغفقکگلمنوهی])(\d{3})(\d{2})$/,
      );
      if (!match)
        return `<div dir="ltr" style="display: inline-block; font-size: 16px; border: 2px solid #333; padding: 2px 8px; border-radius: 6px; background: white; font-family: monospace;">${plate}</div>`;

      const [_, p1, char, p2, city] = match;
      return `
                <div style="display: inline-flex; align-items: center; border: 2px solid #000; border-radius: 4px; overflow: hidden; background: #fff; height: 32px; font-family: 'Vazirmatn', sans-serif; direction: ltr;">
                    <div style="background: #1e40af; width: 14px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2px;">
                        <div style="width: 8px; height: 3px; background: #166534; margin-bottom: 1px;"></div>
                        <div style="width: 8px; height: 3px; background: white; margin-bottom: 1px;"></div>
                        <div style="width: 8px; height: 3px; background: #b91c1c; margin-bottom: 1px;"></div>
                        <div style="color: white; font-size: 4px; font-weight: bold; margin-top: 2px;">IR</div>
                        <div style="color: white; font-size: 4px; text-decoration: underline;">IRAN</div>
                    </div>
                    <div style="padding: 0 6px; font-size: 20px; font-weight: 900; line-height: 1;">${p1}</div>
                    <div style="font-size: 18px; font-weight: 900; line-height: 1; padding: 0 4px;">${char}</div>
                    <div style="padding: 0 6px; font-size: 20px; font-weight: 900; line-height: 1;">${p2}</div>
                    <div style="border-left: 2px solid #000; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 4px; min-width: 24px;">
                        <div style="font-size: 8px; font-weight: bold; border-bottom: 1px solid #000; width: 100%; text-align: center; margin-bottom: 2px;">ایران</div>
                        <div style="font-size: 14px; font-weight: 900; line-height: 1;">${city}</div>
                    </div>
                </div>
            `;
    };

    if (type === "PAYMENT") {
      title = "دستور پرداخت وجه";
      if (isEdit) title += " (ویرایش شده)";
      if (isDelete) title += " (حذف شده)";
      const banks =
        record.paymentDetails && record.paymentDetails.length > 0
          ? [
              ...new Set(
                record.paymentDetails
                  .map((d) => d.bankName || d.method || "صندوق / نقدی")
                  .filter(Boolean),
              ),
            ].join("، ")
          : "صندوق / نقدی";

      htmlData = `
                <div class="row"><span class="label">شماره پیگیری:</span><span class="value">#${record.trackingNumber}</span></div>
                <div class="row"><span class="label">نام ذینفع:</span><span class="value" style="font-size: 24px;">${record.payee}</span></div>
                <div class="row"><span class="label">مبلغ پرداختی:</span><span class="value amount" style="color:#1e40af; font-size: 28px;">${parseInt(record.totalAmount).toLocaleString()} ریال</span></div>
                <div class="row"><span class="label">بانک / منبع پرداخت:</span><span class="value" style="color:#b91c1c">${banks}</span></div>
                <div class="row"><span class="label">شرکت پرداخت‌کننده:</span><span class="value">${record.payingCompany}</span></div>
                <div class="row"><span class="label">بابت / شرح:</span><span class="value" style="font-size: 16px; border: 1px solid #eee; padding: 10px; border-radius: 8px; background: #fafafa; display: block; width: 100%; text-align: right; margin-top: 5px;">${record.description}</span></div>
                <div class="row" style="margin-top: 15px; border-top: 2px solid #eee; padding-top: 10px;"><span class="label">درخواست‌کننده:</span><span class="value">${record.requester}</span></div>
                <div class="row"><span class="label">وضعیت نهایی:</span><span class="value" style="color: ${record.status.includes("تایید") ? "#15803d" : "#444"}">${record.status}</span></div>
            `;
    } else if (type === "EXIT" || type === "CUSTOMER_INVOICE") {
      const isInvoice = type === "CUSTOMER_INVOICE";
      const showDelivery =
        record.items &&
        record.items.some((i) => i.deliveredCartonCount !== undefined);
      const itemsToRender =
        record.items && record.items.length > 0
          ? record.items
          : [
              {
                goodsName: record.goodsName || "نامشخص",
                cartonCount: record.cartonCount || 0,
                weight: record.weight || 0,
              },
            ];

      const totalCartons = itemsToRender.reduce(
        (acc, i) => acc + (Number(i.cartonCount) || 0),
        0,
      );
      const totalWeight = itemsToRender.reduce(
        (acc, i) => acc + (Number(i.weight) || 0),
        0,
      );
      const totalDelCartons = showDelivery
        ? itemsToRender.reduce(
            (acc, i) => acc + (Number(i.deliveredCartonCount ?? 0) || 0),
            0,
          )
        : totalCartons;
      const totalDelWeight = showDelivery
        ? itemsToRender.reduce(
            (acc, i) => acc + (Number(i.deliveredWeight ?? 0) || 0),
            0,
          )
        : totalWeight;

      const itemsHtml = itemsToRender
        .map(
          (i, idx) => `
                <tr class="text-base">
                    <td class="border-2 border-black p-2">${idx + 1}</td>
                    <td class="border-2 border-black p-2 font-bold text-center">${i.goodsName}</td>
                    ${
                      showDelivery
                        ? `
                        <td class="border-2 border-black p-2 font-mono text-gray-400 bg-gray-50">${i.cartonCount}</td>
                        <td class="border-2 border-black p-2 font-mono font-bold bg-green-50">${i.deliveredCartonCount ?? i.cartonCount}</td>
                        <td class="border-2 border-black p-2 font-mono text-gray-400 bg-gray-50">${i.weight}</td>
                        <td class="border-2 border-black p-2 font-mono font-bold bg-green-50">${i.deliveredWeight ?? i.weight}</td>
                    `
                        : `
                        <td class="border-2 border-black p-2 font-mono font-bold">${i.cartonCount}</td>
                        <td class="border-2 border-black p-2 font-mono font-bold">${i.weight}</td>
                    `
                    }
                </tr>
            `,
        )
        .join("");

      const destsHtml = (
        record.destinations || [
          {
            recipientName: record.recipientName,
            address: record.destinationAddress,
            phone: "",
          },
        ]
      )
        .map(
          (d) => `
                <div class="border-b-2 border-gray-200 pb-2 mb-2 last:border-0 last:pb-0">
                    <div class="flex justify-between mb-1">
                        <div><span class="font-bold text-gray-500 ml-2">تحویل گیرنده:</span> <span class="font-bold text-lg">${d.recipientName}</span></div>
                        <div><span class="font-bold text-gray-500 ml-2">شماره تماس:</span> <span class="font-mono font-bold text-lg dir-ltr">${d.phone || "-"}</span></div>
                    </div>
                    <div><span class="font-bold text-gray-500 ml-2">آدرس مقصد:</span> <span class="font-bold">${d.address || "-"}</span></div>
                </div>
            `,
        )
        .join("");

      const formatDateSafe = (dateVal) => {
        if (!dateVal) return "-";
        try {
          const iso = String(dateVal).split("T")[0];
          const parts = iso.split("-");
          if (parts.length === 3) {
            return new Date(
              parts[0],
              parts[1] - 1,
              parts[2],
              12,
            ).toLocaleDateString("fa-IR");
          }
          return new Date(dateVal).toLocaleDateString("fa-IR");
        } catch (e) {
          return "-";
        }
      };

      const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                ${fontFaceRule}
                body { background: white; padding: 0 !important; font-family: 'Vazirmatn', sans-serif !important; margin: 0; }
                .watermark-badge { position: absolute; top: 40px; left: 40px; font-size: 40px; font-weight: 900; opacity: 0.2; transform: rotate(-15deg); user-select: none; border: 4px solid; padding: 5px 20px; border-radius: 12px; z-index: 50; }
                .badge-edit { color: #d97706; border-color: #d97706; }
                .badge-delete { color: #dc2626; border-color: #dc2626; opacity: 0.4; }
                #capture-wrapper { 
                    padding: 10mm; 
                    margin: 0 auto; 
                    width: 210mm; 
                    background: white; 
                    direction: rtl; 
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    color: black;
                    position: relative;
                }
                .stamp { border: 2px solid #1e40af; color: #1e40af; border-radius: 10px; padding: 6px; transform: rotate(-3deg); text-align: center; background: white; min-width: 80px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: inline-block; }
                .stamp.black { border-color: black; color: black; }
                .stamp-title { font-size: 9px; font-weight: bold; border-bottom: 1px solid #1e40af; margin-bottom: 3px; padding-bottom: 1px; }
                .stamp.black .stamp-title { border-color: black; }
                .stamp-name { font-size: 12px; font-weight: 900; }
                table { width: 100%; border-collapse: collapse; border: 2px solid black; margin-top: 10px; text-align: center; }
                th, td { border: 2px solid black; padding: 6px; }
                th { background-color: #f3f4f6; }
                .meta-section { border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center; }
                .invoice-header { background: #1e3a8a; color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
                .invoice-table th { background: #1e3a8a; color: white; border-color: #1e3a8a; }
                .invoice-table td { border-color: #e5e7eb; }
                .invoice-total { background: #eff6ff; font-weight: 900; }
            </style>
            </head><body>
            <div id="capture-wrapper">
                ${isEdit ? '<div class="watermark-badge badge-edit">ویرایش شده</div>' : ""}
                ${isDelete ? '<div class="watermark-badge badge-delete">حذف شده</div>' : ""}
                
                ${
                  isInvoice
                    ? `
                    <div class="invoice-header">
                        <div>
                            <h1 style="font-size: 28px; font-weight: 900; margin: 0;">پیش‌فاکتور فروش کالا</h1>
                            <p style="font-size: 14px; opacity: 0.8; margin: 0;">سند تایید تحویل کالا و بارنامه پیوست</p>
                        </div>
                        <div style="text-align: left;">
                            <div style="font-size: 20px; font-weight: 900; border: 2px solid white; padding: 5px 15px; border-radius: 8px;">No: ${record.permitNumber}</div>
                            <div style="font-size: 12px; margin-top: 5px;">تاریخ: ${formatDateSafe(record.date)}</div>
                        </div>
                    </div>
                `
                    : `
                    <div class="meta-section" style="border-bottom: none; align-items: start;">
                        <div style="text-align: right; background: #eee; padding: 10px 20px; border: 2px solid black; border-radius: 8px; width: 180px;">
                            <div style="font-size: 20px; font-weight: 900;">شماره: ${record.permitNumber}</div>
                            <div style="font-size: 16px; font-weight: 900; margin-top: 5px;">تاریخ: ${formatDateSafe(record.date)}</div>
                        </div>
                        <div style="text-align: center; flex: 1;">
                        </div>
                        <div style="text-align: left;">
                            <h1 style="font-size: 26px; font-weight: 900; margin: 0;">مجوز خروج کالا از کارخانه</h1>
                            <p style="font-size: 14px; font-weight: bold; color: #4b5563; margin: 0;">سیستم مکانیزه مدیریت بار و خروج</p>
                        </div>
                    </div>
                `
                }

                <div style="margin-bottom: 20px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 14px;">
                        <div style="border: 2px solid #ddd; padding: 10px; border-radius: 8px; background: #fff;">
                            <div style="color: #6b7280; font-weight: bold; margin-bottom: 5px; font-size: 12px;">${isInvoice ? "خریدار / گیرنده کالا:" : "مقصد / تحویل گیرنده:"}</div>
                            ${isInvoice ? `<div style="font-size: 18px; font-weight: 900; color: #1e3a8a;">${record.recipientName}</div><div style="font-size: 12px; color: #4b5563; margin-top: 5px;">${record.destinationAddress || "-"}</div>` : destsHtml}
                        </div>
                        <div style="border: 2px solid #ddd; padding: 10px; border-radius: 8px; background: #fff;">
                            <div style="color: #6b7280; font-weight: bold; margin-bottom: 5px; font-size: 12px;">مشخصات راننده:</div>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                                <div><span style="color: #6b7280; margin-left: 2px;">نام:</span> <b style="font-size: 15px;">${record.driverName || "-"}</b></div>
                                <div><span style="color: #6b7280; margin-left: 2px;">موبایل:</span> <b style="font-size: 15px; font-family: monospace;">${record.driverPhone || "-"}</b></div>
                                <div style="grid-column: span 2;"><span style="color: #6b7280; margin-left: 2px;">پلاک:</span> ${renderPlate(record.plateNumber)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="flex: 1;">
                    <h3 style="margin-bottom: 10px; font-weight: 900; font-size: 20px; text-align: left;">${isInvoice ? "شرح اقلام فاکتور" : "لیست اقلام و کالاها"}</h3>
                    <table class="${isInvoice ? "invoice-table" : ""}" style="width: 100%; border-collapse: collapse; border: 3px solid black;">
                        <thead>
                            <tr style="font-weight: 900; font-size: 13px; background: #f3f4f6;">
                                <th style="width: 40px; border: 2px solid black;">#</th>
                                <th style="border: 2px solid black;">شرح کالا</th>
                                <th style="width: 90px; border: 2px solid black;">تعداد درخواستی</th>
                                <th style="width: 90px; border: 2px solid black; color: #15803d;">تعداد خروجی</th>
                                <th style="width: 90px; border: 2px solid black;">وزن درخواستی</th>
                                <th style="width: 90px; border: 2px solid black; color: #15803d;">وزن خروجی</th>
                                ${options.forceHidePrices ? "" : '<th style="width: 100px; border: 2px solid black;">فی / قیمت</th>'}
                            </tr>
                        </thead>
                        <tbody style="font-size: 14px;">
                            ${(
                              record.items || [
                                {
                                  goodsName: record.goodsName,
                                  cartonCount: record.cartonCount,
                                  deliveredCartonCount:
                                    record.deliveredCartonCount,
                                  weight: record.weight,
                                  deliveredWeight: record.deliveredWeight,
                                  price: record.price,
                                },
                              ]
                            )
                              .map((i, idx) => {
                                const reqQty = i.cartonCount || 0;
                                const delQty =
                                  i.deliveredCartonCount ?? i.cartonCount ?? 0;
                                const reqWeight = i.weight || 0;
                                const delWeight =
                                  i.deliveredWeight ?? i.weight ?? 0;
                                const price = i.price
                                  ? Number(i.price).toLocaleString()
                                  : "-";
                                return `
                                <tr style="height: 40px;">
                                    <td style="border: 2px solid black;">${idx + 1}</td>
                                    <td style="font-weight: 900; text-align: right; padding-right: 15px; border: 2px solid black;">${i.goodsName}</td>
                                    <td style="font-weight: bold; border: 2px solid black;">${reqQty}</td>
                                    <td style="font-weight: bold; border: 2px solid black; color: #15803d; background: #f0fdf4;">${delQty}</td>
                                    <td style="font-weight: bold; border: 2px solid black;">${reqWeight}</td>
                                    <td style="font-weight: bold; border: 2px solid black; color: #15803d; background: #f0fdf4;">${delWeight}</td>
                                    ${options.forceHidePrices ? "" : `<td style="font-family: monospace; border: 2px solid black;">${price}</td>`}
                                </tr>
                            `;
                              })
                              .join("")}
                        </tbody>
                    </table>
                </div>

                ${
                  isInvoice
                    ? ""
                    : `
                    <div style="margin-top: 30px; border-top: 3px solid #000; padding-top: 20px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px;">
                        <div style="text-align: center;">
                            <div class="stamp" style="width: 100%;"><div class="stamp-title">ثبت کننده</div><div class="stamp-name" style="font-size: 11px;">${record.requester || "-"}</div></div>
                            <div style="font-size: 8px; font-weight: bold; margin-top: 5px;">مدیرفروش / ثبت سفارش</div>
                        </div>
                        <div style="text-align: center;">                
                            ${record.approverCeo ? `<div class="stamp" style="width: 100%;"><div class="stamp-title">مدیرعامل</div><div class="stamp-name" style="font-size: 11px;">${record.approverCeo}</div></div>` : '<div style="height: 50px; border: 1px dashed #ccc; border-radius: 8px;"></div>'}
                            <div style="font-size: 8px; font-weight: bold; margin-top: 5px;">مدیرعامل / تایید فروش</div>
                        </div>
                        <div style="text-align: center;">
                            ${record.approverFactory ? `<div class="stamp" style="width: 100%;"><div class="stamp-title">مدیر کارخانه</div><div class="stamp-name" style="font-size: 11px;">${record.approverFactory}</div></div>` : '<div style="height: 50px; border: 1px dashed #ccc; border-radius: 8px;"></div>'}
                            <div style="font-size: 8px; font-weight: bold; margin-top: 5px;">مدیر کارخانه / مجوز ورود و بارگیری</div>
                        </div>
                        <div style="text-align: center;">
                            ${record.approverWarehouse ? `<div class="stamp" style="width: 100%;"><div class="stamp-title">تحویل انبار</div><div class="stamp-name" style="font-size: 11px;">${record.approverWarehouse}</div></div>` : '<div style="height: 50px; border: 1px dashed #ccc; border-radius: 8px;"></div>'}
                            <div style="font-size: 8px; font-weight: bold; margin-top: 5px;">سرپرست انبار / انجام بارگیری</div>
                        </div>
                        <div style="text-align: center;">
                            ${
                              record.status ===
                                "در انتظار تایید نهایی مدیر کارخانه" ||
                              record.status === "خارج شد" ||
                              record.status === "خارج شده (بایگانی)"
                                ? `
                                <div class="stamp black" style="width: 100%;"><div class="stamp-title">انتظامات</div><div class="stamp-name" style="font-size: 11px;">${record.approverSecurity || "..."}</div></div>
                            `
                                : '<div style="height: 50px; border: 1px dashed #ccc; border-radius: 8px;"></div>'
                            }
                            <div style="font-size: 8px; font-weight: bold; margin-top: 5px;">سرپرست انتظامات / بازرسی و تایید بارگیری</div>
                        </div>
                        <div style="text-align: center;">
                            ${
                              record.status === "خارج شد" ||
                              record.status === "خارج شده (بایگانی)"
                                ? `
                                <div class="stamp black" style="width: 100%;"><div class="stamp-title">مدیر کارخانه</div><div class="stamp-name" style="font-size: 11px;">${record.approverFactoryFinal || "..."}</div>${record.exitTime ? `<div style="font-size: 7px; font-weight: bold;">ساعت: ${record.exitTime}</div>` : ""}</div>
                            `
                                : '<div style="height: 50px; border: 1px dashed #ccc; border-radius: 8px;"></div>'
                            }
                            <div style="font-size: 8px; font-weight: bold; margin-top: 5px;">مدیر کارخانه / تایید نهایی خروج</div>
                        </div>
                    </div>
                `
                }

                ${
                  isInvoice
                    ? `
                    <div style="margin-top: 40px; display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 20px;">
                        <div style="background: #f1f5f9; padding: 15px; border-radius: 12px; font-size: 11px;">
                            <b style="color: #1e3a8a; display: block; margin-bottom: 5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 2px;">توضیحات و شرایط فروش:</b>
                            ۱. کالا صحیح و سالم و مطابق با سفارش تحویل گردید.<br/>
                            ۲. هرگونه مغایرت باید در لحظه تحویل به راننده اعلام گردد.<br/>
                            ۳. امضای این برگ به منزله تایید نهایی و دریافت کالا توسط خریدار است.
                        </div>
                        <div style="text-align: center; border-right: 1px solid #eee;">
                            <div style="font-weight: 900; font-size: 12px; color: #1e3a8a; margin-bottom: 50px;">مهر و امضای فروشنده</div>
                            <div style="font-size: 9px; color: #94a3b8; border: 2px dashed #e2e8f0; padding: 10px; border-radius: 50%; width: 80px; height: 80px; margin: 0 auto; display: flex; align-items: center; justify-content: center; transform: rotate(-10deg);">SEAL & SIGN</div>
                        </div>
                        <div style="text-align: center; border-right: 1px solid #eee;">
                            <div style="font-weight: 900; font-size: 12px; color: #1e3a8a; margin-bottom: 50px;">امضای تحویل گیرنده</div>
                            <div style="height: 60px;"></div>
                        </div>
                    </div>
                `
                    : ""
                }
            </div></body></html>`;

      // Make viewport wide enough
      await page.setViewport({
        width: 900,
        height: 1300,
        deviceScaleFactor: 2,
      });
      await page.setContent(html, { waitUntil: "networkidle0" });

      const card = await page.$("#capture-wrapper");
      const buffer = await card.screenshot({ type: "png" });
      await page.close();
      return buffer;
    } else if (type === "BIJAK" || type === "RECEIPT") {
      const isBijak = type === "BIJAK";
      const showPrices = options.forceHidePrices !== true;

      const formatDateSafe = (dateVal) => {
        if (!dateVal) return "-";
        try {
          return new Date(dateVal).toLocaleDateString("fa-IR");
        } catch (e) {
          return "-";
        }
      };

      const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                ${fontFaceRule}
                body { background: white; padding: 0 !important; font-family: 'Vazirmatn', sans-serif !important; margin: 0; }
                .watermark-badge { position: absolute; top: 40px; left: 40px; font-size: 40px; font-weight: 900; opacity: 0.2; transform: rotate(-15deg); user-select: none; border: 4px solid; padding: 5px 20px; border-radius: 12px; z-index: 50; }
                .badge-edit { color: #d97706; border-color: #d97706; }
                .badge-delete { color: #dc2626; border-color: #dc2626; opacity: 0.4; }
                #capture-wrapper { 
                    padding: 8mm; 
                    margin: 0 auto; 
                    width: 148mm; 
                    min-height: 209mm;
                    background: white; 
                    direction: rtl; 
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    color: black;
                    position: relative;
                    border: 1px solid #eee;
                }
                .stamp { border: 2px solid #1e40af; color: #1e40af; border-radius: 10px; padding: 4px; transform: rotate(-5deg); text-align: center; background: white; min-width: 80px; display: inline-block; }
                .stamp.green { border-color: #166534; color: #166534; }
                .stamp-title { font-size: 8px; font-weight: bold; border-bottom: 1px solid currentColor; margin-bottom: 2px; padding-bottom: 1px; }
                .stamp-name { font-size: 11px; font-weight: 900; }
                table { width: 100%; border-collapse: collapse; border: 1.5px solid black; margin-top: 5px; text-align: center; }
                th, td { border: 1.5px solid black; padding: 4px; }
                th { background-color: #f3f4f6; font-size: 10px; }
                td { font-size: 11px; }
                .meta-section { border-bottom: 2px solid black; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: start; }
            </style>
            </head><body>
            <div id="capture-wrapper">
                ${isEdit ? '<div class="watermark-badge badge-edit">ویرایش شده</div>' : ""}
                ${isDelete ? '<div class="watermark-badge badge-delete">حذف شده</div>' : ""}
                
                <div class="meta-section">
                    <div>
                        <h1 style="font-size: 18px; font-weight: 900; margin: 0;">${record.company}</h1>
                        <p style="font-size: 11px; font-weight: bold; color: #4b5563; margin: 0;">${isBijak ? "حواله خروج کالا (بیجک)" : "رسید ورود کالا"}</p>
                    </div>
                    <div style="text-align: left;">
                        <div style="font-size: 14px; font-weight: 900; border: 2px solid black; padding: 4px 10px; border-radius: 4px;">NO: ${record.number || record.proformaNumber}</div>
                        <div style="font-size: 10px; font-weight: bold; margin-top: 2px;">تاریخ: ${formatDateSafe(record.date)}</div>
                    </div>
                </div>

                ${record.isUnionExit && record.unionExitDetails ? `
                <div style="background-color: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 6px; padding: 8px; margin-bottom: 10px; font-size: 11px;">
                    <div style="font-weight: 900; color: #166534; font-size: 11px; margin-bottom: 5px; border-bottom: 1px dashed #16a34a; padding-bottom: 3px;">💎 مشخصات حواله خروج اتحادیه:</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div><span style="color: #4b5563;">نام خریدار:</span> <b>${record.unionExitDetails.buyerName || "-"}</b></div>
                        <div><span style="color: #4b5563;">کد ملی خریدار:</span> <b>${record.unionExitDetails.nationalCode && record.unionExitDetails.nationalCode !== '0' ? record.unionExitDetails.nationalCode : "-"}</b></div>
                        <div><span style="color: #4b5563;">شماره همراه خریدار:</span> <b>${record.unionExitDetails.mobile && record.unionExitDetails.mobile !== '0' ? record.unionExitDetails.mobile : "-"}</b></div>
                        <div><span style="color: #4b5563;">شناسه صنفی:</span> <b>${record.unionExitDetails.guildId && record.unionExitDetails.guildId !== '0' ? record.unionExitDetails.guildId : "-"}</b></div>
                        <div style="grid-column: span 2;"><span style="color: #4b5563;">آدرس خریدار:</span> <b>${record.unionExitDetails.address && record.unionExitDetails.address !== '0' ? record.unionExitDetails.address : "-"}</b></div>
                    </div>
                </div>
                ` : `
                <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; margin-bottom: 10px; font-size: 11px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                        <div><span style="color: #6b7280;">${isBijak ? "تحویل گیرنده" : "فرستنده"}:</span> <b>${isBijak ? record.recipientName : record.supplierName || record.proformaNumber}</b></div>
                        <div><span style="color: #6b7280;">مقصد/محل:</span> <b>${record.destination || record.location || "-"}</b></div>
                        <div><span style="color: #6b7280;">راننده:</span> <b>${record.driverName || "-"}</b></div>
                        <div><span style="color: #6b7280;">پلاک:</span> ${renderPlate(record.plateNumber)}</div>
                    </div>
                </div>
                `}

                <div style="flex: 1;">
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 30px;">#</th>
                                <th>شرح کالا</th>
                                <th style="width: 60px;">تعداد</th>
                                <th style="width: 70px;">وزن (KG)</th>
                                ${showPrices ? '<th style="width: 90px;">فی (ریال)</th>' : ""}
                            </tr>
                        </thead>
                        <tbody>
                            ${(record.items || [])
                              .map(
                                (item, idx) => `
                                <tr>
                                    <td>${idx + 1}</td>
                                    <td style="text-align: right; font-weight: bold; padding-right: 8px;">${item.itemName}</td>
                                    <td>${item.quantity}</td>
                                    <td>${item.weight ? Number(item.weight).toFixed(2) : 0}</td>
                                    ${showPrices ? `<td style="font-family: monospace;">${item.unitPrice ? parseInt(item.unitPrice).toLocaleString() : "-"}</td>` : ""}
                                </tr>
                            `,
                              )
                              .join("")}
                            <tr style="background-color: #f3f4f6; font-weight: bold;">
                                <td colspan="2" style="text-align: left; padding-left: 10px;">جمع کل:</td>
                                <td>${(record.items || []).reduce((a, b) => a + (Number(b.quantity) || 0), 0)}</td>
                                <td>${(record.items || []).reduce((a, b) => a + (Number(b.weight) || 0), 0).toFixed(2)}</td>
                                ${showPrices ? "<td></td>" : ""}
                            </tr>
                        </tbody>
                    </table>
                    
                    ${
                      options.stockInfo && options.stockInfo.length > 0
                        ? `
                    <div style="margin-top: 10px; font-size: 11px;">
                        <h4 style="margin: 0 0 5px 0; font-weight: bold; font-size: 11px; color: #4b5563;">📊 مانده موجودی پس از خروج:</h4>
                        <table style="border: 1px solid #9ca3af; margin-top: 0;">
                            <thead>
                                <tr>
                                    <th style="background-color: #e5e7eb; padding: 2px;">کالا</th>
                                    <th style="background-color: #e5e7eb; padding: 2px; width: 60px;">مانده (کارتن)</th>
                                    <th style="background-color: #e5e7eb; padding: 2px; width: 70px;">مانده (وزن)</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${options.stockInfo
                                  .map(
                                    (s) => `
                                    <tr>
                                        <td style="text-align: right; font-weight: bold; padding: 2px 8px; font-size: 10px;">${s.name}</td>
                                        <td style="padding: 2px; font-size: 10px; font-weight: bold; color: ${s.qty < 0 ? "#dc2626" : "#166534"}">${s.qty.toFixed(2)}</td>
                                        <td style="padding: 2px; font-size: 10px; color: ${s.weight < 0 ? "#dc2626" : "#166534"}">${s.weight.toFixed(2)}</td>
                                    </tr>
                                `,
                                  )
                                  .join("")}
                            </tbody>
                        </table>
                    </div>
                    `
                        : ""
                    }

                    ${record.description ? `<div style="margin-top: 10px; font-size: 10px; border: 1px solid #eee; padding: 5px; border-radius: 4px;"><b>توضیحات:</b> ${record.description}</div>` : ""}
                </div>

                <div style="margin-top: 20px; border-top: 1.5px solid black; padding-top: 10px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; text-align: center;">
                    <div>
                        <div class="stamp"><div class="stamp-title">انباردار (ثبت)</div><div class="stamp-name">${record.createdBy || "کاربر انبار"}</div></div>
                        <div style="font-size: 9px; font-weight: bold; color: #4b5563; margin-top: 4px;">امضا انباردار</div>
                    </div>
                    <div>
                        ${record.approvedBy ? `<div class="stamp green"><div class="stamp-title">تایید مدیریت</div><div class="stamp-name">${record.approvedBy}</div></div>` : '<div style="height: 40px; border-bottom: 1px dashed #ccc; margin: 0 10px;"></div>'}
                        <div style="font-size: 9px; font-weight: bold; color: #4b5563; margin-top: 4px;">امضا مدیریت</div>
                    </div>
                    <div>
                        <div style="height: 40px;"></div>
                        <div style="font-size: 9px; font-weight: bold; color: #4b5563; margin-top: 4px;">امضا تحویل گیرنده</div>
                    </div>
                </div>
            </div></body></html>`;

      await page.setViewport({ width: 600, height: 850, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: "networkidle0" });
      const card = await page.$("#capture-wrapper");
      const buffer = await card.screenshot({ type: "png" });
      await page.close();
      return buffer;
    }

    await page.setContent(generateRecordCardHTML(title, htmlData, type), {
      waitUntil: "networkidle0",
    });
    const card = await page.$(".card");
    const buffer = await card.screenshot({ type: "png" });
    await page.close();
    return buffer;
  } catch (e) {
    console.error("Renderer Image Error:", e.message);
    throw e;
  }
};

export const generatePdfBuffer = async (html, options = {}) => {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    let finalHtml = html;
    if (!html.includes("@font-face") && fontFaceRule) {
      finalHtml = html.replace(
        "<head>",
        `<head><style>${fontFaceRule} body { font-family: 'Vazirmatn' !important; }</style>`,
      );
    } else if (!html.includes("<head>")) {
      finalHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${BASE_STYLE}</style></head><body>${html}</body></html>`;
    }

    await page.setContent(finalHtml, {
      waitUntil: "networkidle0",
      timeout: 90000,
    });
    const pdfOptions = {
      format: "A4",
      printBackground: true,
      ...options,
      timeout: 90000,
    };
    const pdf = await page.pdf(pdfOptions);
    await page.close();
    return pdf;
  } catch (e) {
    console.error("Renderer PDF Buffer Error:", e.message);
    throw e;
  }
};

// 1. Voucher PDF
export const generateVoucherPDF = async (order) => {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    const linesHtml = order.paymentDetails
      .map(
        (d, i) =>
          `<tr><td>${i + 1}</td><td>${d.method}</td><td class="amount">${parseInt(d.amount).toLocaleString()}</td><td>${d.bankName || "-"}</td><td>${d.description || "-"}</td></tr>`,
      )
      .join("");
    const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><style>${BASE_STYLE}</style></head><body>
            <div class="voucher-container">
                <div class="voucher-header"><div><div class="voucher-title">${order.payingCompany}</div><div>رسید دستور پرداخت</div></div><div class="voucher-meta"><div>شماره: ${order.trackingNumber}</div><div>تاریخ: ${new Date(order.date).toLocaleDateString("fa-IR")}</div></div></div>
                <div class="voucher-row"><span class="voucher-label">در وجه:</span><span class="voucher-val">${order.payee}</span></div>
                <div class="voucher-row"><span class="voucher-label">مبلغ:</span><span class="voucher-val amount">${parseInt(order.totalAmount).toLocaleString()}</span></div>
                <table><thead><tr><th>#</th><th>روش</th><th>مبلغ</th><th>بانک</th><th>شرح</th></tr></thead><tbody>${linesHtml}</tbody></table>
            </div></body></html>`;
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A5",
      landscape: true,
      printBackground: true,
    });
    await page.close();
    return pdf;
  } catch (e) {
    console.error("Generate Voucher PDF Error:", e.message);
    throw e;
  }
};

// 2. Exit Permit PDF
export const generateExitPermitPDF = async (permit) => {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    const itemsHtml = permit.items
      .map(
        (i, idx) =>
          `<tr><td>${idx + 1}</td><td>${i.goodsName}</td><td>${i.cartonCount}</td><td>${i.weight}</td></tr>`,
      )
      .join("");
    const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><style>${BASE_STYLE}</style></head><body>
            <div class="voucher-container" style="min-height: 800px;">
                <div class="voucher-header"><div><div class="voucher-title">${permit.company}</div><div>مجوز خروج کالا</div></div><div class="voucher-meta"><div>شماره: ${permit.permitNumber}</div><div>تاریخ: ${new Date(permit.date).toLocaleDateString("fa-IR")}</div></div></div>
                <div class="voucher-row"><span class="voucher-label">گیرنده:</span><span class="voucher-val">${permit.recipientName}</span></div>
                <div class="voucher-row"><span class="voucher-label">راننده:</span><span class="voucher-val">${permit.driverName || "-"}</span></div>
                <table><thead><tr><th>#</th><th>کالا</th><th>تعداد</th><th>وزن</th></tr></thead><tbody>${itemsHtml}</tbody></table>
                <div class="voucher-signatures" style="margin-top:100px"><div><div class="sig-box"></div><div>فروش</div></div><div><div class="sig-box"></div><div>مدیریت</div></div><div><div class="sig-box"></div><div>انبار</div></div><div><div class="sig-box"></div><div>انتظامات</div></div></div>
            </div></body></html>`;
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    await page.close();
    return pdf;
  } catch (e) {
    console.error("Generate Exit Permit PDF Error:", e.message);
    throw e;
  }
};

// 3. Bijak PDF
export const generateBijakPDF = async (tx) => {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    const itemsHtml = tx.items
      .map(
        (i, idx) =>
          `<tr><td>${idx + 1}</td><td>${i.itemName}</td><td>${i.quantity || 0}</td><td>${i.weight || 0}</td></tr>`,
      )
      .join("");

    let dateStr = "";
    try {
      const dObj = new Date(tx.date);
      if (!isNaN(dObj.getTime())) {
        dateStr = dObj.toLocaleDateString("fa-IR");
      } else {
        dateStr = tx.date;
      }
    } catch (e) {
      dateStr = tx.date;
    }

    let customDetailsHtml = "";
    let titleText = "حواله خروج (بیجک)";
    if (tx.isUnionExit) {
      titleText = "حواله خروج اتحادیه";
      const u = tx.unionExitDetails || {};
      customDetailsHtml = `
        <div class="voucher-row-grid">
          <div class="voucher-row"><span class="voucher-label">نام خریدار:</span><span class="voucher-val">${u.buyerName || tx.recipientName || "-"}</span></div>
          <div class="voucher-row"><span class="voucher-label">کد ملی:</span><span class="voucher-val" style="font-family: monospace;">${u.nationalCode || "-"}</span></div>
        </div>
        <div class="voucher-row-grid">
          <div class="voucher-row"><span class="voucher-label">تلفن همراه:</span><span class="voucher-val" style="font-family: monospace;">${u.mobile || "-"}</span></div>
          <div class="voucher-row"><span class="voucher-label">شناسه صنفی:</span><span class="voucher-val" style="font-family: monospace;">${u.guildId || "-"}</span></div>
        </div>
        <div class="voucher-row"><span class="voucher-label">آدرس خریدار:</span><span class="voucher-val">${u.address || "-"}</span></div>
      `;
    } else {
      customDetailsHtml = `
        <div class="voucher-row"><span class="voucher-label">گیرنده:</span><span class="voucher-val">${tx.recipientName}</span></div>
        <div class="voucher-row"><span class="voucher-label">راننده:</span><span class="voucher-val">${tx.driverName || "-"} (${tx.plateNumber || "-"})</span></div>
      `;
    }

    const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
            <style>
              ${BASE_STYLE}
              .voucher-row-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
              }
              .voucher-row {
                margin-bottom: 6px;
                font-size: 11px;
              }
              .voucher-label {
                font-weight: bold;
                color: #4b5563;
                margin-left: 6px;
              }
              .voucher-val {
                color: #111827;
                font-weight: bold;
              }
            </style></head><body>
            <div class="voucher-container">
                <div class="voucher-header"><div><div class="voucher-title">${tx.company || "خروج اتحادیه"}</div><div style="font-size: 14px; font-weight: 900; color: #1e3a8a; margin-top: 4px;">${titleText}</div></div><div class="voucher-meta"><div>شماره: ${tx.number}</div><div>تاریخ: ${dateStr}</div></div></div>
                <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px; margin-bottom: 12px; background-color: #f9fafb;">
                  ${customDetailsHtml}
                </div>
                <table><thead><tr><th>#</th><th>کالا</th><th>تعداد</th><th>وزن (کیلوگرم)</th></tr></thead><tbody>${itemsHtml}</tbody></table>
                <div class="voucher-signatures"><div><div class="sig-box"></div><div>تحویل دهنده (انبار)</div></div><div><div class="sig-box"></div><div>مدیریت / تایید کننده</div></div><div><div class="sig-box"></div><div>خریدار (تحویل گیرنده)</div></div></div>
            </div></body></html>`;

    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A5",
      landscape: false,
      printBackground: true,
    });
    await page.close();
    return pdf;
  } catch (e) {
    console.error("Generate Bijak PDF Error:", e.message);
    throw e;
  }
};

// 4. Report PDF
export const generateReportPDF = async (
  title,
  columns,
  rows,
  landscape = false,
) => {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    const isDebtor = title.includes("بدهکار");
    const isSales = title.includes("فروش") || title.includes("سایان") || title.includes("تحلیلی") || title.includes("مقایسه‌ای") || title.includes("مدیریتی") || title.includes("Executive") || title.includes("Compare") || title.includes("Daily_Sales");
    const isCompare = title.includes("مقایسه") || title.includes("Compare");
    const isPendingDocs = title.includes("اسناد") || title.includes("چک‌ها");
    const isDispatch = title.includes("خروج") || title.includes("بیجک");

    const parseFormattedNumber = (str) => {
      if (!str) return 0;
      const clean = String(str).trim()
        .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString())
        .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
        .replace(/,/g, '');
      const filtered = clean.replace(/[^\d.-]/g, '');
      return parseFloat(filtered) || 0;
    };

    const pdfFormatNumber = (num) => {
      return Number(num)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    let card1Title = "";
    let card1Value = "";
    let card1Sub = "";
    let card2Title = "";
    let card2Value = "";
    let card2Sub = "";
    let card3Title = "";
    let card3Value = "";
    let card3Sub = "";
    let card4Title = "";
    let card4Value = "";
    let card4Sub = "";
    let subtitleText = "";

    if (isSales) {
      if (isCompare) {
        landscape = true; // Always landscape for comparison reports to fit 9 columns on A4
        subtitleText = "گزارش مدیریتی و تحلیل انحراف عملکرد فروش (مقایسه همزمان وزن و مبلغ) - هیئت مدیره و بازرگانی";
        
        let totalNetWgtA = 0;
        let totalNetAmtA = 0;
        let totalNetWgtB = 0;
        let totalNetAmtB = 0;

        // Check if total row already exists
        const totalRow = rows.find(r => r[0] === 'جمع کل' || String(r[1]).includes('جمع کل'));

        if (totalRow && totalRow.length >= 6) {
          if (columns.length === 10) {
            totalNetWgtA = parseFormattedNumber(totalRow[3]);
            totalNetAmtA = parseFormattedNumber(totalRow[4]);
            totalNetWgtB = parseFormattedNumber(totalRow[5]);
            totalNetAmtB = parseFormattedNumber(totalRow[6]);
          } else {
            totalNetWgtA = parseFormattedNumber(totalRow[2]);
            totalNetAmtA = parseFormattedNumber(totalRow[3]);
            totalNetWgtB = parseFormattedNumber(totalRow[4]);
            totalNetAmtB = parseFormattedNumber(totalRow[5]);
          }
        }

        if (totalNetAmtA === 0 && totalNetAmtB === 0) {
          rows.forEach((r) => {
            if (r[0] !== 'جمع کل' && !String(r[1]).includes('جمع کل')) {
              if (columns.length === 10) {
                const wgtA = parseFormattedNumber(r[3]);
                const amtA = parseFormattedNumber(r[4]);
                const wgtB = parseFormattedNumber(r[5]);
                const amtB = parseFormattedNumber(r[6]);
                totalNetWgtA += wgtA;
                totalNetAmtA += amtA;
                totalNetWgtB += wgtB;
                totalNetAmtB += amtB;
              } else if (columns.length >= 8 && (columns.includes('تغییر وزن %') || columns[2].includes('وزن A'))) {
                const wgtA = parseFormattedNumber(r[2]);
                const amtA = parseFormattedNumber(r[3]);
                const wgtB = parseFormattedNumber(r[4]);
                const amtB = parseFormattedNumber(r[5]);
                totalNetWgtA += wgtA;
                totalNetAmtA += amtA;
                totalNetWgtB += wgtB;
                totalNetAmtB += amtB;
              } else {
                const wgtA = parseFormattedNumber(r[1]);
                const feeA = parseFormattedNumber(r[2]);
                const wgtB = parseFormattedNumber(r[4]);
                const feeB = parseFormattedNumber(r[5]);
                totalNetWgtA += wgtA;
                totalNetAmtA += (wgtA * feeA);
                totalNetWgtB += wgtB;
                totalNetAmtB += (wgtB * feeB);
              }
            }
          });
        }

        const avgFeeA = totalNetWgtA > 0 ? (totalNetAmtA / totalNetWgtA) : 0;
        const avgFeeB = totalNetWgtB > 0 ? (totalNetAmtB / totalNetWgtB) : 0;

        const amtGrowth = totalNetAmtB ? ((totalNetAmtA - totalNetAmtB) / totalNetAmtB) * 100 : (totalNetAmtA ? 100 : 0);
        const wgtGrowth = totalNetWgtB ? ((totalNetWgtA - totalNetWgtB) / totalNetWgtB) * 100 : (totalNetWgtA ? 100 : 0);
        const feeGrowth = avgFeeB ? ((avgFeeA - avgFeeB) / avgFeeB) * 100 : (avgFeeA ? 100 : 0);

        card1Title = "مقایسه مبلغ فروش کل (ریال)";
        card1Value = `${amtGrowth >= 0 ? '+' : ''}${amtGrowth.toFixed(1)}%`;
        card1Sub = `A: ${pdfFormatNumber(Math.round(totalNetAmtA))} | B: ${pdfFormatNumber(Math.round(totalNetAmtB))}`;

        card2Title = "مقایسه وزن فروش کل (ک‌گ)";
        card2Value = `${wgtGrowth >= 0 ? '+' : ''}${wgtGrowth.toFixed(1)}%`;
        card2Sub = `A: ${totalNetWgtA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} | B: ${totalNetWgtB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

        card3Title = "مقایسه فی متوسط نهایی";
        card3Value = `${feeGrowth >= 0 ? '+' : ''}${feeGrowth.toFixed(1)}%`;
        card3Sub = `A: ${pdfFormatNumber(Math.round(avgFeeA))} | B: ${pdfFormatNumber(Math.round(avgFeeB))}`;

        card4Title = "تحلیل انحراف عملکرد";
        if (amtGrowth > 0 && wgtGrowth > 0) {
          card4Value = "رشد متوازن";
          card4Sub = "افزایش همزمان حجم و درآمد";
        } else if (amtGrowth > 0 && wgtGrowth <= 0) {
          card4Value = "رشد مبلغمحور";
          card4Sub = "افزایش نرخ واحد کالا";
        } else if (amtGrowth <= 0 && wgtGrowth > 0) {
          card4Value = "رشد حجمی";
          card4Sub = "افزایش حجم با قیمت رقابتی";
        } else {
          card4Value = "افت عملکرد";
          card4Sub = "کاهش حجم فروش و درآمد";
        }
      } else {
        subtitleText = "گزارش تحلیلی عملکرد فروش و مرجوعی - بخش بازرگانی و مدیریت فروش";

        let totalNetWgt = 0;
        let totalNetAmt = 0;

        rows.forEach((r) => {
          if (r[0] !== 'جمع کل') {
            if (columns.length === 6 && columns[2].includes('وزن') && columns[3].includes('فروش')) {
              totalNetWgt += parseFormattedNumber(r[2]);
              totalNetAmt += parseFormattedNumber(r[3]);
            } else if (columns.length === 6 && columns[4].includes('خالص')) {
              const parts = String(r[4]).split('/');
              if (parts.length === 2) {
                totalNetWgt += parseFormattedNumber(parts[0]);
                totalNetAmt += parseFormattedNumber(parts[1]);
              }
            }
          }
        });

        if (totalNetAmt === 0) {
          const totalRow = rows.find(r => r[0] === 'جمع کل');
          if (totalRow) {
            if (columns.length === 6 && columns[2].includes('وزن') && columns[3].includes('فروش')) {
              totalNetWgt = parseFormattedNumber(totalRow[2]);
              totalNetAmt = parseFormattedNumber(totalRow[3]);
            } else if (columns.length === 6 && columns[4].includes('خالص')) {
              const parts = String(totalRow[4]).split('/');
              if (parts.length === 2) {
                totalNetWgt = parseFormattedNumber(parts[0]);
                totalNetAmt = parseFormattedNumber(parts[1]);
              }
            }
          }
        }

        card1Title = "فروش خالص کل";
        card1Value = `${pdfFormatNumber(Math.round(totalNetAmt))} ریال`;

        card2Title = "وزن خالص کل";
        card2Value = `${totalNetWgt.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} کیلوگرم`;

        card3Title = "فی نهایی میانگین";
        card3Value = `${pdfFormatNumber(totalNetWgt ? Math.round(totalNetAmt / totalNetWgt) : 0)} ریال/ک‌گ`;
      }
    } else if (isPendingDocs) {
      subtitleText = "گزارش وضعیت اسناد دریافتنی، پرداختنی و چک‌های در جریان وصول - مدیریت خزانه";

      let totalAmt = 0;
      rows.forEach((r) => {
        if (r[0] !== 'جمع کل') {
          const amtIdx = columns.findIndex(c => c.includes('مبلغ'));
          if (amtIdx !== -1) {
            totalAmt += parseFormattedNumber(r[amtIdx]);
          }
        }
      });

      card1Title = "مجموع کل مبلغ اسناد";
      card1Value = `${pdfFormatNumber(totalAmt)} ریال`;

      card2Title = "تعداد اسناد و چک‌ها";
      card2Value = `${(rows.filter(r => r[0] !== 'جمع کل').length).toLocaleString()} فقره`;

      card3Title = "میانگین مبلغ هر سند";
      card3Value = `${pdfFormatNumber(rows.length > 1 ? Math.round(totalAmt / (rows.length - 1)) : 0)} ریال`;
    } else if (isDispatch) {
      subtitleText = "گزارش خروج کالا و بیجک‌های صادر شده - مدیریت انبار و لجستیک";

      card1Title = "تعداد کل بیجک‌ها";
      card1Value = `${(rows.filter(r => r[0] !== 'جمع کل').length).toLocaleString()} فقره`;

      card2Title = "نوع گزارش";
      card2Value = "خروج کالا و بیجک";

      card3Title = "تاریخ گزارش";
      card3Value = new Date().toLocaleDateString("fa-IR");
    } else {
      subtitleText = "گزارش وضعیت تراز تفصیلی مشتریان - بخش حسابداری و مدیریت مالی";

      let totalBalance = 0;
      rows.forEach((r) => {
        if (r[2]) {
          const num = parseFormattedNumber(r[2]);
          if (r[0] !== "---" && r[1] !== "جمع کل بدهکاران" && r[1] !== "جمع کل بستانکاران" && r[0] !== "جمع کل") {
            totalBalance += num;
          }
        }
      });

      card1Title = `جمع کل اقلام ${isDebtor ? "بدهکار" : "بستانکار"}`;
      card1Value = `${pdfFormatNumber(totalBalance)} ریال`;

      card2Title = "تعداد پرونده‌های مفتوح";
      card2Value = `${rows.filter((r) => r[0] !== "---" && r[0] !== "جمع کل").length.toLocaleString()} رکورد`;

      card3Title = "میانگین تراز هر حساب";
      card3Value = `${pdfFormatNumber(rows.length > 1 ? Math.round(totalBalance / (rows.length - 1)) : 0)} ریال`;
    }

    let thead = "<tr>";
    columns.forEach((c) => {
      thead += `<th class="py-2 px-2 text-center text-[10.5px] font-black border-b border-gray-300 bg-slate-900 text-white leading-tight">${c}</th>`;
    });
    thead += "</tr>";

    let tbody = "";
    rows.forEach((r, idx) => {
      const isEven = idx % 2 === 1;
      const isTotalRow = r[0] === 'جمع کل' || String(r[1]).includes('جمع کل');
      const rowBgClass = isTotalRow ? "bg-amber-100/90 font-black border-t-2 border-slate-900" : (isEven ? "bg-slate-50/90" : "bg-white");

      tbody += `<tr class="${rowBgClass} border-b border-gray-200/80">`;
      r.forEach((cell, cellIdx) => {
        let cellStyleClass = "py-1.5 px-2 text-[10px] text-gray-800 text-center font-bold border-l border-gray-200/60 last:border-l-0";
        if (isTotalRow) {
          cellStyleClass = "py-2 px-2 text-[10.5px] text-slate-950 text-center font-black border-l border-gray-300 last:border-l-0";
        }

        if (cellIdx === 1) {
          cellStyleClass = `py-1.5 px-2.5 text-[10.5px] ${isTotalRow ? "font-black text-slate-950" : "font-bold text-gray-900"} text-right border-l border-gray-200/60`;
        }

        const cellStr = String(cell);
        const isPctCell = cellStr.includes('%') && (cellStr.startsWith('+') || cellStr.startsWith('-') || cellStr.includes('.'));
        
        if (isPctCell) {
          const isPos = cellStr.startsWith('+') || (parseFloat(cellStr) > 0 && !cellStr.startsWith('-'));
          const isNeg = cellStr.startsWith('-');
          const bgBadge = isPos ? "bg-emerald-100 text-emerald-900 font-black" : (isNeg ? "bg-rose-100 text-rose-900 font-black" : "bg-slate-100 text-slate-700");
          tbody += `<td class="py-1 px-1.5 text-center"><span class="inline-block px-1.5 py-0.5 text-[9.5px] rounded-md font-mono ${bgBadge}">${cell}</span></td>`;
        } else {
          tbody += `<td class="${cellStyleClass}">${cell}</td>`;
        }
      });
      tbody += "</tr>";
    });

    const html = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        ${fontFaceRule}
        @page {
          size: A4 ${landscape ? 'landscape' : 'portrait'};
          margin: 6mm 8mm;
        }
        body { 
            font-family: 'Vazirmatn', sans-serif !important; 
            background: #ffffff; 
            padding: 0;
            margin: 0;
            color: #0f172a;
            -webkit-print-color-adjust: exact;
        }
    </style>
</head>
<body class="p-0">
    <div class="w-full bg-white p-2">
        
        <!-- HEADER -->
        <div class="flex justify-between items-center border-b-2 border-slate-900 pb-2 mb-3">
            <div class="space-y-0.5">
                <div class="flex items-center gap-2">
                    <div class="w-2.5 h-6 bg-slate-900 rounded-sm"></div>
                    <h1 class="text-lg font-black text-slate-900 tracking-tight">${title}</h1>
                </div>
                <p class="text-[10px] text-slate-500 font-bold pr-4">${subtitleText}</p>
            </div>
            <div class="text-left space-y-0.5">
                <div class="inline-block bg-slate-900 text-white px-2.5 py-1 rounded text-[10px] font-black">${new Date().toLocaleDateString("fa-IR")}</div>
                <div class="text-[9px] text-slate-400 font-bold">گزارش مدیریتی A4 | سایان ERP</div>
            </div>
        </div>

        <!-- KPI CARDS -->
        <div class="mb-3">
            ${isCompare ? `
            <div class="grid grid-cols-4 gap-2 mb-3">
                <div class="bg-slate-50 border-r-4 border-slate-900 p-2 rounded-lg shadow-sm text-right">
                    <div class="text-[9px] font-black text-slate-500 mb-0.5">${card1Title}</div>
                    <div class="text-base font-black ${card1Value.startsWith('+') ? 'text-emerald-700' : (card1Value.startsWith('-') ? 'text-rose-700' : 'text-slate-900')} font-mono">${card1Value}</div>
                    <div class="text-[8.5px] text-slate-500 font-mono mt-0.5">${card1Sub}</div>
                </div>

                <div class="bg-slate-50 border-r-4 border-indigo-700 p-2 rounded-lg shadow-sm text-right">
                    <div class="text-[9px] font-black text-slate-500 mb-0.5">${card2Title}</div>
                    <div class="text-base font-black ${card2Value.startsWith('+') ? 'text-emerald-700' : (card2Value.startsWith('-') ? 'text-rose-700' : 'text-slate-900')} font-mono">${card2Value}</div>
                    <div class="text-[8.5px] text-slate-500 font-mono mt-0.5">${card2Sub}</div>
                </div>

                <div class="bg-slate-50 border-r-4 border-emerald-700 p-2 rounded-lg shadow-sm text-right">
                    <div class="text-[9px] font-black text-slate-500 mb-0.5">${card3Title}</div>
                    <div class="text-base font-black ${card3Value.startsWith('+') ? 'text-emerald-700' : (card3Value.startsWith('-') ? 'text-rose-700' : 'text-slate-900')} font-mono">${card3Value}</div>
                    <div class="text-[8.5px] text-slate-500 font-mono mt-0.5">${card3Sub}</div>
                </div>

                <div class="bg-slate-900 text-white p-2 rounded-lg shadow-sm text-right">
                    <div class="text-[9px] font-black text-slate-300 mb-0.5">${card4Title}</div>
                    <div class="text-base font-black text-amber-300 font-mono">${card4Value}</div>
                    <div class="text-[8.5px] text-slate-300 mt-0.5">${card4Sub}</div>
                </div>
            </div>
            ` : `
            <div class="grid grid-cols-3 gap-3 mb-3">
                <div class="bg-slate-50 border-r-4 border-emerald-600 p-2.5 rounded-lg shadow-sm">
                    <div class="text-[9px] font-black text-slate-500 mb-0.5">${card1Title}</div>
                    <div class="text-lg font-black text-slate-900 font-mono">${card1Value}</div>
                </div>

                <div class="bg-slate-50 border-r-4 border-slate-900 p-2.5 rounded-lg shadow-sm">
                    <div class="text-[9px] font-black text-slate-500 mb-0.5">${card2Title}</div>
                    <div class="text-lg font-black text-slate-900 font-mono">${card2Value}</div>
                </div>

                <div class="bg-slate-50 border-r-4 border-indigo-600 p-2.5 rounded-lg shadow-sm">
                    <div class="text-[9px] font-black text-slate-500 mb-0.5">${card3Title}</div>
                    <div class="text-lg font-black text-slate-900 font-mono">${card3Value}</div>
                </div>
            </div>
            `}

            <!-- TABLE -->
            <div class="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
                <table class="w-full text-right border-collapse">
                    <thead>
                        ${thead}
                    </thead>
                    <tbody>
                        ${tbody}
                    </tbody>
                </table>
            </div>

            <!-- SIGNATURE & FOOTER -->
            <div class="mt-3 p-2.5 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                <div class="flex justify-between items-center text-[8.5px] font-bold text-slate-500 uppercase">
                    <span>محل مهر و امضای مدیریت ارشد</span>
                    <span>محل امضای مدیر بازرگانی و فروش</span>
                    <span>تأییدیه امور مالی</span>
                </div>
                <div class="flex justify-between mt-2 gap-8 px-6">
                    <div class="h-6 w-1/4 border-b border-slate-300"></div>
                    <div class="h-6 w-1/4 border-b border-slate-300"></div>
                    <div class="h-6 w-1/4 border-b border-slate-300"></div>
                </div>
            </div>
        </div>

        <div class="mt-2 flex justify-between items-center text-[8.5px] text-slate-400 border-t border-slate-100 pt-1.5">
            <div class="font-bold">گزارش مدیریتی A4 رسمی - صادر شده از سامانه هوشمند سایان ERP</div>
            <div class="font-mono text-[8px]">Single Page A4 Executive Report</div>
        </div>
    </div>
</body>
</html>`;

    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      landscape,
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    await page.close();
    return pdf;
  } catch (e) {
    console.error("Generate Report PDF Error:", e.message);
    throw e;
  }
};

export const generateMeetingAnnouncementImage = async (meeting) => {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                ${fontFaceRule}
                body { background: #f9fafb; padding: 20px !important; font-family: 'Vazirmatn', sans-serif !important; }
                .card { background: white; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1); border: 2px solid #e5e7eb; overflow: hidden; width: 600px; }
                .header { background: #1e3a8a; color: white; padding: 30px; text-align: center; }
                .content { padding: 30px; }
                .item { padding: 10px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
            </style>
        </head><body>
            <div class="card">
                <div class="header">
                    <h1 style="font-size: 28px; font-weight: 900; margin: 0;">اعلان برگزاری جلسه تولید</h1>
                    <div style="font-size: 16px; margin-top: 10px;">شماره: ${meeting.meetingNumber}</div>
                </div>
                <div class="content">
                    <div style="font-size: 18px; font-weight: bold; margin-bottom: 20px;">
                        جلسه در تاریخ ${meeting.date} ساعت ${meeting.time} در ${meeting.location} برگزار خواهد شد.
                    </div>
                    <div style="font-size: 14px; color: #4b5563;">
                        <p>رئیس: ${meeting.chairman}</p>
                        <p>دبیر: ${meeting.secretary}</p>
                    </div>
                </div>
            </div></body></html>`;

    await page.setViewport({ width: 640, height: 800, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    const card = await page.$(".card");
    const buffer = await card.screenshot({ type: "png" });
    await page.close();
    return buffer;
  } catch (e) {
    console.error("Generate Announcement Image Error:", e.message);
    throw e;
  }
};

export const generateMeetingMinutesPDF = async (meeting) => {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1100, deviceScaleFactor: 2 });

    const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
            <style>
                ${BASE_STYLE}
                .meeting-header { border: 2px solid #333; padding: 15px; margin-bottom: 20px; }
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
                .sub-title { font-size: 18px; font-weight: bold; border-right: 4px solid #1e3a8a; padding-right: 10px; margin: 20px 0 10px 0; }
                .stamp { border: 2px solid #166534; color: #166534; border-radius: 10px; padding: 6px; transform: rotate(-3deg); text-align: center; background: white; min-width: 100px; box-shadow: 0 1px 2px rgba(0,0,0,0.05); display: inline-block; margin: 5px; }
                .stamp-title { font-size: 9px; font-weight: bold; border-bottom: 1px solid #166534; margin-bottom: 3px; padding-bottom: 1px; }
                .stamp-name { font-size: 12px; font-weight: 900; }
                .stamp-date { font-size: 8px; font-weight: bold; margin-top: 2px; }
            </style>
        </head><body>
            <div class="header">
                <div class="title">صورتجلسه</div>
                <div class="meta" style="justify-content: center; gap: 20px;"><span>شماره: ${meeting.meetingNumber}</span><span>تاریخ: ${meeting.date}</span></div>
            </div>

            <div class="meeting-header">
                <div class="grid-2">
                    <div><b>زمان برگزاری:</b> ${meeting.time}</div>
                    <div><b>مکان:</b> ${meeting.location}</div>
                    <div><b>رئیس جلسه:</b> ${meeting.chairman}</div>
                    <div><b>دبیر جلسه:</b> ${meeting.secretary}</div>
                </div>
            </div>

            <div class="sub-title">اعضای حاضر</div>
            <div style="font-size: 13px;">${meeting.attendees
              .filter((a) => a.isPresent)
              .map((a) => `• ${a.fullName} - ${a.role}`)
              .join("<br/>")}
                 ${(meeting.guestAttendees || []).map((g) => `• ${g} - مدعو`).join("<br/>")}</div>

            <div class="sub-title">مصوبات و تصمیمات</div>
            <table>
                <thead>
                    <tr><th style="width: 40px;">ردیف</th><th>شرح مصوبه</th><th style="width: 150px;">مسئول اجرا</th><th style="width: 100px;">زمان/مهلت</th></tr>
                </thead>
                <tbody>
                    ${meeting.items
                      .map(
                        (item, idx) => `
                        <tr>
                            <td>${idx + 1}</td>
                            <td style="text-align: right;">${item.description}</td>
                            <td>${item.responsiblePerson}</td>
                            <td>${item.duration}</td>
                        </tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>
                    
            <div class="sub-title">امضاها و تاییدات</div>
            <div style="display: flex; flex-wrap: wrap; margin-top: 20px;">
                ${Object.entries(meeting.approvals || {})
                  .map(([username, appInfo]) => {
                    const attendee = meeting.attendees.find(
                      (a) => a.username === username,
                    );
                    const name = attendee ? attendee.fullName : username;
                    const role = attendee ? attendee.role : "عضو";
                    return `
                        <div class="stamp">
                            <div class="stamp-title">تایید شد</div>
                            <div class="stamp-name">${name}</div>
                            <div class="stamp-date">${role}</div>
                            <div class="stamp-date">${new Date(appInfo.date).toLocaleDateString("fa-IR")}</div>
                        </div>
                    `;
                  })
                  .join("")}
            </div>
        </body></html>`;

    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    await page.close();
    return pdf;
  } catch (e) {
    console.error("Generate Meeting PDF Error:", e.message);
    throw e;
  }
};

export const generateSecretariatLetterPDF = async (
  letter,
  companyName,
  companySettings,
) => {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    const isA5 = letter.paperSize === "A5";
    const isLandscape = letter.orientation === "landscape";
    const format = isA5 ? "A5" : "A4";
    const landscape = isLandscape;

    await page.setViewport({
      width: isA5 ? 600 : 800,
      height: isA5 ? 850 : 1100,
      deviceScaleFactor: 2,
    });

    const hasCustomPos =
      companySettings?.metadataTop !== undefined ||
      companySettings?.metadataLeft !== undefined;

    const fontFamily = companySettings?.letterheadFontFamily || "Tahoma";
    const metadataTop = companySettings?.metadataTop ?? 25;
    const metadataLeft = companySettings?.metadataLeft ?? 20;
    const metadataFontSize = companySettings?.metadataFontSize ?? 11;
    const metadataOpacity = (companySettings?.metadataOpacity ?? 100) / 100;
    const metadataFontWeight = companySettings?.metadataFontWeight || "bold";

    const stampSize = companySettings?.companyStampSize || 120;
    const stampOpacity = (companySettings?.companyStampOpacity || 70) / 100;

    const effectivePdfLetterheadUrl =
      companySettings?.pdfLetterheadUrl || companySettings?.letterheadUrl;
    const isPdfLetterhead =
      effectivePdfLetterheadUrl &&
      effectivePdfLetterheadUrl.toLowerCase().endsWith(".pdf");

    let letterheadHtml = "";
    if (companySettings?.letterheadUrl || isPdfLetterhead) {
      letterheadHtml = `
                ${isPdfLetterhead ? "" : `<img src="${makeAbsolute(companySettings.letterheadUrl)}" class="letterhead-bg" />`}
                <div class="${hasCustomPos ? "lh-left-custom" : "lh-left-default-on-img"}">
                    <div>شماره: <span style="direction: ltr; display: inline-block; unicode-bidi: embed;">${toPersianDigits(letter.letterNumber)}</span></div>
                    <div>تاریخ: <span style="direction: ltr; display: inline-block; unicode-bidi: embed;">${toPersianDigits(letter.date)}</span></div>
                    <div>پیوست: ${letter.attachments?.length ? "دارد" : "ندارد"}</div>
                </div>
            `;
    } else {
      letterheadHtml = `
                <div class="default-letterhead">
                    <div class="lh-right">
                        <div>شماره: <span style="direction: ltr; display: inline-block; unicode-bidi: embed;">${toPersianDigits(letter.letterNumber)}</span></div>
                        <div>تاریخ: <span style="direction: ltr; display: inline-block; unicode-bidi: embed;">${toPersianDigits(letter.date)}</span></div>
                        <div>پیوست: ${letter.attachments?.length ? "دارد" : "ندارد"}</div>
                    </div>
                    <div class="lh-center">
                        <h2>دبیرخانه اداری ${companyName || "شرکت"}</h2>
                        <p>بخش: ${letter.section === "headquarters" ? "دفتر مرکزی" : "کارخانه"}</p>
                    </div>
                    <div class="lh-left"></div>
                </div>
            `;
    }

    let signaturesHtml = "";
    const sigPos = letter.signaturePosition || "bottom_left";

    let sigStyle = "text-align: center; margin-right: auto; margin-left: 0;";
    if (sigPos === "bottom_center")
      sigStyle = "text-align: center; margin: 0 auto;";
    if (sigPos === "bottom_right")
      sigStyle = "text-align: center; margin-left: auto; margin-right: 0;";

    const stampHtml =
      letter.addCompanyStamp && companySettings?.companyStampUrl
        ? `<img src="${makeAbsolute(companySettings.companyStampUrl)}" class="company-stamp" />`
        : "";

    let signersHtml = "";
    if (letter.signers && letter.signers.length > 0) {
      signersHtml = `
                <div style="display: flex; gap: 30px; justify-content: center; flex-wrap: wrap; margin-top: 10px;">
                    ${letter.signers
                      .map((s) => {
                        let signerSigUrl = "";
                        if (
                          s.userId &&
                          letter.approvedBy &&
                          letter.signatureImageUrls
                        ) {
                          const approverIdx = letter.approvedBy.indexOf(
                            s.userId,
                          );
                          if (approverIdx !== -1) {
                            signerSigUrl = makeAbsolute(
                              letter.signatureImageUrls[approverIdx],
                            );
                          }
                        }
                        return `
                            <div style="display: flex; flex-direction: column; align-items: center; min-w: 100px;">
                                <div style="font-weight: bold; font-size: 14px;">${s.name}</div>
                                <div style="font-weight: bold; font-size: 12px; color: #555; margin-bottom: 5px;">${s.title}</div>
                                ${signerSigUrl ? `<img src="${signerSigUrl}" style="height: 60px; object-fit: contain; mix-blend-mode: multiply; margin-top: 5px;" />` : ""}
                            </div>
                        `;
                      })
                      .join("")}
                </div>
            `;
    }

    let extraSignaturesHtml = "";
    if (letter.approvedBy && letter.approvedBy.length > 0) {
      const explicitUserIds = (letter.signers || [])
        .map((s) => s.userId)
        .filter(Boolean);
      const extraSignatures = letter.approvedBy
        .map((uid, idx) => ({ uid, url: letter.signatureImageUrls?.[idx] }))
        .filter((item) => item.url && !explicitUserIds.includes(item.uid));

      if (extraSignatures.length > 0) {
        extraSignaturesHtml = `
                    <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; margin-top: 10px;">
                        ${extraSignatures
                          .map(
                            (item) => `
                            <img src="${makeAbsolute(item.url)}" style="height: 50px; object-fit: contain; mix-blend-mode: multiply;" />
                        `,
                          )
                          .join("")}
                    </div>
                `;
      }
    }

    signaturesHtml = `
            <div class="signatures" style="${sigStyle}">
                <div class="sign-off-text" style="white-space: pre-wrap;">${letter.signOffText || "با تشکر"}</div>
                ${signersHtml}
                <div class="stamp-container">
                    ${stampHtml}
                    ${extraSignaturesHtml}
                </div>
            </div>
        `;

    const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
            <style>
                ${BASE_STYLE}
                @import url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.0.0/Vazirmatn-font-face.css');
                @import url('https://cdn.jsdelivr.net/gh/rastikerdar/shabnam-font@v5.0.1/dist/font-face.css');
                @import url('https://cdn.jsdelivr.net/gh/rastikerdar/sahel-font@v3.4.0/dist/font-face.css');
                @import url('https://cdn.jsdelivr.net/gh/rastikerdar/gandom-font@v0.8.0/dist/font-face.css');
                @import url('https://cdn.jsdelivr.net/gh/rastikerdar/samim-font@v4.0.5/dist/font-face.css');
                @import url('https://cdn.jsdelivr.net/gh/rastikerdar/estedad-font@v1.0.0-alpha3/dist/font-face.css');
                @import url('https://cdn.jsdelivr.net/gh/rastikerdar/tanha-font@v0.1.3/dist/font-face.css');
                @import url('https://cdn.jsdelivr.net/gh/rastikerdar/tahoma-font@v1.0.0/tahoma.css');
                
                html, body {
                    margin: 0; padding: 0;
                    font-family: '${fontFamily}', 'Tahoma', 'Arial', sans-serif;
                    direction: rtl;
                    height: 100%;
                    box-sizing: border-box;
                }
                
                .page-container {
                    position: relative;
                    width: 100%;
                    min-height: 100vh;
                    overflow: hidden;
                    box-sizing: border-box;
                    padding-top: ${companySettings?.letterheadUrl ? "150px" : "30px"};
                    padding-bottom: 100px;
                }
                
                .letterhead-bg {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    width: 100%; height: 100%;
                    object-fit: fill;
                    z-index: -1;
                }
                
                .lh-left-default-on-img {
                    position: absolute;
                    top: 25mm; left: 20mm;
                    font-size: 11px;
                    line-height: 1.8;
                    opacity: ${metadataOpacity};
                    font-weight: ${metadataFontWeight} !important;
                    text-align: right !important;
                    direction: rtl !important;
                    white-space: nowrap !important;
                }
                
                .lh-left-custom {
                    position: absolute !important;
                    top: ${metadataTop}mm !important;
                    left: ${metadataLeft}mm !important;
                    font-size: ${metadataFontSize}px !important;
                    line-height: 1.8 !important;
                    z-index: 100 !important;
                    opacity: ${metadataOpacity} !important;
                    font-weight: ${metadataFontWeight} !important;
                    text-align: right !important;
                    direction: rtl !important;
                    white-space: nowrap !important;
                }
                
                .default-letterhead {
                    display: flex; justify-content: space-between; align-items: flex-start;
                    border-bottom: 3px double #333; padding-bottom: 20px; margin-bottom: 40px;
                    padding-left: 30px; padding-right: 30px;
                }
                .default-letterhead .lh-right {
                    font-size: 11px;
                    line-height: 1.8;
                    width: 33%;
                    text-align: right;
                    opacity: ${metadataOpacity};
                    font-weight: ${metadataFontWeight} !important;
                }
                .default-letterhead .lh-center { text-align: center; width: 34%; }
                .default-letterhead .lh-center h2 { margin: 0 0 5px 0; font-size: 20px; }
                .default-letterhead .lh-center p { margin: 0; font-size: 12px; color: #555; }
                .default-letterhead .lh-left { width: 33%; }
                
                .letter-content-wrapper {
                    padding: 0 40px;
                    z-index: 10;
                    position: relative;
                }
                
                .salutation { margin-bottom: 25px; font-weight: bold; font-size: 14px; line-height: 1.8; }
                .letter-body { font-size: 14px; line-height: 2; text-align: justify; margin-bottom: 50px; }
                
                .signatures { width: 250px; }
                .sign-off-text { font-weight: bold; font-size: 14px; margin-bottom: 15px; }
                .company-name { font-weight: bold; font-size: 14px; }
                .sender-name { font-weight: bold; font-size: 14px; margin-bottom: 10px; }
                
                .stamp-container { position: relative; min-height: ${stampSize}px; display: flex; align-items: center; justify-content: center; margin-top: 10px; }
                .company-stamp { position: absolute; max-width: ${stampSize}px; max-height: ${stampSize}px; opacity: ${stampOpacity}; mix-blend-multiply: multiply; z-index: -1; }
                
                .footer {
                    position: absolute; bottom: 20px; left: 30px; right: 30px;
                    border-top: 1px solid #ccc; padding-top: 10px;
                    display: flex; justify-content: space-between;
                    font-size: 10px; color: #666;
                }
            </style>
        </head><body>
            <div class="page-container">
                ${letterheadHtml}
                
                <div class="letter-content-wrapper">
                    <div class="salutation">
                        ${letter.hideSubjectInLetter ? "" : `<div>موضوع: ${letter.subject}</div>`}
                        ${letter.hideSalutationInLetter ? "" : `<div>با سلام و احترام،</div>`}
                    </div>
                    
                    <div class="letter-body">
                        ${letter.content || ""}
                    </div>
                    
                    ${signaturesHtml}
                </div>
                
                ${
                  !companySettings?.hideAutoFooter ||
                  !companySettings?.letterheadUrl
                    ? `
                <div class="footer">
                    <span>نشانی: ${companySettings?.address || "ثبت نشده"}</span>
                    <span>تلفن: ${companySettings?.phone || "ثبت نشده"}</span>
                    <span>کدپستی: ${companySettings?.postalCode || "-"}</span>
                </div>
                `
                    : ""
                }
            </div>
        </body></html>`;

    await page.setContent(html, { waitUntil: "networkidle0" });
    let pdf = await page.pdf({
      format: format,
      landscape: landscape,
      printBackground: true,
      omitBackground: isPdfLetterhead,
      margin: { top: "0", bottom: "0", left: "0", right: "0" }, // handled by CSS
    });

    await page.close();

    if (isPdfLetterhead) {
      try {
        const { PDFDocument } = await import("pdf-lib");
        const parts = effectivePdfLetterheadUrl.split("/uploads/");
        const fileName = parts[parts.length - 1].split("?")[0];
        const fullPath = path.join(process.cwd(), "uploads", fileName);

        if (fs.existsSync(fullPath)) {
          const letterheadBytes = fs.readFileSync(fullPath);
          const mainPdfDoc = await PDFDocument.load(pdf);
          const letterheadDoc = await PDFDocument.load(letterheadBytes);

          const pages = mainPdfDoc.getPages();
          const letterheadPage = letterheadDoc.getPages()[0];

          // Embed letterhead page into the main doc
          const [embeddedLetterhead] = await mainPdfDoc.embedPdf(
            letterheadBytes,
            [0],
          );

          for (const p of pages) {
            const { width, height } = p.getSize();
            // Draw letterhead at the bottom layer (behind text)
            p.drawPage(embeddedLetterhead, {
              x: 0,
              y: 0,
              width: width,
              height: height,
            });
          }

          pdf = Buffer.from(await mainPdfDoc.save());
        }
      } catch (mergeErr) {
        console.error("PDF Merge Error:", mergeErr);
      }
    }

    return pdf;
  } catch (e) {
    console.error("Generate Letter PDF Error:", e.message);
    throw e;
  }
};

export const generateSecretariatLetterDoc = async (
  letter,
  companyName,
  companySettings,
  company,
  noLetterhead = false,
) => {
  const isA5 = letter.paperSize === "A5";
  const isLandscape = letter.orientation === "landscape";
  const fontFamily = companySettings?.letterheadFontFamily || "Tahoma";

  let letterheadHtml = "";
  if (!noLetterhead) {
    if (
      companySettings?.letterheadUrl &&
      !companySettings.letterheadUrl.toLowerCase().endsWith(".pdf")
    ) {
      letterheadHtml = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${makeAbsolute(companySettings.letterheadUrl)}" style="width: 100%; object-fit: contain;" />
                </div>
                <table style="width: 100%; margin-bottom: 25px; border-bottom: 1px solid #ddd; padding-bottom: 10px; font-size: 11pt; font-family: '${fontFamily}', 'Tahoma', sans-serif; direction: rtl;">
                    <tr>
                        <td style="text-align: right; width: 50%;"><b>شماره:</b> <span style="direction: ltr; display: inline-block;">${toPersianDigits(letter.letterNumber)}</span></td>
                        <td style="text-align: left; width: 50%;"><b>تاریخ:</b> <span style="direction: ltr; display: inline-block;">${toPersianDigits(letter.date)}</span></td>
                    </tr>
                    <tr>
                        <td style="text-align: right;"><b>پیوست:</b> ${letter.attachments?.length > 0 ? "دارد" : "ندارد"}</td>
                        <td style="text-align: left;"><b>بخش:</b> ${letter.section === "headquarters" ? "دفتر مرکزی" : "کارخانه"}</td>
                    </tr>
                </table>
            `;
    } else {
      letterheadHtml = `
                <table style="width: 100%; margin-bottom: 30px; border-bottom: 3px double #333; padding-bottom: 15px; direction: rtl;">
                    <tr>
                        <td style="width: 33%; text-align: right; vertical-align: top; font-size: 11pt; line-height: 1.6; font-family: '${fontFamily}', 'Tahoma', sans-serif;">
                            <div><b>شماره:</b> <span style="direction: ltr; display: inline-block;">${toPersianDigits(letter.letterNumber)}</span></div>
                            <div><b>تاریخ:</b> <span style="direction: ltr; display: inline-block;">${toPersianDigits(letter.date)}</span></div>
                            <div><b>پیوست:</b> ${letter.attachments?.length > 0 ? "دارد" : "ندارد"}</div>
                        </td>
                        <td style="width: 34%; text-align: center; vertical-align: top; font-family: '${fontFamily}', 'Tahoma', sans-serif;">
                            <div style="font-size: 11pt; font-weight: bold; margin-bottom: 5px;">باسمه تعالی</div>
                            <div style="font-size: 14pt; font-weight: bold; color: #1e3a8a;">دبیرخانه اداری</div>
                            <div style="font-size: 12pt; font-weight: bold; color: #555;">${companyName || "شرکت"}</div>
                            <div style="font-size: 9pt; color: #777; margin-top: 3px;">بخش: ${letter.section === "headquarters" ? "دفتر مرکزی" : "کارخانه"}</div>
                        </td>
                        <td style="width: 33%; text-align: left; vertical-align: top;">
                            ${
                              company?.logo || companySettings?.logoUrl
                                ? `
                                <img src="${makeAbsolute(company?.logo || companySettings?.logoUrl)}" style="width: 70px; height: 70px; max-width: 100%; object-fit: contain;" />
                            `
                                : ``
                            }
                        </td>
                    </tr>
                </table>
            `;
    }
  }

  let html = `<!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
    <meta charset="utf-8">
    <title>${letter.subject}</title>
    <style>
        body { font-family: 'Tahoma', sans-serif; direction: rtl; }
        .letter-meta { width: 100%; margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        .letter-meta td { font-size: 10.5pt; color: #333; }
        .letter-content { font-size: 11pt; line-height: 1.6; margin-bottom: 40px; text-align: justify; }
        .signatures { width: 100%; margin-top: 50px; }
        .signature-box { text-align: center; font-size: 10pt; }
        .signature-image { max-height: 70px; margin-bottom: 5px; }
    </style>
    </head>
    <body>
        <div class="Section1">
            ${letterheadHtml}
            <table class="letter-meta" style="width: 100%;">
                <tr>
                    <td style="text-align: right; width: 50%;"><b>به سمت:</b> ${letter.receiver || "نامشخص"}</td>
                    <td style="text-align: left; width: 50%;"><b>موضوع:</b> ${letter.subject}</td>
                </tr>
                <tr>
                    <td style="text-align: right;"><b>از طرف:</b> ${letter.sender || "نامشخص"}</td>
                    <td style="text-align: left;"><b>بخش:</b> ${letter.section === "headquarters" ? "دفتر مرکزی" : "کارخانه"}</td>
                </tr>
            </table>
            
            <div class="letter-content" style="text-align: right;">
                ${letter.hideSalutationInLetter ? "" : `<p><b>با سلام و احترام،</b></p>`}
                ${letter.content}
            </div>
            
            ${
              letter.signers && letter.signers.length > 0
                ? `
            <table class="signatures" style="width: 100%; margin-top: 40px;">
                <tr>
                ${letter.signers
                  .map((s) => {
                    let sigImg = "";
                    if (
                      s.userId &&
                      letter.approvedBy &&
                      letter.signatureImageUrls
                    ) {
                      const idx = letter.approvedBy.indexOf(s.userId);
                      if (idx !== -1) {
                        sigImg = `<br/><img src="${makeAbsolute(letter.signatureImageUrls[idx])}" class="signature-image" style="height: 60px; object-fit: contain; margin-top: 5px;" />`;
                      }
                    }
                    return `<td class="signature-box" style="width: ${100 / letter.signers.length}%; text-align: center;"><b>${s.name}</b><br/><span style="color: #666; font-size: 9pt;">${s.title}</span>${sigImg}</td>`;
                  })
                  .join("")}
                </tr>
            </table>
            `
                : ""
            }
            
            ${
              letter.addCompanyStamp && companySettings?.companyStampUrl
                ? `
                <div style="text-align: center; margin-top: 30px;">
                    <img src="${makeAbsolute(companySettings.companyStampUrl)}" style="max-height: 120px; object-fit: contain;" />
                </div>
            `
                : ""
            }
            
            ${
              !companySettings?.hideAutoFooter ||
              !companySettings?.letterheadUrl
                ? `
            <div style="margin-top: 50px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 8pt; color: #666; text-align: center;">
                نشانی: ${companySettings?.address || "ثبت نشده"} | تلفن: ${companySettings?.phone || "ثبت نشده"} | کدپستی: ${companySettings?.postalCode || "-"}
            </div>
            `
                : ""
            }
        </div>
    </body>
    </html>`;

  // html-to-docx conversion
  const HTMLToDOCX = await import("html-to-docx");

  // clean up specific problem tags
  html = html.replace(/<p><\/p>/g, "<br/>");

  const docxBuffer = await HTMLToDOCX.default(html, null, {
    table: { row: { cantSplit: true } },
    footer: true,
    pageNumber: true,
    font: fontFamily || "Tahoma",
    orientation: isLandscape ? "landscape" : "portrait",
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
  });

  return docxBuffer;
};

// 5. Production & Waste Report PDF
export const generateProductionReportPDF = async (
  title,
  dateFrom,
  dateTo,
  items = [],
  totals = { qty_61: 0, qty_67: 0, qty_79: 0, qty_73: 0, qty_schweiter: 0, grandTotal: 0 },
  waste = { waste_61: 0, waste_67: 0, waste_79: 0, waste_73: 0, waste_schweiter: 0, totalWaste: 0, pct_61: 0, pct_67: 0, pct_79: 0, pct_73: 0, pct_schweiter: 0, totalPct: 0, details: '' }
) => {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    const rowsHtml = items.map((item, idx) => `
      <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-size: 9.5pt;">
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${item.unit || 'کیلوگرم'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #1e293b;">${item.name}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${item.qty_61 > 0 ? item.qty_61.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${item.qty_67 > 0 ? item.qty_67.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${item.qty_79 > 0 ? item.qty_79.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${item.qty_73 > 0 ? item.qty_73.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${item.qty_schweiter > 0 ? item.qty_schweiter.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
        <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #0f172a; background-color: #f1f5f9;">${item.total > 0 ? item.total.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
      </tr>
    `).join('');

    const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="fa">
    <head>
        <meta charset="UTF-8">
        <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'Tahoma', 'IRANSans', sans-serif; margin: 0; padding: 10px; color: #0f172a; direction: rtl; }
            .header-table { width: 100%; margin-bottom: 12px; border-collapse: collapse; }
            .header-box { border: 1px solid #94a3b8; padding: 6px 12px; border-radius: 4px; font-size: 9pt; background: #f8fafc; }
            .title { font-size: 15pt; font-weight: 800; text-align: center; color: #1e3a8a; }
            .report-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9.5pt; }
            .report-table th, .report-table td { border: 1px solid #64748b; padding: 6px 8px; text-align: center; }
            .report-table th { background-color: #e2e8f0; color: #0f172a; font-weight: 800; }
            .summary-row { background-color: #f1f5f9; font-weight: bold; }
            .waste-row { background-color: #fef2f2; font-weight: bold; color: #991b1b; }
            .pct-row { background-color: #fff7ed; font-weight: bold; color: #c2410c; }
            .waste-notes { margin-top: 15px; border: 1px solid #cbd5e1; padding: 10px; border-radius: 6px; background: #fafafa; font-size: 9.5pt; }
        </style>
    </head>
    <body>
        <table class="header-table">
            <tr>
                <td style="width: 28%;">
                    <div class="header-box">
                        <div><strong>از تاریخ:</strong> ${dateFrom}</div>
                        <div><strong>تا تاریخ:</strong> ${dateTo}</div>
                    </div>
                </td>
                <td style="width: 44%;" class="title">
                    ${title || 'گزارش آمار کل تولید و ضایعات (سایان ERP)'}
                </td>
                <td style="width: 28%; text-align: left;">
                    <div style="font-size: 8.5pt; color: #64748b;">
                        تاریخ استعلام: ${dateFrom}
                    </div>
                </td>
            </tr>
        </table>

        <table class="report-table">
            <thead>
                <tr>
                    <th colspan="2" style="background: #cbd5e1;">کالاها</th>
                    <th colspan="6" style="background: #93c5fd;">عملیات</th>
                </tr>
                <tr>
                    <th style="width: 8%;">واحد</th>
                    <th style="width: 28%;">کالا</th>
                    <th style="width: 10%;">61 تولید POY</th>
                    <th style="width: 10%;">67 تولید DTY</th>
                    <th style="width: 10%;">79 تولید کش</th>
                    <th style="width: 11%;">73 تولید اسپاندکس</th>
                    <th style="width: 11%;">تولید شوایتر</th>
                    <th style="width: 12%;">جمع</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml || '<tr><td colspan="8">هیچ موردی ثبت نشده است.</td></tr>'}
            </tbody>
            <tfoot>
                <tr class="summary-row">
                    <td colspan="2" style="text-align: right; font-weight: bold; padding-right: 12px; background: #e2e8f0;">جمع تولید</td>
                    <td>${totals.qty_61 ? totals.qty_61.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                    <td>${totals.qty_67 ? totals.qty_67.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                    <td>${totals.qty_79 ? totals.qty_79.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                    <td>${totals.qty_73 ? totals.qty_73.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                    <td>${totals.qty_schweiter ? totals.qty_schweiter.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                    <td style="background: #cbd5e1; font-size: 10.5pt;">${totals.grandTotal ? totals.grandTotal.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '-'}</td>
                </tr>
                <tr class="waste-row">
                    <td colspan="2" style="text-align: right; font-weight: bold; padding-right: 12px;">ضایعات (کیلوگرم)</td>
                    <td>${waste.waste_61 ? waste.waste_61.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '0'}</td>
                    <td>${waste.waste_67 ? waste.waste_67.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '0'}</td>
                    <td>${waste.waste_79 ? waste.waste_79.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '0'}</td>
                    <td>${waste.waste_73 ? waste.waste_73.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '0'}</td>
                    <td>${waste.waste_schweiter ? waste.waste_schweiter.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '0'}</td>
                    <td style="background: #fca5a5;">${waste.totalWaste ? waste.totalWaste.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : '0'}</td>
                </tr>
                <tr class="pct-row">
                    <td colspan="2" style="text-align: right; font-weight: bold; padding-right: 12px;">درصد ضایعات</td>
                    <td>${waste.pct_61 ? waste.pct_61.toFixed(2) : '0.00'}%</td>
                    <td>${waste.pct_67 ? waste.pct_67.toFixed(2) : '0.00'}%</td>
                    <td>${waste.pct_79 ? waste.pct_79.toFixed(2) : '0.00'}%</td>
                    <td>${waste.pct_73 ? waste.pct_73.toFixed(2) : '0.00'}%</td>
                    <td>${waste.pct_schweiter ? waste.pct_schweiter.toFixed(2) : '0.00'}%</td>
                    <td style="background: #fdba74;">${waste.totalPct ? waste.totalPct.toFixed(2) : '0.00'}%</td>
                </tr>
            </tfoot>
        </table>

        ${waste.details ? `
            <div class="waste-notes">
                <strong>📝 جزئیات و توضیحات ضایعات:</strong>
                <div style="margin-top: 5px; white-space: pre-wrap; color: #334155;">${waste.details}</div>
            </div>
        ` : ''}
    </body>
    </html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });
    await page.close();
    return pdf;
  } catch (e) {
    console.error("Generate Production Report PDF Error:", e);
    throw e;
  }
};

// 6. Production Compare Report PDF
export const generateProductionCompareReportPDF = async (
  title,
  dateFromA,
  dateToA,
  dateFromB,
  dateToB,
  items = []
) => {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    const rowsHtml = items.map((item, idx) => {
      const diff = (item.totalA || 0) - (item.totalB || 0);
      const diffPct = item.totalB ? (diff / item.totalB) * 100 : 0;
      const pctText = item.totalB ? `${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}%` : '-';
      const pctColor = diff > 0 ? '#15803d' : (diff < 0 ? '#b91c1c' : '#475569');

      return `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-size: 9.5pt;">
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #1e293b;">${item.name}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${(item.totalA || 0).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center;">${(item.totalB || 0).toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${diff >= 0 ? '#15803d' : '#b91c1c'};">${diff.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: ${pctColor};">${pctText}</td>
        </tr>
      `;
    }).join('');

    const sumA = items.reduce((sum, item) => sum + (item.totalA || 0), 0);
    const sumB = items.reduce((sum, item) => sum + (item.totalB || 0), 0);
    const totalDiff = sumA - sumB;
    const totalDiffPct = sumB ? (totalDiff / sumB) * 100 : 0;

    const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="fa">
    <head>
        <meta charset="UTF-8">
        <style>
            @page { size: A4 portrait; margin: 10mm; }
            body { font-family: 'Tahoma', 'IRANSans', sans-serif; margin: 0; padding: 10px; color: #0f172a; direction: rtl; }
            .header-table { width: 100%; margin-bottom: 15px; border-collapse: collapse; }
            .header-box { border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; font-size: 9.5pt; background: #f8fafc; }
            .title { font-size: 14pt; font-weight: 800; text-align: center; color: #1e3a8a; }
            .report-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 9.5pt; }
            .report-table th, .report-table td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: center; }
            .report-table th { background-color: #f1f5f9; color: #0f172a; font-weight: 800; }
            .summary-row { background-color: #e2e8f0; font-weight: bold; font-size: 10pt; }
            .footer { margin-top: 30px; text-align: center; font-size: 8pt; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
    </head>
    <body>
        <table class="header-table">
            <tr>
                <td style="width: 45%;">
                    <div class="header-box">
                        <div><strong>بازه اول (A):</strong> ${dateFromA} تا ${dateToA}</div>
                        <div><strong>بازه دوم (B):</strong> ${dateFromB} تا ${dateToB}</div>
                    </div>
                </td>
                <td style="width: 55%; text-align: left;" class="title">
                    ${title || 'گزارش مقایسه‌ای آمار تولید (سایان ERP)'}
                </td>
            </tr>
        </table>

        <table class="report-table">
            <thead>
                <tr>
                    <th style="text-align: right;">نام کالا / گروه کالا</th>
                    <th>بازه اول (A) (kg)</th>
                    <th>بازه دوم (B) (kg)</th>
                    <th>تفاضل (A - B) (kg)</th>
                    <th>درصد تغییر</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
                <tr class="summary-row">
                    <td style="text-align: right; padding-right: 12px;">جمع کل تولید مقایسه‌ای</td>
                    <td>${sumA.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    <td>${sumB.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    <td style="color: ${totalDiff >= 0 ? '#15803d' : '#b91c1c'};">${totalDiff.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    <td style="color: ${totalDiff >= 0 ? '#15803d' : '#b91c1c'};">${sumB ? `${totalDiffPct > 0 ? '+' : ''}${totalDiffPct.toFixed(1)}%` : '-'}</td>
                </tr>
            </tbody>
        </table>

        <div class="footer">
            <p>این گزارش به صورت خودکار توسط سیستم مقایسه‌ای آمار تولید سایان ERP تولید شده است.</p>
        </div>
    </body>
    </html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      portrait: true,
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });
    await page.close();
    return pdf;
  } catch (e) {
    console.error("Generate Production Compare Report PDF Error:", e);
    throw e;
  }
};

// 7. Warehouse Overview & Supply Chain Comparative Balance PDF (Page 1: Full Tables + Page 2: Trend / Growth & Deficits)
export const generateWarehouseOverviewReportPDF = async (reportData = {}) => {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();

    const {
      mode = 'both', // 'both' | 'overview_only' | 'variance_only'
      summary = {},
      yarnItems = [],
      rawItems = [],
      logisticsItems = [],
      growthItems = [],
      negativeItems = [],
      signature = 'انبارداری مرکزی و تامین خارجی'
    } = reportData;

    const fNum = (n, dec = 0) => {
      const num = parseFloat(n) || 0;
      return num.toLocaleString('fa-IR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    };

    const fTon = (n) => {
      const num = (parseFloat(n) || 0) / 1000;
      return num.toLocaleString('fa-IR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    };

    const reportDate = summary.reportDate || '۱۴۰۵/۰۵/۳۱';
    const r1Label = summary.report1Label || 'منتهی به سال ۱۴۰۴';
    const r2Label = summary.report2Label || 'وضعیت فعلی سال ۱۴۰۵';

    // Summary calculations
    const yLast = summary.lastYearYarnsWeight || 0;
    const yCurr = summary.currentYarnsWeight || 0;
    const yDiff = yCurr - yLast;
    const yPct = yLast ? (yDiff / yLast) * 100 : 0;

    const rLast = summary.lastYearRawWeight || 0;
    const rCurr = summary.currentRawWeight || 0;
    const rDiff = rCurr - rLast;
    const rPct = rLast ? (rDiff / rLast) * 100 : 0;

    const tLast = summary.lastYearTotalWeight || (yLast + rLast);
    const tCurr = summary.currentTotalWeight || (yCurr + rCurr);
    const tDiff = tCurr - tLast;
    const tPct = tLast ? (tDiff / tLast) * 100 : 0;

    // Build Table Rows
    const buildItemRows = (items, prefix = '') => {
      if (!items || items.length === 0) {
        return `<tr><td colspan="6" style="padding: 8px; text-align: center; color: #64748b;">موردی ثبت نشده است</td></tr>`;
      }
      return items.map((item, idx) => {
        const last = parseFloat(item.lastYearWeight) || 0;
        const curr = parseFloat(item.currentWeight) || 0;
        const diff = curr - last;
        const pct = last ? (diff / last) * 100 : 0;
        const isNeg = diff < 0;
        const pctColor = isNeg ? '#b91c1c' : (diff > 0 ? '#15803d' : '#475569');
        const badgeBg = isNeg ? '#fef2f2' : '#f0fdf4';
        const badgeBorder = isNeg ? '#fecaca' : '#bbf7d0';

        return `
          <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-size: 8.5pt;">
            <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #64748b; font-weight: bold;">${idx + 1}</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #1e293b;">
              ${item.name || item.groupName || '-'}
              ${item.code ? `<span style="font-size: 7pt; color: #64748b; margin-right: 4px;">(${item.code})</span>` : ''}
            </td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-family: Tahoma, 'IRANSans', sans-serif;">${fNum(last)}</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-family: Tahoma, 'IRANSans', sans-serif; font-weight: bold; color: #0f172a;">${fNum(curr)}</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-family: Tahoma, 'IRANSans', sans-serif; font-weight: bold; color: ${pctColor}; direction: ltr;">
              ${diff >= 0 ? '+' : ''}${fNum(diff)}
            </td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-family: Tahoma, 'IRANSans', sans-serif; font-weight: bold; color: ${pctColor}; background: ${badgeBg};">
              ${last ? `${pct >= 0 ? '+' : ''}${fNum(pct, 1)}%` : '-'}
            </td>
          </tr>
        `;
      }).join('');
    };

    // Logistics Table Rows
    const buildLogisticsRows = (items) => {
      if (!items || items.length === 0) return '';
      return items.map((item, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; font-size: 8.5pt;">
          <td style="padding: 5px 6px; border: 1px solid #cbd5e1; text-align: center; color: #64748b;">${idx + 1}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #1e293b;">${item.name || '-'}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">${item.status || 'در راه / گمرک'}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #0284c7;">${item.containers ? `${item.containers} کانتینر` : '-'}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">${item.currentValue || item.diffValue || '-'}</td>
          <td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; color: #475569;">${item.currency || 'ارزی'}</td>
        </tr>
      `).join('');
    };

    // Deficit / Negative Items Table Rows
    const buildNegativeRows = (items) => {
      if (!items || items.length === 0) {
        return `<tr><td colspan="7" style="padding: 12px; text-align: center; color: #15803d; background-color: #f0fdf4; font-weight: bold;">✅ هیچ کالایی با تراز وزنی منفی یافت نشد. تمامی اقلام در وضعیت رشد یا حفظ موجودی قرار دارند.</td></tr>`;
      }
      return items.map((item, idx) => {
        const last = parseFloat(item.lastYearWeight) || 0;
        const curr = parseFloat(item.currentWeight) || 0;
        const diff = parseFloat(item.diffWeight) || (curr - last);
        const ratio = parseFloat(item.ratio) || (last ? (diff / last) * 100 : 0);
        const cat = item.category === 'factory' ? '🧵 تولید کارخانه' : '📦 مواد اولیه / وارداتی';

        return `
          <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#fff1f2'}; font-size: 8.5pt;">
            <td style="padding: 5px 6px; border: 1px solid #fecaca; text-align: center; color: #991b1b; font-weight: bold;">${idx + 1}</td>
            <td style="padding: 5px 8px; border: 1px solid #fecaca; text-align: right; font-weight: bold; color: #991b1b;">
              ${item.name || '-'}
              ${item.code ? `<span style="font-size: 7pt; color: #64748b; margin-right: 4px;">(${item.code})</span>` : ''}
            </td>
            <td style="padding: 5px 6px; border: 1px solid #fecaca; text-align: center; font-size: 7.5pt; color: #475569;">${cat}</td>
            <td style="padding: 5px 8px; border: 1px solid #fecaca; text-align: center; font-family: Tahoma, 'IRANSans', sans-serif;">${fNum(last)} kg</td>
            <td style="padding: 5px 8px; border: 1px solid #fecaca; text-align: center; font-family: Tahoma, 'IRANSans', sans-serif; font-weight: bold; color: #1e293b;">${fNum(curr)} kg</td>
            <td style="padding: 5px 8px; border: 1px solid #fecaca; text-align: center; font-family: Tahoma, 'IRANSans', sans-serif; font-weight: bold; color: #b91c1c; background: #fee2e2;">
              ${fNum(diff)} kg <span style="font-size: 7pt; color: #991b1b;">(${fTon(diff)} تن)</span>
            </td>
            <td style="padding: 5px 8px; border: 1px solid #fecaca; text-align: center; font-family: Tahoma, 'IRANSans', sans-serif; font-weight: bold; color: #b91c1c; background: #fef2f2;">
              ${fNum(ratio, 1)}%
            </td>
          </tr>
        `;
      }).join('');
    };

    // Growth / Positive Items Table Rows
    const buildGrowthRows = (items) => {
      if (!items || items.length === 0) {
        return `<tr><td colspan="7" style="padding: 10px; text-align: center; color: #64748b;">موردی یافت نشد</td></tr>`;
      }
      return items.slice(0, 15).map((item, idx) => {
        const last = parseFloat(item.lastYearWeight) || 0;
        const curr = parseFloat(item.currentWeight) || 0;
        const diff = parseFloat(item.diffWeight) || (curr - last);
        const ratio = parseFloat(item.ratio) || (last ? (diff / last) * 100 : 0);
        const cat = item.category === 'factory' ? '🧵 تولید کارخانه' : '📦 مواد اولیه / وارداتی';

        return `
          <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f0fdf4'}; font-size: 8.5pt;">
            <td style="padding: 5px 6px; border: 1px solid #bbf7d0; text-align: center; color: #166534; font-weight: bold;">${idx + 1}</td>
            <td style="padding: 5px 8px; border: 1px solid #bbf7d0; text-align: right; font-weight: bold; color: #14532d;">
              ${item.name || '-'}
              ${item.code ? `<span style="font-size: 7pt; color: #64748b; margin-right: 4px;">(${item.code})</span>` : ''}
            </td>
            <td style="padding: 5px 6px; border: 1px solid #bbf7d0; text-align: center; font-size: 7.5pt; color: #475569;">${cat}</td>
            <td style="padding: 5px 8px; border: 1px solid #bbf7d0; text-align: center; font-family: Tahoma, 'IRANSans', sans-serif;">${fNum(last)} kg</td>
            <td style="padding: 5px 8px; border: 1px solid #bbf7d0; text-align: center; font-family: Tahoma, 'IRANSans', sans-serif; font-weight: bold; color: #1e293b;">${fNum(curr)} kg</td>
            <td style="padding: 5px 8px; border: 1px solid #bbf7d0; text-align: center; font-family: Tahoma, 'IRANSans', sans-serif; font-weight: bold; color: #15803d; background: #dcfce7;">
              +${fNum(diff)} kg <span style="font-size: 7pt; color: #166534;">(+${fTon(diff)} تن)</span>
            </td>
            <td style="padding: 5px 8px; border: 1px solid #bbf7d0; text-align: center; font-family: Tahoma, 'IRANSans', sans-serif; font-weight: bold; color: #15803d; background: #f0fdf4;">
              +${fNum(ratio, 1)}%
            </td>
          </tr>
        `;
      }).join('');
    };

    const renderPage1 = mode === 'both' || mode === 'overview_only';
    const renderPage2 = mode === 'both' || mode === 'variance_only';

    const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="fa">
    <head>
        <meta charset="UTF-8">
        <style>
            @page { size: A4 portrait; margin: 8mm; }
            body { font-family: 'Vazirmatn', 'Tahoma', 'IRANSans', sans-serif; margin: 0; padding: 0; color: #0f172a; direction: rtl; background: #ffffff; }
            .page-container { width: 100%; box-sizing: border-box; }
            .page-break { page-break-before: always; }
            
            /* Header */
            .header-banner { border: 1.5px solid #2563eb; border-radius: 8px; padding: 8px 12px; margin-bottom: 10px; background: #f8fafc; }
            .header-table { width: 100%; border-collapse: collapse; }
            .header-title { font-size: 13pt; font-weight: 900; color: #1e3a8a; text-align: right; }
            .header-subtitle { font-size: 8pt; color: #475569; margin-top: 2px; }
            .header-meta { font-size: 8pt; text-align: left; line-height: 1.6; color: #334155; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 7.5pt; font-weight: bold; }
            .badge-blue { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
            .badge-green { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
            .badge-red { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }

            /* KPI Cards */
            .kpi-grid { width: 100%; border-collapse: separate; border-spacing: 6px 0; margin-bottom: 10px; }
            .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; background: #f8fafc; text-align: center; }
            .kpi-title { font-size: 7.5pt; font-weight: bold; color: #475569; margin-bottom: 3px; }
            .kpi-value { font-size: 10.5pt; font-weight: 900; color: #0f172a; }
            .kpi-diff { font-size: 7.5pt; font-weight: bold; margin-top: 2px; }

            /* Section Header */
            .section-head { font-size: 9.5pt; font-weight: 800; color: #1e3a8a; border-right: 4px solid #2563eb; padding-right: 6px; margin: 8px 0 4px 0; display: flex; align-items: center; }
            
            /* Tables */
            .data-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 8.5pt; }
            .data-table th { background-color: #f1f5f9; color: #0f172a; font-weight: 800; border: 1px solid #cbd5e1; padding: 5px 6px; text-align: center; font-size: 8pt; }
            .data-table td { border: 1px solid #cbd5e1; padding: 4px 6px; }
            .data-table .cat-row { background-color: #e2e8f0; font-weight: 800; color: #1e293b; font-size: 8.5pt; }
            .data-table .total-row { background-color: #1e3a8a; color: #ffffff; font-weight: 900; font-size: 9pt; }
            .data-table .total-row td { border: 1px solid #1e3a8a; }

            /* Signatures & Footer */
            .sig-table { width: 100%; margin-top: 15px; border-collapse: collapse; }
            .sig-box { width: 33.33%; text-align: center; font-size: 8pt; padding: 8px; vertical-align: top; }
            .sig-title { font-weight: bold; color: #334155; margin-bottom: 30px; }
            .sig-name { color: #64748b; font-size: 7.5pt; border-top: 1px dashed #cbd5e1; padding-top: 4px; display: inline-block; width: 80%; }
            .doc-footer { margin-top: 10px; border-top: 1px solid #e2e8f0; padding-top: 4px; text-align: center; font-size: 7pt; color: #94a3b8; }
        </style>
    </head>
    <body>

    ${renderPage1 ? `
        <!-- PAGE 1: OVERVIEW & SUPPLY CHAIN TABLES -->
        <div class="page-container">
            <div class="header-banner">
                <table class="header-table">
                    <tr>
                        <td style="width: 60%; vertical-align: middle;">
                            <div class="header-title">گزارش مدیریتی و تراز وزنی وضعیت انبارها و زنجیره تامین</div>
                            <div class="header-subtitle">سامانه یکپارچه مانیتورینگ کارخانجات، واردات و انبارهای سایان ERP</div>
                        </td>
                        <td style="width: 40%; vertical-align: middle;" class="header-meta">
                            <div><strong>📅 تاریخ استعلام:</strong> ${reportDate}</div>
                            <div><strong>📊 دوره مبنا:</strong> ${r1Label} ⬅️ <strong>دوره جاری:</strong> ${r2Label}</div>
                            <div><strong>🏷️ نوع سند:</strong> <span class="badge badge-blue">گزارش جامع تراز و انبارداری (صفحه ۱)</span></div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- KPI Metric Summary -->
            <table class="kpi-grid">
                <tr>
                    <td class="kpi-card" style="width: 25%;">
                        <div class="kpi-title">🧵 نخ‌های تولیدی کارخانه</div>
                        <div class="kpi-value">${fNum(yCurr)} kg</div>
                        <div class="kpi-diff" style="color: ${yDiff >= 0 ? '#15803d' : '#b91c1c'};">
                            ${yDiff >= 0 ? '+' : ''}${fNum(yDiff)} kg (${yPct >= 0 ? '+' : ''}${fNum(yPct, 1)}%)
                        </div>
                    </td>
                    <td class="kpi-card" style="width: 25%;">
                        <div class="kpi-title">📦 مواد اولیه، واردات و گمرک</div>
                        <div class="kpi-value">${fNum(rCurr)} kg</div>
                        <div class="kpi-diff" style="color: ${rDiff >= 0 ? '#15803d' : '#b91c1c'};">
                            ${rDiff >= 0 ? '+' : ''}${fNum(rDiff)} kg (${rPct >= 0 ? '+' : ''}${fNum(rPct, 1)}%)
                        </div>
                    </td>
                    <td class="kpi-card" style="width: 25%; background: ${tDiff >= 0 ? '#f0fdf4' : '#fff1f2'}; border-color: ${tDiff >= 0 ? '#bbf7d0' : '#fecaca'};">
                        <div class="kpi-title">🏢 سرجمع کل موجودی زنجیره</div>
                        <div class="kpi-value" style="color: ${tDiff >= 0 ? '#166534' : '#991b1b'};">${fNum(tCurr)} kg</div>
                        <div class="kpi-diff" style="color: ${tDiff >= 0 ? '#15803d' : '#b91c1c'};">
                            ${tDiff >= 0 ? 'رشد تراز +' : 'کسری تراز '}${fNum(tDiff)} kg (${fTon(tDiff)} تن)
                        </div>
                    </td>
                    <td class="kpi-card" style="width: 25%;">
                        <div class="kpi-title">🚢 کانتینرها و ارزش دلاری</div>
                        <div class="kpi-value" style="color: #0284c7;">${summary.containersTotal || '۱۲'} کانتینر</div>
                        <div class="kpi-diff" style="color: #475569;">${summary.dollarsTotal || '۹۵۰,۰۰۰ $'} ارزش در راه</div>
                    </td>
                </tr>
            </table>

            <!-- Table 1: Factory Yarns -->
            <div class="section-head">۱. جدول نخ‌های تولیدی کارخانه (تولید داخلی)</div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 30px;">#</th>
                        <th style="text-align: right;">نام گروه کالا / شرح تولید</th>
                        <th style="width: 105px;">وزن سال قبل (kg)</th>
                        <th style="width: 105px;">وزن سال جاری (kg)</th>
                        <th style="width: 105px;">اختلاف وزنی (kg)</th>
                        <th style="width: 75px;">درصد تغییر</th>
                    </tr>
                </thead>
                <tbody>
                    ${buildItemRows(yarnItems)}
                    <tr class="cat-row">
                        <td colspan="2" style="text-align: right; padding-right: 8px;">جمع کل نخ‌های تولیدی کارخانه</td>
                        <td style="text-align: center;">${fNum(yLast)}</td>
                        <td style="text-align: center;">${fNum(yCurr)}</td>
                        <td style="text-align: center; color: ${yDiff >= 0 ? '#15803d' : '#b91c1c'};">${yDiff >= 0 ? '+' : ''}${fNum(yDiff)}</td>
                        <td style="text-align: center; color: ${yDiff >= 0 ? '#15803d' : '#b91c1c'};">${yLast ? `${yPct >= 0 ? '+' : ''}${fNum(yPct, 1)}%` : '-'}</td>
                    </tr>
                </tbody>
            </table>

            <!-- Table 2: Raw & Imported Materials -->
            <div class="section-head">۲. جدول مواد اولیه، اقلام وارداتی و انبار سایان</div>
            <table class="data-table">
                <thead>
                    <tr>
                        <th style="width: 30px;">#</th>
                        <th style="text-align: right;">نام گروه کالا / مواد اولیه وارداتی</th>
                        <th style="width: 105px;">وزن سال قبل (kg)</th>
                        <th style="width: 105px;">وزن سال جاری (kg)</th>
                        <th style="width: 105px;">اختلاف وزنی (kg)</th>
                        <th style="width: 75px;">درصد تغییر</th>
                    </tr>
                </thead>
                <tbody>
                    ${buildItemRows(rawItems)}
                    <tr class="cat-row">
                        <td colspan="2" style="text-align: right; padding-right: 8px;">جمع کل مواد اولیه و وارداتی</td>
                        <td style="text-align: center;">${fNum(rLast)}</td>
                        <td style="text-align: center;">${fNum(rCurr)}</td>
                        <td style="text-align: center; color: ${rDiff >= 0 ? '#15803d' : '#b91c1c'};">${rDiff >= 0 ? '+' : ''}${fNum(rDiff)}</td>
                        <td style="text-align: center; color: ${rDiff >= 0 ? '#15803d' : '#b91c1c'};">${rLast ? `${rPct >= 0 ? '+' : ''}${fNum(rPct, 1)}%` : '-'}</td>
                    </tr>
                </tbody>
            </table>

            <!-- Logistics Table if exists -->
            ${logisticsItems.length > 0 ? `
                <div class="section-head">۳. بارهای در راه، گمرک و خریدهای در جریان</div>
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 30px;">#</th>
                            <th style="text-align: right;">شرح محموله / پروفرما</th>
                            <th style="width: 110px;">وضعیت</th>
                            <th style="width: 90px;">تعداد کانتینر</th>
                            <th style="width: 110px;">مقدار / ارزش</th>
                            <th style="width: 75px;">نوع ارز</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${buildLogisticsRows(logisticsItems)}
                    </tbody>
                </table>
            ` : ''}

            <!-- Grand Total Row -->
            <table class="data-table" style="margin-top: 4px;">
                <tbody>
                    <tr class="total-row">
                        <td style="text-align: right; padding-right: 10px; width: 45%;">
                            🏢 سرجمع کل موجودی زنجیره تامین و کارخانجات
                        </td>
                        <td style="text-align: center; width: 18%;">${fNum(tLast)} kg (${fTon(tLast)} تن)</td>
                        <td style="text-align: center; width: 18%;">${fNum(tCurr)} kg (${fTon(tCurr)} تن)</td>
                        <td style="text-align: center; width: 19%;">
                            ${tDiff >= 0 ? '+' : ''}${fNum(tDiff)} kg (${tPct >= 0 ? '+' : ''}${fNum(tPct, 1)}%)
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="doc-footer">
                گزارش رسمی انبارداری و مقایسه زنجیره تامین سایان ERP | تاریخ چاپ و استعلام: ${reportDate} | صفحه ۱ از ${mode === 'both' ? '۲' : '۱'}
            </div>
        </div>
    ` : ''}

    ${renderPage2 ? `
        <!-- PAGE 2: TREND ANALYSIS, DEFICIT & GROWTH MATRIX -->
        <div class="page-container ${renderPage1 ? 'page-break' : ''}">
            <div class="header-banner" style="border-color: #dc2626;">
                <table class="header-table">
                    <tr>
                        <td style="width: 60%; vertical-align: middle;">
                            <div class="header-title" style="color: #991b1b;">تحلیل روند تغییرات وزنی، اقلام منفی و ماتریس کسری‌ها</div>
                            <div class="header-subtitle">پایش تخصصی رشد و افت اقلام نسبت به دوره گذشته جهت تصمیم‌گیری مدیریت</div>
                        </td>
                        <td style="width: 40%; vertical-align: middle;" class="header-meta">
                            <div><strong>📅 تاریخ استعلام:</strong> ${reportDate}</div>
                            <div><strong>⚠️ اقلام دارای کسری:</strong> <span class="badge badge-red">${fNum(negativeItems.length)} قلم کالا</span></div>
                            <div><strong>📈 اقلام دارای رشد:</strong> <span class="badge badge-green">${fNum(growthItems.length)} قلم کالا</span></div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Section: Negative Items Alert -->
            <div class="section-head" style="color: #991b1b; border-color: #dc2626;">
                🚨 ۱. فهرست کالاهای دارای کسری و افت وزنی نسبت به سال قبل (تراز منفی)
            </div>
            <table class="data-table" style="border-color: #fecaca;">
                <thead>
                    <tr style="background-color: #fee2e2;">
                        <th style="width: 30px; background-color: #fee2e2; color: #991b1b; border-color: #fecaca;">#</th>
                        <th style="text-align: right; background-color: #fee2e2; color: #991b1b; border-color: #fecaca;">نام کالا / شرح</th>
                        <th style="width: 85px; background-color: #fee2e2; color: #991b1b; border-color: #fecaca;">دسته</th>
                        <th style="width: 95px; background-color: #fee2e2; color: #991b1b; border-color: #fecaca;">سال قبل</th>
                        <th style="width: 95px; background-color: #fee2e2; color: #991b1b; border-color: #fecaca;">سال جاری</th>
                        <th style="width: 120px; background-color: #fee2e2; color: #991b1b; border-color: #fecaca;">میزان افت وزنی</th>
                        <th style="width: 70px; background-color: #fee2e2; color: #991b1b; border-color: #fecaca;">درصد افت</th>
                    </tr>
                </thead>
                <tbody>
                    ${buildNegativeRows(negativeItems)}
                </tbody>
            </table>

            <!-- Section: Positive Growth Items -->
            <div class="section-head" style="color: #166534; border-color: #16a34a; margin-top: 12px;">
                📈 ۲. فهرست کالاهای دارای بیشترین رشد وزنی و افزایش موجودی (تراز مثبت)
            </div>
            <table class="data-table" style="border-color: #bbf7d0;">
                <thead>
                    <tr style="background-color: #dcfce7;">
                        <th style="width: 30px; background-color: #dcfce7; color: #166534; border-color: #bbf7d0;">#</th>
                        <th style="text-align: right; background-color: #dcfce7; color: #166534; border-color: #bbf7d0;">نام کالا / شرح</th>
                        <th style="width: 85px; background-color: #dcfce7; color: #166534; border-color: #bbf7d0;">دسته</th>
                        <th style="width: 95px; background-color: #dcfce7; color: #166534; border-color: #bbf7d0;">سال قبل</th>
                        <th style="width: 95px; background-color: #dcfce7; color: #166534; border-color: #bbf7d0;">سال جاری</th>
                        <th style="width: 120px; background-color: #dcfce7; color: #166534; border-color: #bbf7d0;">میزان رشد وزنی</th>
                        <th style="width: 70px; background-color: #dcfce7; color: #166534; border-color: #bbf7d0;">درصد رشد</th>
                    </tr>
                </thead>
                <tbody>
                    ${buildGrowthRows(growthItems)}
                </tbody>
            </table>

            <!-- Signatures Section -->
            <table class="sig-table">
                <tr>
                    <td class="sig-box">
                        <div class="sig-title">تنظیم و استعلام گزارش انبار</div>
                        <div class="sig-name">${signature}</div>
                    </td>
                    <td class="sig-box">
                        <div class="sig-title">مدیریت بازرگانی و تامین خارجی</div>
                        <div class="sig-name">سرپرستی تامین و زنجیره کالا</div>
                    </td>
                    <td class="sig-box">
                        <div class="sig-title">رویت و تاییدیه مدیریت عامل</div>
                        <div class="sig-name">جناب آقای مهندس سلیمی</div>
                    </td>
                </tr>
            </table>

            <div class="doc-footer">
                گزارش تحلیلی روند رشد و کسری انبار | تاریخ استعلام: ${reportDate} | صفحه ${mode === 'both' ? '۲ از ۲' : '۱ از ۱'}
            </div>
        </div>
    ` : ''}

    </body>
    </html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      portrait: true,
      printBackground: true,
      margin: { top: '8mm', right: '8mm', bottom: '8mm', left: '8mm' }
    });
    await page.close();
    return pdf;
  } catch (e) {
    console.error("Generate Warehouse Overview Report PDF Error:", e);
    throw e;
  }
};


