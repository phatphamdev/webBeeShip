import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import Navbar from './components/Navbar.jsx';
import DispatcherPage from './pages/DispatcherPage.jsx';
import AdminPanel from './pages/AdminPanel.jsx';

export default function App() {
  return (
    <HashRouter>
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <Box component="main" sx={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dispatcher" replace />} />
            <Route path="/dispatcher" element={<DispatcherPage />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </Box>
      </Box>
    </HashRouter>
  );
}
