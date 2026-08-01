import React, { useState, useEffect, useRef } from "react";
import {
  getSettings,
  saveSettings,
  uploadFile,
  getSecretariatSettings,
  saveSecretariatSettings,
  getSecretariatTemplates,
  saveSecretariatTemplate,
  deleteSecretariatTemplate,
  importDocx,
} from "../services/storageService";
import {
  SystemSettings,
  Company,
  Contact,
  CompanyBank,
  User,
  PrintTemplate,
  SecretariatCompanySettings,
  SecretariatTemplate,
} from "../types";
import {
  Settings as SettingsIcon,
  Save,
  Loader2,
  Database,
  Bell,
  Plus,
  Trash2,
  Building,
  ShieldCheck,
  Landmark,
  AppWindow,
  BellRing,
  BellOff,
  Send,
  Image as ImageIcon,
  Pencil,
  X,
  Check,
  MessageCircle,
  RefreshCw,
  Users,
  User as UserIcon,
  FolderSync,
  Smartphone,
  Link,
  Truck,
  DownloadCloud,
  UploadCloud,
  Warehouse,
  FileText,
  Container,
  LayoutTemplate,
  WifiOff,
  Info,
  RefreshCcw,
  FileClock,
  Power,
  Cpu,
  Zap,
  Layers,
  Globe,
  ClipboardList,
  Lock,
  Camera,
  Bot,
} from "lucide-react";
import { apiCall } from "../services/apiService";
import { Capacitor } from "@capacitor/core";
import {
  requestNotificationPermission,
  setNotificationPreference,
  isNotificationEnabledInApp,
} from "../services/notificationService";
import { getUsers } from "../services/authService";
import { generateUUID } from "../constants";
import PrintTemplateDesigner from "./PrintTemplateDesigner";
import { FiscalYearManager } from "./FiscalModule";
import SecondExitGroupSettings from "./settings/SecondExitGroupSettings";
import RolePermissionsEditor from "./settings/RolePermissionsEditor";
import BackupManager from "./settings/BackupManager";
import BotManager from "./settings/BotManager";

