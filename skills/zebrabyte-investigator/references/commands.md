# ZebraByte OpenClaw Commands

## Dark Web Scan

Run from the repository root:

```powershell
.\.venv\Scripts\python.exe skills\zebrabyte-investigator\scripts\darkweb_scan.py --query "example.com leak" --threads 4 --max-results 8
```

Expected top-level JSON fields:
- `query`
- `refined_query`
- `results`
- `summary`
- `total_results`
- `metadata`

Important metadata:
- `tor_available`: whether Tor SOCKS was reachable on `127.0.0.1:9050`
- `raw_results`: total search hits before truncation
- `filtered_results`: results sent to scraping

## Vulnerability Scan

Run from the repository root:

```powershell
.\.venv\Scripts\python.exe skills\zebrabyte-investigator\scripts\vulnerability_scan.py --target example.com --deep-analysis --check-darkweb
```

Expected top-level JSON fields:
- `target`
- `timestamp`
- `vulnerabilities`
- `summary`
- `metadata`
- `darkweb_intelligence`

Important metadata:
- `securityScore`
- `testsPerformed`
- `scanDuration`

## Interpretation Rules

- Treat empty dark web results as inconclusive when Tor is unavailable.
- Treat `check-darkweb` in vulnerability scans as slower and more failure-prone because it depends on the repository dark web search path.
- Quote high and critical findings first when summarizing vulnerability output.
