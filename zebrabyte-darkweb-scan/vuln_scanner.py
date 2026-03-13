"""
Vulnerability Scanner Backend - Python API
Provides advanced security analysis and integrates with dark web intelligence
"""

import asyncio
import ssl
import socket
from datetime import datetime
from typing import Dict, List, Optional
from urllib.parse import urlparse
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, HttpUrl


class ScanRequest(BaseModel):
    target: str
    deep_analysis: bool = False
    check_darkweb: bool = False


class VulnerabilityResult(BaseModel):
    severity: str
    category: str
    title: str
    description: str
    impact: str
    recommendation: str
    technicalDetails: str
    owasp: Optional[str] = None
    cwe: Optional[str] = None
    cvss: Optional[str] = None


class ScanResponse(BaseModel):
    target: str
    timestamp: str
    vulnerabilities: List[VulnerabilityResult]
    summary: Dict[str, int]
    metadata: Dict
    darkweb_intelligence: Optional[Dict] = None


app = FastAPI(title="ZebraByte Vulnerability Scanner API")


@app.post("/api/scan", response_model=ScanResponse)
async def scan_target(request: ScanRequest):
    """
    Advanced vulnerability scanning with dark web intelligence
    """
    start_time = datetime.now()
    
    # Normalize URL
    target_url = normalize_url(request.target)
    
    # Initialize results
    results = {
        "target": target_url,
        "timestamp": start_time.isoformat(),
        "vulnerabilities": [],
        "summary": {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0, "total": 0},
        "metadata": {
            "scanDuration": 0,
            "testsPerformed": 0,
            "securityScore": 0,
            "targetInfo": {}
        }
    }
    
    # Perform scans
    async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
        await gather_target_info(client, target_url, results)
        
        # Run all tests concurrently
        await asyncio.gather(
            test_ssl_advanced(client, target_url, results),
            test_security_headers(client, target_url, results),
            test_hsts(client, target_url, results),
            test_csp(client, target_url, results),
            test_cookies(client, target_url, results),
            test_cors(client, target_url, results),
            test_server_info(client, target_url, results),
            test_http_methods(client, target_url, results),
            test_https_redirect(client, target_url, results),
            return_exceptions=True
        )
        
        # Deep analysis if requested
        if request.deep_analysis:
            await deep_security_analysis(client, target_url, results)
        
        # Check dark web intelligence if requested
        if request.check_darkweb:
            results["darkweb_intelligence"] = await check_darkweb_exposure(target_url)
    
    # Calculate final metrics
    results["metadata"]["testsPerformed"] = 9 + (3 if request.deep_analysis else 0)
    results["metadata"]["securityScore"] = calculate_security_score(results)
    results["metadata"]["scanDuration"] = (datetime.now() - start_time).total_seconds()
    results["summary"]["total"] = len(results["vulnerabilities"])
    
    return results


def normalize_url(target: str) -> str:
    """Normalize URL"""
    url = target.strip()
    if not url.startswith(('http://', 'https://')):
        url = f'https://{url}'
    return url


async def gather_target_info(client: httpx.AsyncClient, url: str, results: dict):
    """Gather basic target information"""
    try:
        response = await client.head(url, follow_redirects=True)
        parsed = urlparse(url)
        
        results["metadata"]["targetInfo"] = {
            "hostname": parsed.hostname,
            "protocol": parsed.scheme,
            "server": response.headers.get("Server", "Unknown"),
            "statusCode": response.status_code,
            "ip_address": await resolve_ip(parsed.hostname)
        }
    except Exception as e:
        results["metadata"]["targetInfo"] = {
            "hostname": urlparse(url).hostname,
            "error": str(e)
        }


async def resolve_ip(hostname: str) -> Optional[str]:
    """Resolve hostname to IP"""
    try:
        return socket.gethostbyname(hostname)
    except:
        return None


