# VEKTOR BETA V3 — changes

- Added free DuckDuckGo HTML search adapter (`web_research.py`).
- Added public-page text extraction with HTTP(S), redirect and private-network safeguards.
- Added `web.search` and `web.open` engine tools.
- Added Autopilot workflow: optional web research → model project manifest → path/size validation → files → static checks → report → ZIP.
- Added AUTOPILOT panel to the web UI.
- Added local ZIP download route to `server.py`.
- Added integration test with mocked search/model response.
- Added V3 setup, API, free-only policy, security boundaries and limitations documentation.

## Known limitations

Live DuckDuckGo access was not verifiable in the isolated build environment because DNS resolution was unavailable. Search must be live-tested on a connected Android device. Autopilot currently performs static checks only and does not execute generated commands or perform iterative self-repair.
