require('dotenv').config();
const {
  EVMGenericMessageTransfer,
  Environment,
  getTransferStatusData,
} = require("@buildwithsygma/sygma-sdk-core");
const { Wallet, Contract, providers, utils } = require("ethers");


const networkFrom = "sepolia"
const networkTo = "holesky"
const nameTo = "holesky-updated123"

const privateKey = process.env.PK;
const RESOURCE_ID = process.env.RESOURCE_ID ||
  "0x0000000000000000000000000000000000000000000000000000000000000600";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const MAX_FEE = "3000000";

if (!privateKey) {
  throw new Error("Missing environment variable: PRIVATE_KEY");
}

const sourceProvider = new providers.JsonRpcProvider(hre.config.networks[networkFrom].url);
const destinationProvider = new providers.JsonRpcProvider(hre.config.networks[networkTo].url);
const wallet = new Wallet(privateKey, sourceProvider);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getStatus(txHash) {
  const data = await getTransferStatusData(Environment.TESTNET, txHash);
  return data;
};

async function waitUntilBridged(
  valueBefore,
  contract,
  intervalDuration = 15000,
  attempts = 16
) {
  let i = 0;
  let contractValueAfter;
  for (;;) {
    await sleep(intervalDuration);
    contractValueAfter = await contract.name();
    if (!contractValueAfter === valueBefore) {
      console.log("Transaction successfully bridged.");
      console.log("Value after update:", contractValueAfter);
      break;
    }
    i++;
    if (i > attempts) {
      // transaction should have been bridged already
      console.log("transaction is taking too much time to bridge!");
      break;
    }
  }
};

async function main() {
  const artifact = await hre.artifacts.readArtifact("Lock");
  const lockDest = new Contract(CONTRACT_ADDRESS, artifact.abi, destinationProvider);
  const contractValueBefore = await lockDest.name();
  console.log(`Current value in ${networkTo} contract:`, contractValueBefore);

  const messageTransfer = new EVMGenericMessageTransfer();
  await messageTransfer.init(sourceProvider, Environment.TESTNET);

  const EXECUTION_DATA = utils.defaultAbiCoder.encode(["string"], [nameTo]);
  const selector = lockDest.interface.getSighash('setName')

  console.log(EXECUTION_DATA, utils.keccak256(EXECUTION_DATA))

  const transfer = messageTransfer.createGenericMessageTransfer(
    await wallet.getAddress(),
    hre.config.networks[networkTo].chainId,
    RESOURCE_ID,
    CONTRACT_ADDRESS,
    selector,
    EXECUTION_DATA,
    MAX_FEE
  );
  
  const fee = await messageTransfer.getFee(transfer);
  const transferTx = await messageTransfer.buildTransferTransaction(
    transfer,
    fee
  );
  
  const response = await wallet.sendTransaction(transferTx);
  console.log("Sent transfer with hash: ", response.hash);
  console.log("Waiting for relayers to bridge transaction...");

  await waitUntilBridged(contractValueBefore, lockDest);

  const id = setInterval(() => {
    getStatus(response.hash)
      .then((data) => {
        if (data[0]) {
          console.log("Status of the transfer", data[0].status);
          if(data[0].status == "executed") {
            clearInterval(id);
            process.exit(0);
          }
        } else {
          console.log("Waiting for the TX to be indexed");
        }
      })
      .catch((e) => {
        console.log("error:", e);
      });
  }, 15000);

  console.log(`Current value in ${networkTo} contract:`, await lockDest.name());
}


main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
