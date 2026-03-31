/// vault.move
///
/// Two vault types:
///   - `ItemVault`  holds a real EVE Frontier `world::inventory::Item` (non-fungible, in-transit).
///   - `CoinVault`  holds a `sui::coin::Coin<T>` (fungible, for future token trades).
///
/// Both expose a `public(package) fun extract_*` used by `trade.move` for atomic swaps.
module trion_core::vault {
    use sui::balance::Balance;
    use sui::coin::{Self, Coin};
    use world::inventory::Item;

    //  Item Vault
    /// Holds a real EVE Frontier `Item` in transit between two players.
    /// Created when a player commits their item to a pending trade.
    /// Destroyed atomically during `trade::execute_item_trade`.
    public struct ItemVault has key, store {
        id: UID,
        /// Address that deposited the item — receives the counterparty item on settlement.
        owner: address,
        /// The actual in-transit EVE Frontier Item object.
        item: Item,
    }

    /// Lock an `Item` into a vault for trade settlement.
    public fun create_item_vault(
        item: Item,
        ctx: &mut TxContext,
    ): ItemVault {
        ItemVault {
            id: object::new(ctx),
            owner: ctx.sender(),
            item,
        }
    }

    /// Owner reclaims their item if the trade is cancelled or never matched.
    public fun release_item_vault(vault: ItemVault, ctx: &mut TxContext): Item {
        let ItemVault { id, owner, item } = vault;
        assert!(owner == ctx.sender(), 0); // ENotOwner
        id.delete();
        item
    }

    /// Internal: extract the item and destroy the vault. Called by `trade.move` only.
    public(package) fun extract_item_from_vault(vault: ItemVault): (address, Item) {
        let ItemVault { id, owner, item } = vault;
        id.delete();
        (owner, item)
    }

    // Coin Vault
    /// Holds a fungible `Coin<T>` for token-side trades (future liquidity engine).
    public struct CoinVault<phantom T> has key, store {
        id: UID,
        owner: address,
        item: Balance<T>,
    }

    /// Lock a `Coin<T>` into a vault.
    public fun create_coin_vault<T>(
        item: Coin<T>,
        ctx: &mut TxContext,
    ): CoinVault<T> {
        CoinVault {
            id: object::new(ctx),
            owner: ctx.sender(),
            item: coin::into_balance(item),
        }
    }

    /// Owner reclaims their coin.
    public fun release_coin_vault<T>(vault: CoinVault<T>, ctx: &mut TxContext) {
        let CoinVault { id, owner, item } = vault;
        assert!(owner == ctx.sender(), 0); // ENotOwner
        id.delete();
        transfer::public_transfer(coin::from_balance(item, ctx), owner);
    }

    /// Internal: extract coin and destroy vault. Called by `trade.move` only.
    public(package) fun extract_coin_from_vault<T>(vault: CoinVault<T>, ctx: &mut TxContext): (address, Coin<T>) {
        let CoinVault { id, owner, item } = vault;
        id.delete();
        (owner, coin::from_balance(item, ctx))
    }
}