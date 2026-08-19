(async () => {
  const status = document.getElementById("service-status");
  if (!status) return;
  try {
    const response = await fetch("/api/health", { headers: { accept: "application/json" } });
    if (!response.ok) throw new Error("health");
    const payload = await response.json();
    status.textContent = payload.ok ? "Operational" : "Degraded";
    if (payload.ok) status.classList.add("ok");
  } catch { status.textContent = "Status unavailable"; }
})();