async def test_ssl_advanced(client: httpx.AsyncClient, url: str, results: dict):
    """Advanced SSL/TLS testing"""
    if url.startswith('http://'):
        add_vuln(
            results, "critical", "ssl", "No HTTPS Encryption",
            "The website does not use HTTPS. All data is transmitted in plaintext.",
            "Critical - Complete data exposure, Man-in-the-Middle attacks",
            "Implement SSL/TLS certificate immediately.",
            "Protocol: HTTP (unencrypted)",
            "A02:2021-Cryptographic Failures", "CWE-319"
        )
        return
    
    try:
        # Check SSL certificate validity
        parsed = urlparse(url)
        context = ssl.create_default_context()
        
        with socket.create_connection((parsed.hostname, 443), timeout=10) as sock:
            with context.wrap_socket(sock, server_hostname=parsed.hostname) as ssock:
                cert = ssock.getpeercert()
                
                # Check certificate expiration
                not_after = datetime.strptime(cert['notAfter'], '%b %d %H:%M:%S %Y %Z')
                days_until_expiry = (not_after - datetime.now()).days
                
                if days_until_expiry < 30:
                    add_vuln(
                        results, "high", "ssl", "SSL Certificate Expiring Soon",
                        f"SSL certificate expires in {days_until_expiry} days.",
                        "High - Service disruption imminent",
                        "Renew SSL certificate immediately.",
                        f"Expiry date: {not_after}",
                        "A02:2021-Cryptographic Failures", "CWE-295"
                    )
                
                # Check TLS version
                tls_version = ssock.version()
                if tls_version in ['TLSv1', 'TLSv1.1']:
                    add_vuln(
                        results, "high", "ssl", "Outdated TLS Version",
                        f"Server uses outdated {tls_version}.",
                        "High - Vulnerable to known TLS attacks",
                        "Upgrade to TLS 1.2 or 1.3.",
                        f"Current version: {tls_version}",
                        "A02:2021-Cryptographic Failures", "CWE-327"
                    )
                    
    except Exception as e:
        if "certificate" in str(e).lower() or "ssl" in str(e).lower():
            add_vuln(
                results, "high", "ssl", "SSL Certificate Error",
                f"SSL/TLS certificate validation failed: {str(e)}",
                "High - Users may be vulnerable to MITM attacks",
                "Fix or renew SSL certificate.",
                str(e),
                "A02:2021-Cryptographic Failures", "CWE-295"
            )


async def test_security_headers(client: httpx.AsyncClient, url: str, results: dict):
    """Test security headers"""
    try:
        response = await client.head(url)
        
        headers = [
            {"name": "X-Content-Type-Options", "severity": "medium", "value": "nosniff"},
            {"name": "X-Frame-Options", "severity": "medium", "value": "DENY or SAMEORIGIN"},
            {"name": "Referrer-Policy", "severity": "low", "value": "strict-origin-when-cross-origin"},
            {"name": "Permissions-Policy", "severity": "low", "value": "restrictive policy"}
        ]
        
        for h in headers:
            if h["name"] not in response.headers:
                add_vuln(
                    results, h["severity"], "headers", f"Missing Security Header: {h['name']}",
                    "This header protects against common attacks.",
                    f"{h['severity'].capitalize()} - Security header missing",
                    f"Add '{h['name']}: {h['value']}' to HTTP response headers.",
                    f"Header '{h['name']}' is missing",
                    "A05:2021-Security Misconfiguration", "CWE-16"
                )
    except Exception:
        pass


async def test_hsts(client: httpx.AsyncClient, url: str, results: dict):
    """Test HSTS configuration"""
    try:
        response = await client.head(url)
        hsts = response.headers.get("Strict-Transport-Security")
        
        if not hsts:
            add_vuln(
                results, "high", "headers", "Missing HSTS Header",
                "HTTP Strict Transport Security (HSTS) is not configured.",
                "High - Man-in-the-middle attacks, SSL stripping possible",
                "Add 'Strict-Transport-Security: max-age=31536000; includeSubDomains' header.",
                "No HSTS header detected",
                "A05:2021-Security Misconfiguration", "CWE-523"
            )
    except Exception:
        pass


