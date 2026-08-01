const fs = require('fs');

let content = fs.readFileSync('components/SayanReports.tsx', 'utf8');

// I injected visualizer inside `sqlQuery` ifs or vice versa
// Let's remove the visualizer block from line 143-147 and restore `} else if (activeTable === 'REPORT_INVENTORY') {`
// Wait, no. I'll just write a script that completely rebuilds `ReportVisualizer` and the `sqlQuery` if-blocks to be pristine.
// Or I can just fetch from git.
