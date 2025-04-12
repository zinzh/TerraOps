import React from 'react';
// Import NavLink from react-router-dom for active styling
import { useNavigate, NavLink } from 'react-router-dom';
import authService from '../services/authService';

// MUI Components
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import AccountCircle from '@mui/icons-material/AccountCircle';
import Stack from '@mui/material/Stack'; // For arranging NavLinks

interface AppLayoutProps {
  children: React.ReactNode;
}

function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    navigate('/login', { replace: true });
  };

  // Style for active NavLink
  const activeStyle = {
      textDecoration: 'underline',
      fontWeight: 'bold',
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          {/* Title */}
          <Typography variant="h6" component="div" sx={{ mr: 3 }}> {/* Added margin */}
            TerraOps Manager
          </Typography>

          {/* Navigation Links */}
          <Stack direction="row" spacing={2} sx={{ flexGrow: 1 }}>
            <NavLink
                to="/client-instances"
                style={({ isActive }) => ({
                    color: 'inherit', // Inherit AppBar text color
                    textDecoration: 'none', // Remove default underline
                    ...(isActive ? activeStyle : {}), // Apply active style conditionally
                })}
            >
                <Typography variant="button">Client Instances</Typography>
             </NavLink>
             <NavLink
                 to="/blueprints"
                 style={({ isActive }) => ({
                    color: 'inherit',
                    textDecoration: 'none',
                    ...(isActive ? activeStyle : {}),
                 })}
             >
                 <Typography variant="button">Blueprints</Typography>
             </NavLink>
             {/* Add more top-level navigation links here */}
          </Stack>


          {/* User Info & Logout */}
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
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {children}
      </Box>
    </Box>
  );
}

export default AppLayout;