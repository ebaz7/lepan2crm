
export enum UserRole {
  ADMIN = 'admin',
  CEO = 'ceo',
  FINANCIAL = 'financial',
  MANAGER = 'manager',
  SALES_MANAGER = 'sales_manager',
  FACTORY_MANAGER = 'factory_manager',
  WAREHOUSE_KEEPER = 'warehouse_keeper',
  SECURITY_HEAD = 'security_head',
  SECURITY_GUARD = 'security_guard',
  USER = 'user',
  COMMERCIAL = 'commercial',
  QC = 'qc'
}

export interface User {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: UserRole | string;
  roles?: string[];
  avatar?: string;
  phoneNumber?: string;
  telegramChatId?: string;
  baleChatId?: string;
  canManageTrade?: boolean;
  canManageSales?: boolean;
  canAccessSecretariat?: boolean;
  secretariatAllowedCompanies?: string[];
  canManageSecretariatSettings?: boolean;
  receiveNotifications?: boolean;
  mobileNavOrder?: string[];
  lastSeen?: number; // New: For online status
  signatureUrl?: string; // Appended for Secretariat letter signatures
  canAccessBotReports?: boolean;
  canAccessSayanReports?: boolean;
  canAccessSayanBalances?: boolean;
  canAccessSayanPendingDocs?: boolean;
  canAccessSayanDailySales?: boolean;
  canAccessSayanCompareSales?: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  url?: string;
}

export interface CompanyBank {
  id: string;
  bankName: string;
  accountNumber: string;
  sheba?: string;
  cardNumber?: string;
  formLayoutId?: string;
  internalTransferTemplateId?: string;
  enableDualPrint?: boolean;
  internalWithdrawalTemplateId?: string;
  internalDepositTemplateId?: string;
}

export interface Company {
  id: string;
  name: string;
  logo?: string;
  showInWarehouse?: boolean;
  banks?: CompanyBank[];
  letterhead?: string;
  registrationNumber?: string;
  nationalId?: string;
  address?: string;
  phone?: string;
  fax?: string;
  postalCode?: string;
  economicCode?: string;
}

export interface Contact {
  id: string;
  name: string;
  number: string;
  isGroup: boolean;
  baleId?: string;
  telegramId?: string;
}

export interface PrintField {
  id: string;
  key: string;
  label: string;
  x: number;
  y: number;
  width?: number;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  isBold?: boolean;
  letterSpacing?: number;
}

export interface PrintTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  pageSize: 'A4' | 'A5';
  orientation: 'portrait' | 'landscape';
  backgroundImage?: string;
  fields: PrintField[];
}

export interface CustomRole {
  id: string;
  label: string;
}

export interface RolePermissions {
  canViewAll?: boolean;
  canEditOwn?: boolean;
  canDeleteOwn?: boolean;
  canCreatePaymentOrder?: boolean;
  canViewPaymentOrders?: boolean;
  canApproveFinancial?: boolean;
  canApproveManager?: boolean;
  canApproveCeo?: boolean;
  canEditAll?: boolean;
  canDeleteAll?: boolean;
  canManageTrade?: boolean;
  canManageTradeSettings?: boolean;
  canManageSales?: boolean;
  canManageSettings?: boolean;
  canCreateExitPermit?: boolean;
  canViewExitPermits?: boolean;
  canViewInvoices?: boolean; // NEW: Access to Invoices Cartable
  canApproveExitCeo?: boolean;
  canApproveExitFactory?: boolean;
  canApproveExitWarehouse?: boolean;
  canApproveExitSecurity?: boolean;
  canViewExitArchive?: boolean;
  canEditExitArchive?: boolean;
  canCancelExitPermit?: boolean;
  canManageWarehouse?: boolean;
  canAccessCcti?: boolean;
  canManageCctiArchive?: boolean;
  canViewWarehouseReports?: boolean;
  canApproveBijak?: boolean;
  canViewSecurity?: boolean;
  canCreateSecurityLog?: boolean;
  canApproveSecuritySupervisor?: boolean;
  canViewKnowledgeBase?: boolean;
  canManageKnowledgeBase?: boolean;
  canViewMeetings?: boolean;
  canCreateMeeting?: boolean;
  canApproveMeeting?: boolean;
  canManageMeetings?: boolean;
  canManagePurchase?: boolean;
  canViewNotifications?: boolean;
  canCreateNotifications?: boolean;
  canCreateAnnouncements?: boolean;
  canViewCustomerBalances?: boolean;
  canImportCustomerBalances?: boolean;
  canViewSayan?: boolean;
  canViewSayanTraz?: boolean;
  canViewSayanSales?: boolean;
  canViewSayanProduction?: boolean;
  canViewSayanCheques?: boolean;
  canAccessSayanReports?: boolean;
  canAccessSayanBalances?: boolean;
  canAccessSayanPendingDocs?: boolean;
  canAccessSayanDailySales?: boolean;
  canAccessSayanCompareSales?: boolean;
  canAccessSecretariat?: boolean;
  canManageSecretariatSettings?: boolean;
  [key: string]: boolean | undefined;
}

export interface CompanySequenceConfig {
    startTrackingNumber?: number;
    startExitPermitNumber?: number;
    startBijakNumber?: number;
    startChequeReceiptNumber?: number;
}

export interface FiscalYear {
    id: string;
    label: string;
    isClosed: boolean;
    companySequences?: Record<string, CompanySequenceConfig>;
    createdAt: number;
}

