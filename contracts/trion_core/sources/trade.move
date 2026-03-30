module trion_core::trade {
    use trion_core::vault::{Self, Vault};

    /// Execute a direct 1:1 trade between two vaults containing coins of type A and B
    /// For the {MVP} we assume matching logic (amounts/values) has been verified off-chain 
    /// by the Matching Engine before forming this transaction, or we just swap the exact contents.
    public fun execute_trade<A, B>(
        vault_a: Vault<A>,
        vault_b: Vault<B>,
        ctx: &mut TxContext
    ) {
        let (owner_a, item_a) = vault::extract_item(vault_a, ctx);
        let (owner_b, item_b) = vault::extract_item(vault_b, ctx);

        // Swap transfers: A gets B, B gets A
        transfer::public_transfer(item_b, owner_a);
        transfer::public_transfer(item_a, owner_b);
    }
}