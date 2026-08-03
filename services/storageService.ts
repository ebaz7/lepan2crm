
import { MeetingMinutes, PaymentOrder, User, OrderStatus, SystemSettings, ChatMessage, ChatGroup, GroupTask, TradeRecord, ExitPermit, ExitPermitStatus, WarehouseItem, WarehouseTransaction, SecurityLog, PersonnelDelay, SecurityIncident, TaskGroup, SystemAnnouncement, ChequeReceipt, ChequeItem } from '../types';
import { apiCall } from './apiService';

// Safely return array
const safeArray = <T>(data: any): T[] => {
    return Array.isArray(data) ? data : [];
};

export const getOrders = async (): Promise<PaymentOrder[]> => { 
    const res = await apiCall<PaymentOrder[]>('/orders'); 
    return safeArray(res);
};
export const saveOrder = async (order: PaymentOrder): Promise<PaymentOrder[]> => { return await apiCall<PaymentOrder[]>('/orders', 'POST', order); };
export const editOrder = async (updatedOrder: PaymentOrder): Promise<PaymentOrder[]> => { return await apiCall<PaymentOrder[]>(`/orders/${updatedOrder.id}`, 'PUT', updatedOrder); };
export const updateOrderStatus = async (id: string, status: OrderStatus, approverUser: User, rejectionReason?: string): Promise<PaymentOrder[]> => {
  const updates: any = { status };
  if (status === OrderStatus.APPROVED_FINANCE) updates.approverFinancial = approverUser.fullName;
  else if (status === OrderStatus.APPROVED_MANAGER) updates.approverManager = approverUser.fullName;
  else if (status === OrderStatus.APPROVED_CEO) updates.approverCeo = approverUser.fullName;
  if (status === OrderStatus.REJECTED) { if (rejectionReason) updates.rejectionReason = rejectionReason; updates.rejectedBy = approverUser.fullName; }
  
  return await apiCall<PaymentOrder[]>(`/orders/${id}`, 'PUT', updates);
};
export const deleteOrder = async (id: string): Promise<PaymentOrder[]> => { return await apiCall<PaymentOrder[]>(`/orders/${id}`, 'DELETE'); };

export const getExitPermits = async (): Promise<ExitPermit[]> => { 
    const res = await apiCall<ExitPermit[]>('/exit-permits');
    return safeArray(res);
};
export const saveExitPermit = async (permit: ExitPermit): Promise<ExitPermit[]> => { return await apiCall<ExitPermit[]>('/exit-permits', 'POST', permit); };
export const editExitPermit = async (updatedPermit: ExitPermit): Promise<ExitPermit[]> => { return await apiCall<ExitPermit[]>(`/exit-permits/${updatedPermit.id}`, 'PUT', updatedPermit); };

export const updateExitPermitStatus = async (id: string, status: ExitPermitStatus, approverUser: User, extra?: { rejectionReason?: string, exitTime?: string }): Promise<ExitPermit[]> => {
    const permits = await getExitPermits();
    const permit = permits.find(p => p.id === id);
    if(permit) {
        const updates: any = { status, updatedAt: Date.now() };
        
        if (status === ExitPermitStatus.PENDING_FACTORY) updates.approverCeo = approverUser.fullName;
        else if (status === ExitPermitStatus.PENDING_WAREHOUSE) updates.approverFactory = approverUser.fullName;
        else if (status === ExitPermitStatus.PENDING_SECURITY) updates.approverWarehouse = approverUser.fullName;
        else if (status === ExitPermitStatus.PENDING_FACTORY_FINAL) updates.approverSecurity = approverUser.fullName;
        else if (status === ExitPermitStatus.EXITED) {
            updates.approverFactoryFinal = approverUser.fullName;
            if (extra?.exitTime) updates.exitTime = extra.exitTime;
        }

        if (status === ExitPermitStatus.REJECTED) {
            updates.rejectionReason = extra?.rejectionReason || 'توسط کاربر رد شد';
            updates.rejectedBy = approverUser.fullName;
        }

        if (status === ExitPermitStatus.CANCELED) {
            updates.rejectionReason = extra?.rejectionReason || 'کنسل شده';
            updates.rejectedBy = approverUser.fullName;
        }

        const updatedPermit = { ...permit, ...updates };
        return await apiCall<ExitPermit[]>(`/exit-permits/${id}`, 'PUT', updatedPermit);
    }
    return permits;
};