export interface ExitPermitGroupConfig {
    groupId: string; // WhatsApp Group ID
    baleId?: string; // NEW: Bale Channel/Group ID
    telegramId?: string; // NEW: Telegram Chat ID
    activeStatuses: string[];
}

export interface CompanyNotificationConfig {
    salesManager?: string;
    salesManagerBale?: string;
    salesManagerTelegram?: string;
    warehouseGroup?: string;
    baleChannelId?: string; // NEW: Company specific Bale
    telegramChannelId?: string; // NEW: Company specific Telegram
}

export interface DailySecurityMeta {
    dailyDescription?: string;
    morningGuard?: { name: string; entry: string; exit: string };
    eveningGuard?: { name: string; entry: string; exit: string };
    nightGuard?: { name: string; entry: string; exit: string };
    isFactoryDailyApproved?: boolean;
    isCeoDailyApproved?: boolean;
}

export interface TicketMessage {
  id: string;
  sender: 'customer' | 'admin';
  senderName?: string;
  text: string;
  timestamp: string;
}

export interface CustomerTicket {
  id: string; // e.g. "81423"
  chatId: string | number;
  platform: string;
  customerName?: string;
  subject?: string;
  messages: TicketMessage[];
  status: 'OPEN' | 'CLOSED';
  createdAt: number;
  updatedAt: number;
}

