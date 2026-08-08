// Package decoder provides a generic, registry-based way to decode raw
// instruction bytes into structured JSON — the piece a types-server sidecar
// (see internal/typesserver) needs so frontends/dashboards can display a
// decoded payload without duplicating this repo's Go types in TypeScript.
package decoder

// DataKind indicates whether the data represents a message or a result.
type DataKind string

const (
	KindMessage DataKind = "message"
	KindResult  DataKind = "result"
)

// Decoder decodes raw bytes into a structured value.
type Decoder interface {
	Decode(data []byte) (any, error)
}
