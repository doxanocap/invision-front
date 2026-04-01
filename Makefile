.PHONY: install dev build lint clean env

install:
	npm ci

dev:
	npm run dev

build:
	npm run build

lint:
	npm run lint

clean:
	rm -rf .next

env:
	@if [ ! -f .env.local ]; then \
		cp .env.example .env.local; \
		echo "Created .env.local"; \
	else \
		echo ".env.local already exists"; \
	fi
