export const isInFinancialYear = (dateStr: string | undefined | null, financialYear: string | undefined): boolean => {
    if (!financialYear || financialYear === 'all') return true;
    if (!dateStr) return false;
    
    // Convert dateStr (ISO) to Shamsi year
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        
        // fa-IR-u-nu-latn gives format like "1403/12/29"
        const shamsiDate = d.toLocaleDateString('fa-IR-u-nu-latn');
        const shamsiYearStr = shamsiDate.split('/')[0].replace(/[^\d]/g, '');
        const shamsiYear = parseInt(shamsiYearStr, 10);
        
        const targetYearStr = financialYear.replace(/[^\d]/g, '');
        const targetYear = parseInt(targetYearStr, 10);
        
        return shamsiYear === targetYear;
    } catch (e) {
        return false;
    }
};
