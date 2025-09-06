import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { firestoreService } from '../services/firestore-service';
import { firestoreSDKService } from '../services/firestore-sdk-service';
import {
  User,
  Apartment,
  CleaningTask,
  Expense,
  ShoppingItem,
  Balance,
  ExpenseCategory,
  CleaningHistory,
  DebtSettlement,
  CleaningSettings,
  ChecklistItem,
} from '../types';

function startOfDay(d: Date) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function addDays(d: Date, days: number) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + days);
  return dt;
}

function computePeriodBounds(now: Date, anchorDow: number, intervalDays: number) {
  const dow = now.getDay(); // 0..6, 0=Sun
  const daysSinceAnchor = (dow - anchorDow + 7) % 7;
  const periodStart = startOfDay(addDays(now, -daysSinceAnchor));
  const periodEnd = startOfDay(addDays(periodStart, intervalDays));
  return { periodStart, periodEnd };
}

// Helper function to get current turn user ID from either Firestore or local type
function getCurrentTurnUserId(task: any): string | null {
  // Firestore returns user_id, local type has currentTurn
  return task?.user_id || task?.currentTurn || null;
}

interface AppState {
  // User & Apartment
  currentUser?: User;
  currentApartment?: Apartment;

  // Cleaning (Firestore-based system only)
  cleaningTask?: CleaningTask;
  cleaningSettings: CleaningSettings;
  checklistItems: ChecklistItem[];
  isMyCleaningTurn: boolean;
  _loadingChecklist: boolean;

  // Expenses & Budget
  expenses: Expense[];
  debtSettlements: DebtSettlement[];

  // Shopping
  shoppingItems: ShoppingItem[];

  // Actions - User & Apartment
  setCurrentUser: (user: User) => void;
  createApartment: (name: string) => void;
  joinApartment: (code: string, userName: string) => void;
  refreshApartmentMembers: () => Promise<void>;

  // Actions - Cleaning
  initializeCleaning: () => Promise<void>;
  updateQueueFromMembers: () => void;
  checkOverdueTasks: () => Promise<void>;

  // Cleaning settings
  setCleaningIntervalDays: (days: number) => void;
  setCleaningAnchorDow: (dow: number) => void; // 0..6
  setPreferredDay: (userId: string, dow?: number) => void; // undefined to clear

  // Actions - Expenses
  addExpense: (expense: Omit<Expense, 'id' | 'date'>) => Promise<void>;
  updateExpense: (expenseId: string, updates: Partial<Omit<Expense, 'id' | 'date'>>) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  loadExpenses: () => Promise<void>;
  loadDebtSettlements: () => Promise<void>;
  getBalances: () => Balance[];
  getRawBalances: () => Balance[];
  getSimplifiedBalances: () => Balance[];
  getMonthlyExpenses: (year: number, month: number) => { expenses: Expense[], total: number, personalTotal: number };
  getTotalApartmentExpenses: (year: number, month: number) => number;

  // Actions - Debts & Balances (Firestore-based system)
  createAndCloseDebtAtomic: (fromUserId: string, toUserId: string, amount: number, description?: string) => Promise<{ success: boolean; debtId: string; expenseId: string; closedAt: string; }>;
  closeDebtAndRefreshBalances: (debtId: string, { payerUserId, receiverUserId, amount }: { payerUserId: string; receiverUserId: string; amount: number; }) => Promise<void>;
  createDebtForSettlement: (fromUserId: string, toUserId: string, amount: number, description?: string) => Promise<string>;
  initializeDebtSystem: (apartmentId: string, userIds: string[]) => Promise<void>;
  cleanupDebtSystem: () => void;

  // Actions - Shopping
  addShoppingItem: (name: string, userId: string, priority?: 'low' | 'normal' | 'high', quantity?: number, notes?: string) => Promise<void>;
  loadShoppingItems: () => Promise<void>;
  updateShoppingItem: (itemId: string, updates: { priority?: 'low' | 'normal' | 'high'; quantity?: number; notes?: string; name?: string }) => Promise<void>;
  markItemPurchased: (itemId: string, userId: string, price?: number, participants?: string[], category?: ExpenseCategory, note?: string, purchaseDate?: Date) => Promise<void>;
  addItemToShoppingList: (name: string, userId: string) => Promise<void>;
  markItemForRepurchase: (itemId: string) => Promise<void>;
  removeShoppingItem: (itemId: string) => Promise<void>;

  // Actions - Cleaning (Firestore-based)
  loadCleaningTask: () => Promise<void>;
  markCleaningCompleted: () => Promise<void>;
  
  // New checklist actions (Firestore-based)
  loadCleaningChecklist: () => Promise<void>;
  completeChecklistItem: (itemId: string) => Promise<void>;
      uncompleteChecklistItem: (itemId: string) => Promise<void>;
    addChecklistItem: (title: string, order?: number) => Promise<void>;
    removeChecklistItem: (itemId: string) => Promise<void>;
    finishCleaningTurn: () => Promise<void>;
    
    // Member management actions
    removeApartmentMember: (targetUserId: string) => Promise<void>;
    checkMemberCanBeRemoved: (targetUserId: string) => Promise<{
      canBeRemoved: boolean;
      reason?: string;
    }>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      expenses: [],
      debtSettlements: [],
      shoppingItems: [],
      cleaningTask: undefined,
      cleaningSettings: {
        intervalDays: 7,
        anchorDow: 0, // Sunday
        preferredDayByUser: {},
      },
      
      // Checklist state (Firestore-based)
      checklistItems: [],
      isMyCleaningTurn: false,
      _loadingChecklist: false,

      // User & Apartment actions
      setCurrentUser: (user) => set({ currentUser: user }),

