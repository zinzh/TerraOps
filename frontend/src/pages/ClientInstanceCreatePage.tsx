import React, { useState, useEffect, useCallback } from 'react'; // Remove FormEvent, ChangeEvent if no longer needed directly
import { useNavigate } from 'react-router-dom';
import { useForm, Controller, SubmitHandler, Resolver } from 'react-hook-form'; // Import RHF hooks
import blueprintService from '../services/blueprintService';
import clientInstanceService from '../services/clientInstanceService';
import { Blueprint, TfVariable, VariableDefinitions, ClientInstance } from '../types'; // Add ClientInstance

// MUI Components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MenuItem from '@mui/material/MenuItem';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import { Stack, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';

// Define the shape of our form data
interface ClientInstanceFormData {
    instanceName: string;
    instanceDescription?: string;
    clientRepoUrl: string;
    clientRepoBranch?: string;
    selectedBlueprintId: string;
    // Variable values will be nested or handled dynamically
    variables: Record<string, any>;
}

function ClientInstanceCreatePage() {
    const navigate = useNavigate();

    // RHF setup
    const { handleSubmit, control, watch, setValue, formState: { errors, isSubmitting }, reset } = useForm<ClientInstanceFormData>({
        defaultValues: {
            instanceName: '',
            instanceDescription: '',
            clientRepoUrl: '',
            clientRepoBranch: 'main',
            selectedBlueprintId: '',
            variables: {},
        },
        // resolver: async (data) => { /* Custom validation later? */ return { values: data, errors: {} }; },
    });


    // State for blueprints list and the selected blueprint object
    const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
    const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null);
    const [loadingBlueprints, setLoadingBlueprints] = useState<boolean>(true);
    const [apiError, setApiError] = useState<string | null>(null); // For general API errors
    const [loading, setLoading] = useState<boolean>(true);
    const [newItem, setNewItem] = useState(''); // Local state for the input field
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');

    // Watch the selected blueprint ID from the form state
    const selectedBlueprintId = watch('selectedBlueprintId');

    // Fetch blueprints for the dropdown
    useEffect(() => {
        setLoadingBlueprints(true);
        blueprintService.listBlueprints()
            .then(data => {
                setBlueprints(data.filter(bp => bp.variables_definition));
            })
            .catch(err => {
                console.error("Failed to fetch blueprints", err);
                setApiError("Could not load available blueprints.");
            })
            .finally(() => setLoadingBlueprints(false));
    }, []);

    // React Hook Form requires stable default values.
    // We update the 'variables' part of the form state when the blueprint changes.
    useEffect(() => {
        if (!selectedBlueprintId) {
            setSelectedBlueprint(null);
            setValue('variables', {}); // Reset variables in RHF state
            return;
        }
        const bp = blueprints.find(b => b.id === selectedBlueprintId);
        if (bp) {
            setSelectedBlueprint(bp);
            const initialValues: Record<string, any> = {};
            const definitions = getVariableDefinitions(bp) || {};
            Object.values(definitions).forEach(variable => {
                 if (variable.default !== undefined && variable.default !== null) {
                    initialValues[variable.name] = variable.default;
                 } else {
                    initialValues[variable.name] = getDefaultValueForType(variable.type);
                 }
            });
             // Set the 'variables' field in RHF state
            setValue('variables', initialValues, { shouldValidate: false, shouldDirty: false });
        } else {
            setSelectedBlueprint(null);
            setValue('variables', {});
        }
    }, [selectedBlueprintId, blueprints, setValue]);


    // Form submission handler using RHF
    const onSubmit: SubmitHandler<ClientInstanceFormData> = async (data) => {
        setApiError(null);
        // Note: isSubmitting state from RHF handles loading state for the button

        const instanceData = {
            name: data.instanceName.trim(),
            description: data.instanceDescription?.trim() || undefined,
            blueprint_id: data.selectedBlueprintId,
            variable_values: data.variables, // Use variables from RHF state
            client_repo_url: data.clientRepoUrl.trim(),
            client_repo_branch: data.clientRepoBranch?.trim() || 'main',
        };

        try {
            await clientInstanceService.createClientInstance(instanceData);
            navigate('/client-instances', { state: { message: 'Client Instance created successfully!' } });
        } catch (err: any) {
            console.error("Create client instance failed:", err);
            const errorMsg = err.response?.data?.error || 'Failed to create client instance.';
            setApiError(errorMsg);
        }
        // RHF handles resetting isSubmitting automatically
    };

    // --- Helper Functions for Rendering ---
    const getVariableDefinitions = (bp: Blueprint | null): VariableDefinitions | null => {
        if (!bp || !bp.variables_definition) return null;
         try {
             if (typeof bp.variables_definition === 'string') {
                  return JSON.parse(bp.variables_definition) as VariableDefinitions;
             }
             return bp.variables_definition as VariableDefinitions;
         } catch(e) {
              console.error("Failed to parse variables definition", e);
              setApiError("Failed to read blueprint variable definitions."); // Use state setter
              return null;
         }
     };
     const definitions = getVariableDefinitions(selectedBlueprint); // Use state variable

     const getDefaultValueForType = (typeStr: any): any => { /* ... same ... */
         const typeJson = JSON.stringify(typeStr).toLowerCase();
         if (typeJson.includes("bool")) return false;
         if (typeJson.includes("number")) return 0;
         if (typeJson.includes("list") || typeJson.includes("tuple")) return [];
         if (typeJson.includes("map") || typeJson.includes("object")) return {};
         return "";
     };

     // Render form field using RHF Controller
     const renderVariableInput = (variable: TfVariable) => {
        const key = variable.name;
        const variablePath = `variables.${key}` as const;
        const typeString = JSON.stringify(variable.type).toLowerCase();
        const isBool = typeString.includes('"bool"');
        const isNumber = typeString.includes('"number"');
        const isList = typeString.startsWith('"list') || typeString.startsWith('"tuple'); // Basic check for list/tuple
        // More specific check (e.g., for list(string)) might involve parsing typeString
        const isStringList = isList && typeString.includes('string');
        const isMap = typeString.startsWith('"map') || typeString.startsWith('"object');
         // Basic check for map(string) - assumes string values for simplicity
         const isStringMap = isMap && (typeString.includes('string') || typeString.includes('any') || typeString.includes('dynamic'));
        // Add checks for list(number), map(string), etc. later

        const isRequired = !variable.nullable && variable.default === undefined;
        
        if (isStringMap) {
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

        // --- Handle Lists (Example: list(string)) ---
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
         // --- End Handle Lists ---


        if (isBool) {
             return ( <FormControlLabel key={key} control={ <Controller name={variablePath} control={control} defaultValue={false} render={({ field: { onChange, value, ref } }) => ( <Switch checked={!!value} onChange={onChange} inputRef={ref} disabled={isSubmitting || loading} /> )} /> } label={key} /> );
        }

        // --- Default TextField Input using Controller ---
        return ( <Controller key={key} name={variablePath} control={control} rules={{ required: isRequired ? 'This field is required' : false }} render={({ field, fieldState: { error: fieldError } }) => ( <TextField {...field} margin="dense" fullWidth required={isRequired} label={key} error={!!fieldError} helperText={fieldError?.message || variable.description || ''} disabled={isSubmitting || loading} type={isNumber ? 'number' : variable.sensitive ? 'password' : 'text'} multiline={!isNumber && !isBool && String(field.value ?? '').length > 60} rows={!isNumber && !isBool && String(field.value ?? '').length > 60 ? 3 : 1} InputLabelProps={{ shrink: true }} /> )} /> );
    };

    return (
        <Box>
             <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/client-instances')} sx={{ mb: 2 }}>
                 Back to Instances
             </Button>
             <Typography variant="h4" component="h1" gutterBottom>
                 Create New Client Instance
             </Typography>

             {apiError && (
                 <Alert severity="error" sx={{ mb: 2 }} onClose={() => setApiError(null)}>
                     {apiError}
                 </Alert>
             )}

            <Paper elevation={3} sx={{ p: 3 }}>
                 {/* Use RHF's handleSubmit */}
                <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                    {/* Section 1: Instance Details - Use Controller */}
                    <Typography variant="h6" gutterBottom>Instance Details</Typography>
                    <Controller
                         name="instanceName"
                         control={control}
                         rules={{ required: 'Instance Name is required' }}
                         render={({ field, fieldState: { error: fieldError } }) => (
                             <TextField {...field} margin="normal" required fullWidth autoFocus
                                 id="instanceName" label="Instance Name"
                                 error={!!fieldError} helperText={fieldError?.message}
                                 disabled={isSubmitting}
                             />
                         )}
                     />
                     <Controller
                         name="clientRepoUrl"
                         control={control}
                         rules={{
                             required: 'Client Repository URL is required',
                             pattern: { // Basic URL/SSH format validation
                                 value: /^(https?:\/\/|git@)/i,
                                 message: "Enter a valid HTTP(S) or SSH Git URL"
                             }
                         }}
                         render={({ field, fieldState: { error: fieldError } }) => (
                              <TextField {...field} margin="normal" required fullWidth
                                  id="clientRepoUrl" label="Client Git Repository URL (SSH Recommended)"
                                  error={!!fieldError} helperText={fieldError?.message}
                                  disabled={isSubmitting}
                              />
                          )}
                      />
                       <Controller
                           name="clientRepoBranch"
                           control={control}
                           render={({ field }) => (
                                <TextField {...field} margin="normal" fullWidth
                                    id="clientRepoBranch" label="Client Repository Branch"
                                    helperText="Defaults to 'main' if left empty"
                                    disabled={isSubmitting}
                                />
                            )}
                        />
                       <Controller
                           name="instanceDescription"
                           control={control}
                           render={({ field }) => (
                                <TextField {...field} margin="normal" fullWidth
                                    id="instanceDescription" label="Description (Optional)"
                                    multiline rows={3}
                                    disabled={isSubmitting}
                                />
                            )}
                        />


                    <Divider sx={{ my: 3 }}/>

                    {/* Section 2: Blueprint Selection - Use Controller */}
                    <Typography variant="h6" gutterBottom>Blueprint Selection</Typography>
                     <Controller
                         name="selectedBlueprintId"
                         control={control}
                         rules={{ required: 'Please select a blueprint' }}
                         render={({ field, fieldState: { error: fieldError } }) => (
                             <FormControl fullWidth margin="normal" required error={!!fieldError} disabled={isSubmitting || loadingBlueprints}>
                                 <InputLabel id="blueprint-select-label">Blueprint</InputLabel>
                                 <Select {...field} labelId="blueprint-select-label" label="Blueprint">
                                     <MenuItem value="" disabled>
                                         <em>{loadingBlueprints ? 'Loading...' : 'Select a Blueprint'}</em>
                                     </MenuItem>
                                     {blueprints.map((bp) => (
                                         <MenuItem key={bp.id} value={bp.id}>{bp.name}</MenuItem>
                                     ))}
                                 </Select>
                                 <FormHelperText>{fieldError?.message || (!loadingBlueprints && blueprints.length === 0 ? 'No parsed blueprints found.' : '')}</FormHelperText>
                             </FormControl>
                         )}
                     />


                    <Divider sx={{ my: 3 }}/>

                    {/* Section 3: Variables (Dynamic) - Render using Controller */}
                    <Typography variant="h6" gutterBottom>Configuration Variables</Typography>
                    {!selectedBlueprintId ? (
                        <Typography sx={{ fontStyle: 'italic', color: 'text.secondary', mt: 2 }}>
                            Select a blueprint to see its variables.
                        </Typography>
                    ) : !definitions ? (
                         <Typography sx={{ fontStyle: 'italic', color: 'text.secondary', mt: 2 }}>
                              Loading or error reading variable definitions.
                         </Typography>
                    ) : Object.keys(definitions).length === 0 ? (
                         <Typography sx={{ fontStyle: 'italic', color: 'text.secondary', mt: 2 }}>
                             Selected blueprint has no defined variables.
                         </Typography>
                    ): (
                        Object.values(definitions)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(renderVariableInput) // This now uses Controller internally
                    )}


                     {/* Submit Button */}
                     <Box sx={{ mt: 4, position: 'relative' }}>
                         <Button type="submit" variant="contained" disabled={isSubmitting || loadingBlueprints || !selectedBlueprintId} fullWidth >
                             {isSubmitting ? 'Creating...' : 'Create Client Instance'}
                         </Button>
                         {isSubmitting && ( <CircularProgress size={24} sx={{ position: 'absolute', top: '50%', left: '50%', marginTop: '-12px', marginLeft: '-12px' }} /> )}
                     </Box>
                </Box>
            </Paper>
        </Box>
    );
}

export default ClientInstanceCreatePage;