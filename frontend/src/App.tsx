import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/ProtectedRoute';
import BlueprintListPage from './pages/BlueprintListPage';
import AppLayout from './components/AppLayout'; // Import the layout
import BlueprintCreatePage from './pages/BlueprintCreatePage';
import BlueprintDetailPage from './pages/BlueprintDetailPage';
import ClientInstanceCreatePage from './pages/ClientInstanceCreatePage';
import ClientInstanceListPage from './pages/ClientInstanceListPage';
import ClientInstanceDetailPage from './pages/ClientInstanceDetailPage'; 
import BlueprintEditPage from './pages/BlueprintEditPage';

// MUI Theme Provider
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import authService from './services/authService';
import { SnackbarProvider } from './context/SnackbarContext';

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SnackbarProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

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
            <Route
             path="/blueprints/new" // Create page <<-- ADD THIS ROUTE
             element={
               <ProtectedRoute>
                 <AppLayout>
                   <BlueprintCreatePage />
                 </AppLayout>
               </ProtectedRoute>
             }
           />
            <Route
             path="/blueprints/:id" // Detail page  <<-- ADD THIS ROUTE
             element={<ProtectedRoute><AppLayout><BlueprintDetailPage /></AppLayout></ProtectedRoute>}
           />
            <Route
             path="/client-instances" // <<-- ADD THIS LIST ROUTE
             element={<ProtectedRoute><AppLayout><ClientInstanceListPage /></AppLayout></ProtectedRoute>}
           />
           <Route
             path="/client-instances/new" // <<-- ADD THIS ROUTE
             element={<ProtectedRoute><AppLayout><ClientInstanceCreatePage /></AppLayout></ProtectedRoute>}
           />
           <Route
             path="/client-instances/:id" // <<-- ADD THIS DETAIL ROUTE
             element={<ProtectedRoute><AppLayout><ClientInstanceDetailPage /></AppLayout></ProtectedRoute>}
           />
           <Route path="/blueprints/:id/edit" element={<ProtectedRoute><AppLayout><BlueprintEditPage /></AppLayout></ProtectedRoute>} />
           {/* Add detail route later */}
           {/* <Route path="/blueprints/:id" element={...} /> */}
           {/* --- End Protected Routes --- */}
           {/* Add more routes within AppLayout later */}
           {/* <Route path="/blueprints/new" element={<ProtectedRoute><AppLayout><BlueprintCreatePage /></AppLayout></ProtectedRoute>} /> */}
           {/* <Route path="/blueprints/:id" element={<ProtectedRoute><AppLayout><BlueprintDetailPage /></AppLayout></ProtectedRoute>} /> */}


           <Route
             path="/"
             element={
               // Update default redirect to point to instances or blueprints
               authService.isAuthenticated() ? (
                 <Navigate to="/client-instances" replace /> // <-- Point to instances list now?
               ) : (
                 <Navigate to="/login" replace />
               )
             }
           />

        </Routes>
      </Router>
      </SnackbarProvider>
    </ThemeProvider>
  );
}

export default App;