      createApartment: (name) => {
        const code = Math.random().toString(36).toUpperCase().slice(2, 8);
        const currentUser = get().currentUser;
        const apartment: Apartment = {
          id: uuidv4(),
          name,
          invite_code: code,
          members: currentUser ? [currentUser] : [],
          createdAt: new Date(),
        };
        set({ currentApartment: apartment });
      },

      joinApartment: (code, userName) => {
        // Mock join
        const user: User = {
          id: uuidv4(),
          name: userName,
          email: '', // Required field
        };
        const apartment: Apartment = {
          id: uuidv4(),
          name: 'דירת שותפים',
          invite_code: code,
          members: [user],
          createdAt: new Date(),
        };
        set({ currentUser: user, currentApartment: apartment });
      },

      // ===== EXPENSES ACTIONS (Firestore-based) =====

      addExpense: async (expense) => {
        try {
          const { currentUser } = get();
          if (!currentUser) {
            throw new Error('No current user');
          }

          // Add expense to Firestore
          await firestoreService.addExpense({
            amount: expense.amount,
            category: expense.category,
            participants: expense.participants,
            title: expense.title,
            note: expense.description,
          });

          // Reload expenses from Firestore
          await get().loadExpenses();
        } catch (error) {
          console.error('Error adding expense:', error);
          throw error;
        }
      },

      updateExpense: async (expenseId, updates) => {
        try {
          const { currentUser } = get();
          if (!currentUser) {
            throw new Error('No current user');
          }

          // Update expense using Firebase Web SDK (replaces REST API version)
          await firestoreSDKService.updateExpense({
            expenseId,
            amount: updates.amount,
            category: updates.category,
            participants: updates.participants,
            title: updates.title,
            note: updates.description,
          });

          // Reload expenses from Firestore
          await get().loadExpenses();
        } catch (error) {
          console.error('Error updating expense:', error);
          throw error;
        }
      },

      deleteExpense: async (expenseId) => {
        try {
          const { currentUser } = get();
          if (!currentUser) {
            throw new Error('No current user');
          }

          // Delete expense from Firestore
          await firestoreService.deleteExpense(expenseId);

          // Reload expenses from Firestore
          await get().loadExpenses();
        } catch (error) {
          console.error('Error deleting expense:', error);
          throw error;
        }
      },

      loadExpenses: async () => {
        try {
          const expensesData = await firestoreService.getExpenses();
          
          // Convert Firestore format to local format (keep all expenses for balance calculation)
          const expenses: Expense[] = expensesData.map((doc: any) => {
            const note = doc.fields?.note?.stringValue;
            const isHiddenDebtSettlement = note && note.includes('HIDDEN_DEBT_SETTLEMENT_');
            const isDebtSettlementMessage = note && note.includes('DEBT_SETTLEMENT_MESSAGE_');
            const category = doc.fields?.category?.stringValue as ExpenseCategory;
            
            // Parse debt settlement message
            let debtSettlementMessage = '';
            if (isDebtSettlementMessage) {
              const parts = note.split('_');
              if (parts.length >= 3) {
                const amount = parts[3];
                // We'll use the participants from the expense to get the names
                const fromUserId = doc.fields?.paid_by_user_id?.stringValue;
                const participants = doc.fields?.participants?.arrayValue?.values?.map((v: any) => v.stringValue) || [];
                const toUserId = participants.find((p: string) => p !== fromUserId);
                
                if (fromUserId && toUserId) {
                  // We'll need to get the actual names in the component
                  debtSettlementMessage = `${fromUserId} שילם ${amount}₪ ל-${toUserId}`;
                }
              }
            }
            
            return {
              id: doc.name.split('/').pop() || uuidv4(),
              title: isHiddenDebtSettlement ? 'סגירת חוב' : 
                     isDebtSettlementMessage ? 'סגירת חוב' : 
                     (doc.fields?.title?.stringValue || doc.fields?.note?.stringValue || 'הוצאה'),
              amount: doc.fields?.amount?.doubleValue || 0,
              paidBy: doc.fields?.paid_by_user_id?.stringValue || '',
              participants: doc.fields?.participants?.arrayValue?.values?.map((v: any) => v.stringValue) || [],
              category: category || 'groceries',
              date: new Date(doc.fields?.created_at?.timestampValue || Date.now()),
              description: isDebtSettlementMessage ? debtSettlementMessage : note,
              isHiddenDebtSettlement: isHiddenDebtSettlement, // Add flag for filtering
              isDebtSettlementMessage: isDebtSettlementMessage, // Add flag for debt settlement messages
            };
          });

          set({ expenses });
        } catch (error) {
          console.error('Error loading expenses:', error);
        }
      },

      loadDebtSettlements: async () => {
        try {
          const settlementsData = await firestoreService.getDebtSettlements();
          
          // Convert Firestore format to local format
          const debtSettlements: DebtSettlement[] = settlementsData.map((doc: any) => ({
            id: doc.name.split('/').pop() || uuidv4(),
            fromUserId: doc.fields?.payer_user_id?.stringValue || '',
            toUserId: doc.fields?.receiver_user_id?.stringValue || '',
            amount: doc.fields?.amount?.doubleValue || 0,
            description: doc.fields?.description?.stringValue || '',
            date: new Date(doc.fields?.created_at?.timestampValue || Date.now()),
          }));

          set({ debtSettlements });
        } catch (error) {
          console.error('Error loading debt settlements:', error);
        }
      },

      // ===== SHOPPING ACTIONS (Firestore-based) =====

      addShoppingItem: async (name, userId, priority, quantity, notes) => {
        try {
          await firestoreService.addShoppingItem(name, userId, priority, quantity, notes);
          await get().loadShoppingItems();
        } catch (error) {
          console.error('Error adding shopping item:', error);
          throw error;
        }
      },

      updateShoppingItem: async (itemId, updates) => {
        try {
          await firestoreService.updateShoppingItem(itemId, updates);
          await get().loadShoppingItems();
        } catch (error) {
          console.error('Error updating shopping item:', error);
          throw error;
        }
      },

