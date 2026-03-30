# TRION - Decentralized Item Trading Protocol on Sui

**TRION** is a protocol for peer-to-peer item trading in web3 games and metaverses built on the [Sui blockchain](https://sui.io). It enables players to discover match partners, negotiate trade terms, and execute trustless settlements directly from their wallets—all without relying on centralized intermediaries.

> Built on [EVE Frontier](https://evefrontier.com), utilizing Sui's Smart Objects and efficient state management.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Local Development](#local-development)
  - [Testnet Deployment](#testnet-deployment)
- [Development Workflow](#development-workflow)
- [API Reference](#api-reference)
- [Smart Contracts](#smart-contracts)
- [Contributing](#contributing)
- [Resources](#resources)
- [License](#license)

---

## Overview

TRION solves the core problem of item discovery and trustless settlement in decentralized environments. Instead of isolated inventory management, players can:

1. **List Intent** - Specify which items they want to trade away and what they're looking for
2. **Discover Matches** - Get matched with other players whose inventory and preferences align
3. **Execute Trades** - Complete settlements via smart contracts with cryptographic guarantees

The protocol is **non-custodial**: the blockchain enforces the trade logic, eliminating middlemen and enabling true peer-to-peer commerce.

---

## Key Features

- **Trustless Trading**: Smart contracts enforce atomic swaps with no counterparty risk
- **Auto-Discovery**: Backend matching engine finds compatible partners in real-time (reciprocal type-pair matching with value scoring)
- **Multi-Chain Native**: Built on Sui with support for Smart Objects and Dynamic Fields
- **Wallet Integrated**: Connect any Sui-compatible wallet; no separate account system
- **Extensible**: Support for custom item types, bundled trades, and future settlement models
- **Beginner Friendly**: Intuitive web UI with clear item metadata and validation

---

## Architecture

```
┌─────────────────────────────────────┐
│       Web Interface (Astro/React)   │
│  • Wallet Connection                │
│  • Inventory Discovery              │
│  • Trade Matching UI                │
│  • Settlement Status                │
└──────────────┬──────────────────────┘
               │
               │ HTTP REST API
               ▼
┌─────────────────────────────────────┐
│      Backend API (Fastify)          │
│  • Listing Management               │
│  • Match Engine                      │
│  • Trade Orchestration              │
│  • Blockchain Event Recording       │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
┌───────────────┐ ┌──────────────────┐
│ Sui Blockchain│ │  Supabase (DB)   │
│  Smart        │ │  • Listings      │
│  Contracts    │ │  • Matches       │
│  • Vaults     │ │  • Trade History │
│  • SSU Ext    │ └──────────────────┘
│  • Config     │
└───────────────┘
```

### Flow: Player Creates a Trade

```
1. Player connects wallet via Mysten modal
2. Frontend fetches inventory (world objects & items from Sui)
3. Player selects item to deposit + desired trade partners
4. Frontend creates transaction:
   - register_intent() event is emitted
   - item is prepared for deposit
5. Backend receives event, searches for matching intents
6. UI shows "Available matches"
7. Player picks best match and signs settlement transaction
8. execute_trade() swaps vaults atomically on-chain
9. Trade history recorded in Supabase for transparency
```

---

## Technology Stack

### Frontend
- **[Astro 5.4](https://astro.build)** – Meta-framework for server-side rendering and static generation
- **[React 18](https://react.dev)** – Component library for interactive UI
- **[@mysten/dapp-kit](https://sdk.mysten.com/dapp-kit)** – Sui wallet connection and transaction signing
- **[@evefrontier/dapp-kit](https://evefrontier.com)** – EVE Frontier context providers (world, smart objects)
- **Radix UI + React Query** – Accessible components and async state management

### Backend
- **[Fastify 5.8](https://fastify.dev)** – Lightweight HTTP server with excellent TypeScript support
- **[@mysten/sui SDK 2.11](https://sdk.mysten.com)** – Official Sui SDK for on-chain interactions
- **[Supabase](https://supabase.com)** – PostgreSQL-backed database for listings and trade history
- **TypeScript** – Type-safe development across the stack

### Smart Contracts
- **[Move 2024](https://docs.sui.io/guides/developer/move)** – Sui's asset-oriented smart contract language
- **[Sui Framework](https://github.com/MystenLabs/sui/tree/main/crates/sui-framework/packages/sui-framework)** – Core Sui object system (coin, balance, object)
- **[EVE World Contracts v0.0.18](https://github.com/evefrontier/world-contracts)** – Standardized game object interfaces and storage

### Infrastructure
- **[Sui RPC](https://docs.sui.io/guides/developer/how-tos/rpc)** – Testnet or mainnet node for blockchain queries
- **[Sui Testnet](https://docs.sui.io/guides/developer/networks)** – Development and testing environment

---

## Project Structure

```
TRION/
└── trion-protocol/            # TRION product
    ├── apps/
    │   ├── web/               # Frontend (Astro + React)
    │   │   ├── src/           # React components and Astro layouts
    │   │   ├── package.json   # Web dependencies
    │   │   └── vite.config.mts
    │   │
    │   └── api/               # Backend (Fastify)
    │       ├── src/           # API routes and services
    │       │   ├── routes/    # Endpoints (listings, matches, trades)
    │       │   ├── services/  # Business logic (matching, value scoring)
    │       │   └── index.ts   # Server entry
    │       └── package.json   # API dependencies
    │
    ├── contracts/
    │   └── trion_core/        # Main Move package
    │       ├── sources/       # Smart contract modules
    │       │   ├── ssu_extension.move    # Intent & deposit logic
    │       │   ├── trade.move            # Vault-based settlement
    │       │   ├── vault.move            # Generic asset container
    │       │   └── config.move           # Admin configuration
    │       ├── tests/         # Move unit tests
    │       ├── Move.toml      # Package manifest
    │       └── Published.toml # Testnet deployment info
    │
    ├── docs/
    │   ├── utopia_onboarding.md      # EVE Frontier Utopia setup
    │   └── ...
    │
    ├── supabase/
    │   └── schema.sql         # Database schema (listings, trades, history)
    │
    └── README.md              # This file
```

---

## Prerequisites

Before you begin, ensure you have:

1. **Node.js 18+** – [Download](https://nodejs.org/)
2. **pnpm 10+** – `npm install -g pnpm` (faster package manager)
3. **Sui CLI** – [Installation guide](https://docs.sui.io/guides/developer/getting-started/sui-install)
4. **Git** – For version control
5. **A Sui-compatible wallet** – [Eve Vault](https://github.com/evefrontier/evevault), [Sui Wallet](https://chromewebstore.google.com/detail/slush-%E2%80%94-a-sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil).

### Optional
- **Docker** – For local blockchain simulation
- **Supabase CLI** – To run database locally

---

## Getting Started

### Local Development

#### 1. Clone the Repository

```bash
cd TRION/
```

#### 2. Install Dependencies

```bash
# Install TRION protocol frontend
cd apps/web
pnpm install

# Install TRION protocol API
cd ../api
pnpm install
```

#### 3. Configure Environment

**For the web app** (`apps/web`):

Create `.env.local`:
```env
PUBLIC_PACKAGE_ID=0x522224...   # Testnet package ID (see Published.toml)
PUBLIC_WORLD_PACKAGE_ID=0x07e6... # World contracts package ID
PUBLIC_SUI_NETWORK=testnet       # Or 'mainnet', 'devnet'
PUBLIC_API_BASE_URL=http://localhost:3000
```

**For the API** (`apps/api`):

Create `.env`:
```env
SUPABASE_URL=https://...supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...        # For admin operations if needed
```

> **Security Note**: Never commit `.env` files with secrets. Add `.env` to `.gitignore`.

#### 4. Start Development Servers

**Terminal 1 – Start Backend API** (from `apps/api`):
```bash
pnpm dev
# Runs on http://localhost:3000
```

**Terminal 2 – Start Frontend** (from `apps/web`):
```bash
pnpm dev
# Runs on http://localhost:3001
```

#### 5. Test Locally

Open [http://localhost:3001](http://localhost:3001) in your browser:
1. Connect wallet (test with Sui testnet faucet for SUI tokens)
2. Check inventory (should show items in connected wallet)
3. Create a test listing
4. Check `/api/listings` in another tab to see persisted data

---

### Testnet Deployment

To deploy to Sui Testnet:

#### 1. Build the Move Package

```bash
cd contracts/trion_core

# Compile contracts
sui move build

# Publish to testnet
sui client publish --gas-budget 100000000
```

Update `contracts/trion_core/Published.toml` with the new package ID.

#### 2. Update Environment

Update `PUBLIC_PACKAGE_ID` in `apps/web/.env.local` with the new package ID.

#### 3. Deploy API

```bash
cd apps/api

# Build
pnpm build

# Deploy (example: Vercel, Railway, Heroku, or self-hosted)
# Ensure environment variables are set in your deployment platform
```

#### 4. Build Frontend

```bash
cd apps/web

# Build static site
pnpm build

# Deploy (example: Vercel, Netlify, or S3 + CloudFront)
```

> See deployment platform docs for specifics. Most support Node.js and static sites.

---

## Development Workflow

### Adding a New Feature

1. **Identify the scope**: Is it a contract change, API endpoint, or UI component?

2. **For smart contracts**:
   ```bash
   cd contracts/trion_core
   
   # Edit sources/ files
   # Write tests in tests/
   sui move test
   ```

3. **For API**:
   ```bash
   cd apps/api/src
   
   # Add route in routes/, service in services/
   # Restart dev server to see changes
   ```

4. **For Frontend**:
   ```bash
   cd apps/web/src
   
   # Add component in components/, update App.tsx
   # Changes auto-reload in browser
   ```

5. **Test end-to-end**:
   - Start API (`pnpm dev`)
   - Start Web (`pnpm dev`)
   - Test wallet connection → listing creation → trade settlement

### Code Style

- **TypeScript**: Use existing `.prettierrc` and `tsconfig.json` configs
- **React**: Follow functional component patterns with hooks

---

## API Reference

The backend exposes RESTful endpoints for listing management and trade coordination.

### Base URL
```
http://localhost:3000  (local dev)
https://your-domain.com/api  (production)
```

### Endpoints

#### **GET /item-types**
Fetch all known item types in the TRION catalog.

**Response**:
```json
{
  "items": [
    {
      "type_id": "0x123...",
      "name": "Iron Ore",
      "category": "resource",
      "icon_url": "https://..."
    }
  ]
}
```

#### **POST /listings**
Create a new trade listing.

**Body**:
```json
{
  "owner_wallet": "0x1a2b3c...",
  "have_type_id": "0x123...",
  "have_qty": 10,
  "want_type_id": "0x456...",
  "want_qty": 5,
  "ssu_object_id": "0xabc..." // optional
}
```

**Response**:
```json
{
  "id": "uuid",
  "owner_wallet": "0x1a2b3c...",
  "status": "open",
  "created_at": "2024-03-26T..."
}
```

#### **GET /listings**
Fetch open listings (paginated).

**Query Params**: `page=1&limit=20&owner=0x1a2b3c...` (optional owner filter)

#### **GET /match/:listingId**
Find compatible trade partner(s) for a listing.

**Response**:
```json
{
  "listing_id": "uuid",
  "matches": [
    {
      "partner_listing_id": "uuid",
      "partner_wallet": "0x789...",
      "match_score": 0.95
    }
  ]
}
```

#### **POST /trade/execute**
Record a completed trade after on-chain settlement.

**Body**:
```json
{
  "listing_a_id": "uuid",
  "listing_b_id": "uuid",
  "tx_digest": "0x..." // Transaction digest from settled trade
}
```

#### **GET /trades**
Fetch trade history (optionally filtered by wallet).

**Query Params**: `owner=0x1a2b3c...&limit=50`

---

## Smart Contracts

TRION's logic lives in the `trion_core` Move package. Here's a high-level overview:

### Module: `ssu_extension`
Handles **intent registration** and **item deposits** into storage units.

**Key Functions**:
- `register_intent(...)` – Public function for players to express trade intent
- `deposit_to_trion_ssu(...)` – Deposits a world Item into a storage unit for settlement

### Module: `trade`
Orchestrates **atomic vault-based swaps**.

**Key Functions**:
- `execute_trade<A, B>(vault_a, vault_b)` – Swaps contents of two typed vaults

### Module: `vault`
Generic **asset container** for settlement (works with coins, balances, and custom types).

**Key Functions**:
- `create_vault<T>(owner)` – Creates a typed vault owned by a player
- `release_vault<T>(vault)` – Owner releases the vault contents
- `extract_item<T>(vault)` – Internal function for trade settlement

### Module: `config`
**Admin configuration** for rules and policies (requires admin capability).

**Key Functions**:
- `add_rule(...)`, `set_rule(...)`, `remove_rule(...)` – Manage dynamic config rules
- `x_auth()` – Internal witness generator for package-level authorization

> Full contract documentation: See [contracts/trion_core/sources/](./trion-protocol/contracts/trion_core/sources/)

---

## Contributing

We welcome contributions! Whether it's bug reports, feature requests, or code improvements:

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feature/your-feature-name`
3. **Make changes**: Follow code style guidelines (format with Prettier/`sui move fmt`)
4. **Write tests**: Add tests for new Move functions or API logic
5. **Submit a PR**: Include a clear description of what and why

### Areas We Need Help

- Performance optimizations for the match engine
- Additional item type connectors for different games
- UI/UX improvements for wallet or listing screens
- Documentation and examples
- Integration with other Sui dapps

---

## Resources

### Sui Blockchain
- [Sui Developer Docs](https://docs.sui.io/) – Official Sui documentation
- [Move Language Guide](https://docs.sui.io/guides/developer/move) – Learn Move programming
- [Sui SDK Reference](https://sdk.mysten.com/) – TypeScript/JavaScript SDK

### EVE Frontier
- [EVE Frontier Official](https://evefrontier.com) – Main website and universe
- [EVE World Contracts](https://github.com/evefrontier/world-contracts) – Standardized game object contracts
- [EVE dapp-kit](https://github.com/evefrontier/dapp-kit) – EVE-specific wallet and context

### Web3 Game Development
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts) – Battle-tested contract patterns (for EVM reference)
- [Game7 DAO](https://game7.io/) – Web3 gaming community
- [Sui Gaming Guild](https://discord.gg/sui) – Sui ecosystem gaming channel

### Frontend Development
- [Astro Documentation](https://docs.astro.build) – Meta-framework docs
- [React Hooks Guide](https://react.dev/reference/react) – React hooks and best practices
- [Radix UI](https://radix-ui.com/) – Accessible component library

---

## License

This project is licensed under the **GNU GENERAL PUBLIC LICENSE** – see [LICENSE](./LICENSE) file for details.

---

## Support

Have questions or run into issues?

- **Documentation**: Check [docs/](./trion-protocol/docs) for more detailed guides
- **Issues**: Report bugs on GitHub (if public)
- **Community**: Join Sui or EVE Frontier Discord communities for help

---

**Built with ❤️ on Sui and EVE Frontier**

Start trading with TRION today. Connect your wallet, discover partners, and execute trustless swaps!
