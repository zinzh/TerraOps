package models

import (
	"encoding/json"
	"fmt" // Import fmt
	"log" // Import log

	"github.com/zclconf/go-cty/cty"
)

// TfVariable represents a parsed Terraform variable definition
type TfVariable struct {
	Name        string          `json:"name"`
	Type        json.RawMessage `json:"type"` // Store complex type structure as JSON
	Description *string         `json:"description,omitempty"`
	Default     json.RawMessage `json:"default,omitempty"` // Store default value as JSON
	Sensitive   bool            `json:"sensitive"`
	Nullable    bool            `json:"nullable"` // For Terraform 0.15+ optional variables
	// Validation field might be complex, store as raw HCL or simplified structure if needed later
	// Validation json.RawMessage `json:"validation,omitempty"`
}

// We store Type and Default as RawMessage because cty types/values can be complex
// and don't have a direct, simple Go struct equivalent easily.
// Storing the JSON representation derived from cty is more flexible.

// Helper function to convert cty.Value to json.RawMessage
// Note: This is a basic conversion. Complex types might need more sophisticated handling.
func CtyValueToJSON(val cty.Value) (json.RawMessage, error) {
	if !val.IsKnown() {
		return json.RawMessage("null"), nil
	}
	if val.IsNull() {
		return json.RawMessage("null"), nil
	}

	// Use the improved ctyJsonEncode helper which aims to produce valid JSON strings
	jsonString := ctyJsonEncode(val)

	// Since ctyJsonEncode now produces valid JSON strings, we can directly use it.
	// We might need validation if ctyJsonEncode could return error indicators.
	if jsonString == `"error_marshalling_primitive"` || jsonString == `"unknown_type"` {
		log.Printf("Warning: ctyJsonEncode returned an error indicator: %s for value %s", jsonString, val.GoString())
		// Decide fallback: return null or an error? Let's return null for now.
		return json.RawMessage("null"), fmt.Errorf("failed to encode cty value to JSON: %s", jsonString)
	}

	return json.RawMessage(jsonString), nil
}

// Helper function to convert cty.Type to json.RawMessage
// This encodes the type definition itself, e.g., "string", "list(string)", "object({...})"
func CtyTypeToJSON(typ cty.Type) (json.RawMessage, error) {
	typeJSON, err := typ.MarshalJSON()
	if err != nil {
		return nil, err
	}
	return json.RawMessage(typeJSON), nil
}

// ctyJsonEncode provides a basic string representation suitable for simple JSON needs.
// For robust CTY JSON, consider libraries like hcjson or building a more complex converter.
func ctyJsonEncode(val cty.Value) string {
	if !val.IsKnown() {
		return "null"
	}
	if val.IsNull() {
		return "null"
	}
	ty := val.Type()

	switch {
	case ty.IsPrimitiveType():
		// Correctly handle primitive types using standard json.Marshal
		var goVal interface{}
		switch ty {
		case cty.String:
			goVal = val.AsString()
		case cty.Number:
			bf := val.AsBigFloat()
			// Use json.Number or handle large numbers carefully if needed
			if bf.IsInt() {
				i, _ := bf.Int64() // Consider AsBigInt().String() for arbitrary precision
				goVal = i
			} else {
				f, _ := bf.Float64() // Might lose precision for very large floats
				goVal = f
			}
		case cty.Bool:
			goVal = val.True()
		default:
			log.Printf("Error: Unknown primitive type encountered in ctyJsonEncode: %s", ty.FriendlyName())
			return `"unknown_primitive"` // Should not happen
		}
		b, err := json.Marshal(goVal)
		if err != nil {
			log.Printf("Error marshalling primitive cty value %s: %v", val.GoString(), err)
			return `"error_marshalling_primitive"`
		}
		return string(b)

	case ty.IsListType() || ty.IsSetType() || ty.IsTupleType():
		elements := "["
		first := true
		for it := val.ElementIterator(); it.Next(); {
			_, v := it.Element()
			if !first {
				elements += ","
			}
			// Recursively encode element
			elements += ctyJsonEncode(v)
			first = false
		}
		elements += "]"
		return elements

	case ty.IsMapType() || ty.IsObjectType():
		elements := "{"
		first := true
		for it := val.ElementIterator(); it.Next(); {
			k, v := it.Element()
			if !first {
				elements += ","
			}
			// Keys in JSON must be strings. Marshal the key.
			keyBytes, err := json.Marshal(k.AsString()) // Assume keys are strings or convertible
			if err != nil {
				log.Printf("Error marshalling map/object key %s: %v", k.GoString(), err)
				continue // Skip this key-value pair
			}
			// Recursively encode value
			elements += string(keyBytes) + ":" + ctyJsonEncode(v)
			first = false
		}
		elements += "}"
		return elements

	default:
		log.Printf("Warning: Unsupported cty type encountered in ctyJsonEncode: %s. Value: %s", ty.FriendlyName(), val.GoString())
		// Fallback: try marshalling the GoString representation? Unlikely to be valid.
		// encoded, _ := json.Marshal(val.GoString())
		// return string(encoded)
		return `"unknown_type"` // Return an indicator for unknown complex types
	}
}

// VariableDefinitions represents the collection of variables parsed
// This is what will be stored in the JSONB column.
type VariableDefinitions map[string]TfVariable
