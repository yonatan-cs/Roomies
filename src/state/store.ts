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

interface AppState {
  // User & Apartment
  currentUser?: User;
  currentApartment?: Apartment;

  // Cleaning
  cleaningTask?: CleaningTask;
  cleaningChecklist: CleaningChecklist[];
  cleaningCompletions: CleaningTaskCompletion[];
  cleaningSettings: CleaningSettings;

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
  addDebtSettlement: (fromUserId: string, toUserId: string, amount: number, description?: string) => void;
  getBalances: () => Balance[];

  // Actions - Shopping
  addShoppingItem: (name: string, userId: string) => Promise<void>;
  loadShoppingItems: () => Promise<void>;
  markItemPurchased: (itemId: string, userId: string, price?: number) => Promise<void>;
  removeShoppingItem: (itemId: string) => void;

  // Actions - Cleaning (Firestore-based)
  loadCleaningTask: () => Promise<void>;
  refreshCleaningTask: () => Promise<void>;
  markCleaningCompleted: () => Promise<void>;

  // Store management
  reset: () => void;
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
            title: doc.fields?.note?.stringValue || 'הוצאה',
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
          // Use the new getShoppingItems function from firestore-service
          const { getShoppingItems } = await import('../services/firestore-service');
          const shoppingData = await getShoppingItems();
          
          const shoppingItems: ShoppingItem[] = shoppingData.map((item: any) => ({
            id: item.id || uuidv4(),
            name: item.title || item.name || '',
            addedBy: item.added_by_user_id || '',
            purchased: item.purchased || false,
            purchasedBy: item.purchased_by_user_id || '',
            price: item.price || 0,
            createdAt: item.created_at ? new Date(item.created_at) : new Date(),
            purchasedAt: item.purchased_at ? new Date(item.purchased_at) : undefined,
          }));

