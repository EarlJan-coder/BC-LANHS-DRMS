import { readFile } from "fs/promises";
import { createRequire } from "node:module";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

async function main() {
  const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    throw new Error("Set BLOCKCHAIN_RPC_URL and BLOCKCHAIN_PRIVATE_KEY before deploying.");
  }

  const artifactPath = "artifacts/contracts/DocumentRequestAudit.sol/DocumentRequestAudit.json";
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  console.log(`DocumentRequestAudit deployed to ${await contract.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
