const fs = require('fs');
let code = fs.readFileSync('components/AccountingReports.tsx', 'utf8');

const target = `                                                    ارسال دستی به ربات
                                                </button>
                                            </div>
                                            {chartData.map((row, idx) => {`;

const repl = `                                                    ارسال دستی به ربات
                                                </button>
                                                </div>
                                            </div>
                                            {chartData.map((row, idx) => {`;

code = code.replace(target, repl);
fs.writeFileSync('components/AccountingReports.tsx', code);
console.log('Fixed div closure');
