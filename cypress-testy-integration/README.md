# Cypress + TMS Integration (Docker)

Integration between Cypress e2e test framework and a Test Management System (TMS), running in a Docker container on a dedicated test server.

## What it does

- Runs Cypress tests in headless mode inside Docker
- Parses Mochawesome JSON reports and extracts test case codes from `describe()`/`it()` blocks
- Uploads results to TMS via REST API (JWT auth, paginated endpoints)
- Supports two modes: automatic (all tests) and manual (specific test plan)
- Provides a CLI wrapper (`cy`) for convenient test execution on the server

## Architecture

```
TMS (your-server:8080)                 Cypress (Docker on the same server)
+---------------------+                +----------------------+
|  Test cases          |                |  Spec files          |
|  (code: REP_045)     |<-- mapping -->|  describe('REP_045') |
|                     |                |                      |
|  Test plans         |                |  Mochawesome reports |
|  (manual/auto)      |<-- upload  ---|  cypress/reports/     |
+---------------------+                +----------------------+
```

## Key Features

- **Two upload modes**: Mode A creates/reuses an automatic plan with all cases. Mode B uploads results only for cases in a manually created plan.
- **Stand aliases**: Short aliases for test environments (`--stand 52`, `--stand 2021`)
- **User override**: Run tests under a different user without changing config (`--user admin:pass`)
- **Code matching**: Supports prefix aliases, suffix stripping, and range matching (e.g. `DEL_VT_7` matches `DEL_VT_7-8`)
- **Auto-update from git**: Single command to pull latest tests and rebuild the Docker image

## Files

| File | Description |
|------|-------------|
| `testy-integration.js` | Main integration script: JWT auth, report parsing, result upload |
| `Dockerfile` | Docker image based on `cypress/included` |
| `docker-compose.yml` | Docker Compose config with host networking and volume mounts |
| `cy` | Bash CLI wrapper for running tests, uploading results, updating from git |
| `cypress.config.server.js` | Cypress config for the server environment |

## Usage

```bash
# Run tests
./cy run LoginTests
./cy run LoginTests --stand 2021
./cy run LoginTests --user admin:adminpass

# Upload results to TMS
./cy upload
./cy upload --plan "Regression v2.5"
./cy upload --plan-id 2

# Run + upload in one command
./cy run-upload LoginTests --stand 2021 --plan "Sprint 42"

# Service commands
./cy plans          # List test plans
./cy clean          # Clear reports/screenshots
./cy update         # Pull from git + rebuild Docker image
./cy help           # Show all commands
```

## Tech Stack

- **Cypress 14.x** (headless, Electron)
- **Docker** (cypress/included image)
- **Node.js** (integration script, native http module, no external deps)
- **Mochawesome** (JSON test reports)
- **TMS REST API** (Django-based, JWT authentication)
- **Bash** (CLI wrapper with argument parsing)

## How the mapping works

Each test case in TMS has a unique code attribute (e.g. `REP_045`, `CN_008`). The same code is used in Cypress `describe()` blocks:

```js
describe('REP_045 Report pagination', () => {
  it('Step 1: Navigate to page 2', () => { ... });
  it('Step 2: Verify data', () => { ... });
});
```

The integration script:
1. Fetches all cases from TMS API
2. Parses Mochawesome JSON reports
3. Matches codes from reports to TMS cases
4. Uploads pass/fail status for each matched case
