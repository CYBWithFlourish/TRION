#[test_only]
module trion_core::trion_core_tests;

use sui::coin;
use sui::sui::SUI;
use trion_core::ssu_extension;
use trion_core::trade;
use trion_core::vault;

#[test]
fun test_vault_create_and_release_smoke() {
    let mut ctx = tx_context::dummy();

    let coin = coin::zero<SUI>(&mut ctx);
    let vault_obj = vault::create_vault(coin, &mut ctx);
    vault::release_vault(vault_obj, &mut ctx);
}

#[test]
fun test_trade_execute_smoke() {
    let mut ctx = tx_context::dummy();

    let coin_a = coin::zero<SUI>(&mut ctx);
    let coin_b = coin::zero<SUI>(&mut ctx);
    let vault_a = vault::create_vault(coin_a, &mut ctx);
    let vault_b = vault::create_vault(coin_b, &mut ctx);

    trade::execute_trade(vault_a, vault_b, &mut ctx);
}

#[test]
fun test_register_intent_returns_object() {
    let mut ctx = tx_context::dummy();

    let intent = ssu_extension::register_intent(
        78516,
        10,
        81972,
        20,
        &mut ctx,
    );

    transfer::public_transfer(intent, tx_context::sender(&ctx));
}