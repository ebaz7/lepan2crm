import React from 'react';
import AccountingReports from './AccountingReports';
import { getCurrentUser } from '../services/authService';

interface SayanReportsProps {
  settings?: any;
  currentUser?: any;
}

const SayanReports: React.FC<SayanReportsProps> = (props) => {
  const currentUser = props.currentUser || getCurrentUser();
  return <AccountingReports {...props} currentUser={currentUser} />;
};

export default SayanReports;
