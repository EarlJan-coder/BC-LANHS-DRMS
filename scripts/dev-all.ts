import { spawn, execSync, type ChildProcess } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
const DEFAULT_HARDHAT_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY || DEFAULT_HARDHAT_KEY;
const isWin = process.platform === "win32";
const npxCmd = isWin ? "npx.cmd" : "npx";

let nodeProcess: ChildProcess | null = null;
let spawnedNodeHere = false;

function killProcessTree(pid: number) {
  try {
    if (isWin) {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(-pid, "SIGTERM");
    }
  } catch {
    // Process already exited
  }
}

async function isRpcReady(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "net_version", params: [], id: 1 }),
      signal: AbortSignal.timeout(1000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForRpc(url: string, maxRetries = 60, intervalMs = 500): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    if (await isRpcReady(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

async function updateEnvLocal(updates: Record<string, string>) {
  const envPath = join(process.cwd(), ".env.local");
  let content = "";
  try {
    content = await readFile(envPath, "utf8");
  } catch {
    content = "";
  }

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = (content.endsWith("\n") || content === "") ? `${content}${key}=${value}\n` : `${content}\n${key}=${value}\n`;
    }
  }

  await writeFile(envPath, content, "utf8");
}

async function deployContract(): Promise<string> {
  console.log("\n[dev:all] Compiling contracts...");
  execSync(`${npxCmd} hardhat compile`, { stdio: "inherit" });

  console.log("[dev:all] Deploying DocumentRequestAudit to local node...");
  const artifactPath = join(process.cwd(), "artifacts/contracts/DocumentRequestAudit.sol/DocumentRequestAudit.json");
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));

  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  return address;
}

function cleanup() {
  if (spawnedNodeHere && nodeProcess && nodeProcess.pid) {
    console.log("\n[dev:all] Stopping Hardhat node...");
    killProcessTree(nodeProcess.pid);
    nodeProcess = null;
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

process.on("exit", () => {
  cleanup();
});

async function main() {
  console.log("=================================================");
  console.log("  LANHS DRMS — All-in-One Development Runner");
  console.log("=================================================");

  const alreadyRunning = await isRpcReady(RPC_URL);

  if (alreadyRunning) {
    console.log(`[dev:all] Hardhat node already active at ${RPC_URL}`);
  } else {
    console.log(`[dev:all] Starting local Hardhat node...`);
    spawnedNodeHere = true;
    nodeProcess = spawn(npxCmd, ["hardhat", "node"], {
      shell: isWin,
      stdio: ["ignore", "pipe", "pipe"],
    });

    nodeProcess.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.includes("Started HTTP and WebSocket JSON-RPC server")) {
        console.log(`[dev:all] ${text.trim().split("\n")[0]}`);
      }
    });

    nodeProcess.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) {
        console.error(`[hardhat stderr] ${text}`);
      }
    });

    nodeProcess.on("error", (err) => {
      console.error("[dev:all] Failed to start Hardhat node:", err);
    });

    const ready = await waitForRpc(RPC_URL);
    if (!ready) {
      console.error("[dev:all] Timed out waiting for Hardhat node to start.");
      cleanup();
      process.exit(1);
    }
    console.log(`[dev:all] Hardhat node is ready on ${RPC_URL}`);
  }

  const contractAddress = await deployContract();
  console.log(`[dev:all] DocumentRequestAudit deployed to: ${contractAddress}`);

  console.log(`[dev:all] Updating .env.local with deployed contract address and RPC config...`);
  await updateEnvLocal({
    CONTRACT_ADDRESS: contractAddress,
    DOCUMENT_AUDIT_CONTRACT_ADDRESS: contractAddress,
    BLOCKCHAIN_RPC_URL: RPC_URL,
    BLOCKCHAIN_NETWORK: "hardhat",
    BLOCKCHAIN_PRIVATE_KEY: PRIVATE_KEY,
  });

  console.log("\n[dev:all] Starting Next.js development server...\n");

  const nextProcess = spawn(npxCmd, ["next", "dev"], {
    shell: isWin,
    stdio: "inherit",
    env: {
      ...process.env,
      CONTRACT_ADDRESS: contractAddress,
      DOCUMENT_AUDIT_CONTRACT_ADDRESS: contractAddress,
      BLOCKCHAIN_RPC_URL: RPC_URL,
      BLOCKCHAIN_NETWORK: "hardhat",
      BLOCKCHAIN_PRIVATE_KEY: PRIVATE_KEY,
    },
  });

  nextProcess.on("exit", (code) => {
    cleanup();
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("[dev:all] Error:", err);
  cleanup();
  process.exit(1);
});
