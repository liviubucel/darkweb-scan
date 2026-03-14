---
name: zebrabyte-investigator
description: Use this skill when OpenClaw needs to investigate domains, companies, leaked data, dark web mentions, or web security exposure by calling the ZebraByte scanners in this repository. Trigger it for requests such as checking whether a domain appears on the dark web, scanning a site for common security issues, combining both scans into one investigation, or summarizing scanner output for the user.
---

# Zebrabyte Investigator

## Overview

Call the bundled Python scripts before answering investigative questions. Prefer the scripts in `scripts/` over reimplementing scanning logic in prompts.

## Quick Start

Use the repository virtual environment when it exists:

```powershell
.\.venv\Scripts\python.exe skills\zebrabyte-investigator\scripts\darkweb_scan.py --query "example.com leak"
.\.venv\Scripts\python.exe skills\zebrabyte-investigator\scripts\vulnerability_scan.py --target example.com --deep-analysis
```

If the virtual environment is unavailable, use another Python 3.10+ interpreter and keep the current working directory at the repository root.

## Tasks

### Dark Web Investigation

Run `scripts/darkweb_scan.py` for requests about leaks, breaches, actor mentions, credential exposure, or onion-index searching.

Inputs:
- `--query` with the company, domain, actor, or artifact to search
- `--threads` when the user wants faster parallel scraping
- `--max-results` when the result set should be smaller or larger

Behavior:
- The script uses the repository search and scrape modules directly.
- The script does not require the FastAPI server to be running.
- The script checks whether Tor SOCKS is reachable on `127.0.0.1:9050` and reports that in JSON output.
- The script keeps output deterministic and does not call an external LLM.

### Vulnerability Scan

Run `scripts/vulnerability_scan.py` for requests about web security posture, SSL/TLS, headers, cookies, CORS, dangerous methods, or deep path exposure.

Inputs:
- `--target` with a hostname or URL
- `--deep-analysis` to probe common sensitive paths
- `--check-darkweb` to include the repository dark web exposure routine

Behavior:
- The script calls `vuln_scanner.py` directly through Python, not through HTTP.
- The output is JSON and safe to quote or summarize back to the user.

### Combined Investigation

When the user asks for a fuller assessment:
1. Run `vulnerability_scan.py`.
2. Run `darkweb_scan.py` with the domain, company name, or breach artifact.
3. Synthesize the two outputs into a single answer with clear uncertainty notes.

## Output Handling

Prefer these fields when summarizing:
- Dark web scan: `query`, `results`, `summary`, `metadata`
- Vulnerability scan: `target`, `summary`, `metadata.securityScore`, `vulnerabilities`, `darkweb_intelligence`

Do not claim successful dark web coverage if `metadata.tor_available` is `false` or the script reports an execution error.

## References

Read [references/commands.md](./references/commands.md) when you need exact command examples or a reminder of the JSON structure.
