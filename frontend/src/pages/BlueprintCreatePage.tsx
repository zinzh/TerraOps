import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import blueprintService from '../services/blueprintService';
import { Blueprint } from '../types'; // Import if needed for return type hints

// MUI Components
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

// Use the AppLayout created earlier
// import AppLayout from '../components/AppLayout';

function BlueprintCreatePage() {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [gitRepoUrl, setGitRepoUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setLoading(true);

        // Basic Validation
        if (!name.trim() || !gitRepoUrl.trim()) {
            setError('Name and Repository URL are required.');
            setLoading(false);
            return;
        }
        // Simple URL validation (more robust validation can be added)
        try {
           new URL(gitRepoUrl); // Check if it parses as a URL
        } catch (_) {
            try {
                // Also check for common SSH format (basic check)
                if (!gitRepoUrl.match(/^git@[\w.-]+:[\w.-]+\/[\w.-]+\.git$/)) {
                   throw new Error("Invalid SSH format");
                }
            } catch (_) {
                setError('Please enter a valid HTTP(S) or SSH Git Repository URL.');
                setLoading(false);
                return;
            }
        }


        const blueprintData = {
            name: name.trim(),
            description: description.trim() || undefined, // Send undefined if empty
            git_repo_url: gitRepoUrl.trim(),
        };

        try {
            await blueprintService.createBlueprint(blueprintData);
            // Success: Navigate back to the list page
            navigate('/blueprints', { state: { message: 'Blueprint created successfully!' } }); // Optional: Pass success message
        } catch (err: any) {
            console.error("Create blueprint failed:", err);
            const errorMsg = err.response?.data?.error || 'Failed to create blueprint.';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        // This page content should be wrapped by AppLayout in App.tsx routing
        <Box>
            <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/blueprints')}
                sx={{ mb: 2 }}
            >
                Back to Blueprints
            </Button>
            <Typography variant="h4" component="h1" gutterBottom>
                Create New Blueprint
            </Typography>
            <Paper elevation={3} sx={{ p: 3 }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}
                <Box component="form" onSubmit={handleSubmit} noValidate>
                    <TextField
                        margin="normal"
                        required
                        fullWidth
                        id="name"
                        label="Blueprint Name"
                        name="name"
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={loading}
                        inputProps={{ maxLength: 100 }}
                    />
                    <TextField
                        margin="normal"
                        fullWidth
                        id="gitRepoUrl"
                        label="Git Repository URL (HTTPS or SSH)"
                        name="gitRepoUrl"
                        required
                        value={gitRepoUrl}
                        onChange={(e) => setGitRepoUrl(e.target.value)}
                        disabled={loading}
                    />
                    <TextField
                        margin="normal"
                        fullWidth
                        id="description"
                        label="Description (Optional)"
                        name="description"
                        multiline
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={loading}
                    />
                    <Box sx={{ mt: 3, position: 'relative' }}>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={loading}
                            fullWidth
                        >
                            {loading ? 'Creating...' : 'Create Blueprint'}
                        </Button>
                        {loading && (
                            <CircularProgress
                                size={24}
                                sx={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    marginTop: '-12px',
                                    marginLeft: '-12px',
                                }}
                            />
                        )}
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
}

export default BlueprintCreatePage;