      loadShoppingItems: async () => {
        try {
          const shoppingData = await firestoreService.getShoppingItems();
          
          const shoppingItems: ShoppingItem[] = shoppingData.map((item: any) => ({
            id: item.id || uuidv4(),
            name: item.title || item.name || '',
            addedBy: item.added_by_user_id || '',
            quantity: item.quantity || 1,
            priority: item.priority || 'normal',
            notes: item.notes || '',
            purchased: item.purchased || false,
            purchasedBy: item.purchased_by_user_id || '',
            purchasePrice: item.price || null,
            createdAt: item.created_at ? new Date(item.created_at) : new Date(),
            purchasedAt: item.purchased_at ? new Date(item.purchased_at) : undefined,
            addedAt: item.created_at ? new Date(item.created_at) : new Date(),
          }));

          set({ shoppingItems });
        } catch (error) {
          console.error('Error loading shopping items:', error);
        }
      },

      markItemPurchased: async (itemId, userId, price, participants, category, note, purchaseDate) => {
        try {
          // First, get the item details before marking as purchased
          const { shoppingItems, currentApartment } = get();
          const item = shoppingItems.find(i => i.id === itemId);
          
          if (!item) {
            throw new Error('Shopping item not found');
          }

          // Mark item as purchased in Firestore
          await firestoreService.markShoppingItemPurchased(itemId, userId, price);
          
          // Create expense if price is provided
          if (price && price > 0 && currentApartment) {
            // Use provided participants or default to all apartment members
            const participantIds = participants && participants.length > 0 
              ? participants 
              : currentApartment.members.map(member => member.id);
            
            await get().addExpense({
              title: item.name,
              amount: price,
              paidBy: userId,
              participants: participantIds,
              category: category || 'groceries',
              description: note || `רכישה מרשימת הקניות`
            });
          }
          
          // Reload shopping items to reflect changes
          await get().loadShoppingItems();
          
          // If expense was created, also reload expenses
          if (price && price > 0) {
            await get().loadExpenses();
          }
        } catch (error) {
          console.error('Error marking item purchased:', error);
          throw error;
        }
      },

      addItemToShoppingList: async (name, userId) => {
        try {
          await firestoreService.addShoppingItem(name, userId);
          await get().loadShoppingItems();
        } catch (error) {
          console.error('Error adding item to shopping list:', error);
          throw error;
        }
      },

      markItemForRepurchase: async (itemId) => {
        try {
          // For now, we'll create a new item with the same name
          // In the future, this could be a separate field in Firestore
          const { shoppingItems, currentUser } = get();
          const item = shoppingItems.find(i => i.id === itemId);
          
          if (!item) {
            throw new Error('Shopping item not found');
          }

          if (!currentUser) {
            throw new Error('No current user');
          }

          // Add the item again to the shopping list with current user
          // Preserve the original priority, quantity, and notes
          await get().addShoppingItem(
            item.name, 
            currentUser.id, 
            item.priority || 'normal',
            item.quantity || 1,
            item.notes || ''
          );
        } catch (error) {
          console.error('Error marking item for repurchase:', error);
          throw error;
        }
      },

      // ===== CLEANING ACTIONS (Firestore-based) =====

      loadCleaningTask: async () => {
        try {
          const cleaningTaskData = await firestoreService.getCleaningTask();
          if (cleaningTaskData) {
            const state = get();
            const { intervalDays, anchorDow } = state.cleaningSettings;
            
            // Calculate proper due date based on last completion or current time
            let dueDate: Date;
            if (cleaningTaskData.last_completed_at) {
              const lastCompleted = new Date(cleaningTaskData.last_completed_at);
              const { periodEnd } = computePeriodBounds(lastCompleted, anchorDow, intervalDays);
              dueDate = periodEnd;
            } else {
              // No previous completion, use current time as baseline
              const { periodEnd } = computePeriodBounds(new Date(), anchorDow, intervalDays);
              dueDate = periodEnd;
            }

            const cleaningTask: CleaningTask = {
              id: cleaningTaskData.id || uuidv4(),
              queue: cleaningTaskData.queue || [],
              currentTurn: cleaningTaskData.user_id || cleaningTaskData.queue?.[0] || '',
              dueDate,
              intervalDays,
              lastCleaned: cleaningTaskData.last_completed_at ? 
                new Date(cleaningTaskData.last_completed_at) : undefined,
              lastCleanedBy: cleaningTaskData.last_completed_by,
              status: 'pending',
              history: [], // TODO: Load from separate collection if needed
              // Add new fields for cycle calculation
              assigned_at: cleaningTaskData.assigned_at,
              frequency_days: cleaningTaskData.frequency_days || intervalDays,
              last_completed_at: cleaningTaskData.last_completed_at,
              last_completed_by: cleaningTaskData.last_completed_by,
            };

            set({ cleaningTask });
          }
        } catch (error) {
          console.error('Error loading cleaning task:', error);
        }
      },

      markCleaningCompleted: async () => {
        try {
          await firestoreService.markCleaningCompleted();
          await get().loadCleaningTask();
        } catch (error) {
          console.error('Error marking cleaning completed:', error);
          throw error;
        }
      },

      // ===== NEW CHECKLIST ACTIONS (Firestore-based) =====

