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
         const variablePath = `variables.${key}` as const; // Path for RHF

         const typeString = JSON.stringify(variable.type).toLowerCase();
         const isBool = typeString.includes('"bool"');
         const isNumber = typeString.includes('"number"');
         const isRequired = !variable.nullable && variable.default === undefined;

         if (isBool) {
              return (
                 <FormControlLabel
                    key={key}
                    control={
                         <Controller
                             name={variablePath}
                             control={control}
                             defaultValue={false} // Default value for RHF Controller
                             render={({ field: { onChange, value, ref } }) => (
                                 <Switch
                                     checked={!!value} // Use value from RHF field state
                                     onChange={onChange} // Use RHF onChange handler
                                     inputRef={ref} // Connect ref
                                     disabled={isSubmitting}
                                 />
                             )}
                         />
                     }
                     label={key}
                 />
             );
         }

         return (
             <Controller
                 key={key}
                 name={variablePath}
                 control={control}
                 rules={{ required: isRequired ? 'This field is required' : false }}
                 render={({ field, fieldState: { error: fieldError } }) => (
                     <TextField
                         {...field} // Spread field props (onChange, onBlur, value, ref)
                         margin="dense"
                         fullWidth
                         required={isRequired} // Visual indicator
                         label={key}
                         error={!!fieldError}
                         helperText={fieldError?.message || variable.description || ''}
                         disabled={isSubmitting}
                         type={isNumber ? 'number' : variable.sensitive ? 'password' : 'text'}
                         multiline={!isNumber && !isBool && String(field.value ?? '').length > 60}
                         rows={!isNumber && !isBool && String(field.value ?? '').length > 60 ? 3 : 1}
                         InputLabelProps={{ shrink: true }}
                         // RHF handles value, no need for `value={...}` prop directly
                         // RHF handles onChange, no need for `onChange={...}` prop directly
                     />
                 )}
             />
         );
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