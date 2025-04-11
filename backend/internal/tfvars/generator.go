package tfvars

import (
	"encoding/json"
	"fmt"
	"log"
	"sort"

	"github.com/hashicorp/hcl/v2/hclwrite" // Use hclwrite for generation
	"github.com/zclconf/go-cty/cty"
	ctyjson "github.com/zclconf/go-cty/cty/json" // Use cty's JSON helpers
)

type Generator struct{}

func NewGenerator() *Generator {
	return &Generator{}
}

// Generate generates a terraform.tfvars file content string from JSON variable values.
// It attempts to convert JSON values to appropriate HCL syntax.
func (g *Generator) Generate(jsonData json.RawMessage) (string, error) {
	if len(jsonData) == 0 || string(jsonData) == "{}" || string(jsonData) == "null" {
		return "", nil // Return empty string if no variables provided
	}

	// 1. Unmarshal the input JSON into a map[string]interface{}
	var inputVars map[string]interface{}
	err := json.Unmarshal(jsonData, &inputVars)
	if err != nil {
		return "", fmt.Errorf("failed to unmarshal variable values JSON: %w", err)
	}

	// 2. Create a new HCL file in memory
	hclFile := hclwrite.NewEmptyFile()
	rootBody := hclFile.Body()

	// 3. Iterate through the map and convert values to HCL attributes
	// Sort keys for consistent output order
	keys := make([]string, 0, len(inputVars))
	for k := range inputVars {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	for _, key := range keys {
		value := inputVars[key]
		ctyVal, err := g.goToCty(value)
		if err != nil {
			log.Printf("Warning: Could not convert value for key '%s' to cty: %v. Skipping.", key, err)
			// Optionally return error or skip the variable
			continue
			// return "", fmt.Errorf("error converting value for key '%s': %w", key, err)
		}
		// Set the attribute using the cty value. hclwrite handles quoting and syntax.
		rootBody.SetAttributeValue(key, ctyVal)
		rootBody.AppendNewline() // Add newline after each variable for readability
	}

	// 4. Return the formatted HCL string
	return string(hclFile.Bytes()), nil
}

// goToCty converts a standard Go interface{} (from json.Unmarshal) to a cty.Value.
// This is a simplified conversion. Complex nested structures might need refinement.
func (g *Generator) goToCty(val interface{}) (cty.Value, error) {
	if val == nil {
		return cty.NullVal(cty.DynamicPseudoType), nil
	}

	switch v := val.(type) {
	case string:
		return cty.StringVal(v), nil
	case bool:
		return cty.BoolVal(v), nil
	case int: // json.Unmarshal uses float64 for all numbers by default
		return cty.NumberIntVal(int64(v)), nil
	case int64:
		return cty.NumberIntVal(v), nil
	case float64:
		// Check if it's actually an integer represented as float64
		if float64(int64(v)) == v {
			return cty.NumberIntVal(int64(v)), nil
		}
		return cty.NumberFloatVal(v), nil
	case json.Number: // Handle if json decoder used UseNumber()
		iv, err := v.Int64()
		if err == nil {
			return cty.NumberIntVal(iv), nil
		}
		fv, err := v.Float64()
		if err == nil {
			return cty.NumberFloatVal(fv), nil
		}
		return cty.NilVal, fmt.Errorf("cannot convert json.Number %q", v.String())
	case []interface{}:
		// Convert slice elements recursively
		vals := []cty.Value{}
		for _, elem := range v {
			ctyElem, err := g.goToCty(elem)
			if err != nil {
				// Handle error or skip element?
				return cty.NilVal, fmt.Errorf("error converting slice element: %w", err)
			}
			vals = append(vals, ctyElem)
		}
		if len(vals) == 0 {
			// Need a type for an empty list. Dynamic is often okay for tfvars.
			return cty.ListValEmpty(cty.DynamicPseudoType), nil
		}
		// This creates a tuple, which is often fine for tfvars lists
		return cty.TupleVal(vals), nil
	case map[string]interface{}:
		// Convert map elements recursively
		vals := make(map[string]cty.Value)
		for key, elem := range v {
			ctyElem, err := g.goToCty(elem)
			if err != nil {
				// Handle error or skip element?
				return cty.NilVal, fmt.Errorf("error converting map element '%s': %w", key, err)
			}
			vals[key] = ctyElem
		}
		if len(vals) == 0 {
			// Need a type for an empty map. Dynamic is often okay.
			return cty.MapValEmpty(cty.DynamicPseudoType), nil
		}
		// This creates an object value, generally correct for tfvars maps
		return cty.ObjectVal(vals), nil
	default:
		// Fallback attempt using gocty (might work for simple structs)
		// Note: This requires `val` to be a struct or pointer usable by gocty.
		// Since input is from `interface{}`, direct use might be limited.
		// It's better to handle known types explicitly.
		// For unknown types, maybe try marshalling back to JSON and using ctyjson?
		log.Printf("Attempting fallback conversion for type %T\n", v)
		// Let's try ctyjson as a more robust fallback
		tempJson, err := json.Marshal(v)
		if err != nil {
			return cty.NilVal, fmt.Errorf("unsupported type %T and failed fallback JSON marshal", v)
		}
		impliedType, err := ctyjson.ImpliedType(tempJson)
		if err != nil {
			return cty.NilVal, fmt.Errorf("unsupported type %T and failed fallback implied type inference", v)
		}
		ctyVal, err := ctyjson.Unmarshal(tempJson, impliedType)
		if err != nil {
			return cty.NilVal, fmt.Errorf("unsupported type %T and failed fallback ctyjson unmarshal", v)
		}
		return ctyVal, nil
		// return cty.NilVal, fmt.Errorf("unsupported type %T in goToCty conversion", v)
	}
}
