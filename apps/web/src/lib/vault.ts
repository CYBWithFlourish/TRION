import { Transaction } from '@mysten/sui/transactions';
import { TRION_CORE_PACKAGE_ID } from './sui';

/**
 * Register a trade intent on-chain.
 * Stores the have/want type IDs and quantities in an SSU extension.
 */
export const registerIntentTx = (
    haveTypeId: number,
    haveQty: number,
    wantTypeId: number,
    wantQty: number
) => {
    const tx = new Transaction();

    tx.moveCall({
        target: `${TRION_CORE_PACKAGE_ID}::ssu_extension::register_intent`,
        arguments: [
            tx.pure.u64(haveTypeId),
            tx.pure.u64(haveQty),
            tx.pure.u64(wantTypeId),
            tx.pure.u64(wantQty)
        ]
    });

    return tx;
};

interface IntentWithDepositInput {
    haveTypeId: number;
    haveQty: number;
    wantTypeId: number;
    wantQty: number;
    storageUnitObjectId?: string;
    characterObjectId?: string;
    itemObjectId?: string;
}

/**
 * Build transaction that optionally deposits a real world Item into an SSU before registering intent.
 */
export const registerIntentWithOptionalDepositTx = ({
    haveTypeId,
    haveQty,
    wantTypeId,
    wantQty,
    storageUnitObjectId,
    characterObjectId,
    itemObjectId,
}: IntentWithDepositInput) => {
    const tx = new Transaction();

    if (storageUnitObjectId && characterObjectId && itemObjectId) {
        tx.moveCall({
            target: `${TRION_CORE_PACKAGE_ID}::ssu_extension::deposit_to_trion_ssu`,
            arguments: [
                tx.object(storageUnitObjectId),
                tx.object(characterObjectId),
                tx.object(itemObjectId),
            ],
        });
    }

    tx.moveCall({
        target: `${TRION_CORE_PACKAGE_ID}::ssu_extension::register_intent`,
        arguments: [
            tx.pure.u64(haveTypeId),
            tx.pure.u64(haveQty),
            tx.pure.u64(wantTypeId),
            tx.pure.u64(wantQty)
        ]
    });

    return tx;
};

/**
 * Execute a trade swap between two SSU vaults.
 */
export const executeTradeTx = (
    vaultAId: string,
    vaultBId: string,
    typeA: string,
    typeB: string
) => {
    const tx = new Transaction();

    tx.moveCall({
        target: `${TRION_CORE_PACKAGE_ID}::trade::execute_trade`,
        typeArguments: [typeA, typeB],
        arguments: [
            tx.object(vaultAId),
            tx.object(vaultBId)
        ]
    });

    return tx;
};