export interface NoteTask {
  id: string;
  text: string;
  isCompleted: boolean;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  content: string;
  tasks?: NoteTask[];
  color?: string;
  type?: 'note' | 'list';
  reminderTime?: number;
  isPinned?: boolean;
  isPrivate?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeBaseItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface SystemSettings {
  appName?: string;
  currentTrackingNumber: number;
  currentExitPermitNumber: number;
  currentChequeReceiptNumber?: number; // شماره جاری رسید دریافت چک عمومی
  chequeArchiveCutoffDate?: string; // تاریخ قطع نمایش چک‌های اقدام شده قدیمی
  companyNames: string[];
  companies?: Company[];
  defaultCompany?: string;
  bankNames?: string[];
  operatingBankNames?: string[];
  commodityGroups: string[];
  itemCategories?: { name: string; subCategories: string[] }[]; // NEW
  rolePermissions?: Record<string, RolePermissions>;
  customRoles?: CustomRole[];
  customRoleNames?: Record<string, string>;
  savedContacts?: Contact[];
  knowledgeBaseItems?: KnowledgeBaseItem[];
  pwaIcon?: string;
  botCompanyInfo?: string; // fallback / general
  companyAddress?: string;
  companyPhone?: string;
  companyBank?: string;
  telegramBotToken?: string;
  telegramAdminId?: string;
  purchaseTelegramGroup?: string;
  baleBotToken?: string;
  purchaseBaleGroup?: string;
  purchaseWhatsappGroup?: string;
  smsApiKey?: string;
  smsSenderNumber?: string;
  googleCalendarId?: string;
  whatsappNumber?: string;
  geminiApiKey?: string;
  fcmServerKey?: string;
  deepseekApiKey?: string;
  botAiSource?: 'gemini' | 'deepseek' | 'hybrid';
  botAiEnabled?: boolean;
  excelPriority?: boolean;
  autoPriceUpdateInterval?: number;
  supportUsername?: string;
  warehouseSequences?: Record<string, number>;
  companyNotifications?: Record<string, CompanyNotificationConfig>;
  defaultWarehouseGroup?: string; // WhatsApp Default
  exitPermitNotificationBaleId?: string; // NEW: Default Group 1 Bale
  exitPermitNotificationTelegramId?: string; // NEW: Default Group 1 Telegram
  defaultSalesManager?: string;
  insuranceCompanies?: string[];
  exitPermitNotificationGroup?: string; // Legacy field
  exitPermitFirstGroupConfig?: ExitPermitGroupConfig;
  exitPermitSecondGroupConfig?: ExitPermitGroupConfig;
  exitPermitThirdGroupConfig?: ExitPermitGroupConfig;
  sayanApiUrl?: string;
  sayanApiKey?: string;
  printTemplates?: PrintTemplate[];
  fiscalYears?: FiscalYear[];
  activeFiscalYearId?: string;
  dailySecurityMeta?: Record<string, DailySecurityMeta>;
  botAccountingGroupId?: string;
  botAccountingGroupIdTele?: string;
  botAccountingGroupIdBale?: string;
  botAccountingGroupIdWhatsApp?: string;
  botBijakGroupId?: string;
  botBijakGroupIdBale?: string;
  botBijakGroupIdWhatsApp?: string;
  botMeetingAnnouncementGroupId?: string;
  botMeetingAnnouncementTelegramId?: string;
  botMeetingAnnouncementBaleId?: string;
  botMeetingMinutesGroupId?: string;
  botMeetingMinutesTelegramId?: string;
  botMeetingMinutesBaleId?: string;
  botMeetingMinutesWhatsAppId?: string;
  botMeetingMinutesSecondGroupIdTele?: string;
  botMeetingMinutesSecondGroupIdBale?: string;
  botMeetingMinutesSecondGroupIdWhatsApp?: string;
  botMeetingMinutesNotificationMode?: 'after_approval' | 'immediately';
  botPaymentNotificationMode?: 'after_submit' | 'after_final' | 'step_by_step';
  botForceJoinChannels?: { name: string; link: string; id: string; platform?: 'telegram' | 'bale' | 'all' }[];
  botForceJoinEnabled?: boolean;
  botStoreLinks?: { title: string; url: string }[];
  
  dailyExitReportDedicatedTelegramId?: string;
  dailyExitReportDedicatedBaleId?: string;
  dailyExitReportDedicatedWhatsAppId?: string;
  dailyExitReportSendToFirstGroup?: boolean;
  dailyExitReportSendToSecondGroup?: boolean;
  dailyExitReportSendToThirdGroup?: boolean;
  dailyExitReportSendToDedicatedGroup?: boolean;
  
  dailySalesTelegramGroupId?: string;
  dailySalesBaleGroupId?: string;
  productionTelegramGroupId?: string;
  productionBaleGroupId?: string;
  
  salesNotificationUsers?: { username: string; platforms: string[]; name?: string }[]; // Usernames and their active platforms (telegram, bale)
  salesContactMessage?: string;
  defaultMeetingAttendees?: string[];
  defaultMeetingAttendeesData?: { username: string; role: string }[];
  meetingRoles?: string[];
  mobileNavOrder?: string[];
  
  // CRM / SALES
  salesContacts?: SalesContact[];
  birthdayGreetingTemplate?: BirthdayGreetingTemplate;
  
  // MINI APPS
  miniAppCarPriceUrl?: string;
  miniAppCarEstimatorUrl?: string;
  miniAppMobilePriceUrl?: string;
  purchaseRolePermissions?: Record<string, PurchaseRolePermissions>;
}

export interface PurchaseRolePermissions {
  canView?: boolean;
  canCreate?: boolean;
  canApproveTechnical?: boolean;
  canApproveShiftLeader?: boolean;
  canApproveWarehouseKeeper?: boolean;
  canApproveFactoryDecision?: boolean;
  canApproveFactory?: boolean;
  canApproveCEO?: boolean;
  canManageProformas?: boolean;
  canSelectProforma?: boolean;
  canRegisterEntry?: boolean;
  canCheckQC?: boolean;
  canApproveFactoryFinal?: boolean;
  canWarehouseFinalize?: boolean;
  canCommercialFinalize?: boolean;
}

export interface BirthdayGreetingTemplate {
    text: string;
    isActive: boolean;
}

export interface SalesContact {
    id: string;
    name: string;
    mobile: string;
    telegramId?: string;
    baleId?: string;
    birthday?: string; // Gregorian YYYY-MM-DD
    sendBirthdayGreeting: boolean;
    accountCode?: string;
}


export enum PaymentMethod {
  TRANSFER = 'حواله بانکی',
  CHEQUE = 'چک',
  CASH = 'نقد',
  POS = 'کارتخوان',
  SHEBA = 'شبا',
  SATNA = 'ساتنا',
  PAYA = 'پایا',
  INTERNAL_TRANSFER = 'حواله داخلی'
}

export interface PaymentDetail {
  id: string;
  method: PaymentMethod;
  amount: number;
  chequeNumber?: string;
  bankName?: string;
  description?: string;
  chequeDate?: string;
  sheba?: string;
  recipientBank?: string;
  paymentId?: string;
  destinationAccount?: string;
  destinationOwner?: string;
  destinationBranch?: string;
}

export enum OrderStatus {
  PENDING = 'در انتظار بررسی مالی',
  APPROVED_FINANCE = 'تایید مالی / در انتظار مدیریت',
  APPROVED_MANAGER = 'تایید مدیریت / در انتظار مدیرعامل',
  APPROVED_CEO = 'تایید نهایی',
  PAID = 'پرداخت شده',
  REJECTED = 'رد شده',
  REVOCATION_PENDING_FINANCE = 'درخواست ابطال (مالی)',
  REVOCATION_PENDING_MANAGER = 'تایید ابطال (مدیریت)',
  REVOCATION_PENDING_CEO = 'تایید ابطال (مدیرعامل)',
  REVOKED = 'باطل شده'
}

export interface PaymentOrder {
  id: string;
  trackingNumber: number;
  date: string;
  payee: string;
  totalAmount: number;
  description: string;
  status: OrderStatus;
  requester: string;
  createdAt: number;
  updatedAt?: number;
  paymentDetails: PaymentDetail[];
  attachments?: { fileName: string, data: string }[];
  payingCompany?: string;
  paymentPlace?: string;
  approverFinancial?: string;
  approverManager?: string;
  approverCeo?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  payDate?: string;
  fiscalYearId?: string;
  isEdit?: boolean;
}

export enum ExitPermitStatus {
  PENDING_CEO = 'در انتظار تایید مدیرعامل',
  PENDING_FACTORY = 'در انتظار مدیر کارخانه',
  PENDING_WAREHOUSE = 'در انتظار تایید انبار',
  PENDING_SECURITY = 'در انتظار خروج (انتظامات)',
  PENDING_FACTORY_FINAL = 'در انتظار تایید نهایی مدیر کارخانه',
  EXITED = 'خارج شده (بایگانی)',
  REJECTED = 'رد شده',
  CANCELED = 'کنسل شده'
}

export interface ExitPermitItem {
  id: string;
  goodsName: string;
  cartonCount: number;
  weight: number;
  deliveredCartonCount?: number;
  deliveredWeight?: number;
  price?: number;
}

export interface ExitPermitDestination {
  id: string;
  recipientName: string;
  address: string;
  phone: string;
}

export interface ExitPermit {
  id: string;
  permitNumber: number;
  date: string;
  company?: string;
  requester: string;
  items: ExitPermitItem[];
  destinations: ExitPermitDestination[];
  goodsName?: string;
  recipientName?: string;
  cartonCount?: number;
  weight?: number;
  destinationAddress?: string;
  plateNumber?: string;
  driverName?: string;
  driverPhone?: string;
  description?: string;
  status: ExitPermitStatus;
  attachments?: { fileName: string, data: string }[];
  createdAt: number;
  updatedAt?: number;
  approverCeo?: string;
  approverFactory?: string;
  approverWarehouse?: string;
  approverSecurity?: string;
  approverFactoryFinal?: string;
  exitTime?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  isEdit?: boolean;
  price?: number;
}

export interface WarehouseItem {
  id: string;
  name: string;
  code?: string;
  unit: string;
  containerCapacity?: number;
}

export interface WarehouseTransactionItem {
  itemId: string;
  itemName: string;
  quantity: number;
  weight: number;
  unitPrice?: number;
}

export interface WarehouseTransaction {
  id: string;
  type: 'IN' | 'OUT';
  date: string;
  company: string;
  number: number;
  items: WarehouseTransactionItem[];
  createdAt: number;
  createdBy: string;
  proformaNumber?: string;
  recipientName?: string;
  driverName?: string;
  plateNumber?: string;
  destination?: string;
  description?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  rejectionReason?: string;
  rejectedBy?: string;
  updatedAt?: number;
  isEdit?: boolean;
}

export enum SecurityStatus {
    PENDING_SUPERVISOR = 'در انتظار تایید سرپرست',
    PENDING_FACTORY = 'در انتظار تایید مدیر کارخانه',
    PENDING_CEO = 'در انتظار تایید مدیرعامل',
    ARCHIVED = 'بایگانی شده',
    REJECTED = 'رد شده'
}

export interface SecurityLog {
    id: string;
    rowNumber: number;
    date: string;
    shift: string;
    origin: string;
    entryTime: string;
    exitTime: string;
    driverName: string;
    driverPhone?: string;
    plateNumber: string;
    goodsName: string;
    quantity: string;
    destination: string;
    receiver: string;
    workDescription: string;
    permitProvider: string;
    registrant: string;
    status: SecurityStatus;
    createdAt: number;
    approverSupervisor?: string;
    approverFactory?: string;
    approverCeo?: string;
    attachment?: string;
}

export interface PersonnelDelay {
    id: string;
    date: string;
    personnelName: string;
    unit: string;
    arrivalTime: string;
    delayAmount: string;
    repeatCount: string;
    instruction: string;
    registrant: string;
    status: SecurityStatus;
    createdAt: number;
    approverSupervisor?: string;
    approverFactory?: string;
    approverCeo?: string;
}

export interface SecurityIncident {
    id: string;
    reportNumber: string;
    date: string;
    subject: string;
    description: string;
    shift: string;
    witnesses: string;
    registrant: string;
    status: SecurityStatus;
    createdAt: number;
    approverSupervisor?: string;
    approverFactory?: string;
    approverCeo?: string;
    shiftManagerOpinion?: string;
    hrAction?: string;
    safetyAction?: string;
    rejectionReason?: string;
}

export interface ChatMessage {
    id: string;
    sender: string;
    senderUsername: string;
    role: string;
    message: string;
    timestamp: number;
    recipient?: string;
    groupId?: string;
    attachment?: { fileName: string, url: string };
    audioUrl?: string;
    audioDuration?: number;
    replyTo?: { id: string, sender: string, message: string };
    isEdited?: boolean;
    isForwarded?: boolean;
    forwardFrom?: string;
    readBy?: string[]; // Array of usernames who read it
    isDeleted?: boolean; // Logical delete
    isPending?: boolean;
    uploadProgress?: number;
}

export interface ChatGroup {
    id: string;
    name: string;
    members: string[];
    createdBy: string;
    admins?: string[];
    avatar?: string | null;
    description?: string;
    createdAt?: number;
    isTaskGroup?: boolean;
}

export interface TaskGroup {
    id: string;
    name: string;
    members: string[];
    createdBy: string;
    createdAt: number;
    isTaskGroup?: boolean;
    avatar?: string | null;
    description?: string;
}

export interface SystemAnnouncement {
    id: string;
    message: string;
    createdBy: string;
    createdAt: number;
    targetUsers?: string[]; // Empty means all users
    isCompleted?: boolean;
    completedAt?: number;
    completedBy?: string;
    type?: 'task' | 'general';
}

export interface TaskReply {
    id: string;
    sender: string;
    senderUsername: string;
    message: string;
    timestamp: number;
}

export interface GroupTask {
    id: string;
    groupId: string;
    title: string;
    description?: string;
    assignee?: string;
    assignedTo?: string[];
    dueDate?: string;
    isCompleted?: boolean;
    status: 'pending' | 'completed';
    createdBy: string;
    createdAt: number;
    completedBy?: string;
    completedAt?: number;
    replies?: TaskReply[];
}

export enum TradeStage {
    LICENSES = 'مجوزها و پروفرما',
    INSURANCE = 'بیمه',
    ALLOCATION_QUEUE = 'در صف تخصیص ارز',
    ALLOCATION_APPROVED = 'تخصیص یافته',
    CURRENCY_PURCHASE = 'خرید ارز',
    SHIPPING_DOCS = 'اسناد حمل',
    INSPECTION = 'گواهی بازرسی',
    CLEARANCE_DOCS = 'ترخیصیه و قبض انبار',
    GREEN_LEAF = 'برگ سبز',
    INTERNAL_SHIPPING = 'حمل داخلی',
    AGENT_FEES = 'هزینه‌های ترخیص'
}

export interface TradeStageData {
    stage: TradeStage;
    isCompleted: boolean;
    description: string;
    costRial: number;
    costCurrency: number;
    currencyType: string;
    attachments: { fileName: string, url: string }[];
    updatedAt: number;
    updatedBy: string;
    queueDate?: string;
    allocationDate?: string;
    allocationCode?: string;
    allocationExpiry?: string;
}

export interface CurrencyDelivery {
    id: string;
    amount: number;
    date: string;
    recipientName?: string;
    description?: string;
}

export interface CurrencyTranche {
    id: string;
    amount: number;
    currencyType: string;
    date: string;
    exchangeName?: string;
    brokerName?: string;
    rate?: number;
    rialAmount?: number;
    currencyFee?: number;
    isDelivered?: boolean;
    deliveryDate?: string;
    returnAmount?: number;
    returnDate?: string;
    receivedAmount?: number;
    deliveries?: CurrencyDelivery[];
}

export interface GuaranteeCheque {
    amount: number;
    bank: string;
    chequeNumber: string;
    dueDate: string;
    isDelivered?: boolean;
}

export interface CurrencyPurchaseData {
    payments: any[];
    purchasedAmount: number;
    purchasedCurrencyType: string;
    tranches?: CurrencyTranche[];
    isDelivered?: boolean;
    deliveredAmount?: number;
    remittedAmount?: number;
    guaranteeCheque?: GuaranteeCheque;
    guaranteeCheques?: GuaranteeCheque[];
    purchaseDate?: string;
    brokerName?: string;
    exchangeName?: string;
    deliveryDate?: string;
    recipientName?: string;
    deliveredCurrencyType?: string;
}

export interface InsuranceEndorsement {
    id: string;
    date: string;
    amount: number;
    description: string;
}

export interface TradeItem {
    id: string;
    name: string;
    hsCode?: string;
    weight: number;
    unitPrice: number;
    totalPrice: number;
}

export type ShippingDocType = 'Commercial Invoice' | 'Packing List' | 'Bill of Lading' | 'Certificate of Origin';
export type DocStatus = 'Draft' | 'Final';

export interface InvoiceItem {
    id: string;
    name: string;
    weight: number;
    unitPrice: number;
    totalPrice: number;
    part: string;
}

export interface PackingItem {
    id: string;
    description: string;
    netWeight: number;
    grossWeight: number;
    packageCount: number;
    part: string;
}

export interface ShippingDocument {
    id: string;
    type: ShippingDocType;
    status: DocStatus;
    documentNumber: string;
    documentDate: string;
    attachments: { fileName: string, url: string }[];
    createdAt: number;
    createdBy: string;
    invoiceItems?: InvoiceItem[];
    packingItems?: PackingItem[];
    freightCost?: number;
    currency?: string;
    netWeight?: number;
    grossWeight?: number;
    packagesCount?: number;
    vesselName?: string;
    portOfLoading?: string;
    portOfDischarge?: string;
    description?: string;
}

export interface InspectionCertificate {
    id: string;
    part: string;
    company: string;
    certificateNumber: string;
    amount: number;
    description?: string;
}

export interface InspectionPayment {
    id: string;
    part: string;
    amount: number;
    date: string;
    bank: string;
    description?: string;
}

export interface InspectionData {
    certificates: InspectionCertificate[];
    payments: InspectionPayment[];
    totalInvoiceAmount?: number;
    certificateNumber?: string;
    inspectionCompany?: string;
}

// Added missing trade-related interfaces
export interface TradeTransaction {
    id: string;
    date: string;
    amount: number;
    bank: string;
    description: string;
}

export interface WarehouseReceipt {
    id: string;
    number: string;
    part: string;
    issueDate: string;
}

export interface ClearancePayment {
    id: string;
    amount: number;
    part: string;
    bank: string;
    date: string;
    payingBank?: string;
}

export interface ClearanceData {
    receipts: WarehouseReceipt[];
    payments: ClearancePayment[];
}

export interface GreenLeafCustomsDuty {
    id: string;
    cottageNumber: string;
    part: string;
    amount: number;
    paymentMethod: 'Bank' | 'Guarantee';
    bank?: string;
    date?: string;
}

export interface GreenLeafGuarantee {
    id: string;
    relatedDutyId: string;
    guaranteeNumber: string;
    sepamNumber?: string;
    chequeNumber?: string;
    chequeBank?: string;
    chequeDate?: string;
    chequeAmount?: number;
    isDelivered: boolean;
    cashAmount?: number;
    cashBank?: string;
    cashDate?: string;
    part?: string;
    guaranteeBank?: string;
    guaranteeType?: 'cheque' | 'credit';
    guaranteeAmount?: number;
    dutyCashAmount?: number;
}

export interface GreenLeafTax {
    id: string;
    amount: number;
    part: string;
    bank: string;
    date: string;
    }

export interface GreenLeafRoadToll {
    id: string;
    amount: number;
    part: string;
    bank: string;
    date: string;
}

export interface GreenLeafData {
    duties: GreenLeafCustomsDuty[];
    guarantees: GreenLeafGuarantee[];
    taxes: GreenLeafTax[];
    roadTolls: GreenLeafRoadToll[];
}

export interface ShippingPayment {
    id: string;
    part: string;
    amount: number;
    date: string;
    bank: string;
    description: string;
}

export interface InternalShippingData {
    payments: ShippingPayment[];
}

export interface AgentPayment {
    id: string;
    agentName: string;
    amount: number;
    bank: string;
    date: string;
    part: string;
    description: string;
}

export interface AgentData {
    payments: AgentPayment[];
}

export interface TradeRecord {
    id: string;
    fileNumber: string;
    orderNumber?: string;
    goodsName: string;
    sellerName: string;
    commodityGroup: string;
    mainCurrency: string;
    company: string;
    items: TradeItem[];
    freightCost: number;
    status: 'Active' | 'Completed';
    isArchived?: boolean;
    stages: Record<string, TradeStageData>;
    startDate: string;
    createdAt: number;
    createdBy: string;
    registrationNumber?: string;
    registrationDate?: string;
    registrationExpiry?: string;
    currencyAllocationType?: string;
    allocationCurrencyRank?: 'Type1' | 'Type2';
    operatingBank?: string;
    isPriority?: boolean;
    licenseData?: { transactions: TradeTransaction[] };
    insuranceData?: {
        policyNumber: string;
        company: string;
        cost: number;
        bank: string;
        endorsements: InsuranceEndorsement[];
        isPaid: boolean;
        paymentDate: string;
    };
    currencyPurchaseData?: CurrencyPurchaseData;
    shippingDocuments?: ShippingDocument[];
    inspectionData?: InspectionData;
    clearanceData?: ClearanceData;
    greenLeafData?: GreenLeafData;
    internalShippingData?: InternalShippingData;
    agentData?: AgentData;
    isCommitmentFulfilled?: boolean;
    exchangeRate?: number;
}

export enum MeetingStatus {
    DRAFT = 'پیش‌نویس',
    PENDING_APPROVAL = 'در انتظار تایید',
    PENDING_CEO = 'در انتظار تایید مدیرعامل',
    APPROVED = 'تایید شده',
    REJECTED = 'رد شده'
}

export interface MeetingAttendee {
    userId?: string;
    username?: string;
    fullName: string;
    role: string;
    isPresent: boolean;
    isAbsenceAuthorized?: boolean;
}

export interface MeetingItem {
    id: string;
    description: string;
    responsiblePerson: string;
    duration: string;
}

export interface MeetingComment {
    id: string;
    username: string;
    fullName: string;
    text: string;
    timestamp: number;
}

export interface MeetingMinutes {
    id: string;
    meetingNumber: string;
    date: string;
    time: string;
    location: string;
    chairman: string;
    secretary: string;
    attendees: MeetingAttendee[];
    guestAttendees?: string[];
    absentees: string[];
    items: MeetingItem[];
    status: MeetingStatus;
    createdAt: number;
    updatedAt: number;
    createdBy: string;
    announcementSent?: boolean;
    minutesSent?: boolean;
    approvals?: Record<string, { approved: boolean, date: number, comment?: string }>;
    comments?: MeetingComment[];
    imageAttachments?: { fileName: string, url: string }[];
    pdfAttachments?: { fileName: string, url: string }[];
}

export enum PurchaseRequestStatus {
    PENDING_REPAIR_INSPECTION = 'در انتظار بررسی واحد نت/تعمیرات',
    PENDING_WAREHOUSE_CHECK = 'در انتظار بررسی موجودی انبار (سرشیفت)',
    PENDING_TECHNICAL = 'در انتظار تایید فنی / ثبت درخواست فنی',
    PENDING_SHIFT_LEADER = 'در انتظار تایید سرشیفت کارخانه',
    PENDING_WAREHOUSE_KEEPER = 'در انتظار بررسی انباردار کارخانه',
    PENDING_FACTORY = 'در انتظار مدیر کارخانه',
    PENDING_FACTORY_DECISION = 'در انتظار تصمیم مدیر کارخانه (تعیین مسیر خرید)',
    PENDING_COMMERCIAL_DECISION = 'در انتظار تصمیم بازرگانی (محل خرید)',
    
