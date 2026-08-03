import { generateReportPDF } from './backend/renderer.js';
(async () => {
    try {
        const res = await generateReportPDF('Test Title', ['Col 1'], [['Row 1']], false);
        console.log("PDF length:", res ? res.length : 'NULL');
    } catch(e) {
        console.error("Test error:", e);
    }
    process.exit(0);
})();
