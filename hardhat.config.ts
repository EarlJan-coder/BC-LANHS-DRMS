import { defineConfig } from "hardhat/config";
import { createRequire } from "node:module";
import "@nomicfoundation/hardhat-ethers";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");

loadEnvConfig(process.cwd());

const networks = {
  hardhat: {
    type: "edr-simulated",
    chainType: "l1",
  },
  ...(process.env.SEPOLIA_RPC_URL
    ? {
        sepolia: {
          type: "http" as const,
          chainType: "l1" as const,
          url: process.env.SEPOLIA_RPC_URL,
          accounts: process.env.BLOCKCHAIN_PRIVATE_KEY ? [process.env.BLOCKCHAIN_PRIVATE_KEY] : [],
        },
      }
    : {}),
} as const;

export default defineConfig({
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks,
});
