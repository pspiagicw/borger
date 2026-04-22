APP_ADDR ?= :8090
GOCACHE := $(CURDIR)/.gocache
GOPATH := $(CURDIR)/.gopath
GOENV := GOCACHE=$(GOCACHE) GOPATH=$(GOPATH)

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

.PHONY: css
css:
	npm run build:css

.PHONY: css-watch
css-watch:
	npm run watch:css
