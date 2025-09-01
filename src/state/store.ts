import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import { firestoreService } from '../services/firestore-service';
import {
  User,
  Apartment,
  CleaningTask,
  Expense,
  ShoppingItem,
  Balance,
  ExpenseCategory,
  CleaningHistory,
  CleaningChecklist,
  CleaningTaskCompletion,
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

  // Cleaning
  cleaningTask?: CleaningTask;
  cleaningChecklist: CleaningChecklist[];
  cleaningCompletions: CleaningTaskCompletion[];
  cleaningSettings: CleaningSettings;
  
  // New checklist items (Firestore-based)
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
  initializeCleaning: () => void;
  updateQueueFromMembers: () => void;
  markCleaned: (userId: string) => void;
  addCleaningTask: (name: string) => void;
  renameCleaningTask: (taskId: string, newName: string) => void;
  removeCleaningTask: (taskId: string) => void;
  toggleCleaningTask: (taskId: string, completed: boolean) => void;
  checkOverdueTasks: () => void;

  // Cleaning settings
  setCleaningIntervalDays: (days: number) => void;
  setCleaningAnchorDow: (dow: number) => void; // 0..6
  setPreferredDay: (userId: string, dow?: number) => void; // undefined to clear

  // Actions - Expenses
  addExpense: (expense: Omit<Expense, 'id' | 'date'>) => Promise<void>;
  loadExpenses: () => Promise<void>;
  loadDebtSettlements: () => Promise<void>;
  addDebtSettlement: (fromUserId: string, toUserId: string, amount: number, description?: string) => Promise<void>;
  getBalances: () => Balance[];
  getSimplifiedBalances: () => Balance[];
  getMonthlyExpenses: (year: number, month: number) => { expenses: Expense[], total: number, personalTotal: number };
  getTotalApartmentExpenses: (year: number, month: number) => number;

  // Actions - Shopping
  addShoppingItem: (name: string, userId: string) => Promise<void>;
  loadShoppingItems: () => Promise<void>;
  markItemPurchased: (itemId: string, userId: string, price?: number, participants?: string[]) => Promise<void>;
  removeShoppingItem: (itemId: string) => void;

  // Actions - Cleaning (Firestore-based)
  loadCleaningTask: () => Promise<void>;
  markCleaningCompleted: () => Promise<void>;
  
  // New checklist actions (Firestore-based)
  loadCleaningChecklist: () => Promise<void>;
  completeChecklistItem: (itemId: string) => Promise<void>;
  uncompleteChecklistItem: (itemId: string) => Promise<void>;
  addChecklistItem: (title: string, order?: number) => Promise<void>;
  finishCleaningTurn: () => Promise<void>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      expenses: [],
      debtSettlements: [],
      shoppingItems: [],
      cleaningChecklist: [
        { id: '1', name: 'ניקוי מטבח', isDefault: true, isCompleted: false },
        { id: '2', name: 'שטיפת רצפות', isDefault: true, isCompleted: false },
        { id: '3', name: 'ניקוי שירותים', isDefault: true, isCompleted: false },
        { id: '4', name: 'פינוי אשפה', isDefault: true, isCompleted: false },
        { id: '5', name: 'אבק רהיטים', isDefault: true, isCompleted: false },
      ],
      cleaningCompletions: [],
      cleaningSettings: {
        intervalDays: 7,
        anchorDow: 0, // Sunday
        preferredDayByUser: {},
      },
      
      // New checklist state
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

      loadExpenses: async () => {
        try {
          const expensesData = await firestoreService.getExpenses();
          
          // Convert Firestore format to local format
          const expenses: Expense[] = expensesData.map((doc: any) => ({
            id: doc.name.split('/').pop() || uuidv4(),
            title: doc.fields?.title?.stringValue || doc.fields?.note?.stringValue || 'הוצאה',
            amount: doc.fields?.amount?.doubleValue || 0,
            paidBy: doc.fields?.paid_by_user_id?.stringValue || '',
            participants: doc.fields?.participants?.arrayValue?.values?.map((v: any) => v.stringValue) || [],
            category: (doc.fields?.category?.stringValue as ExpenseCategory) || 'groceries',
            date: new Date(doc.fields?.created_at?.timestampValue || Date.now()),
            description: doc.fields?.note?.stringValue,
          }));

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

      addShoppingItem: async (name, userId) => {
        try {
          await firestoreService.addShoppingItem(name, userId);
          await get().loadShoppingItems();
        } catch (error) {
          console.error('Error adding shopping item:', error);
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
            purchased: item.purchased || false,
            purchasedBy: item.purchased_by_user_id || '',
            price: item.price || 0,
            createdAt: item.created_at ? new Date(item.created_at) : new Date(),
            purchasedAt: item.purchased_at ? new Date(item.purchased_at) : undefined,
            addedAt: item.created_at ? new Date(item.created_at) : new Date(),
          }));

          set({ shoppingItems });
        } catch (error) {
          console.error('Error loading shopping items:', error);
        }
      },

      markItemPurchased: async (itemId, userId, price, participants) => {
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
              category: 'groceries',
              description: `רכישה מרשימת הקניות`
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

      // ===== CLEANING ACTIONS (Firestore-based) =====

      loadCleaningTask: async () => {
        try {
          const cleaningTaskData = await firestoreService.getCleaningTask();
          if (cleaningTaskData) {
            const cleaningTask: CleaningTask = {
              id: cleaningTaskData.id || uuidv4(),
              queue: cleaningTaskData.queue || [],
              currentTurn: cleaningTaskData.user_id || cleaningTaskData.queue?.[0] || '',
              dueDate: cleaningTaskData.last_completed_at ? 
                new Date(cleaningTaskData.last_completed_at) : new Date(),
              intervalDays: 7,
              lastCleaned: cleaningTaskData.last_completed_at ? 
                new Date(cleaningTaskData.last_completed_at) : undefined,
              lastCleanedBy: cleaningTaskData.last_completed_by,
              status: 'pending',
              history: [], // TODO: Load from separate collection if needed
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
          
          set({
            checklistItems: items,
            isMyCleaningTurn: !!(task && currentUser && getCurrentTurnUserId(task) === currentUser.id),
          });
        } catch (error) {
          console.error('Error loading checklist:', error);
        } finally {
          set({ _loadingChecklist: false });
        }
      },

      completeChecklistItem: async (itemId: string) => {
        const { isMyCleaningTurn, checklistItems } = get();
        if (!isMyCleaningTurn) return; // Protected by both UI and Firestore rules

        // Optimistic: mark locally immediately
        set({
          checklistItems: checklistItems.map(it =>
            it.id === itemId ? { ...it, completed: true } : it
          )
        });

        try {
          await firestoreService.markChecklistItemCompleted(itemId);
          // Reload to sync (and see completed_by/at)
          await get().loadCleaningChecklist();
        } catch (error) {
          console.error('Error completing checklist item:', error);
          // Rollback if needed (optional)
          set({ checklistItems });
        }
      },

      uncompleteChecklistItem: async (itemId: string) => {
        const { isMyCleaningTurn, checklistItems } = get();
        if (!isMyCleaningTurn) return;

        // Optimistic: unmark locally immediately
        set({
          checklistItems: checklistItems.map(it =>
            it.id === itemId ? { ...it, completed: false } : it
          )
        });

        try {
          await firestoreService.unmarkChecklistItemCompleted(itemId);
          // Reload to sync
          await get().loadCleaningChecklist();
        } catch (error) {
          console.error('Error uncompleting checklist item:', error);
          // Rollback if needed
          set({ checklistItems });
        }
      },

      addChecklistItem: async (title: string, order?: number) => {
        try {
          const newItem = await firestoreService.addChecklistItem(title, order);
          // Reload to get the new item with proper ID
          await get().loadCleaningChecklist();
        } catch (error) {
          console.error('Error adding checklist item:', error);
          throw error;
        }
      },

      finishCleaningTurn: async () => {
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
      initializeCleaning: () => {
        const state = get();
        const apt = state.currentApartment;
        if (!apt || apt.members.length === 0) return;

        const userIds = apt.members.map((m) => m.id);
        const { intervalDays, anchorDow } = state.cleaningSettings;
        const { periodEnd } = computePeriodBounds(new Date(), anchorDow, intervalDays);

        const cleaningTask: CleaningTask = {
          id: uuidv4(),
          currentTurn: userIds[0],
          queue: [...userIds],
          dueDate: periodEnd,
          intervalDays,
          status: 'pending',
          history: [],
        };
        set({ cleaningTask, cleaningCompletions: [] });
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

      markCleaned: (userId) => {
        const state = get();
        const task = state.cleaningTask;
        if (!task) return;

        // Ensure all checklist items completed
        const currentTaskCompletions = state.cleaningCompletions.filter((c) => c.taskId === task.id);
        const completedTasks = currentTaskCompletions.filter((c) => c.completed);
        if (completedTasks.length < state.cleaningChecklist.length) return;

        const history: CleaningHistory = {
          id: uuidv4(),
          userId,
          cleanedAt: new Date(),
          status: 'completed',
        };

        const currentIndex = task.queue.indexOf(userId);
        const nextIndex = (currentIndex + 1) % task.queue.length;
        const { intervalDays, anchorDow } = state.cleaningSettings;
        const { periodEnd } = computePeriodBounds(new Date(), anchorDow, intervalDays);

        const completedTask: CleaningTask = {
          ...task,
          status: 'completed',
          lastCleaned: new Date(),
          lastCleanedBy: userId,
          history: [...task.history, history],
        };

        const newTask: CleaningTask = {
          id: uuidv4(),
          currentTurn: task.queue[nextIndex],
          queue: [...task.queue],
          dueDate: periodEnd,
          intervalDays,
          status: 'pending',
          history: [...completedTask.history],
        };

        set({ cleaningTask: newTask, cleaningCompletions: [] });
      },

      addCleaningTask: (name) => {
        const newTask: CleaningChecklist = {
          id: uuidv4(),
          name,
          isDefault: false,
          isCompleted: false,
        };
        set((state) => ({ cleaningChecklist: [...state.cleaningChecklist, newTask] }));
      },

      renameCleaningTask: (taskId, newName) => {
        set((state) => ({
          cleaningChecklist: state.cleaningChecklist.map((t) =>
            t.id === taskId ? { ...t, name: newName } : t
          ),
        }));
      },

      removeCleaningTask: (taskId) => {
        set((state) => ({
          cleaningChecklist: state.cleaningChecklist.filter((t) => t.id !== taskId),
          cleaningCompletions: state.cleaningCompletions.filter((c) => c.checklistItemId !== taskId),
        }));
      },

      toggleCleaningTask: (taskId, completed) => {
        const state = get();
        if (!state.cleaningTask) return;

        const existingCompletion = state.cleaningCompletions.find(
          (c) => c.taskId === state.cleaningTask!.id && c.checklistItemId === taskId
        );

        if (existingCompletion) {
          // Update existing completion
          set((state) => ({
            cleaningCompletions: state.cleaningCompletions.map((c) =>
              c.id === existingCompletion.id ? { ...c, completed } : c
            ),
          }));
        } else {
          // Create new completion
          const newCompletion: CleaningTaskCompletion = {
            id: uuidv4(),
            taskId: state.cleaningTask.id,
            checklistItemId: taskId,
            completed,
          };
          set((state) => ({
            cleaningCompletions: [...state.cleaningCompletions, newCompletion],
          }));
        }
      },

      checkOverdueTasks: () => {
        const state = get();
        const task = state.cleaningTask;
        if (!task || task.status !== 'pending' || !task.dueDate) return;

        const now = new Date();
        const dueDate = new Date(task.dueDate);
        if (isNaN(dueDate.getTime())) return;

        if (now > dueDate) {
          // skipped
          const history: CleaningHistory = {
            id: uuidv4(),
            userId: task.currentTurn,
            cleanedAt: now,
            status: 'skipped',
          };

          const currentIndex = task.queue.indexOf(task.currentTurn);
          const nextIndex = (currentIndex + 1) % task.queue.length;
          const { intervalDays, anchorDow } = state.cleaningSettings;
          const { periodEnd } = computePeriodBounds(new Date(), anchorDow, intervalDays);

          const skippedTask: CleaningTask = {
            ...task,
            status: 'skipped',
            history: [...task.history, history],
          };

          const newTask: CleaningTask = {
            id: uuidv4(),
            currentTurn: task.queue[nextIndex],
            queue: [...task.queue],
            dueDate: periodEnd,
            intervalDays,
            status: 'pending',
            history: [...skippedTask.history],
          };

          set({ cleaningTask: newTask, cleaningCompletions: [] });
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

      // Expense actions
      addDebtSettlement: async (fromUserId, toUserId, amount, description) => {
        try {
          const settlement: DebtSettlement = {
            id: uuidv4(),
            fromUserId,
            toUserId,
            amount,
            date: new Date(),
            description,
          };

          // Add to Firestore (if service supports it)
          try {
            // For now, add locally and sync later when Firestore service is ready
            set((state) => ({ debtSettlements: [...state.debtSettlements, settlement] }));
            
            // TODO: Implement Firestore debt settlement saving
            // await firestoreService.addDebtSettlement(settlement);
          } catch (firestoreError) {
            console.warn('Failed to save debt settlement to Firestore, saved locally:', firestoreError);
            // Still save locally even if Firestore fails
            set((state) => ({ debtSettlements: [...state.debtSettlements, settlement] }));
          }
        } catch (error) {
          console.error('Error adding debt settlement:', error);
          throw error;
        }
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

        // Apply debt settlements
        debtSettlements.forEach((settlement) => {
          if (!settlement) return;
          const { fromUserId, toUserId, amount } = settlement;
          if (!fromUserId || !toUserId || typeof amount !== 'number' || amount <= 0) return;
          
          // Ensure both users exist in balances
          ensure(fromUserId);
          ensure(toUserId);

          if (balances[fromUserId].owes[toUserId] != null) {
            balances[fromUserId].owes[toUserId] = Math.round((balances[fromUserId].owes[toUserId] - amount) * 100) / 100;
            if (balances[fromUserId].owes[toUserId] <= 0.01) { // Allow for small rounding errors
              delete balances[fromUserId].owes[toUserId];
            }
          }
          if (balances[toUserId].owed[fromUserId] != null) {
            balances[toUserId].owed[fromUserId] = Math.round((balances[toUserId].owed[fromUserId] - amount) * 100) / 100;
            if (balances[toUserId].owed[fromUserId] <= 0.01) { // Allow for small rounding errors
              delete balances[toUserId].owed[fromUserId];
            }
          }
        });

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
            const expenseDate = new Date(expense.date);
            if (isNaN(expenseDate.getTime())) return false;
            return expenseDate.getMonth() === month && expenseDate.getFullYear() === year;
          } catch {
            return false;
          }
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
          expenses: monthlyExpenses,
          total: Math.round(total * 100) / 100,
          personalTotal: Math.round(personalTotal * 100) / 100
        };
      },

      // Get total apartment expenses for a specific month
      getTotalApartmentExpenses: (year: number, month: number) => {
        const { expenses } = get();
        
        const monthlyExpenses = expenses.filter(expense => {
          try {
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
      removeShoppingItem: (itemId) => {
        set((state) => ({
          shoppingItems: state.shoppingItems.filter((item) => item.id !== itemId),
        }));
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
        cleaningChecklist: state.cleaningChecklist,
        cleaningCompletions: state.cleaningCompletions,
        cleaningSettings: state.cleaningSettings,
        expenses: state.expenses,
        debtSettlements: state.debtSettlements,
        shoppingItems: state.shoppingItems,
      }),
    }
  )
);