async def test_csp(client: httpx.AsyncClient, url: str, results: dict):
    """Test Content Security Policy"""
    try:
        response = await client.get(url)
        csp = response.headers.get("Content-Security-Policy")
        
        if not csp:
            add_vuln(
                results, "high", "csp", "Missing Content Security Policy",
                "No Content-Security-Policy header found. Vulnerable to XSS attacks.",
                "High - Cross-site scripting (XSS) attacks possible",
                "Implement a strict Content-Security-Policy.",
                "No CSP header detected",
                "A03:2021-Injection", "CWE-79"
            )
        else:
            if "'unsafe-inline'" in csp:
                add_vuln(
                    results, "medium", "csp", "Unsafe CSP: unsafe-inline",
                    "CSP contains 'unsafe-inline' directive.",
                    "Medium - XSS protection weakened",
                    "Remove 'unsafe-inline' directive.",
                    "CSP directive 'unsafe-inline' found",
                    "A03:2021-Injection", "CWE-79"
                )
    except Exception:
        pass


async def test_cookies(client: httpx.AsyncClient, url: str, results: dict):
    """Test cookie security"""
    try:
        response = await client.get(url)
        
        for cookie_header in response.headers.get_list("Set-Cookie"):
            lower = cookie_header.lower()
            
            if "secure" not in lower:
                add_vuln(
                    results, "high", "cookies", "Cookies Without Secure Flag",
                    "Cookies are set without the Secure flag.",
                    "High - Cookie theft via Man-in-the-Middle attacks",
                    "Add 'Secure' flag to all cookies.",
                    "Cookie without Secure flag",
                    "A02:2021-Cryptographic Failures", "CWE-614"
                )
            
            if "httponly" not in lower:
                add_vuln(
                    results, "high", "cookies", "Cookies Accessible via JavaScript",
                    "Cookies do not have HttpOnly flag.",
                    "High - Session hijacking via XSS attacks",
                    "Add 'HttpOnly' flag to sensitive cookies.",
                    "HttpOnly flag missing",
                    "A03:2021-Injection", "CWE-1004"
                )
            
            if "samesite" not in lower:
                add_vuln(
                    results, "medium", "cookies", "Missing SameSite Cookie Attribute",
                    "Cookies do not have SameSite attribute.",
                    "Medium - CSRF attacks possible",
                    "Add 'SameSite=Strict' or 'SameSite=Lax' to cookies.",
                    "SameSite attribute missing",
                    "A01:2021-Broken Access Control", "CWE-352"
                )
    except Exception:
        pass


async def test_cors(client: httpx.AsyncClient, url: str, results: dict):
    """Test CORS policy"""
    try:
        response = await client.get(url, headers={"Origin": "https://evil-attacker-site.com"})
        cors = response.headers.get("Access-Control-Allow-Origin")
        
        if cors == "*":
            add_vuln(
                results, "high", "cors", "Permissive CORS Policy",
                "CORS policy uses wildcard (*) allowing any origin.",
                "High - Sensitive data can be stolen",
                "Replace wildcard with specific trusted origins.",
                "Access-Control-Allow-Origin: *",
                "A01:2021-Broken Access Control", "CWE-942"
            )
    except Exception:
        pass


async def test_server_info(client: httpx.AsyncClient, url: str, results: dict):
    """Test information disclosure"""
    try:
        response = await client.get(url)
        
        server = response.headers.get("Server")
        powered = response.headers.get("X-Powered-By")
        
        if server and "cloudflare" not in server.lower():
            add_vuln(
                results, "low", "disclosure", "Server Software Disclosure",
                f"Server header reveals software: {server}",
                "Low - Helps attackers fingerprint server",
                "Remove or obfuscate Server header.",
                f"Server: {server}",
                "A05:2021-Security Misconfiguration", "CWE-200"
            )
        
        if powered:
            add_vuln(
                results, "low", "disclosure", "Technology Stack Disclosure",
                f"X-Powered-By header reveals: {powered}",
                "Low - Technology fingerprinting easier",
                "Remove X-Powered-By header.",
                f"X-Powered-By: {powered}",
                "A05:2021-Security Misconfiguration", "CWE-200"
            )
    except Exception:
        pass


async def test_http_methods(client: httpx.AsyncClient, url: str, results: dict):
    """Test HTTP methods"""
    try:
        response = await client.request("OPTIONS", url)
        allow = response.headers.get("Allow")
        
        if allow:
            dangerous = ["PUT", "DELETE", "TRACE"]
            for method in dangerous:
                if method in allow.upper():
                    severity = "medium" if method == "TRACE" else "high"
                    add_vuln(
                        results, severity, "config", f"Dangerous HTTP Method: {method}",
                        f"HTTP method {method} is enabled.",
                        f"{severity.capitalize()} - Unauthorized file operations possible",
                        f"Disable {method} method in web server configuration.",
                        f"Allow header: {allow}",
                        "A05:2021-Security Misconfiguration", "CWE-650"
                    )
    except Exception:
        pass


