const fs = require('fs');
let code = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

const targetDesktop = `                                                salesData.slice(0, 500).map((row, idx) => {
                                                    const netW = parseNetWeight(row);
                                                    const grossW = parseGrossWeight(row);
                                                    const fee = parseFee(row, netW);
                                                    return (
                                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">`;

const replaceDesktop = `                                                salesData.slice(0, 500).map((row, idx) => {
                                                    const netW = parseNetWeight(row);
                                                    const grossW = parseGrossWeight(row);
                                                    const fee = parseFee(row, netW);
                                                    const isRet = row.OpCode === '13';
                                                    return (
                                                        <tr key={idx} className={\`hover:bg-slate-50/50 transition-colors \${isRet ? 'bg-rose-50' : ''}\`}>`;

const targetMobile = `                                            salesData.slice(0, 500).map((row, idx) => {
                                                const netW = parseNetWeight(row);
                                                const grossW = parseGrossWeight(row);
                                                const fee = parseFee(row, netW);
                                                return (
                                                    <div key={idx} className="p-4 space-y-2 text-xs">`;

const replaceMobile = `                                            salesData.slice(0, 500).map((row, idx) => {
                                                const netW = parseNetWeight(row);
                                                const grossW = parseGrossWeight(row);
                                                const fee = parseFee(row, netW);
                                                const isRet = row.OpCode === '13';
                                                return (
                                                    <div key={idx} className={\`p-4 space-y-2 text-xs \${isRet ? 'bg-rose-50' : ''}\`}>`;

code = code.replace(targetDesktop, replaceDesktop).replace(targetMobile, replaceMobile);

// Also we need to label the return rows
const targetDesktopName = `                                                                {row.ItemName || 'کالای فروخته شده'}
                                                                {row.ItemNotes && <span className="block text-[10px] text-slate-400 font-normal">{row.ItemNotes}</span>}`;

const replaceDesktopName = `                                                                {isRet ? <span className="bg-rose-100 text-rose-700 px-1 py-0.5 rounded text-[9px] ml-1">مرجوعی</span> : null}
                                                                {row.ItemName || 'کالای فروخته شده'}
                                                                {row.ItemNotes && <span className="block text-[10px] text-slate-400 font-normal">{row.ItemNotes}</span>}`;

const targetMobileName = `                                                            {row.ItemName || 'کالای فروخته شده'}
                                                            {row.ItemNotes && <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{row.ItemNotes}</span>}`;

const replaceMobileName = `                                                            {isRet ? <span className="bg-rose-100 text-rose-700 px-1 py-0.5 rounded text-[9px] ml-1">مرجوعی</span> : null}
                                                            {row.ItemName || 'کالای فروخته شده'}
                                                            {row.ItemNotes && <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{row.ItemNotes}</span>}`;

code = code.replace(targetDesktopName, replaceDesktopName).replace(targetMobileName, replaceMobileName);

fs.writeFileSync('components/AccountingReports.tsx', code);
console.log('patched lists');