    // Tehran Branch
    PENDING_TEHRAN_PURCHASING = 'در انتظار مسئول خرید تهران',
    PENDING_CEO_INITIAL = 'در انتظار تایید اولیه مدیرعامل (تهران)',
    PENDING_TEHRAN_PROFORMA = 'در انتظار ثبت پیش‌فاکتور (بازرگانی تهران)',
    PENDING_COMMERCIAL_MANAGER = 'در انتظار بررسی و انتخاب مدیر بازرگانی',
    PENDING_CEO_SELECTION = 'در انتظار انتخاب پیش‌فاکتور (مدیرعامل)',
    
    // Factory/Zanjan Branch
    PENDING_ZANJAN_PURCHASING = 'در انتظار مسئول خرید و نت (زنجان)',
    PENDING_FACTORY_PURCHASING = 'در انتظار مسئول خرید و نت (زنجان)',
    PENDING_FACTORY_PROFORMA = 'در انتظار ثبت پیش‌فاکتور (زنجان/کارخانه)',
    PENDING_FACTORY_MANAGER_SELECTION = 'در انتظار انتخاب پیش‌فاکتور (مدیر کارخانه)',
    PENDING_FACTORY_MANAGER_APPROVAL = 'در انتظار تایید سفارش (مدیر کارخانه)',
    PENDING_BUYER_EXECUTION = 'در انتظار انجام خرید توسط کارپرداز',
    