async def test_https_redirect(client: httpx.AsyncClient, url: str, results: dict):
    """Test HTTPS redirect"""
    if not url.startswith('https://'):
        return
    
    try:
        http_url = url.replace('https://', 'http://')
        response = await client.head(http_url, follow_redirects=False)
        
        if response.status_code not in [301, 302, 307, 308]:
            add_vuln(
                results, "high", "config", "No HTTP to HTTPS Redirect",
                "HTTP version does not redirect to HTTPS.",
                "High - Man-in-the-middle attacks possible",
                "Configure automatic redirect from HTTP to HTTPS.",
                "No redirect found",
                "A02:2021-Cryptographic Failures", "CWE-319"
            )
    except Exception:
        pass


async def deep_security_analysis(client: httpx.AsyncClient, url: str, results: dict):
    """Perform deep security analysis"""
    # Check for common vulnerable paths
    vulnerable_paths = [
        "/.git/config",
        "/.env",
        "/admin",
        "/backup.sql",
        "/phpinfo.php"
    ]
    
    for path in vulnerable_paths:
        try:
            parsed = urlparse(url)
            test_url = f"{parsed.scheme}://{parsed.netloc}{path}"
            response = await client.get(test_url, follow_redirects=False)
            
            if response.status_code == 200:
                add_vuln(
                    results, "critical", "exposure", f"Sensitive Path Exposed: {path}",
                    "Sensitive file or directory is publicly accessible.",
                    "Critical - Data breach, source code exposure",
                    f"Block access to {path} immediately.",
                    f"HTTP {response.status_code} - {path}",
                    "A01:2021-Broken Access Control", "CWE-552"
                )
        except Exception:
            pass


async def check_darkweb_exposure(target_url: str) -> Dict:
    """
    Check if domain appears in dark web intelligence
    Integrates with existing dark web scanning functionality
    """
    from search import get_search_results
    from llm import get_llm, filter_results
    
    parsed = urlparse(target_url)
    domain = parsed.hostname
    
    try:
        # Search dark web for domain mentions
        query = f'"{domain}"'
        search_results = get_search_results(query, max_workers=3)
        
        if search_results:
            llm = get_llm("gpt-4o-mini")
            filtered = filter_results(llm, f"security breaches OR data leaks related to {domain}", search_results)
            
            return {
                "exposed": len(filtered) > 0,
                "mentions": len(filtered),
                "results": filtered[:5],  # Top 5 results
                "risk_level": "high" if len(filtered) > 3 else "medium" if len(filtered) > 0 else "low"
            }
    except Exception as e:
        return {
            "exposed": False,
            "error": str(e)
        }
    
    return {"exposed": False, "mentions": 0}


def add_vuln(results: dict, severity: str, category: str, title: str, 
             description: str, impact: str, recommendation: str, 
             technical_details: str, owasp: str = None, cwe: str = None):
    """Add vulnerability to results"""
    results["vulnerabilities"].append({
        "severity": severity,
        "category": category,
        "title": title,
        "description": description,
        "impact": impact,
        "recommendation": recommendation,
        "technicalDetails": technical_details,
        "owasp": owasp,
        "cwe": cwe,
        "cvss": get_cvss(severity)
    })
    
    results["summary"][severity] += 1


def get_cvss(severity: str) -> str:
    """Get CVSS score range"""
    scores = {
        "critical": "9.0-10.0",
        "high": "7.0-8.9",
        "medium": "4.0-6.9",
        "low": "0.1-3.9",
        "info": "N/A"
    }
    return scores.get(severity, "N/A")


def calculate_security_score(results: dict) -> int:
    """Calculate overall security score"""
    weights = {"critical": 25, "high": 15, "medium": 8, "low": 3, "info": 0}
    deductions = sum(results["summary"][sev] * weight for sev, weight in weights.items())
    score = max(0, 100 - deductions)
    return round(score)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ZebraByte Vulnerability Scanner"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)