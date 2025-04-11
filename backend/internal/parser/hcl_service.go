package parser

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"

	// Keep this import
	"github.com/hashicorp/hcl/v2"
	"github.com/hashicorp/hcl/v2/hclsyntax"
	"github.com/zclconf/go-cty/cty"
	"github.com/zclconf/go-cty/cty/function" // Import the function package
	"github.com/zclconf/go-cty/cty/function/stdlib"
	"github.com/zinzh/TerraOps/backend/internal/models"
)

type HCLParserService struct{}

func NewHCLParserService() *HCLParserService {
	return &HCLParserService{}
}

// ParseVariablesFromPath scans a directory for .tf files, parses them,
// and extracts variable definitions.
// Returns a map of variable names to TfVariable structs or an error.
func (s *HCLParserService) ParseVariablesFromPath(repoPath string) (models.VariableDefinitions, error) {
	log.Printf("Parsing variables from path: %s\n", repoPath)
	variables := make(models.VariableDefinitions)
	// Remove: parser := hcl.NewParser(hclsyntax.NewParser())

	err := filepath.WalkDir(repoPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err // Propagate errors from walking the directory
		}
		// Skip .git directory and non-.tf files
		if d.IsDir() && d.Name() == ".git" {
			return filepath.SkipDir
		}
		if d.IsDir() || filepath.Ext(path) != ".tf" {
			return nil
		}

		// Read the file content
		srcBytes, err := os.ReadFile(path)
		if err != nil {
			log.Printf("Error reading file %s: %v\n", path, err)
			return nil // Continue walking
		}

		// --- Correction Start ---
		// Parse using hclsyntax directly
		file, diags := hclsyntax.ParseConfig(srcBytes, filepath.Base(path), hcl.Pos{Line: 1, Column: 1})
		// --- Correction End ---

		if diags.HasErrors() {
			log.Printf("HCL syntax parsing errors in file %s: %s\n", path, diags.Error())
			return nil // Continue walking
		}

		if file == nil || file.Body == nil {
			return nil
		}

		variableSchema := &hcl.BodySchema{
			Blocks: []hcl.BlockHeaderSchema{
				{Type: "variable", LabelNames: []string{"name"}},
			},
		}

		content, _, diags := file.Body.PartialContent(variableSchema)
		if diags.HasErrors() {
			log.Printf("Error extracting variable blocks from %s: %s\n", path, diags.Error())
			return nil
		}

		// Define the schema for attributes inside a variable block (remains the same)
		// variableAttrSchema := &hcl.BodySchema{ ... } // Not strictly needed with JustAttributes

		evalCtx := &hcl.EvalContext{
			// Use function.Function from the imported package
			Functions: map[string]function.Function{
				"jsonencode": stdlib.JSONEncodeFunc,
				// Add more stdlib functions here if needed by variable defaults etc.
			},
		}

		for _, block := range content.Blocks {
			if block.Type == "variable" {
				varName := block.Labels[0]
				if _, exists := variables[varName]; exists {
					log.Printf("Warning: Variable '%s' redefined in file %s. Overwriting previous definition.\n", varName, path)
				}

				// Use block.Body directly to get attributes
				attrs, diags := block.Body.JustAttributes()
				if diags.HasErrors() {
					log.Printf("Error reading attributes for variable '%s' in %s: %s\n", varName, path, diags.Error())
					continue // Skip this variable block
				}

				var tfVar models.TfVariable
				tfVar.Name = varName
				tfVar.Type = json.RawMessage(`"any"`) // Default type

				// --- Process Attributes (Logic largely the same, ensure evaluation context is good) ---
				if attr, exists := attrs["type"]; exists {
					typeExprStr := string(attr.Expr.Range().SliceBytes(srcBytes))
					typeJSONBytes, _ := json.Marshal(typeExprStr)
					tfVar.Type = json.RawMessage(typeJSONBytes)
					delete(attrs, "type")
				}

				if attr, exists := attrs["description"]; exists {
					descVal, diag := attr.Expr.Value(evalCtx)
					if !diag.HasErrors() && descVal.Type() == cty.String {
						desc := descVal.AsString()
						tfVar.Description = &desc
					} else {
						log.Printf("Warning: Could not evaluate description for variable '%s': %s\n", varName, diag.Error())
					}
					delete(attrs, "description")
				}

				if attr, exists := attrs["default"]; exists {
					defaultVal, diag := attr.Expr.Value(evalCtx)
					if !diag.HasErrors() {
						defaultJSON, err := models.CtyValueToJSON(defaultVal) // Use existing helper
						if err != nil {
							log.Printf("Error converting default value to JSON for variable '%s': %v\n", varName, err)
						} else {
							tfVar.Default = defaultJSON
						}
					} else {
						log.Printf("Error evaluating default for variable '%s': %s\n", varName, diag.Error())
					}
					delete(attrs, "default")
				}

				if attr, exists := attrs["sensitive"]; exists {
					sensVal, diag := attr.Expr.Value(evalCtx)
					if !diag.HasErrors() && sensVal.Type() == cty.Bool {
						tfVar.Sensitive = sensVal.True()
					} else {
						log.Printf("Warning: Could not evaluate sensitive for variable '%s': %s\n", varName, diag.Error())
					}
					delete(attrs, "sensitive")
				}

				if attr, exists := attrs["nullable"]; exists {
					nullVal, diag := attr.Expr.Value(evalCtx)
					if !diag.HasErrors() && nullVal.Type() == cty.Bool {
						tfVar.Nullable = nullVal.True()
					} else {
						log.Printf("Warning: Could not evaluate nullable for variable '%s': %s\n", varName, diag.Error())
					}
					delete(attrs, "nullable")
				}

				// Log any remaining unprocessed attributes
				for name := range attrs {
					log.Printf("Warning: Unprocessed attribute '%s' for variable '%s' in file %s\n", name, varName, path)
				}

				variables[varName] = tfVar
			}
		}
		return nil // Continue walking
	})

	if err != nil {
		return nil, fmt.Errorf("error walking directory %s: %w", repoPath, err)
	}

	if len(variables) == 0 {
		log.Printf("No variable definitions found in %s\n", repoPath)
	}

	log.Printf("Successfully parsed %d variables from %s\n", len(variables), repoPath)
	return variables, nil
}

// Also ensure models.CtyValueToJSON is present in models/tfvariable.go as defined previously
