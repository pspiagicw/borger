package main

import (
	"html/template"
	"io/fs"
	"log"
	"net/http"
	"os"
	"time"

	"borger/internal/borgmatic"
	"borger/internal/dashboard"
	"borger/internal/web"
	webassets "borger/web"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func main() {
	addr := envOrDefault("APP_ADDR", ":8080")

	tmpl, err := template.ParseFS(
		webassets.FS,
		"templates/layout.html",
		"templates/dashboard.html",
	)
	if err != nil {
		log.Fatalf("parse templates: %v", err)
	}

	staticFS, err := fs.Sub(webassets.FS, "static")
	if err != nil {
		log.Fatalf("open static assets: %v", err)
	}

	client := borgmatic.NewClient(60 * time.Second)
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
	r.Handle("/static/*", http.StripPrefix("/static/", http.FileServer(http.FS(staticFS))))

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
