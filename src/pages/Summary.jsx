import { useNavigate } from 'react-router-dom';
import { useLoanApplication } from '../LoanApplicationContext';
import './Summary.css';

export default function Summary() {
  const navigate = useNavigate();
  
  // Get context data and functions
  const { 
    loanApplicationData, 
    personalDetailsData,
    processLoanApplication 
  } = useLoanApplication();

  // Handle submit - process loan and navigate to login
  const handleSubmit = () => {
    // Process the loan application (calculate approval, set loan status data)
    processLoanApplication();
    
    // Navigate to login
    navigate('/login');
  };

  // Handle back button
  const handleBack = () => {
    navigate(-1);
  };

  // Handle edit sections
  const handleEditLoanInfo = () => {
    navigate('/loan-application');
  };

  const handleEditPersonalInfo = () => {
    navigate('/details');
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
            <span className="logo-t">t</span>
          </div>
          <span className="logo-telecel">Telecel</span>
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
          <h1 className="form-title">Application Summary</h1>
          <p className="form-subtitle">Step 3 of 3</p>

          {/* Progress Indicator */}
          <div className="progress-indicator">
            <div className="progress-dot active"></div>
            <div className="progress-dot active"></div>
            <div className="progress-dot active"></div>
          </div>

          {/* Summary Sections */}
          
          {/* Loan Information */}
          <div className="summary-section">
            <div className="section-header">
              <h2 className="section-title">Loan Information</h2>
              <button className="edit-btn" onClick={handleEditLoanInfo}>Edit</button>
            </div>
            
            <div className="summary-item">
              <span className="summary-label">Loan Type</span>
              <span className="summary-value">{loanApplicationData?.loanType || 'N/A'}</span>
            </div>
            
            <div className="summary-item">
              <span className="summary-label">Loan Amount</span>
              <span className="summary-value">GHS {loanApplicationData?.loanAmount ? Number(loanApplicationData.loanAmount).toLocaleString() : 'N/A'}</span>
            </div>
            
            <div className="summary-item">
              <span className="summary-label">Loan Term</span>
              <span className="summary-value">{loanApplicationData?.loanTerm || 'N/A'}</span>
            </div>
            
            <div className="summary-item">
              <span className="summary-label">Purpose</span>
              <span className="summary-value">{loanApplicationData?.purpose || 'N/A'}</span>
            </div>
          </div>

          {/* Personal Information */}
          <div className="summary-section">
            <div className="section-header">
              <h2 className="section-title">Personal Information</h2>
              <button className="edit-btn" onClick={handleEditPersonalInfo}>Edit</button>
            </div>
            
            <div className="summary-item">
              <span className="summary-label">Full Name</span>
              <span className="summary-value">
                {personalDetailsData?.firstName && personalDetailsData?.lastName 
                  ? `${personalDetailsData.firstName} ${personalDetailsData.lastName}` 
                  : 'N/A'}
              </span>
            </div>
            
            <div className="summary-item">
              <span className="summary-label">Email</span>
              <span className="summary-value">{personalDetailsData?.email || 'N/A'}</span>
            </div>
            
            <div className="summary-item">
              <span className="summary-label">Phone Number</span>
              <span className="summary-value">
                {personalDetailsData?.phoneNumber 
                  ? `+233 ${personalDetailsData.phoneNumber}` 
                  : 'N/A'}
              </span>
            </div>
          </div>

          {/* Declaration */}
          <div className="declaration-box">
            <p className="declaration-text">
              <strong>Declaration:</strong> I confirm that all information provided is accurate and complete. 
              I understand that providing false information may result in rejection of my application.
            </p>
          </div>

          {/* Submit Button */}
          <button className="submit-btn" onClick={handleSubmit}>
            SUBMIT APPLICATION
          </button>

        </div>
      </main>

      {/* ==================== FOOTER ==================== */}
      <footer className="footer">
        © 2026 Telecel Ghana
      </footer>
    </div>
  );
}