    // Common Arrival Flow
    PENDING_TECHNICAL_APPROVAL = 'در انتظار تایید فنی و کنترل کیفیت',
    PENDING_FACTORY_ENTRY_APPROVAL = 'در انتظار تایید ورود کالا (مدیر کارخانه)',
    PENDING_SECURITY_ENTRY = 'در انتظار ورود کالا (انتظامات)',
    PENDING_QC = 'در انتظار کنترل کیفی',
    PENDING_FACTORY_FINAL_APPROVE = 'در انتظار تایید نهایی مدیر کارخانه',
    PENDING_WAREHOUSE_RECEIPT = 'در انتظار شمارش و صدور رسید انبار',
    PENDING_FACTORY_FINAL_SIGN = 'در انتظار امضا و بایگانی نهایی (مدیر کارخانه)',
    
    DELIVERED_FROM_WAREHOUSE = 'تحویل شده از انبار (تکمیل بدون خرید)',
    RETURNED_FOR_CORRECTION = 'عودت داده شده جهت اصلاح',
    COMPLETED = 'تکمیل و بایگانی شده',
    REJECTED = 'رد شده / متوقف شده'
}

export interface PurchaseRequestItem {
    id: string;
    itemCode?: string;
    itemName: string;
    quantity: number;
    unit: string;
    suggestedBrand?: string;
    specifications?: string;
    remarks?: string;
    warehouseStock?: number;
    isAvailableInWarehouse?: boolean;
    partId?: string;
}

export interface PurchaseAttachment {
    id: string;
    fileName: string;
    fileType?: string; // 'pdf' | 'word' | 'excel' | 'image' | 'other'
    fileUrl?: string;
    url?: string;
    uploadedBy?: string;
    uploadedAt?: number | string;
    stepName?: string;
}

export interface PurchaseAuditLog {
    id: string;
    stage?: string;
    stepName?: string;
    action: string;
    actionLabel?: string;
    performedBy: string;
    role?: string;
    userRole?: string;
    timestamp: number | string;
    comment?: string;
    signatureUrl?: string;
    durationMinutes?: number;
}

export interface PurchaseProformaItem {
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
}

export interface PurchaseProforma {
    id: string;
    vendorName: string;
    vendorPhone?: string;
    number: string;
    date: string;
    items?: PurchaseProformaItem[]; // Professional details
    totalAmount: number;
    taxAmount?: number;
    discountAmount?: number;
    attachments: PurchaseAttachment[];
    isChosen?: boolean;
    registeredBy?: string;
    deliveryTime?: string; // مدت زمان تحویل
    paymentConditions?: string; // شرایط پرداخت
}

export interface PurchaseRequest {
    id: string;
    requestNumber: string;
    date: string;
    requester: string;
    requestingUnit?: string; // واحد درخواست‌کننده
    machinery?: string; // دستگاه یا ماشین‌آلات
    installationLocation?: string; // محل نصب
    urgency?: 'عادی' | 'فوری' | 'اضطراری'; // درجه فوریت
    breakdownDescription?: string; // شرح خرابی
    purchaseReason?: string; // علت درخواست خرید
    repairRequestNumber?: string; // شماره فرم درخواست تعمیر/گزارش خرابی نت
    
