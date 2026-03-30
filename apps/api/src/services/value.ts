/**
 * TRION Value Engine
 * 
 * Items are identified by type_id (u64) from the EVE Frontier world contracts.
 * Real type_ids must be sourced from:
 * https://world-api-utopia.uat.pub.evefrontier.com/docs/index.html
 * 
 * The registry here mirrors the item_types table in Supabase.
 * Keep both in sync when adding new item types.
 */

export interface ItemType {
    type_id: number;
    name: string;
    category: 'fuel' | 'weapon' | 'component' | 'material' | 'other';
    base_value: number;
    description?: string;
    icon_url?: string;
}

// ⚠️  Replace type_ids with real values from the Utopia World API
export const ITEM_TYPE_REGISTRY: Record<number, ItemType> = {
    78516: { type_id: 78516, name: 'EU-40 Fuel',          category: 'fuel',      base_value: 10 },
    78515: { type_id: 78515, name: 'SOF-80 Fuel',         category: 'fuel',      base_value: 15 },
    78437: { type_id: 78437, name: 'EU-90 Fuel',          category: 'fuel',      base_value: 20 },
    88335: { type_id: 88335, name: 'D1 Fuel',             category: 'fuel',      base_value: 5 },
    81972: { type_id: 81972, name: 'Base Coilgun (S)',    category: 'weapon',    base_value: 25 },
    81974: { type_id: 81974, name: 'Base Autocannon (S)', category: 'weapon',    base_value: 25 },
    82032: { type_id: 82032, name: 'Base Rapid Plasma (S)',category: 'weapon',    base_value: 30 },
    78416: { type_id: 78416, name: 'Apocalypse Frame',    category: 'component', base_value: 100 },
    83818: { type_id: 83818, name: 'Fossilized Exotronics',category: 'component', base_value: 50 },
    89087: { type_id: 89087, name: 'Synod Technocore',    category: 'component', base_value: 120 },
    77801: { type_id: 77801, name: 'Nickel-Iron Veins',   category: 'material',  base_value: 5 },
    77803: { type_id: 77803, name: 'Silicon Dust',        category: 'material',  base_value: 5 },
    84180: { type_id: 84180, name: 'Printed Circuits',    category: 'material',  base_value: 10 },
    84182: { type_id: 84182, name: 'Reinforced Alloys',   category: 'material',  base_value: 15 },
};

const WORLD_API_BASE_URL = process.env.WORLD_API_BASE_URL || 'https://world-api-utopia.uat.pub.evefrontier.com';
const WORLD_API_ITEM_TYPES_PATHS = (process.env.WORLD_API_ITEM_TYPES_PATHS ||
    '/api/item-types,/item-types,/api/types,/types,/api/v1/types,/v1/types')
    .split(',')
    .map((path) => path.trim())
    .filter(Boolean);

const ITEM_TYPES_CACHE_TTL_MS = 5 * 60 * 1000;

let cachedLiveItemTypes: ItemType[] | null = null;
let cachedAtMs = 0;

function toCategory(value: unknown): ItemType['category'] {
    const str = String(value ?? '').toLowerCase();
    if (str.includes('fuel')) return 'fuel';
    if (str.includes('weapon') || str.includes('turret')) return 'weapon';
    if (str.includes('component') || str.includes('module')) return 'component';
    if (str.includes('material') || str.includes('mineral') || str.includes('ore')) return 'material';
    return 'other';
}

function toBaseValue(raw: any): number {
    const candidate = Number(
        raw?.base_value ?? raw?.baseValue ?? raw?.estimated_value ?? raw?.value ?? raw?.volume ?? 1,
    );
    return Number.isFinite(candidate) && candidate > 0 ? candidate : 1;
}

function normalizeLiveItemTypes(payload: any): ItemType[] {
    const arr = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(payload?.data)
                ? payload.data
                : Array.isArray(payload?.results)
                    ? payload.results
                    : [];

    const normalized = arr
        .map((raw: any) => {
            const typeId = Number(raw?.type_id ?? raw?.typeId ?? raw?.id);
            if (!Number.isFinite(typeId) || typeId <= 0) {
                return null;
            }

            return {
                type_id: typeId,
                name: String(raw?.name ?? raw?.display_name ?? `Type ${typeId}`),
                category: toCategory(raw?.category ?? raw?.categoryName ?? raw?.groupName),
                base_value: toBaseValue(raw),
                description: raw?.description ? String(raw.description) : undefined,
                icon_url: raw?.icon_url ? String(raw.icon_url) : (raw?.iconUrl ? String(raw.iconUrl) : undefined),
            } as ItemType;
        })
        .filter((item: ItemType | null): item is ItemType => !!item);

    const deduped = new Map<number, ItemType>();
    for (const item of normalized) {
        deduped.set(item.type_id, item);
    }
    return Array.from(deduped.values());
}

async function fetchLiveItemTypes(): Promise<ItemType[] | null> {
    for (const path of WORLD_API_ITEM_TYPES_PATHS) {
        const url = `${WORLD_API_BASE_URL.replace(/\/+$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            });

            if (!response.ok) {
                continue;
            }

            const payload = await response.json();
            const normalized = normalizeLiveItemTypes(payload);
            if (normalized.length > 0) {
                return normalized;
            }
        } catch {
            // Try next path candidate.
        } finally {
            clearTimeout(timeout);
        }
    }

    return null;
}

async function getEffectiveItemTypes(): Promise<ItemType[]> {
    const now = Date.now();
    if (cachedLiveItemTypes && now - cachedAtMs < ITEM_TYPES_CACHE_TTL_MS) {
        return cachedLiveItemTypes;
    }

    const live = await fetchLiveItemTypes();
    if (live && live.length > 0) {
        cachedLiveItemTypes = live;
        cachedAtMs = now;
        return live;
    }

    return Object.values(ITEM_TYPE_REGISTRY);
}

/**
 * Compute value score for a listing.
 * @param typeId - EVE Frontier on-chain item type_id
 * @param qty    - quantity being offered
 */
export async function getValueScore(typeId: number, qty: number): Promise<number> {
    const effectiveTypes = await getEffectiveItemTypes();
    const itemMap = new Map(effectiveTypes.map((item) => [item.type_id, item]));
    const item = itemMap.get(typeId) ?? ITEM_TYPE_REGISTRY[typeId];
    const baseValue = item?.base_value ?? 1;
    return baseValue * qty;
}

/**
 * Get human-readable name for a type_id.
 * Returns "Unknown Item" if type_id is not in registry.
 */
export function getItemName(typeId: number): string {
    return ITEM_TYPE_REGISTRY[typeId]?.name ?? `Unknown Item (${typeId})`;
}

/**
 * Check if a type_id is known/valid.
 */
export async function isKnownTypeId(typeId: number): Promise<boolean> {
    const effectiveTypes = await getEffectiveItemTypes();
    return effectiveTypes.some((item) => item.type_id === typeId);
}

/**
 * Get all registered item types as an array (for frontend dropdowns etc.)
 */
export async function getAllItemTypes(): Promise<ItemType[]> {
    return getEffectiveItemTypes();
}