      loadCleaningChecklist: async () => {
        const state = get();
        if (state._loadingChecklist) {
          console.log('🔄 loadCleaningChecklist already in progress, skipping...');
          return;
        }
        
        set({ _loadingChecklist: true });
        
        try {
          // Read both cleaning task and checklist items to determine turn status
          const s = get();
          const { currentUser } = s;
          const task = await firestoreService.getCleaningTask();
          const items = await firestoreService.getCleaningChecklist();
          
          // Debug logging to help identify the issue
          const currentTurnUserId = getCurrentTurnUserId(task);
          const isMyTurn = !!(task && currentUser && currentTurnUserId === currentUser.id);
          
          console.log('🔍 Turn check debug:', {
            taskExists: !!task,
            currentUserExists: !!currentUser,
            currentTurnUserId,
            currentUserId: currentUser?.id,
            isMyTurn,
            taskUserField: task?.user_id,
            taskCurrentTurn: task?.currentTurn
          });

          set({
            checklistItems: items,
            isMyCleaningTurn: isMyTurn,
          });
        } catch (error) {
          console.error('Error loading checklist:', error);
        } finally {
          set({ _loadingChecklist: false });
        }
      },

      completeChecklistItem: async (itemId: string) => {
        const state = get();
        const { isMyCleaningTurn, checklistItems, currentUser, currentApartment } = state;
        
        console.log('🔧 Attempting to complete checklist item:', {
          itemId,
          isMyTurn: isMyCleaningTurn,
          hasUser: !!currentUser,
          userId: currentUser?.id,
          apartmentId: currentUser?.current_apartment_id,
          localApartmentId: currentApartment?.id
        });
        
        // Enhanced security check
        if (!isMyCleaningTurn || !currentUser) {
          console.warn('Cannot complete checklist item: not your turn or no user');
          return;
        }

        // Ensure user has apartment context
        if (!currentUser.current_apartment_id && !currentApartment?.id) {
          console.warn('Cannot complete checklist item: no apartment context');
          throw new Error('לא ניתן לעדכן משימה - אין הקשר דירה. אנא נסה להתחבר מחדש.');
        }

        // Find the item to ensure it exists
        const item = checklistItems.find(it => it.id === itemId);
        if (!item) {
          console.warn('Cannot complete checklist item: item not found');
          return;
        }

        // Optimistic: mark locally immediately
        const originalItems = [...checklistItems];
        set({
          checklistItems: checklistItems.map(it =>
            it.id === itemId ? { ...it, completed: true, completed_by: currentUser.id } : it
          )
        });

        try {
          await firestoreService.markChecklistItemCompleted(itemId);
          // Reload to sync (and see completed_by/at)
          await get().loadCleaningChecklist();
        } catch (error) {
          console.error('Error completing checklist item:', error);
          // Rollback on error
          set({ checklistItems: originalItems });
          throw error; // Re-throw to let UI handle it
        }
      },

      uncompleteChecklistItem: async (itemId: string) => {
        const state = get();
        const { isMyCleaningTurn, checklistItems, currentUser } = state;
        
        // Enhanced security check
        if (!isMyCleaningTurn || !currentUser) {
          console.warn('Cannot uncomplete checklist item: not your turn or no user');
          return;
        }

        // Find the item to ensure it exists
        const item = checklistItems.find(it => it.id === itemId);
        if (!item) {
          console.warn('Cannot uncomplete checklist item: item not found');
          return;
        }

        // Optimistic: unmark locally immediately
        set({
          checklistItems: checklistItems.map(it =>
            it.id === itemId ? { ...it, completed: false, completed_by: null, completed_at: null } : it
          )
        });

        try {
          await firestoreService.unmarkChecklistItemCompleted(itemId);
          // Reload to sync
          await get().loadCleaningChecklist();
        } catch (error) {
          console.error('Error uncompleting checklist item:', error);
          // Rollback on error
          set({ checklistItems });
        }
      },

      addChecklistItem: async (title: string, order?: number) => {
        const state = get();
        const { currentUser } = state;
        
        // Security check - only allow adding items if user is authenticated
        if (!currentUser) {
          console.warn('Cannot add checklist item: no authenticated user');
          throw new Error('Not authorized to add checklist items');
        }

        if (!title.trim()) {
          console.warn('Cannot add checklist item: empty title');
          throw new Error('Title cannot be empty');
        }

        try {
          await firestoreService.addChecklistItem(title.trim(), order);
          // Reload to get the new item with proper ID
          await get().loadCleaningChecklist();
        } catch (error) {
          console.error('Error adding checklist item:', error);
          throw error;
        }
      },

      removeChecklistItem: async (itemId: string) => {
        const state = get();
        const { currentUser } = state;
        
        // Security check - only allow removing items if user is authenticated
        if (!currentUser) {
          console.warn('Cannot remove checklist item: no authenticated user');
          throw new Error('Not authorized to remove checklist items');
        }

        try {
          await firestoreService.removeChecklistItem(itemId);
          // Reload to get the updated list
          await get().loadCleaningChecklist();
        } catch (error) {
          console.error('Error removing checklist item:', error);
          throw error;
        }
      },

      finishCleaningTurn: async () => {
        const state = get();
        const { isMyCleaningTurn, currentUser, checklistItems, cleaningTask } = state;
        
        // Enhanced security check
        if (!isMyCleaningTurn || !currentUser || !cleaningTask) {
          console.warn('Cannot finish cleaning turn: not your turn or no user or no task');
          throw new Error('Not authorized to finish cleaning turn');
        }

        // Import cycle calculation functions
        const { isTurnCompletedForCurrentCycle } = await import('../utils/dateUtils');
        
        // Check if turn is already completed for current cycle
        const isAlreadyCompleted = isTurnCompletedForCurrentCycle({
          uid: currentUser.id,
          task: {
            assigned_at: cleaningTask.assigned_at || null,
            frequency_days: cleaningTask.frequency_days || cleaningTask.intervalDays,
            last_completed_at: cleaningTask.last_completed_at || null,
            last_completed_by: cleaningTask.last_completed_by || null,
          },
          checklistItems: checklistItems.map(item => ({
            completed: item.completed,
            completed_by: item.completed_by,
            completed_at: item.completed_at,
          }))
        });

        if (isAlreadyCompleted) {
          console.log('Turn already completed for current cycle');
          return; // Don't throw error, just return silently
        }

        // Check if all items are completed
        const completedItems = checklistItems.filter(item => item.completed);
        if (completedItems.length < checklistItems.length) {
          console.warn('Cannot finish cleaning turn: not all items completed');
          throw new Error('Cannot finish turn: not all cleaning tasks are completed');
        }

        try {
          // Reset all checklist items first
          await firestoreService.resetAllChecklistItems();
          // Then mark cleaning as completed (moves to next person)
          await firestoreService.markCleaningCompleted();
          // Reload both task and checklist
          await Promise.all([
            get().loadCleaningTask(),
            get().loadCleaningChecklist(),
          ]);
        } catch (error) {
          console.error('Error finishing cleaning turn:', error);
          throw error;
        }
      },

      

