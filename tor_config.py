import os
import socket
from typing import Dict, Optional
from urllib.parse import quote


def get_tor_proxy_url() -> str:
    scheme = os.getenv("TOR_SOCKS_SCHEME", "socks5h")
    host = os.getenv("TOR_SOCKS_HOST", "127.0.0.1")
    port = os.getenv("TOR_SOCKS_PORT", "9050")
    username = os.getenv("TOR_SOCKS_USERNAME")
    password = os.getenv("TOR_SOCKS_PASSWORD")

    if username:
        auth = quote(username, safe="")
        if password:
            auth = f"{auth}:{quote(password, safe='')}"
        return f"{scheme}://{auth}@{host}:{port}"

    return f"{scheme}://{host}:{port}"


def get_tor_proxies() -> Dict[str, str]:
    proxy_url = get_tor_proxy_url()
    return {
        "http": proxy_url,
        "https": proxy_url,
    }


def tor_is_available(timeout: Optional[float] = None) -> bool:
    host = os.getenv("TOR_SOCKS_HOST", "127.0.0.1")
    port = int(os.getenv("TOR_SOCKS_PORT", "9050"))
    effective_timeout = timeout if timeout is not None else float(os.getenv("TOR_HEALTHCHECK_TIMEOUT", "1.5"))
    try:
        with socket.create_connection((host, port), timeout=effective_timeout):
            return True
        return False
    except OSError:
        return False
