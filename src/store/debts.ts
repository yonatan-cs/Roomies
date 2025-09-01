// Real-time debt management store
// This replaces the old debtSettlements system with live Firestore listeners

import { firestoreService } from '../services/firestore-service';

export interface LiveDebt {
  id: string;
  apartment_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  status: 'open' | 'closed';
  created_at: string;
  closed_at?: string;
  closed_by?: string;
  description?: string;
}

export interface LiveAction {
  id: string;
  apartment_id: string;
  type: 'debt_closed' | 'debt_created' | 'purchase' | 'transfer';
  debt_id?: string;
  from_user_id?: string;
  to_user_id?: string;
  amount?: number;
  actor_uid: string;
  created_at: string;
  note?: string;
}

export interface LiveUserBalance {
  userId: string;
  balance: number;
}

// Store state
let debts: LiveDebt[] = [];
let actions: LiveAction[] = [];
let userBalances: Map<string, number> = new Map();

// Listeners
let debtsUnsubscribe: (() => void) | null = null;
let actionsUnsubscribe: (() => void) | null = null;
let balanceUnsubscribes: Map<string, (() => void)> = new Map();

// Callbacks for UI updates
const debtsCallbacks: Set<(debts: LiveDebt[]) => void> = new Set();
const actionsCallbacks: Set<(actions: LiveAction[]) => void> = new Set();
const balanceCallbacks: Map<string, Set<(balance: number) => void>> = new Map();

// Initialize listeners for an apartment
export async function initializeDebtListeners(apartmentId: string, userIds: string[]) {
  if (!apartmentId) return;

  // Clean up existing listeners
  cleanupListeners();

  try {
    // Load initial data
    const [initialDebts, initialActions] = await Promise.all([
      firestoreService.getDebts(),
      firestoreService.getActions()
    ]);

    // Transform Firestore documents to our format
    debts = initialDebts.map(doc => ({
      id: doc.name?.split('/').pop() || '',
      apartment_id: doc.fields?.apartment_id?.stringValue || '',
      from_user_id: doc.fields?.from_user_id?.stringValue || '',
      to_user_id: doc.fields?.to_user_id?.stringValue || '',
      amount: parseFloat(doc.fields?.amount?.doubleValue || doc.fields?.amount?.integerValue || '0'),
      status: doc.fields?.status?.stringValue || 'open',
      created_at: doc.fields?.created_at?.timestampValue || '',
      closed_at: doc.fields?.closed_at?.timestampValue || undefined,
      closed_by: doc.fields?.closed_by?.stringValue || undefined,
      description: doc.fields?.description?.stringValue || undefined,
    }));

    actions = initialActions.map(doc => ({
      id: doc.name?.split('/').pop() || '',
      apartment_id: doc.fields?.apartment_id?.stringValue || '',
      type: doc.fields?.type?.stringValue || 'debt_closed',
      debt_id: doc.fields?.debt_id?.stringValue || undefined,
      from_user_id: doc.fields?.from_user_id?.stringValue || undefined,
      to_user_id: doc.fields?.to_user_id?.stringValue || undefined,
      amount: parseFloat(doc.fields?.amount?.doubleValue || doc.fields?.amount?.integerValue || '0'),
      actor_uid: doc.fields?.actor_uid?.stringValue || '',
      created_at: doc.fields?.created_at?.timestampValue || '',
      note: doc.fields?.note?.stringValue || undefined,
    }));

    // Load initial balances
    for (const userId of userIds) {
      const balance = await firestoreService.getUserBalance(userId);
      userBalances.set(userId, balance);
    }

    // Notify all callbacks with initial data
    notifyDebtsCallbacks();
    notifyActionsCallbacks();
    notifyBalanceCallbacks();

    console.log('✅ Debt listeners initialized:', { 
      debtsCount: debts.length, 
      actionsCount: actions.length, 
      balancesCount: userBalances.size 
    });

  } catch (error) {
    console.error('❌ Error initializing debt listeners:', error);
  }
}

// Clean up all listeners
export function cleanupListeners() {
  if (debtsUnsubscribe) {
    debtsUnsubscribe();
    debtsUnsubscribe = null;
  }
  if (actionsUnsubscribe) {
    actionsUnsubscribe();
    actionsUnsubscribe = null;
  }
  
  balanceUnsubscribes.forEach(unsub => unsub());
  balanceUnsubscribes.clear();
  
  console.log('🧹 Debt listeners cleaned up');
}

// Subscribe to debts updates
export function subscribeToDebts(callback: (debts: LiveDebt[]) => void) {
  debtsCallbacks.add(callback);
  // Immediately call with current data
  callback(debts);
  
  return () => {
    debtsCallbacks.delete(callback);
  };
}

// Subscribe to actions updates
export function subscribeToActions(callback: (actions: LiveAction[]) => void) {
  actionsCallbacks.add(callback);
  // Immediately call with current data
  callback(actions);
  
  return () => {
    actionsCallbacks.delete(callback);
  };
}

// Subscribe to user balance updates
export function subscribeToUserBalance(userId: string, callback: (balance: number) => void) {
  if (!balanceCallbacks.has(userId)) {
    balanceCallbacks.set(userId, new Set());
  }
  balanceCallbacks.get(userId)!.add(callback);
  
  // Immediately call with current data
  const currentBalance = userBalances.get(userId) || 0;
  callback(currentBalance);
  
  return () => {
    const callbacks = balanceCallbacks.get(userId);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        balanceCallbacks.delete(userId);
      }
    }
  };
}

// Notify all callbacks
function notifyDebtsCallbacks() {
  debtsCallbacks.forEach(callback => callback(debts));
}

function notifyActionsCallbacks() {
  actionsCallbacks.forEach(callback => callback(actions));
}

function notifyBalanceCallbacks() {
  balanceCallbacks.forEach((callbacks, userId) => {
    const balance = userBalances.get(userId) || 0;
    callbacks.forEach(callback => callback(balance));
  });
}

// Update data (called by external listeners)
export function updateDebts(newDebts: LiveDebt[]) {
  debts = newDebts;
  notifyDebtsCallbacks();
}

export function updateActions(newActions: LiveAction[]) {
  actions = newActions;
  notifyActionsCallbacks();
}

export function updateUserBalance(userId: string, balance: number) {
  userBalances.set(userId, balance);
  const callbacks = balanceCallbacks.get(userId);
  if (callbacks) {
    callbacks.forEach(callback => callback(balance));
  }
}

// Get current data
export function getCurrentDebts(): LiveDebt[] {
  return debts;
}

export function getCurrentActions(): LiveAction[] {
  return actions;
}

export function getCurrentUserBalance(userId: string): number {
  return userBalances.get(userId) || 0;
}

// Calculate balances from debts (for display)
export function calculateBalancesFromDebts(): LiveUserBalance[] {
  const balanceMap = new Map<string, number>();
  
  // Process only open debts
  debts.filter(debt => debt.status === 'open').forEach(debt => {
    const fromBalance = balanceMap.get(debt.from_user_id) || 0;
    const toBalance = balanceMap.get(debt.to_user_id) || 0;
    
    balanceMap.set(debt.from_user_id, fromBalance - debt.amount);
    balanceMap.set(debt.to_user_id, toBalance + debt.amount);
  });
  
  return Array.from(balanceMap.entries()).map(([userId, balance]) => ({
    userId,
    balance
  }));
}
