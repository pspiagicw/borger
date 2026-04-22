package webassets

import "embed"

// FS bundles templates and static assets into the binary.
//
//go:embed templates/*.html static/css/*.css
var FS embed.FS
