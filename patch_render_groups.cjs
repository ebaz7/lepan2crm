const fs = require('fs');
let code = fs.readFileSync('components/sales/SayanSalesDashboard.tsx', 'utf8');

const oldText = "۱. خلاصه گروه‌های کالا (۱۵ گروه اصلی)";
code = code.replace(oldText, "۱. خلاصه گروه‌های اصلی کالا");

const oldCode = `                      <tbody className="divide-y divide-slate-100">
                        {comparisonMetrics?.compareGroupRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-900">{row.catName}</td>
                            <td className="p-3 text-left font-mono font-bold text-blue-900 bg-blue-50/20">{formatMoney(row.netAmtA)}</td>
                            <td className="p-3 text-left font-mono font-bold text-indigo-900 bg-indigo-50/20">{formatMoney(row.netAmtB)}</td>
                            <td className="p-3 text-center font-mono text-blue-900 bg-blue-50/20">{formatWeight(row.netWgtA)}</td>
                            <td className="p-3 text-center font-mono text-indigo-900 bg-indigo-50/20">{formatWeight(row.netWgtB)}</td>
                            <td className="p-3 text-left font-mono text-blue-900 bg-blue-50/20">{formatMoney(row.netFeeA)}</td>
                            <td className="p-3 text-left font-mono text-indigo-900 bg-indigo-50/20">{formatMoney(row.netFeeB)}</td>
                            <td className={\`p-3 text-left font-mono font-black \${row.diffAmt >= 0 ? 'text-emerald-700' : 'text-rose-700'}\`}>
                              {row.diffAmt >= 0 ? '+' : ''}{formatMoney(row.diffAmt)}
                            </td>
                            <td className="p-3 text-center font-mono font-black">
                              <span className={\`px-2 py-0.5 rounded-full text-[10px] \${
                                row.growthPct > 0 ? 'bg-emerald-100 text-emerald-800' : row.growthPct < 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                              }\`}>
                                {row.growthPct > 0 ? '+' : ''}{row.growthPct.toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono text-slate-600">{row.sharePctA.toFixed(1)}%</td>
                            <td className="p-3 text-center">
                              <span className={\`px-2 py-0.5 rounded-full text-[10px] font-bold border \${row.variance.color}\`}>
                                {row.variance.label}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>`;

const newCode = `                      <tbody className="divide-y divide-slate-100">
                        {comparisonMetrics?.compareGroupRows.map((row, idx) => {
                          const isExpanded = !!expandedCategories[row.catName];
                          return (
                          <React.Fragment key={idx}>
                            <tr 
                              onClick={() => toggleCategory(row.catName)}
                              className={\`hover:bg-blue-50/40 transition-colors cursor-pointer \${isExpanded ? 'bg-blue-50/60' : ''}\`}
                            >
                              <td className="p-3 text-center text-slate-400 font-mono">
                                {row.items && row.items.length > 0 ? (
                                  isExpanded ? <ChevronDown className="w-4 h-4 text-blue-600 inline-block" /> : <ChevronRight className="w-4 h-4 text-slate-400 inline-block" />
                                ) : (idx + 1)}
                              </td>
                              <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                                <span>{row.catName}</span>
                                {row.items && row.items.length > 0 && (
                                  <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-md font-mono">
                                    {row.items.length} کالا
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-left font-mono font-bold text-blue-900 bg-blue-50/20">{formatMoney(row.netAmtA)}</td>
                              <td className="p-3 text-left font-mono font-bold text-indigo-900 bg-indigo-50/20">{formatMoney(row.netAmtB)}</td>
                              <td className="p-3 text-center font-mono text-blue-900 bg-blue-50/20">{formatWeight(row.netWgtA)}</td>
                              <td className="p-3 text-center font-mono text-indigo-900 bg-indigo-50/20">{formatWeight(row.netWgtB)}</td>
                              <td className="p-3 text-left font-mono text-blue-900 bg-blue-50/20">{formatMoney(row.netFeeA)}</td>
                              <td className="p-3 text-left font-mono text-indigo-900 bg-indigo-50/20">{formatMoney(row.netFeeB)}</td>
                              <td className={\`p-3 text-left font-mono font-black \${row.diffAmt >= 0 ? 'text-emerald-700' : 'text-rose-700'}\`}>
                                {row.diffAmt >= 0 ? '+' : ''}{formatMoney(row.diffAmt)}
                              </td>
                              <td className="p-3 text-center font-mono font-black">
                                <span className={\`px-2 py-0.5 rounded-full text-[10px] \${
                                  row.growthPct > 0 ? 'bg-emerald-100 text-emerald-800' : row.growthPct < 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                                }\`}>
                                  {row.growthPct > 0 ? '+' : ''}{row.growthPct.toFixed(1)}%
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono text-slate-600">{row.sharePctA.toFixed(1)}%</td>
                              <td className="p-3 text-center">
                                <span className={\`px-2 py-0.5 rounded-full text-[10px] font-bold border \${row.variance.color}\`}>
                                  {row.variance.label}
                                </span>
                              </td>
                            </tr>
                            {isExpanded && row.items && row.items.map((sub: any, sIdx: number) => (
                              <tr key={\`\${idx}_sub_\${sIdx}\`} className="bg-slate-50/80 text-[11px] hover:bg-slate-100/80 transition-colors border-l-4 border-l-blue-500">
                                <td className="p-2.5 text-center text-slate-300 font-mono"></td>
                                <td className="p-2.5 pr-8 text-slate-700 font-medium flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                  <span>{sub.itemName}</span>
                                </td>
                                <td className="p-2.5 text-left font-mono font-bold text-blue-800 bg-blue-50/10">{formatMoney(sub.netAmtA)}</td>
                                <td className="p-2.5 text-left font-mono font-bold text-indigo-800 bg-indigo-50/10">{formatMoney(sub.netAmtB)}</td>
                                <td className="p-2.5 text-center font-mono text-blue-800 bg-blue-50/10">{formatWeight(sub.netWgtA)}</td>
                                <td className="p-2.5 text-center font-mono text-indigo-800 bg-indigo-50/10">{formatWeight(sub.netWgtB)}</td>
                                <td className="p-2.5 text-left font-mono text-blue-800 bg-blue-50/10">{formatMoney(sub.netFeeA)}</td>
                                <td className="p-2.5 text-left font-mono text-indigo-800 bg-indigo-50/10">{formatMoney(sub.netFeeB)}</td>
                                <td className={\`p-2.5 text-left font-mono font-black \${sub.diffAmt >= 0 ? 'text-emerald-700' : 'text-rose-700'}\`}>
                                  {sub.diffAmt >= 0 ? '+' : ''}{formatMoney(sub.diffAmt)}
                                </td>
                                <td className="p-2.5 text-center font-mono font-black">
                                  <span className={\`px-2 py-0.5 rounded-full text-[10px] \${
                                    sub.growthPct > 0 ? 'bg-emerald-100 text-emerald-800' : sub.growthPct < 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'
                                  }\`}>
                                    {sub.growthPct > 0 ? '+' : ''}{sub.growthPct.toFixed(1)}%
                                  </span>
                                </td>
                                <td className="p-2.5 text-center font-mono text-slate-500">{sub.sharePctA.toFixed(1)}%</td>
                                <td className="p-2.5 text-center">
                                  <span className={\`px-2 py-0.5 rounded-full text-[10px] font-bold border \${sub.variance.color}\`}>
                                    {sub.variance.label}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                          );
                        })}
                      </tbody>`;

code = code.replace(oldCode, newCode);
fs.writeFileSync('components/sales/SayanSalesDashboard.tsx', code);
