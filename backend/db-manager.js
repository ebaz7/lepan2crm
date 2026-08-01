
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', 'database.json');

let MEMORY_DB_CACHE = null;
let saveTimeout = null;
let isSaving = false;

export const getDb = () => {
    if (MEMORY_DB_CACHE) return MEMORY_DB_CACHE;
    try {
        const defaultDb = { 
            settings: {
                sayanApiUrl: "",
                sayanApiKey: ""
            }, 
            users: [
                { id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin', roles: ['admin'], canManageTrade: true }
            ],
            orders: [], 
            exitPermits: [], 
            warehouseItems: [], 
            warehouseTransactions: [], 
            tradeRecords: [], 
            chequeReceipts: [],
            securityLogs: [], 
            personnelDelays: [], 
            securityIncidents: [],
            messages: [], 
            groups: [], 
            tasks: [],
            subscriptions: [],
            botSubscribers: [],
            customerBalances: [],
            customerChatCodes: [],
            fiscalYears: {},
            sequences: {},
            notes: []
        };

        if (fs.existsSync(DB_FILE)) {
            const fileContent = fs.readFileSync(DB_FILE, 'utf8');
            if (fileContent.trim()) {
                const data = JSON.parse(fileContent);
                MEMORY_DB_CACHE = { ...defaultDb, ...data };
                
                // Populate default Sayan credentials if missing
                if (!MEMORY_DB_CACHE.settings) MEMORY_DB_CACHE.settings = {};
                if (!MEMORY_DB_CACHE.settings.sayanApiUrl) {
                    MEMORY_DB_CACHE.settings.sayanApiUrl = "";
                }
                if (!MEMORY_DB_CACHE.settings.sayanApiKey) {
                    MEMORY_DB_CACHE.settings.sayanApiKey = "";
                }

                // Ensure companies and fiscalYears exist in settings
                if (!Array.isArray(MEMORY_DB_CACHE.settings.companies)) {
                    MEMORY_DB_CACHE.settings.companies = [];
                }
                if (!Array.isArray(MEMORY_DB_CACHE.settings.companyNames)) {
                    MEMORY_DB_CACHE.settings.companyNames = [];
                }

                // Populate companyMap from settings.companies, settings.companyNames, and fiscalYears
                const companyMap = new Map();

                // 1. From settings.companies
                (MEMORY_DB_CACHE.settings.companies || []).forEach((c, idx) => {
                    const cName = typeof c === 'string' ? c.trim() : (c && c.name ? c.name.trim() : '');
                    if (cName) {
                        companyMap.set(cName, {
                            id: (typeof c === 'object' && c.id) ? c.id : ('comp_' + idx + '_' + Date.now()),
                            name: cName,
                            showInWarehouse: (typeof c === 'object' && c.showInWarehouse !== undefined) ? c.showInWarehouse : true,
                            banks: (typeof c === 'object' && Array.isArray(c.banks)) ? c.banks : [],
                            logo: (typeof c === 'object' && c.logo) || "",
                            registrationNumber: (typeof c === 'object' && c.registrationNumber) || "",
                            nationalId: (typeof c === 'object' && c.nationalId) || "",
                            address: (typeof c === 'object' && c.address) || "",
                            phone: (typeof c === 'object' && c.phone) || "",
                            fax: (typeof c === 'object' && c.fax) || "",
                            postalCode: (typeof c === 'object' && c.postalCode) || "",
                            economicCode: (typeof c === 'object' && c.economicCode) || "",
                            letterhead: (typeof c === 'object' && c.letterhead) || ""
                        });
                    }
                });

                // 2. From settings.companyNames if companyMap doesn't have it
                (MEMORY_DB_CACHE.settings.companyNames || []).forEach((n, idx) => {
                    const name = typeof n === 'string' ? n.trim() : '';
                    if (name && !companyMap.has(name)) {
                        companyMap.set(name, {
                            id: 'comp_name_' + idx + '_' + Date.now(),
                            name,
                            showInWarehouse: true,
                            banks: []
                        });
                    }
                });

                // 3. From fiscalYears sequences if any
                if (Array.isArray(MEMORY_DB_CACHE.settings.fiscalYears)) {
                    MEMORY_DB_CACHE.settings.fiscalYears.forEach(fy => {
                        if (fy && fy.companySequences) {
                            Object.keys(fy.companySequences).forEach((k, idx) => {
                                const name = k ? k.trim() : '';
                                if (name && !companyMap.has(name)) {
                                    companyMap.set(name, {
                                        id: 'comp_fy_' + idx + '_' + Date.now(),
                                        name,
                                        showInWarehouse: true,
                                        banks: []
                                    });
                                }
                            });
                        }
                    });
                }

                let allCompanies = Array.from(companyMap.values());
                allCompanies = allCompanies.filter(c => 
                    c.name !== 'شرکت اصلی' || 
                    c.logo || 
                    c.registrationNumber || 
                    c.nationalId || 
                    c.address || 
                    c.economicCode || 
                    (c.banks && c.banks.length > 0)
                );

                MEMORY_DB_CACHE.settings.companies = allCompanies;
                MEMORY_DB_CACHE.settings.companyNames = allCompanies.map(c => c.name);

                // Scan and extract all bank names & bank account details across database collections
                if (!Array.isArray(MEMORY_DB_CACHE.settings.operatingBankNames)) {
                    MEMORY_DB_CACHE.settings.operatingBankNames = [];
                }
                if (!Array.isArray(MEMORY_DB_CACHE.settings.bankNames)) {
                    MEMORY_DB_CACHE.settings.bankNames = [];
                }

                const extractedBanks = new Set();
                (MEMORY_DB_CACHE.settings.operatingBankNames || []).forEach(b => { if (b && typeof b === 'string' && b.trim()) extractedBanks.add(b.trim()); });
                (MEMORY_DB_CACHE.settings.bankNames || []).forEach(b => { if (b && typeof b === 'string' && b.trim()) extractedBanks.add(b.trim()); });
                if (MEMORY_DB_CACHE.settings.companyBank && typeof MEMORY_DB_CACHE.settings.companyBank === 'string' && MEMORY_DB_CACHE.settings.companyBank.trim()) {
                    extractedBanks.add(MEMORY_DB_CACHE.settings.companyBank.trim());
                }

                (MEMORY_DB_CACHE.settings.companies || []).forEach(c => {
                    if (c && Array.isArray(c.banks)) {
                        c.banks.forEach(b => {
                            if (b) {
                                const bName = typeof b === 'string' ? b : (b.bankName || '');
                                if (bName && bName.trim()) extractedBanks.add(bName.trim());
                            }
                        });
                    }
                });

                (MEMORY_DB_CACHE.orders || []).forEach(o => {
                    if (Array.isArray(o.paymentDetails)) {
                        o.paymentDetails.forEach(p => {
                            if (p && p.bankName && p.bankName.trim()) extractedBanks.add(p.bankName.trim());
                            if (p && p.recipientBank && p.recipientBank.trim()) extractedBanks.add(p.recipientBank.trim());
                        });
                    }
                });

                (MEMORY_DB_CACHE.chequeReceipts || []).forEach(c => {
                    if (c && c.bankName && c.bankName.trim()) extractedBanks.add(c.bankName.trim());
                });

                (MEMORY_DB_CACHE.tradeRecords || []).forEach(t => {
                    ['inspectionPayments', 'clearancePayments', 'shippingPayments', 'agentPayments', 'guarantees'].forEach(key => {
                        if (Array.isArray(t[key])) {
                            t[key].forEach(p => {
                                if (p && p.bank && p.bank.trim()) extractedBanks.add(p.bank.trim());
                            });
                        }
                    });
                });

                const allExtractedBankList = Array.from(extractedBanks);
                if (allExtractedBankList.length > 0) {
                    MEMORY_DB_CACHE.settings.operatingBankNames = Array.from(new Set([
                        ...MEMORY_DB_CACHE.settings.operatingBankNames,
                        ...allExtractedBankList
                    ]));
                    MEMORY_DB_CACHE.settings.bankNames = Array.from(new Set([
                        ...MEMORY_DB_CACHE.settings.bankNames,
                        ...allExtractedBankList
                    ]));
                }

                // Migrate fiscal years if they are stored at the root or as an object
                if (MEMORY_DB_CACHE.fiscalYears && Array.isArray(MEMORY_DB_CACHE.fiscalYears) && MEMORY_DB_CACHE.fiscalYears.length > 0) {
                    if (!MEMORY_DB_CACHE.settings.fiscalYears || (Array.isArray(MEMORY_DB_CACHE.settings.fiscalYears) && MEMORY_DB_CACHE.settings.fiscalYears.length === 0)) {
                        MEMORY_DB_CACHE.settings.fiscalYears = MEMORY_DB_CACHE.fiscalYears;
                    }
                } else if (MEMORY_DB_CACHE.settings.fiscalYears && !Array.isArray(MEMORY_DB_CACHE.settings.fiscalYears) && typeof MEMORY_DB_CACHE.settings.fiscalYears === 'object') {
                    // Convert object to array
                    MEMORY_DB_CACHE.settings.fiscalYears = Object.values(MEMORY_DB_CACHE.settings.fiscalYears);
                }

                if (!Array.isArray(MEMORY_DB_CACHE.settings.fiscalYears) || MEMORY_DB_CACHE.settings.fiscalYears.length === 0) {
                    MEMORY_DB_CACHE.settings.fiscalYears = [
                        { id: 'fy_1402', label: '1402', isClosed: false, companySequences: {}, createdAt: Date.now() },
                        { id: 'fy_1403', label: '1403', isClosed: false, companySequences: {}, createdAt: Date.now() },
                        { id: 'fy_1404', label: '1404', isClosed: false, companySequences: {}, createdAt: Date.now() },
                        { id: 'fy_1405', label: '1405', isClosed: false, companySequences: {}, createdAt: Date.now() }
                    ];
                }
                let activeFound = MEMORY_DB_CACHE.settings.activeFiscalYearId && MEMORY_DB_CACHE.settings.fiscalYears.some(fy => fy.id === MEMORY_DB_CACHE.settings.activeFiscalYearId);
                if (!activeFound && MEMORY_DB_CACHE.settings.fiscalYears.length > 0) {
                    MEMORY_DB_CACHE.settings.activeFiscalYearId = MEMORY_DB_CACHE.settings.fiscalYears[0].id;
                } else if (!MEMORY_DB_CACHE.settings.activeFiscalYearId) {
                    MEMORY_DB_CACHE.settings.activeFiscalYearId = 'fy_1404';
                }

                // Ensure arrays exist
                const arrays = ['users', 'botSubscribers', 'orders', 'exitPermits', 'warehouseTransactions', 'subscriptions', 'messages', 'groups', 'tasks', 'tradeRecords', 'notes', 'customerBalances', 'customerChatCodes', 'chequeReceipts'];
                arrays.forEach(arr => {
                    if (!Array.isArray(MEMORY_DB_CACHE[arr])) MEMORY_DB_CACHE[arr] = [];
                });
                
                // Ensure at least one admin user exists to prevent lockout
                if (MEMORY_DB_CACHE.users.length === 0) {
                    MEMORY_DB_CACHE.users.push({ id: '1', username: 'admin', password: '123', fullName: 'مدیر سیستم', role: 'admin', roles: ['admin'], canManageTrade: true });
                }
                
                return MEMORY_DB_CACHE;
            }
        }
        MEMORY_DB_CACHE = defaultDb;
        return defaultDb;
    } catch (e) {
        console.error("DB Read Error:", e);
        return {};
    }
};

export const saveDb = (data) => {
    MEMORY_DB_CACHE = data;
    
    // Throttle disk writes to every 3 seconds to avoid event loop blockage
    if (saveTimeout) return true;
    
    saveTimeout = setTimeout(() => {
        try {
            if (isSaving) return;
            isSaving = true;
            fs.writeFileSync(DB_FILE, JSON.stringify(MEMORY_DB_CACHE, null, 2));
            saveTimeout = null;
            isSaving = false;
        } catch (e) {
            console.error("DB Save Error:", e);
            saveTimeout = null;
            isSaving = false;
        }
    }, 3000);
    
    return true;
};

// Immediate save for critical operations (e.g. backup, restore)
export const saveDbImmediate = (data) => {
    try {
        MEMORY_DB_CACHE = data;
        if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (e) {
        console.error("Immediate DB Save Error:", e);
        return false;
    }
};

export const refreshCache = () => {
    MEMORY_DB_CACHE = null;
    return getDb();
};
