import { apiCall } from './apiService';
import { ExitPermit, ExitPermitItem } from '../types';
import html2canvas from 'html2canvas';

export interface SayanPersonResult {
  id: string;
  personCode: string;
  name: string;
  fatherOrDetail?: string;
  nationalCode?: string;
  mobile?: string;
  accountingCode?: string;
  tafsiliCode?: string;
  address?: string;
}

export interface SayanSalesRemittanceItem {
  lineId?: string;
  docNo?: string;
  itemCode: string;
  goodsName: string;
  netQty: number; // مقدار خالص
  grossQty?: number; // مقدار ناخالص
  unitPrice?: number;
  totalPrice?: number;
  cartonCount?: number;
  bobbinCount?: number;
  grade?: string;
  twistDirection?: string;
  description?: string;
  rowNo?: number;
}

export interface SayanSalesRemittanceResult {
  archiveCode: string;
  subSystem?: string;
  docNo?: string;
  remittanceNumber: string;
  subCode?: string;
  docDate: string;
  shamsiDate: string;
  docType?: string;
  personCode: string;
  personFullName: string;
  personAddress?: string;
  personPhone?: string;
  storeId?: string;
  note?: string;
  items: SayanSalesRemittanceItem[];
  totalNetWeight: number;
  totalGrossWeight: number;
  totalCartons: number;
  totalBobbins: number;
}

/**
 * Search persons in Sayan ERP (GNR_TBL_001)
 */
export const searchSayanPersons = async (query: string): Promise<SayanPersonResult[]> => {
  if (!query || query.trim().length === 0) return [];
  try {
    const res = await apiCall<{ persons: SayanPersonResult[] }>(
      `/sayan/search-persons?q=${encodeURIComponent(query.trim())}`
    );
    if (res && Array.isArray(res.persons)) {
      return res.persons;
    }
    return [];
  } catch (err) {
    console.warn('searchSayanPersons error:', err);
    return [];
  }
};

/**
 * Lookup matching Sayan Sales Remittance (STR_TBL_010 / STR_TBL_011)
 */
export const lookupSayanSalesRemittance = async (params: {
  personCode?: string;
  recipientName?: string;
  permitDate?: string;
  permitNumber?: number | string;
}): Promise<SayanSalesRemittanceResult | null> => {
  try {
    const res = await apiCall<{ success: boolean; remittance?: SayanSalesRemittanceResult; error?: string }>(
      '/sayan/sales-remittance/lookup',
      'POST',
      params
    );
    if (res && res.success && res.remittance) {
      return res.remittance;
    }
    return null;
  } catch (err) {
    console.warn('lookupSayanSalesRemittance error:', err);
    return null;
  }
};

/**
 * Sync Exit Permit with Sayan Sales Remittance on the server
 */
export const syncExitPermitWithSayan = async (
  permitId: string,
  options?: {
    approverWarehouse?: string;
    advanceToSecurity?: boolean;
    customItems?: ExitPermitItem[];
    remittanceData?: SayanSalesRemittanceResult;
  }
): Promise<{ success: boolean; permit?: ExitPermit; error?: string }> => {
  try {
    const res = await apiCall<{ success: boolean; permit?: ExitPermit; error?: string }>(
      `/sayan/exit-permits/${permitId}/sync-remittance`,
      'POST',
      options || {}
    );
    return res;
  } catch (err: any) {
    console.error('syncExitPermitWithSayan error:', err);
    return { success: false, error: err.message || 'Server error' };
  }
};

/**
 * Capture an element and return a base64 PNG data URL
 */
export const captureElementToDataUrl = async (elementId: string): Promise<string> => {
  const el = document.getElementById(elementId);
  if (!el) {
    throw new Error(`Element #${elementId} not found`);
  }
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  });
  return canvas.toDataURL('image/png');
};
