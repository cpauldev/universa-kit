import { type BridgeSocketBridgeState, createDemoApi } from "demo/overlay";
import { phaseBadgeClass, transportBadgeClass } from "example-ui/bridge";
import {
  type Theme,
  applyTheme,
  getInitialTheme,
  toggleTheme,
} from "example-ui/theme";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { React as ReactIcon } from "./components/icons/React";

export default function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [bridge, setBridge] = useState<BridgeSocketBridgeState | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(getInitialTheme());
    const api = createDemoApi();
    const refresh = async () => {
      try {
        setBridge(await api.getBridgeState());
      } catch {
        /* ignore */
      }
    };
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, []);

  const handleAction = async (action: "start" | "restart" | "stop") => {
    const api = createDemoApi();
    setActionLoading(action);
    try {
      if (action === "start") await api.startRuntime();
      else if (action === "restart") await api.restartRuntime();
      else await api.stopRuntime();
      setBridge(await api.getBridgeState());
    } catch {
      /* ignore */
    }
    setActionLoading(null);
  };

  const phase = bridge?.runtime.phase ?? null;
  const transportState = bridge?.transportState ?? null;
  const url = bridge?.runtime.url ?? null;
  const isTransitioning =
    actionLoading !== null || phase === "starting" || phase === "stopping";

  const handleToggle = () => {
    const next = toggleTheme(theme);
    setTheme(next);
    applyTheme(next);
  };

  return (
    <div className="dp-page">
      <div className="dp-container">
        <header className="dp-header">
          <div className="dp-header-left">
            <h1>Demo</h1>
            <div className="dp-pill" style={{ backgroundColor: "#61DAFB" }}>
              <ReactIcon
                className="dp-pill-icon"
                style={{ color: "black" }}
                aria-hidden="true"
              />
              <p style={{ color: "black" }}>React + Vite</p>
            </div>
          </div>
        </header>

        <div className="dp-card">
          <div className="dp-card-header">
            <p className="dp-card-title">Bridge</p>
          </div>
          <div className="dp-card-content">
            <div className="dp-frame">
              <div className="dp-frame-body">
                <div className="dp-status-row">
                  <span className="dp-status-label">Transport</span>
                  <span className={transportBadgeClass(transportState)}>
                    {transportState ?? "—"}
                  </span>
                </div>
                <div className="dp-status-row">
                  <span className="dp-status-label">Runtime</span>
                  <span className={phaseBadgeClass(phase)}>{phase ?? "—"}</span>
                </div>
                {url && (
                  <div className="dp-status-row">
                    <span className="dp-status-label">URL</span>
                    <span className="dp-status-value">{url}</span>
                  </div>
                )}
              </div>
              <div className="dp-frame-footer">
                <button
                  className="dp-btn"
                  disabled={isTransitioning || phase === "running"}
                  onClick={() => handleAction("start")}
                >
                  {actionLoading === "start" ? "Starting…" : "Start"}
                </button>
                <button
                  className="dp-btn"
                  disabled={
                    isTransitioning ||
                    phase === "stopped" ||
                    phase === "error" ||
                    phase === null
                  }
                  onClick={() => handleAction("restart")}
                >
                  {actionLoading === "restart" ? "Restarting…" : "Restart"}
                </button>
                <button
                  className="dp-btn"
                  disabled={
                    isTransitioning ||
                    phase === "stopped" ||
                    phase === "error" ||
                    phase === null
                  }
                  onClick={() => handleAction("stop")}
                >
                  {actionLoading === "stop" ? "Stopping…" : "Stop"}
                </button>
              </div>
            </div>
          </div>
        </div>
        <button
          className="dp-icon-btn"
          onClick={handleToggle}
          aria-label="Toggle theme"
          style={{ alignSelf: "center" }}
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </div>
  );
}
