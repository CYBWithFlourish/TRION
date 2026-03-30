module trion_core::vault {
    use sui::balance::Balance;
    use sui::coin::{Self, Coin};

    /// A generic vault that stores an asset (represented by a Coin for this MVP)
    public struct Vault<phantom T> has key, store {
        id: UID,
        owner: address,
        item: Balance<T>,
    }

    /// Lock an asset into the vault
    public fun create_vault<T>(
        item: Coin<T>, 
        ctx: &mut TxContext
    ): Vault<T> {
        let owner = tx_context::sender(ctx);
        Vault {
            id: object::new(ctx),
            owner,
            item: coin::into_balance(item),
        }
    }

    /// Withdraw from the vault back to the owner
    public fun release_vault<T>(vault: Vault<T>, ctx: &mut TxContext) {
        let Vault { id, owner, item } = vault;
        assert!(owner == tx_context::sender(ctx), 0); // Only owner can release
        object::delete(id);
        transfer::public_transfer(coin::from_balance(item, ctx), owner);
    }
    
    // Internal function to extract item and destroy vault (used by trade)
    public(package) fun extract_item<T>(vault: Vault<T>, ctx: &mut TxContext): (address, Coin<T>) {
        let Vault { id, owner, item } = vault;
        object::delete(id);
        (owner, coin::from_balance(item, ctx))
    }
}