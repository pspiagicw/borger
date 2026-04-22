package web

import (
	"html/template"
	"net/http"

	"borger/internal/dashboard"
)

type Handlers struct {
	dashboard *dashboard.Service
	tmpl      *template.Template
}

func NewHandlers(service *dashboard.Service, tmpl *template.Template) *Handlers {
	return &Handlers{dashboard: service, tmpl: tmpl}
}

func (h *Handlers) Dashboard(w http.ResponseWriter, r *http.Request) {
	vm := h.dashboard.Build(r.Context())
	if err := h.tmpl.ExecuteTemplate(w, "layout", vm); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (h *Handlers) Healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("ok"))
}
