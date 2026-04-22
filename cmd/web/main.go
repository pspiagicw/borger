package main

import (
	"html/template"
	"log"
	"net/http"
	"os"
	"time"

	"borger/internal/borgmatic"
	"borger/internal/dashboard"
	"borger/internal/web"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	addr := envOrDefault("APP_ADDR", ":8080")
	borgmaticBin := envOrDefault("BORGMATIC_BIN", "borgmatic")

	tmpl, err := template.ParseFiles(
		"web/templates/layout.html",
		"web/templates/dashboard.html",
	)
	if err != nil {
		log.Fatalf("parse templates: %v", err)
	}

	client := borgmatic.NewClient(borgmaticBin, 60*time.Second)
	service := dashboard.NewService(client, time.Now)
	handlers := web.NewHandlers(service, tmpl)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(65 * time.Second))

	r.Get("/", handlers.Dashboard)
	r.Get("/healthz", handlers.Healthz)
	r.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.Dir("web/static"))))

	log.Printf("server listening on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func envOrDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
