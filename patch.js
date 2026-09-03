const fs = require('fs');
let code = fs.readFileSync('components/TradeModule.tsx', 'utf8');
code = code.replace(/\{\/\* MINI COST SUMMARY BOX \(Left aligned\) \*\/\}[\s\S]*?\}\)\(\)\}/, `{/* MINI COST PER KG BOX (Left aligned) */}
                        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-xl text-right shrink-0">
                            <span className="text-[9px] font-bold text-rose-600 dark:text-rose-400 block mb-0.5 leading-none">قیمت تمام‌شده (هر کیلو)</span>
                            <span className="font-mono font-black text-rose-700 dark:text-rose-300 text-sm leading-none">{formatCurrency(calculateRecordCostPerKg(selectedRecord))} <span className="text-[10px] font-normal">ریال</span></span>
                        </div>`);
fs.writeFileSync('components/TradeModule.tsx', code);
