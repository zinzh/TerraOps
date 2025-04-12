import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom'; // Use RouterLink for internal links
import clientInstanceService from '../services/clientInstanceService';
import { ClientInstance } from '../types';

// MUI Components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import SyncIcon from '@mui/icons-material/Sync'; // For Sync action
import Link from '@mui/material/Link'; // For external repo links
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip'; // To display status
import { useSnackbar } from '../context/SnackbarContext';

function ClientInstanceListPage() {
  const [instances, setInstances] = useState<ClientInstance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();

  const fetchInstances = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await clientInstanceService.listClientInstances();
      setInstances(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch client instances.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, []);

  const handleRefresh = () => {
      fetchInstances();
  }

  const handleSync = async (id: string) => {
      // Placeholder: Trigger sync and provide feedback
      // In a real app, this might open a modal to confirm values/commit message
      // or just trigger the sync directly using last known values.
      showSnackbar(`Triggering sync for instance ${id}...`, 'info');
      // TODO: Call backend sync endpoint (requires service function)
      // try {
      //     await clientInstanceService.syncInstance(id); // Need this function
      //     fetchInstances(); // Refresh list to show updated status
      // } catch (err) { ... handle error ... }
  }

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete client instance "${name}"? This action cannot be undone.`)) {
        // Optional: Add specific loading state for delete?
        setError(null); // Clear previous errors
        try {
            await clientInstanceService.deleteClientInstance(id);
            // Refresh list after successful deletion
            fetchInstances();
            showSnackbar(`Instance "${name}" deleted successfully.`, 'success');
            // Optional: Show success feedback (e.g., Snackbar)
            // alert(`Instance "${name}" deleted successfully.`);
        } catch (err: any) {
            console.error(`Failed to delete client instance ${id}:`, err);
            const errorMsg = err.response?.data?.error || 'Failed to delete client instance.';
            setError(errorMsg); // Show delete error
            showSnackbar(`Error deleting instance: ${errorMsg}`, 'error');
        }
    }
}

  const handleCreate = () => {
      navigate('/client-instances/new');
  };

  const handleRowClick = (id: string) => {
    navigate(`/client-instances/${id}`); // Navigate to detail page
    // alert(`Navigate to Detail page for instance ${id} (to be implemented)`); // Remove alert
}

   // Helper to determine chip color based on status
    const getStatusColor = (status?: string): "default" | "success" | "warning" | "error" => {
        switch (status?.toLowerCase()) {
            case 'success':
                return 'success';
            case 'failed':
                return 'error';
            case 'pending':
                return 'warning';
            default:
                return 'default';
        }
    };


  return (
    <Box> {/* Assuming AppLayout provides padding */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Client Instances
        </Typography>
        <Box>
           <Tooltip title="Refresh List">
                <IconButton onClick={handleRefresh} color="primary" disabled={loading}>
                    <RefreshIcon />
                </IconButton>
            </Tooltip>
            <Button
             variant="contained"
             startIcon={<AddIcon />}
             onClick={handleCreate}
             sx={{ ml: 1 }}
            >
              Create Instance
            </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 650 }} aria-label="client instance table">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Blueprint ID</TableCell> {/* TODO: Show Blueprint Name */}
                <TableCell>Repo URL</TableCell>
                <TableCell>Last Sync</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {instances.length === 0 && !loading ? (
                  <TableRow>
                      <TableCell colSpan={6} align="center">
                          No client instances found.
                      </TableCell>
                  </TableRow>
              ) : (
                instances.map((inst) => (
                  <TableRow
                    key={inst.id}
                    hover
                    onClick={() => handleRowClick(inst.id)} // Make row clickable
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell component="th" scope="row">
                      {inst.name}
                    </TableCell>
                    <TableCell>{inst.description || '-'}</TableCell>
                    <TableCell>
                             {inst.blueprint_name ? (
                                 <RouterLink to={`/blueprints/${inst.blueprint_id}`} onClick={(e) => e.stopPropagation()}>
                                     {inst.blueprint_name}
                                 </RouterLink>
                             ) : (
                                 <Tooltip title={inst.blueprint_id}>
                                     <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                         {inst.blueprint_id.substring(0, 8)}... (Not Found?)
                                     </Typography>
                                 </Tooltip>
                             )}
                        </TableCell>
                    <TableCell>
                        <Link href={inst.client_repo_url.startsWith('http') ? inst.client_repo_url : '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                            {inst.client_repo_url}
                        </Link>
                    </TableCell>
                    <TableCell>
                       {inst.last_synced_at ? new Date(inst.last_synced_at).toLocaleString() : 'Never'}
                       {inst.last_sync_status &&
                           <Tooltip title={inst.last_sync_message || inst.last_sync_status}>
                               <Chip
                                   label={inst.last_sync_status}
                                   size="small"
                                   color={getStatusColor(inst.last_sync_status)}
                                   sx={{ ml: 1 }}
                               />
                           </Tooltip>
                       }
                    </TableCell>
                    <TableCell align="right">
                        <Tooltip title="Sync Configuration to Repo">
                           <IconButton
                             aria-label="sync"
                             size="small"
                             color="secondary"
                             onClick={(e) => { e.stopPropagation(); handleSync(inst.id); }}
                             // disabled={inst.last_sync_status === 'pending'} // Disable if pending?
                           >
                                <SyncIcon fontSize="inherit" />
                           </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Instance">
                            <IconButton
                              aria-label="delete"
                              size="small"
                              color="error"
                              onClick={(e) => { e.stopPropagation(); handleDelete(inst.id, inst.name); }}
                            >
                                <DeleteIcon fontSize="inherit" />
                            </IconButton>
                        </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

export default ClientInstanceListPage;