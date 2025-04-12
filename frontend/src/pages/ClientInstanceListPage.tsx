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
  const [syncingInstances, setSyncingInstances] = useState<Set<string>>(new Set());
  const [apiError, setApiError] = useState<string | null>(null);

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
    setApiError(null); // Clear general errors
    setSyncingInstances(prev => new Set(prev).add(id)); // Add instance ID to syncing set
    showSnackbar(`Initiating sync for instance ${id}...`, 'info');

    try {
        // Call sync endpoint without variable_values in the body.
        // Backend will use the last saved values.
        // We pass an empty object {} for the 'data' argument as syncClientInstance expects it,
        // but the backend logic ignores it if content-type isn't set or body is empty.
        // A cleaner way might be to overload syncClientInstance or have a dedicated function.
         const syncData = {} as any; // Explicitly empty - adjust service if needed
        await clientInstanceService.syncClientInstance(id, syncData);

        showSnackbar(`Instance ${id} sync submitted successfully. Status will update shortly.`, 'success');
        // Refresh the list after a short delay to see the updated status
        setTimeout(fetchInstances, 3000); // Refresh after 3s

    } catch (err: any) {
        console.error(`Sync failed for instance ${id}:`, err);
        const errorMsg = err.response?.data?.details || err.response?.data?.error || 'Sync operation failed.';
        // Set general error or find a way to show error per row? General is simpler.
        setApiError(`Sync Failed for ${id}: ${errorMsg}`);
        showSnackbar(`Sync Failed for ${id}: ${errorMsg}`, 'error');
    } finally {
         // Remove instance ID from syncing set
        setSyncingInstances(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }
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

          {/* Display general API errors */}
          {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {error}
              </Alert>
          )}

          {/* Loading state for the whole table */}
          {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <CircularProgress />
              </Box>
          ) : (
              // Table rendering
              <TableContainer component={Paper}>
                  <Table sx={{ minWidth: 650 }} aria-label="client instance table">
                      <TableHead>
                          <TableRow>
                              <TableCell>Name</TableCell>
                              <TableCell>Description</TableCell>
                              <TableCell>Blueprint</TableCell> {/* Header Updated */}
                              <TableCell>Repo URL</TableCell>
                              <TableCell>Last Sync</TableCell>
                              <TableCell align="right">Actions</TableCell>
                          </TableRow>
                      </TableHead>
                      <TableBody>
                          {/* Handle case where there are no instances */}
                          {instances.length === 0 && !loading ? (
                              <TableRow>
                                  <TableCell colSpan={6} align="center">
                                      No client instances found.
                                  </TableCell>
                              </TableRow>
                          ) : (
                              // Map through instances to create rows
                              instances.map((inst) => {
                                  const isSyncing = syncingInstances.has(inst.id); // Check if this row's sync is in progress
                                  return (
                                      <TableRow
                                          key={inst.id}
                                          hover
                                          onClick={() => handleRowClick(inst.id)} // Make row clickable for navigation
                                          sx={{ cursor: 'pointer' }}
                                      >
                                          {/* Instance Name */}
                                          <TableCell component="th" scope="row">
                                              {inst.name}
                                          </TableCell>
                                          {/* Instance Description */}
                                          <TableCell>{inst.description || '-'}</TableCell>
                                          {/* Blueprint Name (with link if available) */}
                                          <TableCell>
                                              {inst.blueprint_name ? (
                                                  <RouterLink to={`/blueprints/${inst.blueprint_id}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                      <Typography variant='body2' component='span' sx={{ '&:hover': { textDecoration: 'underline' } }}>
                                                          {inst.blueprint_name}
                                                      </Typography>
                                                  </RouterLink>
                                              ) : (
                                                  <Tooltip title={inst.blueprint_id}>
                                                      <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                                          {inst.blueprint_id.substring(0, 8)}... (Not Found?)
                                                      </Typography>
                                                  </Tooltip>
                                              )}
                                          </TableCell>
                                          {/* Client Repo URL (external link) */}
                                          <TableCell>
                                              <Link href={inst.client_repo_url.startsWith('http') ? inst.client_repo_url : '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} sx={{ display: 'inline-block', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                                                  {inst.client_repo_url}
                                              </Link>
                                          </TableCell>
                                          {/* Last Sync Status Cell */}
                                          <TableCell>
                                              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                  <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                                                      {inst.last_synced_at ? new Date(inst.last_synced_at).toLocaleString() : 'Never'}
                                                  </Typography>
                                                  {inst.last_sync_status && (
                                                      <Chip
                                                          label={inst.last_sync_status}
                                                          size="small"
                                                          color={getStatusColor(inst.last_sync_status)}
                                                          sx={{ mt: 0.5, alignSelf: 'flex-start' }}
                                                      />
                                                  )}
                                                  {/* Show error message clearly if status is failed */}
                                                  {inst.last_sync_status === 'failed' && inst.last_sync_message && (
                                                      <Tooltip title={inst.last_sync_message}>
                                                          <Typography variant="caption" color="error" sx={{ mt: 0.5, fontStyle: 'italic', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                              Error: {inst.last_sync_message}
                                                          </Typography>
                                                      </Tooltip>
                                                  )}
                                              </Box>
                                          </TableCell>
                                          {/* Actions Cell */}
                                          <TableCell align="right">
                                              <Tooltip title="Sync Configuration to Repo (uses last saved values)">
                                                  <span> {/* Wrap IconButton for Tooltip when disabled */}
                                                      <IconButton
                                                          aria-label="sync"
                                                          size="small"
                                                          color="secondary"
                                                          onClick={(e) => { e.stopPropagation(); handleSync(inst.id); }}
                                                          disabled={isSyncing} // Disable button while this instance is syncing
                                                      >
                                                          {/* Show progress spinner if syncing */}
                                                          {isSyncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon fontSize="inherit" />}
                                                      </IconButton>
                                                  </span>
                                              </Tooltip>
                                              <Tooltip title="Delete Instance">
                                                  <span> {/* Wrap IconButton for Tooltip when disabled */}
                                                      <IconButton
                                                          aria-label="delete"
                                                          size="small"
                                                          color="error"
                                                          onClick={(e) => { e.stopPropagation(); handleDelete(inst.id, inst.name); }}
                                                          disabled={isSyncing} // Also disable delete while syncing
                                                      >
                                                          <DeleteIcon fontSize="inherit" />
                                                      </IconButton>
                                                  </span>
                                              </Tooltip>
                                          </TableCell>
                                      </TableRow>
                                  );
                              }) // End map
                          )}
                      </TableBody>
                  </Table>
              </TableContainer>
          )}
      </Box> // Closing Box for the main component return
  );
}

export default ClientInstanceListPage;