    // Main Item or Multi-items list
    itemName: string;
    category?: string;
    subCategory?: string;
    dimensions?: string;
    specifications?: string;
    image?: string;
    pdfAttachment?: string;
    quantity: number;
    unit: string;
    items?: PurchaseRequestItem[]; // Multiple items in single request
    attachments?: PurchaseAttachment[]; // General attachments (PDF, Word, Excel, images)
    auditLogs?: PurchaseAuditLog[]; // Complete step history & time tracking
    
    status: PurchaseRequestStatus;
    proformas: PurchaseProforma[];
    
    // Approval trails
    approverRepair?: string;
    approverWarehouseCheck?: string;
    approverTechnical?: string;
    approverFactory?: string;
    approverCommercial?: string;
    approverCeoInitial?: string;
    approverCeoSelection?: string;
    approverFactorySelection?: string;
    approverBuyer?: string;
    approverQc?: string;
    approverFactoryFinal?: string;
    approverWarehouseReceipt?: string;
    approverFactoryArchive?: string;
    
    // Entry data from security (انتظامات)
    entryQuantity?: number;
    entryWeight?: number;
    entryDate?: string;
    entryTime?: string;
    entryRegistrant?: string;
    driverName?: string;
    driverPhone?: string;
    plateNumber?: string;
    waybillNumber?: string; // شماره بارنامه
    transportInfo?: string;
    