          set({ shoppingItems });
        } catch (error) {
          const msg = String((error as Error)?.message || '');
          // Don't crash if no session/apartment yet
          if (msg.includes('AUTH_REQUIRED') || msg.includes('NO_APARTMENT_FOR_USER') || msg.includes('NO_VALID_ID_TOKEN')) return;
          console.error('Error loading shopping items:', error);
        }
      },

      markItemPurchased: async (itemId, userId, price) => {
        try {
          await firestoreService.markShoppingItemPurchased(itemId, userId, price);
          await get().loadShoppingItems();
        } catch (error) {
          console.error('Error marking item purchased:', error);
          throw error;
        }
      },

      // ===== CLEANING ACTIONS (Firestore-based) =====

      loadCleaningTask: async () => {
        try {
          // Use the new getCleaningTask function from firestore-service
          const { getCleaningTask } = await import('../services/firestore-service');
          const cleaningTaskData = await getCleaningTask();
          if (cleaningTaskData) {
            const cleaningTask: CleaningTask = {
              id: cleaningTaskData.id || uuidv4(),
              queue: cleaningTaskData.queue || [],
              currentTurn: cleaningTaskData.queue?.[cleaningTaskData.current_index] || '',
              currentIndex: cleaningTaskData.current_index || 0,
              lastCompletedAt: cleaningTaskData.last_completed_at ? 
                new Date(cleaningTaskData.last_completed_at) : new Date(),
              history: [], // TODO: Load from separate collection if needed
            };

            set({ cleaningTask });
          }
        } catch (error) {
          const msg = String((error as Error)?.message || '');
          // Don't crash if no session/apartment yet
          if (msg.includes('AUTH_REQUIRED') || msg.includes('NO_APARTMENT_FOR_USER') || msg.includes('NO_VALID_ID_TOKEN')) return;
          console.error('Error loading cleaning task:', error);
        }
      },

      refreshCleaningTask: async () => {
        // Alias for loadCleaningTask for consistency
        return get().loadCleaningTask();
      },

      // Store management
      reset: () => {
        set({
          expenses: [],
          debtSettlements: [],
          shoppingItems: [],
          cleaningChecklist: [
            { id: '1', name: 'ניקוי מטבח', isDefault: true, isCompleted: false },
            { id: '2', name: 'שטיפת רצפות', isDefault: true, isCompleted: false },
            { id: '3', name: 'ניקוי שירותים', isDefault: true, isCompleted: false },
            { id: '4', name: 'פינוי אשפה', isDefault: true, isCompleted: false },
          ],
          cleaningCompletions: [],
          cleaningSettings: {
            intervalDays: 7,
            anchorDow: 0, // Sunday
            preferredDays: {},
          },
          currentUser: undefined,
          currentApartment: undefined,
          cleaningTask: undefined,
        });
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
      addDebtSettlement: (fromUserId, toUserId, amount, description) => {
        const settlement: DebtSettlement = {
          id: uuidv4(),
          fromUserId,
          toUserId,
          amount,
          date: new Date(),
          description,
        };
        set((state) => ({ debtSettlements: [...state.debtSettlements, settlement] }));
      },

      getBalances: () => {
        const { expenses, debtSettlements, currentApartment } = get();
        if (!currentApartment) return [];

        const balances: { [userId: string]: Balance } = {};

        // Collect valid members and initialize their balance entries
        const members = Array.isArray(currentApartment.members)
          ? currentApartment.members.filter((m) => m && m.id)
          : [];

        if (members.length === 0) {
          console.warn('⚠️ No apartment members found for balance calculation');
          return [];
        }

        const validMemberIds = new Set<string>(members.map((m) => m.id));

        const ensure = (userId: string | undefined) => {
          if (!userId || !validMemberIds.has(userId)) return false;
          if (!balances[userId]) {
            balances[userId] = { userId, owes: {}, owed: {}, netBalance: 0 };
          }
          return true;
        };

        members.forEach((member) => {
          ensure(member.id);
        });

        // Calculate balances from expenses (defensive: validate shapes/ids)
        expenses.forEach((expense) => {
          try {
            if (!expense || typeof expense.amount !== 'number' || !isFinite(expense.amount)) return;

            const paidBy = expense.paidBy;
            const participants = Array.isArray(expense.participants) ? expense.participants : [];
            // Filter to valid participants that are also members
            const validParticipants = participants.filter((pid) => pid && validMemberIds.has(pid));

            if (!paidBy || !validMemberIds.has(paidBy)) return; // skip expenses with unknown payer
            if (validParticipants.length === 0) return; // nothing to split

            const perPersonAmount = expense.amount / validParticipants.length;

            validParticipants.forEach((participantId) => {
              if (!participantId || participantId === paidBy) return;
              const okA = ensure(participantId);
              const okB = ensure(paidBy);
              if (!okA || !okB) return;

              if (balances[participantId].owes[paidBy] == null) {
                balances[participantId].owes[paidBy] = 0;
              }
              if (balances[paidBy].owed[participantId] == null) {
                balances[paidBy].owed[participantId] = 0;
              }

              balances[participantId].owes[paidBy] += perPersonAmount;
              balances[paidBy].owed[participantId] += perPersonAmount;
            });
          } catch (e) {
            // Ignore malformed expense entries to avoid crashing UI
          }
        });

        // Apply debt settlements (only for known members)
        debtSettlements.forEach((settlement) => {
          if (!settlement) return;
          const { fromUserId, toUserId, amount } = settlement;
          if (!fromUserId || !toUserId || typeof amount !== 'number' || amount <= 0) return;
          if (!validMemberIds.has(fromUserId) || !validMemberIds.has(toUserId)) return;
          if (!ensure(fromUserId) || !ensure(toUserId)) return;

          if (balances[fromUserId].owes[toUserId] != null) {
            balances[fromUserId].owes[toUserId] -= amount;
            if (balances[fromUserId].owes[toUserId] <= 0) {
              delete balances[fromUserId].owes[toUserId];
            }
          }
          if (balances[toUserId].owed[fromUserId] != null) {
            balances[toUserId].owed[fromUserId] -= amount;
            if (balances[toUserId].owed[fromUserId] <= 0) {
              delete balances[toUserId].owed[fromUserId];
            }
          }
        });

        // Calculate net balances
        Object.values(balances).forEach((balance) => {
          const totalOwed = Object.values(balance.owed).reduce((sum, amount) => sum + amount, 0);
          const totalOwes = Object.values(balance.owes).reduce((sum, amount) => sum + amount, 0);
          balance.netBalance = totalOwed - totalOwes;
        });

        return Object.values(balances);
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