      // Cleaning actions
      initializeCleaning: async () => {
        try {
          const state = get();
          const apt = state.currentApartment;
          if (!apt || apt.members.length === 0) return;

          // Try to get existing task from Firestore, or create if doesn't exist
          const task = await firestoreService.getCleaningTask();
          if (task) {
            // Task exists, load it into state
            set({ 
              cleaningTask: {
                id: task.id,
                currentTurn: task.user_id || apt.members[0]?.id,
                queue: task.queue && task.queue.length > 0 ? task.queue : apt.members.map(m => m.id),
                dueDate: new Date(), // TODO: Calculate proper due date
                intervalDays: state.cleaningSettings.intervalDays,
                status: 'pending' as const,
                history: [],
              }
            });
          }
          
          // Also load the checklist
          await get().loadCleaningChecklist();
        } catch (error) {
          console.error('Error initializing cleaning:', error);
        }
      },

      updateQueueFromMembers: () => {
        const state = get();
        const apt = state.currentApartment;
        if (!apt || !state.cleaningTask) return;
        const newQueue = apt.members.map((m) => m.id);
        if (newQueue.length === 0) return;
        const currentTurn = state.cleaningTask.currentTurn;
        const nextTurn = newQueue.includes(currentTurn) ? currentTurn : newQueue[0];
        set({
          cleaningTask: {
            ...state.cleaningTask,
            currentTurn: nextTurn,
            queue: newQueue,
          },
        });
      },

      refreshApartmentMembers: async () => {
        try {
          console.log('🔄 Refreshing apartment members...');
          
          // Get complete apartment data using the new reliable method
          // This now uses requireSession() internally to ensure valid auth
          const completeApartmentData = await firestoreService.getCompleteApartmentData();
          
          if (!completeApartmentData) {
            console.log('❌ No apartment data found for user');
            return;
          }
          
          console.log('✅ Got complete apartment data:', {
            id: completeApartmentData.id,
            name: completeApartmentData.name,
            memberCount: completeApartmentData.members.length
          });
          
          // Update the apartment with complete data
          set({
            currentApartment: completeApartmentData
          });
          
          // Also update the cleaning queue if there's an active task
          const state = get();
          if (state.cleaningTask) {
            const newQueue = completeApartmentData.members.map((m: User) => m.id);
            if (newQueue.length > 0) {
              const currentTurn = state.cleaningTask.currentTurn;
              const nextTurn = newQueue.includes(currentTurn) ? currentTurn : newQueue[0];
              set({
                cleaningTask: {
                  ...state.cleaningTask,
                  currentTurn: nextTurn,
                  queue: newQueue,
                },
              });
            }
          }
          
        } catch (error) {
          console.error('❌ Error refreshing apartment members:', error);
          
          // If it's an auth error, we might need to redirect to login
          if (error instanceof Error && error.message.includes('AUTH_REQUIRED')) {
            console.log('🔐 Auth required - user needs to sign in again');
            // You might want to trigger a sign-out or redirect to login here
          }
        }
      },



      checkOverdueTasks: async () => {
        try {
          // Load current task from Firestore to check if overdue
          const task = await firestoreService.getCleaningTask();
          if (!task || !task.last_completed_at) return;

          // For now, just log - the actual overdue logic should be handled by Firestore
          console.log('Checking overdue tasks for task:', task.id);
          
          // TODO: Implement overdue logic with Firestore if needed
          // This might involve checking against a due_date field in Firestore
        } catch (error) {
          console.error('Error checking overdue tasks:', error);
        }
      },

      // Cleaning settings actions
      setCleaningIntervalDays: (days) => {
        if (days < 1) return;
        set((state) => ({
          cleaningSettings: { ...state.cleaningSettings, intervalDays: days },
        }));
        // Recompute due date for current task to align to new schedule
        const s = get();
        if (s.cleaningTask) {
          const { periodEnd } = computePeriodBounds(
            new Date(),
            s.cleaningSettings.anchorDow,
            days
          );
          set({ cleaningTask: { ...s.cleaningTask, intervalDays: days, dueDate: periodEnd } });
        }
      },

      setCleaningAnchorDow: (dow) => {
        if (dow < 0 || dow > 6) return;
        set((state) => ({
          cleaningSettings: { ...state.cleaningSettings, anchorDow: dow },
        }));
        const s = get();
        if (s.cleaningTask) {
          const { periodEnd } = computePeriodBounds(
            new Date(),
            dow,
            s.cleaningSettings.intervalDays
          );
          set({ cleaningTask: { ...s.cleaningTask, dueDate: periodEnd } });
        }
      },

      setPreferredDay: (userId, dow) => {
        set((state) => ({
          cleaningSettings: {
            ...state.cleaningSettings,
            preferredDayByUser: { ...state.cleaningSettings.preferredDayByUser, [userId]: dow },
          },
        }));
      },



