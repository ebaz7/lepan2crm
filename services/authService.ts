
import { User, UserRole, SystemSettings, RolePermissions } from '../types';
import { apiCall } from './apiService';

const CURRENT_USER_KEY = 'app_current_user';

export const getUsers = async (): Promise<User[]> => {
    return await apiCall<User[]>('/users');
};

export const saveUser = async (user: User): Promise<User[]> => {
    return await apiCall<User[]>('/users', 'POST', user);
};

export const updateUser = async (user: User): Promise<User[]> => {
    return await apiCall<User[]>(`/users/${user.id}`, 'PUT', user);
};

export const deleteUser = async (id: string): Promise<User[]> => {
    return await apiCall<User[]>(`/users/${id}`, 'DELETE');
};

export const login = async (username: string, password: string): Promise<User | null> => {
    const user = await apiCall<User>('/login', 'POST', { username, password });
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    return user;
};

export const logout = (): void => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): User | null => {
  const stored = localStorage.getItem(CURRENT_USER_KEY);
  return stored ? JSON.parse(stored) : null;
};

export const hasPermission = (user: User | null, permissionType: string): boolean => {
  if (!user) return false;
  if (permissionType === 'manage_users') {
    return user.role === UserRole.ADMIN || (Array.isArray(user.roles) && user.roles.includes(UserRole.ADMIN));
  }
  return false;
};

