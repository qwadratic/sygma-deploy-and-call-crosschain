# Sygma: cross-chain deployment and contract interaction

This project is created according [this guide](https://tim-hch.medium.com/how-to-deploy-unified-cross-chain-contract-addresses-from-single-source-blockchain-gas-using-the-08edf5e0ec17). Some minor things are outdated or not mentioned this guide, though. Below, I'll be mostly referencing the original guide with my additional thoughts throughout the process.

## Goal

* Perform a cross-chain deployment of a simple contract using `@chainsafe/hardhat-plugin-multichain-deploy` plugin.
* Perform a cross-chain invokation of the `setName` function in this contract, based on the [General Message Passing example](https://github.com/sygmaprotocol/sygma-sdk/blob/main/examples/evm-to-evm-generic-mesage-passing/src/transfer.ts).


## Prerequisites

* VSCode + its CLI code command for convenience
* node v20+
* npm v10+
* Metamask connected to Sepolia and Holesky with ETH tokens on least on one of the networks.

To get testnet tokens use on of the faucets below:
* [Alchemy Faucet](https://www.alchemy.com/faucets/ethereum-sepolia)
* [Google Faucet](https://cloud.google.com/application/web3/faucet/ethereum)

## Project Setup

Set up you project as per original guide.

```shell
mkdir hh-multichain                           
cd hh-multichain
npm init

npm install --save-dev hardhat
npx hardhat init
```

Follow default prompt steps and then install dependencies. 

```shell
npm install --save-dev @nomicfoundation/hardhat-toolbox @chainsafe/hardhat-ts-artifact-plugin @nomicfoundation/hardhat-web3-v4 @chainsafe/hardhat-plugin-multichain-deploy @buildwithsygma/sygma-sdk-core@2.8.0 dotenv
```

Make sure that `@buildwithsygma/sygma-sdk-core` is of `2.8.0` version. Myself experienced issues with `2.11.0`, so lets stick to `2.8.0` that was the latest one at the time of the original guide creation.

Let’s now open our project in VSCode:

```shell
code .
```

## Modify Lock.sol

To demonstrate cross-chain message passing, let’s modify `Lock.sol` a bit. Make the same changes as per original guide.

We aim to invoke `setName` in the second part of this tutorial. So let’s comment this line from the `setName` function in order to be able to modify the name of our contract in future:

```js
// if (bytes(name).length > 0) return;
```

## Configure hardhat environment

Modify `hardhat.config.js` as per the original guide. Note, that solidity version may be newer in your case. You may want to keep it as it is or downgrade depending on your project needs.

## Create deploy script

Create `deployMultichain.js` deployment script as per the original guide.

You may notice that the scripts folder and default deployment script are not created. This is because the newer hardhat versions (after `2.22.1`) come with a Hardhat Ignition plugin which manages deployments.

In our case, to use `hardhat-plugin-multichain-deploy`, we will still need a separate deployment script, so let's create `scripts/deployMultichain.js` ourselves:

When copying JavaScript samples, beware of quote symbols that may be pasted incorrectly. Syntax highlighting will likely help you identify the quotes that you will need to change.

## Execute deployment

Make sure that you have either sepolia or holesky eth on your metamask.
If you don’t have testnet tokens, please refer to the Prerequisites section of this guide

Export your private key and create `.env` file as per original guide.

Now you’re ready to run

```shell
npx hardhat run scripts/deployMultichain.js --network sepolia
```

The output should look like following:

```
Compiled 1 Solidity file successfully (evm target: paris).
Generating typescript artifacts from contracts...
Created/updated artifacts/contracts/Lock.sol/Lock.ts
Deployer account: 0x7AD6532D4C9339C358A2532F703B60B4263a36b7
Unlock time: 1720443562
Sending transaction...
Multichain deployment initiated, transaction hash: 0x8f32b5d380746bd2d1706a54086de8234b23042c576b74d2b224c7e64280cc30
Destinaton networks:
 - sepolia
 - holesky
Contract deploying on HOLESKY: 0xaf81a55b29472089762AF5EbDBfC6D6E0B4Ff729
Contract deploying on SEPOLIA: 0xaf81a55b29472089762AF5EbDBfC6D6E0B4Ff729
Bridge transfer executed. More details: https://scan.test.buildwithsygma.com/transfer/0x8f32b5d380746bd2d1706a54086de8234b23042c576b74d2b224c7e64280cc30
```


## Perform a cross-chain call

Let’s use `sygma-sdk` to perform a cross-chain call to our newly deployed contract. In my case, I have gas on Sepolia and deployment on Holesky. I want to invoke a `setName` on my Holesky instance.

It's important to note that we need to explicitly install the same version of `ethers` as `sygma-sdk` uses. Otherwise you’ll run into bunch of errors. Let’s add a line to our package.json devDependencies section:

```
"ethers": "5.6.2"
```

and install dependencies again

```shell
npm i
```

Now we are going to write and run the script in our hardhat environment.
Let’s start with creating a `scripts/setNameCrossChain.js` script.

Inspiring by the original GMP example from the `sygma-sdk` repo, let’s write our own, within the hardhat environment:

```js
require('dotenv').config();
const {
  EVMGenericMessageTransfer,
  Environment,
  getTransferStatusData,
} = require("@buildwithsygma/sygma-sdk-core");
const { Wallet, Contract, providers, utils } = require("ethers");


const networkFrom = "sepolia"
const networkTo = "holesky"
const nameTo = "holesky-updated"

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
```

Lines 74 to 90 do the actual magic of constructing a payload with encoded call to the `setName` function.

Other pieces of logic are reading variables from `.env` file and some waiting logic for a succesfull bridge transfer.

To execute the script, populate your `.env` with `CONTRACT_ADDRESS` variable with your deployment address from the previous step and run the script with following command:

```bash
npx hardhat run scripts/setNameCrossChain.js
```

Your output should look like

```
Generating typescript artifacts from contracts...
Created/updated artifacts/contracts/Lock.sol/Lock.ts
Current value in Holesky contract: holesky
Sent transfer with hash:  0x1d1f42c90f579243bd73680a13809aeb9e74afe565b87a823123aea81583f75f
Waiting for relayers to bridge transaction...
transaction is taking too much time to bridge!
Current value in Holesky contract: holesky-updated
Status of the transfer pending
Status of the transfer pending
Status of the transfer executed
```


## Issues encountered when following the original guide

### Latest SDK cause problems

At the time of creation of the original guide, the latest SDK version was 2.8.0
Now its 2.11.0 and it cause problem on the very hardhat bootstrap. That's why I suggest to use 2.8.0 in this guide.

See logs below:

```
i@is-MacBook-Air hh-multichain % npx hardhat run scripts/deployMultichain.js --network sepolia
An unexpected error occurred:

Error: Cannot find module '../../config/config.js'
Require stack:
- /Users/i/sygma/hh-multichain/node_modules/@buildwithsygma/sygma-sdk-core/dist-cjs/chains/EVM/genericMessage.js
- /Users/i/sygma/hh-multichain/node_modules/@buildwithsygma/sygma-sdk-core/dist-cjs/chains/EVM/index.js
- /Users/i/sygma/hh-multichain/node_modules/@buildwithsygma/sygma-sdk-core/dist-cjs/chains/index.js
- /Users/i/sygma/hh-multichain/node_modules/@buildwithsygma/sygma-sdk-core/dist-cjs/index.js
- /Users/i/sygma/hh-multichain/node_modules/@chainsafe/hardhat-plugin-multichain-deploy/dist/src/index.js
- /Users/i/sygma/hh-multichain/hardhat.config.js
- /Users/i/sygma/hh-multichain/node_modules/hardhat/internal/core/config/config-loading.js
- /Users/i/sygma/hh-multichain/node_modules/hardhat/internal/cli/cli.js
- /Users/i/sygma/hh-multichain/node_modules/hardhat/internal/cli/bootstrap.js
    at Function.Module._resolveFilename (node:internal/modules/cjs/loader:1145:15)
    at Function.Module._load (node:internal/modules/cjs/loader:986:27)
    at Module.require (node:internal/modules/cjs/loader:1233:19)
    at require (node:internal/modules/helpers:179:18)
    at Object.<anonymous> (/Users/i/sygma/hh-multichain/node_modules/@buildwithsygma/sygma-sdk-core/src/chains/EVM/genericMessage.ts:8:1)
    at Module._compile (node:internal/modules/cjs/loader:1358:14)
    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1416:10)
    at Module.load (node:internal/modules/cjs/loader:1208:32)
    at Function.Module._load (node:internal/modules/cjs/loader:1024:12)
    at Module.require (node:internal/modules/cjs/loader:1233:19) {
  code: 'MODULE_NOT_FOUND',
  requireStack: [
    '/Users/i/sygma/hh-multichain/node_modules/@buildwithsygma/sygma-sdk-core/dist-cjs/chains/EVM/genericMessage.js',
    '/Users/i/sygma/hh-multichain/node_modules/@buildwithsygma/sygma-sdk-core/dist-cjs/chains/EVM/index.js',
    '/Users/i/sygma/hh-multichain/node_modules/@buildwithsygma/sygma-sdk-core/dist-cjs/chains/index.js',
    '/Users/i/sygma/hh-multichain/node_modules/@buildwithsygma/sygma-sdk-core/dist-cjs/index.js',
    '/Users/i/sygma/hh-multichain/node_modules/@chainsafe/hardhat-plugin-multichain-deploy/dist/src/index.js',
    '/Users/i/sygma/hh-multichain/hardhat.config.js',
    '/Users/i/sygma/hh-multichain/node_modules/hardhat/internal/core/config/config-loading.js',
    '/Users/i/sygma/hh-multichain/node_modules/hardhat/internal/cli/cli.js',
    '/Users/i/sygma/hh-multichain/node_modules/hardhat/internal/cli/bootstrap.js'
  ]
}
```

### A few minor issues and suggestions

* The original guide has minor indentation issues in code snippets
* I suggest to investigate how to use multichain-deploy with Hardhat Ignition, because in the latest versions they include ignition plugin **by default**. It allows to write deploy scenarios in declarative fashion and then run a simple command to execute these so-called ignition modules.

### General Message Passing

Both my `setNameCrossChain.js` script and the `transfer.ts` script from SDK examples repo work well, and produce similar transactions on the destination chain. [See example transaction](https://holesky.etherscan.io/tx/0xdac97dc1f5b57d8b86162df53fa4da4714247bc42526f4258c480e0f1d446183/advanced#internal)

You may notice that the actual `setName` call fails.
However, the method works ok if you invoke it [with etherscan UI here](https://holesky.etherscan.io/address/0xaf81a55b29472089762af5ebdbfc6d6e0b4ff729#writeContract)