      getBalances: () => {
        const { expenses, debtSettlements } = get();
        
        const balances: { [userId: string]: Balance } = {};

        const ensure = (userId: string | undefined) => {
          if (!userId) return false;
          if (!balances[userId]) {
            balances[userId] = { userId, owes: {}, owed: {}, netBalance: 0 };
          }
          return true;
        };

        // Calculate balances from expenses - don't rely on apartment members list
        expenses.forEach((expense) => {
          try {
            if (!expense || typeof expense.amount !== 'number' || !isFinite(expense.amount)) return;

            const paidBy = expense.paidBy;
            const participants = Array.isArray(expense.participants) ? expense.participants : [];
            const validParticipants = participants.filter((pid) => pid && typeof pid === 'string');

            if (!paidBy || typeof paidBy !== 'string') return; // skip expenses with unknown payer
            if (validParticipants.length === 0) return; // nothing to split

            // Use precise calculation to avoid rounding errors
            const perPersonAmount = Math.round((expense.amount / validParticipants.length) * 100) / 100;

            // Ensure payer exists in balances
            ensure(paidBy);

            validParticipants.forEach((participantId) => {
              if (!participantId || participantId === paidBy) return;
              
              // Ensure participant exists in balances
              ensure(participantId);

              if (balances[participantId].owes[paidBy] == null) {
                balances[participantId].owes[paidBy] = 0;
              }
              if (balances[paidBy].owed[participantId] == null) {
                balances[paidBy].owed[participantId] = 0;
              }

              balances[participantId].owes[paidBy] = Math.round((balances[participantId].owes[paidBy] + perPersonAmount) * 100) / 100;
              balances[paidBy].owed[participantId] = Math.round((balances[paidBy].owed[participantId] + perPersonAmount) * 100) / 100;
            });
          } catch (e) {
            console.warn('Error processing expense for balance calculation:', e);
          }
        });

        // Note: debtSettlements are now legacy - new system uses Firestore debts/balances
        // This calculation is kept for backward compatibility display only

        // Calculate net balances between users (eliminate duplicate debts)
        const userIds = Object.keys(balances);
        for (let i = 0; i < userIds.length; i++) {
          for (let j = i + 1; j < userIds.length; j++) {
            const user1 = userIds[i];
            const user2 = userIds[j];
            
            const user1OwesUser2 = balances[user1].owes[user2] || 0;
            const user2OwesUser1 = balances[user2].owes[user1] || 0;
            
            if (user1OwesUser2 > 0 && user2OwesUser1 > 0) {
              // Net out the debts
              const netAmount = Math.round((user1OwesUser2 - user2OwesUser1) * 100) / 100;
              
              // Clear both debts
              delete balances[user1].owes[user2];
              delete balances[user1].owed[user2];
              delete balances[user2].owes[user1];
              delete balances[user2].owed[user1];
              
              // Set the net debt
              if (netAmount > 0.01) {
                balances[user1].owes[user2] = netAmount;
                balances[user2].owed[user1] = netAmount;
              } else if (netAmount < -0.01) {
                balances[user2].owes[user1] = Math.abs(netAmount);
                balances[user1].owed[user2] = Math.abs(netAmount);
              }
            }
          }
        }

        // Calculate final net balances
        Object.values(balances).forEach((balance) => {
          const totalOwed = Object.values(balance.owed).reduce((sum, amount) => sum + amount, 0);
          const totalOwes = Object.values(balance.owes).reduce((sum, amount) => sum + amount, 0);
          balance.netBalance = Math.round((totalOwed - totalOwes) * 100) / 100;
        });

        return Object.values(balances);
      },

      // Get raw balances (before netting out debts) - shows all individual debts
      getRawBalances: () => {
        const { expenses, debtSettlements } = get();
        
        const balances: { [userId: string]: Balance } = {};

        const ensure = (userId: string | undefined) => {
          if (!userId) return false;
          if (!balances[userId]) {
            balances[userId] = { userId, owes: {}, owed: {}, netBalance: 0 };
          }
          return true;
        };

        // Calculate balances from expenses - don't rely on apartment members list
        expenses.forEach((expense) => {
          try {
            if (!expense || typeof expense.amount !== 'number' || !isFinite(expense.amount)) return;

            const paidBy = expense.paidBy;
            const participants = Array.isArray(expense.participants) ? expense.participants : [];
            const validParticipants = participants.filter((pid) => pid && typeof pid === 'string');

            if (!paidBy || typeof paidBy !== 'string') return; // skip expenses with unknown payer
            if (validParticipants.length === 0) return; // nothing to split

            // Use precise calculation to avoid rounding errors
            const perPersonAmount = Math.round((expense.amount / validParticipants.length) * 100) / 100;

            // Ensure payer exists in balances
            ensure(paidBy);

            validParticipants.forEach((participantId) => {
              if (!participantId || participantId === paidBy) return;
              
              // Ensure participant exists in balances
              ensure(participantId);

              if (balances[participantId].owes[paidBy] == null) {
                balances[participantId].owes[paidBy] = 0;
              }
              if (balances[paidBy].owed[participantId] == null) {
                balances[paidBy].owed[participantId] = 0;
              }

              balances[participantId].owes[paidBy] = Math.round((balances[participantId].owes[paidBy] + perPersonAmount) * 100) / 100;
              balances[paidBy].owed[participantId] = Math.round((balances[paidBy].owed[participantId] + perPersonAmount) * 100) / 100;
            });
          } catch (e) {
            console.warn('Error processing expense for balance calculation:', e);
          }
        });

        // Calculate final net balances but DON'T net out the debts
        Object.values(balances).forEach((balance) => {
          const totalOwed = Object.values(balance.owed).reduce((sum, amount) => sum + amount, 0);
          const totalOwes = Object.values(balance.owes).reduce((sum, amount) => sum + amount, 0);
          balance.netBalance = Math.round((totalOwed - totalOwes) * 100) / 100;
        });

        return Object.values(balances);
      },

