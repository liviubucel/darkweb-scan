(async () => {
  const status = document.getElementById("service-status");
  if (!status) return;
  try {
    const response = await fetch("/api/health", { headers: { accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error("health");
    const payload = await response.json();
    if (!payload.ok) {
      status.textContent = "Degraded";
      return;
    }
    if (payload.ready) {
      status.textContent = "Operational";
      status.classList.add("ok");
      return;
    }
    status.textContent = "Configuration pending";
  } catch {
    status.textContent = "Status unavailable";
  }
})();
