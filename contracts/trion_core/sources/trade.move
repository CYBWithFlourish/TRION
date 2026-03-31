/// trade.move
///
/// Atomic trade settlement for TRION.
///
/// `execute_item_trade` — swaps two `ItemVault`s containing real EVE Frontier Items.
///   This is the primary MVP path: player A's Item goes to player B, and vice versa.
///
/// `execute_coin_trade` — swaps two `CoinVault<T>`s (fungible tokens).
///   Kept for future liquidity / token-side settlement.
///
/// In both cases the matching engine (off-chain Fastify backend) has already
/// verified compatibility before building this transaction. The contracts only
/// enforce atomicity — no partial fills, no counterparty risk.
module trion_core::trade {
    use trion_core::vault::{Self, ItemVault, CoinVault};
    use world::storage_unit::{Self, StorageUnit};
    use world::character::Character;
    use trion_core::config::{Self, XAuth};

    /// Atomically swap two `ItemVault`s.
    ///
    /// Flow:
    ///   1. Extract Item + owner from each vault (vaults destroyed).
    ///   2. Deposit item_a into storage_unit on behalf of owner_b (they receive it).
    ///   3. Deposit item_b into storage_unit on behalf of owner_a (they receive it).
    ///
    /// Both items must have originated from `storage_unit` (enforced by
    /// `storage_unit::deposit_item` checking `item.parent_id == storage_unit_id`).
    public fun execute_item_trade(
        vault_a: ItemVault,
        vault_b: ItemVault,
        su: &mut StorageUnit,
        character_a: &Character,
        character_b: &Character,
        ctx: &mut TxContext,
    ) {
        let (owner_a, item_a) = vault::extract_item_from_vault(vault_a);
        let (owner_b, item_b) = vault::extract_item_from_vault(vault_b);

        // owner_a deposited item_a → it now goes to owner_b's ephemeral slot
        // owner_b deposited item_b → it now goes to owner_a's ephemeral slot
        // deposit_to_owned pushes an item into a player's owned inventory slot
        // without requiring them to be the tx sender — perfect for atomic settlement.
        storage_unit::deposit_to_owned<XAuth>(
            su,
            character_b,   // recipient of item_a
            item_a,
            config::x_auth(),
            ctx,
        );

        storage_unit::deposit_to_owned<XAuth>(
            su,
            character_a,   // recipient of item_b
            item_b,
            config::x_auth(),
            ctx,
        );

        // Suppress unused variable warnings
        let _ = owner_a;
        let _ = owner_b;
    }

    /// Atomically swap two `CoinVault<A>` and `CoinVault<B>`.
    /// Used for future token-side settlement (liquidity engine).
    public fun execute_coin_trade<A, B>(
        vault_a: CoinVault<A>,
        vault_b: CoinVault<B>,
        ctx: &mut TxContext,
    ) {
        let (owner_a, coin_a) = vault::extract_coin_from_vault(vault_a, ctx);
        let (owner_b, coin_b) = vault::extract_coin_from_vault(vault_b, ctx);

        transfer::public_transfer(coin_b, owner_a);
        transfer::public_transfer(coin_a, owner_b);
    }
}