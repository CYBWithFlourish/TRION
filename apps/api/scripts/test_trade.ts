import { getFullnodeUrl, SuiClient } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import 'dotenv/config';

const walletAKeyStr = process.env.WALLET_A_KEY || '';
const walletBKeyStr = process.env.WALLET_B_KEY || '';
const packageId = process.env.TRION_CORE_PACKAGE_ID;

if (!walletAKeyStr || !walletBKeyStr || !packageId) {
    console.error("❌ Please set WALLET_A_KEY, WALLET_B_KEY, and TRION_CORE_PACKAGE_ID in your .env file!");
    process.exit(1);
}

// Decode standard `suiprivkey` strings
const { secretKey: secA } = decodeSuiPrivateKey(walletAKeyStr);
const keypairA = Ed25519Keypair.fromSecretKey(secA);

const { secretKey: secB } = decodeSuiPrivateKey(walletBKeyStr);
const keypairB = Ed25519Keypair.fromSecretKey(secB);

const client = new SuiClient({ url: getFullnodeUrl('devnet') });

async function runTest() {
    console.log(`Wallet A: ${keypairA.toSuiAddress()}`);
    console.log(`Wallet B: ${keypairB.toSuiAddress()}`);

    // ----- STEP 1: Player A locks 5 SUI into Vault A -----
    console.log("\n=> [Player A] Creating Vault A and sending it to Player B...");
    const txbA = new TransactionBlock();
    
    // Split 5 SUI from gas coin
    const [coinA] = txbA.splitCoins(txbA.gas, [txbA.pure.u64(5000000000)]);
    
    // Create Vault A
    const [vaultA] = txbA.moveCall({
        target: `${packageId}::vault::create_vault`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [coinA]
    });

    // Transfer Vault A to Player B so Player B has both vaults to execute the trade!
    // This allows a single transaction by B to consume both vaults.
    txbA.transferObjects([vaultA], txbA.pure(keypairB.toSuiAddress()));
    
    const resultA = await client.signAndExecuteTransactionBlock({
        signer: keypairA,
        transactionBlock: txbA,
        options: { showEffects: true }
    });
    console.log(`✅ Vault A created and sent! Digest: ${resultA.digest}`);

    // Extract the Vault A Object ID from the created objects
    const vaultAId = resultA.effects?.created?.find(obj => 
        obj.owner && 
        typeof obj.owner === 'object' && 
        'AddressOwner' in obj.owner && 
        obj.owner.AddressOwner === keypairB.toSuiAddress()
    )?.reference.objectId;
    
    if (!vaultAId) {
        throw new Error("Failed to find Vault A ID in transaction effects.");
    }
    console.log(`   Vault A Object ID: ${vaultAId}`);

    console.log("Waiting 3 seconds for network state sync...");
    await new Promise(r => setTimeout(r, 3000));

    // ----- STEP 2: Player B creates Vault B and Executes Trade in ONE transaction -----
    console.log("\n=> [Player B] Creating Vault B and Executing Trade with Vault A...");
    const txbB = new TransactionBlock();
    
    // Split 10 SUI from gas coin
    const [coinB] = txbB.splitCoins(txbB.gas, [txbB.pure.u64(10000000000)]);
    
    // Create Vault B
    const [vaultB] = txbB.moveCall({
        target: `${packageId}::vault::create_vault`,
        typeArguments: ['0x2::sui::SUI'],
        arguments: [coinB]
    });

    // Execute Trade combining Vault A (which B now owns thanks to step 1) and Vault B
    txbB.moveCall({
        target: `${packageId}::trade::execute_trade`,
        typeArguments: ['0x2::sui::SUI', '0x2::sui::SUI'],
        arguments: [
            txbB.object(vaultAId),
            vaultB // We pass the newly created Vault B directly as an argument
        ]
    });

    const resultB = await client.signAndExecuteTransactionBlock({
        signer: keypairB,
        transactionBlock: txbB,
        options: { showEffects: true }
    });
    console.log(`✅ Trade Executed by Player B! Digest: ${resultB.digest}`);
    console.log("\n🎉 The Escrow swap was successful! Check these digests on Suivision Explorer (Devnet) to trace the ownership back to original owners!");
}

runTest().catch(console.error);
