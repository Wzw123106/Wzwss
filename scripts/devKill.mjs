import { execSync, spawn } from "node:child_process";

const PORTS = [5173, 5174];

function getPidsOnPort(port) {
  // Windows: netstat -ano | findstr ":5174"  -> last column PID
  const out = execSync(`netstat -ano | findstr :${port}`, { stdio: ["ignore", "pipe", "ignore"] }).toString();
  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.includes("LISTENING")) continue;
    const parts = trimmed.split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid)) pids.add(pid);
  }
  return [...pids];
}

function killPid(pid) {
  try {
    execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function safeKillPorts() {
  for (const port of PORTS) {
    let pids = [];
    try {
      pids = getPidsOnPort(port);
    } catch {
      // no match
      pids = [];
    }
    for (const pid of pids) {
      killPid(pid);
    }
  }
}

safeKillPorts();

const child = spawn("node", ["./scripts/dev.mjs"], { stdio: "inherit", shell: true });
child.on("exit", (code) => process.exit(code ?? 0));

