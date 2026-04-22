APP_ADDR ?= :8090
DIST_DIR := dist
VERSION ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)

.PHONY: setup
setup:
	npm install
	npm run build:css

.PHONY: dev
dev:
	APP_ADDR=$(APP_ADDR) npm run dev

.PHONY: run
run:
	APP_ADDR=$(APP_ADDR) npm run start

.PHONY: test
test:
	node --test

.PHONY: build
build:
	npm run build:css

.PHONY: package
package:
	mkdir -p $(DIST_DIR)
	tar -czf ./$(DIST_DIR)/borger-node-$(VERSION).tar.gz \
		server.js package.json package-lock.json web deploy

.PHONY: css
css:
	npm run build:css

.PHONY: css-watch
css-watch:
	npm run watch:css
