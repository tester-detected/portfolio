# Tatyana Patrakeeva — QA Engineer

QA Engineer with 4+ years of commercial experience testing web and mobile applications across the full quality lifecycle — from test strategy and documentation to e2e automation and CI/CD integration.

## Experience

| Period | Company | Role | Key Impact |
|--------|---------|------|------------|
| 2025 — present | **TERN** | QA Auto / QA Manager | Migrating SAP BO to a domestic BI platform. Built Cypress e2e framework (TS), deployed TMS Testy from scratch for 600+ test cases, integrated automated test reporting into TMS |
| 2023 — 2025 | **VK** | QA Engineer | Full-cycle testing of VK Teams messenger (iOS, Android, Windows, Linux, macOS, Web). Wrote Playwright + TS unit/e2e tests from scratch for the Org Structure mini-app |
| 2022 — 2023 | **Joom** | QA Engineer | Owned release cycle QA for an internal support tool. Built testing process from zero, wrote JS autotests, reduced average ticket resolution time |

## Tech Stack

**Automation:** Cypress, Playwright, TypeScript / JavaScript, Node.js, Page Object Model  
**CI/CD:** GitLab CI, Jenkins, Git  
**API Testing:** Postman, Swagger, REST, WebSocket, gRPC  
**Databases:** PostgreSQL, Oracle, ClickHouse, MySQL (DBeaver)  
**Test Management:** Jira, Testy, TestRail, Allure TestOps, Confluence  
**Traffic Analysis:** Charles, Proxyman, Fiddler  
**Mobile:** Android Studio, Xcode, BrowserStack  
**Load Testing:** Apache JMeter  

## Portfolio Projects

### [Cypress + TMS Integration](./cypress-testy-integration/)
Integration between Cypress and Testy TMS, running in Docker on a dedicated test server.  
- Parses Mochawesome reports and maps test case codes from `describe()` / `it()` blocks to TMS cases  
- Uploads pass/fail results via REST API (JWT auth, paginated endpoints)  
- Two modes: automatic (all cases) and manual (specific test plan)  
- Bash CLI wrapper (`cy`) for running tests, uploading results, and managing the environment  
- **Stack:** Node.js, Docker, Bash, Mochawesome, REST API

### [Test Design Examples](./test-design/) *(in progress)*
Techniques: equivalence partitioning, boundary values, decision tables, pairwise testing, state transition diagrams.

### [SQL for QA](./backend-testing/sql/) *(in progress)*
Practical SQL queries for data validation, duplicate detection, joins, and aggregations used in day-to-day testing.

## Approach

- Clean code principles: KISS, DRY, YAGNI, SOLID  
- Agile workflow: Scrum / Kanban, cross-functional collaboration  
- Process-oriented: if something can be systematized and automated — it should be  

## Contact

- GitHub: [tester-detected](https://github.com/tester-detected)