      // Simplified balances using debt simplification algorithm
      getSimplifiedBalances: () => {
        const balances = get().getBalances();
        const simplified: { [userId: string]: Balance } = {};
        
        // Initialize simplified balances
        balances.forEach(balance => {
          simplified[balance.userId] = {
            userId: balance.userId,
            owes: {},
            owed: {},
            netBalance: balance.netBalance
          };
        });

        // Create a list of all debts
        const debts: Array<{ from: string, to: string, amount: number }> = [];
        balances.forEach(balance => {
          Object.entries(balance.owes).forEach(([toUserId, amount]) => {
            if (amount > 0.01) {
              debts.push({ from: balance.userId, to: toUserId, amount });
            }
          });
        });

        // Apply debt simplification algorithm
        // This is a simplified version - for complex scenarios, use more advanced algorithms
        const userNetBalances: { [userId: string]: number } = {};
        balances.forEach(balance => {
          userNetBalances[balance.userId] = balance.netBalance;
        });

        // Sort users by net balance (creditors first, then debtors)
        const sortedUsers = Object.keys(userNetBalances).sort((a, b) => userNetBalances[b] - userNetBalances[a]);
        
        // Simplify debts by matching creditors with debtors
        const creditors = sortedUsers.filter(userId => userNetBalances[userId] > 0.01);
        const debtors = sortedUsers.filter(userId => userNetBalances[userId] < -0.01);

        creditors.forEach(creditor => {
          let remainingCredit = userNetBalances[creditor];
          
          debtors.forEach(debtor => {
            if (remainingCredit > 0.01 && userNetBalances[debtor] < -0.01) {
              const debtAmount = Math.abs(userNetBalances[debtor]);
              const transferAmount = Math.min(remainingCredit, debtAmount);
              
              if (transferAmount > 0.01) {
                // Round to 2 decimal places
                const roundedAmount = Math.round(transferAmount * 100) / 100;
                
                simplified[debtor].owes[creditor] = roundedAmount;
                simplified[creditor].owed[debtor] = roundedAmount;
                
                remainingCredit -= roundedAmount;
                userNetBalances[debtor] += roundedAmount;
              }
            }
          });
        });

        return Object.values(simplified);
      },

