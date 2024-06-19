import { ethers } from "ethers";
import hre from "hardhat";
import { pbkdf2Sync } from "pbkdf2"

const { secp256r1 } = require('@noble/curves/p256');
const curve_utils = require('@noble/curves/abstract/utils');
const abiCoder = ethers.AbiCoder.defaultAbiCoder();

async function main() {

  const GAS_LIMIT = 1000000;

  const signer = (await hre.ethers.getSigners())[0];
  const contract = await hre.ethers.getContractAt('AccountManager', '0xF35C3eB93c6D3764A7D5efC6e9DEB614779437b1', signer);

  const gasPrice = (await signer.provider.getFeeData()).gasPrice;
  const gasPayingAddress = await contract.gaspayingAddress();
  console.log(gasPayingAddress);
  const nonce = await signer.provider.getTransactionCount(gasPayingAddress);

  console.log(gasPrice);
  console.log(nonce);

  const saltOrig = await contract.salt();
  const salt = ethers.toBeArray(saltOrig);

  const SIMPLE_PASSWORD = "0x0000000000000000000000000000000000000000000000000000000000000001";

  const keyPair = generateNewKeypair();

  const username = await hashedUsername("mkkalmia", salt);
  let registerData = {
    hashedUsername: username,
    credentialId: keyPair.credentialId,
    pubkey: {
      kty: 2, // Elliptic Curve format
      alg: -7, // ES256 algorithm
      crv: 1, // P-256 curve
      x: keyPair.decoded_x,
      y: keyPair.decoded_y,
    },
    optionalPassword: SIMPLE_PASSWORD
  };

  let funcData = abiCoder.encode(
    [ "tuple(bytes32 hashedUsername, bytes credentialId, tuple(uint8 kty, int8 alg, uint8 crv, uint256 x, uint256 y) pubkey, bytes32 optionalPassword)" ], 
    [ registerData ]
  ); 

  let gaslessData = abiCoder.encode(
    [ "tuple(bytes funcData, uint8 txType)" ], 
    [ 
      {
        funcData,
        txType: 0, // GASLESS_TYPE_CREATE_ACCOUNT
      } 
    ]
  ); 

  const timestamp = Math.ceil(new Date().getTime() / 1000) + 3600;
  const dataHash = ethers.solidityPackedKeccak256(
    ['uint256', 'uint64', 'uint256', 'bytes32'],
    [gasPrice, GAS_LIMIT, timestamp, ethers.keccak256(gaslessData)],
  );
  const signature = await signer.signMessage(ethers.getBytes(dataHash));

  console.log("dataHash:");
  console.log(dataHash);
  console.log("-----------------");
  console.log(signature);

  const signedTx = await contract.generateGaslessTx(
    gaslessData,
    nonce,
    gasPrice,
    GAS_LIMIT,
    timestamp,
    signature
  );

  console.log(signedTx);

  const txHash = await hre.ethers.provider.send('eth_sendRawTransaction', [signedTx]) as string;
  console.log(txHash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


async function hashedUsername (username, salt) {
  if( ! username ) {
      throw new Error('Cannot hash undefined username!');
  }
  const result = pbkdf2Sync(username, salt, 100_000, 32, 'sha256');
  return result;
}

function generateNewKeypair() {
  const privateKey = secp256r1.utils.randomPrivateKey();
  const pubKey = secp256r1.getPublicKey(privateKey, false);
  const pubKeyString = "0x" + curve_utils.bytesToHex(pubKey);
  const credentialId = abiCoder.encode([ "string" ], [ pubKeyString ]);

  const coordsString = pubKeyString.slice(4, pubKeyString.length); // removes 0x04
  const decoded_x = BigInt('0x' + coordsString.slice(0, 64)); // x is the first half
  const decoded_y = BigInt('0x' + coordsString.slice(64, coordsString.length)); // y is the second half

  return {
    credentialId,
    privateKey,
    decoded_x,
    decoded_y,
  }
}