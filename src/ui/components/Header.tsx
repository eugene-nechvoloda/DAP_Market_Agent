import React from 'react';
import '../styles/Header.css';

export const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="header-title">
            📊 Digital Adoption Platform Market Research
          </h1>
          <p className="header-subtitle">
            Automated competitive intelligence for DAP market
          </p>
        </div>
        <div className="header-right">
          <div className="header-status">
            <span className="status-indicator status-active"></span>
            <span className="status-text">System Active</span>
          </div>
        </div>
      </div>
    </header>
  );
};
