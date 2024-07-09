const { multichain, web3 } = require("hardhat");

async function main() {
  const currentTimestampInSeconds = Math.round(Date.now() / 1000);
  const unlockTime = BigInt(currentTimestampInSeconds + 600);
  const deployerAccounts = await web3.eth.getAccounts();
  const deployer = deployerAccounts[0];

  console.log("Deployer account:", deployer);
  console.log("Unlock time:", unlockTime.toString());


  const networkArguments = {
    sepolia: {
      args: [deployer, unlockTime],
      initData: {
        initMethodName: "setName",
        initMethodArgs: ["sepolia"],
      },
    },
    holesky: {
      args: [deployer, unlockTime],
      initData: {
        initMethodName: "setName",
        initMethodArgs: ["holesky"],
      },
    },
  };

  const deploymentResult = await multichain.deployMultichain("Lock", networkArguments);
  
  if (deploymentResult) {
    const { transactionHash, domainIDs } = deploymentResult;
    await multichain.getDeploymentInfo(transactionHash, domainIDs);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
