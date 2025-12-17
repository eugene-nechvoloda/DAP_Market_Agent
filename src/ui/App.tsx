import React, { useState } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './pages/DashboardView';
import { ReportHistoryView } from './pages/ReportHistoryView';
import { DataQualityView } from './pages/DataQualityView';
import { SettingsView } from './pages/SettingsView';
import './styles/App.css';

type View = 'dashboard' | 'history' | 'quality' | 'settings';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'history':
        return <ReportHistoryView />;
      case 'quality':
        return <DataQualityView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="app">
      <Header />
      <div className="app-content">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        <main className="main-content">
          {renderView()}
        </main>
      </div>
    </div>
  );
};
