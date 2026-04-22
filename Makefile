APP_ADDR ?= :8090
GOCACHE := $(CURDIR)/.gocache
GOPATH := $(CURDIR)/.gopath
GOENV := GOCACHE=$(GOCACHE) GOPATH=$(GOPATH)
DIST_DIR := dist
VERSION ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)
TARGET_OS ?= linux
TARGET_ARCH ?= amd64

.PHONY: setup
setup:
	mkdir -p $(GOCACHE) $(GOPATH) bin
	$(GOENV) go mod tidy
	npm install
	npm run build:css

.PHONY: dev
dev:
	APP_ADDR=$(APP_ADDR) $(GOENV) go run ./cmd/web

.PHONY: run
run:
	APP_ADDR=$(APP_ADDR) $(GOENV) go run ./cmd/web

.PHONY: test
test:
	$(GOENV) go test ./...

.PHONY: vet
vet:
	$(GOENV) go vet ./...

.PHONY: build
build:
	mkdir -p bin
	$(GOENV) go build -o ./bin/borger ./cmd/web

.PHONY: package
package:
	mkdir -p $(DIST_DIR)
	$(GOENV) GOOS=$(TARGET_OS) GOARCH=$(TARGET_ARCH) CGO_ENABLED=0 go build -ldflags="-s -w" -o ./$(DIST_DIR)/borger ./cmd/web
	cp deploy/borger.service ./$(DIST_DIR)/borger.service
	tar -C $(DIST_DIR) -czf ./$(DIST_DIR)/borger-$(VERSION)-$(TARGET_OS)-$(TARGET_ARCH).tar.gz borger borger.service

.PHONY: css
css:
	npm run build:css

.PHONY: css-watch
css-watch:
	npm run watch:css