// --- REWRITTEN PERMISSION LOGIC (STRICT MODE & FAILSAFE) ---
export const getRolePermissions = (userRole: string, settings: SystemSettings | null, userObject?: User): RolePermissions => {
    
    // If the user has multiple roles, compile a composite set of permissions
    if (userObject && Array.isArray(userObject.roles) && userObject.roles.length > 0) {
        // If any of the roles is ADMIN, they get everything (highest priority)
        if (userObject.roles.includes(UserRole.ADMIN)) {
            return {
                canViewAll: true, canCreatePaymentOrder: true, canViewPaymentOrders: true, canApproveFinancial: true, canApproveManager: true, canApproveCeo: true, canEditOwn: true, canEditAll: true, canDeleteOwn: true, canDeleteAll: true, canManageTrade: true, canManageSettings: true,
                canCreateExitPermit: true, canViewExitPermits: true, canApproveExitCeo: true, canApproveExitFactory: true, canApproveExitWarehouse: true, canApproveExitSecurity: true, canViewExitArchive: true, canEditExitArchive: true,
                canManageWarehouse: true, canViewWarehouseReports: true, canApproveBijak: true,
                canViewSecurity: true, canCreateSecurityLog: true, canApproveSecuritySupervisor: true, canManagePurchase: true,
                canViewNotifications: true, canCreateNotifications: true, canCreateAnnouncements: true,
                canViewCustomerBalances: true, canImportCustomerBalances: true,
                canViewSayan: true, canViewSayanTraz: true, canViewSayanSales: true, canViewSayanProduction: true, canViewSayanCheques: true
            };
        }

        // Get permissions for each role
        const permissionsList = userObject.roles.map(role => 
            getRolePermissions(role, settings, { ...userObject, roles: undefined })
        );

        // Merge permissions
        const mergedPerms = { ...permissionsList[0] };
        for (let i = 1; i < permissionsList.length; i++) {
            const currentPerms = permissionsList[i];
            for (const key of Object.keys(currentPerms) as Array<keyof RolePermissions>) {
                if (currentPerms[key] === true) {
                    mergedPerms[key] = true;
                }
            }
        }
        return mergedPerms;
    }

    // 1. ADMIN GETS EVERYTHING (Hard Override)
    if (userRole === UserRole.ADMIN) {
        return {
            canViewAll: true, canCreatePaymentOrder: true, canViewPaymentOrders: true, canApproveFinancial: true, canApproveManager: true, canApproveCeo: true, canEditOwn: true, canEditAll: true, canDeleteOwn: true, canDeleteAll: true, canManageTrade: true, canManageSettings: true,
            canCreateExitPermit: true, canViewExitPermits: true, canApproveExitCeo: true, canApproveExitFactory: true, canApproveExitWarehouse: true, canApproveExitSecurity: true, canViewExitArchive: true, canEditExitArchive: true,
            canManageWarehouse: true, canViewWarehouseReports: true, canApproveBijak: true,
            canViewSecurity: true, canCreateSecurityLog: true, canApproveSecuritySupervisor: true, canManagePurchase: true,
            canViewNotifications: true, canCreateNotifications: true, canCreateAnnouncements: true,
            canViewCustomerBalances: true, canImportCustomerBalances: true,
            canViewSayan: true, canViewSayanTraz: true, canViewSayanSales: true, canViewSayanProduction: true, canViewSayanCheques: true,
            // Purchase-specific permissions hardwired for administrator:
            canView: true, canCreate: true, canApproveTechnical: true, canApproveFactory: true, canApproveCEO: true,
            canManageProformas: true, canSelectProforma: true, canRegisterEntry: true, canCheckQC: true,
            canApproveFactoryFinal: true, canWarehouseFinalize: true, canCommercialFinalize: true
        };
    }

    // 2. DEFINE DEFAULTS (Base Permissions based on Role Type)
    // Start with all false
    let perms: RolePermissions = {
        canViewAll: false,
        canEditOwn: true, 
        canDeleteOwn: true,
        canCreatePaymentOrder: false, canViewPaymentOrders: false, canApproveFinancial: false, canApproveManager: false, canApproveCeo: false, canEditAll: false, canDeleteAll: false,
        canManageTrade: false, canManageSettings: false,
        canCreateExitPermit: false, canViewExitPermits: false, canApproveExitCeo: false, canApproveExitFactory: false, canApproveExitWarehouse: false, canApproveExitSecurity: false, canViewExitArchive: false, canEditExitArchive: false,
        canManageWarehouse: false, canViewWarehouseReports: false, canApproveBijak: false,
        canViewSecurity: false, canCreateSecurityLog: false, canApproveSecuritySupervisor: false,
        canViewNotifications: false, canCreateNotifications: false, canCreateAnnouncements: false,
        canViewCustomerBalances: false, canImportCustomerBalances: false,
        canViewSayan: false, canViewSayanTraz: false, canViewSayanSales: false, canViewSayanProduction: false, canViewSayanCheques: false
    };

    // Apply System Defaults (Hardcoded Logic)
    switch (userRole) {
        case UserRole.CEO:
            perms.canViewAll = true;
            perms.canViewPaymentOrders = true;
            perms.canApproveCeo = true;
            perms.canViewExitPermits = true;
            perms.canApproveExitCeo = true;
            perms.canManageTrade = true;
            perms.canApproveBijak = true;
            perms.canViewSecurity = true;
            perms.canViewCustomerBalances = true;
            perms.canImportCustomerBalances = true;
            break;

        case UserRole.FINANCIAL:
            perms.canCreatePaymentOrder = true;
            perms.canViewPaymentOrders = true;
            perms.canApproveFinancial = true;
            perms.canViewCustomerBalances = true;
            perms.canImportCustomerBalances = true;
            break;

        case UserRole.MANAGER:
            perms.canCreatePaymentOrder = true;
            perms.canViewPaymentOrders = true;
            perms.canApproveManager = true;
            perms.canViewExitPermits = true; 
            perms.canViewCustomerBalances = true;
            break;

        case UserRole.SALES_MANAGER:
            perms.canCreatePaymentOrder = true;
            perms.canCreateExitPermit = true; // Can create exit request
            perms.canViewExitPermits = true; // Can view status
            perms.canViewCustomerBalances = true;
            break;

        case UserRole.FACTORY_MANAGER:
            perms.canViewExitPermits = true;
            perms.canApproveExitFactory = true; // CRITICAL DEFAULT
            perms.canViewSecurity = true;
            break;

        case UserRole.WAREHOUSE_KEEPER:
            perms.canViewExitPermits = true;
            perms.canApproveExitWarehouse = true; // CRITICAL DEFAULT
            perms.canManageWarehouse = false;
            perms.canManagePurchase = true;
            break;

        case UserRole.SECURITY_HEAD:
            perms.canViewExitPermits = true;
            perms.canApproveExitSecurity = true; // CRITICAL DEFAULT
            perms.canViewSecurity = true;
            perms.canApproveSecuritySupervisor = true;
            break;
            
        case UserRole.SECURITY_GUARD:
            perms.canViewSecurity = true;
            perms.canCreateSecurityLog = true;
            break;
            
        case UserRole.USER:
            perms.canCreatePaymentOrder = true;
            break;

        case UserRole.COMMERCIAL:
            perms.canManagePurchase = true;
            perms.canViewAll = true; // Needs to view requests to see and take action
            // Assign specific default purchase-flow permissions for Commercial role
            perms.canView = true;
            perms.canCommercialFinalize = true;
            perms.canManageProformas = true;
            perms.canSelectProforma = true;
            break;

        case UserRole.QC:
            perms.canView = true;
            perms.canCheckQC = true;
            break;
    }

    // 3. APPLY DATABASE SETTINGS (MERGE)
    if (settings) {
        if (settings.rolePermissions && settings.rolePermissions[userRole]) {
            console.log(`DEBUG: Applying settings for role ${userRole}:`, settings.rolePermissions[userRole]);
            perms = { ...perms, ...settings.rolePermissions[userRole] };
        }
        if (settings.purchaseRolePermissions && settings.purchaseRolePermissions[userRole]) {
            console.log(`DEBUG: Applying purchase settings for role ${userRole}:`, settings.purchaseRolePermissions[userRole]);
            perms = { ...perms, ...settings.purchaseRolePermissions[userRole] };
        }
    }

    // --- FIX FOR CUSTOM ROLES: ENSURE NO LEAKAGE ---
    // If not a system role, force warehouse permissions off UNLESS explicitly enabled
    const systemRoleIds = Object.values(UserRole);
    if (!systemRoleIds.includes(userRole as any)) {
        if (!settings?.rolePermissions?.[userRole]?.canManageWarehouse) {
            perms.canManageWarehouse = false;
        }
    }

    console.log(`DEBUG: Final permissions for ${userRole}:`, perms);

    // 4. FORCE SYSTEM DEFAULTS AGAIN (SAFETY NET)
    // Ensure critical approvals for system roles aren't accidentally disabled by empty settings
    const hasRoleConfig = settings?.rolePermissions && settings.rolePermissions[userRole];

    if (userRole === UserRole.FACTORY_MANAGER && (!hasRoleConfig || settings.rolePermissions[userRole].canApproveExitFactory === undefined)) {
        perms.canApproveExitFactory = true;
    }
    if (userRole === UserRole.WAREHOUSE_KEEPER && (!hasRoleConfig || settings.rolePermissions[userRole].canApproveExitWarehouse === undefined)) {
        perms.canApproveExitWarehouse = true;
    }
    if (userRole === UserRole.SECURITY_HEAD && (!hasRoleConfig || settings.rolePermissions[userRole].canApproveExitSecurity === undefined)) {
        perms.canApproveExitSecurity = true;
    }
    if (userRole === UserRole.CEO) {
        if (!hasRoleConfig || settings.rolePermissions[userRole].canApproveExitCeo === undefined) {
            perms.canApproveExitCeo = true;
        }
        if (!hasRoleConfig || settings.rolePermissions[userRole].canApproveCeo === undefined) {
            perms.canApproveCeo = true;
        }
    }

    // 5. USER SPECIFIC OVERRIDES
    if (userObject?.canManageTrade) {
        perms.canManageTrade = true;
    }

    return perms;
};