    // QC details
    qcResult?: 'تایید' | 'مشروط' | 'رد';
    qcDescription?: string;

    // Warehouse Receipt details & Stock intake
    warehouseReceiptNumber?: string;
    warehouseReceiptDate?: string;
    warehouseLocationSlot?: string; // محل نگهداری در انبار
    serialNumber?: string;
    barcode?: string;
    itemCodeAssigned?: string;

    // Warehouse Delivery (Direct exit from stock)
    warehouseVoucherNumber?: string;
    warehouseRecipient?: string;
    warehouseKeeperName?: string;

    // Technical Approval Form details
    technicalReport?: string;
    technicalBrandApproved?: boolean;
    technicalQualityApproved?: boolean;
    technicalMatchApproved?: boolean;

    // Purchasing Agent (کارپرداز) execution details
    buyerName?: string;
    buyerVendorName?: string;
    buyerPurchaseAmount?: number;
    buyerInvoiceNumber?: string;

    location?: 'Tehran' | 'Factory' | 'Zanjan';
    rejectionReason?: string;
    returnReason?: string;
    createdAt: number;
    updatedAt: number;
}

export interface PartMasterData {
    id: string;
    name: string; // Used for item name
    type?: string; // e.g. 'قطعه', 'مواد اولیه', 'ملزومات'
    category: string;
    subCategory?: string;
    dimensions?: string;
    unit: string;
    image?: string;
    pdfAttachment?: string; // NEW
    minStock?: number;
    currentStock: number;
}

export interface PartKardex {
    id: string;
    partId: string;
    date: string;
    referenceNumber: string;
    type: 'IN' | 'OUT';
    quantity: number;
    balance: number;
    unitPrice?: number;
    description?: string;
}

export interface SecretariatLetterAttachment {
  fileName: string;
  url: string;
}

export interface SecretariatLetterComment {
  id: string;
  userId: string;
  username: string;
  comment: string;
  createdAt: number;
}

export enum SecretariatLetterStatus {
  DRAFT = 'پیش‌نویس',
  PENDING = 'در انتظار اقدام',
  APPROVED = 'تایید شده',
  REJECTED = 'رد شده',
  ARCHIVED = 'بایگانی شده'
}

export interface SecretariatLetter {
    id: string;
    companyId: string; // The company this letter belongs to
    section: 'headquarters' | 'factory'; // دفتر مرکزی یا کارخانه
    letterNumber: string;
    date: string;
    subject: string;
    content: string;
    sender: string; // From whom
    receiver: string; // To whom
    type: 'internal' | 'incoming' | 'outgoing';
    status: SecretariatLetterStatus;
    
