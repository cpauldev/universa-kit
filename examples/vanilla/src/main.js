import { createDemoApi } from "demo/overlay";
import { phaseBadgeClass, transportBadgeClass } from "example-ui/bridge";
import "example-ui/styles.css";
import { applyTheme, getInitialTheme, toggleTheme } from "example-ui/theme";
import { Moon, Sun, createIcons } from "lucide";

// Initialize lucide icons
createIcons({
  icons: {
    Moon,
    Sun,
  },
});

// Theme
let currentTheme = getInitialTheme();
applyTheme(currentTheme);

const themeBtn = document.getElementById("theme-toggle");
const moonIcon = document.getElementById("moon-icon");
const sunIcon = document.getElementById("sun-icon");

function updateThemeIcon() {
  const isDark = currentTheme === "dark";
  moonIcon.style.display = isDark ? "none" : "";
  sunIcon.style.display = isDark ? "" : "none";
}

updateThemeIcon();
themeBtn.addEventListener("click", () => {
  currentTheme = toggleTheme(currentTheme);
  applyTheme(currentTheme);
  updateThemeIcon();
});

// Bridge state
const api = createDemoApi();
let actionLoading = null;

const transportBadgeEl = document.getElementById("transport-badge");
const phaseBadgeEl = document.getElementById("phase-badge");
const urlRow = document.getElementById("url-row");
const runtimeUrlEl = document.getElementById("runtime-url");
const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");
const btnStop = document.getElementById("btn-stop");

function updateButtons(phase) {
  const isTransitioning =
    actionLoading !== null || phase === "starting" || phase === "stopping";
  btnStart.disabled = isTransitioning || phase === "running";
  btnRestart.disabled =
    isTransitioning || phase === "stopped" || phase === "error" || !phase;
  btnStop.disabled =
    isTransitioning || phase === "stopped" || phase === "error" || !phase;
}

function renderBridge(state) {
  const phase = state?.runtime?.phase ?? null;
  const transport = state?.transportState ?? null;
  const url = state?.runtime?.url ?? null;

  transportBadgeEl.className = transportBadgeClass(transport);
  transportBadgeEl.textContent = transport ?? "—";

  phaseBadgeEl.className = phaseBadgeClass(phase);
  phaseBadgeEl.textContent = phase ?? "—";

  if (url) {
    urlRow.style.display = "";
    runtimeUrlEl.textContent = url;
  } else {
    urlRow.style.display = "none";
  }

  updateButtons(phase);
}

async function refresh() {
  try {
    renderBridge(await api.getBridgeState());
  } catch {
    /* ignore */
  }
}

refresh();
setInterval(refresh, 2000);

async function handleAction(action) {
  actionLoading = action;
  const labels = {
    start: "Starting\u2026",
    restart: "Restarting\u2026",
    stop: "Stopping\u2026",
  };
  const originals = { start: "Start", restart: "Restart", stop: "Stop" };
  const btn =
    action === "start" ? btnStart : action === "restart" ? btnRestart : btnStop;
  btn.textContent = labels[action];
  updateButtons(null);
  try {
    if (action === "start") await api.startRuntime();
    else if (action === "restart") await api.restartRuntime();
    else await api.stopRuntime();
    renderBridge(await api.getBridgeState());
  } catch {
    /* ignore */
  }
  btn.textContent = originals[action];
  actionLoading = null;
}

btnStart.addEventListener("click", () => handleAction("start"));
btnRestart.addEventListener("click", () => handleAction("restart"));
btnStop.addEventListener("click", () => handleAction("stop"));
