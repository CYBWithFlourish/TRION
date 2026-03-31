/// ssu_extension.move
///
/// TRION's SSU extension — the bridge between EVE Frontier's world contracts and
/// the TRION matching/trade engine.
///
/// ## Extension Auth
/// `XAuth` (from config.move) is registered as the authorized extension witness
/// on the `StorageUnit`. The SSU owner must call:
///   `storage_unit::authorize_extension<XAuth>(ssu, &owner_cap)`
/// once after deploying TRION. After that, all TRION deposit/withdraw calls
/// are gated by this witness.
///
/// ## Trade Flow (per player)
///
///   1. Player calls `register_intent(...)` — declares what they have/want.
///      - Intent is transferred to player's address as an owned object.
///      - Backend listens to `IntentRegistered` event for matching.
///
///   2. (Off-chain) Backend matching engine finds a compatible pair.
///
///   3. Frontend builds a PTB:
///        a. `withdraw_to_vault(ssu, character, type_id, qty, ctx)`
///           → withdraws player's Item from SSU open inventory → wraps into `ItemVault`
///        b. Both players' ItemVaults are passed to `trade::execute_item_trade(...)`
///           → atomically deposits each item into the other player's owned slot.
///        c. `complete_intent(intent)` → marks the intent as consumed.
///
///   4. Player calls `cancel_intent(intent)` if they want to withdraw from matching.
///
/// ## Inventory Model
/// TRION uses the SSU's **open inventory** (`deposit_to_open_inventory` /
/// `withdraw_from_open_inventory`) as the neutral escrow zone that the extension
/// controls. Player-owned items waiting for a match sit in open storage.
/// Settled items land in each player's **owned inventory** slot via `deposit_to_owned`.
#[allow(lint(self_transfer))]
module trion_core::ssu_extension {
    use sui::event;
    use trion_core::config::{Self, XAuth};
    use trion_core::vault::{Self, ItemVault};
    use world::storage_unit::{Self, StorageUnit};
    use world::character::Character;
    use world::inventory::Item;

    // Errors
    const ENotIntentOwner: u64 = 0;
    const EIntentAlreadyFilled: u64 = 1;

    // Structs
    /// On-chain record of a player's trade intention.
    ///
    /// Transferred to the player's address as an owned object so only they can
    /// cancel or complete it. The backend matches by listening to `IntentRegistered`.
    public struct TradeIntent has key, store {
        id: UID,
        owner: address,
        /// `type_id` of the item the player is offering (numeric EVE item type).
        have_type_id: u64,
        have_qty: u32,
        /// `type_id` of the item the player wants in return.
        want_type_id: u64,
        want_qty: u32,
        /// Tracks whether this intent has been consumed by a trade settlement.
        filled: bool,
    }

    // Events
    public struct IntentRegistered has copy, drop {
        intent_id: address,
        owner: address,
        have_type_id: u64,
        have_qty: u32,
        want_type_id: u64,
        want_qty: u32,
    }

    public struct IntentCancelled has copy, drop {
        intent_id: address,
        owner: address,
    }

    public struct IntentFilled has copy, drop {
        intent_id: address,
        owner: address,
    }

    // Public Functions
    /// Register a trade intent.
    ///
    /// The intent object is transferred to the caller (owned object).
    /// Emits `IntentRegistered` for the backend matching engine to pick up.
    public fun register_intent(
        have_type_id: u64,
        have_qty: u32,
        want_type_id: u64,
        want_qty: u32,
        ctx: &mut TxContext,
    ) {
        let sender = ctx.sender();
        let id_obj = object::new(ctx);
        let intent_id = object::uid_to_address(&id_obj);

        event::emit(IntentRegistered {
            intent_id,
            owner: sender,
            have_type_id,
            have_qty,
            want_type_id,
            want_qty,
        });

        let intent = TradeIntent {
            id: id_obj,
            owner: sender,
            have_type_id,
            have_qty,
            want_type_id,
            want_qty,
            filled: false,
        };

        // Transfer to player as an owned object — they hold the handle.
        transfer::transfer(intent, sender);
    }

    /// Cancel a pending intent.
    ///
    /// Only the original owner can cancel. Destroys the intent and emits
    /// `IntentCancelled` so the backend can remove it from the matching pool.
    /// Note: does NOT withdraw the item from the SSU — the player must call
    /// `withdraw_from_open_inventory` separately if they already deposited.
    public fun cancel_intent(intent: TradeIntent, ctx: &mut TxContext) {
        assert!(intent.owner == ctx.sender(), ENotIntentOwner);
        let TradeIntent { id, owner, .. } = intent;
        let intent_id = object::uid_to_address(&id);
        id.delete();

        event::emit(IntentCancelled { intent_id, owner });
    }

    /// Mark an intent as filled (called as part of the settlement PTB).
    ///
    /// Only the intent owner can call this. Destroys the intent and emits
    /// `IntentFilled` for backend record-keeping.
    public fun complete_intent(intent: TradeIntent, ctx: &mut TxContext) {
        assert!(intent.owner == ctx.sender(), ENotIntentOwner);
        assert!(!intent.filled, EIntentAlreadyFilled);
        let TradeIntent { id, owner, .. } = intent;
        let intent_id = object::uid_to_address(&id);
        id.delete();

        event::emit(IntentFilled { intent_id, owner });
    }

    /// Deposit a player's item into the SSU **open inventory** (TRION-controlled escrow).
    ///
    /// The item must have already been withdrawn from the SSU by the player
    /// (creating an in-transit `Item`). After this call the item sits in open
    /// storage waiting for a match.
    ///
    /// Typically called in the same PTB as `register_intent`.
    public fun deposit_item_to_escrow(
        storage_unit: &mut StorageUnit,
        character: &Character,
        item: Item,
        ctx: &mut TxContext,
    ) {
        storage_unit::deposit_to_open_inventory<XAuth>(
            storage_unit,
            character,
            item,
            config::x_auth(),
            ctx,
        );
    }

    /// Withdraw a player's item from the SSU open inventory and wrap it into
    /// an `ItemVault` ready for atomic settlement.
    ///
    /// Called in the settlement PTB just before `trade::execute_item_trade`.
    public fun withdraw_to_vault(
        storage_unit: &mut StorageUnit,
        character: &Character,
        type_id: u64,
        quantity: u32,
        ctx: &mut TxContext,
    ): ItemVault {
        let item = storage_unit::withdraw_from_open_inventory<XAuth>(
            storage_unit,
            character,
            config::x_auth(),
            type_id,
            quantity,
            ctx,
        );
        vault::create_item_vault(item, ctx)
    }
}