export const deleteExitPermit = async (id: string): Promise<ExitPermit[]> => { return await apiCall<ExitPermit[]>(`/exit-permits/${id}`, 'DELETE'); };
export const getNextExitPermitNumber = async (): Promise<number> => { try { const response = await apiCall<{ nextNumber: number }>(`/next-exit-permit-number?t=${Date.now()}`); return response.nextNumber; } catch(e) { return 1001; } };

export const getSecurityLogs = async (): Promise<SecurityLog[]> => { const res = await apiCall<SecurityLog[]>('/security/logs'); return safeArray(res); };
export const saveSecurityLog = async (log: SecurityLog): Promise<SecurityLog[]> => { return await apiCall<SecurityLog[]>('/security/logs', 'POST', log); };
export const updateSecurityLog = async (log: SecurityLog): Promise<SecurityLog[]> => { return await apiCall<SecurityLog[]>(`/security/logs/${log.id}`, 'PUT', log); };
export const deleteSecurityLog = async (id: string): Promise<SecurityLog[]> => { return await apiCall<SecurityLog[]>(`/security/logs/${id}`, 'DELETE'); };
export const getPersonnelDelays = async (): Promise<PersonnelDelay[]> => { const res = await apiCall<PersonnelDelay[]>('/security/delays'); return safeArray(res); };
export const savePersonnelDelay = async (delay: PersonnelDelay): Promise<PersonnelDelay[]> => { return await apiCall<PersonnelDelay[]>('/security/delays', 'POST', delay); };
export const updatePersonnelDelay = async (delay: PersonnelDelay): Promise<PersonnelDelay[]> => { return await apiCall<PersonnelDelay[]>(`/security/delays/${delay.id}`, 'PUT', delay); };
export const deletePersonnelDelay = async (id: string): Promise<PersonnelDelay[]> => { return await apiCall<PersonnelDelay[]>(`/security/delays/${id}`, 'DELETE'); };
export const getSecurityIncidents = async (): Promise<SecurityIncident[]> => { const res = await apiCall<SecurityIncident[]>('/security/incidents'); return safeArray(res); };
export const saveSecurityIncident = async (incident: SecurityIncident): Promise<SecurityIncident[]> => { return await apiCall<SecurityIncident[]>('/security/incidents', 'POST', incident); };
export const updateSecurityIncident = async (incident: SecurityIncident): Promise<SecurityIncident[]> => { return await apiCall<SecurityIncident[]>(`/security/incidents/${incident.id}`, 'PUT', incident); };
export const deleteSecurityIncident = async (id: string): Promise<SecurityIncident[]> => { return await apiCall<SecurityIncident[]>(`/security/incidents/${id}`, 'DELETE'); };
// Settings Cache with LocalStorage
const SETTINGS_CACHE_KEY = 'app_settings_cache';
const SETTINGS_CACHE_TTL = 300000; // 5 minutes (increased for better performance)

export const getSettings = async (): Promise<SystemSettings> => { 
    return await apiCall<SystemSettings>('/settings'); 
};
export const saveSettings = async (settings: SystemSettings): Promise<SystemSettings> => { 
    return await apiCall<SystemSettings>('/settings', 'POST', settings); 
};

// Updated: Accepts optional company parameter
export const getNextTrackingNumber = async (company?: string): Promise<number> => { 
    try { 
        const url = company 
            ? `/next-tracking-number?company=${encodeURIComponent(company)}&t=${Date.now()}` 
            : `/next-tracking-number?t=${Date.now()}`;
        const response = await apiCall<{ nextTrackingNumber: number }>(url); 
        return response.nextTrackingNumber; 
    } catch (e) { 
        return 1001; 
    } 
};

