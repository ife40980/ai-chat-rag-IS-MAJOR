import { execSync } from "child_process";

const PORT = process.env.PORT || 3001;

function getListeningPids(port) {
  const pids = [];

  try {
    if (process.platform === "win32") {
      const output = execSync(`netstat -aon | findstr ":${port}"`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });

      for (const line of output.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(/\s+/);
        const state = parts[3];
        const pid = parts[4];
        if (state === "LISTENING" && pid) {
          pids.push(pid);
        }
      }
    } else {
      const output = execSync(`lsof -iTCP:${port} -sTCP:LISTEN -t`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });

      for (const line of output.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed) pids.push(trimmed);
      }
    }
  } catch {
    // No listening process found or command unavailable.
  }

  return [...new Set(pids)];
}

function killPid(pid) {
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F`, {
        stdio: ["ignore", "ignore", "ignore"],
      });
    } else {
      execSync(`kill -9 ${pid}`, {
        stdio: ["ignore", "ignore", "ignore"],
      });
    }
    console.log(`Stopped process ${pid} using port ${PORT}.`);
  } catch (error) {
    console.warn(`Unable to stop process ${pid} on port ${PORT}:`, error.message);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const pids = getListeningPids(PORT);

  if (pids.length > 0) {
    console.log(`Port ${PORT} is already in use by PID(s): ${pids.join(", ")}. Attempting to stop them...`);
    for (const pid of pids) {
      killPid(pid);
    }
    await wait(500);
  }

  console.log(`Starting backend on port ${PORT}...`);
  await import("./server.js");
}

main().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});