      // Get monthly expenses with detailed breakdown
      getMonthlyExpenses: (year: number, month: number) => {
        const { expenses, currentUser } = get();
        
        const monthlyExpenses = expenses.filter(expense => {
          try {
            // Skip hidden debt settlement expenses
            if (expense.isHiddenDebtSettlement) {
              return false;
            }
            
            const expenseDate = new Date(expense.date);
            if (isNaN(expenseDate.getTime())) return false;
            return expenseDate.getMonth() === month && expenseDate.getFullYear() === year;
          } catch {
            return false;
          }
        });

        // Sort expenses by date in descending order (newest first)
        const sortedExpenses = monthlyExpenses.sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB.getTime() - dateA.getTime(); // Descending order (newest first)
        });

        const total = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        
        // Calculate personal total (expenses where current user participated)
        const personalTotal = monthlyExpenses
          .filter(expense => currentUser && expense.participants.includes(currentUser.id))
          .reduce((sum, expense) => {
            const personalShare = expense.amount / expense.participants.length;
            return sum + personalShare;
          }, 0);

        return {
          expenses: sortedExpenses,
          total: Math.round(total * 100) / 100,
          personalTotal: Math.round(personalTotal * 100) / 100
        };
      },

      // Get total apartment expenses for a specific month
      getTotalApartmentExpenses: (year: number, month: number) => {
        const { expenses } = get();
        
        const monthlyExpenses = expenses.filter(expense => {
          try {
            // Skip hidden debt settlement expenses and debt settlement messages (they have zero amount)
            if (expense.isHiddenDebtSettlement || expense.isDebtSettlementMessage) {
              return false;
            }
            
            const expenseDate = new Date(expense.date);
            if (isNaN(expenseDate.getTime())) return false;
            return expenseDate.getMonth() === month && expenseDate.getFullYear() === year;
          } catch {
            return false;
          }
        });

        const total = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        return Math.round(total * 100) / 100;
      },

      // Shopping actions
      removeShoppingItem: async (itemId) => {
        try {
          await firestoreService.deleteShoppingItem(itemId);
          // Remove from local state after successful deletion from server
          set((state) => ({
            shoppingItems: state.shoppingItems.filter((item) => item.id !== itemId),
          }));
        } catch (error) {
          console.error('Error removing shopping item:', error);
          throw error;
        }
      },

      // ===== NEW DEBTS & BALANCES ACTIONS (Firestore-based) =====

      /**
       * Load debts from Firestore
       */
      loadDebts: async () => {
        try {
          await firestoreService.getDebts();
          console.log('✅ Debts loaded successfully');
        } catch (error) {
          console.error('❌ Error loading debts:', error);
          throw error;
        }
      },

      /**
       * Load actions from Firestore
       */
      loadActions: async () => {
        try {
          await firestoreService.getActions();
          console.log('✅ Actions loaded successfully');
        } catch (error) {
          console.error('❌ Error loading actions:', error);
          throw error;
        }
      },

      /**
       * Get user balance from Firestore
       */
      getUserBalance: async (userId: string) => {
        try {
          const balance = await firestoreService.getUserBalance(userId);
          console.log('✅ User balance retrieved:', { userId, balance });
          return balance;
        } catch (error) {
          console.error('❌ Error getting user balance:', error);
          return 0;
        }
      },

      /**
       * Create and close debt atomically - for the current system that doesn't use debts collection
       * This creates a debt record first, then closes it with all the required operations
       */
      createAndCloseDebtAtomic: async (fromUserId: string, toUserId: string, amount: number, description?: string) => {
        try {
          const { currentUser } = get();
          if (!currentUser) {
            throw new Error('AUTH_REQUIRED');
          }

          console.log('🔒 [createAndCloseDebtAtomic] Starting debt creation and closure:', {
            fromUserId,
            toUserId,
            amount,
            description,
            userId: currentUser.id
          });

          // Use the new atomic createAndCloseDebt function from firestoreService
          const result = await firestoreService.createAndCloseDebtAtomic(fromUserId, toUserId, amount, description);
          
          console.log('✅ [createAndCloseDebtAtomic] Debt created and closed atomically:', result);
          return result;
        } catch (error) {
          console.error('❌ [createAndCloseDebtAtomic] Error creating and closing debt atomically:', error);
          console.error('❌ [createAndCloseDebtAtomic] Error details in store:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : String(error),
            code: (error as any)?.code || 'Unknown',
            stack: error instanceof Error ? error.stack : 'No stack'
          });
          throw error;
        }
      },

      /**
       * Close debt and refresh balances from client side
       * This bypasses Cloud Functions and updates everything atomically
       */
      closeDebtAndRefreshBalances: async (
        debtId: string,
        { payerUserId, receiverUserId, amount }: { payerUserId: string; receiverUserId: string; amount: number; }
      ) => {
        try {
          const { currentUser, currentApartment } = get();
          if (!currentUser || !currentApartment) {
            throw new Error('AUTH_REQUIRED');
          }

          console.log('🔒 [closeDebtAndRefreshBalances] Starting debt closure and balance refresh:', {
            debtId,
            payerUserId,
            receiverUserId,
            amount,
            apartmentId: currentApartment.id,
            userId: currentUser.id
          });

          // Use the new client-side debt closing function
          await firestoreService.closeDebtAndRefreshBalances(
            currentApartment.id,
            debtId,
            { payerUserId, receiverUserId, amount }
          );
          
          console.log('✅ [closeDebtAndRefreshBalances] Debt closed and balances refreshed successfully');
        } catch (error) {
          console.error('❌ [closeDebtAndRefreshBalances] Error closing debt and refreshing balances:', error);
          throw error;
        }
      },

      /**
       * Create a debt for settlement purposes
       */
      createDebtForSettlement: async (fromUserId: string, toUserId: string, amount: number, description?: string) => {
        try {
          const { currentUser, currentApartment } = get();
          if (!currentUser || !currentApartment) {
            throw new Error('AUTH_REQUIRED');
          }

          console.log('🔒 [createDebtForSettlement] Creating debt for settlement:', {
            fromUserId,
            toUserId,
            amount,
            description,
            apartmentId: currentApartment.id,
            userId: currentUser.id
          });

          // Create debt using Firestore SDK
          const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
          const db = getFirestore();
          
          const debtRef = await addDoc(collection(db, 'debts'), {
            apartment_id: currentApartment.id,
            from_user_id: fromUserId,
            to_user_id: toUserId,
            amount: amount,
            status: 'open',
            created_at: serverTimestamp(),
            description: description || 'חוב לסגירה'
          });
          
          console.log('✅ [createDebtForSettlement] Debt created successfully:', debtRef.id);
          return debtRef.id;
        } catch (error) {
          console.error('❌ [createDebtForSettlement] Error creating debt:', error);
          throw error;
        }
      },

      /**
       * Initialize the new debt system with real-time listeners
       */
      initializeDebtSystem: async (apartmentId: string, userIds: string[]) => {
        try {
          // Import dynamically to avoid circular dependencies
          const { initializeDebtListeners } = await import('../store/debts');
          await initializeDebtListeners(apartmentId, userIds);
          console.log('✅ Debt system initialized:', { apartmentId, userIdsCount: userIds.length });
        } catch (error) {
          console.error('❌ Error initializing debt system:', error);
          throw error;
        }
      },

      /**
       * Clean up the debt system listeners
       */
      cleanupDebtSystem: () => {
        try {
          // Import dynamically to avoid circular dependencies
          import('../store/debts').then(({ cleanupListeners }) => {
            cleanupListeners();
            console.log('✅ Debt system cleaned up');
          });
        } catch (error) {
          console.error('❌ Error cleaning up debt system:', error);
        }
      },

      /**
       * Check if a member can be removed (balance validation)
       */
      checkMemberCanBeRemoved: async (targetUserId: string) => {
        const { currentApartment } = get();
        if (!currentApartment) {
          throw new Error('No current apartment found');
        }

        try {
          const balanceData = await firestoreService.getUserBalanceForRemoval(targetUserId, currentApartment.id);
          
          if (!balanceData.canBeRemoved) {
            const reason = balanceData.hasOpenDebts 
              ? 'יש חובות פתוחים'
              : `מאזן של ${balanceData.netBalance.toFixed(2)}₪`;
            return { canBeRemoved: false, reason };
          }
          
          return { canBeRemoved: true };
        } catch (error) {
          console.error('❌ Error checking if member can be removed:', error);
          return { canBeRemoved: false, reason: 'שגיאה בבדיקת המאזן' };
        }
      },

      /**
       * Remove a member from the apartment
       */
      removeApartmentMember: async (targetUserId: string) => {
        const { currentUser, currentApartment } = get();
        if (!currentUser || !currentApartment) {
          throw new Error('No current user or apartment found');
        }

        try {
          // Remove the member using Firestore service
          await firestoreService.removeApartmentMember(
            currentApartment.id, 
            targetUserId, 
            currentUser.id
          );
          
          // Refresh apartment members to update the UI
          await get().refreshApartmentMembers();
          
          console.log('✅ Member removed successfully');
        } catch (error) {
          console.error('❌ Error removing apartment member:', error);
          throw error;
        }
      },
    }),
    {
      name: 'roommate-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist essential data
      partialize: (state) => ({
        currentUser: state.currentUser,
        currentApartment: state.currentApartment,
        cleaningTask: state.cleaningTask,
        cleaningSettings: state.cleaningSettings,
        checklistItems: state.checklistItems,
        expenses: state.expenses,
        debtSettlements: state.debtSettlements,
        shoppingItems: state.shoppingItems,
      }),
    }
  )
);
