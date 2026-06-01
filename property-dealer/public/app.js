const form = document.querySelector("#campaignForm");
const runStatus = document.querySelector("#runStatus");
const serviceStatus = document.querySelector("#serviceStatus");
const summary = document.querySelector("#summary");
const resultsBody = document.querySelector("#resultsBody");
const submitButton = form.querySelector("button[type='submit']");

function statusClass(value) {
  return `status-${String(value || "skipped").replace(/[^a-z0-9-]/gi, "-")}`;
}

function setSummary(data) {
  const counts = data.counts || {};
  const metrics = [
    ["Contacts", data.totalContacts || 0],
    ["WhatsApp Sent", counts.whatsappSent || 0],
    ["Emails Sent", counts.emailSent || 0],
    ["Failed Rows", counts.failed || 0],
  ];

  summary.innerHTML = metrics
    .map(([label, value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`)
    .join("");
}

function renderRows(results) {
  if (!results || results.length === 0) {
    resultsBody.innerHTML = '<tr><td colspan="7" class="empty">No contacts found.</td></tr>';
    return;
  }

  resultsBody.innerHTML = results
    .map((item) => {
      const errors = item.errors && item.errors.length ? item.errors.join("; ") : "";
      return `
        <tr>
          <td>${item.rowNumber || ""}</td>
          <td>${item.name || ""}</td>
          <td>${item.phone || ""}</td>
          <td>${item.email || ""}</td>
          <td class="${statusClass(item.whatsapp)}">${item.whatsapp || "skipped"}</td>
          <td class="${statusClass(item.emailStatus)}">${item.emailStatus || "skipped"}</td>
          <td>${errors}</td>
        </tr>
      `;
    })
    .join("");
}

async function refreshHealth() {
  try {
    const response = await fetch("/api/health");
    const health = await response.json();
    const whatsapp = health.whatsapp.configured ? "WhatsApp ready to configure" : "WhatsApp token missing";
    const gmail = health.gmail.configured ? `Gmail set as ${health.gmail.user}` : "Gmail app password missing";
    serviceStatus.textContent = `${whatsapp}. ${gmail}.`;
  } catch {
    serviceStatus.textContent = "Service status unavailable.";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const dryRun = formData.get("dryRun") === "on";

  if (!dryRun) {
    const ok = window.confirm("This will send live WhatsApp messages and/or emails. Continue?");
    if (!ok) return;
  }

  submitButton.disabled = true;
  runStatus.textContent = dryRun ? "Running dry run..." : "Sending...";
  resultsBody.innerHTML = '<tr><td colspan="7" class="empty">Working...</td></tr>';

  try {
    const response = await fetch("/api/campaign", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "Campaign failed");

    runStatus.textContent = data.dryRun ? "Dry run complete" : "Campaign complete";
    setSummary(data);
    renderRows(data.results);
  } catch (error) {
    runStatus.textContent = "Run failed";
    resultsBody.innerHTML = `<tr><td colspan="7" class="empty">${error.message}</td></tr>`;
  } finally {
    submitButton.disabled = false;
  }
});

refreshHealth();
