# VEKTOR BETA V3 — Autopilot foundation

This update adds the first end-to-end project-generation workflow to VEKTOR 5.

## What AUTOPILOT does

1. Accepts a plain-language project request from the UI/API.
2. Optionally searches the public web through DuckDuckGo HTML (no search API key).
3. Attempts to open public result pages and extracts readable text for the model.
4. Asks the configured **FREE_ONLY** model router for a JSON project manifest.
5. Validates generated relative paths and file-size limits before writing project files.
6. Runs static checks where available: Python AST parsing, Node `--check`, and HTML parsing.
7. Writes `VEKTOR_REPORT.json` with generated files, check results, sources and research errors.
8. Creates a ZIP in `data/workspace/projects/` for download from the local server.

The UI entry is in the side menu: **AUTOPILOT · создать проект**.

## Strictly free policy

- Web research uses DuckDuckGo's public HTML interface and does not require a paid API key.
- AI generation uses the existing FREE_ONLY router. This module does not add a paid provider or paid fallback.
- Free AI providers may require a free account/API key and have changing quotas. No external provider can be guaranteed free forever.
- If no free AI provider is configured or its quota is exhausted, generation stops with an error; VEKTOR does not switch to a paid model.

## Run on Android with Termux

1. Install Python 3 and (optional) `clang` in Termux. The server uses `g++` or `clang++` if present; otherwise it uses the Python fallback.
2. Extract this ZIP into a folder such as `~/vektor5`.
3. Open Termux in that folder and run:

   ```sh
   python server.py
   ```

4. Open `http://127.0.0.1:8080` in the phone browser.
5. Configure one supported free AI provider on the server using `.env` or environment variables. Keep API keys out of the browser UI and Git repository.
6. Open the side menu → AUTOPILOT, enter a task, keep web research enabled, and start.
7. Download the generated project ZIP using the link shown after completion.

The local server binds to `127.0.0.1` by default. It is intended for local testing on the same device, not public internet exposure.

## API

`POST /api` with JSON:

```json
{"m":"autopilot.run","a":{"task":"Create a small browser game","research":true,"max_sources":5}}
```

Web tools are also available:

```json
{"m":"web.search","a":{"query":"Three.js documentation","limit":5}}
{"m":"web.open","a":{"url":"https://example.com"}}
```

## Current limitations — important

This is a working V3 foundation, not a claim that every planned feature is complete:

- The web search parser depends on DuckDuckGo's public HTML layout; that layout or access limits can change.
- This build's development environment had no working DNS/internet access, so live search could not be verified here. The search code and mocked integration tests pass; perform a live test on the phone with internet access.
- The model must return a valid JSON manifest. Invalid output stops the run rather than silently producing a broken ZIP.
- Checks are static syntax/parse checks, not a full emulator, browser, or device test.
- Autopilot does not execute arbitrary generated shell commands, install packages, deploy projects, or autonomously repair code in an iterative run/fix loop.
- Android APK packaging and a native Android voice/wake-word engine are not implemented by this Autopilot patch.
- The generated ZIP contains source files, not an APK.

## Security boundaries

- Web page URLs are restricted to HTTP(S); localhost and non-public IP targets are rejected, including after redirects.
- Generated project paths must be relative and cannot traverse outside the project folder.
- Generated file count and file sizes are capped.
- Generated shell commands are never executed.
- API secrets belong in server environment variables, never in UI code or generated project files.

## Tests

From the project directory:

```sh
PYTHONPATH=engine python tests/test_all.py
PYTHONPATH=engine python tests/test_router.py
PYTHONPATH=engine python tests/test_autopilot.py
```

The local server compiles the C++ shared library on first start if a compiler is available; otherwise it uses the Python fallback.
