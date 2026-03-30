module trion_core::config {
    use sui::dynamic_field as df;

    /// Shared configuration object for the Trion extension.
    public struct ExtensionConfig has key {
        id: UID,
    }

    /// Admin capability for managing Trion configuration.
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Witness type for authorizing actions in the EVE Frontier world.
    public struct XAuth has drop {}

    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap { id: object::new(ctx) };
        transfer::transfer(admin_cap, ctx.sender());

        let config = ExtensionConfig { id: object::new(ctx) };
        transfer::share_object(config);
    }

    // === Dynamic field helpers ===
    public fun has_rule<K: copy + drop + store>(config: &ExtensionConfig, key: K): bool {
        df::exists_(&config.id, key)
    }

    public fun borrow_rule<K: copy + drop + store, V: store>(config: &ExtensionConfig, key: K): &V {
        df::borrow(&config.id, key)
    }

    public fun borrow_rule_mut<K: copy + drop + store, V: store>(
        config: &mut ExtensionConfig,
        _: &AdminCap,
        key: K,
    ): &mut V {
        df::borrow_mut(&mut config.id, key)
    }

    public fun add_rule<K: copy + drop + store, V: store>(
        config: &mut ExtensionConfig,
        _: &AdminCap,
        key: K,
        value: V,
    ) {
        df::add(&mut config.id, key, value);
    }

    public fun set_rule<K: copy + drop + store, V: store + drop>(
        config: &mut ExtensionConfig,
        _: &AdminCap,
        key: K,
        value: V,
    ) {
        if (df::exists_(&config.id, copy key)) {
            let _old: V = df::remove(&mut config.id, copy key);
        };
        df::add(&mut config.id, key, value);
    }

    public fun remove_rule<K: copy + drop + store, V: store>(
        config: &mut ExtensionConfig,
        _: &AdminCap,
        key: K,
    ): V {
        df::remove(&mut config.id, key)
    }

    /// Get the XAuth witness. Internal to the package.
    public(package) fun x_auth(): XAuth {
        XAuth {}
    }
}