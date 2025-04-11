import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import blueprintService from '../services/blueprintService';
import clientInstanceService from '../services/clientInstanceService';
import { Blueprint, TfVariable, VariableDefinitions } from '../types';

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

function ClientInstanceCreatePage() {
    const navigate = useNavigate();

    // State for blueprints list and selection
    const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
    const [selectedBlueprintId, setSelectedBlueprintId] = useState<string>('');
    const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null);
    const [loadingBlueprints, setLoadingBlueprints] = useState<boolean>(true);

    // State for instance details
    const [instanceName, setInstanceName] = useState('');
    const [instanceDescription, setInstanceDescription] = useState('');
    const [clientRepoUrl, setClientRepoUrl] = useState('');
    const [clientRepoBranch, setClientRepoBranch] = useState('main'); // Default

    // State for dynamic variable values
    const [variableValues, setVariableValues] = useState<Record<string, any>>({});

    // General loading/error state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch blueprints for the dropdown
    useEffect(() => {
        setLoadingBlueprints(true);
        blueprintService.listBlueprints()
            .then(data => {
                // Filter for blueprints that have been parsed? Optional.
                setBlueprints(data.filter(bp => bp.variables_definition));
            })
            .catch(err => {
                console.error("Failed to fetch blueprints", err);
                setError("Could not load available blueprints.");
            })
            .finally(() => setLoadingBlueprints(false));
    }, []);

    // Fetch selected blueprint details when selection changes
    useEffect(() => {
        if (!selectedBlueprintId) {
            setSelectedBlueprint(null);
            setVariableValues({}); // Clear values if blueprint deselected
            return;
        }
        const bp = blueprints.find(b => b.id === selectedBlueprintId);
        if (bp) {
            setSelectedBlueprint(bp);
            // Initialize variableValues with defaults from blueprint
            const initialValues: Record<string, any> = {};
            if (bp.variables_definition) {
                const definitions = bp.variables_definition as VariableDefinitions;
                Object.values(definitions).forEach(variable => {
                    if (variable.default !== undefined && variable.default !== null) {
                       // Default value is already JSON, use it directly
                       initialValues[variable.name] = variable.default;
                    } else {
                       // Handle cases where default is null or undefined based on type maybe?
                       // For simplicity, start with undefined or an appropriate zero value
                       initialValues[variable.name] = getDefaultValueForType(variable.type);
                    }
                });
            }
            setVariableValues(initialValues);
        } else {
            setSelectedBlueprint(null); // Should not happen if ID came from list
             setVariableValues({});
        }
    }, [selectedBlueprintId, blueprints]);

    const handleBlueprintChange = (event: SelectChangeEvent<string>) => {
        setSelectedBlueprintId(event.target.value);
    };

    const handleVariableChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<any>, varName: string) => {
        const target = event.target;
        let value: any;

        if (target instanceof HTMLInputElement && target.type === 'checkbox') {
             // Handle boolean Switch/Checkbox
             value = target.checked;
        } else if (target instanceof HTMLInputElement && target.type === 'number') {
            // Handle number input
            value = target.value === '' ? undefined : Number(target.value); // Store as number
        }
        else {
             // Handle text, select, etc.
             value = target.value;
        }


        setVariableValues(prev => ({
            ...prev,
            [varName]: value,
        }));
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (!selectedBlueprintId) {
            setError('Please select a blueprint.');
            return;
        }
        // Basic validation
        if (!instanceName.trim() || !clientRepoUrl.trim()) {
            setError('Instance Name and Client Repository URL are required.');
            return;
        }
        // Could add URL/SSH validation like before


        setLoading(true);
        const instanceData = {
            name: instanceName.trim(),
            description: instanceDescription.trim() || undefined,
            blueprint_id: selectedBlueprintId,
            variable_values: variableValues, // Send the collected values
            client_repo_url: clientRepoUrl.trim(),
            client_repo_branch: clientRepoBranch.trim() || 'main',
        };

        try {
            await clientInstanceService.createClientInstance(instanceData);
            // Success: navigate to instance list page (to be created) or back to blueprints
            navigate('/blueprints', { state: { message: 'Client Instance created successfully!' } });
        } catch (err: any) {
            console.error("Create client instance failed:", err);
            const errorMsg = err.response?.data?.error || 'Failed to create client instance.';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    // --- Helper Functions for Rendering ---
    const getVariableDefinitions = (): VariableDefinitions | null => {
        if (!selectedBlueprint || !selectedBlueprint.variables_definition) {
            return null;
        }
        try {
            // Assuming variables_definition is already a parsed object or needs parsing
            if (typeof selectedBlueprint.variables_definition === 'string') {
                 return JSON.parse(selectedBlueprint.variables_definition) as VariableDefinitions;
            }
            return selectedBlueprint.variables_definition as VariableDefinitions;
        } catch(e) {
             console.error("Failed to parse variables definition", e);
             setError("Failed to read blueprint variable definitions.");
             return null;
        }
    };

    const definitions = getVariableDefinitions();

    // Simple default value based on type string (needs improvement)
    const getDefaultValueForType = (typeStr: any): any => {
        const typeJson = JSON.stringify(typeStr).toLowerCase(); // Basic check
        if (typeJson.includes("bool")) return false;
        if (typeJson.includes("number")) return 0;
        if (typeJson.includes("list") || typeJson.includes("tuple")) return [];
        if (typeJson.includes("map") || typeJson.includes("object")) return {};
        return ""; // Default to empty string
    }

    // Render form field based on variable definition
    const renderVariableInput = (variable: TfVariable) => {
        const key = variable.name;
        const currentValue = variableValues[key] ?? ''; // Handle undefined

        // Basic type checking based on JSON representation (can be improved)
        const typeString = JSON.stringify(variable.type).toLowerCase(); // Get string like '"string"', '"bool"', '"list(string)"' etc.
        const isBool = typeString.includes('"bool"');
        const isNumber = typeString.includes('"number"');
        // TODO: Add better handling for list, map, object (e.g., JSON editor, multi-input)

        if (isBool) {
             return (
                <FormControlLabel
                    control={
                        <Switch
                            checked={!!currentValue} // Ensure boolean value
                            onChange={(e) => handleVariableChange(e, key)}
                            name={key}
                            disabled={loading}
                        />
                    }
                    label={variable.name}
                    key={key}
                />
            );
        }

        return (
            <TextField
                key={key}
                margin="dense" // Use dense margin for variable list
                fullWidth
                id={key}
                label={variable.name}
                name={key}
                required={!variable.nullable && variable.default === undefined} // Basic required logic
                value={currentValue}
                onChange={(e) => handleVariableChange(e, key)}
                disabled={loading}
                helperText={variable.description || ''}
                type={isNumber ? 'number' : variable.sensitive ? 'password' : 'text'}
                multiline={!isNumber && !isBool && String(currentValue).length > 60} // Basic multiline for long strings
                rows={!isNumber && !isBool && String(currentValue).length > 60 ? 3 : 1}
                InputLabelProps={{
                     shrink: true, // Keep label floated for pre-filled defaults
                }}
                // Consider adding adornments for sensitive fields later
            />
        );
    };

    return (
        <Box>
             <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/blueprints')} sx={{ mb: 2 }}>
                 Back to Blueprints
             </Button>
             <Typography variant="h4" component="h1" gutterBottom>
                 Create New Client Instance
             </Typography>

             {error && (
                 <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                     {error}
                 </Alert>
             )}

            <Paper elevation={3} sx={{ p: 3 }}>
                <Box component="form" onSubmit={handleSubmit} noValidate>
                    {/* Section 1: Instance Details */}
                    <Typography variant="h6" gutterBottom>Instance Details</Typography>
                    <TextField
                        margin="normal" required fullWidth autoFocus
                        id="instanceName" label="Instance Name" name="instanceName"
                        value={instanceName} onChange={(e) => setInstanceName(e.target.value)} disabled={loading}
                    />
                     <TextField
                         margin="normal" required fullWidth
                         id="clientRepoUrl" label="Client Git Repository URL (SSH Recommended)" name="clientRepoUrl"
                         value={clientRepoUrl} onChange={(e) => setClientRepoUrl(e.target.value)} disabled={loading}
                     />
                     <TextField
                         margin="normal" fullWidth
                         id="clientRepoBranch" label="Client Repository Branch" name="clientRepoBranch"
                         value={clientRepoBranch} onChange={(e) => setClientRepoBranch(e.target.value)} disabled={loading}
                         helperText="Defaults to 'main' if left empty"
                     />
                     <TextField
                        margin="normal" fullWidth
                        id="instanceDescription" label="Description (Optional)" name="instanceDescription"
                        multiline rows={3}
                        value={instanceDescription} onChange={(e) => setInstanceDescription(e.target.value)} disabled={loading}
                    />

                    <Divider sx={{ my: 3 }}/>

                    {/* Section 2: Blueprint Selection */}
                    <Typography variant="h6" gutterBottom>Blueprint Selection</Typography>
                     <FormControl fullWidth margin="normal" required disabled={loading || loadingBlueprints}>
                         <InputLabel id="blueprint-select-label">Blueprint</InputLabel>
                         <Select
                             labelId="blueprint-select-label"
                             id="blueprint-select"
                             value={selectedBlueprintId}
                             label="Blueprint"
                             onChange={handleBlueprintChange}
                         >
                             <MenuItem value="" disabled>
                                 <em>{loadingBlueprints ? 'Loading blueprints...' : 'Select a Blueprint'}</em>
                             </MenuItem>
                             {blueprints.map((bp) => (
                                 <MenuItem key={bp.id} value={bp.id}>{bp.name}</MenuItem>
                             ))}
                         </Select>
                         {!loadingBlueprints && blueprints.length === 0 && <FormHelperText error>No parsed blueprints found.</FormHelperText>}
                     </FormControl>

                    <Divider sx={{ my: 3 }}/>

                    {/* Section 3: Variables (Dynamic) */}
                    <Typography variant="h6" gutterBottom>Configuration Variables</Typography>
                    {!selectedBlueprintId ? (
                        <Typography sx={{ fontStyle: 'italic', color: 'text.secondary', mt: 2 }}>
                            Select a blueprint to see its variables.
                        </Typography>
                    ) : !definitions ? (
                         <Typography sx={{ fontStyle: 'italic', color: 'text.secondary', mt: 2 }}>
                              Loading or error reading variable definitions for the selected blueprint.
                         </Typography>
                    ) : Object.keys(definitions).length === 0 ? (
                         <Typography sx={{ fontStyle: 'italic', color: 'text.secondary', mt: 2 }}>
                             Selected blueprint has no defined variables.
                         </Typography>
                    ): (
                        // Render inputs based on definitions
                        Object.values(definitions)
                            .sort((a, b) => a.name.localeCompare(b.name)) // Sort alphabetically
                            .map(renderVariableInput)
                    )}


                     {/* Submit Button */}
                     <Box sx={{ mt: 4, position: 'relative' }}>
                         <Button
                             type="submit"
                             variant="contained"
                             disabled={loading || loadingBlueprints || !selectedBlueprintId}
                             fullWidth
                         >
                             {loading ? 'Creating...' : 'Create Client Instance'}
                         </Button>
                         {loading && (
                             <CircularProgress size={24} sx={{ position: 'absolute', top: '50%', left: '50%', marginTop: '-12px', marginLeft: '-12px' }} />
                         )}
                     </Box>
                </Box>
            </Paper>
        </Box>
    );
}

export default ClientInstanceCreatePage;