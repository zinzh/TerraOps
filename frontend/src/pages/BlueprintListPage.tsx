import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // For navigation later
import blueprintService from '../services/blueprintService';
import { Blueprint } from '../types'; // Import type

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
import PlayArrowIcon from '@mui/icons-material/PlayArrow'; // For Parse action
import Tooltip from '@mui/material/Tooltip';

// We'll add a Layout component later for the AppBar
// import AppLayout from '../components/AppLayout';

function BlueprintListPage() {
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate(); // Make sure useNavigate is imported



  const fetchBlueprints = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await blueprintService.listBlueprints();
      setBlueprints(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch blueprints.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch blueprints on component mount
  useEffect(() => {
    fetchBlueprints();
  }, []); // Empty dependency array means run once on mount

  const handleRefresh = () => {
      fetchBlueprints();
  }

  const handleParse = async (id: string) => {
      // Basic feedback, could be more sophisticated (e.g., disable button, show status)
      console.log(`Requesting parse for blueprint ${id}`);
      try {
          const result = await blueprintService.parseBlueprint(id);
          console.log("Parse result:", result);
          // Optionally show success message or refresh list/details
          alert(`Parsing started for blueprint ${id}. Check logs or refresh details.`);
          // Consider refreshing the specific row or the whole list after a delay
          // fetchBlueprints();
      } catch (err: any) {
          console.error(`Failed to parse blueprint ${id}:`, err);
          const errorMsg = err.response?.data?.error || 'Failed to trigger parsing.';
          setError(`Failed to parse blueprint ${id}: ${errorMsg}`); // Show error specific to parse
      }
  }

  const handleDelete = async (id: string, name: string) => {
      if (window.confirm(`Are you sure you want to delete blueprint "${name}"?`)) {
          try {
              await blueprintService.deleteBlueprint(id);
              // Refresh list after successful deletion
              fetchBlueprints();
          } catch (err: any) {
              console.error(`Failed to delete blueprint ${id}:`, err);
              const errorMsg = err.response?.data?.error || 'Failed to delete blueprint.';
              setError(errorMsg); // Show delete error
          }
      }
  }

  const handleCreate = () => {
      navigate('/blueprints/new'); 
  };

  const handleRowClick = (id: string) => {
    navigate(`/blueprints/${id}`); // Navigate to detail page
    // alert(`Navigate to Detail page for blueprint ${id} (to be implemented)`); // Remove alert
}


  return (
    // Replace Box with AppLayout later if desired
    <Box sx={{ padding: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Blueprints
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
             sx={{ ml: 1 }} // Add some margin
            >
              Create Blueprint
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
          <Table sx={{ minWidth: 650 }} aria-label="simple blueprint table">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Repository URL</TableCell>
                <TableCell>Last Parsed</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {blueprints.length === 0 && !loading ? (
                  <TableRow>
                      <TableCell colSpan={5} align="center">
                          No blueprints found.
                      </TableCell>
                  </TableRow>
              ) : (
                blueprints.map((bp) => (
                  <TableRow
                    key={bp.id}
                    sx={{
                       '&:last-child td, &:last-child th': { border: 0 },
                       '&:hover': { backgroundColor: 'action.hover', cursor: 'pointer' }
                    }}
                    onClick={() => handleRowClick(bp.id)} // Make row clickable
                  >
                    <TableCell component="th" scope="row">
                      {bp.name}
                    </TableCell>
                    <TableCell>{bp.description || '-'}</TableCell>
                    <TableCell>{bp.git_repo_url}</TableCell>
                    <TableCell>
                       {bp.last_parsed_at ? new Date(bp.last_parsed_at).toLocaleString() : 'Never'}
                       {bp.parse_error && <Tooltip title={bp.parse_error}><Typography variant="caption" color="error" sx={{ display: 'block' }}>(Error)</Typography></Tooltip>}
                    </TableCell>
                    <TableCell align="right">
                        {/* Stop propagation prevents row click when clicking icon buttons */}
                        <Tooltip title="Parse Variables">
                           <IconButton
                             aria-label="parse"
                             size="small"
                             color="primary"
                             onClick={(e) => { e.stopPropagation(); handleParse(bp.id); }}
                           >
                                <PlayArrowIcon fontSize="inherit" />
                           </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Blueprint">
                            <IconButton
                              aria-label="delete"
                              size="small"
                              color="error"
                              onClick={(e) => { e.stopPropagation(); handleDelete(bp.id, bp.name); }}
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

export default BlueprintListPage;