    // Referral (ارجاع)
    referredTo?: string[]; // Array of User IDs
    referredBy?: string;
    
    // Approval/Signature
    approvedBy?: string[]; // Array of User IDs who approved/signed
    signatureImageUrls?: string[]; // Captured signatures
    
    comments: SecretariatLetterComment[];
    attachments: SecretariatLetterAttachment[];
    addCompanyStamp?: boolean; // تیک درج مهر شرکت پای نامه
    isPrivate?: boolean; // تیک خصوصی بودن نامه
    signOffText?: string; // متن با تشکر
    signers?: { name: string; title: string; userId?: string; }[]; // لیست امضاکنندگان و سمت‌ها
    paperSize?: 'A4' | 'A5';
    orientation?: 'portrait' | 'landscape';
    signaturePosition?: 'bottom_left' | 'bottom_center' | 'bottom_right';
    hideSubjectInLetter?: boolean;
    hideSalutationInLetter?: boolean;
    createdAt: number;
    updatedAt: number;
    createdBy: string;
}

export interface SecretariatCompanySettings {
    companyId: string;
    headquartersAccessTokens: string[]; // List of user IDs with access
    factoryAccessTokens: string[];     // List of user IDs with access
    editAccessTokens?: string[];       // List of user IDs with edit access
    deleteAccessTokens?: string[];     // List of user IDs with delete access
    letterheadUrl?: string;            // سربرگ
    wordLetterheadUrl?: string;        // سربرگ اختصاصی فایل ورد
    pdfLetterheadUrl?: string;         // سربرگ اختصاصی فایل PDF
    meetingMinutesTemplate?: string;   // قالب صورتجلسه
    companyStampUrl?: string;          // تصویر مهر رسمی شرکت
    companyStampSize?: number;         // اندازه مهر رسمی (پیکسل)
    companyStampOpacity?: number;      // شفافیت مهر رسمی (درصد)
    hideAutoFooter?: boolean;          // عدم نمایش خودکار پاورقی در صورت داشتن سربرگ
    letterheadFontFamily?: string;     // نوع فونت بدنه نامه
    metadataTop?: number;              // فاصله از بالای سربرگ (میلی‌متر)
    metadataLeft?: number;             // فاصله از چپ سربرگ (میلی‌متر)
    metadataFontSize?: number;         // اندازه قلم اطلاعات سربرگ (پیکسل)
    metadataOpacity?: number;          // میزان پررنگی اطلاعات سربرگ (درصد، از ۱۰ تا ۱۰۰)
    metadataFontWeight?: 'normal' | 'bold' | 'bolder' | 'black'; // میزان ضخامت متون سربرگ
}

export interface SecretariatTemplate {
    id: string;
    title: string;       // عنوان قالب
    category?: string;   // دسته‌بندی قالب (مانند: اداری، مالی، فنی، عمومی)
    subject?: string;    // موضوع پیش‌فرض نامه
    content: string;     // متن خام قالب (HTML/Quill compatible)
    createdAt: number;
}

export interface ChequeItem {
    id: string;
    chequeNumber: string; // شماره چک
    sayyadId: string;     // شناسه صیادی ۱۶ رقمی
    bankName: string;     // نام بانک صادرکننده
    dueDate: string;      // تاریخ سررسید (مثال: ۱۴۰۳/۰۵/۲۰)
    amount: number;       // مبلغ چک به ریال
    drawerName: string;   // صادرکننده چک / صاحب حساب
    chequeStatus?: 'box' | 'cashed' | 'deposited' | 'spent'; // وضعیت چک: صندوق، وصول شده، به حساب خوابانده شده، خرج شده
}

export interface ChequeReceipt {
    id: string;
    customerName: string;    // نام مشتری
    registrationDate: string;// تاریخ ثبت رسید (شمسی)
    totalAmount: number;     // جمع کل مبالغ چک‌ها به ریال
    serialNumber: string;    // پشت نمره (شناسه پیگیری متوالی)
    company?: string;        // نام شرکت
    attachedFile?: {
        name: string;
        url: string;
    };
    cheques: ChequeItem[];
    status?: 'draft' | 'pending_sales' | 'pending_ceo' | 'approved' | 'archived';
    salesManagerApprovedBy?: string;
    salesManagerApprovedAt?: number;
    ceoApprovedBy?: string;
    ceoApprovedAt?: number;
    archivedBy?: string;
    archivedAt?: number;
    createdAt: number;
    createdBy: string;
}



