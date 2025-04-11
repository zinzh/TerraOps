import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import clientInstanceService from '../services/clientInstanceService';
import blueprintService from '../services/blueprintService';
import { ClientInstance, Blueprint, TfVariable, VariableDefinitions } from '../types';

// MUI Components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save'; // Or SyncIcon
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';

function ClientInstanceDetailPage() {
    const { id } = useParams<{ id: string }>(); // Get Instance ID from URL
    const navigate = useNavigate();

    // State
    const [instance, setInstance] = useState<ClientInstance | null>(null);
    const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
    const [variableValues, setVariableValues] = useState<Record<string, any>>({});
    const [initialValues, setInitialValues] = useState<Record<string, any>>({}); // To track changes

    const [loading, setLoading] = useState<boolean>(true);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch Instance and its Blueprint details
    const fetchData = useCallback(async () => {
        if (!id) {
            setError("No client instance ID provided.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        setBlueprint(null); // Reset blueprint on refetch
        setVariableValues({});
        setInitialValues({});

        try {
            // Fetch instance first
            const instanceData = await clientInstanceService.getClientInstanceById(id);
            setInstance(instanceData);

            // Then fetch its blueprint
            if (instanceData.blueprint_id) {
                const blueprintData = await blueprintService.getBlueprintById(instanceData.blueprint_id);
                setBlueprint(blueprintData);

                // Initialize form values from instanceData.variable_values or blueprint defaults
                const currentValues = instanceData.variable_values || {};
                const initialFormValues: Record<string, any> = {};
                if (blueprintData.variables_definition) {
                     const definitions = getVariableDefinitions(blueprintData) || {};
                     Object.values(definitions).forEach(variable => {
                         // Prioritize instance value, fall back to blueprint default, then type default
                         if (currentValues.hasOwnProperty(variable.name)) {
                             initialFormValues[variable.name] = currentValues[variable.name];
                         } else if (variable.default !== undefined && variable.default !== null) {
                             initialFormValues[variable.name] = variable.default;
                         } else {
                             initialFormValues[variable.name] = getDefaultValueForType(variable.type);
                         }
                     });
                }
                setVariableValues(initialFormValues);
                setInitialValues(initialFormValues); // Store initial state for comparison
            } else {
                 setError("Instance is missing blueprint association.");
            }

        } catch (err: any) {
            setError(err.response?.data?.error || `Failed to fetch details for instance ${id}.`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [id]); // Re-fetch if ID changes

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // --- Event Handlers ---
    const handleVariableChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, varName: string) => {
        const target = event.target;
        let value: any;

        if (target instanceof HTMLInputElement && target.type === 'checkbox') {
             value = target.checked;
        } else if (target instanceof HTMLInputElement && target.type === 'number') {
             value = target.value === '' ? undefined : Number(target.value);
        } else {
             value = target.value;
        }

        setVariableValues(prev => ({ ...prev, [varName]: value }));
    };

    const handleSaveAndSync = async () => {
        if (!id || !instance) {
             setError("Cannot sync: Instance data not loaded.");
             return;
        }
        setError(null);
        setIsSyncing(true);

        const syncData: { variable_values: any; commit_message?: string } = {
            variable_values: variableValues,
            // TODO: Maybe allow custom commit message via a dialog?
            // commit_message: "Configuration update via TerraOps UI"
        };

        try {
             // Note: The backend's sync might implicitly save the values via UpdateSyncStatus.
             // If not, we might need a separate PUT /client-instances/:id request first.
             // Assuming /sync updates the values as well for now.
            await clientInstanceService.syncClientInstance(id, syncData);

            // Success: Show feedback and refresh data to get latest sync status
            alert('Sync request submitted successfully. Refreshing data...');
            setInitialValues(variableValues); // Update initial values to match saved state
            setTimeout(fetchData, 2000); // Refresh after delay

        } catch (err: any) {
            console.error("Sync failed:", err);
            const errorMsg = err.response?.data?.details || err.response?.data?.error || 'Sync operation failed.';
            setError(`Sync Failed: ${errorMsg}`);
        } finally {
            setIsSyncing(false);
        }
    };

     // --- Helper Functions --- (Copied/adapted from Create Page)
     const getVariableDefinitions = (bp: Blueprint | null): VariableDefinitions | null => {
         if (!bp || !bp.variables_definition) return null;
         try {
             if (typeof bp.variables_definition === 'string') {
                  return JSON.parse(bp.variables_definition) as VariableDefinitions;
             }
             return bp.variables_definition as VariableDefinitions;
         } catch(e) {
              console.error("Failed to parse variables definition", e);
              setError("Failed to read blueprint variable definitions.");
              return null;
         }
     };
     const definitions = getVariableDefinitions(blueprint);

     const getDefaultValueForType = (typeStr: any): any => { /* ... same as create page ... */
         const typeJson = JSON.stringify(typeStr).toLowerCase();
         if (typeJson.includes("bool")) return false;
         if (typeJson.includes("number")) return 0;
         if (typeJson.includes("list") || typeJson.includes("tuple")) return [];
         if (typeJson.includes("map") || typeJson.includes("object")) return {};
         return "";
     };

     // Render form field based on variable definition (same as create page)
     const renderVariableInput = (variable: TfVariable) => { /* ... same as create page ... */
         const key = variable.name;
         const currentValue = variableValues[key] ?? '';

         const typeString = JSON.stringify(variable.type).toLowerCase();
         const isBool = typeString.includes('"bool"');
         const isNumber = typeString.includes('"number"');

         if (isBool) {
              return ( <FormControlLabel control={ <Switch checked={!!currentValue} onChange={(e) => handleVariableChange(e, key)} name={key} disabled={loading || isSyncing} /> } label={variable.name} key={key} /> );
         }

         return ( <TextField key={key} margin="dense" fullWidth id={key} label={variable.name} name={key} required={!variable.nullable && variable.default === undefined} value={currentValue} onChange={(e) => handleVariableChange(e, key)} disabled={loading || isSyncing} helperText={variable.description || ''} type={isNumber ? 'number' : variable.sensitive ? 'password' : 'text'} multiline={!isNumber && !isBool && String(currentValue).length > 60} rows={!isNumber && !isBool && String(currentValue).length > 60 ? 3 : 1} InputLabelProps={{ shrink: true, }} /> );
     };

     // Check if form has changes compared to initial load
     const hasChanges = JSON.stringify(variableValues) !== JSON.stringify(initialValues);

     // Helper to determine chip color based on status (copied from list page)
     const getStatusColor = (status?: string): "default" | "success" | "warning" | "error" => {
        switch (status) {
          case "success":
            return "success";
          case "warning":
            return "warning";
          case "error":
            return "error";
          default:
            return "default";
        }
      };

    // --- Render Logic ---
    if (loading && !instance) { // Initial loading
        return ( <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}> <CircularProgress /> </Box> );
    }

    return (
        <Box>
             <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/client-instances')} sx={{ mb: 2 }}>
                 Back to Instances
             </Button>

             {/* Display fatal error if instance loading failed */}
             {error && !instance && ( <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> )}

             {instance && (
                <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h4" component="h1">
                             Client Instance: {instance.name}
                        </Typography>
                        <Box>
                             <Tooltip title="Refresh Data">
                                <IconButton onClick={fetchData} color="primary" disabled={loading || isSyncing}>
                                    <RefreshIcon />
                                </IconButton>
                             </Tooltip>
                              <Button
                                 variant="contained"
                                 color="primary"
                                 startIcon={isSyncing ? <CircularProgress size={20} color="inherit"/> :<SaveIcon />}
                                 onClick={handleSaveAndSync}
                                 disabled={loading || isSyncing || !hasChanges} // Disable if no changes
                                 sx={{ ml: 1 }}
                              >
                                 {isSyncing ? 'Syncing...' : 'Save & Sync Changes'}
                             </Button>
                        </Box>
                    </Box>

                     {/* Display non-fatal errors (e.g., sync errors) */}
                     {error && instance && ( <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert> )}

                    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                        <Typography variant="h6" gutterBottom>Instance Details</Typography>
                        <Typography variant="body1" gutterBottom> <strong>ID:</strong> {instance.id} </Typography>
                        <Typography variant="body1" gutterBottom> <strong>Description:</strong> {instance.description || <em>None</em>} </Typography>
                        {blueprint && <Typography variant="body1" gutterBottom> <strong>Blueprint:</strong> {blueprint.name} ({blueprint.id}) </Typography> }
                        <Typography variant="body1" gutterBottom>
                             <strong>Client Repo:</strong> 
                             <Link href={instance.client_repo_url.startsWith('http') ? instance.client_repo_url : '#'} target="_blank" rel="noopener noreferrer">{instance.client_repo_url}</Link>
                              (Branch: {instance.client_repo_branch})
                        </Typography>
                        <Typography variant="body1" gutterBottom>
                            <strong>Last Sync:</strong> 
                            {instance.last_synced_at ? new Date(instance.last_synced_at).toLocaleString() : 'Never'}
                            {instance.last_sync_status &&
                                <Tooltip title={instance.last_sync_message || instance.last_sync_status}>
                                    <Chip label={instance.last_sync_status} size="small" color={getStatusColor(instance.last_sync_status)} sx={{ ml: 1 }} />
                                </Tooltip>
                             }
                        </Typography>
                    </Paper>

                    <Divider sx={{ my: 3 }} />

                    <Paper elevation={2} sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Configuration Variables</Typography>
                        {loading && <CircularProgress size={20} /> } {/* Show small loader while blueprint/vars load */}

                        {!loading && !blueprint && <Alert severity="warning">Blueprint details could not be loaded.</Alert>}

                        {!loading && blueprint && !definitions && <Alert severity="warning">Variable definitions not available for this blueprint.</Alert>}

                        {!loading && definitions && Object.keys(definitions).length === 0 && (
                             <Typography sx={{ fontStyle: 'italic', color: 'text.secondary' }}> This blueprint has no defined variables. </Typography>
                        )}

                        {!loading && definitions && Object.keys(definitions).length > 0 && (
                             Object.values(definitions)
                                 .sort((a, b) => a.name.localeCompare(b.name))
                                 .map(renderVariableInput)
                         )}
                    </Paper>
                </>
             )}
        </Box>
    );
}

export default ClientInstanceDetailPage;