// Chat Exports
export const getMessages = async (): Promise<ChatMessage[]> => { const res = await apiCall<ChatMessage[]>('/chat'); return safeArray(res); };
export const sendMessage = async (message: ChatMessage): Promise<ChatMessage[]> => { return await apiCall<ChatMessage[]>('/chat', 'POST', message); };
export const updateMessage = async (message: ChatMessage): Promise<ChatMessage[]> => { return await apiCall<ChatMessage[]>(`/chat/${message.id}`, 'PUT', message); };
export const deleteMessage = async (id: string, forEveryone: boolean = false): Promise<ChatMessage[]> => { return await apiCall<ChatMessage[]>(`/chat/${id}?forEveryone=${forEveryone}`, 'DELETE'); };

export const getGroups = async (): Promise<ChatGroup[]> => { const res = await apiCall<ChatGroup[]>('/groups'); return safeArray(res); };
export const createGroup = async (group: ChatGroup): Promise<ChatGroup[]> => { return await apiCall<ChatGroup[]>('/groups', 'POST', group); };
export const updateGroup = async (group: ChatGroup): Promise<ChatGroup[]> => { return await apiCall<ChatGroup[]>(`/groups/${group.id}`, 'PUT', group); };
export const deleteGroup = async (id: string): Promise<ChatGroup[]> => { return await apiCall<ChatGroup[]>(`/groups/${id}`, 'DELETE'); };

export const getTaskGroups = async (): Promise<TaskGroup[]> => { const res = await apiCall<TaskGroup[]>('/task-groups'); return safeArray(res); };
export const createTaskGroup = async (group: TaskGroup): Promise<TaskGroup[]> => { return await apiCall<TaskGroup[]>('/task-groups', 'POST', group); };
export const updateTaskGroup = async (group: TaskGroup): Promise<TaskGroup[]> => { return await apiCall<TaskGroup[]>(`/task-groups/${group.id}`, 'PUT', group); };
export const deleteTaskGroup = async (id: string): Promise<TaskGroup[]> => { return await apiCall<TaskGroup[]>(`/task-groups/${id}`, 'DELETE'); };

export const getTasks = async (): Promise<GroupTask[]> => { const res = await apiCall<GroupTask[]>('/tasks'); return safeArray(res); };
export const createTask = async (task: GroupTask): Promise<GroupTask[]> => { return await apiCall<GroupTask[]>('/tasks', 'POST', task); };
export const updateTask = async (task: GroupTask): Promise<GroupTask[]> => { return await apiCall<GroupTask[]>(`/tasks/${task.id}`, 'PUT', task); };
export const deleteTask = async (id: string): Promise<GroupTask[]> => { return await apiCall<GroupTask[]>(`/tasks/${id}`, 'DELETE'); };

export const getSystemAnnouncements = async (): Promise<SystemAnnouncement[]> => { const res = await apiCall<SystemAnnouncement[]>('/announcements'); return safeArray(res); };
export const createSystemAnnouncement = async (announcement: SystemAnnouncement): Promise<SystemAnnouncement[]> => { return await apiCall<SystemAnnouncement[]>('/announcements', 'POST', announcement); };
export const deleteSystemAnnouncement = async (id: string): Promise<SystemAnnouncement[]> => { return await apiCall<SystemAnnouncement[]>(`/announcements/${id}`, 'DELETE'); };
export const updateSystemAnnouncement = async (announcement: SystemAnnouncement): Promise<SystemAnnouncement[]> => { return await apiCall<SystemAnnouncement[]>(`/announcements/${announcement.id}`, 'PUT', announcement); };

export const getTradeRecords = async (): Promise<TradeRecord[]> => { const res = await apiCall<TradeRecord[]>('/trade'); return safeArray(res); };
export const saveTradeRecord = async (record: TradeRecord): Promise<TradeRecord[]> => { return await apiCall<TradeRecord[]>('/trade', 'POST', record); };
export const updateTradeRecord = async (record: TradeRecord): Promise<TradeRecord[]> => { return await apiCall<TradeRecord[]>(`/trade/${record.id}`, 'PUT', record); };
export const deleteTradeRecord = async (id: string): Promise<TradeRecord[]> => { return await apiCall<TradeRecord[]>(`/trade/${id}`, 'DELETE'); };

