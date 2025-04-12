// frontend/src/components/ObjectJsonInput.tsx
import React, { useState, useEffect } from 'react';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import Typography from '@mui/material/Typography';

interface ObjectJsonInputProps {
  label: string;
  description?: string;
  value: any; // The object value from RHF
  onChange: (value: any) => void; // RHF onChange function
  error?: string; // Error message from RHF field state
  disabled?: boolean;
}

const ObjectJsonInput: React.FC<ObjectJsonInputProps> = ({
  label,
  description,
  value,
  onChange,
  error,
  disabled = false,
}) => {
  // Hooks are now at the top level of this component
  const [textValue, setTextValue] = useState(() => {
    // Initialize state based on the initial value prop
    try { return JSON.stringify(value ?? {}, null, 2); } catch { return '{}'; }
  });
  const [isJsonValid, setIsJsonValid] = useState(true);

  // Update local text state if the external RHF value changes
  // (e.g., on form reset or if another field updates this one)
  useEffect(() => {
    try {
      const externalJsonString = JSON.stringify(value ?? {}, null, 2);
      // Only update local state if it differs, prevents infinite loops
      if (externalJsonString !== textValue) {
         setTextValue(externalJsonString);
         setIsJsonValid(true); // Assume external value is valid
      }
    } catch {
       // Handle cases where the incoming value might not be stringifiable?
       setTextValue('{}'); // Reset on error?
       setIsJsonValid(false);
    }
  }, [value]); // Depend only on the external value prop


  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setTextValue(newText); // Update local display immediately

    // Attempt to parse and update RHF state
    try {
      const parsedJson = JSON.parse(newText);
      onChange(parsedJson); // Update RHF state only if valid JSON
      setIsJsonValid(true);
    } catch (e) {
      // JSON is invalid while typing
      setIsJsonValid(false);
      // We still call onChange but with the raw text.
      // RHF's validation rule (in the parent component) will catch the invalid state.
      // This allows the validation error to show based on the invalid text.
      onChange(newText);
    }
  };

  return (
    <FormControl fullWidth margin="dense" error={!!error || !isJsonValid} component="fieldset" variant="outlined" sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <Typography component="legend" variant="body2" sx={{ mb: 1, fontWeight: 'medium' }}>{label} (Object - Edit as JSON)</Typography>
        {description && <FormHelperText sx={{mt: -1, mb: 1}}>{description}</FormHelperText>}
        <TextField
            multiline
            rows={6} // Adjust rows as needed
            fullWidth
            variant="outlined"
            value={textValue} // Controlled by local state
            onChange={handleTextChange}
            disabled={disabled}
            error={!!error || !isJsonValid} // Show error outline if RHF error or local JSON invalid
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.9rem' } }} // Monospace for JSON
        />
        {/* Display RHF validation error OR local JSON syntax error */}
        {(error || !isJsonValid) && (
            <FormHelperText error sx={{ mt: 1 }}>
                {error || (isJsonValid ? '' : 'Invalid JSON format.')}
            </FormHelperText>
        )}
    </FormControl>
  );
};

export default ObjectJsonInput;
