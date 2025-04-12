package maintf

import (
	"fmt"

	"github.com/hashicorp/hcl/v2/hclsyntax" // Added import
	"github.com/hashicorp/hcl/v2/hclwrite"
	"github.com/zclconf/go-cty/cty"
)

type Generator struct{}

func NewGenerator() *Generator {
	return &Generator{}
}

// Generate creates a basic main.tf content string calling a specific blueprint module.
func (g *Generator) Generate(moduleName string, blueprintGitURL string, blueprintVersion *string) (string, error) {
	if moduleName == "" {
		return "", fmt.Errorf("module name cannot be empty")
	}
	if blueprintGitURL == "" {
		return "", fmt.Errorf("blueprint git url cannot be empty")
	}

	hclFile := hclwrite.NewEmptyFile()
	rootBody := hclFile.Body()

	// Add comment header
	rootBody.AppendUnstructuredTokens(hclwrite.Tokens{
		// Use hclsyntax constants
		{Type: hclsyntax.TokenComment, Bytes: []byte(fmt.Sprintf("# Auto-generated main.tf for client instance using blueprint: %s\n", moduleName))},
		{Type: hclsyntax.TokenNewline, Bytes: []byte("\n")},
	})

	// ... terraform block (commented out) ...

	moduleBlock := rootBody.AppendNewBlock("module", []string{moduleName})
	moduleBody := moduleBlock.Body()

	moduleBody.SetAttributeValue("source", cty.StringVal(blueprintGitURL))

	// Set the version attribute if provided
	if blueprintVersion != nil && *blueprintVersion != "" {
		moduleBody.SetAttributeValue("version", cty.StringVal(*blueprintVersion))
	}

	// Add comment for variables
	moduleBody.AppendUnstructuredTokens(hclwrite.Tokens{
		{Type: hclsyntax.TokenNewline, Bytes: []byte("\n")},
		{Type: hclsyntax.TokenComment, Bytes: []byte("# Variables are sourced from terraform.tfvars\n")},
	})

	rootBody.AppendNewline()

	return string(hclFile.Bytes()), nil
}
