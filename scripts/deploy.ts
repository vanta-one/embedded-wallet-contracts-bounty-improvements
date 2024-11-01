import { ethers, upgrades } from "hardhat";
import { writeFileSync } from "fs";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    // Deploy EntryPoint
    console.log("\nDeploying EntryPoint...");
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();
    console.log("EntryPoint deployed to:", await entryPoint.getAddress());

    // Deploy PayMaster
    console.log("\nDeploying OasisPaymaster...");
    const OasisPaymaster = await ethers.getContractFactory("OasisPaymaster");
    const paymaster = await OasisPaymaster.deploy(await entryPoint.getAddress());
    await paymaster.waitForDeployment();
    console.log("OasisPaymaster deployed to:", await paymaster.getAddress());

    // Deploy SocialRecovery
    console.log("\nDeploying SocialRecovery...");
    const SocialRecovery = await ethers.getContractFactory("SocialRecovery");
    const socialRecovery = await SocialRecovery.deploy();
    await socialRecovery.waitForDeployment();
    console.log("SocialRecovery deployed to:", await socialRecovery.getAddress());

    // Deploy MultiWalletManager
    console.log("\nDeploying MultiWalletManager...");
    const MultiWalletManager = await ethers.getContractFactory("MultiWalletManager");
    const proxy = await upgrades.deployProxy(MultiWalletManager, [], {
        kind: 'uups',
        initializer: 'initialize'
    });
    await proxy.waitForDeployment();
    console.log("MultiWalletManager deployed to:", await proxy.getAddress());

    // Save deployment addresses
    const deploymentInfo = {
        network: network.name,
        entryPoint: await entryPoint.getAddress(),
        paymaster: await paymaster.getAddress(),
        socialRecovery: await socialRecovery.getAddress(),
        multiWalletManager: await proxy.getAddress(),
        timestamp: new Date().toISOString()
    };

    writeFileSync(
        `deployments/${network.name}.json`,
        JSON.stringify(deploymentInfo, null, 2)
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 