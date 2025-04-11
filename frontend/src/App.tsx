import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import BlueprintListPage from './pages/BlueprintListPage';
import AppLayout from './components/AppLayout'; // Import the layout

// MUI Theme Provider
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import authService from './services/authService';

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Wrap protected content with AppLayout */}
          <Route
             path="/blueprints"
             element={
               <ProtectedRoute>
                 <AppLayout>
                   <BlueprintListPage />
                 </AppLayout>
               </ProtectedRoute>
             }
           />
           {/* Add more routes within AppLayout later */}
           {/* <Route path="/blueprints/new" element={<ProtectedRoute><AppLayout><BlueprintCreatePage /></AppLayout></ProtectedRoute>} /> */}
           {/* <Route path="/blueprints/:id" element={<ProtectedRoute><AppLayout><BlueprintDetailPage /></AppLayout></ProtectedRoute>} /> */}


          <Route
             path="/"
             element={
               authService.isAuthenticated() ? (
                 <Navigate to="/blueprints" replace />
               ) : (
                 <Navigate to="/login" replace />
               )
             }
           />

        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;