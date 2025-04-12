import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate,Link as RouterLink } from 'react-router-dom';
import { useForm, Controller, SubmitHandler } from 'react-hook-form'; // Import RHF
import clientInstanceService from '../services/clientInstanceService';
import blueprintService from '../services/blueprintService';
import { ClientInstance, Blueprint, TfVariable, VariableDefinitions } from '../types';
import DeleteIcon from '@mui/icons-material/Delete';
import ObjectJsonInput from '../components/ObjectJsonInput';

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
import { useSnackbar } from '../context/SnackbarContext';


interface ClientInstanceEditFormData {
    // Instance details that might be editable (optional for now)
    // instanceName: string;
    // instanceDescription?: string;
    // clientRepoUrl: string;
    // clientRepoBranch?: string;

    // Variable values are the primary editable part
    blueprintVersion?: string; // Add field
    variables: Record<string, any>;
}

function ClientInstanceDetailPage() {
    const [newItem, setNewItem] = useState(''); // Local state for the input field
    const { id } = useParams<{ id: string }>(); // Get Instance ID
    const navigate = useNavigate();

    // State for loaded data
    const [instance, setInstance] = useState<ClientInstance | null>(null);
    const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
    const { showSnackbar } = useSnackbar(); 

    // RHF setup - Initialize defaultValues later in useEffect
    const { handleSubmit, control, reset, watch, formState: { errors, isSubmitting, isDirty } } = useForm<ClientInstanceEditFormData>({
        defaultValues: { blueprintVersion: '', variables: {} }
    });

    // General loading/error state
    const [loading, setLoading] = useState<boolean>(true);
    const [apiError, setApiError] = useState<string | null>(null);
    const [newValue, setNewValue] = useState('');
    const [newKey, setNewKey] = useState('');

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
                 reset({
                    variables: initialFormValues,
                    blueprintVersion: instanceData.blueprint_version || '' // Populate from instance
                });

            } else {
                 setApiError("Instance is missing blueprint association.");
                 reset({ blueprintVersion: '', variables: {} });
            }

        } catch (err: any) {
            setApiError(err.response?.data?.error || `Failed to fetch details for instance ${instanceId}.`);
            console.error(err);
            reset({ blueprintVersion: '', variables: {} });
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
        showSnackbar('Submitting sync request...', 'info');

        const syncData = {
            variable_values: data.variables, // Use the latest values from RHF
            // commit_message: "Configuration update via TerraOps UI" // Optional commit message
        };

        try {
            await clientInstanceService.syncClientInstance(id, syncData);
            // Success: Show feedback and refresh data to get latest sync status and reset dirty state
            showSnackbar('Sync request submitted successfully. Refreshing data...', 'success'); 
            // Refetch data which will call reset() with the new values from the server
            // This also resets the form's dirty state (isDirty becomes false)
            fetchData(id);

        } catch (err: any) {
            console.error("Sync failed:", err);
            const errorMsg = err.response?.data?.details || err.response?.data?.error || 'Sync operation failed.';
            setApiError(`Sync Failed: ${errorMsg}`);
            showSnackbar(`Sync Failed: ${errorMsg}`, 'error'); 
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


     const getFieldTypeInfo = (typeJson: any): { baseType: string, subType1?: string, subType2?: string } => {
        try {
            let typeString = '';
            // It might be a string like "\"object({\\\n    key1 = string\\\n    key2 = number\\\n  })\""
            // Or already parsed JSON from backend like {"type":"object", "attrs":...}
            // Or from cty like {"object":{"key1":"string"}}
            if (typeof typeJson === 'string') {
                // Attempt to remove outer quotes and unescape
                try { typeString = JSON.parse(typeJson); } catch { typeString = typeJson; }
            } else if (typeof typeJson === 'object' && typeJson !== null) {
                 // Handle potential object representations from CTY or custom backend parsing
                 if (typeJson.type === 'object') return { baseType: 'object' }; // Simplistic
                 if (typeJson.object) return { baseType: 'object' }; // Simplistic
                 // Fallback to stringify for keyword check if unsure
                 typeString = JSON.stringify(typeJson).toLowerCase();
            } else {
                 typeString = String(typeJson).toLowerCase();
            }

            typeString = typeString.toLowerCase(); // Ensure lowercase

            if (typeString.startsWith('object') || typeString.startsWith('map')) {
                 // Basic check for map(string) vs object
                 if (typeString.startsWith('map') && typeString.includes('string')) return { baseType: 'map', subType1: 'string' };
                 // Assume object otherwise for now
                 return { baseType: 'object' };
            }
            if (typeString.startsWith('list') || typeString.startsWith('tuple') || typeString.startsWith('set')) {
                if (typeString.includes('string')) return { baseType: 'list', subType1: 'string' };
                if (typeString.includes('number')) return { baseType: 'list', subType1: 'number' };
                 // Basic check for list(object) - needs better parsing for real use
                if (typeString.includes('object')) return { baseType: 'list', subType1: 'object' };
                return { baseType: 'list' }; // Generic list
            }
            if (typeString.includes('string')) return { baseType: 'string' };
            if (typeString.includes('number')) return { baseType: 'number' };
            if (typeString.includes('bool')) return { baseType: 'bool' };

            return { baseType: 'unknown' }; // Default fallback

        } catch (e) {
            console.error("Error parsing type info:", typeJson, e);
            return { baseType: 'unknown' };
        }
     };

     // Render form field based on variable definition (same as create page)
     const renderVariableInput = (variable: TfVariable, pathPrefix: string = 'variables') => {
        const key = variable.name;
        const variablePath = `${pathPrefix}.${key}` as any;
        const typeInfo = getFieldTypeInfo(variable.type);
        const isRequired = !variable.nullable && variable.default === undefined;
        
        if (typeInfo.baseType === 'object') {
            // Render the dedicated component via Controller
            return (
                <Controller
                    key={variablePath}
                    name={variablePath}
                    control={control}
                    defaultValue={{}} // Default for RHF
                    rules={{
                        // Validation still happens here based on the value RHF holds
                        validate: (value) => {
                            if (isRequired && (typeof value !== 'object' || value === null || Object.keys(value).length === 0)) {
                                return 'This object field is required and cannot be empty.';
                            }
                            // The validation rule now primarily checks if the stored value
                            // is an object (meaning JSON was valid). If it stored the invalid
                            // string from ObjectJsonInput, this check might fail correctly.
                            if (typeof value !== 'object') {
                                return 'Invalid JSON format.'
                            }
                            return true;
                        }
                    }}
                    render={({ field, fieldState: { error: fieldError } }) => (
                        // Pass RHF field props to the custom component
                        <ObjectJsonInput
                            label={key}
                            description={variable.description}
                            value={field.value} // Pass RHF value
                            onChange={field.onChange} // Pass RHF onChange
                            error={fieldError?.message} // Pass RHF error message
                            disabled={isSubmitting || loading}
                        />
                    )}
                />
            );
         }
         
         if (typeInfo.baseType === 'map' && typeInfo.subType1 === 'string') {
            return (
                <Controller
                    key={key}
                    name={variablePath}
                    control={control}
                    defaultValue={{}} // Default to empty object for RHF
                    rules={{
                         validate: (value) => !isRequired || (typeof value === 'object' && value !== null && Object.keys(value).length > 0) || 'At least one key-value pair is required'
                    }}
                    render={({ field, fieldState: { error: fieldError } }) => {
                        const currentMap: Record<string, string> = (typeof field.value === 'object' && field.value !== null) ? field.value : {};
                        
                        

                        const handleAddPair = () => {
                            const trimmedKey = newKey.trim();
                            if (trimmedKey) {
                                const updatedMap = { ...currentMap, [trimmedKey]: newValue };
                                field.onChange(updatedMap);
                                setNewKey('');
                                setNewValue('');
                            }
                        };

                        const handleRemovePair = (keyToRemove: string) => {
                            const { [keyToRemove]: _, ...remainingMap } = currentMap; // Destructure to remove key
                            field.onChange(remainingMap);
                        };

                        return (
                            <FormControl fullWidth margin="dense" error={!!fieldError} component="fieldset" variant="outlined" sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Typography component="legend" variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>{key} (Map)</Typography>
                                {variable.description && <FormHelperText sx={{mt: -1, mb: 1}}>{variable.description}</FormHelperText>}

                                {/* List existing pairs */}
                                <Stack spacing={1} sx={{ mb: 2, pl:1 }}>
                                    {Object.entries(currentMap).map(([itemKey, itemValue]) => (
                                        <Box key={itemKey} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Typography sx={{ fontWeight: 'bold', mr: 1 }}>{itemKey}:</Typography>
                                            <Typography sx={{ flexGrow: 1, wordBreak: 'break-all' }}>{itemValue}</Typography>
                                            <IconButton size="small" onClick={() => handleRemovePair(itemKey)} disabled={isSubmitting || loading} color="error">
                                                <DeleteIcon fontSize="inherit" />
                                            </IconButton>
                                        </Box>
                                    ))}
                                    {Object.keys(currentMap).length === 0 && <Typography variant="caption" color="textSecondary">(No key-value pairs added yet)</Typography>}
                                </Stack>

                                {/* Input to add new pair */}
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <TextField
                                        size="small"
                                        label="New Key"
                                        value={newKey}
                                        onChange={(e) => setNewKey(e.target.value)}
                                        disabled={isSubmitting || loading}
                                        sx={{ flexGrow: 1, minWidth: '120px' }} // Allow shrinking but have minimum
                                    />
                                     <TextField
                                        size="small"
                                        label="New Value"
                                        value={newValue}
                                        onChange={(e) => setNewValue(e.target.value)}
                                        disabled={isSubmitting || loading}
                                        sx={{ flexGrow: 2, minWidth: '150px' }} // Allow shrinking but have minimum
                                         onKeyDown={(e) => { // Allow adding with Enter key in value field
                                               if (e.key === 'Enter') {
                                                   e.preventDefault();
                                                   handleAddPair();
                                               }
                                           }}
                                    />
                                    <Button variant="outlined" size="small" onClick={handleAddPair} disabled={isSubmitting || loading || !newKey.trim()} sx={{ height: '40px' }}>Add Pair</Button>
                                </Box>

                                 {/* Display validation error for the map */}
                                 {fieldError && <FormHelperText error sx={{ mt: 1 }}>{fieldError.message}</FormHelperText>}
                            </FormControl>
                        );
                    }}
                />
            );
        }

        if (typeInfo.baseType === 'list' && typeInfo.subType1 === 'string') {
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
                                            <Typography sx={{ flexGrow: 1, wordBreak: 'break-all' }}>
                                                  {/* Check if item is string, otherwise stringify */}
                                                  {typeof item === 'string' ? item : JSON.stringify(item)}
                                              </Typography>
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

        if (typeInfo.baseType === 'bool') {
            return ( <FormControlLabel key={variablePath} control={ <Controller name={variablePath} control={control} defaultValue={false} render={({ field: { onChange, value, ref } }) => ( <Switch checked={!!value} onChange={onChange} inputRef={ref} disabled={isSubmitting || loading} /> )} /> } label={key} /> );
       }

       // --- Default TextField Input using Controller ---
       return ( <Controller key={variablePath} name={variablePath} control={control} rules={{ required: isRequired ? 'This field is required' : false }} render={({ field, fieldState: { error: fieldError } }) => ( <TextField {...field} margin="dense" fullWidth required={isRequired} label={key} error={!!fieldError} helperText={fieldError?.message || variable.description || ''} disabled={isSubmitting || loading} type={typeInfo.baseType === 'number' ? 'number' : variable.sensitive ? 'password' : 'text'} InputLabelProps={{ shrink: true }} /> )} /> );
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
                         <Typography variant="body1" gutterBottom>
                            <strong>Blueprint Version:</strong> {instance.blueprint_version || <em>Default Branch</em>}
                        </Typography>
                    </Paper>

                    <Divider sx={{ my: 3 }} />
                    

                     {/* Editable Variables Section */}
                    <Paper elevation={2} sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Configuration Variables</Typography>
                        <Controller
                            name="blueprintVersion"
                            control={control}
                            render={({ field }) => (
                                <TextField {...field} margin="normal" fullWidth
                                    id="blueprintVersion" label="Blueprint Version Override (Optional)"
                                    helperText="Enter Git branch, tag, or commit SHA (leave empty for default)"
                                    disabled={isSubmitting || loading} // Use loading state here
                                    sx={{ mb: 2 }} // Add some margin
                                />
                            )}
                        />
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle1" gutterBottom sx={{mt: 1}}>Variables</Typography>
                        {!blueprint && <CircularProgress size={20} /> }
                        {!loading && !blueprint && <Alert severity="warning">Blueprint details could not be loaded.</Alert>}
                        {!loading && blueprint && !definitions && <Alert severity="warning">Variable definitions not available for this blueprint.</Alert>}
                        {!loading && definitions && Object.keys(definitions).length === 0 && ( <Typography sx={{ fontStyle: 'italic', color: 'text.secondary' }}> This blueprint has no defined variables. </Typography> )}
                        {!loading && definitions && Object.keys(definitions).length > 0 && (
        Object.values(definitions)
            .sort((a, b) => a.name.localeCompare(b.name))
            // Pass the top-level prefix 'variables'
            .map(variable => renderVariableInput(variable, 'variables'))
    )}
                    </Paper>

                    {/* Submit button moved to header */}
                </Box> // End Form
             )}
        </Box>
    );
}

export default ClientInstanceDetailPage;