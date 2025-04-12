// frontend/src/context/SnackbarContext.tsx
import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert, { AlertColor } from '@mui/material/Alert';

interface SnackbarMessage {
  message: string;
  severity: AlertColor; // 'success' | 'error' | 'warning' | 'info'
}

interface SnackbarContextProps {
  showSnackbar: (message: string, severity?: AlertColor) => void;
}

// Create context with a default dummy function
const SnackbarContext = createContext<SnackbarContextProps>({
  showSnackbar: () => {},
});

// Custom hook to use the snackbar context
export const useSnackbar = () => {
  return useContext(SnackbarContext);
};

interface SnackbarProviderProps {
  children: ReactNode;
}

export const SnackbarProvider: React.FC<SnackbarProviderProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [snackbarConfig, setSnackbarConfig] = useState<SnackbarMessage>({ message: '', severity: 'info' });

  const showSnackbar = useCallback((message: string, severity: AlertColor = 'success') => {
    setSnackbarConfig({ message, severity });
    setOpen(true);
  }, []);

  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    // Prevent closing on click away if needed, but usually okay for notifications
    // if (reason === 'clickaway') {
    //   return;
    // }
    setOpen(false);
  };

  return (
    <SnackbarContext.Provider value={{ showSnackbar }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={6000} // Adjust duration as needed (6 seconds)
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} // Position
      >
        {/* Use Alert component inside Snackbar for severity colors/icons */}
        {/* Add onClose to Alert only if you want an 'X' button */}
        <Alert severity={snackbarConfig.severity} sx={{ width: '100%' }} variant="filled">
          {snackbarConfig.message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
};