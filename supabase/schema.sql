-- ============================================================
-- TRION Protocol - Supabase Schema
-- Drop old tables first if migrating from string-based schema
-- ============================================================

drop table if exists trades cascade;
drop table if exists listings cascade;
drop table if exists item_types cascade;

-- ============================================================
-- item_types: registry of known EVE Frontier item type_ids
-- type_id is the u64 from the on-chain Item struct
-- Look up real IDs from:
-- https://world-api-utopia.uat.pub.evefrontier.com/docs/index.html
-- ============================================================
create table item_types (
    type_id         bigint primary key,       -- on-chain u64 type_id
    name            text not null,            -- human readable e.g. "Fuel Block"
    category        text not null,            -- "fuel" | "weapon" | "component" | "material" | "other"
    base_value      integer not null default 1, -- base value per unit for matching engine
    description     text
);

-- Seed with known Utopia item types
-- ⚠️  REPLACE type_ids with real ones from the World API
-- These are placeholder IDs until you query the Utopia API
insert into item_types (type_id, name, category, base_value, description) values
    (78516, 'EU-40 Fuel',          'fuel',      10,  'Standard crude fuel for engines'),
    (78515, 'SOF-80 Fuel',         'fuel',      15,  'High-grade crude fuel'),
    (78437, 'EU-90 Fuel',          'fuel',      20,  'Premium crude fuel'),
    (88335, 'D1 Fuel',             'fuel',      5,   'Hydrogen-based entry-level fuel'),
    (81972, 'Base Coilgun (S)',    'weapon',    25,  'Small mass driver weapon'),
    (81974, 'Base Autocannon (S)', 'weapon',    25,  'Small projectile weapon'),
    (82032, 'Base Rapid Plasma (S)','weapon',   30,  'Small plasma weapon'),
    (78416, 'Apocalypse Frame',    'component', 100, 'Heavy exotronic protocol frame'),
    (83818, 'Fossilized Exotronics','component', 50,  'Reclaimable exotronic debris'),
    (89087, 'Synod Technocore',    'component', 120, 'Advanced manufacturing core'),
    (77801, 'Nickel-Iron Veins',   'material',  5,   'Refined metallic mineral'),
    (77803, 'Silicon Dust',        'material',  5,   'Refined non-metal mineral'),
    (84180, 'Printed Circuits',    'material',  10,  'Basic electronics substrate'),
    (84182, 'Reinforced Alloys',   'material',  15,  'Durable structural alloy');

-- ============================================================
-- listings: trade intents posted by players
-- ============================================================
create table listings (
    id                  uuid primary key default gen_random_uuid(),
    owner_wallet        text not null,             -- Sui wallet address

    -- What the player is offering
    have_type_id        bigint not null,
    have_qty            integer not null check (have_qty > 0),

    -- What the player wants in return
    want_type_id        bigint not null,
    want_qty            integer not null check (want_qty > 0),

    constraint listings_have_type_id_fkey foreign key (have_type_id) references item_types(type_id),
    constraint listings_want_type_id_fkey foreign key (want_type_id) references item_types(type_id),

    -- Computed value score for matching (have_type base_value * have_qty)
    value_score         integer not null default 0,

    -- On-chain SSU vault object ID where assets are escrowed
    ssu_object_id       text,                      -- the SSU StorageUnit object ID on Sui

    -- On-chain tx digest when intent was registered
    intent_tx_digest    text,

    status              text not null default 'open'
                            check (status in ('open', 'matched', 'completed', 'cancelled')),

    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

-- Index for the matching engine's core query pattern
-- find listings where have_type_id = our want, want_type_id = our have
create index idx_listings_matching on listings (status, have_type_id, want_type_id);
create index idx_listings_owner    on listings (owner_wallet);

-- ============================================================
-- trades: completed swap records
-- ============================================================
create table trades (
    id                      uuid primary key default gen_random_uuid(),
    listing_id              uuid not null references listings(id),
    matched_listing_id      uuid not null references listings(id),

    -- On-chain execution details
    tx_digest               text not null,         -- Sui transaction digest
    status                  text not null default 'executed'
                                check (status in ('executed', 'failed')),

    -- Snapshot of what was swapped (denormalized for history)
    initiator_wallet        text,
    counterparty_wallet     text,
    have_type_id            bigint,
    have_qty                integer,
    want_type_id            bigint,
    want_qty                integer,

    constraint trades_have_type_id_fkey foreign key (have_type_id) references item_types(type_id),
    constraint trades_want_type_id_fkey foreign key (want_type_id) references item_types(type_id),

    executed_at             timestamptz not null default now()
);

create index idx_trades_listing   on trades (listing_id);
create index idx_trades_digest    on trades (tx_digest);

-- ============================================================
-- Auto-update updated_at on listings
-- ============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger listings_updated_at
    before update on listings
    for each row execute function update_updated_at();