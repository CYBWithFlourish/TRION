#[allow(lint(self_transfer))]
module trion_core::ssu_extension {
    use sui::event;
    use trion_core::config::{Self, XAuth};
    use world::storage_unit::{Self, StorageUnit};
    use world::character::Character;
    use world::inventory::Item;

    /// Intent record for SSU extension matching
    public struct TradeIntent has key, store {
        id: UID,
        owner: address,
        have_type_id: u64,
        have_qty: u64,
        want_type_id: u64,
        want_qty: u64,
    }

    /// Event emitted when an intent is registered
    public struct IntentRegistered has copy, drop {
        intent_id: address,
        owner: address,
        have_type_id: u64,
        have_qty: u64,
        want_type_id: u64,
        want_qty: u64,
    }

    /// Register a trade intent to the Trion SSU network
    public fun register_intent(
        have_type_id: u64,
        have_qty: u64,
        want_type_id: u64,
        want_qty: u64,
        ctx: &mut TxContext
    ): TradeIntent {
        let sender = tx_context::sender(ctx);
        let id_obj = object::new(ctx);
        let intent_id = object::uid_to_address(&id_obj);

        let intent = TradeIntent {
            id: id_obj,
            owner: sender,
            have_type_id,
            have_qty,
            want_type_id,
            want_qty,
        };

        event::emit(IntentRegistered {
            intent_id,
            owner: sender,
            have_type_id,
            have_qty,
            want_type_id,
            want_qty,
        });

        intent
    }

    /// Deposit a real EVE Frontier Item into an SSU using Trion's auth witness
    public fun deposit_to_trion_ssu(
        storage_unit: &mut StorageUnit,
        character: &Character,
        item: Item,
        ctx: &mut TxContext,
    ) {
        storage_unit::deposit_item<XAuth>(
            storage_unit,
            character,
            item,
            config::x_auth(),
            ctx
        );
    }
}