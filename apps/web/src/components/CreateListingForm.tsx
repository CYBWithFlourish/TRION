import React, { useEffect, useMemo, useState } from 'react';
import { useCurrentAccount, useDAppKit } from '@mysten/dapp-kit-react';
import { useSmartObject } from '@evefrontier/dapp-kit';
import { API_BASE_URL, suiClient } from '../lib/sui';
import { registerIntentWithOptionalDepositTx } from '../lib/vault';

interface ItemType {
    type_id: number;
    name: string;
    category: string;
    base_value: number;
  icon_url?: string;
}

interface InventoryItemOption {
  id: string;
  type_id: number;
  quantity: number;
  name: string;
}

const extractDigest = (result: any): string | null => {
    return result?.digest || result?.effects?.transactionDigest || result?.Transaction?.digest || result?.FailedTransaction?.digest || null;
};

export const CreateListingForm = () => {
    const account = useCurrentAccount();
    const dAppKit = useDAppKit();
    const { assembly, assemblyOwner } = useSmartObject();

    const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
    const [haveItemId, setHaveItemId] = useState<number>(0);
    const [haveQty, setHaveQty] = useState<number>(1);
    const [wantItemId, setWantItemId] = useState<number>(0);
    const [wantQty, setWantQty] = useState<number>(1);
    const [escrowObjectId, setEscrowObjectId] = useState<string>('');
    const [storageUnitObjectId, setStorageUnitObjectId] = useState<string>('');
    const [characterObjectId, setCharacterObjectId] = useState<string>('');
    const [itemObjectId, setItemObjectId] = useState<string>('');
    const [detectedStorageUnits, setDetectedStorageUnits] = useState<string[]>([]);
    const [detectedCharacters, setDetectedCharacters] = useState<string[]>([]);
    const [detectedItems, setDetectedItems] = useState<string[]>([]);
    const [discoveryLoading, setDiscoveryLoading] = useState(false);
    const [advancedMode, setAdvancedMode] = useState(false);
    const [selectedInventoryItemId, setSelectedInventoryItemId] = useState<string>('');

    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');

    const itemTypeMap = useMemo(() => {
      return new Map(itemTypes.map((item) => [item.type_id, item]));
    }, [itemTypes]);

    const assemblyInventoryItems = useMemo<InventoryItemOption[]>(() => {
      const items = (assembly as any)?.storage?.mainInventory?.items;
      if (!Array.isArray(items)) {
        return [];
      }

      return items
        .map((item: any) => ({
          id: String(item?.id || ''),
          type_id: Number(item?.type_id || 0),
          quantity: Number(item?.quantity || 0),
          name: String(item?.name || `Item ${item?.type_id || ''}`),
        }))
        .filter((item: InventoryItemOption) => !!item.id && item.type_id > 0);
    }, [assembly]);

    const eligibleInventoryItems = useMemo<InventoryItemOption[]>(() => {
      const assemblyType = String((assembly as any)?.type || '').toLowerCase();
      const isStorageModule = assemblyType.includes('smartstorageunit') || assemblyType.includes('storageunit');
      if (!isStorageModule) {
        return [];
      }

      return assemblyInventoryItems.filter((item) => {
        const knownType = itemTypeMap.has(item.type_id);
        return knownType && item.quantity > 0;
      });
    }, [assembly, assemblyInventoryItems, itemTypeMap]);

    const selectedInventoryItem = useMemo(() => {
      return eligibleInventoryItems.find((item) => item.id === selectedInventoryItemId) || null;
    }, [eligibleInventoryItems, selectedInventoryItemId]);

    const selectedItemTypeMeta = useMemo(() => {
      if (!selectedInventoryItem) {
        return null;
      }
      return itemTypeMap.get(selectedInventoryItem.type_id) || null;
    }, [selectedInventoryItem, itemTypeMap]);

    const haveQtyExceedsSelection = !!selectedInventoryItem && haveQty > selectedInventoryItem.quantity;

    const canDepositBeforeIntent = useMemo(
      () => !!storageUnitObjectId && !!characterObjectId && !!itemObjectId && !!selectedInventoryItem,
      [storageUnitObjectId, characterObjectId, itemObjectId, selectedInventoryItem],
    );

    useEffect(() => {
        fetch(`${API_BASE_URL}/item-types`)
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setItemTypes(data.items);
                    if (data.items.length > 0) {
                        setHaveItemId(data.items[0].type_id);
                        setWantItemId(data.items[1]?.type_id || data.items[0].type_id);
                    }
                }
            });
    }, []);

    useEffect(() => {
        const assemblyId = (assembly as any)?.item_id || (assembly as any)?.id;
        const ownerCharacterId = (assemblyOwner as any)?.id;
        const firstInventoryItemId = (assembly as any)?.storage?.mainInventory?.items?.[0]?.id;

        if (assemblyId && !storageUnitObjectId) {
            setStorageUnitObjectId(String(assemblyId));
        }
        if (ownerCharacterId && !characterObjectId) {
            setCharacterObjectId(String(ownerCharacterId));
        }
        if (firstInventoryItemId && !itemObjectId) {
            setItemObjectId(String(firstInventoryItemId));
        }
    }, [assembly, assemblyOwner, storageUnitObjectId, characterObjectId, itemObjectId]);

      useEffect(() => {
        if (!selectedInventoryItemId && eligibleInventoryItems.length > 0) {
          setSelectedInventoryItemId(eligibleInventoryItems[0].id);
        }
      }, [eligibleInventoryItems, selectedInventoryItemId]);

      useEffect(() => {
        if (!selectedInventoryItemId) {
          return;
        }

        const selected = eligibleInventoryItems.find(item => item.id === selectedInventoryItemId);
        if (!selected) {
          return;
        }

        setItemObjectId(selected.id);
        setHaveQty(selected.quantity > 0 ? selected.quantity : 1);

        const hasMatchingTypeInCatalog = itemTypes.some(item => item.type_id === selected.type_id);
        if (hasMatchingTypeInCatalog) {
          setHaveItemId(selected.type_id);
        }
      }, [selectedInventoryItemId, eligibleInventoryItems, itemTypes]);

      const discoverWalletObjects = async () => {
        if (!account?.address) {
          return;
        }

        setDiscoveryLoading(true);
        try {
          const storageUnits: string[] = [];
          const characters: string[] = [];
          const items: string[] = [];

          let cursor: string | null = null;
          let hasNextPage = true;

          while (hasNextPage) {
            const response = await suiClient.getOwnedObjects({
              owner: account.address,
              cursor,
              options: { showType: true },
            });

            for (const obj of response.data) {
              const type = String(obj.data?.type || '').toLowerCase();
              const objectId = obj.data?.objectId;
              if (!objectId) {
                continue;
              }

              if (type.includes('::storage_unit::storageunit')) {
                storageUnits.push(objectId);
              } else if (type.includes('::character::character')) {
                characters.push(objectId);
              } else if (type.includes('::inventory::item')) {
                items.push(objectId);
              }
            }

            hasNextPage = response.hasNextPage;
            cursor = response.nextCursor;
          }

          setDetectedStorageUnits(storageUnits);
          setDetectedCharacters(characters);
          setDetectedItems(items);

          if (!storageUnitObjectId && storageUnits.length > 0) {
            setStorageUnitObjectId(storageUnits[0]);
          }
          if (!characterObjectId && characters.length > 0) {
            setCharacterObjectId(characters[0]);
          }
          if (!itemObjectId && items.length > 0) {
            setItemObjectId(items[0]);
          }
        } catch (err: any) {
          setStatus(`Could not auto-detect world objects: ${err.message}`);
        } finally {
          setDiscoveryLoading(false);
        }
      };

      useEffect(() => {
        discoverWalletObjects();
      }, [account?.address]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!account) {
            setStatus('Please connect your wallet first.');
            return;
        }

        if (!selectedInventoryItem) {
          setStatus('No deposit-eligible inventory item found for this storage module.');
          return;
        }

        if (haveQty <= 0) {
          setStatus('Offered quantity must be greater than zero.');
          return;
        }

        if (haveQtyExceedsSelection) {
          setStatus(`Offered quantity exceeds selected item balance (${selectedInventoryItem.quantity}).`);
          return;
        }

        setLoading(true);
        setStatus(canDepositBeforeIntent ? 'Depositing item to Trion SSU and registering intent...' : 'Registering intent transaction...');

        try {
            // Build one transaction: optional SSU deposit + intent registration.
            const tx = registerIntentWithOptionalDepositTx({
                haveTypeId: haveItemId,
                haveQty,
                wantTypeId: wantItemId,
                wantQty,
                storageUnitObjectId: storageUnitObjectId || undefined,
                characterObjectId: characterObjectId || undefined,
                itemObjectId: itemObjectId || undefined,
            });

            const result = await dAppKit.signAndExecuteTransaction({
                transaction: tx as any
            });

            const txDigest = extractDigest(result);
            if (!txDigest) {
                throw new Error('Transaction digest was not returned by wallet client.');
            }

            setStatus('Recording on global ledger...');
            
            // 3. Post to our API
            const response = await fetch(`${API_BASE_URL}/listings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    owner_wallet: account.address,
                    have_type_id: haveItemId,
                    have_qty: haveQty,
                    want_type_id: wantItemId,
                    want_qty: wantQty,
                    ssu_object_id: escrowObjectId || storageUnitObjectId || null,
                    intent_tx_digest: txDigest
                })
            });

            const apiData = await response.json();
            if (apiData.success) {
                setStatus('Listing published successfully.');
                setTimeout(() => window.location.href = '/', 2000);
            } else {
                setStatus(`API error: ${apiData.error}`);
            }
        } catch (err: any) {
            setStatus(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="form-container glass-panel">
            <h2 className="glow-text-blue">Initiate Core Swap</h2>
            <p className="text-muted">Register your trade intent on the global ledger</p>
            
            <form onSubmit={handleSubmit} style={{ marginTop: '2rem' }}>
                <div className="form-section">
                  <label>I AM OFFERING</label>
                  <div className="input-group">
                    <select value={haveItemId} onChange={e => setHaveItemId(Number(e.target.value))}>
                      {itemTypes.map(item => (
                        <option key={item.type_id} value={item.type_id}>{item.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={haveQty}
                      onChange={e => setHaveQty(Number(e.target.value))}
                      min="1"
                      max={selectedInventoryItem?.quantity || undefined}
                    />
                  </div>
                  {selectedInventoryItem && (
                    <p className="inline-hint">Available from selected item: {selectedInventoryItem.quantity}</p>
                  )}
                  {haveQtyExceedsSelection && (
                    <p className="inline-error">Quantity exceeds available balance for selected item.</p>
                  )}
                </div>

                <div className="swap-divider">FOR</div>

                <div className="form-section">
                  <label>I AM SEEKING</label>
                  <div className="input-group">
                    <select value={wantItemId} onChange={e => setWantItemId(Number(e.target.value))}>
                      {itemTypes.map(item => (
                        <option key={item.type_id} value={item.type_id}>{item.name}</option>
                      ))}
                    </select>
                    <input type="number" value={wantQty} onChange={e => setWantQty(Number(e.target.value))} min="1" />
                  </div>
                </div>

                <div className="status-msg">{status}</div>

                <div className="form-section glass-panel" style={{ padding: '0.9rem', borderRadius: '10px' }}>
                  <label>AUTO-DETECTED DEPOSIT OBJECTS</label>
                  <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.7rem' }}>
                    TRION auto-selects a deposit-eligible item from your storage inventory.
                  </p>
                  {eligibleInventoryItems.length > 0 && (
                    <div style={{ marginBottom: '0.8rem' }}>
                      <label>INVENTORY ITEM PICKER</label>
                      <select
                        value={selectedInventoryItemId}
                        onChange={(e) => setSelectedInventoryItemId(e.target.value)}
                      >
                        {eligibleInventoryItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} | Qty {item.quantity} | Type {item.type_id}
                          </option>
                        ))}
                      </select>
                      <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.45rem' }}>
                        Selecting an item auto-fills deposit item object and offered quantity.
                      </p>
                    </div>
                  )}
                  {eligibleInventoryItems.length === 0 && (
                    <p className="inline-error" style={{ marginBottom: '0.75rem' }}>
                      No deposit-eligible inventory items found. Ensure you are connected to a Smart Storage Unit with supported item types.
                    </p>
                  )}
                  {selectedInventoryItem && (
                    <div className="item-meta-card">
                      {selectedItemTypeMeta?.icon_url ? (
                        <img src={selectedItemTypeMeta.icon_url} alt={selectedInventoryItem.name} className="item-meta-icon" />
                      ) : (
                        <div className="item-meta-icon item-meta-icon-fallback">ITEM</div>
                      )}
                      <div className="item-meta-text">
                        <div className="item-meta-title">{selectedInventoryItem.name}</div>
                        <div className="item-meta-subtitle">
                          Category: {selectedItemTypeMeta?.category || 'unknown'} | Type: {selectedInventoryItem.type_id}
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    <div className="wallet-tag">StorageUnit: {storageUnitObjectId || 'Not found yet'}</div>
                    <div className="wallet-tag">Character: {characterObjectId || 'Not found yet'}</div>
                    <div className="wallet-tag">Item: {itemObjectId || 'Not found yet'}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    style={{ marginTop: '0.8rem' }}
                    onClick={discoverWalletObjects}
                    disabled={discoveryLoading}
                  >
                    {discoveryLoading ? 'Scanning...' : 'Rescan Wallet Objects'}
                  </button>
                </div>

                <div className="form-section" style={{ marginTop: '0.6rem' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setAdvancedMode(!advancedMode)}
                  >
                    {advancedMode ? 'Hide Advanced Overrides' : 'Show Advanced Overrides'}
                  </button>
                </div>

                {advancedMode && (
                  <>
                    <div className="form-section">
                      <label>TRION SSU OBJECT ID (OVERRIDE)</label>
                      <input
                        type="text"
                        value={storageUnitObjectId}
                        onChange={e => setStorageUnitObjectId(e.target.value.trim())}
                        placeholder="0x... Smart Storage Unit object ID"
                      />
                    </div>

                    <div className="form-section">
                      <label>CHARACTER OBJECT ID (OVERRIDE)</label>
                      <input
                        type="text"
                        value={characterObjectId}
                        onChange={e => setCharacterObjectId(e.target.value.trim())}
                        placeholder="0x... Character object ID"
                      />
                    </div>

                    <div className="form-section">
                      <label>ITEM OBJECT ID (OVERRIDE)</label>
                      <input
                        type="text"
                        value={itemObjectId}
                        onChange={e => setItemObjectId(e.target.value.trim())}
                        placeholder="0x... Item object ID to deposit"
                      />
                    </div>
                  </>
                )}

                <div className="form-section">
                  <label>ESCROW OBJECT ID (OPTIONAL, FOR MATCHED SETTLEMENT)</label>
                  <input
                    type="text"
                    value={escrowObjectId}
                    onChange={e => setEscrowObjectId(e.target.value.trim())}
                    placeholder="0x... Vault/escrow object used by execute_trade"
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} disabled={loading}>
                  {loading ? 'Processing...' : (canDepositBeforeIntent ? 'Deposit Item + Register Intent' : 'Register Intent On-chain')}
                </button>
            </form>


        </div>
    );
};