// Internal QRCode Component with Error Handling
const QRCode = ({ value, size }: { value: string; size: number }) => {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center text-gray-400 text-xs border-2 border-dashed border-gray-300 rounded-lg p-2"
        style={{ width: size, height: size }}
      >
        <WifiOff size={24} className="mb-2" />
        <span className="text-center">امکان نمایش QR وجود ندارد (آفلاین)</span>
      </div>
    );
  }

  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`}
      alt="QR Code"
      width={size}
      height={size}
      className="mix-blend-multiply"
      onError={() => setError(true)}
    />
  );
};

interface SettingsProps {
  financialYear?: string;
  settings?: SystemSettings;
  onUpdateSettings?: (s: SystemSettings) => void;
}

const Settings: React.FC<SettingsProps> = ({
  financialYear,
  settings: propSettings,
  onUpdateSettings,
}) => {
  const [activeCategory, setActiveCategory] = useState<
    | "system"
    | "fiscal"
    | "data"
    | "integrations"
    | "whatsapp"
    | "permissions"
    | "warehouse"
    | "commerce"
    | "templates"
    | "bot"
    | "meetings"
    | "secretariat"
    | "camera"
  >("system");

  // --- Secretariat Settings State ---
  const [secConfigs, setSecConfigs] = useState<SecretariatCompanySettings[]>(
    [],
  );
  const [selectedCompanyIdForSec, setSelectedCompanyIdForSec] =
    useState<string>("");
  const [secSettingsForm, setSecSettingsForm] =
    useState<SecretariatCompanySettings>({
      companyId: "",
      headquartersAccessTokens: [],
      factoryAccessTokens: [],
      letterheadUrl: "",
      meetingMinutesTemplate: "",
      companyStampUrl: "",
      companyStampSize: 112,
      companyStampOpacity: 70,
      hideAutoFooter: false,
      letterheadFontFamily: "Vazirmatn",
      metadataTop: 25,
      metadataLeft: 20,
      metadataFontSize: 11,
      metadataOpacity: 100,
      metadataFontWeight: "bold",
    });
  const [isUploadingSecLetterhead, setIsUploadingSecLetterhead] =
    useState(false);
  const [isUploadingSecStamp, setIsUploadingSecStamp] = useState(false);
  const secLetterheadInputRef = useRef<HTMLInputElement>(null);
  const secStampInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingSecWordLetterhead, setIsUploadingSecWordLetterhead] =
    useState(false);
  const secWordLetterheadInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingSecPdfLetterhead, setIsUploadingSecPdfLetterhead] =
    useState(false);
  const secPdfLetterheadInputRef = useRef<HTMLInputElement>(null);

  // Secretariat Templates State
  const [secTemplates, setSecTemplates] = useState<SecretariatTemplate[]>([]);
  const [editingSecTemplate, setEditingSecTemplate] =
    useState<Partial<SecretariatTemplate> | null>(null);
  const [importingDocxFile, setImportingDocxFile] = useState(false);
  const docxImportInputRef = useRef<HTMLInputElement>(null);

  const hasInitializedRef = useRef(false);

  const [settings, setSettings] = useState<SystemSettings>({
    appName: "سیستم من",
    currentTrackingNumber: 1000,
    currentExitPermitNumber: 1000,
    currentChequeReceiptNumber: 1000,
    chequeArchiveCutoffDate: "",
    companyNames: [],
    companies: [],
    defaultCompany: "",
    bankNames: [],
    operatingBankNames: [],
    commodityGroups: [],
    rolePermissions: {},
    customRoles: [],
    savedContacts: [],
    pwaIcon: "",
    telegramBotToken: "",
    telegramAdminId: "",
    baleBotToken: "",
    smsApiKey: "",
    smsSenderNumber: "",
    googleCalendarId: "",
    whatsappNumber: "",
    sayanApiUrl: "http://192.168.41.225:3000/api/external/v1",
    sayanApiKey: "s_gate_live_urp2vvxzpik4",
    geminiApiKey: "",
    warehouseSequences: {},
    companyNotifications: {},
    defaultWarehouseGroup: "",
    defaultSalesManager: "",
    insuranceCompanies: [],
    exitPermitNotificationGroup: "",
    printTemplates: [],
    fiscalYears: [],
    botAccountingGroupIdTele: "",
    botAccountingGroupIdBale: "",
    botAccountingGroupIdWhatsApp: "",
    purchaseRolePermissions: {},
  });

  const [sendingManualSalesToday, setSendingManualSalesToday] = useState(false);
  const [sendingManualSalesYesterday, setSendingManualSalesYesterday] = useState(false);

  const handleSendManualSales = async (targetDate: 'today' | 'yesterday') => {
    if (targetDate === 'today') {
      setSendingManualSalesToday(true);
    } else {
      setSendingManualSalesYesterday(true);
    }

    try {
      const response = await fetch('/api/sayan/sales-report/send-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetDate })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        alert(`✅ ${data.message}`);
      } else {
        alert(`❌ خطا در ارسال گزارش: ${data.error || 'پاسخ ناموفق از سرور'}`);
      }
    } catch (e: any) {
      alert(`❌ خطا در برقراری ارتباط با سرور: ${e.message || e}`);
    } finally {
      if (targetDate === 'today') {
        setSendingManualSalesToday(false);
      } else {
        setSendingManualSalesYesterday(false);
      }
    }
  };

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [tempServerHost, setTempServerHost] = useState(
    localStorage.getItem("app_server_host") || "",
  );

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      // Use the temp host value if it exists, otherwise it falls back to current runtime BASE_URL
      const hostToTest = tempServerHost.trim().replace(/\/$/, "");
      const originalHost = localStorage.getItem("app_server_host");

      if (hostToTest) localStorage.setItem("app_server_host", hostToTest);

      const result = await apiCall<{ status: string }>("/users");
      if (result) {
        alert("✅ اتصال با موفقیت برقرار شد. سرور پاسخگو است.");
        if (hostToTest) localStorage.setItem("app_server_host", hostToTest);
      } else {
        throw new Error("No data returned");
      }
    } catch (e: any) {
      alert(`❌ خطا در اتصال: ${e.message || "سرور یافت نشد"}`);
      // Revert if it failed and we changed it
      // localStorage.removeItem('app_server_host');
    } finally {
      setTestingConnection(false);
    }
  };

  // Designer State
  const [showDesigner, setShowDesigner] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PrintTemplate | null>(
    null,
  );

  // --- CAMERA SETTINGS STATES ---
  const [localCameras, setLocalCameras] = useState<MediaDeviceInfo[]>([]);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState<boolean | null>(null);
  const [defaultCameraId, setDefaultCameraId] = useState<string>(() => localStorage.getItem("defaultCameraDeviceId") || "");
  const [cameraResolution, setCameraResolution] = useState<string>(() => localStorage.getItem("cameraResolution") || "720p");
  const [cameraMirror, setCameraMirror] = useState<boolean>(() => localStorage.getItem("cameraMirror") === "true");
  const [cameraBeepOnSuccess, setCameraBeepOnSuccess] = useState<boolean>(() => localStorage.getItem("cameraBeepOnSuccess") !== "false");
  const [cameraAutoStart, setCameraAutoStart] = useState<boolean>(() => localStorage.getItem("cameraAutoStart") === "true");
  const [cameraType, setCameraType] = useState<"usb" | "network">((localStorage.getItem("cameraType") as "usb" | "network") || "usb");
  const [cameraNetworkUrl, setCameraNetworkUrl] = useState<string>(() => localStorage.getItem("cameraNetworkUrl") || "");
  const [cameraNetworkType, setCameraNetworkType] = useState<"mjpeg" | "snapshot">((localStorage.getItem("cameraNetworkType") as "mjpeg" | "snapshot") || "mjpeg");
  const [cameraSnapshotInterval, setCameraSnapshotInterval] = useState<number>(() => parseInt(localStorage.getItem("cameraSnapshotInterval") || "1000", 10));
  const [cameraNetworkUsername, setCameraNetworkUsername] = useState<string>(() => localStorage.getItem("cameraNetworkUsername") || "");
  const [cameraNetworkPassword, setCameraNetworkPassword] = useState<string>(() => localStorage.getItem("cameraNetworkPassword") || "");
  const [liveSnapshotBase64, setLiveSnapshotBase64] = useState<string | null>(null);
  const [isLiveFetching, setIsLiveFetching] = useState(false);
  const [snapshotTime, setSnapshotTime] = useState<number>(Date.now());
  const [testStream, setTestStream] = useState<MediaStream | null>(null);
  const [isTestingCamera, setIsTestingCamera] = useState(false);
  const testVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let active = true;
    let timer: any = null;

    const fetchLiveSnapshot = async () => {
      if (!isTestingCamera || cameraType !== "network") return;
      if (isLiveFetching) return;
      setIsLiveFetching(true);
      try {
        const response = await fetch('/api/security/proxy-snapshot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url: cameraNetworkUrl,
            username: cameraNetworkUsername,
            password: cameraNetworkPassword
          })
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && active) {
            setLiveSnapshotBase64(data.imageBase64);
          }
        }
      } catch (err) {
        console.error("Live test snapshot proxy error:", err);
      } finally {
        setIsLiveFetching(false);
      }
    };

    if (isTestingCamera && cameraType === "network") {
      fetchLiveSnapshot();
      timer = setInterval(() => {
        fetchLiveSnapshot();
        setSnapshotTime(Date.now());
      }, cameraSnapshotInterval || 1000);
    } else {
      setLiveSnapshotBase64(null);
    }

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [isTestingCamera, cameraType, cameraNetworkUrl, cameraSnapshotInterval, cameraNetworkUsername, cameraNetworkPassword]);

  const requestCameraPermissionAndList = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setCameraPermissionGranted(true);
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === "videoinput");
      setLocalCameras(videoDevices);
      
      if (videoDevices.length > 0 && !defaultCameraId) {
        setDefaultCameraId(videoDevices[videoDevices.length - 1].deviceId);
      }
    } catch (err) {
      console.error("Camera permissions failed:", err);
      setCameraPermissionGranted(false);
    }
  };

  const startTestCamera = async () => {
    try {
      if (testStream) {
        testStream.getTracks().forEach(t => t.stop());
      }
      
      if (cameraType === "network") {
        if (!cameraNetworkUrl || !cameraNetworkUrl.startsWith("http")) {
          alert("لطفاً آدرس صحیح جریان دوربین تحت شبکه (با شروع http) را وارد کنید.");
          return;
        }
        setIsTestingCamera(true);
        return;
      }

      let width = 1280;
      let height = 720;
      if (cameraResolution === "1080p") {
        width = 1920;
        height = 1080;
      } else if (cameraResolution === "480p") {
        width = 854;
        height = 480;
      }
        
      const constraints = {
        video: defaultCameraId 
          ? { deviceId: { exact: defaultCameraId }, width: { ideal: width }, height: { ideal: height } } 
          : { width: { ideal: width }, height: { ideal: height } }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setTestStream(stream);
      setIsTestingCamera(true);
      setTimeout(() => {
        if (testVideoRef.current) {
          testVideoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (e) {
      console.error("Test camera failed:", e);
      alert("امکان شروع تست دوربین وجود ندارد. مجوز دسترسی و اتصالات سخت‌افزاری را بررسی کنید.");
    }
  };
  
  const stopTestCamera = () => {
    if (testStream) {
      testStream.getTracks().forEach(t => t.stop());
      setTestStream(null);
    }
    setIsTestingCamera(false);
    if (testVideoRef.current) {
      testVideoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (activeCategory === "camera") {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const videoDevices = devices.filter(device => device.kind === "videoinput");
        const hasLabels = videoDevices.some(d => !!d.label);
        
        if (videoDevices.length > 0) {
          setLocalCameras(videoDevices);
          if (hasLabels) {
            setCameraPermissionGranted(true);
          }
        }
      }).catch(err => {
        console.error("Error enumerating devices:", err);
      });
    } else {
      // Stop test camera if leaving tab
      if (testStream) {
        testStream.getTracks().forEach(t => t.stop());
        setTestStream(null);
      }
      setIsTestingCamera(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    return () => {
      if (testStream) {
        testStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [testStream]);

  // Local States for Form Inputs
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyLogo, setNewCompanyLogo] = useState("");
  const [newCompanyShowInWarehouse, setNewCompanyShowInWarehouse] =
    useState(true);
  const [newCompanyBanks, setNewCompanyBanks] = useState<CompanyBank[]>([]);
  const [newCompanyLetterhead, setNewCompanyLetterhead] = useState("");

  // New Company Fields
  const [newCompanyRegNum, setNewCompanyRegNum] = useState("");
  const [newCompanyNatId, setNewCompanyNatId] = useState("");
  const [newCompanyAddress, setNewCompanyAddress] = useState("");
  const [newCompanyPhone, setNewCompanyPhone] = useState("");
  const [newCompanyFax, setNewCompanyFax] = useState("");
  const [newCompanyPostalCode, setNewCompanyPostalCode] = useState("");
  const [newCompanyEcoCode, setNewCompanyEcoCode] = useState("");

  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);

  // Local states for adding/editing banks
  const [tempBankName, setTempBankName] = useState("");
  const [tempAccountNum, setTempAccountNum] = useState("");
  const [tempBankSheba, setTempBankSheba] = useState("");
  const [tempBankLayout, setTempBankLayout] = useState<string>("");
  const [tempInternalLayout, setTempInternalLayout] = useState<string>("");
  const [tempInternalWithdrawalLayout, setTempInternalWithdrawalLayout] =
    useState<string>("");
  const [tempInternalDepositLayout, setTempInternalDepositLayout] =
    useState<string>("");
  const [tempDualPrint, setTempDualPrint] = useState(false);

  // Commerce Local States
  const [newInsuranceCompany, setNewInsuranceCompany] = useState("");

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingLetterhead, setIsUploadingLetterhead] = useState(false);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);
  const companyLetterheadInputRef = useRef<HTMLInputElement>(null);

  const [whatsappStatus, setWhatsappStatus] = useState<{
    ready: boolean;
    qr: string | null;
    user: string | null;
  } | null>(null);
  const [refreshingWA, setRefreshingWA] = useState(false);
  const [restartingWA, setRestartingWA] = useState(false);

  // Contact States
  const [contactName, setContactName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [contactBaleId, setContactBaleId] = useState("");
  const [contactTelegramId, setContactTelegramId] = useState("");
  const [isGroupContact, setIsGroupContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);

  const [fetchingGroups, setFetchingGroups] = useState(false);
  const [newOperatingBank, setNewOperatingBank] = useState("");
  const [newCommodity, setNewCommodity] = useState("");
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const isSecure = window.isSecureContext;

  // App Users for various settings
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [appContacts, setAppContacts] = useState<Contact[]>([]);

  // Current User Permissions
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem("app_current_user");
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
  }, []);

  const isAdmin = currentUser?.role === "ADMIN";
  const hasFullSettings =
    isAdmin ||
    (currentUser &&
      settings?.rolePermissions?.[currentUser.role]?.canManageSettings);
  const canManageTradeSettings =
    isAdmin ||
    hasFullSettings ||
    (currentUser &&
      settings?.rolePermissions?.[currentUser.role]?.canManageTradeSettings);

  useEffect(() => {
    // Force navigation to trade if they ONLY have trade settings
    if (
      !hasFullSettings &&
      canManageTradeSettings &&
      activeCategory !== "commerce"
    ) {
      setActiveCategory("commerce");
    }
  }, [hasFullSettings, canManageTradeSettings, activeCategory]);

  useEffect(() => {
    if (propSettings) {
      if (!hasInitializedRef.current) {
        // Normalize salesNotificationUsers if it's the old format (string[])
        const normalizedSettings = { ...propSettings };
        if (Array.isArray(normalizedSettings.salesNotificationUsers)) {
          normalizedSettings.salesNotificationUsers =
            normalizedSettings.salesNotificationUsers.map((u: any) => {
              if (typeof u === "string") {
                return { username: u, platforms: ["telegram", "bale"] };
              }
              return u;
            });
        }
        
        // Ensure companies and companyNames arrays exist and are in sync
        const companyMap = new Map<string, any>();
        (normalizedSettings.companies || []).forEach((c: any) => {
          if (c && c.name && c.name.trim()) {
            companyMap.set(c.name.trim(), {
              ...c,
              name: c.name.trim(),
              banks: Array.isArray(c.banks) ? c.banks : []
            });
          }
        });
        (normalizedSettings.companyNames || []).forEach((name: string) => {
          if (name && name.trim() && !companyMap.has(name.trim())) {
            companyMap.set(name.trim(), { id: generateUUID(), name: name.trim(), showInWarehouse: true, banks: [] });
          }
        });
        if (Array.isArray(normalizedSettings.fiscalYears)) {
          normalizedSettings.fiscalYears.forEach((fy: any) => {
            if (fy && fy.companySequences) {
              Object.keys(fy.companySequences).forEach((k: string) => {
                if (k && k.trim() && !companyMap.has(k.trim())) {
                  companyMap.set(k.trim(), { id: generateUUID(), name: k.trim(), showInWarehouse: true, banks: [] });
                }
              });
            }
          });
        }
        let normCompanies = Array.from(companyMap.values());
        normCompanies = normCompanies.filter(c => 
          c.name !== 'شرکت اصلی' || 
          c.logo || 
          c.registrationNumber || 
          c.nationalId || 
          c.address || 
          c.economicCode || 
          (c.banks && c.banks.length > 0)
        );
        normalizedSettings.companies = normCompanies;
        normalizedSettings.companyNames = normCompanies.map((c: any) => c.name);
        if (!Array.isArray(normalizedSettings.fiscalYears) || normalizedSettings.fiscalYears.length === 0) {
          normalizedSettings.fiscalYears = [
            { id: "fy_1402", label: "1402", isClosed: false, createdAt: Date.now() },
            { id: "fy_1403", label: "1403", isClosed: false, createdAt: Date.now() },
            { id: "fy_1404", label: "1404", isClosed: false, createdAt: Date.now() },
            { id: "fy_1405", label: "1405", isClosed: false, createdAt: Date.now() },
          ];
          normalizedSettings.activeFiscalYearId = "fy_1404";
        }

        setSettings(normalizedSettings);
        hasInitializedRef.current = true;
      }
      loadSettings();
    } else {
      loadSettings();
    }
    setNotificationsEnabled(isNotificationEnabledInApp());
    checkWhatsappStatus();
    loadSystemUsers();
  }, [propSettings]);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      let safeData = { ...data };
      // Ensure arrays exist
      safeData.currentExitPermitNumber =
        safeData.currentExitPermitNumber || 1000;
      safeData.companies = safeData.companies || [];
      safeData.operatingBankNames = safeData.operatingBankNames || [];
      safeData.insuranceCompanies = safeData.insuranceCompanies || [];
      const companyMap = new Map<string, any>();
      (safeData.companies || []).forEach((c: any) => {
        if (c && c.name && c.name.trim()) {
          companyMap.set(c.name.trim(), {
            ...c,
            name: c.name.trim(),
            banks: Array.isArray(c.banks) ? c.banks : []
          });
        }
      });
      (safeData.companyNames || []).forEach((name: string) => {
        if (name && name.trim() && !companyMap.has(name.trim())) {
          companyMap.set(name.trim(), { id: generateUUID(), name: name.trim(), showInWarehouse: true, banks: [] });
        }
      });
      if (Array.isArray(safeData.fiscalYears)) {
        safeData.fiscalYears.forEach((fy: any) => {
          if (fy && fy.companySequences) {
            Object.keys(fy.companySequences).forEach((k: string) => {
              if (k && k.trim() && !companyMap.has(k.trim())) {
                companyMap.set(k.trim(), { id: generateUUID(), name: k.trim(), showInWarehouse: true, banks: [] });
              }
            });
          }
        });
      }
      let loadedCompanies = Array.from(companyMap.values());
      loadedCompanies = loadedCompanies.filter(c => 
        c.name !== 'شرکت اصلی' || 
        c.logo || 
        c.registrationNumber || 
        c.nationalId || 
        c.address || 
        c.economicCode || 
        (c.banks && c.banks.length > 0)
      );
      safeData.companies = loadedCompanies;
      safeData.companyNames = loadedCompanies.map((c: any) => c.name);

      const allBanksSet = new Set<string>();
      (safeData.operatingBankNames || []).forEach((b: string) => { if (b && typeof b === 'string' && b.trim()) allBanksSet.add(b.trim()); });
      (safeData.bankNames || []).forEach((b: string) => { if (b && typeof b === 'string' && b.trim()) allBanksSet.add(b.trim()); });
      if (safeData.companyBank && typeof safeData.companyBank === 'string' && safeData.companyBank.trim()) {
        allBanksSet.add(safeData.companyBank.trim());
      }
      loadedCompanies.forEach((c: any) => {
        if (Array.isArray(c.banks)) {
          c.banks.forEach((b: any) => {
            if (b) {
              const bName = typeof b === 'string' ? b : (b.bankName || '');
              if (bName && bName.trim()) allBanksSet.add(bName.trim());
            }
          });
        }
      });
      safeData.operatingBankNames = Array.from(allBanksSet);
      safeData.bankNames = Array.from(allBanksSet);

      if (!safeData.warehouseSequences) safeData.warehouseSequences = {};
      if (!safeData.companyNotifications) safeData.companyNotifications = {};
      if (!safeData.customRoles) safeData.customRoles = [];
      if (!safeData.printTemplates) safeData.printTemplates = [];
      if (!Array.isArray(safeData.fiscalYears) || safeData.fiscalYears.length === 0) {
        safeData.fiscalYears = [
          { id: "fy_1402", label: "1402", isClosed: false, createdAt: Date.now() },
          { id: "fy_1403", label: "1403", isClosed: false, createdAt: Date.now() },
          { id: "fy_1404", label: "1404", isClosed: false, createdAt: Date.now() },
          { id: "fy_1405", label: "1405", isClosed: false, createdAt: Date.now() },
        ];
        safeData.activeFiscalYearId = "fy_1404";
      }
      if (!safeData.rolePermissions) safeData.rolePermissions = {}; // Ensure defined

      setSettings(safeData);
    } catch (e) {
      console.error("Failed to load settings");
    }
  };

  const loadSystemUsers = async () => {
    try {
      const users = await getUsers();
      setSystemUsers(users);

      const contacts = users
        .filter((u) => u.phoneNumber)
        .map((u) => ({
          id: u.id,
          name: `(کاربر) ${u.fullName}`,
          number: u.phoneNumber!,
          isGroup: false,
          baleId: u.baleChatId,
        }));
      setAppContacts(contacts);
    } catch (e) {
      console.error("Failed to load users");
    }
  };

  // Secretariat Settings fetch & sync
  useEffect(() => {
    const fetchSecConfigs = async () => {
      try {
        const [configs, templates] = await Promise.all([
          getSecretariatSettings(),
          getSecretariatTemplates(),
        ]);
        setSecConfigs(configs);
        setSecTemplates(templates);
        if (
          settings.companies &&
          settings.companies.length > 0 &&
          !selectedCompanyIdForSec
        ) {
          setSelectedCompanyIdForSec(settings.companies[0].id);
        }
      } catch (err) {
        console.error("Failed to load secretariat configs:", err);
      }
    };
    if (
      activeCategory === "secretariat" ||
      (settings.companies && settings.companies.length > 0)
    ) {
      fetchSecConfigs();
    }
  }, [activeCategory, settings.companies]);

  useEffect(() => {
    if (!selectedCompanyIdForSec) return;
    const existing = secConfigs.find(
      (c) => c.companyId === selectedCompanyIdForSec,
    );
    if (existing) {
      setSecSettingsForm({
        companyId: selectedCompanyIdForSec,
        headquartersAccessTokens: existing.headquartersAccessTokens || [],
        factoryAccessTokens: existing.factoryAccessTokens || [],
        letterheadUrl: existing.letterheadUrl || "",
        meetingMinutesTemplate: existing.meetingMinutesTemplate || "",
        companyStampUrl: existing.companyStampUrl || "",
        companyStampSize: existing.companyStampSize || 112,
        companyStampOpacity: existing.companyStampOpacity || 70,
        hideAutoFooter: existing.hideAutoFooter || false,
        letterheadFontFamily: existing.letterheadFontFamily || "Vazirmatn",
        metadataTop: existing.metadataTop ?? 25,
        metadataLeft: existing.metadataLeft ?? 20,
        metadataFontSize: existing.metadataFontSize ?? 11,
        metadataOpacity: existing.metadataOpacity ?? 100,
        metadataFontWeight: existing.metadataFontWeight || "bold",
      });
    } else {
      setSecSettingsForm({
        companyId: selectedCompanyIdForSec,
        headquartersAccessTokens: [],
        factoryAccessTokens: [],
        letterheadUrl: "",
        meetingMinutesTemplate: "",
        companyStampUrl: "",
        companyStampSize: 112,
        companyStampOpacity: 70,
        hideAutoFooter: false,
        letterheadFontFamily: "Vazirmatn",
        metadataTop: 25,
        metadataLeft: 20,
        metadataFontSize: 11,
        metadataOpacity: 100,
        metadataFontWeight: "bold",
      });
    }
  }, [selectedCompanyIdForSec, secConfigs]);

  const checkWhatsappStatus = async () => {
    setRefreshingWA(true);
    try {
      const status = await apiCall<{
        ready: boolean;
        qr: string | null;
        user: string | null;
      }>("/whatsapp/status");
      setWhatsappStatus(status);
    } catch (e) {
      console.error("Failed to check WA status");
    } finally {
      setRefreshingWA(false);
    }
  };

  const handleWhatsappLogout = async () => {
    if (!confirm("آیا مطمئن هستید؟")) return;
    try {
      await apiCall("/whatsapp/logout", "POST");
      setTimeout(checkWhatsappStatus, 2000);
    } catch (e) {
      alert("خطا");
    }
  };

  // FORCE RESTART HANDLER
  const handleWhatsappRestart = async () => {
    if (
      !confirm(
        "آیا می‌خواهید سرویس واتساپ را بازنشانی کنید؟ این کار اتصال فعلی را قطع و یک QR کد جدید تولید می‌کند.",
      )
    )
      return;
    setRestartingWA(true);
    try {
      await apiCall("/whatsapp/restart", "POST");
      alert(
        "درخواست بازنشانی ارسال شد. لطفاً چند لحظه صبر کنید تا QR کد جدید ظاهر شود.",
      );
      // Poll immediately
      setTimeout(checkWhatsappStatus, 3000);
    } catch (e) {
      alert("خطا در بازنشانی سرویس");
    } finally {
      setRestartingWA(false);
    }
  };

  const handleFetchGroups = async () => {
    if (!whatsappStatus?.ready) {
      alert("واتساپ متصل نیست.");
      return;
    }
    setFetchingGroups(true);
    try {
      const response = await apiCall<{
        success: boolean;
        groups: { id: string; name: string }[];
      }>("/whatsapp/groups");
      if (response.success && response.groups) {
        const existingIds = new Set(
          (settings.savedContacts || []).map((c) => c.number),
        );
        const newGroups = response.groups
          .filter((g) => !existingIds.has(g.id))
          .map((g) => ({
            id: generateUUID(),
            name: g.name,
            number: g.id,
            isGroup: true,
          }));
        if (newGroups.length > 0) {
          setSettings({
            ...settings,
            savedContacts: [...(settings.savedContacts || []), ...newGroups],
          });
          alert(`${newGroups.length} گروه اضافه شد.`);
        } else alert("گروه جدیدی یافت نشد.");
      }
    } catch (e) {
      alert("خطا در دریافت.");
    } finally {
      setFetchingGroups(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (
      activeCategory === "whatsapp" &&
      whatsappStatus &&
      !whatsappStatus.ready
    ) {
      interval = setInterval(checkWhatsappStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [activeCategory, whatsappStatus]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let currentCompanies = [...(settings.companies || [])];

      if (
        activeCategory === "data" &&
        (newCompanyName.trim() || editingCompanyId)
      ) {
        if (editingCompanyId) {
          currentCompanies = currentCompanies.map((c) =>
            c.id === editingCompanyId
              ? {
                  ...c,
                  name: newCompanyName.trim(),
                  logo: newCompanyLogo,
                  showInWarehouse: newCompanyShowInWarehouse,
                  banks: newCompanyBanks,
                  letterhead: newCompanyLetterhead,
                  registrationNumber: newCompanyRegNum,
                  nationalId: newCompanyNatId,
                  address: newCompanyAddress,
                  phone: newCompanyPhone,
                  fax: newCompanyFax,
                  postalCode: newCompanyPostalCode,
                  economicCode: newCompanyEcoCode,
                }
              : c,
          );
        } else if (newCompanyName.trim()) {
          currentCompanies = [
            ...currentCompanies,
            {
              id: generateUUID(),
              name: newCompanyName.trim(),
              logo: newCompanyLogo,
              showInWarehouse: newCompanyShowInWarehouse,
              banks: newCompanyBanks,
              letterhead: newCompanyLetterhead,
              registrationNumber: newCompanyRegNum,
              nationalId: newCompanyNatId,
              address: newCompanyAddress,
              phone: newCompanyPhone,
              fax: newCompanyFax,
              postalCode: newCompanyPostalCode,
              economicCode: newCompanyEcoCode,
            },
          ];
        }
        resetCompanyForm();
      }

      const syncedSettings = {
        ...settings,
        companies: currentCompanies,
        companyNames: currentCompanies.map((c) => c.name),
        // Ensure legacy mapping for notification group
        exitPermitNotificationGroup: settings.defaultWarehouseGroup,
        botAccountingGroupIdTele: settings.botAccountingGroupIdTele,
        botAccountingGroupIdBale: settings.botAccountingGroupIdBale,
        botAccountingGroupIdWhatsApp: settings.botAccountingGroupIdWhatsApp,
      };

      await saveSettings(syncedSettings);
      setSettings(syncedSettings);
      
      // Save camera settings to localStorage
      localStorage.setItem("defaultCameraDeviceId", defaultCameraId);
      localStorage.setItem("cameraResolution", cameraResolution);
      localStorage.setItem("cameraMirror", String(cameraMirror));
      localStorage.setItem("cameraBeepOnSuccess", String(cameraBeepOnSuccess));
      localStorage.setItem("cameraAutoStart", String(cameraAutoStart));
      localStorage.setItem("cameraType", cameraType);
      localStorage.setItem("cameraNetworkUrl", cameraNetworkUrl);
      localStorage.setItem("cameraNetworkType", cameraNetworkType);
      localStorage.setItem("cameraSnapshotInterval", String(cameraSnapshotInterval));
      localStorage.setItem("cameraNetworkUsername", cameraNetworkUsername);
      localStorage.setItem("cameraNetworkPassword", cameraNetworkPassword);

      if (onUpdateSettings) onUpdateSettings(syncedSettings);
      setMessage("ذخیره شد ✅");
      setTimeout(() => setMessage(""), 3000);
    } catch (e) {
      setMessage("خطا ❌");
    } finally {
      setLoading(false);
    }
  };

  // ... (Keep existing contact handlers) ...
  const handleAddOrUpdateContact = () => {
    if (!contactName.trim() || !contactNumber.trim()) return;

    const newContactData: Contact = {
      id: editingContactId || generateUUID(),
      name: contactName.trim(),
      number: contactNumber.trim(),
      baleId: contactBaleId.trim(),
      telegramId: contactTelegramId.trim(),
      isGroup: isGroupContact,
    };

    let updatedContacts;
    if (editingContactId) {
      updatedContacts = (settings.savedContacts || []).map((c) =>
        c.id === editingContactId ? newContactData : c,
      );
    } else {
      updatedContacts = [...(settings.savedContacts || []), newContactData];
    }

    setSettings({ ...settings, savedContacts: updatedContacts });
    resetContactForm();
  };

  const handleEditContact = (c: Contact) => {
    setEditingContactId(c.id);
    setContactName(c.name);
    setContactNumber(c.number);
    setContactBaleId(c.baleId || "");
    setContactTelegramId(c.telegramId || "");
    setIsGroupContact(c.isGroup);
  };

  const handleDeleteContact = (id: string) => {
    if (confirm("حذف شود؟")) {
      setSettings({
        ...settings,
        savedContacts: (settings.savedContacts || []).filter(
          (c) => c.id !== id,
        ),
      });
      if (editingContactId === id) resetContactForm();
    }
  };

  const resetContactForm = () => {
    setContactName("");
    setContactNumber("");
    setContactBaleId("");
    setContactTelegramId("");
    setIsGroupContact(false);
    setEditingContactId(null);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const result = await uploadFile(file.name, ev.target?.result as string);
        setNewCompanyLogo(result.url);
      } catch (error) {
        alert("خطا در آپلود");
      } finally {
        setIsUploadingLogo(false);
      }
    };
    reader.readAsDataURL(file);
  };
  const handleLetterheadUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingLetterhead(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const result = await uploadFile(file.name, ev.target?.result as string);
        setNewCompanyLetterhead(result.url);
      } catch (error) {
        alert("خطا در آپلود");
      } finally {
        setIsUploadingLetterhead(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSecLetterheadUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingSecLetterhead(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const result = await uploadFile(file.name, ev.target?.result as string);
        setSecSettingsForm((prev) => ({ ...prev, letterheadUrl: result.url }));
        alert("تصویر سربرگ با موفقیت آپلود شد.");
      } catch (error) {
        alert("خطا در آپلود سربرگ");
      } finally {
        setIsUploadingSecLetterhead(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSecStampUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingSecStamp(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const result = await uploadFile(file.name, ev.target?.result as string);
        setSecSettingsForm((prev) => ({
          ...prev,
          companyStampUrl: result.url,
        }));
        alert("تصویر مهر با موفقیت آپلود شد.");
      } catch (error) {
        alert("خطا در آپلود مهر");
      } finally {
        setIsUploadingSecStamp(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSecWordLetterheadUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingSecWordLetterhead(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const result = await uploadFile(file.name, ev.target?.result as string);
        setSecSettingsForm((prev) => ({
          ...prev,
          wordLetterheadUrl: result.url,
        }));
        alert("فایل سربرگ ورد با موفقیت آپلود شد.");
      } catch (error) {
        alert("خطا در آپلود سربرگ ورد");
      } finally {
        setIsUploadingSecWordLetterhead(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSecPdfLetterheadUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingSecPdfLetterhead(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const result = await uploadFile(file.name, ev.target?.result as string);
        setSecSettingsForm((prev) => ({
          ...prev,
          pdfLetterheadUrl: result.url,
        }));
        alert("فایل سربرگ PDF با موفقیت آپلود شد.");
      } catch (error) {
        alert("خطا در آپلود سربرگ PDF");
      } finally {
        setIsUploadingSecPdfLetterhead(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSecSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyIdForSec) return;
    try {
      const updated = await saveSecretariatSettings(secSettingsForm);
      setSecConfigs(updated);
      alert("تنظیمات دبیرخانه با موفقیت ذخیره شد.");
    } catch (err) {
      alert("خطا در ذخیره تنظیمات دبیرخانه");
    }
  };

  // --- Secretariat Template Handlers ---
  const handleSaveSecTemplate = async (templateData: any) => {
    try {
      const updatedTemplates = await saveSecretariatTemplate(templateData);
      setSecTemplates(updatedTemplates);
      alert("قالب نمونه نامه با موفقیت ذخیره شد.");
      setEditingSecTemplate(null);
    } catch (err) {
      console.error(err);
      alert("خطا در ذخیره قالب نمونه نامه");
    }
  };

  const handleDeleteSecTemplate = async (id: string) => {
    if (!confirm("آیا از حذف این قالب نمونه نامه مطمئن هستید؟")) return;
    try {
      const updatedTemplates = await deleteSecretariatTemplate(id);
      setSecTemplates(updatedTemplates);
      alert("قالب نمونه نامه با موفقیت حذف شد.");
    } catch (err) {
      console.error(err);
      alert("خطا در حذف قالب نمونه نامه");
    }
  };

  const handleDocxImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportingDocxFile(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await importDocx(base64);
        if (res.success) {
          if (editingSecTemplate) {
            setEditingSecTemplate((prev) =>
              prev
                ? {
                    ...prev,
                    content: res.html,
                    title: prev.title || file.name.replace(/\.[^/.]+$/, ""),
                  }
                : null,
            );
          }
          alert("متن سند ورد با موفقیت استخراج و به ویرایشگر اضافه شد.");
        } else {
          alert(
            "خطا در تبدیل سند ورد: " +
              (res.success === false ? "قالب ناسازگار" : "خطای سیستم"),
          );
        }
      } catch (err: any) {
        console.error(err);
        alert("خطا در استخراج محتوای فایل ورد: " + err.message);
      } finally {
        setImportingDocxFile(false);
        if (e.target) e.target.value = "";
      }
    };
    reader.readAsDataURL(file);
  };

  const handleWordLetterheadUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingSecWordLetterhead(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        const res = await uploadFile(file.name, base64);
        setSecSettingsForm((prev) => ({
          ...prev,
          wordLetterheadUrl: res.url,
        }));
        alert("فایل سربرگ ورد (.docx) با موفقیت بارگذاری شد.");
      } catch (err) {
        console.error(err);
        alert("خطا در آپلود فایل سربرگ ورد");
      } finally {
        setIsUploadingSecWordLetterhead(false);
      }
    };
    reader.readAsDataURL(file);
  };
  // -------------------------------------

  const handleSaveCompany = async () => {
    if (!newCompanyName.trim()) return;
    let updatedCompanies = settings.companies || [];
    const companyData = {
      id: editingCompanyId || generateUUID(),
      name: newCompanyName.trim(),
      logo: newCompanyLogo,
      showInWarehouse: newCompanyShowInWarehouse,
      banks: newCompanyBanks,
      letterhead: newCompanyLetterhead,
      registrationNumber: newCompanyRegNum,
      nationalId: newCompanyNatId,
      address: newCompanyAddress,
      phone: newCompanyPhone,
      fax: newCompanyFax,
      postalCode: newCompanyPostalCode,
      economicCode: newCompanyEcoCode,
    };
    if (editingCompanyId) {
      updatedCompanies = updatedCompanies.map((c) =>
        c.id === editingCompanyId ? companyData : c,
      );
    } else {
      updatedCompanies = updatedCompanies.filter(c => c.name !== 'شرکت اصلی' || c.logo || c.registrationNumber);
      updatedCompanies = [...updatedCompanies, companyData];
    }
    const newSettings = {
      ...settings,
      companies: updatedCompanies,
      companyNames: updatedCompanies.map((c) => c.name),
    };
    setSettings(newSettings);
    try {
      await saveSettings(newSettings);
    } catch (err) {
      console.error("Save company settings error:", err);
    }
    resetCompanyForm();
  };
  const handleEditCompany = (c: Company) => {
    setNewCompanyName(c.name);
    setNewCompanyLogo(c.logo || "");
    setNewCompanyShowInWarehouse(c.showInWarehouse !== false);
    setNewCompanyBanks(c.banks || []);
    setNewCompanyLetterhead(c.letterhead || "");
    setNewCompanyRegNum(c.registrationNumber || "");
    setNewCompanyNatId(c.nationalId || "");
    setNewCompanyAddress(c.address || "");
    setNewCompanyPhone(c.phone || "");
    setNewCompanyFax(c.fax || "");
    setNewCompanyPostalCode(c.postalCode || "");
    setNewCompanyEcoCode(c.economicCode || "");
    setEditingCompanyId(c.id);
  };
  const resetCompanyForm = () => {
    setNewCompanyName("");
    setNewCompanyLogo("");
    setNewCompanyShowInWarehouse(true);
    setNewCompanyBanks([]);
    setNewCompanyLetterhead("");
    setNewCompanyRegNum("");
    setNewCompanyNatId("");
    setNewCompanyAddress("");
    setNewCompanyPhone("");
    setNewCompanyFax("");
    setNewCompanyPostalCode("");
    setNewCompanyEcoCode("");
    setEditingCompanyId(null);
    resetBankForm();
  };
  const resetBankForm = () => {
    setTempBankName("");
    setTempAccountNum("");
    setTempBankSheba("");
    setTempBankLayout("");
    setTempInternalLayout("");
    setTempInternalWithdrawalLayout("");
    setTempInternalDepositLayout("");
    setTempDualPrint(false);
    setEditingBankId(null);
  };
  const handleRemoveCompany = async (id: string) => {
    if (confirm("آیا از حذف این شرکت مطمئن هستید؟")) {
      const updated = (settings.companies || []).filter((c) => c.id !== id);
      const newSettings = {
        ...settings,
        companies: updated,
        companyNames: updated.map((c) => c.name),
      };
      setSettings(newSettings);
      try {
        await saveSettings(newSettings);
      } catch (err) {
        console.error("Remove company settings error:", err);
      }
    }
  };
  const addOrUpdateCompanyBank = () => {
    if (!tempBankName) return;
    const bankData: CompanyBank = {
      id: editingBankId || generateUUID(),
      bankName: tempBankName,
      accountNumber: tempAccountNum,
      sheba: tempBankSheba,
      formLayoutId: tempBankLayout,
      internalTransferTemplateId: tempInternalLayout,
      enableDualPrint: tempDualPrint,
      internalWithdrawalTemplateId: tempInternalWithdrawalLayout,
      internalDepositTemplateId: tempInternalDepositLayout,
    };
    if (editingBankId) {
      setNewCompanyBanks(
        newCompanyBanks.map((b) => (b.id === editingBankId ? bankData : b)),
      );
    } else {
      setNewCompanyBanks([...newCompanyBanks, bankData]);
    }
    resetBankForm();
  };
  const editCompanyBank = (bank: CompanyBank) => {
    setTempBankName(bank.bankName);
    setTempAccountNum(bank.accountNumber);
    setTempBankSheba(bank.sheba || "");
    setTempBankLayout(bank.formLayoutId || "");
    setTempInternalLayout(bank.internalTransferTemplateId || "");
    setTempDualPrint(bank.enableDualPrint || false);
    setTempInternalWithdrawalLayout(bank.internalWithdrawalTemplateId || "");
    setTempInternalDepositLayout(bank.internalDepositTemplateId || "");
    setEditingBankId(bank.id);
  };
  const removeCompanyBank = (id: string) => {
    setNewCompanyBanks(newCompanyBanks.filter((b) => b.id !== id));
    if (editingBankId === id) resetBankForm();
  };

  const handleAddOperatingBank = () => {
    if (
      newOperatingBank.trim() &&
      !(settings.operatingBankNames || []).includes(newOperatingBank.trim())
    ) {
      setSettings({
        ...settings,
        operatingBankNames: [
          ...(settings.operatingBankNames || []),
          newOperatingBank.trim(),
        ],
      });
      setNewOperatingBank("");
    }
  };
  const handleRemoveOperatingBank = (name: string) => {
    setSettings({
      ...settings,
      operatingBankNames: (settings.operatingBankNames || []).filter(
        (b) => b !== name,
      ),
    });
  };
  const handleAddCommodity = () => {
    if (
      newCommodity.trim() &&
      !settings.commodityGroups.includes(newCommodity.trim())
    ) {
      setSettings({
        ...settings,
        commodityGroups: [...settings.commodityGroups, newCommodity.trim()],
      });
      setNewCommodity("");
    }
  };
  const handleRemoveCommodity = (name: string) => {
    setSettings({
      ...settings,
      commodityGroups: settings.commodityGroups.filter((c) => c !== name),
    });
  };
  const handleAddInsuranceCompany = () => {
    if (
      newInsuranceCompany.trim() &&
      !(settings.insuranceCompanies || []).includes(newInsuranceCompany.trim())
    ) {
      setSettings({
        ...settings,
        insuranceCompanies: [
          ...(settings.insuranceCompanies || []),
          newInsuranceCompany.trim(),
        ],
      });
      setNewInsuranceCompany("");
    }
  };
  const handleRemoveInsuranceCompany = (name: string) => {
    setSettings({
      ...settings,
      insuranceCompanies: (settings.insuranceCompanies || []).filter(
        (c) => c !== name,
      ),
    });
  };

  const handleIconChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIcon(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const res = await uploadFile(file.name, ev.target?.result as string);
        setSettings({ ...settings, pwaIcon: res.url });
      } catch (error) {
        alert("خطا");
      } finally {
        setUploadingIcon(false);
      }
    };
    reader.readAsDataURL(file);
  };
  const handleToggleNotifications = async () => {
    if (!isSecure && window.location.hostname !== "localhost") {
      alert("برای فعال‌سازی نوتیفیکیشن نیاز به HTTPS است.");
      return;
    }
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotificationPreference(true);
      setNotificationsEnabled(true);
      alert("نوتیفیکیشن فعال شد. اتصال به سرور بروزرسانی شد.");
    } else {
      alert("دسترسی به نوتیفیکیشن مسدود است یا پشتیبانی نمی‌شود.");
    }
  };
  const handleTestNotification = async () => {
    try {
      const userStr = localStorage.getItem("app_current_user");
      const username = userStr ? JSON.parse(userStr).username : "test";
      await apiCall("/send-test-push", "POST", { username });
      alert("درخواست تست ارسال شد.");
    } catch (e: any) {
      let msg = "خطا در ارسال تست";
      if (e.message && e.message.includes("404")) {
        if (
          confirm(
            "اشتراک نوتیفیکیشن شما در سرور یافت نشد. آیا می‌خواهید مجدداً فعال‌سازی کنید؟",
          )
        ) {
          handleToggleNotifications();
          return;
        }
        msg = "اشتراک یافت نشد.";
      } else if (e.message) {
        msg += `: ${e.message}`;
      }
      alert(msg);
    }
  };
  const handleSaveTemplate = (template: PrintTemplate) => {
    const existing = settings.printTemplates || [];
    const updated = editingTemplate
      ? existing.map((t) => (t.id === template.id ? template : t))
      : [...existing, template];
    setSettings({ ...settings, printTemplates: updated });
    setShowDesigner(false);
    setEditingTemplate(null);
  };
  const handleEditTemplate = (t: PrintTemplate) => {
    setEditingTemplate(t);
    setShowDesigner(true);
  };
  const handleDeleteTemplate = (id: string) => {
    if (!confirm("حذف قالب؟")) return;
    const updated = (settings.printTemplates || []).filter((t) => t.id !== id);
    setSettings({ ...settings, printTemplates: updated });
  };

  const handleUpdateSettings = (newSettings: SystemSettings) => {
    setSettings(newSettings);
  };

  if (showDesigner) {
    return (
      <PrintTemplateDesigner
        onSave={handleSaveTemplate}
        onCancel={() => setShowDesigner(false)}
        initialTemplate={editingTemplate}
      />
    );
  }

  return (
    <div className="glass-panel rounded-2xl shadow-sm border border-gray-200/50 dark:border-white/10 overflow-hidden flex flex-col md:flex-row min-h-[600px] mb-20 animate-fade-in">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-gray-50 dark:bg-gray-900/40 text-gray-800 dark:text-gray-200 border-b md:border-b-0 md:border-l border-gray-200 p-4">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2 px-2">
          <SettingsIcon size={24} className="text-blue-600" /> تنظیمات
        </h2>
        <nav className="space-y-1">
          {hasFullSettings && (
            <>
              <button
                onClick={() => setActiveCategory("system")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === "system" ? "glass-panel shadow text-blue-700 font-bold" : "text-gray-600 hover:bg-gray-100 dark:bg-gray-800/40 text-gray-800 dark:text-gray-200"}`}
              >
                <AppWindow size={18} /> عمومی و سیستم
              </button>
              <button
                onClick={() => setActiveCategory("fiscal")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === "fiscal" ? "glass-panel shadow text-emerald-700 font-bold" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <FolderSync size={18} /> مدیریت سال مالی
              </button>
              <button
                onClick={() => setActiveCategory("data")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === "data" ? "glass-panel shadow text-indigo-700 font-bold" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <Database size={18} /> اطلاعات پایه
              </button>
              <button
                onClick={() => setActiveCategory("templates")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === "templates" ? "glass-panel shadow text-teal-700 font-bold" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <LayoutTemplate size={18} /> قالب‌های چاپ
              </button>
            </>
          )}
          {canManageTradeSettings && (
            <button
              onClick={() => setActiveCategory("commerce")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === "commerce" ? "glass-panel shadow text-rose-700 font-bold" : "text-gray-600 hover:bg-gray-100"}`}
            >
              <Container size={18} /> تنظیمات بازرگانی
            </button>
          )}
          {hasFullSettings && (
            <>
              <button
                onClick={() => setActiveCategory("warehouse")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === "warehouse" ? "glass-panel shadow text-orange-700 font-bold" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <Warehouse size={18} /> انبار
              </button>
              <button
                onClick={() => setActiveCategory("integrations")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === "integrations" ? "glass-panel shadow text-purple-700 font-bold" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <Link size={18} /> اتصالات (API)
              </button>
              <button
                onClick={() => setActiveCategory("whatsapp")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === "whatsapp" ? "glass-panel shadow text-green-700 font-bold" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <MessageCircle size={18} /> پیام‌رسان‌ها
              </button>
              <button
                onClick={() => setActiveCategory("bot")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === "bot" ? "glass-panel shadow text-sky-700 font-bold" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <Bot size={18} className="text-sky-600" /> تنظیمات ربات و گزارشات خودکار (آمار)
              </button>
              <button
                onClick={() => setActiveCategory("meetings")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === "meetings" ? "glass-panel shadow text-indigo-700 font-bold" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <FileText size={18} /> صورتجلسات
              </button>
              <button
                onClick={() => setActiveCategory("permissions")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === "permissions" ? "glass-panel shadow text-amber-700 font-bold" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <ShieldCheck size={18} /> دسترسی‌ها و نقش‌ها
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("secretariat")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === "secretariat" ? "glass-panel shadow text-purple-700 font-bold" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <FileText size={18} /> تنظیمات دبیرخانه
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("camera")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeCategory === "camera" ? "glass-panel shadow text-cyan-700 font-bold" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <Camera size={18} /> تنظیمات دوربین
              </button>
            </>
          )}
        </nav>
      </div>

      <div className="flex-1 p-6 md:p-8 overflow-y-auto h-[calc(100dvh-140px)] md:h-full pb-20">
        {activeCategory === "fiscal" ? (
          <FiscalYearManager settings={settings} onSettingsChange={(newSettings) => setSettings(newSettings)} />
        ) : (
          <form onSubmit={handleSave} className="space-y-8 max-w-4xl mx-auto">
            {activeCategory === "system" && (
              <div className="space-y-8 animate-fade-in">
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2">
                    تنظیمات ظاهری و اعلان‌ها
                  </h3>
                  <div className="space-y-4">
                    <label className="text-sm font-bold text-gray-700 block mb-1">
                      نام برنامه (جهت نصب PWA)
                    </label>
                    <input
                      type="text"
                      className="w-full border rounded-lg p-2 text-sm"
                      value={settings.appName || ""}
                      onChange={(e) =>
                        setSettings({ ...settings, appName: e.target.value })
                      }
                      placeholder="مثال: مدیریت کارخانه X"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl border border-gray-200 overflow-hidden flex items-center justify-center bg-gray-50">
                      {settings.pwaIcon ? (
                        <img
                          src={settings.pwaIcon}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="text-gray-300" />
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        ref={iconInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleIconChange}
                      />
                      <button
                        type="button"
                        onClick={() => iconInputRef.current?.click()}
                        className="text-blue-600 text-sm hover:underline font-bold"
                        disabled={uploadingIcon}
                      >
                        {uploadingIcon ? "..." : "تغییر آیکون برنامه"}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={handleToggleNotifications}
                      className={`w-full px-4 py-2 rounded-lg border flex items-center justify-center gap-2 transition-colors ${notificationsEnabled ? "bg-green-50 border-green-200 text-green-700" : "bg-gray-50 text-gray-600"}`}
                    >
                      {notificationsEnabled ? (
                        <BellRing size={18} />
                      ) : (
                        <BellOff size={18} />
                      )}
                      <span>
                        {notificationsEnabled
                          ? "نوتیفیکیشن‌ها فعال است"
                          : "فعال‌سازی نوتیفیکیشن"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleTestNotification}
                      className="w-full px-4 py-2 rounded-lg border bg-blue-50 border-blue-200 text-blue-700 flex items-center justify-center gap-2 transition-colors hover:bg-blue-100"
                    >
                      <Send size={18} /> <span>ارسال پیام تست</span>
                    </button>
                  </div>

                  {Capacitor.getPlatform() === "android" && (
                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2 text-orange-800 font-bold text-sm">
                        <Zap size={20} className="text-orange-500" />
                        <span>اجرا در پس‌زمینه (مخصوص اندروید)</span>
                      </div>
                      <p className="text-[10px] text-orange-700 leading-relaxed">
                        برای دریافت سریع و همیشگی نوتیفیکیشن‌ها (مانند واتساپ و
                        تلگرام)، باید گزینه "بهینه‌سازی باتری" را برای این
                        برنامه غیرفعال کنید. در غیر این صورت اندروید ممکن است
                        برنامه را در پس‌زمینه ببندد.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          alert(
                            "لطفا در صفحه تنظیمات که باز می‌شود، برنامه را پیدا کرده و روی 'Don't Optimize' یا 'عدم بهینه‌سازی' قرار دهید.",
                          );
                          // Ideally use a plugin here, but as a fallback we explain to user
                          // We can also try to open app info where battery settings usually reside
                          if (Capacitor.isNativePlatform()) {
                            // This is a common way to open app settings which has battery options
                            (window as any).location = "app-settings:";
                          }
                        }}
                        className="w-full bg-white border border-orange-200 text-orange-700 py-2 rounded-xl text-xs font-bold hover:bg-orange-100 transition-colors"
                      >
                        باز کردن تنظیمات بهینه‌سازی باتری
                      </button>
                    </div>
                  )}
                  <div className="space-y-4 pt-4 border-t">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <WifiOff size={20} /> تنظیمات اتصال به سرور (مخصوص
                      اندروید)
                    </h3>
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 text-[10px] text-blue-700 leading-relaxed">
                      اگر در اپلیکیشن اندروید با خطای اتصال مواجه هستید، آدرس
                      کامل سرور را در اینجا وارد کنید. مثال:
                      https://your-server.aistudio.google
                    </div>
                    <div className="flex flex-col md:flex-row gap-3">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-gray-500 block mb-1">
                          آدرس میزبان (Host)
                        </label>
                        <input
                          type="text"
                          value={tempServerHost}
                          onChange={(e) => setTempServerHost(e.target.value)}
                          className="w-full border rounded-lg p-2 text-sm dir-ltr text-left"
                          placeholder="https://..."
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testingConnection}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold text-sm h-10 mt-auto hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                      >
                        {testingConnection ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <RefreshCw size={18} />
                        )}
                        {testingConnection ? "در حال تست..." : "تست اتصال"}
                      </button>
                    </div>
                    {tempServerHost && (
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.setItem(
                            "app_server_host",
                            tempServerHost.trim().replace(/\/$/, ""),
                          );
                          alert(
                            "آدرس سرور ذخیره شد. برنامه را دوباره باز کنید.",
                          );
                        }}
                        className="text-[10px] text-blue-600 font-bold hover:underline"
                      >
                        ذخیره آدرس دائمی
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                    <Truck size={20} /> شماره‌گذاری اسناد (تنظیمات پیش‌فرض)
                  </h3>
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-2 text-xs text-amber-800 mb-2">
                    <p className="font-bold">⚠️ توجه ویژه در مورد سال مالی فعال:</p>
                    <p>
                      این شماره‌ها تنظیمات سراسری پیش‌فرض سیستم هستند. اگر یک سال مالی فعال دارید، سیستم شماره‌های شروع را از بخش 
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded mx-1 cursor-pointer" onClick={() => setActiveCategory("fiscal")}>مدیریت سال مالی</span> 
                      (جدول پایین آن بخش) دریافت می‌کند. لطفاً برای تنظیم شماره‌های شروع سال مالی فعال، به آن تب مراجعه فرمایید.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm font-bold text-gray-700 block mb-1">
                        شروع شماره دستور پرداخت
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded-lg p-2 dir-ltr text-left"
                        value={settings.currentTrackingNumber}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            currentTrackingNumber: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-gray-700 block mb-1">
                        شروع شماره مجوز خروج
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded-lg p-2 dir-ltr text-left"
                        value={settings.currentExitPermitNumber}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            currentExitPermitNumber: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-gray-700 block mb-1">
                        شروع شماره رسید دریافت (چک)
                      </label>
                      <input
                        type="number"
                        className="w-full border rounded-lg p-2 dir-ltr text-left"
                        value={settings.currentChequeReceiptNumber || 1000}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            currentChequeReceiptNumber: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-gray-700 block mb-1">
                        تاریخ قطع نمایش چک‌های اقدام شده قدیمی
                      </label>
                      <input
                        type="text"
                        className="w-full border rounded-lg p-2 text-center"
                        value={settings.chequeArchiveCutoffDate || ""}
                        placeholder="مثال: ۱۴۰۳/۰۱/۰۱"
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            chequeArchiveCutoffDate: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                    <Smartphone size={20} /> اولویت نمایش در نوار پایین موبایل
                  </h3>
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-[10px] text-blue-700 leading-relaxed">
                    ترتیب موارد را در اینجا مشخص کنید. ۵ مورد اول (با رعایت
                    دسترسی کاربر) در نوار پایین نمایش داده می‌شوند و مابقی در
                    منوی "بیشتر".
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto p-2 bg-gray-50 rounded-xl border border-gray-100">
                    {(settings.mobileNavOrder?.length
                      ? settings.mobileNavOrder
                      : [
                          "dashboard",
                          "trade",
                          "create",
                          "warehouse",
                          "chat",
                          "manage",
                          "create-exit",
                          "manage-exit",
                          "manage-invoices",
                          "security",
                          "meetings",
                          "purchase",
                          "knowledge",
                          "balances",
                          "products",
                          "sales",
                          "tickets",
                          "users",
                          "settings",
                        ]
                    ).map((itemId, idx) => {
                      const navLabel =
                        {
                          dashboard: "داشبورد",
                          create: "ثبت پرداخت",
                          manage: "سوابق پرداخت",
                          "create-exit": "ثبت خروج",
                          "manage-invoices": "مدیریت فاکتورها",
                          "manage-exit": "سوابق خروج",
                          warehouse: "مدیریت انبار",
                          security: "انتظامات",
                          meetings: "جلسات تولید",
                          purchase: "درخواست خرید",
                          chat: "گفتگو",
                          knowledge: "اطلاعات و یادداشت ها",
                          trade: "بازرگانی",
                          balances: "مانده حساب مشتریان",
                          products: "کالاها",
                          sales: "مشتریان",
                          tickets: "تیکت‌ها",
                          users: "کاربران",
                          settings: "تنظیمات",
                        }[itemId] || itemId;

                      return (
                        <div
                          key={itemId}
                          className="flex items-center justify-between bg-white p-2 rounded-lg border border-gray-100 shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-gray-400 w-4">
                              {idx + 1}
                            </span>
                            <span className="text-xs font-bold text-gray-700">
                              {navLabel}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                const order = [
                                  ...(settings.mobileNavOrder || [
                                    "dashboard",
                                    "trade",
                                    "create",
                                    "warehouse",
                                    "chat",
                                    "manage",
                                    "create-exit",
                                    "manage-exit",
                                    "manage-invoices",
                                    "security",
                                    "meetings",
                                    "purchase",
                                    "knowledge",
                                    "balances",
                                    "products",
                                    "sales",
                                    "tickets",
                                    "users",
                                    "settings",
                                  ]),
                                ];
                                if (idx > 0) {
                                  const temp = order[idx];
                                  order[idx] = order[idx - 1];
                                  order[idx - 1] = temp;
                                  setSettings({
                                    ...settings,
                                    mobileNavOrder: order,
                                  });
                                }
                              }}
                              className="p-1 hover:bg-gray-100 rounded text-gray-500"
                              disabled={idx === 0}
                            >
                              <RefreshCcw size={14} className="rotate-90" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const order = [
                                  ...(settings.mobileNavOrder || [
                                    "dashboard",
                                    "trade",
                                    "create",
                                    "warehouse",
                                    "chat",
                                    "manage",
                                    "create-exit",
                                    "manage-exit",
                                    "manage-invoices",
                                    "security",
                                    "meetings",
                                    "purchase",
                                    "knowledge",
                                    "balances",
                                    "products",
                                    "sales",
                                    "tickets",
                                    "users",
                                    "settings",
                                  ]),
                                ];
                                if (idx < order.length - 1) {
                                  const temp = order[idx];
                                  order[idx] = order[idx + 1];
                                  order[idx + 1] = temp;
                                  setSettings({
                                    ...settings,
                                    mobileNavOrder: order,
                                  });
                                }
                              }}
                              className="p-1 hover:bg-gray-100 rounded text-gray-500"
                              disabled={
                                idx ===
                                (settings.mobileNavOrder?.length || 19) - 1
                              }
                            >
                              <RefreshCcw size={14} className="-rotate-90" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeCategory === "whatsapp" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <MessageCircle size={20} /> مدیریت پیام‌رسان‌ها (واتساپ و
                    بله)
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleFetchGroups}
                      className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-indigo-100"
                    >
                      {fetchingGroups ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RefreshCw size={14} />
                      )}{" "}
                      بروزرسانی گروه‌ها
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-bold text-sm text-gray-600">
                      اتصال واتساپ (Web JS)
                    </h4>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center min-h-[250px] bg-gray-50 relative">
                      {whatsappStatus?.ready ? (
                        <div className="text-center animate-fade-in">
                          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 text-green-600">
                            <Check size={32} />
                          </div>
                          <h4 className="font-bold text-green-700 mb-1">
                            متصل است
                          </h4>
                          <p className="text-xs text-gray-500">
                            {whatsappStatus.user}
                          </p>
                          <button
                            type="button"
                            onClick={handleWhatsappLogout}
                            className="mt-4 text-xs text-red-600 hover:underline"
                          >
                            خروج از حساب
                          </button>
                        </div>
                      ) : (
                        <div className="text-center w-full">
                          {refreshingWA ? (
                            <div className="flex flex-col items-center gap-2">
                              <Loader2
                                className="animate-spin text-gray-400"
                                size={32}
                              />
                              <span className="text-xs text-gray-500">
                                در حال بررسی وضعیت...
                              </span>
                            </div>
                          ) : whatsappStatus?.qr ? (
                            <div className="flex flex-col items-center animate-scale-in">
                              <div className="glass-panel p-2 rounded-lg shadow-sm mb-3">
                                <QRCode value={whatsappStatus.qr} size={180} />
                              </div>
                              <p className="text-xs text-gray-600 font-bold mb-1">
                                اسکن کنید
                              </p>
                              <p className="text-[10px] text-gray-400">
                                QR کد هر 30 ثانیه منقضی می‌شود
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <p className="text-sm text-gray-500 mb-3">
                                QR کد یافت نشد. سرویس را بررسی کنید.
                              </p>
                              <button
                                type="button"
                                onClick={checkWhatsappStatus}
                                className="text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded"
                              >
                                تلاش مجدد
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {restartingWA && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center z-10">
                          <Loader2
                            className="animate-spin text-purple-600 mb-2"
                            size={32}
                          />
                          <span className="text-xs font-bold text-purple-700">
                            در حال بازنشانی سرویس...
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">
                        وضعیت سرویس: {whatsappStatus ? "آنلاین" : "آفلاین"}
                      </span>
                      <button
                        type="button"
                        onClick={handleWhatsappRestart}
                        className="text-orange-600 hover:underline font-bold"
                        disabled={restartingWA}
                      >
                        بازنشانی کامل سرویس (Restart)
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-blue-800">
                      <h4 className="font-bold text-sm mb-2">اطلاعات واتساپ</h4>
                      <p className="text-xs leading-relaxed">
                        سرویس واتساپ برای ارسال اعلان‌های خروج، بیجک و دستور
                        پرداخت‌ها استفاده می‌شود. در صورت بروز مشکل در ارسال، از
                        دکمه بازنشانی کامل استفاده کنید.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-6">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Users size={20} /> دفترچه تلفن (مخاطبین و گروه‌ها)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 items-end bg-gray-50 p-4 rounded-xl">
                    <div className="flex-1 w-full">
                      <label className="text-xs font-bold text-gray-500 block mb-1">
                        نام مخاطب / گروه
                      </label>
                      <input
                        className="w-full border rounded-lg p-2 text-sm"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="مثال: مدیر مالی"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-xs font-bold text-gray-500 block mb-1">
                        شماره / شناسه گروه (واتساپ)
                      </label>
                      <input
                        className="w-full border rounded-lg p-2 text-sm dir-ltr"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        placeholder="9891... / 123@g.us"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-xs font-bold text-gray-500 block mb-1">
                        آیدی بله
                      </label>
                      <input
                        className="w-full border rounded-lg p-2 text-sm dir-ltr"
                        value={contactBaleId}
                        onChange={(e) => setContactBaleId(e.target.value)}
                        placeholder="@id"
                      />
                    </div>
                    <div className="flex-1 w-full">
                      <label className="text-xs font-bold text-gray-500 block mb-1">
                        آیدی تلگرام
                      </label>
                      <input
                        className="w-full border rounded-lg p-2 text-sm dir-ltr"
                        value={contactTelegramId}
                        onChange={(e) => setContactTelegramId(e.target.value)}
                        placeholder="آیدی یا Chat ID"
                      />
                    </div>
                    <div className="flex items-center gap-2 mb-2 lg:col-span-2">
                      <input
                        type="checkbox"
                        id="isGroup"
                        checked={isGroupContact}
                        onChange={(e) => setIsGroupContact(e.target.checked)}
                        className="w-4 h-4"
                      />
                      <label
                        htmlFor="isGroup"
                        className="text-xs font-bold text-gray-600"
                      >
                        این یک گروه است
                      </label>
                    </div>
                    <div className="flex gap-2 w-full lg:col-span-2 justify-end">
                      {editingContactId && (
                        <button
                          type="button"
                          onClick={resetContactForm}
                          className="bg-gray-200 text-gray-700 p-2 rounded-lg"
                        >
                          <X size={18} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleAddOrUpdateContact}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 flex-1 lg:flex-none"
                      >
                        {editingContactId ? "ویرایش" : "افزودن"}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto pr-1">
                    {settings.savedContacts?.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3 glass-panel border rounded-lg shadow-sm group hover:border-blue-300 transition-colors"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div
                            className={`p-2 rounded-full shrink-0 ${c.isGroup ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}
                          >
                            {c.isGroup ? (
                              <Users size={16} />
                            ) : (
                              <Smartphone size={16} />
                            )}
                          </div>
                          <div className="truncate">
                            <div className="font-bold text-xs text-gray-800 truncate">
                              {c.name}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono truncate">
                              {c.number}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleEditContact(c)}
                            className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteContact(c.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeCategory === "warehouse" && (
              <div className="space-y-6 animate-fade-in">
                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                  <Warehouse size={20} /> انبار و لجستیک
                </h3>
                <div className="space-y-4 font-bold text-sm text-gray-600">
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-1">
                      شماره مدیر فروش (پیش‌فرض)
                    </label>
                    <input
                      className="w-full border rounded-lg p-3 dir-ltr text-left"
                      value={settings.defaultSalesManager || ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          defaultSalesManager: e.target.value,
                        })
                      }
                      placeholder="98912..."
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700 block mb-1">
                      شماره مدیر فروش (پیش‌فرض)
                    </label>
                    <input
                      className="w-full border rounded-lg p-3 dir-ltr text-left"
                      value={settings.defaultSalesManager || ""}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          defaultSalesManager: e.target.value,
                        })
                      }
                      placeholder="98912..."
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-bold text-sm text-gray-700 mb-3 border-b pb-1">
                    تنظیمات اطلاع‌رسانی خروج (شرکت‌ها)
                  </h4>
                  <div className="space-y-3">
                    {settings.companies
                      ?.filter((c) => c.showInWarehouse !== false)
                      .map((c) => {
                        const conf =
                          settings.companyNotifications?.[c.name] || {};
                        return (
                          <div
                            key={c.id}
                            className="bg-gray-50 p-4 rounded-xl border border-gray-200"
                          >
                            <h5 className="font-bold text-sm text-blue-800 mb-3 border-b border-gray-200 pb-1">
                              {c.name}
                            </h5>

                            <div className="space-y-3">
                              <h6 className="font-bold text-[11px] text-gray-600 mb-1 border-b pb-1">
                                تنظیمات گروه اطلاع‌رسانی:
                              </h6>
                              {/* UPDATED: Unified Group Config (WhatsApp, Bale, Telegram) */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                                {/* WhatsApp */}
                                <div className="bg-green-50 p-2 rounded border border-green-200">
                                  <div className="flex items-center gap-1 mb-1 text-green-700 font-bold text-[10px]">
                                    <MessageCircle size={12} /> واتساپ (گروه)
                                  </div>
                                  <select
                                    className="w-full border rounded p-1.5 text-xs dir-ltr glass-panel"
                                    value={conf.warehouseGroup || ""}
                                    onChange={(e) => {
                                      const newConf = {
                                        ...settings.companyNotifications,
                                        [c.name]: {
                                          ...conf,
                                          warehouseGroup: e.target.value,
                                        },
                                      };
                                      setSettings({
                                        ...settings,
                                        companyNotifications: newConf,
                                      });
                                    }}
                                  >
                                    <option value="">-- انتخاب --</option>
                                    {settings.savedContacts
                                      ?.filter((c) => c.isGroup)
                                      .map((grp) => (
                                        <option key={grp.id} value={grp.number}>
                                          {grp.name}
                                        </option>
                                      ))}
                                  </select>
                                </div>

                                {/* Bale */}
                                <div className="bg-cyan-50 p-2 rounded border border-cyan-200">
                                  <div className="flex items-center gap-1 mb-1 text-cyan-700 font-bold text-[10px]">
                                    <Send size={12} /> بله (شناسه)
                                  </div>
                                  <input
                                    className="w-full border rounded p-1.5 text-xs dir-ltr glass-panel"
                                    placeholder="ID..."
                                    value={conf.baleChannelId || ""}
                                    onChange={(e) => {
                                      const newConf = {
                                        ...settings.companyNotifications,
                                        [c.name]: {
                                          ...conf,
                                          baleChannelId: e.target.value,
                                        },
                                      };
                                      setSettings({
                                        ...settings,
                                        companyNotifications: newConf,
                                      });
                                    }}
                                  />
                                </div>

                                {/* Telegram */}
                                <div className="bg-blue-50 p-2 rounded border border-blue-200">
                                  <div className="flex items-center gap-1 mb-1 text-blue-700 font-bold text-[10px]">
                                    <Send size={12} /> تلگرام (Chat ID)
                                  </div>
                                  <input
                                    className="w-full border rounded p-1.5 text-xs dir-ltr glass-panel"
                                    placeholder="-100..."
                                    value={conf.telegramChannelId || ""}
                                    onChange={(e) => {
                                      const newConf = {
                                        ...settings.companyNotifications,
                                        [c.name]: {
                                          ...conf,
                                          telegramChannelId: e.target.value,
                                        },
                                      };
                                      setSettings({
                                        ...settings,
                                        companyNotifications: newConf,
                                      });
                                    }}
                                  />
                                </div>
                              </div>

                              <h6 className="font-bold text-[11px] text-orange-600 mb-1 border-b pb-1">
                                اطلاع‌رسانی به مدیر فروش (هنگام تایید مدیرعامل):
                              </h6>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-orange-50 p-2 rounded border border-orange-200">
                                  <div className="flex items-center gap-1 mb-1 text-orange-700 font-bold text-[10px]">
                                    <MessageCircle size={12} /> مدیر فروش
                                    (واتساپ)
                                  </div>
                                  <input
                                    className="w-full border rounded p-1.5 text-xs dir-ltr glass-panel"
                                    value={conf.salesManager || ""}
                                    onChange={(e) => {
                                      const newConf = {
                                        ...settings.companyNotifications,
                                        [c.name]: {
                                          ...conf,
                                          salesManager: e.target.value,
                                        },
                                      };
                                      setSettings({
                                        ...settings,
                                        companyNotifications: newConf,
                                      });
                                    }}
                                    placeholder="شماره (989...)"
                                  />
                                </div>
                                <div className="bg-orange-50 p-2 rounded border border-orange-200">
                                  <div className="flex items-center gap-1 mb-1 text-orange-700 font-bold text-[10px]">
                                    <Send size={12} /> مدیر فروش (بله)
                                  </div>
                                  <input
                                    className="w-full border rounded p-1.5 text-xs dir-ltr glass-panel"
                                    value={conf.salesManagerBale || ""}
                                    onChange={(e) => {
                                      const newConf = {
                                        ...settings.companyNotifications,
                                        [c.name]: {
                                          ...conf,
                                          salesManagerBale: e.target.value,
                                        },
                                      };
                                      setSettings({
                                        ...settings,
                                        companyNotifications: newConf,
                                      });
                                    }}
                                    placeholder="ID..."
                                  />
                                </div>
                                <div className="bg-orange-50 p-2 rounded border border-orange-200">
                                  <div className="flex items-center gap-1 mb-1 text-orange-700 font-bold text-[10px]">
                                    <Send size={12} /> مدیر فروش (تلگرام)
                                  </div>
                                  <input
                                    className="w-full border rounded p-1.5 text-xs dir-ltr glass-panel"
                                    value={conf.salesManagerTelegram || ""}
                                    onChange={(e) => {
                                      const newConf = {
                                        ...settings.companyNotifications,
                                        [c.name]: {
                                          ...conf,
                                          salesManagerTelegram: e.target.value,
                                        },
                                      };
                                      setSettings({
                                        ...settings,
                                        companyNotifications: newConf,
                                      });
                                    }}
                                    placeholder="Chat ID..."
                                  />
                                </div>
                              </div>

                              <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
                                <label className="text-[10px] font-bold text-gray-600 flex items-center gap-1">
                                  <FileClock
                                    size={12}
                                    className="text-blue-600"
                                  />{" "}
                                  شماره شروع بیجک:
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    className="w-20 border rounded p-1 text-[10px] text-center font-mono"
                                    value={
                                      settings.warehouseSequences?.[c.name] ||
                                      ""
                                    }
                                    onChange={(e) => {
                                      const newSequences = {
                                        ...(settings.warehouseSequences || {}),
                                        [c.name]: Number(e.target.value),
                                      };
                                      setSettings({
                                        ...settings,
                                        warehouseSequences: newSequences,
                                      });
                                    }}
                                    placeholder="1000"
                                  />
                                  <span className="text-[9px] text-gray-400">
                                    پر کردن جاهای خالی از این عدد
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                <SecondExitGroupSettings
                  title="گروه اول (پیش‌فرض سیستم)"
                  configKey="exitPermitFirstGroupConfig"
                  bgColor="bg-blue-50"
                  borderColor="border-blue-200"
                  colorClasses="text-blue-900"
                  iconColorClass="text-blue-700"
                  settings={settings}
                  setSettings={setSettings}
                  contacts={[...(settings.savedContacts || []), ...appContacts]}
                />

                <SecondExitGroupSettings
                  title="تنظیمات گروه دوم (ارسال سفارشی)"
                  configKey="exitPermitSecondGroupConfig"
                  settings={settings}
                  setSettings={setSettings}
                  contacts={[...(settings.savedContacts || []), ...appContacts]}
                />

                <SecondExitGroupSettings
                  title="تنظیمات گروه سوم (ارسال سفارشی)"
                  configKey="exitPermitThirdGroupConfig"
                  bgColor="bg-purple-50"
                  borderColor="border-purple-200"
                  colorClasses="text-purple-900"
                  iconColorClass="text-purple-700"
                  settings={settings}
                  setSettings={setSettings}
                  contacts={[...(settings.savedContacts || []), ...appContacts]}
                />

                <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-5 space-y-4 shadow-sm animate-fade-in">
                  <h4 className="font-bold text-sm text-amber-900 flex items-center gap-2">
                    🚚 تنظیمات تخصصی ارسال گزارش روزانه خروج کارخانه
                  </h4>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    تنظیم کنید که گزارش روزانه تصاویر و مجوزهای خروج کالا از
                    کارخانه به چه گروه‌هایی ارسال شود. می‌توانید یک گروه اختصاصی
                    فقط برای این گزارش معرفی کنید یا آن را به گروه‌های اول، دوم
                    یا سوم مجوزهای خروج نیز بفرستید.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-4 rounded-lg border border-amber-100">
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">
                        گروه اختصاصی تلگرام (Chat ID)
                      </label>
                      <input
                        className="w-full border rounded p-1.5 text-xs dir-ltr"
                        value={
                          settings.dailyExitReportDedicatedTelegramId || ""
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            dailyExitReportDedicatedTelegramId: e.target.value,
                          })
                        }
                        placeholder="-100..."
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">
                        گروه اختصاصی بله (شناسه)
                      </label>
                      <input
                        className="w-full border rounded p-1.5 text-xs dir-ltr"
                        value={settings.dailyExitReportDedicatedBaleId || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            dailyExitReportDedicatedBaleId: e.target.value,
                          })
                        }
                        placeholder="ID..."
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-gray-500 block mb-1">
                        گروه اختصاصی واتساپ (ID)
                      </label>
                      <input
                        className="w-full border rounded p-1.5 text-xs dir-ltr"
                        value={
                          settings.dailyExitReportDedicatedWhatsAppId || ""
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            dailyExitReportDedicatedWhatsAppId: e.target.value,
                          })
                        }
                        placeholder="...@g.us"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-6 pt-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={
                          settings.dailyExitReportSendToFirstGroup !== false
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            dailyExitReportSendToFirstGroup: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <span>ارسال به گروه اول مجوز خروج (پیش‌فرض کارخانه)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={
                          settings.dailyExitReportSendToSecondGroup || false
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            dailyExitReportSendToSecondGroup: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <span>ارسال به گروه دوم مجوز خروج</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={
                          settings.dailyExitReportSendToThirdGroup || false
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            dailyExitReportSendToThirdGroup: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <span>ارسال به گروه سوم مجوز خروج</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={
                          settings.dailyExitReportSendToDedicatedGroup || false
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            dailyExitReportSendToDedicatedGroup:
                              e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-blue-600"
                      />
                      <span>ارسال به گروه اختصاصی معرفی شده در بالا</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeCategory === "data" && (
              <div className="space-y-8 animate-fade-in">
                <BackupManager />
                <div className="space-y-4">
                  <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                    <Building size={20} /> مدیریت شرکت‌ها و بانک‌ها
                  </h3>

                  {/* Company Form */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-sm text-gray-700">
                        {editingCompanyId ? "ویرایش شرکت" : "افزودن شرکت جدید"}
                      </h4>
                      {editingCompanyId && (
                        <button
                          type="button"
                          onClick={resetCompanyForm}
                          className="text-xs text-red-500 glass-panel border border-red-100 px-2 py-1 rounded"
                        >
                          انصراف
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="text-xs font-bold block mb-1 text-gray-500">
                          نام شرکت
                        </label>
                        <input
                          type="text"
                          className="w-full border rounded-lg p-2 text-sm"
                          placeholder="نام شرکت..."
                          value={newCompanyName}
                          onChange={(e) => setNewCompanyName(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="text-xs font-bold block mb-1 text-gray-500">
                            لوگو
                          </label>
                          <div className="flex items-center gap-2 border rounded-lg p-1 glass-panel h-[42px]">
                            <input
                              type="file"
                              ref={companyLogoInputRef}
                              className="hidden"
                              onChange={handleLogoUpload}
                              accept="image/*"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                companyLogoInputRef.current?.click()
                              }
                              className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                              disabled={isUploadingLogo}
                            >
                              {isUploadingLogo ? "..." : "انتخاب"}
                            </button>
                            {newCompanyLogo && (
                              <img
                                src={newCompanyLogo}
                                className="h-8 w-8 object-contain"
                              />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-bold block mb-1 text-gray-500">
                            سربرگ (A4)
                          </label>
                          <div className="flex items-center gap-2 border rounded-lg p-1 glass-panel h-[42px]">
                            <input
                              type="file"
                              ref={companyLetterheadInputRef}
                              className="hidden"
                              onChange={handleLetterheadUpload}
                              accept="image/*"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                companyLetterheadInputRef.current?.click()
                              }
                              className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                              disabled={isUploadingLetterhead}
                            >
                              {isUploadingLetterhead ? "..." : "انتخاب"}
                            </button>
                            {newCompanyLetterhead && (
                              <span className="text-[10px] text-green-600 truncate">
                                دارد
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`flex items-center gap-2 glass-panel px-2 py-2 rounded border cursor-pointer flex-1 h-[42px] ${newCompanyShowInWarehouse ? "border-green-200 bg-green-50 text-green-700" : ""}`}
                        onClick={() =>
                          setNewCompanyShowInWarehouse(
                            !newCompanyShowInWarehouse,
                          )
                        }
                      >
                        <input
                          type="checkbox"
                          checked={newCompanyShowInWarehouse}
                          onChange={(e) =>
                            setNewCompanyShowInWarehouse(e.target.checked)
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-xs font-bold select-none">
                          نمایش در انبار
                        </span>
                      </div>
                      <div>
                        <label className="text-xs font-bold block mb-1 text-gray-500">
                          شناسه ملی
                        </label>
                        <input
                          className="w-full border rounded-lg p-2 text-sm dir-ltr"
                          value={newCompanyNatId}
                          onChange={(e) => setNewCompanyNatId(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold block mb-1 text-gray-500">
                          شماره ثبت
                        </label>
                        <input
                          className="w-full border rounded-lg p-2 text-sm dir-ltr"
                          value={newCompanyRegNum}
                          onChange={(e) => setNewCompanyRegNum(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold block mb-1 text-gray-500">
                          کد اقتصادی
                        </label>
                        <input
                          className="w-full border rounded-lg p-2 text-sm dir-ltr"
                          value={newCompanyEcoCode}
                          onChange={(e) => setNewCompanyEcoCode(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold block mb-1 text-gray-500">
                          تلفن
                        </label>
                        <input
                          className="w-full border rounded-lg p-2 text-sm dir-ltr"
                          value={newCompanyPhone}
                          onChange={(e) => setNewCompanyPhone(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold block mb-1 text-gray-500">
                          فکس
                        </label>
                        <input
                          className="w-full border rounded-lg p-2 text-sm dir-ltr"
                          value={newCompanyFax}
                          onChange={(e) => setNewCompanyFax(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold block mb-1 text-gray-500">
                          کد پستی
                        </label>
                        <input
                          className="w-full border rounded-lg p-2 text-sm dir-ltr"
                          value={newCompanyPostalCode}
                          onChange={(e) =>
                            setNewCompanyPostalCode(e.target.value)
                          }
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs font-bold block mb-1 text-gray-500">
                          آدرس
                        </label>
                        <input
                          className="w-full border rounded-lg p-2 text-sm"
                          value={newCompanyAddress}
                          onChange={(e) => setNewCompanyAddress(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Company Banks Management */}
                    <div className="glass-panel p-3 rounded-lg border border-gray-100 mb-4">
                      <h5 className="font-bold text-xs text-gray-600 mb-2">
                        حساب‌های بانکی شرکت
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2 items-end">
                        <div className="flex-1">
                          <input
                            className="w-full border rounded p-1.5 text-xs"
                            placeholder="نام بانک"
                            value={tempBankName}
                            onChange={(e) => setTempBankName(e.target.value)}
                          />
                        </div>
                        <div className="flex-1">
                          <input
                            className="w-full border rounded p-1.5 text-xs dir-ltr"
                            placeholder="شماره حساب"
                            value={tempAccountNum}
                            onChange={(e) => setTempAccountNum(e.target.value)}
                          />
                        </div>
                        <div className="flex-1">
                          <input
                            className="w-full border rounded p-1.5 text-xs dir-ltr"
                            placeholder="شبا (IR...)"
                            value={tempBankSheba}
                            onChange={(e) => setTempBankSheba(e.target.value)}
                          />
                        </div>
                        <div>
                          <select
                            className="w-full border rounded p-1.5 text-xs"
                            value={tempBankLayout}
                            onChange={(e) => setTempBankLayout(e.target.value)}
                          >
                            <option value="">قالب چاپ چک</option>
                            {settings.printTemplates?.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex-1">
                          <select
                            className="w-full border rounded p-1.5 text-xs"
                            value={tempInternalLayout}
                            onChange={(e) =>
                              setTempInternalLayout(e.target.value)
                            }
                          >
                            <option value="">قالب رسید داخلی</option>
                            {settings.printTemplates?.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1 border rounded p-1">
                          <input
                            type="checkbox"
                            checked={tempDualPrint}
                            onChange={(e) => setTempDualPrint(e.target.checked)}
                            className="w-3 h-3"
                          />
                          <span className="text-[10px]">
                            چاپ دوگانه (واریز/برداشت)
                          </span>
                        </div>
                        {tempDualPrint && (
                          <>
                            <div className="flex-1">
                              <select
                                className="w-full border rounded p-1.5 text-[10px]"
                                value={tempInternalWithdrawalLayout}
                                onChange={(e) =>
                                  setTempInternalWithdrawalLayout(
                                    e.target.value,
                                  )
                                }
                              >
                                <option value="">قالب برداشت</option>
                                {settings.printTemplates?.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex-1">
                              <select
                                className="w-full border rounded p-1.5 text-[10px]"
                                value={tempInternalDepositLayout}
                                onChange={(e) =>
                                  setTempInternalDepositLayout(e.target.value)
                                }
                              >
                                <option value="">قالب واریز</option>
                                {settings.printTemplates?.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={addOrUpdateCompanyBank}
                          className="bg-green-100 text-green-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-green-200"
                        >
                          {editingBankId ? "ویرایش بانک" : "افزودن بانک"}
                        </button>
                        {editingBankId && (
                          <button
                            type="button"
                            onClick={resetBankForm}
                            className="bg-gray-100 text-gray-600 px-2 py-1.5 rounded text-xs"
                          >
                            لغو
                          </button>
                        )}
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {newCompanyBanks.map((b, i) => (
                          <div
                            key={b.id}
                            className="flex justify-between items-center bg-gray-50 p-2 rounded text-xs border border-gray-100"
                          >
                            <span>
                              {b.bankName} - {b.accountNumber}
                            </span>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => editCompanyBank(b)}
                                className="text-blue-500"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeCompanyBank(b.id)}
                                className="text-red-500"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveCompany}
                      className={`w-full text-white px-4 py-2 rounded-lg text-sm h-10 font-bold shadow-sm ${editingCompanyId ? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
                    >
                      {editingCompanyId ? "ذخیره تغییرات شرکت" : "افزودن شرکت"}
                    </button>
                    <div className="space-y-2 mt-6 max-h-64 overflow-y-auto border-t pt-4">
                      {settings.companies?.map((c) => (
                        <div
                          key={c.id}
                          className="flex flex-col glass-panel p-3 rounded border shadow-sm gap-2"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              {c.logo && (
                                <img
                                  src={c.logo}
                                  className="w-6 h-6 object-contain"
                                />
                              )}
                              <span className="text-sm font-bold">
                                {c.name}
                              </span>
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditCompany(c)}
                                className="text-blue-500 p-1 hover:bg-blue-50 rounded"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveCompany(c.id)}
                                className="text-red-500 p-1 hover:bg-red-50 rounded"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel p-4 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-gray-800 border-b pb-2 mb-3">
                      بانک‌های عامل (عمومی)
                    </h3>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        className="border rounded p-2 text-sm flex-1"
                        placeholder="نام بانک..."
                        value={newOperatingBank}
                        onChange={(e) => setNewOperatingBank(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleAddOperatingBank}
                        className="bg-blue-600 text-white px-3 py-2 rounded text-sm font-bold"
                      >
                        افزودن
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {settings.operatingBankNames?.map((b) => (
                        <span
                          key={b}
                          className="bg-gray-100 px-3 py-1 rounded-full text-xs flex items-center gap-1"
                        >
                          {b}{" "}
                          <button
                            onClick={() => handleRemoveOperatingBank(b)}
                            className="text-red-500 hover:bg-red-100 rounded-full p-0.5"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeCategory === "commerce" && (
              <div className="space-y-6 animate-fade-in">
                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                  <Container size={20} /> تنظیمات بازرگانی
                </h3>
                <div className="glass-panel p-4 rounded-xl border border-gray-200">
                  <h4 className="font-bold text-sm text-gray-700 mb-2">
                    گروه‌های کالایی
                  </h4>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      className="border rounded p-2 text-sm flex-1"
                      placeholder="نام گروه..."
                      value={newCommodity}
                      onChange={(e) => setNewCommodity(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleAddCommodity}
                      className="bg-blue-600 text-white px-3 py-2 rounded text-sm font-bold"
                    >
                      افزودن
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {settings.commodityGroups?.map((c) => (
                      <span
                        key={c}
                        className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs flex items-center gap-1"
                      >
                        {c}{" "}
                        <button
                          onClick={() => handleRemoveCommodity(c)}
                          className="text-red-500 hover:bg-red-100 rounded-full p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-gray-200">
                  <h4 className="font-bold text-sm text-gray-700 mb-2">
                    شرکت‌های بیمه
                  </h4>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      className="border rounded p-2 text-sm flex-1"
                      placeholder="نام شرکت بیمه..."
                      value={newInsuranceCompany}
                      onChange={(e) => setNewInsuranceCompany(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleAddInsuranceCompany}
                      className="bg-green-600 text-white px-3 py-2 rounded text-sm font-bold"
                    >
                      افزودن
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {settings.insuranceCompanies?.map((c) => (
                      <span
                        key={c}
                        className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs flex items-center gap-1"
                      >
                        {c}{" "}
                        <button
                          onClick={() => handleRemoveInsuranceCompany(c)}
                          className="text-red-500 hover:bg-red-100 rounded-full p-0.5"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeCategory === "bot" && (
              <div className="space-y-6 animate-fade-in">
                <h3 className="font-bold text-gray-800 border-b pb-2 flex items-center gap-2">
                  <Bot size={20} className="text-sky-600" /> تنظیمات ربات، فروشگاه و گزارشات خودکار (آمار تولید و فروش روزانه)
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-bold text-sm text-gray-700">
                      اطلاعات ارتباطی (نمایش در ربات)
                    </h4>
                    <div className="space-y-4 glass-panel p-4 rounded-xl border">
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">
                          آدرس شرکت
                        </label>
                        <textarea
                          rows={2}
                          value={settings.companyAddress || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              companyAddress: e.target.value,
                            })
                          }
                          className="w-full border rounded p-2 text-sm"
                          placeholder="مثال: تهران، خیابان..."
                        ></textarea>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">
                          شماره‌های تماس
                        </label>
                        <input
                          type="text"
                          value={settings.companyPhone || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              companyPhone: e.target.value,
                            })
                          }
                          className="w-full border rounded p-2 text-sm"
                          placeholder="مثال: 021-12345678"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">
                          اطلاعات حساب بانکی
                        </label>
                        <textarea
                          rows={2}
                          value={settings.companyBank || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              companyBank: e.target.value,
                            })
                          }
                          className="w-full border rounded p-2 text-sm"
                          placeholder="بانک ملت - IR..."
                        ></textarea>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-bold text-sm text-gray-700">
                      تنظیمات اتصال ربات‌ها (Tokens)
                    </h4>
                    <div className="space-y-3 glass-panel p-4 rounded-xl border">
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">
                          توکن ربات تلگرام
                        </label>
                        <input
                          className="w-full border rounded p-2 text-xs dir-ltr font-mono"
                          value={settings.telegramBotToken || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              telegramBotToken: e.target.value,
                            })
                          }
                          placeholder="123456:ABC-..."
                          type="password"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 block mb-1">
                          شناسه عددی مدیر (تلگرام)
                        </label>
                        <input
                          className="w-full border rounded p-2 text-xs dir-ltr font-mono"
                          value={settings.telegramAdminId || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              telegramAdminId: e.target.value,
                            })
                          }
                          placeholder="12345678"
                        />
                      </div>
                      <div className="border-t pt-3">
                        <label className="text-xs font-bold text-gray-500 block mb-1">
                          توکن ربات بله
                        </label>
                        <input
                          className="w-full border rounded p-2 text-xs dir-ltr font-mono"
                          value={settings.baleBotToken || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              baleBotToken: e.target.value,
                            })
                          }
                          placeholder="Token..."
                          type="password"
                        />
                      </div>
                      <div className="border-t pt-3">
                        <label className="text-xs font-bold text-gray-500 block mb-1">
                          شناسه عددی گروه خرید (تلگرام)
                        </label>
                        <input
                          className="w-full border rounded p-2 text-xs dir-ltr font-mono"
                          value={settings.purchaseTelegramGroup || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              purchaseTelegramGroup: e.target.value,
                            })
                          }
                          placeholder="-100..."
                        />
                      </div>
                      <div className="border-t pt-3">
                        <label className="text-xs font-bold text-gray-500 block mb-1">
                          شناسه عددی گروه خرید (بله)
                        </label>
                        <input
                          className="w-full border rounded p-2 text-xs dir-ltr font-mono"
                          value={settings.purchaseBaleGroup || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              purchaseBaleGroup: e.target.value,
                            })
                          }
                          placeholder="Chat ID..."
                        />
                      </div>
                      <div className="border-t pt-3">
                        <label className="text-xs font-bold text-gray-500 block mb-1">
                          شماره گروه خرید (واتس‌اپ)
                        </label>
                        <input
                          className="w-full border rounded p-2 text-xs dir-ltr font-mono"
                          value={settings.purchaseWhatsappGroup || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              purchaseWhatsappGroup: e.target.value,
                            })
                          }
                          placeholder="GroupId@..."
                        />
                      </div>
                      <div className="border-t pt-3">
                        <label className="text-xs font-bold text-gray-500 block mb-1">
                          کلید Gemini AI (هوش مصنوعی)
                        </label>
                        <input
                          className="w-full border rounded p-2 text-xs dir-ltr font-mono"
                          value={settings.geminiApiKey || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              geminiApiKey: e.target.value,
                            })
                          }
                          placeholder="AI Key..."
                          type="password"
                        />
                      </div>
                      <div className="border-t pt-3">
                        <label className="text-xs font-bold text-gray-500 block mb-1">
                          کلید سرور Firebase FCM (نوتیفیکیشن اندروید)
                        </label>
                        <input
                          className="w-full border rounded p-2 text-xs dir-ltr font-mono"
                          value={settings.fcmServerKey || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              fcmServerKey: e.target.value,
                            })
                          }
                          placeholder="AAAA..."
                          type="password"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
                  <h4 className="font-bold text-sm text-gray-700">
                    عضویت اجباری کانال‌ها
                  </h4>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.botForceJoinEnabled || false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          botForceJoinEnabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-blue-600"
                    />
                    فعال‌سازی عضویت اجباری (کاربر باید عضو این کانال‌ها شود تا
                    از ربات استفاده کند)
                  </label>

                  <div className="space-y-3">
                    {(settings.botForceJoinChannels || []).map(
                      (channel, cIdx) => (
                        <div
                          key={cIdx}
                          className="glass-panel p-3 rounded-xl border border-gray-100 shadow-sm space-y-3"
                        >
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="نام کانال (مثلا: کانال رسمی)"
                              value={channel.name}
                              onChange={(e) => {
                                const newArr = [
                                  ...(settings.botForceJoinChannels || []),
                                ];
                                newArr[cIdx].name = e.target.value;
                                setSettings({
                                  ...settings,
                                  botForceJoinChannels: newArr,
                                });
                              }}
                              className="flex-1 border rounded p-2 text-sm"
                            />
                            <select
                              value={channel.platform || "all"}
                              onChange={(e) => {
                                const newArr = [
                                  ...(settings.botForceJoinChannels || []),
                                ];
                                newArr[cIdx].platform = e.target.value as any;
                                setSettings({
                                  ...settings,
                                  botForceJoinChannels: newArr,
                                });
                              }}
                              className="border rounded p-2 text-sm bg-gray-50"
                            >
                              <option value="all">همه پلتفرم‌ها</option>
                              <option value="telegram">فقط تلگرام</option>
                              <option value="bale">فقط بله</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const newArr = [
                                  ...(settings.botForceJoinChannels || []),
                                ];
                                newArr.splice(cIdx, 1);
                                setSettings({
                                  ...settings,
                                  botForceJoinChannels: newArr,
                                });
                              }}
                              className="bg-red-50 text-red-600 p-2 rounded hover:bg-red-100"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="لینک عضویت (https://t.me/... یا https://ble.ir/...)"
                              value={channel.link}
                              onChange={(e) => {
                                const newArr = [
                                  ...(settings.botForceJoinChannels || []),
                                ];
                                newArr[cIdx].link = e.target.value;
                                setSettings({
                                  ...settings,
                                  botForceJoinChannels: newArr,
                                });
                              }}
                              className="flex-1 border rounded p-2 text-sm dir-ltr"
                            />
                            <input
                              type="text"
                              placeholder="آیدی کانال (@channel_id)"
                              value={channel.id}
                              onChange={(e) => {
                                const newArr = [
                                  ...(settings.botForceJoinChannels || []),
                                ];
                                newArr[cIdx].id = e.target.value;
                                setSettings({
                                  ...settings,
                                  botForceJoinChannels: newArr,
                                });
                              }}
                              className="flex-1 border rounded p-2 text-sm dir-ltr"
                            />
                          </div>
                        </div>
                      ),
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          botForceJoinChannels: [
                            ...(settings.botForceJoinChannels || []),
                            { name: "", link: "", id: "", platform: "all" },
                          ],
                        })
                      }
                      className="text-sm text-blue-600 font-bold flex items-center gap-1 bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors"
                    >
                      + افزودن کانال جدید
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
                  <h4 className="font-bold text-sm text-gray-700 underline underline-offset-4 decoration-blue-500">
                    لینک‌های مینی‌اپ و دکمه‌های اضافی در منوی استارت
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4 mb-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 block">
                        لینک مینی‌اپ لیست قیمت خودرو
                      </label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={settings.miniAppCarPriceUrl || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            miniAppCarPriceUrl: e.target.value,
                          })
                        }
                        className="w-full border rounded p-2 text-sm dir-ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 block">
                        لینک مینی‌اپ تخمین قیمت خودرو
                      </label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={settings.miniAppCarEstimatorUrl || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            miniAppCarEstimatorUrl: e.target.value,
                          })
                        }
                        className="w-full border rounded p-2 text-sm dir-ltr"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-500 block">
                        لینک مینی‌اپ قیمت موبایل
                      </label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={settings.miniAppMobilePriceUrl || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            miniAppMobilePriceUrl: e.target.value,
                          })
                        }
                        className="w-full border rounded p-2 text-sm dir-ltr"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(settings.botStoreLinks || []).map((linkItem, lIdx) => (
                      <div key={lIdx} className="flex gap-2 animate-slide-left">
                        <input
                          type="text"
                          placeholder="عنوان دکمه (مثلا: لیست قیمت)"
                          value={linkItem.title}
                          onChange={(e) => {
                            const newArr = [...(settings.botStoreLinks || [])];
                            newArr[lIdx].title = e.target.value;
                            setSettings({ ...settings, botStoreLinks: newArr });
                          }}
                          className="flex-1 border rounded p-2 text-sm"
                        />
                        <input
                          type="url"
                          placeholder="لینک (https://...) یا شناسه"
                          value={linkItem.url}
                          onChange={(e) => {
                            const newArr = [...(settings.botStoreLinks || [])];
                            newArr[lIdx].url = e.target.value;
                            setSettings({ ...settings, botStoreLinks: newArr });
                          }}
                          className="flex-2 border rounded p-2 text-sm dir-ltr"
                          style={{ flex: 2 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newArr = [...(settings.botStoreLinks || [])];
                            newArr.splice(lIdx, 1);
                            setSettings({ ...settings, botStoreLinks: newArr });
                          }}
                          className="bg-red-50 text-red-600 p-2 rounded hover:bg-red-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          botStoreLinks: [
                            ...(settings.botStoreLinks || []),
                            { title: "", url: "" },
                          ],
                        })
                      }
                      className="text-sm text-blue-600 font-bold flex items-center gap-1 glass-panel border border-blue-200 px-3 py-1.5 rounded-lg hover:shadow-sm transition-all"
                    >
                      + افزودن دکمه جدید
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
                  <h4 className="font-bold text-sm text-gray-700">
                    تنظیمات اطلاع‌رسانی مالی و خروج
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                      <label className="text-sm font-bold text-blue-800 block mb-2">
                        شناسه گروه‌های حسابداری (ارسال دستورپرداخت)
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 block mb-1">
                            تلگرام (Chat ID)
                          </label>
                          <input
                            className="w-full border rounded p-2 text-xs dir-ltr"
                            value={
                              settings.botAccountingGroupIdTele ||
                              settings.botAccountingGroupId ||
                              ""
                            }
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                botAccountingGroupIdTele: e.target.value,
                                botAccountingGroupId: e.target.value,
                              })
                            }
                            placeholder="-100..."
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 block mb-1">
                            بله (شناسه)
                          </label>
                          <input
                            className="w-full border rounded p-2 text-xs dir-ltr"
                            value={settings.botAccountingGroupIdBale || ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                botAccountingGroupIdBale: e.target.value,
                              })
                            }
                            placeholder="ID..."
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 block mb-1">
                            واتساپ (ID)
                          </label>
                          <input
                            className="w-full border rounded p-2 text-xs dir-ltr"
                            value={settings.botAccountingGroupIdWhatsApp || ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                botAccountingGroupIdWhatsApp: e.target.value,
                              })
                            }
                            placeholder="...@g.us"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="text-sm font-bold text-gray-700 block mb-1">
                        حالت ارسال دستورپرداخت (بات تلگرام)
                      </label>
                      <select
                        value={
                          settings.botPaymentNotificationMode || "step_by_step"
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            botPaymentNotificationMode: e.target.value as
                              "after_submit" | "after_final" | "step_by_step",
                          })
                        }
                        className="w-full border rounded-lg p-2 text-sm glass-panel"
                      >
                        <option value="after_submit">بعد از ثبت درخواست</option>
                        <option value="after_final">بعد از تایید نهایی</option>
                        <option value="step_by_step">
                          مرحله به مرحله (بعد از هر وضعیت)
                        </option>
                      </select>
                    </div>
                    <div className="mt-2">
                      <label className="text-sm font-bold text-gray-700 block mb-1">
                        گروه دستی بیجک‌ها (Telegram Chat ID)
                      </label>
                      <input
                        type="text"
                        value={settings.botBijakGroupId || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            botBijakGroupId: e.target.value,
                          })
                        }
                        className="w-full border rounded-lg p-2 text-sm dir-ltr"
                        placeholder="-100..."
                      />
                    </div>
                    <div className="mt-2 text-right">
                      <label className="text-sm font-bold text-gray-700 block mb-1">
                        گروه بیجک‌ها (Bale ID)
                      </label>
                      <input
                        type="text"
                        value={settings.botBijakGroupIdBale || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            botBijakGroupIdBale: e.target.value,
                          })
                        }
                        className="w-full border rounded-lg p-2 text-sm dir-ltr"
                        placeholder="ID..."
                      />
                    </div>
                    <div className="mt-2 text-right">
                      <label className="text-sm font-bold text-gray-700 block mb-1">
                        گروه بیجک‌ها (WhatsApp ID)
                      </label>
                      <input
                        type="text"
                        value={settings.botBijakGroupIdWhatsApp || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            botBijakGroupIdWhatsApp: e.target.value,
                          })
                        }
                        className="w-full border rounded-lg p-2 text-sm dir-ltr"
                        placeholder="...@g.us"
                      />
                    </div>

                    <div className="border-t pt-4 mt-4 space-y-4">
                      <h4 className="font-bold text-sm text-blue-800">
                        📊 تنظیمات ارسال خودکار آمار فروش روزانه (ساعت ۷ غروب)
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">
                            شناسه گروه تلگرام آمار فروش
                          </label>
                          <input
                            type="text"
                            value={settings.dailySalesTelegramGroupId || ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                dailySalesTelegramGroupId: e.target.value,
                              })
                            }
                            className="w-full border rounded-lg p-2 text-xs dir-ltr"
                            placeholder="-100..."
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">
                            شناسه گروه بله آمار فروش
                          </label>
                          <input
                            type="text"
                            value={settings.dailySalesBaleGroupId || ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                dailySalesBaleGroupId: e.target.value,
                              })
                            }
                            className="w-full border rounded-lg p-2 text-xs dir-ltr"
                            placeholder="ID..."
                          />
                        </div>
                      </div>

                    </div>

                    <div className="border-t pt-4 mt-4 space-y-4">
                      <h4 className="font-bold text-sm text-indigo-800">
                        ⚙️ تنظیمات گروه مخصوص ارسال آمار تولید
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">
                            شناسه گروه تلگرام آمار تولید
                          </label>
                          <input
                            type="text"
                            value={settings.productionTelegramGroupId || ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                productionTelegramGroupId: e.target.value,
                              })
                            }
                            className="w-full border rounded-lg p-2 text-xs dir-ltr"
                            placeholder="-100..."
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">
                            شناسه گروه بله آمار تولید
                          </label>
                          <input
                            type="text"
                            value={settings.productionBaleGroupId || ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                productionBaleGroupId: e.target.value,
                              })
                            }
                            className="w-full border rounded-lg p-2 text-xs dir-ltr"
                            placeholder="ID..."
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-4">
                      <h4 className="font-bold text-sm text-gray-700">
                        ارتباط با مشتری و مدیریت پیام‌های فروش
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-gray-500 block mb-1">
                            پیام خوش‌آمدگویی بخش "ارتباط با فروش" در ربات
                          </label>
                          <textarea
                            className="w-full border rounded p-2 text-sm h-20"
                            value={settings.salesContactMessage || ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                salesContactMessage: e.target.value,
                              })
                            }
                            placeholder="مثلاً: لطفاً پیام خود را بنویسید..."
                          />
                        </div>
                        <div className="bg-white/50 p-4 rounded-xl border border-blue-200">
                          <h4 className="font-bold text-sm text-blue-800 mb-3 flex items-center gap-2">
                            <Users size={16} /> مدیران پاسخگو و دریافت‌کنندگان
                            پیام‌های مشتریان
                          </h4>
                          <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto border rounded-xl p-3 glass-panel shadow-inner">
                            {(settings.salesNotificationUsers || []).map(
                              (item, idx) => {
                                const username = item.username;
                                const platforms = item.platforms;
                                const name = item.name;
                                const u = systemUsers.find(
                                  (user) => user.username === username,
                                );

                                const togglePlatform = (p: string) => {
                                  const current = (
                                    settings.salesNotificationUsers || []
                                  ).map((prevItem, pIdx) => {
                                    if (pIdx !== idx) return prevItem;

                                    const nextPlatforms =
                                      prevItem.platforms.includes(p)
                                        ? prevItem.platforms.filter(
                                            (pl) => pl !== p,
                                          )
                                        : [...prevItem.platforms, p];

                                    return {
                                      ...prevItem,
                                      platforms: nextPlatforms,
                                    };
                                  });
                                  setSettings({
                                    ...settings,
                                    salesNotificationUsers: current,
                                  });
                                };

                                return (
                                  <div
                                    key={idx}
                                    className="bg-gray-50/50 p-3 rounded-lg border border-gray-100 animate-fade-in group"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                          <UserIcon size={16} />
                                        </div>
                                        <div>
                                          <div className="text-sm font-bold text-gray-800">
                                            {name ||
                                              (u ? u.fullName : "کاربر دستی")}
                                          </div>
                                          <div className="text-[10px] text-gray-500 font-mono">
                                            ID: {username}
                                          </div>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = (
                                            settings.salesNotificationUsers ||
                                            []
                                          ).filter((_, pIdx) => pIdx !== idx);
                                          setSettings({
                                            ...settings,
                                            salesNotificationUsers: updated,
                                          });
                                        }}
                                        className="p-1 px-2 text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                    <div className="flex gap-6 mt-3 px-11 border-t pt-2 border-gray-100">
                                      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                        <input
                                          type="checkbox"
                                          checked={platforms.includes(
                                            "telegram",
                                          )}
                                          onChange={() =>
                                            togglePlatform("telegram")
                                          }
                                          className="w-4 h-4 rounded text-blue-600"
                                        />
                                        <span className="text-gray-600">
                                          تلگرام
                                        </span>
                                      </label>
                                      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                        <input
                                          type="checkbox"
                                          checked={platforms.includes("bale")}
                                          onChange={() =>
                                            togglePlatform("bale")
                                          }
                                          className="w-4 h-4 rounded text-green-600"
                                        />
                                        <span className="text-gray-600">
                                          بله
                                        </span>
                                      </label>
                                    </div>
                                  </div>
                                );
                              },
                            )}
                            {(settings.salesNotificationUsers || []).length ===
                              0 && (
                              <div className="text-sm text-gray-400 text-center py-6">
                                هنوز هیچ مدیری اضافه نشده است.
                              </div>
                            )}
                          </div>

                          <div className="mt-4 p-4 bg-blue-50/30 rounded-xl border border-dashed border-blue-200">
                            <h5 className="text-xs font-bold text-blue-700 mb-3 flex items-center gap-1.5">
                              <Plus size={14} /> افزودن مدیر جدید
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                              {systemUsers
                                .filter(
                                  (u) =>
                                    !(
                                      settings.salesNotificationUsers || []
                                    ).some(
                                      (item) => item.username === u.username,
                                    ),
                                )
                                .map((u) => (
                                  <button
                                    key={u.id}
                                    type="button"
                                    onClick={() =>
                                      setSettings({
                                        ...settings,
                                        salesNotificationUsers: [
                                          ...(settings.salesNotificationUsers ||
                                            []),
                                          {
                                            username: u.username,
                                            name: u.fullName,
                                            platforms: ["telegram", "bale"],
                                          },
                                        ],
                                      })
                                    }
                                    className="flex items-center gap-2 p-2 glass-panel rounded-lg border border-gray-100 hover:border-blue-300 hover:shadow-sm transition-all text-right"
                                  >
                                    <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px]">
                                      <Plus size={10} />
                                    </div>
                                    <span className="text-xs font-bold truncate flex-1">
                                      {u.fullName}
                                    </span>
                                  </button>
                                ))}
                            </div>

                            <div className="flex flex-col gap-2 glass-panel p-3 rounded-xl shadow-sm">
                              <span className="text-[10px] font-bold text-gray-400">
                                افزودن بصورت شناسه‌ی دستی:
                              </span>
                              <div className="flex gap-2">
                                <input
                                  id="manual-manager-name"
                                  type="text"
                                  placeholder="نام مدیر..."
                                  className="flex-1 border rounded p-2 text-xs"
                                />
                                <input
                                  id="manual-manager-id"
                                  type="text"
                                  placeholder="Chat ID / Username..."
                                  className="flex-1 border rounded p-2 text-xs dir-ltr"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nameInput = document.getElementById(
                                      "manual-manager-name",
                                    ) as HTMLInputElement;
                                    const idInput = document.getElementById(
                                      "manual-manager-id",
                                    ) as HTMLInputElement;
                                    const name = nameInput.value.trim();
                                    const id = idInput.value.trim();
                                    if (name && id) {
                                      setSettings({
                                        ...settings,
                                        salesNotificationUsers: [
                                          ...(settings.salesNotificationUsers ||
                                            []),
                                          {
                                            username: id,
                                            name: name,
                                            platforms: ["telegram", "bale"],
                                          },
                                        ],
                                      });
                                      nameInput.value = "";
                                      idInput.value = "";
                                    } else {
                                      alert(
                                        "لطفاً هم نام و هم شناسه را وارد کنید.",
                                      );
                                    }
                                  }}
                                  className="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold hover:bg-blue-700"
                                >
                                  افزودن
                                </button>
                              </div>
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-3 glass-panel p-2 rounded border border-gray-100 leading-relaxed">
                            💡 پیام‌های مشتریان و سفارشات ثبت شده در ربات برای
                            این کاربران ارسال خواهد شد.
                            <br />
                            ⚠️ مدیران باید حتماً ربات را در پلتفرم مربوطه
                            (تلگرام یا بله) <b>استارت</b> کرده باشند.
                          </p>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-gray-400 block mb-1">
                            حمایت و پشتیبانی
                          </label>
                          <p className="text-[10px] text-gray-400">
                            برای افزودن کادرها و دکمه‌های دلخواه در منوی شروع
                            ربات، از بخش "لینک‌های مرتبط فروشگاه" در ابتدای همین
                            صفحه استفاده کنید.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <BotManager />
              </div>
            )}

            {activeCategory === "meetings" && (
              <div className="space-y-6 animate-fade-in">
                <h3 className="font-bold text-gray-800 border-b pb-3 flex items-center gap-2">
                  <ClipboardList size={22} className="text-indigo-600" />{" "}
                  تنظیمات صورتجلسات تولید
                </h3>

                {/* Meeting Roles Management */}
                <div className="bg-white/50 dark:bg-gray-800 border rounded-2xl p-5 mb-6">
                  <h4 className="font-bold text-sm text-gray-700 dark:text-gray-200 border-b pb-2 mb-4 flex items-center gap-2">
                    <Users size={18} className="text-blue-500" /> مدیریت سمت‌های
                    جلسات
                  </h4>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      id="newMeetingRole"
                      placeholder="مثلاً: رئیس جلسه، دبیر جلسه، مدیر تولید..."
                      className="flex-1 border rounded-xl p-2.5 text-xs bg-white focus:ring-2 outline-none"
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const input = e.currentTarget;
                          const role = input.value.trim();
                          if (
                            role &&
                            !(settings.meetingRoles || []).includes(role)
                          ) {
                            setSettings({
                              ...settings,
                              meetingRoles: [
                                ...(settings.meetingRoles || []),
                                role,
                              ],
                            });
                            input.value = "";
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById(
                          "newMeetingRole",
                        ) as HTMLInputElement;
                        const role = input?.value.trim();
                        if (
                          role &&
                          !(settings.meetingRoles || []).includes(role)
                        ) {
                          setSettings({
                            ...settings,
                            meetingRoles: [
                              ...(settings.meetingRoles || []),
                              role,
                            ],
                          });
                          input.value = "";
                        }
                      }}
                      className="bg-indigo-600 text-white px-4 rounded-xl text-xs font-bold hover:bg-indigo-700"
                    >
                      افزودن سمت
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      settings.meetingRoles || [
                        "رئیس جلسه",
                        "دبیر جلسه",
                        "عضو حاضر",
                      ]
                    ).map((role) => (
                      <div
                        key={role}
                        className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                      >
                        <span>{role}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSettings({
                              ...settings,
                              meetingRoles: (
                                settings.meetingRoles || []
                              ).filter((r) => r !== role),
                            });
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">
                    💡 سمت "رئیس جلسه" به طور خودکار به عنوان رئیس در سربرگ قرار
                    می‌گیرد.
                  </p>
                </div>

                <div className="bg-white/50 dark:bg-gray-800 border rounded-2xl p-5 mb-6">
                  <h4 className="font-bold text-sm text-gray-700 dark:text-gray-200 border-b pb-2 mb-4">
                    لیست افراد ثابت و سمت پیش‌فرض
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-gray-500 block mb-1">
                          انتخاب کاربر
                        </label>
                        <select
                          className="w-full border rounded-xl p-2.5 text-xs bg-white focus:ring-2 outline-none"
                          id="newDefaultAttendee"
                        >
                          <option value="">-- انتخاب --</option>
                          {systemUsers.map((u) => (
                            <option key={u.username} value={u.username}>
                              {u.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-gray-500 block mb-1">
                          انتخاب سمت پیش‌فرض
                        </label>
                        <select
                          className="w-full border rounded-xl p-2.5 text-xs bg-white focus:ring-2 outline-none"
                          id="newDefaultAttendeeRole"
                        >
                          <option value="">-- سمت --</option>
                          {(
                            settings.meetingRoles || [
                              "رئیس جلسه",
                              "دبیر جلسه",
                              "عضو حاضر",
                            ]
                          ).map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => {
                            const selUser = document.getElementById(
                              "newDefaultAttendee",
                            ) as HTMLSelectElement;
                            const selRole = document.getElementById(
                              "newDefaultAttendeeRole",
                            ) as HTMLSelectElement;
                            if (selUser.value && selRole.value) {
                              const current =
                                settings.defaultMeetingAttendeesData || [];
                              // Update if exists, else add
                              const exists = current.find(
                                (a) => a.username === selUser.value,
                              );
                              let updated;
                              if (exists) {
                                updated = current.map((a) =>
                                  a.username === selUser.value
                                    ? { ...a, role: selRole.value }
                                    : a,
                                );
                              } else {
                                updated = [
                                  ...current,
                                  {
                                    username: selUser.value,
                                    role: selRole.value,
                                  },
                                ];
                              }
                              setSettings({
                                ...settings,
                                defaultMeetingAttendeesData: updated,
                              });
                              selUser.value = "";
                              selRole.value = "";
                            } else {
                              alert("لطفاً هم کاربر و هم سمت را انتخاب کنید.");
                            }
                          }}
                          className="bg-blue-600 text-white px-6 h-10 rounded-xl text-xs font-bold hover:bg-blue-700 w-full"
                        >
                          افزودن به لیست ثابت
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {settings.defaultMeetingAttendeesData?.map((att) => {
                        const user = systemUsers.find(
                          (u) => u.username === att.username,
                        );
                        return (
                          <div
                            key={att.username}
                            className="flex items-center justify-between p-3 glass-panel border rounded-xl shadow-sm hover:border-blue-300 transition-all group"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                {user?.fullName.charAt(0)}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-gray-800">
                                  {user?.fullName || att.username}
                                </div>
                                <div className="text-[10px] text-blue-600 font-bold">
                                  {att.role}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSettings({
                                  ...settings,
                                  defaultMeetingAttendeesData:
                                    settings.defaultMeetingAttendeesData?.filter(
                                      (a) => a.username !== att.username,
                                    ),
                                });
                              }}
                              className="p-1 px-2 text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {(!settings.defaultMeetingAttendeesData ||
                      settings.defaultMeetingAttendeesData.length === 0) && (
                      <div className="text-center py-6 text-gray-400 text-xs italic">
                        لیست افراد ثابت خالی است.
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-bold text-sm text-gray-700 border-r-4 border-blue-500 pr-2">
                      اعلامیه‌ی برگزاری (Announcements)
                    </h4>
                    <p className="text-xs text-gray-500 pr-2 leading-relaxed">
                      گروه‌هایی که اعلان برگزاری جلسه به آن‌ها ارسال می‌شود.
                    </p>
                    <div className="space-y-4 glass-panel p-5 rounded-2xl border bg-white/50">
                      <div>
                        <label className="text-[11px] font-bold text-gray-500 block mb-1.5 flex items-center gap-2">
                          <Send size={14} /> شناسه تلگرام
                        </label>
                        <input
                          className="w-full border rounded-xl p-2.5 text-xs dir-ltr font-mono bg-white focus:ring-2 ring-blue-500"
                          value={
                            settings.botMeetingAnnouncementTelegramId || ""
                          }
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              botMeetingAnnouncementTelegramId: e.target.value,
                            })
                          }
                          placeholder="-100..."
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-500 block mb-1.5 flex items-center gap-2">
                          <MessageCircle size={14} /> شناسه بله
                        </label>
                        <input
                          className="w-full border rounded-xl p-2.5 text-xs dir-ltr font-mono bg-white focus:ring-2 ring-blue-500"
                          value={settings.botMeetingAnnouncementBaleId || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              botMeetingAnnouncementBaleId: e.target.value,
                            })
                          }
                          placeholder="ID..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-bold text-sm text-gray-700 border-r-4 border-emerald-500 pr-2">
                      ارسال فایل صورتجلسه (Final Minutes)
                    </h4>
                    <p className="text-xs text-gray-500 pr-2 leading-relaxed">
                      گروه‌هایی که فایل نهایی پس از تایید به آن‌ها ارسال می‌شود
                      (گروه تولید).
                    </p>
                    <div className="space-y-4 glass-panel p-5 rounded-2xl border bg-white/50">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 block mb-1.5 flex items-center gap-2">
                            <Send size={14} /> تلگرام (گروه اول)
                          </label>
                          <input
                            className="w-full border rounded-xl p-2.5 text-xs dir-ltr font-mono bg-white focus:ring-2 ring-emerald-500 shadow-sm"
                            value={settings.botMeetingMinutesTelegramId || ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                botMeetingMinutesTelegramId: e.target.value,
                              })
                            }
                            placeholder="-100..."
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 block mb-1.5 flex items-center gap-2">
                            <Send size={14} /> تلگرام (گروه دوم)
                          </label>
                          <input
                            className="w-full border rounded-xl p-2.5 text-xs dir-ltr font-mono bg-white focus:ring-2 ring-emerald-500 shadow-sm"
                            value={
                              settings.botMeetingMinutesSecondGroupIdTele || ""
                            }
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                botMeetingMinutesSecondGroupIdTele:
                                  e.target.value,
                              })
                            }
                            placeholder="-100..."
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 block mb-1.5 flex items-center gap-2">
                            <MessageCircle size={14} /> بله (گروه اول)
                          </label>
                          <input
                            className="w-full border rounded-xl p-2.5 text-xs dir-ltr font-mono bg-white focus:ring-2 ring-emerald-500 shadow-sm"
                            value={settings.botMeetingMinutesBaleId || ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                botMeetingMinutesBaleId: e.target.value,
                              })
                            }
                            placeholder="ID..."
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 block mb-1.5 flex items-center gap-2">
                            <MessageCircle size={14} /> بله (گروه دوم)
                          </label>
                          <input
                            className="w-full border rounded-xl p-2.5 text-xs dir-ltr font-mono bg-white focus:ring-2 ring-emerald-500 shadow-sm"
                            value={
                              settings.botMeetingMinutesSecondGroupIdBale || ""
                            }
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                botMeetingMinutesSecondGroupIdBale:
                                  e.target.value,
                              })
                            }
                            placeholder="ID..."
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 block mb-1.5 flex items-center gap-2">
                            <Truck size={14} /> واتساپ (گروه اول)
                          </label>
                          <input
                            className="w-full border rounded-xl p-2.5 text-xs dir-ltr font-mono bg-white focus:ring-2 ring-emerald-500 shadow-sm"
                            value={
                              settings.botMeetingMinutesWhatsAppId ||
                              settings.botMeetingMinutesGroupId ||
                              ""
                            }
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                botMeetingMinutesWhatsAppId: e.target.value,
                              })
                            }
                            placeholder="JID..."
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 block mb-1.5 flex items-center gap-2">
                            <Truck size={14} /> واتساپ (گروه دوم)
                          </label>
                          <input
                            className="w-full border rounded-xl p-2.5 text-xs dir-ltr font-mono bg-white focus:ring-2 ring-emerald-500 shadow-sm"
                            value={
                              settings.botMeetingMinutesSecondGroupIdWhatsApp ||
                              ""
                            }
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                botMeetingMinutesSecondGroupIdWhatsApp:
                                  e.target.value,
                              })
                            }
                            placeholder="JID..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 md:p-6 mb-6">
                  <h4 className="font-black text-amber-900 text-sm mb-2">
                    یادآوری مهم:
                  </h4>
                  <ul className="text-xs text-amber-800 space-y-2 leading-relaxed list-disc pr-4 font-bold">
                    <li>
                      شناسه گروه‌های تلگرام معمولاً با{" "}
                      <code className="bg-amber-100 px-1 rounded">-100</code>{" "}
                      شروع می‌شوند.
                    </li>
                    <li>
                      از ربات‌های کمکی می‌توانید برای دریافت شناسه (Chat ID)
                      گروه‌ها استفاده کنید.
                    </li>
                    <li>
                      برای ارسال به واتساپ، فعلاً ارسال گروهی بر اساس شناسه گروه
                      واتساپ (JID) انجام می‌شود.
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {activeCategory === "secretariat" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-2">
                    <FileText className="text-purple-600" /> تنظیمات دبیرخانه
                  </h3>
                  <div className="text-xs font-bold text-gray-500">
                    مختص هر شرکت
                  </div>
                </div>

                {settings.companies && settings.companies.length > 0 ? (
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                      <label className="text-sm font-bold text-gray-700">
                        شرکت را انتخاب کنید:
                      </label>
                      <select
                        className="border-2 border-purple-200 rounded-xl p-2 text-sm focus:border-purple-500 min-w-[200px]"
                        value={selectedCompanyIdForSec}
                        onChange={(e) =>
                          setSelectedCompanyIdForSec(e.target.value)
                        }
                      >
                        {settings.companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedCompanyIdForSec && (
                      <div className="bg-white/50 dark:bg-gray-800 border rounded-2xl p-5 md:p-6 shadow-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3 bg-slate-50/50 p-4 border rounded-xl">
                            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                              <Lock size={14} className="text-purple-600" />{" "}
                              دسترسی به دبیرخانه دفتر مرکزی
                            </label>
                            <div className="max-h-40 overflow-y-auto border bg-white rounded-lg p-2.5 space-y-1.5">
                              {systemUsers.map((u) => {
                                const isChecked =
                                  secSettingsForm.headquartersAccessTokens?.includes(
                                    u.id,
                                  );
                                return (
                                  <label
                                    key={u.id}
                                    className="flex items-center gap-2 text-xs hover:bg-slate-50 p-1 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        let tokens = [
                                          ...(secSettingsForm.headquartersAccessTokens ||
                                            []),
                                        ];
                                        if (tokens.includes(u.id))
                                          tokens = tokens.filter(
                                            (t) => t !== u.id,
                                          );
                                        else tokens.push(u.id);
                                        setSecSettingsForm({
                                          ...secSettingsForm,
                                          headquartersAccessTokens: tokens,
                                        });
                                      }}
                                      className="rounded text-purple-600 focus:ring-purple-500 w-3.5 h-3.5"
                                    />
                                    <span className="font-bold text-gray-700">
                                      {u.fullName}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-3 bg-slate-50/50 p-4 border rounded-xl">
                            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                              <Lock size={14} className="text-indigo-600" />{" "}
                              دسترسی به دبیرخانه کارخانه
                            </label>
                            <div className="max-h-40 overflow-y-auto border bg-white rounded-lg p-2.5 space-y-1.5">
                              {systemUsers.map((u) => {
                                const isChecked =
                                  secSettingsForm.factoryAccessTokens?.includes(
                                    u.id,
                                  );
                                return (
                                  <label
                                    key={u.id}
                                    className="flex items-center gap-2 text-xs hover:bg-slate-50 p-1 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        let tokens = [
                                          ...(secSettingsForm.factoryAccessTokens ||
                                            []),
                                        ];
                                        if (tokens.includes(u.id))
                                          tokens = tokens.filter(
                                            (t) => t !== u.id,
                                          );
                                        else tokens.push(u.id);
                                        setSecSettingsForm({
                                          ...secSettingsForm,
                                          factoryAccessTokens: tokens,
                                        });
                                      }}
                                      className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                    />
                                    <span className="font-bold text-gray-700">
                                      {u.fullName}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                          <div className="space-y-3 bg-slate-50/50 p-4 border rounded-xl">
                            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                              <Lock size={14} className="text-amber-600" />{" "}
                              دسترسی به ویرایش نامه‌ها
                            </label>
                            <div className="max-h-40 overflow-y-auto border bg-white rounded-lg p-2.5 space-y-1.5">
                              {systemUsers.map((u) => {
                                const isChecked =
                                  secSettingsForm.editAccessTokens?.includes(
                                    u.id,
                                  );
                                return (
                                  <label
                                    key={u.id}
                                    className="flex items-center gap-2 text-xs hover:bg-slate-50 p-1 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        let tokens = [
                                          ...(secSettingsForm.editAccessTokens ||
                                            []),
                                        ];
                                        if (tokens.includes(u.id))
                                          tokens = tokens.filter(
                                            (t) => t !== u.id,
                                          );
                                        else tokens.push(u.id);
                                        setSecSettingsForm({
                                          ...secSettingsForm,
                                          editAccessTokens: tokens,
                                        });
                                      }}
                                      className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                                    />
                                    <span className="font-bold text-gray-700">
                                      {u.fullName}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-3 bg-slate-50/50 p-4 border rounded-xl">
                            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                              <Lock size={14} className="text-red-600" /> دسترسی
                              به حذف نامه‌ها
                            </label>
                            <div className="max-h-40 overflow-y-auto border bg-white rounded-lg p-2.5 space-y-1.5">
                              {systemUsers.map((u) => {
                                const isChecked =
                                  secSettingsForm.deleteAccessTokens?.includes(
                                    u.id,
                                  );
                                return (
                                  <label
                                    key={u.id}
                                    className="flex items-center gap-2 text-xs hover:bg-slate-50 p-1 rounded cursor-pointer"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        let tokens = [
                                          ...(secSettingsForm.deleteAccessTokens ||
                                            []),
                                        ];
                                        if (tokens.includes(u.id))
                                          tokens = tokens.filter(
                                            (t) => t !== u.id,
                                          );
                                        else tokens.push(u.id);
                                        setSecSettingsForm({
                                          ...secSettingsForm,
                                          deleteAccessTokens: tokens,
                                        });
                                      }}
                                      className="rounded text-red-600 focus:ring-red-500 w-3.5 h-3.5"
                                    />
                                    <span className="font-bold text-gray-700">
                                      {u.fullName}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-dashed">
                          {/* Upload Letterhead */}
                          <div className="space-y-4">
                            <div>
                              <h4 className="font-bold text-sm text-gray-700 mb-2 border-b pb-1">
                                سربرگ نامه (تصویر برای پیش‌نمایش)
                              </h4>
                              <p className="text-[10px] text-gray-500 mb-2">
                                تصویر سربرگ شرکت خود را با فرمت تصویر (JPG/PNG)
                                آپلود کنید. این تصویر برای پیش‌نمایش نامه در
                                سیستم و همچنین چاپ مستقیم استفاده می‌شود.
                              </p>
                              <div className="flex flex-col gap-2">
                                <input
                                  type="file"
                                  ref={secLetterheadInputRef}
                                  className="hidden"
                                  onChange={handleSecLetterheadUpload}
                                  accept="image/*"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    secLetterheadInputRef.current?.click()
                                  }
                                  className="bg-purple-100 text-purple-700 font-bold px-4 py-2 rounded-xl text-xs hover:bg-purple-200 w-full"
                                  disabled={isUploadingSecLetterhead}
                                >
                                  {isUploadingSecLetterhead
                                    ? "در حال آپلود..."
                                    : "انتخاب تصویر سربرگ"}
                                </button>
                                {secSettingsForm.letterheadUrl &&
                                  !secSettingsForm.letterheadUrl
                                    .toLowerCase()
                                    .endsWith(".pdf") && (
                                    <div className="mt-2 border rounded-xl overflow-hidden relative">
                                      <img
                                        src={secSettingsForm.letterheadUrl}
                                        className="w-full max-h-40 object-contain bg-gray-100"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSecSettingsForm({
                                            ...secSettingsForm,
                                            letterheadUrl: "",
                                          })
                                        }
                                        className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  )}
                              </div>
                            </div>

                            <div>
                              <h4 className="font-bold text-sm text-gray-700 mb-2 border-b pb-1">
                                سربرگ نامه (PDF با کیفیت اصلی)
                              </h4>
                              <p className="text-[10px] text-gray-500 mb-2">
                                جهت افت نکردن کیفیت در خروجی‌های <b>PDF</b> رسمی
                                سیستم، لطفاً فایل سربرگ خام را به صورت{" "}
                                <b>PDF</b> آپلود نمایید. در صورت خالی بودن، از
                                تصویر بالا استفاده می‌شود.
                              </p>
                              <div className="flex flex-col gap-2">
                                <input
                                  type="file"
                                  ref={secPdfLetterheadInputRef}
                                  className="hidden"
                                  onChange={handleSecPdfLetterheadUpload}
                                  accept="application/pdf"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    secPdfLetterheadInputRef.current?.click()
                                  }
                                  className="bg-indigo-100 text-indigo-700 font-bold px-4 py-2 rounded-xl text-xs hover:bg-indigo-200 w-full"
                                  disabled={isUploadingSecPdfLetterhead}
                                >
                                  {isUploadingSecPdfLetterhead
                                    ? "در حال آپلود..."
                                    : "انتخاب فایل PDF سربرگ"}
                                </button>
                                {secSettingsForm.pdfLetterheadUrl && (
                                  <div className="mt-2 border rounded-xl overflow-hidden relative">
                                    <div className="w-full h-16 bg-indigo-50 flex items-center justify-center text-xs text-indigo-700 font-bold">
                                      فایل PDF سربرگ بارگذاری شده است
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSecSettingsForm({
                                          ...secSettingsForm,
                                          pdfLetterheadUrl: "",
                                        })
                                      }
                                      className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"
                                    >
                                      <X size={14} />
                                    </button>
                                  </div>
                                )}
                                {/* Fallback support for older DB state where PDF was uploaded to letterheadUrl */}
                                {secSettingsForm.letterheadUrl &&
                                  secSettingsForm.letterheadUrl
                                    .toLowerCase()
                                    .endsWith(".pdf") &&
                                  !secSettingsForm.pdfLetterheadUrl && (
                                    <div className="mt-2 border rounded-xl overflow-hidden relative">
                                      <div className="w-full h-16 bg-indigo-50 flex items-center justify-center text-xs text-indigo-700 font-bold">
                                        فایل PDF سربرگ از قبل بارگذاری شده است
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>

                          {/* Upload Stamp */}
                          <div>
                            <h4 className="font-bold text-sm text-gray-700 mb-2 border-b pb-1">
                              مهر شرکت
                            </h4>
                            <div className="flex flex-col gap-2">
                              <input
                                type="file"
                                ref={secStampInputRef}
                                className="hidden"
                                onChange={handleSecStampUpload}
                                accept="image/*"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  secStampInputRef.current?.click()
                                }
                                className="bg-indigo-100 text-indigo-700 font-bold px-4 py-2 rounded-xl text-xs hover:bg-indigo-200 w-full"
                                disabled={isUploadingSecStamp}
                              >
                                {isUploadingSecStamp
                                  ? "در حال آپلود..."
                                  : "انتخاب تصویر مهر"}
                              </button>
                              {secSettingsForm.companyStampUrl && (
                                <div className="mt-2 border rounded-xl overflow-hidden relative flex justify-center items-center h-40 bg-gray-50">
                                  <img
                                    src={secSettingsForm.companyStampUrl}
                                    className="max-h-full object-contain"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSecSettingsForm({
                                        ...secSettingsForm,
                                        companyStampUrl: "",
                                      })
                                    }
                                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 pt-6 border-t border-dashed">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 block mb-1">
                              اندازه مهر (پیکسل)
                            </label>
                            <input
                              type="number"
                              value={secSettingsForm.companyStampSize}
                              onChange={(e) =>
                                setSecSettingsForm({
                                  ...secSettingsForm,
                                  companyStampSize: Number(e.target.value),
                                })
                              }
                              className="w-full border rounded-xl p-2.5 text-xs focus:ring-2 dir-ltr"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-500 block mb-1">
                              شفافیت مهر (%)
                            </label>
                            <input
                              type="number"
                              max="100"
                              min="10"
                              value={secSettingsForm.companyStampOpacity}
                              onChange={(e) =>
                                setSecSettingsForm({
                                  ...secSettingsForm,
                                  companyStampOpacity: Number(e.target.value),
                                })
                              }
                              className="w-full border rounded-xl p-2.5 text-xs focus:ring-2 dir-ltr"
                            />
                          </div>

                          <div className="flex items-center">
                            <label className="flex items-center gap-2 cursor-pointer mt-4">
                              <input
                                type="checkbox"
                                checked={secSettingsForm.hideAutoFooter}
                                onChange={(e) =>
                                  setSecSettingsForm({
                                    ...secSettingsForm,
                                    hideAutoFooter: e.target.checked,
                                  })
                                }
                                className="w-5 h-5 text-purple-600 rounded"
                              />
                              <span className="text-sm font-bold text-gray-700">
                                عدم نمایش پاورقی خودکار (در صورت داشتن سربرگ
                                عکس‌دار)
                              </span>
                            </label>
                          </div>
                        </div>

                        {/* Preview Metadata */}
                        <div className="mt-8">
                          <h4 className="font-bold text-sm text-gray-700 mb-4 border-b pb-2">
                            موقعیت اطلاعات (شماره/تاریخ/پیوست) روی سربرگ
                          </h4>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">
                                  فاصله از بالا (میلی‌متر)
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="150"
                                  value={secSettingsForm.metadataTop}
                                  onChange={(e) =>
                                    setSecSettingsForm({
                                      ...secSettingsForm,
                                      metadataTop: Number(e.target.value),
                                    })
                                  }
                                  className="w-full"
                                />
                                <div className="text-center text-xs font-bold text-purple-600">
                                  {secSettingsForm.metadataTop} mm
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">
                                  فاصله از چپ (میلی‌متر)
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="150"
                                  value={secSettingsForm.metadataLeft}
                                  onChange={(e) =>
                                    setSecSettingsForm({
                                      ...secSettingsForm,
                                      metadataLeft: Number(e.target.value),
                                    })
                                  }
                                  className="w-full"
                                />
                                <div className="text-center text-xs font-bold text-purple-600">
                                  {secSettingsForm.metadataLeft} mm
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">
                                  اندازه قلم اطلاعات (پیکسل)
                                </label>
                                <input
                                  type="number"
                                  value={secSettingsForm.metadataFontSize}
                                  onChange={(e) =>
                                    setSecSettingsForm({
                                      ...secSettingsForm,
                                      metadataFontSize: Number(e.target.value),
                                    })
                                  }
                                  className="w-full border rounded-xl p-2.5 text-xs focus:ring-2 dir-ltr"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">
                                  میزان پررنگی / کدر بودن اطلاعات (درصد)
                                </label>
                                <input
                                  type="range"
                                  min="10"
                                  max="100"
                                  step="5"
                                  value={secSettingsForm.metadataOpacity ?? 100}
                                  onChange={(e) =>
                                    setSecSettingsForm({
                                      ...secSettingsForm,
                                      metadataOpacity: Number(e.target.value),
                                    })
                                  }
                                  className="w-full text-purple-600"
                                />
                                <div className="text-center text-xs font-bold text-purple-600">
                                  {secSettingsForm.metadataOpacity ?? 100}%
                                </div>
                              </div>
                              <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">
                                  میزان ضخامت قلم اطلاعات
                                </label>
                                <select
                                  value={
                                    secSettingsForm.metadataFontWeight || "bold"
                                  }
                                  onChange={(e) =>
                                    setSecSettingsForm({
                                      ...secSettingsForm,
                                      metadataFontWeight: e.target.value as any,
                                    })
                                  }
                                  className="w-full border rounded-xl p-2.5 text-xs focus:ring-2"
                                >
                                  <option value="normal">
                                    Normal (معمولی)
                                  </option>
                                  <option value="bold">Bold (ضخیم)</option>
                                  <option value="bolder">
                                    Bolder (خیلی ضخیم)
                                  </option>
                                  <option value="black">
                                    Black (کاملا سیاه)
                                  </option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-bold text-gray-500 block mb-1">
                                  نوع فونت نامه
                                </label>
                                <select
                                  value={
                                    secSettingsForm.letterheadFontFamily ||
                                    "Vazirmatn"
                                  }
                                  onChange={(e) =>
                                    setSecSettingsForm({
                                      ...secSettingsForm,
                                      letterheadFontFamily: e.target.value,
                                    })
                                  }
                                  className="w-full border rounded-xl p-2.5 text-xs focus:ring-2"
                                >
                                  <option value="Vazirmatn">
                                    Vazirmatn (وزیرمتن - پیش‌فرض)
                                  </option>
                                  <option value="Shabnam">
                                    Shabnam (شبنم)
                                  </option>
                                  <option value="Sahel">Sahel (ساحل)</option>
                                  <option value="Gandom">Gandom (گندم)</option>
                                  <option value="Samim">Samim (سمیم)</option>
                                  <option value="Tahoma">Tahoma</option>
                                  <option value="Arial">Arial</option>
                                  <option value="B Nazanin">B Nazanin</option>
                                  <option value="B Titr">B Titr</option>
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={handleSaveSecSettings}
                                className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 font-bold text-sm shadow-md transition-colors mt-4"
                              >
                                ذخیره تنظیمات دبیرخانه
                              </button>
                            </div>

                            {/* Live Preview Pane */}
                            <div className="border border-gray-300 rounded-lg p-2 bg-gray-100 flex items-center justify-center overflow-hidden">
                              <div
                                className="relative bg-white shadow-sm border border-gray-200 w-full"
                                style={{
                                  aspectRatio: "1 / 1.414",
                                  backgroundImage: secSettingsForm.letterheadUrl
                                    ? `url(${secSettingsForm.letterheadUrl})`
                                    : "none",
                                  backgroundSize: "100% 100%",
                                }}
                              >
                                <div
                                  className="absolute border border-dashed border-red-500 bg-white/50 text-right p-1"
                                  style={{
                                    top: `${secSettingsForm.metadataTop}mm`,
                                    left: `${secSettingsForm.metadataLeft}mm`,
                                    fontSize: `${secSettingsForm.metadataFontSize}px`,
                                    fontFamily:
                                      secSettingsForm.letterheadFontFamily,
                                    opacity:
                                      (secSettingsForm.metadataOpacity ?? 100) /
                                      100,
                                    fontWeight:
                                      secSettingsForm.metadataFontWeight ||
                                      "bold",
                                    lineHeight: "1.5",
                                  }}
                                >
                                  <div>شماره: ۱۲۳/۴۵۶</div>
                                  <div>تاریخ: ۱۴۰۳/۰۱/۰۱</div>
                                  <div>پیوست: دارد</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-gray-50 border rounded-2xl text-gray-500 font-bold text-sm">
                    ابتدا در بخش "اطلاعات پایه" حداقل یک شرکت تعریف کنید.
                  </div>
                )}

                {/* --- Templates Management --- */}
                <div className="bg-white/50 dark:bg-gray-800 border rounded-2xl p-5 md:p-6 shadow-sm space-y-6 mt-8">
                  <div className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                        <FileText size={18} />
                      </span>
                      <div>
                        <h3 className="text-sm font-black text-slate-800">
                          بانک نمونه نامه‌ها (قالب‌های آماده)
                        </h3>
                        <p className="text-[10px] text-slate-400">
                          نامه‌های تکراری و پرکاربرد را ذخیره کنید تا هنگام ثبت
                          نامه جدید، به سرعت فراخوانی شوند.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        setEditingSecTemplate({
                          title: "",
                          category: "اداری",
                          subject: "",
                          content: "",
                        })
                      }
                      className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all"
                    >
                      <Plus size={14} /> ایجاد نمونه نامه جدید
                    </button>
                  </div>

                  {/* Templates List */}
                  {secTemplates.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      هیچ نمونه نامه‌ای تعریف نشده است. با زدن دکمه بالا اولین
                      نمونه نامه را بسازید.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {secTemplates.map((temp) => (
                        <div
                          key={temp.id}
                          className="border border-slate-100 rounded-xl p-4 hover:shadow-sm transition-all bg-slate-50 flex flex-col justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">
                                {temp.category || "عمومی"}
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-800 text-xs">
                              {temp.title}
                            </h4>
                            <p className="text-[10px] text-slate-400 line-clamp-1">
                              موضوع: {temp.subject || "-"}
                            </p>
                          </div>

                          <div className="flex items-center justify-end gap-2 border-t pt-2 mt-1">
                            <button
                              onClick={() => setEditingSecTemplate(temp)}
                              className="text-slate-500 hover:text-slate-700 text-[10px] font-bold bg-white px-2 py-1 border rounded"
                            >
                              ویرایش
                            </button>
                            <button
                              onClick={() => handleDeleteSecTemplate(temp.id)}
                              className="text-red-500 hover:text-red-700 text-[10px] font-bold bg-white px-2 py-1 border rounded"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeCategory === "permissions" && (
              <div className="space-y-6 animate-fade-in">
                <RolePermissionsEditor
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                />
              </div>
            )}

            {activeCategory === "templates" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <LayoutTemplate size={20} /> مدیریت قالب‌های چاپ (چک / فیش)
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowDesigner(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1"
                  >
                    <Plus size={16} /> طراحی قالب جدید
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {settings.printTemplates?.map((t) => (
                    <div
                      key={t.id}
                      className="glass-panel p-4 rounded-xl border hover:shadow-md transition-all group relative overflow-hidden"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-gray-800">{t.name}</h4>
                          <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {t.pageSize} - {t.orientation}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditTemplate(t)}
                            className="text-blue-500 hover:bg-blue-50 p-1.5 rounded"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(t.id)}
                            className="text-red-500 hover:bg-red-50 p-1.5 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-2">
                        {t.fields.length} فیلد تعریف شده
                      </div>
                    </div>
                  ))}
                  {(!settings.printTemplates ||
                    settings.printTemplates.length === 0) && (
                    <div className="col-span-full text-center text-gray-400 py-10">
                      قالبی یافت نشد.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeCategory === "camera" && (
              <div className="space-y-6 animate-fade-in text-right" dir="rtl">
                <div className="glass-panel p-6 rounded-2xl border border-gray-200/60 shadow-sm">
                  <h3 className="font-bold text-gray-800 dark:text-white mb-6 border-b pb-3 flex items-center gap-2">
                    <Camera size={22} className="text-cyan-600 animate-pulse" /> تنظیمات دوربین و تصویربرداری
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Right col: Settings parameters */}
                    <div className="space-y-6">
                      {/* Camera Connection Type */}
                      <div className="p-4 bg-gradient-to-tr from-cyan-50 to-blue-50 dark:from-cyan-950/20 dark:to-blue-950/20 rounded-xl border border-cyan-200 dark:border-cyan-900/40">
                        <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-2">
                          روش اتصال دوربین انتظامات
                        </label>
                        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-white/10 mb-3">
                          <button
                            type="button"
                            onClick={() => setCameraType("usb")}
                            className={`flex-1 py-1.5 rounded-md text-xs font-black transition-all ${
                              cameraType === "usb"
                                ? "bg-cyan-600 text-white shadow"
                                : "text-gray-600 dark:text-gray-400 hover:text-gray-800"
                            }`}
                          >
                            اتصال مستقیم (USB/وبکم)
                          </button>
                          <button
                            type="button"
                            onClick={() => setCameraType("network")}
                            className={`flex-1 py-1.5 rounded-md text-xs font-black transition-all ${
                              cameraType === "network"
                                ? "bg-cyan-600 text-white shadow"
                                : "text-gray-600 dark:text-gray-400 hover:text-gray-800"
                            }`}
                          >
                            دوربین تحت شبکه (IP Camera)
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-relaxed font-semibold">
                          دوربین‌های مستقیم از طریق پورت USB متصل می‌شوند. دوربین‌های تحت شبکه از طریق آدرس IP داخل شبکه کارخانه متصل می‌گردند.
                        </p>
                      </div>

                      {cameraType === "usb" ? (
                        /* Default camera selection */
                        <div className="p-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-gray-200 dark:border-white/10">
                          <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-2">
                            انتخاب دستگاه دوربین پیش‌فرض
                          </label>
                          {localCameras.length > 0 ? (
                            <select
                              value={defaultCameraId}
                              onChange={(e) => setDefaultCameraId(e.target.value)}
                              className="w-full text-xs border rounded-lg p-2 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans focus:ring-2 focus:ring-cyan-500 outline-none"
                            >
                              {localCameras.map((dev, i) => (
                                <option key={dev.deviceId} value={dev.deviceId}>
                                  {dev.label || `دوربین شماره ${i + 1}`}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">
                                مرورگر به اسامی دوربین‌ها دسترسی ندارد یا دوربینی یافت نشد. برای راه‌اندازی و شناسایی دوربین‌های متصل، روی دکمه زیر کلیک کنید.
                              </p>
                              <button
                                type="button"
                                onClick={requestCameraPermissionAndList}
                                className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40 rounded-lg text-xs font-black hover:bg-blue-100 transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                <Camera size={14} /> اسکن و فعال‌سازی دوربین‌ها
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Network camera configuration */
                        <div className="p-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-gray-200 dark:border-white/10 space-y-4">
                          <div>
                            <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">
                              آدرس جریان دوربین شبکه (MJPEG / Stream URL / Snapshots)
                            </label>
                            <input
                              type="text"
                              value={cameraNetworkUrl}
                              onChange={(e) => setCameraNetworkUrl(e.target.value)}
                              placeholder="مثال: http://192.168.1.100:8080/video"
                              dir="ltr"
                              className="w-full text-xs border rounded-lg p-2 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-mono focus:ring-2 focus:ring-cyan-500 outline-none"
                            />
                            <p className="text-[9px] text-gray-400 mt-1">
                              آدرس IP و پورت دوربین مداربسته یا گوشی موبایل شبیه‌ساز را وارد کنید.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">
                                نام کاربری (DVR / Camera)
                              </label>
                              <input
                                type="text"
                                value={cameraNetworkUsername}
                                onChange={(e) => setCameraNetworkUsername(e.target.value)}
                                placeholder="مثال: admin"
                                dir="ltr"
                                className="w-full text-xs border rounded-lg p-2 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-mono focus:ring-2 focus:ring-cyan-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1.5">
                                کلمه عبور (DVR / Camera)
                              </label>
                              <input
                                type="password"
                                value={cameraNetworkPassword}
                                onChange={(e) => setCameraNetworkPassword(e.target.value)}
                                placeholder="******"
                                dir="ltr"
                                className="w-full text-xs border rounded-lg p-2 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-mono focus:ring-2 focus:ring-cyan-500 outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-black text-gray-600 dark:text-gray-400 mb-1">
                                نوع جریان شبکه
                              </label>
                              <select
                                value={cameraNetworkType}
                                onChange={(e) => setCameraNetworkType(e.target.value as "mjpeg" | "snapshot")}
                                className="w-full text-xs border rounded-lg p-1.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans outline-none"
                              >
                                <option value="mjpeg">MJPEG (جریان ویدیویی متوالی)</option>
                                <option value="snapshot">JPEG (عکس‌های متوالی)</option>
                              </select>
                            </div>
                            {cameraNetworkType === "snapshot" && (
                              <div>
                                <label className="block text-[10px] font-black text-gray-600 dark:text-gray-400 mb-1">
                                  بازه به‌روزرسانی (میلی‌ثانیه)
                                </label>
                                <input
                                  type="number"
                                  value={cameraSnapshotInterval}
                                  onChange={(e) => setCameraSnapshotInterval(Math.max(100, parseInt(e.target.value, 10) || 1000))}
                                  className="w-full text-xs border rounded-lg p-1.5 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-mono outline-none"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Resolution setting */}
                      <div className="p-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-gray-200 dark:border-white/10">
                        <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-2">
                          کیفیت و رزولوشن تصویربرداری
                        </label>
                        <select
                          value={cameraResolution}
                          onChange={(e) => setCameraResolution(e.target.value)}
                          className="w-full text-xs border rounded-lg p-2 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans focus:ring-2 focus:ring-cyan-500 outline-none"
                        >
                          <option value="720p">استاندارد (720p - توصیه شده)</option>
                          <option value="1080p">کیفیت فوق‌العاده بالا (Full HD - 1080p)</option>
                          <option value="480p">سرعت بالا و حجم کم (480p)</option>
                        </select>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 leading-relaxed">
                          وضوح بالاتر برای فواصل دور یا نور ضعیف مناسب است اما بار پردازشی بیشتری به سیستم تحمیل می‌کند.
                        </p>
                      </div>

                      {/* Behavioral Toggles */}
                      <div className="p-4 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-gray-200 dark:border-white/10 space-y-4">
                        <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-2">حالت‌های نمایشی و رفتاری</h4>
                        
                        {/* Mirror */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">حالت آینه‌ای پیش‌نمایش تصویر (جهت افقی معکوس)</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={cameraMirror}
                              onChange={(e) => setCameraMirror(e.target.checked)}
                            />
                            <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                          </label>
                        </div>

                        {/* Auto-start */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">راه‌اندازی خودکار دوربین هنگام ورود به بخش دربان</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={cameraAutoStart}
                              onChange={(e) => setCameraAutoStart(e.target.checked)}
                            />
                            <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                          </label>
                        </div>

                        {/* Sound Feedback */}
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">پخش صدای بیپ کوتاه هنگام اسکن پلاک موفق</span>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={cameraBeepOnSuccess}
                              onChange={(e) => setCameraBeepOnSuccess(e.target.checked)}
                            />
                            <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Left col: Live Preview Test */}
                    <div className="p-5 bg-zinc-900 text-white rounded-2xl flex flex-col justify-between shadow-inner">
                      <div>
                        <h4 className="text-xs font-bold mb-1 flex items-center gap-1.5 text-cyan-400">
                          <span className="relative flex h-2 w-2">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75 ${isTestingCamera ? '' : 'hidden'}`}></span>
                            <span className={`relative inline-flex rounded-full h-2 w-2 bg-cyan-500 ${isTestingCamera ? '' : 'bg-gray-500'}`}></span>
                          </span>
                          تست زنده پیش‌نمایش دوربین
                        </h4>
                        <p className="text-[10px] text-zinc-400 mb-4 font-semibold leading-relaxed">
                          جهت اطمینان از عملکرد صحیح سخت‌افزار دوربین، کیفیت زاویه دید و کادربندی پلاک‌خوان می‌توانید پیش‌نمایش زنده را در اینجا بررسی کنید.
                        </p>
                        
                        <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-black aspect-video max-w-sm mx-auto shadow-2xl flex items-center justify-center">
                          {isTestingCamera ? (
                            cameraType === "network" ? (
                              <img
                                src={liveSnapshotBase64 || (cameraNetworkType === "snapshot" ? `${cameraNetworkUrl}${cameraNetworkUrl.includes('?') ? '&' : '?'}t=${snapshotTime}` : cameraNetworkUrl)}
                                referrerPolicy="no-referrer"
                                className={`w-full h-full object-contain ${cameraMirror ? 'transform -scale-x-100' : ''}`}
                                alt="Network Stream"
                                onError={(e) => {
                                  console.error("Network stream error");
                                }}
                              />
                            ) : (
                              <video
                                ref={testVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover ${cameraMirror ? 'transform -scale-x-100' : ''}`}
                              />
                            )
                          ) : (
                            <div className="text-center p-6 space-y-2">
                              <Camera className="mx-auto text-zinc-700" size={36} />
                              <p className="text-[11px] text-zinc-500 font-bold">پیش‌نمایش غیرفعال است</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        {!isTestingCamera ? (
                          <button
                            type="button"
                            onClick={startTestCamera}
                            className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Camera size={14} />
                            شروع تست دوربین انتخابی
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={stopTestCamera}
                            className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                          >
                            متوقف کردن تست
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeCategory === "integrations" && (
              <div className="space-y-6 animate-fade-in">
                <div className="glass-panel p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-6 border-b pb-3 flex items-center gap-2">
                    <Cpu size={22} className="text-blue-600" /> کنترل پنل هوش
                    مصنوعی و داده‌ها
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Zap className="text-red-600" size={20} />
                          <span className="font-black text-red-900 text-sm">
                            کلید قطع اضطراری AI
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={!settings.botAiEnabled}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                botAiEnabled: !e.target.checked,
                              })
                            }
                          />
                          <div className="w-11 h-6 bg-red-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:glass-panel after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                        </label>
                      </div>
                      <p className="text-[10px] text-red-700 font-bold leading-relaxed">
                        با فعال کردن این گزینه، تمامی درخواست‌های API به مدل‌های
                        هوش مصنوعی (Gemini/DeepSeek) بلافاصله متوقف می‌شود.
                      </p>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Layers className="text-blue-600" size={20} />
                          <span className="font-black text-blue-900 text-sm">
                            منبع داده فعال
                          </span>
                        </div>
                        <select
                          className="glass-panel border rounded-lg p-1.5 text-xs font-black outline-none focus:ring-2 ring-blue-500"
                          value={settings.botAiSource || "hybrid"}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              botAiSource: e.target.value as any,
                            })
                          }
                        >
                          <option value="gemini">Google Gemini</option>
                          <option value="deepseek">DeepSeek AI</option>
                          <option value="hybrid">ترکیبی (Hybrid)</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-600">
                          اولویت فایل اکسل (Offline)
                        </span>
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded text-blue-600"
                          checked={settings.excelPriority}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              excelPriority: e.target.checked,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-xs font-black text-gray-500 block mb-1">
                          DeepSeek API Key
                        </label>
                        <input
                          type="password"
                          placeholder="..."
                          className="w-full border rounded-xl p-3 text-sm dir-ltr"
                          value={settings.deepseekApiKey || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              deepseekApiKey: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs font-black text-gray-500 block mb-1">
                          بازه بروزرسانی خودکار (ساعت)
                        </label>
                        <select
                          className="w-full border rounded-xl p-3 text-sm font-bold"
                          value={settings.autoPriceUpdateInterval || 6}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              autoPriceUpdateInterval: Number(e.target.value),
                            })
                          }
                        >
                          {[1, 3, 6, 12, 24].map((h) => (
                            <option key={h} value={h}>
                              {h} ساعت یکبار
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-black text-gray-500 block mb-1">
                          آیدی پشتیبانی تلگرام
                        </label>
                        <input
                          type="text"
                          placeholder="@support_user"
                          className="w-full border rounded-xl p-3 text-sm dir-ltr"
                          value={settings.supportUsername || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              supportUsername: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="glass-panel p-6 rounded-2xl border border-gray-200 shadow-sm">
                  <h3 className="font-bold text-gray-800 mb-6 border-b pb-3 flex items-center gap-2">
                    <Link size={22} className="text-indigo-600" /> سرویس‌های
                    خارجی و API
                  </h3>
                  <div className="space-y-4 max-w-2xl">
                    <div className="group">
                      <label className="text-xs font-black text-gray-500 block mb-1 group-focus-within:text-indigo-600 transition-colors tracking-widest">
                        API KEY سامانه پیامک
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••••••••"
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm dir-ltr focus:ring-4 ring-indigo-50/50 outline-none transition-all"
                        value={settings.smsApiKey}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            smsApiKey: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-black text-gray-500 block mb-1">
                          شماره فرستنده SMS
                        </label>
                        <input
                          type="text"
                          placeholder="1000..."
                          className="w-full border border-gray-200 rounded-xl p-3 text-sm dir-ltr outline-none"
                          value={settings.smsSenderNumber}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              smsSenderNumber: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs font-black text-gray-500 block mb-1">
                          GOOGLE CALENDAR ID
                        </label>
                        <input
                          type="text"
                          placeholder="primary or email@gmail.com"
                          className="w-full border border-gray-200 rounded-xl p-3 text-sm dir-ltr outline-none"
                          value={settings.googleCalendarId}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              googleCalendarId: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="text-xs font-black text-gray-500 block mb-1">
                          آدرس API سرور سایان (SAYAN API URL)
                        </label>
                        <input
                          type="text"
                          placeholder="http://192.168.41.225:3000/api/external/v1"
                          className="w-full border border-gray-200 rounded-xl p-3 text-sm dir-ltr outline-none"
                          value={settings.sayanApiUrl || ""}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              sayanApiUrl: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs font-black text-gray-500 block mb-1">
                          توکن امنیتی (Bearer Token) - ضد تداخل مرورگر
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            autoComplete="off"
                            data-lpignore="true"
                            placeholder="s_gate_live_..."
                            className="flex-1 border border-gray-200 rounded-xl p-3 text-sm dir-ltr bg-slate-50 font-mono text-xs focus:bg-white focus:ring-2 ring-indigo-500 outline-none"
                            value={settings.sayanApiKey || ""}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                sayanApiKey: e.target.value,
                              })
                            }
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (!settings.sayanApiUrl)
                                return alert("❌ ابتدا آدرس API را وارد کنید");
                              const url = settings.sayanApiUrl.replace(
                                /\/$/,
                                "",
                              );
                              try {
                                const controller = new AbortController();
                                const timeoutId = setTimeout(
                                  () => controller.abort(),
                                  8000,
                                );

                                const res = await fetch("/api/sayan-proxy", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({
                                    url: `${url}/invoices`,
                                    headers: {
                                      Authorization: `Bearer ${settings.sayanApiKey}`,
                                    },
                                    method: "GET",
                                  }),
                                  signal: controller.signal,
                                });

                                clearTimeout(timeoutId);

                                const data = await res.json();

                                if (res.ok) {
                                  alert(
                                    "✅ اتصال از طریق پروکسی موفقیت‌آمیز بود!\nسرور برنامه توانست به پل سایان وصل شود.",
                                  );
                                } else {
                                  if (res.status === 500) {
                                    if (data.isLocalIp) {
                                      alert(
                                        "⚠️ خطا: آدرس IP وارد شده یک IP محلی (Private) است.\n\nسرور برنامه که در اینترنت قرار دارد نمی‌تواند مستقیم به سیستم شما وصل شود مگر اینکه:\n۱. از یک توکل مانند Ngrok استفاده کنید.\n۲. یا IP استاتیک (Public) داشته باشید و پورت را باز کنید.",
                                      );
                                    } else {
                                      alert(
                                        `⚠️ مشکل در اتصال پل:\n${data.details || "خطای ناشناخته"}`,
                                      );
                                    }
                                  } else if (
                                    res.status === 401 ||
                                    res.status === 403
                                  ) {
                                    alert(
                                      `❌ خطای احراز هویت (${res.status}):\nتوکن Bearer اشتباه است یا منقضی شده است.`,
                                    );
                                  } else {
                                    alert(
                                      `❌ خطای پاسخ سرور (${res.status}): ${res.statusText}`,
                                    );
                                  }
                                }
                              } catch (e: any) {
                                console.error("Test Connection Error:", e);
                                alert(
                                  "❌ خطای ارتباط با سرور برنامه! مطمئن شوید که به اینترنت متصل هستید.",
                                );
                              }
                            }}
                            className="bg-blue-600 text-white px-4 rounded-xl text-xs font-bold whitespace-nowrap hover:bg-blue-700 transition-colors"
                          >
                            تست اتصال (از طریق سرور)
                          </button>
                        </div>
                        <p className="text-[9px] text-gray-400 mt-1 font-bold">
                          فقط کد توکن را وارد کنید. کلمه Bearer به صورت خودکار
                          اضافه می‌شود.
                        </p>
                      </div>
                    </div>
                    <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 flex gap-3 items-start">
                      <div className="glass-panel p-2 rounded-lg text-indigo-600 shadow-sm">
                        <Globe size={20} />
                      </div>
                      <p className="text-[10px] font-bold text-indigo-700 leading-relaxed">
                        اطلاعات Google Calendar برای نمایش تاریخ و یادآوری‌ها در
                        داشبورد استفاده می‌شود. حتما دسترسی "Make Public" یا
                        اشتراک‌گذاری با سرویس مربوطه را تنظیم کنید.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t sticky bottom-0 glass-panel p-4 shadow-inner md:shadow-none md:static gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    // Use absolute path for import in onClick to avoid scope issues or just use the already imported one if possible
                    // Since getServerHost is not imported, let's just use it if we can or import it at the top
                    const { getServerHost } =
                      await import("../services/apiService");
                    const host =
                      getServerHost() ||
                      (Capacitor.isNativePlatform() ? "N/A" : "/");
                    alert(`در حال بررسی اتصال به: ${host}`);
                    await apiCall("/users");
                    alert("اتصال با موفقیت برقرار شد ✅");
                  } catch (e) {
                    alert(
                      "خطا در اتصال به سرور ❌\nلطفا آدرس سرور را در بخش اتصالات (API) بررسی کنید.",
                    );
                  }
                }}
                className="bg-blue-100 text-blue-700 px-4 py-3 rounded-xl text-xs font-black hover:bg-blue-200 transition-colors border border-blue-200"
              >
                تست اتصال به سرور
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-70 flex-1 md:flex-none justify-center"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Save size={20} />
                )}{" "}
                ذخیره تنظیمات
              </button>
            </div>
          </form>
        )}
      </div>

      {/* --- Secretariat Template Editor Modal --- */}
      {editingSecTemplate && (
        <div className="fixed inset-0 z-[100] flex items-start pt-16 md:pt-24 pb-32 overflow-y-auto overflow-x-hidden justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div
            className="bg-white dark:bg-slate-900 border dark:border-white/10 rounded-2xl max-w-5xl w-full p-6 shadow-2xl space-y-4 max-h-[95vh] overflow-y-auto text-right"
            dir="rtl"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-gray-800 dark:text-white">
                {editingSecTemplate.id
                  ? "ویرایش نمونه نامه"
                  : "ایجاد نمونه نامه جدید"}
              </h3>
              <button
                onClick={() => setEditingSecTemplate(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">
                  عنوان قالب (برای نمایش در لیست)
                </label>
                <input
                  type="text"
                  value={editingSecTemplate.title || ""}
                  onChange={(e) =>
                    setEditingSecTemplate({
                      ...editingSecTemplate,
                      title: e.target.value,
                    })
                  }
                  className="w-full border rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-purple-500"
                  placeholder="مثلا: نامه درخواست مرخصی"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500">
                  موضوع نامه (اختیاری)
                </label>
                <input
                  type="text"
                  value={editingSecTemplate.subject || ""}
                  onChange={(e) =>
                    setEditingSecTemplate({
                      ...editingSecTemplate,
                      subject: e.target.value,
                    })
                  }
                  className="w-full border rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-purple-500"
                  placeholder="موضوعی که در پیش‌نویس درج شود"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-gray-500">
                  متن نمونه نامه
                </label>

                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".docx"
                    ref={docxImportInputRef}
                    onChange={handleDocxImport}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => docxImportInputRef.current?.click()}
                    className="flex items-center gap-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-[10px] font-bold px-2 py-1 rounded"
                    disabled={importingDocxFile}
                  >
                    {importingDocxFile ? (
                      "در حال تبدیل..."
                    ) : (
                      <>
                        <UploadCloud size={12} /> استخراج متن از فایل Word
                      </>
                    )}
                  </button>
                </div>
              </div>
              <textarea
                value={editingSecTemplate.content || ""}
                onChange={(e) =>
                  setEditingSecTemplate({
                    ...editingSecTemplate,
                    content: e.target.value,
                  })
                }
                className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-purple-500 min-h-[300px] font-sans"
                placeholder="متن اصلی را اینجا بنویسید..."
              />
            </div>

            <div className="flex justify-end pt-4 border-t gap-2">
              <button
                onClick={() => setEditingSecTemplate(null)}
                className="px-4 py-2 text-gray-500 bg-gray-100 rounded-xl text-sm font-bold hover:bg-gray-200"
              >
                انصراف
              </button>
              <button
                onClick={() => {
                  if (
                    !editingSecTemplate.title ||
                    !editingSecTemplate.content
                  ) {
                    alert("عنوان قالب و متن آن الزامی است.");
                    return;
                  }
                  handleSaveSecTemplate(editingSecTemplate);
                }}
                className="px-6 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700"
              >
                ذخیره قالب
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <div
          className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white text-sm font-bold shadow-2xl z-[100] animate-bounce ${message.includes("خطا") ? "bg-red-600" : "bg-green-600"}`}
        >
          {message}
        </div>
      )}
    </div>
  );
};
export default Settings;
