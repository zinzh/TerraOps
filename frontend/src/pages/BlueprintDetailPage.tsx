import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import blueprintService from '../services/blueprintService';
import { Blueprint } from '../types';

// MUI Components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow'; // Parse
import EditIcon from '@mui/icons-material/Edit'; // Edit later
import { useSnackbar } from '../context/SnackbarContext';

function BlueprintDetailPage() {
    const { id } = useParams<{ id: string }>(); // Get ID from URL
    const navigate = useNavigate();
    const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isParsing, setIsParsing] = useState<boolean>(false); // State for parse action
    const { showSnackbar } = useSnackbar();


    const fetchBlueprint = useCallback(async () => {
        if (!id) {
            setError("No blueprint ID provided.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        showSnackbar('Triggering variable parsing...', 'info');
        try {
            const data = await blueprintService.getBlueprintById(id);
            showSnackbar('Parsing triggered successfully. Refreshing details...', 'success');
            setBlueprint(data);
        } catch (err: any) {
            setError(err.response?.data?.error || `Failed to fetch blueprint ${id}.`);
            showSnackbar(`Error triggering parse`, 'error'); 
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [id]); // Dependency: fetch again if id changes

    useEffect(() => {
        fetchBlueprint();
    }, [fetchBlueprint]); // Fetch on mount and when fetchBlueprint changes

    const handleRefresh = () => {
        fetchBlueprint();
    }

    const handleParse = async () => {
        if (!id) return;
        setIsParsing(true);
        setError(null); // Clear previous errors
        console.log(`Requesting parse for blueprint ${id}`);
        try {
            await blueprintService.parseBlueprint(id);
            // Show feedback and refresh data after a short delay
            showSnackbar('Parsing triggered successfully. Refreshing details...', 'success');
            setTimeout(fetchBlueprint, 2000); // Refresh after 2 seconds (adjust as needed)
        } catch (err: any) {
            console.error(`Failed to parse blueprint ${id}:`, err);
            const errorMsg = err.response?.data?.error || 'Failed to trigger parsing.';
            setError(`Parse Error: ${errorMsg}`);
            showSnackbar(`Error triggering parse: ${errorMsg}`, 'error');
        } finally {
            setIsParsing(false);
        }
    }

    const handleEdit = () => {
         // navigate(`/blueprints/${id}/edit`); // Navigate to edit page later
         alert(`Navigate to Edit page for blueprint ${id} (to be implemented)`);
    }

    // Helper to format JSON nicely
    const formatJson = (json?: any): string => {
        if (!json) return '{}';
        try {
             // Check if it's already a string representing JSON (like from initial fetch)
             if (typeof json === 'string') {
                return JSON.stringify(JSON.parse(json), null, 2);
             }
             // Otherwise, assume it's an object/array
            return JSON.stringify(json, null, 2);
        } catch (e) {
            console.error("Error formatting JSON:", e);
            return 'Error formatting JSON data.';
        }
    };


    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/blueprints')}
                sx={{ mb: 2 }}
            >
                Back to Blueprints
            </Button>

            {error && !blueprint && ( // Show fatal error only if blueprint couldn't be loaded at all
                <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            )}

            {blueprint && (
                <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h4" component="h1">
                            {blueprint.name}
                        </Typography>
                        <Box>
                             <Tooltip title="Refresh Details">
                                <IconButton onClick={handleRefresh} color="primary" disabled={loading || isParsing}>
                                    <RefreshIcon />
                                </IconButton>
                             </Tooltip>
                             <Tooltip title="Edit Blueprint">
                                <IconButton
                                    onClick={() => navigate(`/blueprints/${id}/edit`)} // Navigate on click
                                    color="default"
                                    disabled={loading || isParsing} // Disable while loading/parsing
                                >
                                    <EditIcon />
                                </IconButton>
                             </Tooltip>
                             <Tooltip title="Re-Parse Variables">
                                <span> {/* Span needed for tooltip on disabled button */}
                                <IconButton
                                    onClick={handleParse}
                                    color="secondary"
                                    disabled={isParsing || loading}
                                 >
                                    {isParsing ? <CircularProgress size={20} color="inherit"/> : <PlayArrowIcon />}
                                </IconButton>
                                </span>
                             </Tooltip>
                        </Box>
                    </Box>

                     {/* Show non-fatal errors (e.g., parse errors) here */}
                     {error && blueprint && (
                         <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                            {error}
                         </Alert>
                     )}


<Box
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', md: 'row' }, // Stack on small, row on medium+
                            gap: 3, // Spacing between columns
                        }}
                    >
                        {/* Left Column Box */}
                        <Box sx={{ flex: { xs: '1 1 auto', md: '0 0 40%' } }}> {/* Takes ~40% width on md+ */}
                            <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                                <Typography variant="h6" gutterBottom>Details</Typography>
                                <Typography variant="body1" gutterBottom>
                                    <strong>ID:</strong> {blueprint.id}
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    <strong>Description:</strong> {blueprint.description || <em>None</em>}
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    <strong>Repository:</strong> <Chip label={blueprint.git_repo_url} component="a" href={blueprint.git_repo_url.startsWith('http') ? blueprint.git_repo_url : '#'} target="_blank" clickable={blueprint.git_repo_url.startsWith('http')} size="small"/>
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    <strong>Created:</strong> {new Date(blueprint.created_at).toLocaleString()}
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    <strong>Updated:</strong> {new Date(blueprint.updated_at).toLocaleString()}
                                </Typography>
                                <Typography variant="h6" gutterBottom sx={{ mt: 2}}>Parsing Status</Typography>
                                <Typography variant="body1" gutterBottom>
                                     <strong>Last Parsed:</strong> {blueprint.last_parsed_at ? new Date(blueprint.last_parsed_at).toLocaleString() : 'Never'}
                                </Typography>
                                {blueprint.parse_error && (
                                     <Alert severity="warning" variant="outlined" sx={{ mt: 1}}>
                                         <strong>Last Parse Error:</strong> {blueprint.parse_error}
                                     </Alert>
                                 )}
                            </Paper>
                        </Box>

                        {/* Right Column Box */}
                        <Box sx={{ flex: { xs: '1 1 auto', md: '1 1 60%'} }}> {/* Takes remaining width (~60%) on md+ */}
                             <Paper elevation={2} sx={{ p: 2, height: '100%' }}>
                                <Typography variant="h6" gutterBottom>Variables Definition</Typography>
                                {blueprint.variables_definition ? (
                                    <Box
                                        component="pre"
                                        sx={{
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-all',
                                            maxHeight: '60vh',
                                            overflowY: 'auto',
                                            backgroundColor: 'grey.100',
                                            p: 1,
                                            borderRadius: 1,
                                            fontFamily: 'monospace',
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        {formatJson(blueprint.variables_definition)}
                                    </Box>
                                ) : (
                                    <Typography sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                                        No variables parsed yet. Click the parse button (▶) to fetch them.
                                    </Typography>
                                )}
                            </Paper>
                        </Box>
                    </Box>
                </>
            )}
        </Box>
    );
}

export default BlueprintDetailPage;