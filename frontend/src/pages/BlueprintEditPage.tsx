// FILE: frontend/src/pages/BlueprintEditPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import blueprintService from '../services/blueprintService';
import { Blueprint } from '../types';
import { useSnackbar } from '../context/SnackbarContext';

// MUI Components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// Form data shape for editing
interface BlueprintEditFormData {
    name: string;
    description?: string;
    git_repo_url: string;
}

function BlueprintEditPage() {
    const { id } = useParams<{ id: string }>(); // Get blueprint ID from URL
    const navigate = useNavigate();
    const { showSnackbar } = useSnackbar();
    const [loadingInitialData, setLoadingInitialData] = useState(true);
    const [apiError, setApiError] = useState<string | null>(null);

    // RHF setup
    const { handleSubmit, control, reset, formState: { errors, isSubmitting, isDirty } } = useForm<BlueprintEditFormData>({
        defaultValues: { // Initialize empty, will be populated by reset
            name: '',
            description: '',
            git_repo_url: '',
        }
    });

    // Fetch existing blueprint data
    const fetchBlueprintData = useCallback(async (blueprintId: string) => {
        setLoadingInitialData(true);
        setApiError(null);
        try {
            const data = await blueprintService.getBlueprintById(blueprintId);
            // Populate form with fetched data using reset
            reset({
                name: data.name,
                description: data.description || '', // Handle null description
                git_repo_url: data.git_repo_url,
            });
        } catch (err: any) {
            console.error("Failed to fetch blueprint data:", err);
            setApiError(err.response?.data?.error || `Failed to load blueprint ${blueprintId}.`);
        } finally {
            setLoadingInitialData(false);
        }
    }, [reset]); // Include reset in dependency array

    // Fetch data when component mounts or ID changes
    useEffect(() => {
        if (id) {
            fetchBlueprintData(id);
        } else {
             setApiError("No Blueprint ID provided.");
             setLoadingInitialData(false);
        }
    }, [id, fetchBlueprintData]);


    // Form submission handler
    const onSubmit: SubmitHandler<BlueprintEditFormData> = async (data) => {
        if (!id) return; // Should not happen if component loaded

        setApiError(null);

        // Prepare only the fields that might have changed
        const updateData: { name?: string; description?: string; git_repo_url?: string } = {};
        if (data.name.trim()) updateData.name = data.name.trim();
        // Send description even if empty string, or handle specifically if needed
        updateData.description = data.description?.trim();
        if (data.git_repo_url.trim()) updateData.git_repo_url = data.git_repo_url.trim();

        try {
            await blueprintService.updateBlueprint(id, updateData);
            showSnackbar('Blueprint updated successfully!', 'success');
            // Navigate back to detail page after successful update
            navigate(`/blueprints/${id}`);
        } catch (err: any) {
            console.error("Update blueprint failed:", err);
            const errorMsg = err.response?.data?.error || 'Failed to update blueprint.';
            setApiError(errorMsg);
        }
    };

    if (loadingInitialData) {
        return ( <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}> <CircularProgress /> </Box> );
    }


    return (
        <Box>
            <Button
                startIcon={<ArrowBackIcon />}
                // Navigate back to detail page or list page? Detail makes more sense.
                onClick={() => navigate(id ? `/blueprints/${id}` : '/blueprints')}
                sx={{ mb: 2 }}
            >
                Back to Blueprint
            </Button>
            <Typography variant="h4" component="h1" gutterBottom>
                Edit Blueprint
            </Typography>

             {/* Show fatal error only if initial load failed completely */}
             {apiError && !loadingInitialData && !control._defaultValues.name && (
                 <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>
             )}
             {/* Show non-fatal API error from submission */}
             {apiError && !loadingInitialData && control._defaultValues.name && (
                  <Alert severity="error" sx={{ mb: 2 }} onClose={() => setApiError(null)}>
                      {apiError}
                  </Alert>
              )}

            <Paper elevation={3} sx={{ p: 3 }}>
                 {/* Render form only if initial data loaded or no ID was provided (edge case) */}
                {(control._defaultValues.name || !id) && (
                    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                        <Controller
                             name="name"
                             control={control}
                             rules={{ required: 'Blueprint Name is required' }}
                             render={({ field, fieldState: { error: fieldError } }) => (
                                 <TextField {...field} margin="normal" required fullWidth autoFocus
                                     id="name" label="Blueprint Name"
                                     error={!!fieldError} helperText={fieldError?.message}
                                     disabled={isSubmitting}
                                     inputProps={{ maxLength: 100 }}
                                 />
                             )}
                         />
                         <Controller
                             name="git_repo_url"
                             control={control}
                             rules={{
                                 required: 'Git Repository URL is required',
                                 pattern: { value: /^(https?:\/\/|git@)/i, message: "Enter a valid HTTP(S) or SSH Git URL" }
                             }}
                             render={({ field, fieldState: { error: fieldError } }) => (
                                  <TextField {...field} margin="normal" required fullWidth
                                      id="gitRepoUrl" label="Git Repository URL (HTTPS or SSH)"
                                      error={!!fieldError} helperText={fieldError?.message}
                                      disabled={isSubmitting}
                                  />
                              )}
                          />
                           <Controller
                               name="description"
                               control={control}
                               render={({ field }) => (
                                    <TextField {...field} margin="normal" fullWidth
                                        id="description" label="Description (Optional)"
                                        multiline rows={4}
                                        disabled={isSubmitting}
                                    />
                                )}
                            />

                        <Box sx={{ mt: 3, position: 'relative' }}>
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={isSubmitting || !isDirty} // Disable if no changes or submitting
                                fullWidth
                            >
                                {isSubmitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                            {isSubmitting && ( <CircularProgress size={24} sx={{ position: 'absolute', top: '50%', left: '50%', marginTop: '-12px', marginLeft: '-12px' }} /> )}
                        </Box>
                    </Box>
                 )}
            </Paper>
        </Box>
    );
}

export default BlueprintEditPage;