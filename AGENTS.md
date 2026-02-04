# AGENTS.md (Biznesinfo Develop)

This repository powers the **development** instance of Biznesinfo.

## Safety rules

- Do **not** modify anything in `/home/mlweb/biznesinfo.lucheestiy.com` (production).
- Do **not** change production ports/volumes. Dev uses host port `8131`.
- Do not commit secrets or datasets (`.env`, `companies.jsonl`, `secrets/` are gitignored).

## Local run

- `docker compose up -d --build`
- `curl -fsSI http://127.0.0.1:8131/ | head`

## AI devloop

- The automation entrypoint is `bin/ai-devloop-run`.
- It reads `devloop/TODO.md` to decide what to work on.