// Notes Service
import { Note } from '../types';
export const getNotes = async (): Promise<Note[]> => { const res = await apiCall<Note[]>('/notes'); return safeArray(res); };
export const saveNote = async (note: Note): Promise<Note[]> => { return await apiCall<Note[]>('/notes', 'POST', note); };
export const updateNote = async (note: Note): Promise<Note[]> => { return await apiCall<Note[]>(`/notes/${note.id}`, 'PUT', note); };
export const deleteNote = async (id: string): Promise<Note[]> => { return await apiCall<Note[]>(`/notes/${id}`, 'DELETE'); };

export const uploadFile = async (fileName: string, fileData: string): Promise<{ fileName: string, url: string }> => { 
    // Wait, the client will change to pass 'File' directly instead of base64 from reader.
    // So the signature of uploadFile might change, or we just implement uploadFileRaw
    return await apiCall<{ fileName: string, url: string }>('/upload', 'POST', { fileName, fileData }); 
};

export const uploadFileChunked = async (file: File, onProgress: (p: number) => void): Promise<{ fileName: string, url: string }> => {
    const uploadId = Date.now().toString() + '_' + Math.floor(Math.random() * 1000);
    const chunkSize = 2 * 1024 * 1024; // Increased to 2MB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    
    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        
        // Convert chunk to base64
        const chunkBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(chunk);
        });
        
        // Chunk upload with retry
        let success = false;
        let attempts = 0;
        const maxAttempts = 5;
        
        while (!success && attempts < maxAttempts) {
            try {
                attempts++;
                await apiCall('/upload-chunk', 'POST', {
                    uploadId,
                    chunkIndex: i,
                    chunkData: chunkBase64
                });
                success = true;
            } catch (err) {
                console.warn(`Upload chunk ${i} failed (Attempt ${attempts}/${maxAttempts})`, err);
                if (attempts >= maxAttempts) throw err;
                // Wait before retry
                await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempts), 5000)));
            }
        }
        
        onProgress(Math.round(((i + 1) / totalChunks) * 90)); // 90% is for uploading chunks
    }
    
    // Finish upload with retry
    let finishResponse: any = null;
    let finishAttempts = 0;
    while (!finishResponse && finishAttempts < 3) {
        try {
            finishAttempts++;
            finishResponse = await apiCall<{ fileName: string, url: string }>('/upload-finish', 'POST', {
                uploadId,
                fileName: file.name,
                totalChunks
            });
        } catch (err) {
            console.warn(`Finish upload failed (Attempt ${finishAttempts})`, err);
            if (finishAttempts >= 3) throw err;
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    onProgress(100);
    return finishResponse;
};
export const getWarehouseItems = async (): Promise<WarehouseItem[]> => { const res = await apiCall<WarehouseItem[]>('/warehouse/items'); return safeArray(res); };
export const saveWarehouseItem = async (item: WarehouseItem): Promise<WarehouseItem[]> => { return await apiCall<WarehouseItem[]>('/warehouse/items', 'POST', item); };
export const updateWarehouseItem = async (item: WarehouseItem): Promise<WarehouseItem[]> => { return await apiCall<WarehouseItem[]>(`/warehouse/items/${item.id}`, 'PUT', item); };
export const deleteWarehouseItem = async (id: string): Promise<WarehouseItem[]> => { return await apiCall<WarehouseItem[]>(`/warehouse/items/${id}`, 'DELETE'); };
export const getWarehouseTransactions = async (): Promise<WarehouseTransaction[]> => { const res = await apiCall<WarehouseTransaction[]>('/warehouse/transactions'); return safeArray(res); };
export const saveWarehouseTransaction = async (tx: WarehouseTransaction): Promise<WarehouseTransaction[]> => { return await apiCall<WarehouseTransaction[]>('/warehouse/transactions', 'POST', tx); };
export const updateWarehouseTransaction = async (tx: WarehouseTransaction): Promise<WarehouseTransaction[]> => { return await apiCall<WarehouseTransaction[]>(`/warehouse/transactions/${tx.id}`, 'PUT', tx); };
export const deleteWarehouseTransaction = async (id: string): Promise<WarehouseTransaction[]> => { return await apiCall<WarehouseTransaction[]>(`/warehouse/transactions/${id}`, 'DELETE'); };

export const getNextBijakNumber = async (company?: string): Promise<number> => { 
    try { 
        const url = company 
            ? `/next-bijak-number?company=${encodeURIComponent(company)}&t=${Date.now()}` 
            : `/next-bijak-number?t=${Date.now()}`;
        const response = await apiCall<{ nextNumber: number }>(url); 
        return response.nextNumber; 
    } catch (e) { 
        return 1001; 
    } 
};

// --- MEETINGS ---
export const getMeetings = async (): Promise<MeetingMinutes[]> => {
    const res = await apiCall<MeetingMinutes[]>('/meetings');
    return safeArray(res);
};

export const saveMeeting = async (meeting: MeetingMinutes): Promise<MeetingMinutes[]> => {
    return await apiCall<MeetingMinutes[]>('/meetings', 'POST', meeting);
};

export const updateMeeting = async (meeting: MeetingMinutes): Promise<MeetingMinutes[]> => {
    return await apiCall<MeetingMinutes[]>(`/meetings/${meeting.id}`, 'PUT', meeting);
};

export const deleteMeeting = async (id: string): Promise<MeetingMinutes[]> => {
    return await apiCall<MeetingMinutes[]>(`/meetings/${id}`, 'DELETE');
};

export const getNextMeetingNumber = async (): Promise<string> => {
    try {
        const response = await apiCall<{ nextNumber: string }>(`/next-meeting-number?t=${Date.now()}`);
        return response.nextNumber;
    } catch (e) {
        return 'M-' + Date.now();
    }
};

export const sendMeetingAnnouncement = async (meetingId: string): Promise<{ success: boolean }> => {
    return await apiCall<{ success: boolean }>(`/meetings/${meetingId}/announce`, 'POST');
};

export const sendMeetingMinutes = async (meetingId: string): Promise<{ success: boolean }> => {
    return await apiCall<{ success: boolean }>(`/meetings/${meetingId}/send-minutes`, 'POST');
};

// --- PURCHASE REQUESTS ---
import { PurchaseRequest, PurchaseRequestStatus, PartMasterData, PartKardex } from '../types';

export const getPurchaseRequests = async (): Promise<PurchaseRequest[]> => {
    const res = await apiCall<PurchaseRequest[]>('/purchase-requests');
    return safeArray(res);
};

export const savePurchaseRequest = async (req: PurchaseRequest): Promise<PurchaseRequest[]> => {
    return await apiCall<PurchaseRequest[]>('/purchase-requests', 'POST', req);
};

export const updatePurchaseRequest = async (req: PurchaseRequest): Promise<PurchaseRequest[]> => {
    return await apiCall<PurchaseRequest[]>(`/purchase-requests/${req.id}`, 'PUT', req);
};

export const deletePurchaseRequest = async (id: string): Promise<PurchaseRequest[]> => {
    return await apiCall<PurchaseRequest[]>(`/purchase-requests/${id}`, 'DELETE');
};

export const getNextPurchaseRequestNumber = async (): Promise<string> => {
    try {
        const response = await apiCall<{ nextNumber: string }>('/next-purchase-request-number');
        return response.nextNumber;
    } catch (e) {
        return 'PR-' + Date.now();
    }
};

// --- PART MASTER DATA & KARDEX ---
export const getPartMasterData = async (): Promise<PartMasterData[]> => {
    const res = await apiCall<PartMasterData[]>('/part-master-data');
    return safeArray(res);
};

export const savePartMasterData = async (part: PartMasterData): Promise<PartMasterData[]> => {
    return await apiCall<PartMasterData[]>('/part-master-data', 'POST', part);
};

export const updatePartMasterData = async (part: PartMasterData): Promise<PartMasterData[]> => {
    return await apiCall<PartMasterData[]>(`/part-master-data/${part.id}`, 'PUT', part);
};

export const deletePartMasterData = async (id: string): Promise<PartMasterData[]> => {
    return await apiCall<PartMasterData[]>(`/part-master-data/${id}`, 'DELETE');
};

export const getPartKardex = async (partId: string): Promise<PartKardex[]> => {
    const res = await apiCall<PartKardex[]>(`/part-kardex/${partId}`);
    return safeArray(res);
};

// --- SECRETARIAT ---
import { SecretariatLetter, SecretariatCompanySettings, SecretariatTemplate } from '../types';

export const getSecretariatLetters = async (): Promise<SecretariatLetter[]> => {
    const res = await apiCall<SecretariatLetter[]>('/secretariat-letters');
    return safeArray(res);
};
export const saveSecretariatLetter = async (letter: SecretariatLetter): Promise<SecretariatLetter[]> => {
    return await apiCall<SecretariatLetter[]>('/secretariat-letters', 'POST', letter);
};
export const updateSecretariatLetter = async (letter: SecretariatLetter): Promise<SecretariatLetter[]> => {
    return await apiCall<SecretariatLetter[]>(`/secretariat-letters/${letter.id}`, 'PUT', letter);
};
export const deleteSecretariatLetter = async (id: string): Promise<SecretariatLetter[]> => {
    return await apiCall<SecretariatLetter[]>(`/secretariat-letters/${id}`, 'DELETE');
};

export const getSecretariatSettings = async (): Promise<SecretariatCompanySettings[]> => {
    const res = await apiCall<SecretariatCompanySettings[]>('/secretariat-settings');
    return safeArray(res);
};
export const saveSecretariatSettings = async (settings: SecretariatCompanySettings): Promise<SecretariatCompanySettings[]> => {
    return await apiCall<SecretariatCompanySettings[]>('/secretariat-settings', 'POST', settings);
};

// Secretariat Templates & Word Import APIs
export const getSecretariatTemplates = async (): Promise<SecretariatTemplate[]> => {
    const res = await apiCall<SecretariatTemplate[]>('/secretariat-templates');
    return safeArray(res);
};

export const saveSecretariatTemplate = async (template: SecretariatTemplate): Promise<SecretariatTemplate[]> => {
    return await apiCall<SecretariatTemplate[]>('/secretariat-templates', 'POST', template);
};

export const deleteSecretariatTemplate = async (id: string): Promise<SecretariatTemplate[]> => {
    return await apiCall<SecretariatTemplate[]>(`/secretariat-templates/${id}`, 'DELETE');
};

export const importDocx = async (fileData: string): Promise<{ success: boolean; html: string; warnings?: any }> => {
    return await apiCall<{ success: boolean; html: string; warnings?: any }>('/secretariat/import-docx', 'POST', { fileData });
};

// --- CHEQUE RECEIPTS ---
export const getChequeReceipts = async (): Promise<ChequeReceipt[]> => {
    const res = await apiCall<ChequeReceipt[]>('/cheque-receipts');
    return safeArray(res);
};

export const saveChequeReceipt = async (receipt: ChequeReceipt): Promise<ChequeReceipt[]> => {
    return await apiCall<ChequeReceipt[]>('/cheque-receipts', 'POST', receipt);
};

export const updateChequeReceipt = async (receipt: ChequeReceipt): Promise<ChequeReceipt[]> => {
    return await apiCall<ChequeReceipt[]>(`/cheque-receipts/${receipt.id}`, 'PUT', receipt);
};

export const deleteChequeReceipt = async (id: string): Promise<ChequeReceipt[]> => {
    return await apiCall<ChequeReceipt[]>(`/cheque-receipts/${id}`, 'DELETE');
};

export const getNextChequeReceiptNumber = async (company?: string): Promise<string> => {
    try {
        const queryParam = company ? `&company=${encodeURIComponent(company)}` : '';
        const response = await apiCall<{ nextNumber: string }>(`/next-cheque-receipt-number?t=${Date.now()}${queryParam}`);
        return response.nextNumber;
    } catch (e) {
        return 'CR-' + Date.now();
    }
};

export const parseChequesFromDocument = async (fileData: string, fileName: string): Promise<{ cheques: ChequeItem[] }> => {
    return await apiCall<{ cheques: ChequeItem[] }>('/cheque-receipts/parse-cheques', 'POST', { fileData, fileName });
};



