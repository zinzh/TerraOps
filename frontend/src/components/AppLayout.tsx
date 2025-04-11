import React from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';

// MUI Components
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import AccountCircle from '@mui/icons-material/AccountCircle'; // Example user icon

interface AppLayoutProps {
  children: React.ReactNode; // To render the page content
}

function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    navigate('/login', { replace: true });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          {/* <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
          >
            <MenuIcon /> // Add menu icon later if needed
          </IconButton> */}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            TerraOps Manager
          </Typography>
          {currentUser && (
             <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <AccountCircle sx={{ mr: 1 }}/>
                <Typography variant="body1" sx={{ mr: 2 }}>
                   {currentUser.email}
                </Typography>
                <Button color="inherit" onClick={handleLogout}>Logout</Button>
             </Box>
           )}
        </Toolbar>
      </AppBar>
      {/* Main content area */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 /* Add padding here or in child pages */ }}>
        {children}
      </Box>
    </Box>
  );
}

export default AppLayout;