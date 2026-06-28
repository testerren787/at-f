import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoanApplication } from '../LoanApplicationContext';
import './Details.css';

export default function Details() {
  const navigate = useNavigate();
  
  // Get context data and functions
  const { personalDetailsData, updatePersonalDetailsData } = useLoanApplication();
  
  // Form state for Step 2 - initialize with context data
  const [formData, setFormData] = useState({
    firstName: personalDetailsData?.firstName || '',
    lastName: personalDetailsData?.lastName || '',
    email: personalDetailsData?.email || '',
    phoneNumber: personalDetailsData?.phoneNumber || ''
  });

  // State for phone validation error
  const [phoneError, setPhoneError] = useState('');

  // Validate phone number format (9 digits starting with 2 or 5)
  const isValidPhoneNumber = (phone) => {
    const digits = phone.replace(/\D/g, '');
    
    // Must be exactly 9 digits and start with 2 or 5
    if (digits.length === 9 && (digits.startsWith('2') || digits.startsWith('5'))) {
      return true;
    }
    
    return false;
  };

  // Normalize phone number (already in 9-digit format)
  const normalizePhoneNumber = (phone) => {
    const digits = phone.replace(/\D/g, '');
    
    // 9 digits (2XXXXXXXX or 5XXXXXXXX) -> keep as is
    if (digits.length === 9 && (digits.startsWith('2') || digits.startsWith('5'))) {
      return digits;
    }
    
    return digits;
  };

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for phone number
    if (name === 'phoneNumber') {
      // Remove any non-digit characters
      const digitsOnly = value.replace(/\D/g, '');
      // Limit to 9 digits
      const limitedDigits = digitsOnly.slice(0, 9);
      
      setFormData(prev => ({
        ...prev,
        [name]: limitedDigits
      }));
      
      // Clear error when user starts typing
      if (phoneError) {
        setPhoneError('');
      }
      
      // Validate if user has entered enough digits
      if (limitedDigits.length === 9) {
        if (!isValidPhoneNumber(limitedDigits)) {
          setPhoneError('Phone number must start with 2 or 5');
        } else {
          setPhoneError('');
        }
      }
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle form submission (Next)
  const handleNext = (e) => {
    e.preventDefault();
    
    // Validate phone number before submission
    if (!isValidPhoneNumber(formData.phoneNumber)) {
      setPhoneError('Please enter a valid 9-digit phone number starting with 2 or 5 (e.g., 2XXXXXXXX or 5XXXXXXXX)');
      return;
    }
    
    // Normalize phone number before saving
    const normalizedPhone = normalizePhoneNumber(formData.phoneNumber);
    
    // Save personal details to context with normalized phone
    updatePersonalDetailsData({
      ...formData,
      phoneNumber: normalizedPhone
    });
    
    // Navigate to summary
    navigate('/summary');
  };

  // Handle previous button
  const handlePrevious = () => {
    // Normalize phone number before saving if valid
    let dataToSave = { ...formData };
    if (formData.phoneNumber && isValidPhoneNumber(formData.phoneNumber)) {
      dataToSave.phoneNumber = normalizePhoneNumber(formData.phoneNumber);
    }
    
    // Save current data before going back
    updatePersonalDetailsData(dataToSave);
    navigate(-1);
  };

  // Handle back button
  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="app-container">
      
      {/* ==================== HEADER ==================== */}
      <header className="header">
        <button className="back-btn" onClick={handleBack}>
          ← Back
        </button>
        <div className="logo">
          <div className="logo-circle">
            <span className="logo-a">A</span>
          </div>
          <span className="logo-airteltigo">Airteltigo</span>
        </div>
        <button className="menu-btn" aria-label="Menu">
          <div className="menu-line"></div>
          <div className="menu-line"></div>
          <div className="menu-line"></div>
        </button>
      </header>

      {/* ==================== MAIN CONTENT ==================== */}
      <main className="main-content">
        <div className="container">
          
          {/* Title Section */}
          <h1 className="form-title">Loan Application</h1>
          <p className="form-subtitle">Step 2 of 3</p>

          {/* Progress Indicator */}
          <div className="progress-indicator">
            <div className="progress-dot active"></div>
            <div className="progress-dot active"></div>
            <div className="progress-dot"></div>
          </div>

          {/* Application Form */}
          <form onSubmit={handleNext}>
            
            {/* First Name and Last Name Row */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">First Name</label>
                <input 
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Kwame"
                  className="form-input"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input 
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Mensah"
                  className="form-input"
                  required
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="kwame.mensah@example.com"
                className="form-input"
                required
              />
            </div>

            {/* Phone Number */}
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '12px 16px', 
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  fontWeight: '500'
                }}>
                  +233
                </div>
                <input 
                  type="tel"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  placeholder="2XXXXXXXX or 5XXXXXXXX"
                  onChange={handleChange}
                  className="form-input"
                  style={{ 
                    flex: 1,
                    borderColor: phoneError ? '#dc3545' : '#ddd'
                  }}
                  maxLength="9"
                  required
                />
              </div>
              {phoneError ? (
                <small style={{ display: 'block', marginTop: '4px', color: '#dc3545', fontSize: '12px' }}>
                  {phoneError}
                </small>
              ) : (
                <small style={{ display: 'block', marginTop: '4px', color: '#666', fontSize: '12px' }}>
                  Enter 9 digits starting with 2 or 5 (e.g., 2XXXXXXXX or 5XXXXXXXX)
                </small>
              )}
            </div>

            {/* Button Container */}
            <div className="button-container">
              <button 
                type="button" 
                className="previous-btn"
                onClick={handlePrevious}
              >
                PREVIOUS
              </button>
              <button type="submit" className="next-btn">
                NEXT STEP
              </button>
            </div>
          </form>

        </div>
      </main>

      {/* ==================== FOOTER ==================== */}
      <footer className="footer">
        © 2026 Airteltigo
      </footer>
    </div>
  );
}