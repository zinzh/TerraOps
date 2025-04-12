import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate,Link as RouterLink } from 'react-router-dom';
import { useForm, Controller, SubmitHandler } from 'react-hook-form'; // Import RHF
import clientInstanceService from '../services/clientInstanceService';
import blueprintService from '../services/blueprintService';
import { ClientInstance, Blueprint, TfVariable, VariableDefinitions } from '../types';
import DeleteIcon from '@mui/icons-material/Delete';

// MUI Components (include necessary ones)
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
import { FormControl, FormHelperText, Stack } from '@mui/material';


interface ClientInstanceEditFormData {
    // Instance details that might be editable (optional for now)
    // instanceName: string;
    // instanceDescription?: string;
    // clientRepoUrl: string;
    // clientRepoBranch?: string;

    // Variable values are the primary editable part
    variables: Record<string, any>;
}

function ClientInstanceDetailPage() {
    const [newItem, setNewItem] = useState(''); // Local state for the input field
    const { id } = useParams<{ id: string }>(); // Get Instance ID
    const navigate = useNavigate();

    // State for loaded data
    const [instance, setInstance] = useState<ClientInstance | null>(null);
    const [blueprint, setBlueprint] = useState<Blueprint | null>(null);

    // RHF setup - Initialize defaultValues later in useEffect
    const { handleSubmit, control, reset, watch, formState: { errors, isSubmitting, isDirty } } = useForm<ClientInstanceEditFormData>({
         defaultValues: { variables: {} } // Start with empty vars
    });

    // General loading/error state
    const [loading, setLoading] = useState<boolean>(true);
    const [apiError, setApiError] = useState<string | null>(null);

    // Fetch Instance and its Blueprint details
    const fetchData = useCallback(async (instanceId: string) => {
        setLoading(true);
        setApiError(null);
        try {
            // Fetch instance first
            const instanceData = await clientInstanceService.getClientInstanceById(instanceId);
            setInstance(instanceData);

            // Then fetch its blueprint
            if (instanceData.blueprint_id) {
                const blueprintData = await blueprintService.getBlueprintById(instanceData.blueprint_id);
                setBlueprint(blueprintData);

                // Initialize form values for RHF using reset
                const currentValues = instanceData.variable_values || {};
                const initialFormValues: Record<string, any> = {};
                 if (blueprintData.variables_definition) {
                     const definitions = getVariableDefinitions(blueprintData) || {};
                     Object.values(definitions).forEach(variable => {
                         if (currentValues.hasOwnProperty(variable.name)) {
                             initialFormValues[variable.name] = currentValues[variable.name];
                         } else if (variable.default !== undefined && variable.default !== null) {
                             initialFormValues[variable.name] = variable.default;
                         } else {
                             initialFormValues[variable.name] = getDefaultValueForType(variable.type);
                         }
                     });
                 }
                 // Use reset to update the entire form state including defaultValues
                 reset({ variables: initialFormValues });

            } else {
                 setApiError("Instance is missing blueprint association.");
                 reset({ variables: {} }); // Reset form if blueprint missing
            }

        } catch (err: any) {
            setApiError(err.response?.data?.error || `Failed to fetch details for instance ${instanceId}.`);
            console.error(err);
            reset({ variables: {} }); // Reset form on error
        } finally {
            setLoading(false);
        }
    }, [reset]); // Include reset in dependencies

    // Initial fetch
    useEffect(() => {
        if (id) {
            fetchData(id);
        } else {
             setApiError("No client instance ID provided.");
             setLoading(false);
        }
    }, [id, fetchData]); // Depend on id and the fetchData callback


    // Form submission handler
    const onSubmit: SubmitHandler<ClientInstanceEditFormData> = async (data) => {
        if (!id || !instance) {
             setApiError("Cannot sync: Instance data not loaded.");
             return;
        }
        setApiError(null);

        const syncData = {
            variable_values: data.variables, // Use the latest values from RHF
            // commit_message: "Configuration update via TerraOps UI" // Optional commit message
        };

        try {
            await clientInstanceService.syncClientInstance(id, syncData);
            // Success: Show feedback and refresh data to get latest sync status and reset dirty state
            alert('Sync request submitted successfully. Refreshing data...');
            // Refetch data which will call reset() with the new values from the server
            // This also resets the form's dirty state (isDirty becomes false)
            fetchData(id);

        } catch (err: any) {
            console.error("Sync failed:", err);
            const errorMsg = err.response?.data?.details || err.response?.data?.error || 'Sync operation failed.';
            setApiError(`Sync Failed: ${errorMsg}`);
        }
         // isSubmitting is handled by RHF
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
              //setError("Failed to read blueprint variable definitions.");
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
     const renderVariableInput = (variable: TfVariable) => {
        const key = variable.name;
         const variablePath = `variables.${key}` as const;
         const typeString = JSON.stringify(variable.type).toLowerCase();
         const isBool = typeString.includes('"bool"');
         const isNumber = typeString.includes('"number"');
         const isList = typeString.startsWith('"list') || typeString.startsWith('"tuple'); // Basic check for list/tuple
         // More specific check (e.g., for list(string)) might involve parsing typeString
         const isStringList = isList && typeString.includes('string');
         // Add checks for list(number), map(string), etc. later

         const isRequired = !variable.nullable && variable.default === undefined;

         if (isStringList) {
            // Use Controller to manage the list array itself
            return (
                <Controller
                    key={key}
                    name={variablePath}
                    control={control}
                    defaultValue={[]} // Default to empty array for RHF
                    rules={{
                         validate: (value) => !isRequired || (Array.isArray(value) && value.length > 0) || 'At least one item is required'
                    }}
                    render={({ field, fieldState: { error: fieldError } }) => {
                        // field.value should be the array
                        const currentList: string[] = Array.isArray(field.value) ? field.value : [];


                        const handleAddItem = () => {
                            if (newItem.trim()) {
                                // Update RHF field state with the new array
                                field.onChange([...currentList, newItem.trim()]);
                                setNewItem(''); // Clear input
                            }
                        };

                        const handleRemoveItem = (indexToRemove: number) => {
                            field.onChange(currentList.filter((_, index) => index !== indexToRemove));
                        };

                        return (
                            <FormControl fullWidth margin="dense" error={!!fieldError} component="fieldset" variant="outlined" sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Typography component="legend" variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>{key}</Typography>
                                {variable.description && <FormHelperText sx={{mt: -1, mb: 1}}>{variable.description}</FormHelperText>}
                                {/* List existing items */}
                                <Stack spacing={1} sx={{ mb: 1 }}>
                                    {currentList.map((item, index) => (
                                        <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography sx={{ flexGrow: 1 }}>{item}</Typography>
                                            <IconButton size="small" onClick={() => handleRemoveItem(index)} disabled={isSubmitting || loading} color="error">
                                                <DeleteIcon fontSize="inherit" />
                                            </IconButton>
                                        </Box>
                                    ))}
                                    {currentList.length === 0 && <Typography variant="caption" color="textSecondary">(No items added yet)</Typography>}
                                </Stack>
                                {/* Input to add new item */}
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <TextField
                                        size="small"
                                        label="New Item"
                                        value={newItem}
                                        onChange={(e) => setNewItem(e.target.value)}
                                        disabled={isSubmitting || loading}
                                        sx={{ flexGrow: 1 }}
                                        onKeyDown={(e) => { // Allow adding with Enter key
                                              if (e.key === 'Enter') {
                                                  e.preventDefault(); // Prevent form submission
                                                  handleAddItem();
                                              }
                                          }}
                                    />
                                    <Button variant="outlined" size="small" onClick={handleAddItem} disabled={isSubmitting || loading || !newItem.trim()}>Add</Button>
                                </Box>
                                 {/* Display validation error for the list */}
                                 {fieldError && <FormHelperText error>{fieldError.message}</FormHelperText>}
                            </FormControl>
                        );
                    }}
                />
            );
        }

        if (isBool) {
            return ( <FormControlLabel key={key} control={ <Controller name={variablePath} control={control} defaultValue={false} render={({ field: { onChange, value, ref } }) => ( <Switch checked={!!value} onChange={onChange} inputRef={ref} disabled={isSubmitting || loading} /> )} /> } label={key} /> );
       }

       // --- Default TextField Input using Controller ---
       return ( <Controller key={key} name={variablePath} control={control} rules={{ required: isRequired ? 'This field is required' : false }} render={({ field, fieldState: { error: fieldError } }) => ( <TextField {...field} margin="dense" fullWidth required={isRequired} label={key} error={!!fieldError} helperText={fieldError?.message || variable.description || ''} disabled={isSubmitting || loading} type={isNumber ? 'number' : variable.sensitive ? 'password' : 'text'} multiline={!isNumber && !isBool && String(field.value ?? '').length > 60} rows={!isNumber && !isBool && String(field.value ?? '').length > 60 ? 3 : 1} InputLabelProps={{ shrink: true }} /> )} /> );
   };

     // Check if form has changes compared to initial load
     //const hasChanges = JSON.stringify(variableValues) !== JSON.stringify(initialValues);

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

             {apiError && !instance && ( <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert> )}

             {instance && (
                 // Use RHF handleSubmit for the form
                <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h4" component="h1">
                             Client Instance: {instance.name}
                        </Typography>
                        <Box>
                             <Tooltip title="Refresh Data">
                                <IconButton onClick={() => id && fetchData(id)} color="primary" disabled={loading || isSubmitting}>
                                    <RefreshIcon />
                                </IconButton>
                             </Tooltip>
                              <Button
                                 type="submit" // Make this the submit button
                                 variant="contained"
                                 color="primary"
                                 startIcon={isSubmitting ? <CircularProgress size={20} color="inherit"/> :<SaveIcon />}
                                 disabled={loading || isSubmitting || !isDirty} // Disable if not dirty
                                 sx={{ ml: 1 }}
                              >
                                 {isSubmitting ? 'Syncing...' : 'Save & Sync Changes'}
                             </Button>
                        </Box>
                    </Box>

                     {apiError && instance && ( <Alert severity="error" sx={{ mb: 2 }} onClose={() => setApiError(null)}>{apiError}</Alert> )}

                    {/* Instance Details Section (Read Only For Now) */}
                    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
                        <Typography variant="h6" gutterBottom>Instance Details</Typography>
                         {/* ... Display ID, Description, Blueprint Name, Repo URL, Sync Status ... */}
                         <Typography variant="body1" gutterBottom> <strong>ID:</strong> {instance.id} </Typography>
                         <Typography variant="body1" gutterBottom> <strong>Description:</strong> {instance.description || <em>None</em>} </Typography>
                         {blueprint && <Typography variant="body1" gutterBottom> <strong>Blueprint:</strong> <RouterLink to={`/blueprints/${blueprint.id}`}>{blueprint.name}</RouterLink> ({blueprint.id.substring(0,8)}...) </Typography> }
                         <Typography variant="body1" gutterBottom>
                              <strong>Client Repo:</strong> 
                              <Link href={instance.client_repo_url.startsWith('http') ? instance.client_repo_url : '#'} target="_blank" rel="noopener noreferrer">{instance.client_repo_url}</Link>
                               (Branch: {instance.client_repo_branch})
                         </Typography>
                         <Typography variant="body1" gutterBottom>
                             <strong>Last Sync:</strong> 
                             {instance.last_synced_at ? new Date(instance.last_synced_at).toLocaleString() : 'Never'}
                             {instance.last_sync_status && <Tooltip title={instance.last_sync_message || instance.last_sync_status}>
    <Chip
      label={instance.last_sync_status}
      size="small"
      color={getStatusColor(instance.last_sync_status)}
      sx={{ ml: 1 }}
    />
  </Tooltip> }
                         </Typography>
                    </Paper>

                    <Divider sx={{ my: 3 }} />

                     {/* Editable Variables Section */}
                    <Paper elevation={2} sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Configuration Variables</Typography>
                        {!blueprint && <CircularProgress size={20} /> }
                        {!loading && !blueprint && <Alert severity="warning">Blueprint details could not be loaded.</Alert>}
                        {!loading && blueprint && !definitions && <Alert severity="warning">Variable definitions not available for this blueprint.</Alert>}
                        {!loading && definitions && Object.keys(definitions).length === 0 && ( <Typography sx={{ fontStyle: 'italic', color: 'text.secondary' }}> This blueprint has no defined variables. </Typography> )}
                        {!loading && definitions && Object.keys(definitions).length > 0 && (
                             Object.values(definitions)
                                 .sort((a, b) => a.name.localeCompare(b.name))
                                 .map(renderVariableInput) // Renders Controller inputs
                         )}
                    </Paper>

                    {/* Submit button moved to header */}
                </Box> // End Form
             )}
        </Box>
    );
}

export default ClientInstanceDetailPage;