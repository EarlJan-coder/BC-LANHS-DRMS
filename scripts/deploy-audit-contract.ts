import { readFile } from "fs/promises";
import { createRequire } from "node:module";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

async function main() {
  const networkArgIndex = process.argv.indexOf("--network");
  const cliNetwork = networkArgIndex !== -1 ? process.argv[networkArgIndex + 1] : undefined;
  const isSepolia = cliNetwork === "sepolia" || process.env.BLOCKCHAIN_NETWORK === "sepolia";

  const rawRpcUrl = isSepolia
    ? (process.env.SEPOLIA_RPC_URL ?? process.env.BLOCKCHAIN_RPC_URL)
    : (process.env.BLOCKCHAIN_RPC_URL ?? process.env.SEPOLIA_RPC_URL);

  const rawPrivateKey = isSepolia
    ? (process.env.DEPLOYER_PRIVATE_KEY ?? process.env.BLOCKCHAIN_PRIVATE_KEY)
    : (process.env.BLOCKCHAIN_PRIVATE_KEY ?? process.env.DEPLOYER_PRIVATE_KEY);

  if (!rawRpcUrl || !rawPrivateKey) {
    throw new Error(
      `Missing RPC URL or Private Key for deployment.\n` +
      `Target network: ${isSepolia ? "sepolia" : (cliNetwork ?? "default")}\n` +
      `Please ensure ${isSepolia ? "SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY" : "BLOCKCHAIN_RPC_URL and BLOCKCHAIN_PRIVATE_KEY"} are configured.`
    );
  }

  const rpcUrl = rawRpcUrl;
  const privateKey = rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`;

  console.log(`Deploying to network: ${isSepolia ? "sepolia" : (cliNetwork ?? "default")}`);
  console.log(`RPC endpoint: ${rpcUrl.replace(/\/v2\/.*$/, "/v2/****")}`);

  const artifactPath = "artifacts/contracts/DocumentRequestAudit.sol/DocumentRequestAudit.json";
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);

  console.log(`Deployer address: ${wallet.address}`);
  const balance = await provider.getBalance(wallet.address);
  console.log(`Deployer balance: ${balance.toString()} wei`);

  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
  console.log("Sending deployment transaction...");
  const contract = await factory.deploy();
  console.log(`Transaction submitted. Waiting for confirmation...`);
  await contract.waitForDeployment();

  const deployedAddress = await contract.getAddress();
  console.log(`\nDocumentRequestAudit successfully deployed to: ${deployedAddress}`);
  console.log(`\nTo use this contract, update .env.local with:`);
  console.log(`CONTRACT_ADDRESS=${deployedAddress}`);
  console.log(`DOCUMENT_AUDIT_CONTRACT_ADDRESS=${deployedAddress}`);
  if (isSepolia) {
    console.log(`BLOCKCHAIN_NETWORK=sepolia`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
