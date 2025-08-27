import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
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
  addExpense: (expense: Omit<Expense, 'id' | 'date'>) => void;
  addDebtSettlement: (fromUserId: string, toUserId: string, amount: number, description?: string) => void;
  getBalances: () => Balance[];

  // Actions - Shopping
  addShoppingItem: (name: string, userId: string) => void;
  markItemPurchased: (itemId: string, userId: string, price?: number) => void;
  removeShoppingItem: (itemId: string) => void;
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
          code,
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
        };
        const apartment: Apartment = {
          id: uuidv4(),
          name: 'דירת שותפים',
          code,
          members: [user],
          createdAt: new Date(),
        };
        set({ currentUser: user, currentApartment: apartment });
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
      addExpense: (expense) => {
        const newExpense: Expense = {
          ...expense,
          id: uuidv4(),
          date: new Date(),
        };
        set((state) => ({ expenses: [...state.expenses, newExpense] }));
      },

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

        // Initialize balances - with safety check
        if (!currentApartment.members || currentApartment.members.length === 0) {
          console.warn('⚠️ No apartment members found for balance calculation');
          return [];
        }

        currentApartment.members.forEach((member) => {
          if (!member || !member.id) {
            console.warn('⚠️ Invalid member object found:', member);
            return;
          }
          
          balances[member.id] = {
            userId: member.id,
            owes: {},
            owed: {},
            netBalance: 0,
          };
        });

        // Calculate balances from expenses
        expenses.forEach((expense) => {
          const perPersonAmount = expense.amount / expense.participants.length;

          expense.participants.forEach((participantId) => {
            if (participantId !== expense.paidBy) {
              if (!balances[participantId].owes[expense.paidBy]) {
                balances[participantId].owes[expense.paidBy] = 0;
              }
              if (!balances[expense.paidBy].owed[participantId]) {
                balances[expense.paidBy].owed[participantId] = 0;
              }

              balances[participantId].owes[expense.paidBy] += perPersonAmount;
              balances[expense.paidBy].owed[participantId] += perPersonAmount;
            }
          });
        });

        // Apply debt settlements
        debtSettlements.forEach((settlement) => {
          if (balances[settlement.fromUserId] && balances[settlement.toUserId]) {
            if (balances[settlement.fromUserId].owes[settlement.toUserId]) {
              balances[settlement.fromUserId].owes[settlement.toUserId] -= settlement.amount;
              if (balances[settlement.fromUserId].owes[settlement.toUserId] <= 0) {
                delete balances[settlement.fromUserId].owes[settlement.toUserId];
              }
            }
            if (balances[settlement.toUserId].owed[settlement.fromUserId]) {
              balances[settlement.toUserId].owed[settlement.fromUserId] -= settlement.amount;
              if (balances[settlement.toUserId].owed[settlement.fromUserId] <= 0) {
                delete balances[settlement.toUserId].owed[settlement.fromUserId];
              }
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
      addShoppingItem: (name, userId) => {
        const newItem: ShoppingItem = {
          id: uuidv4(),
          name,
          addedBy: userId,
          addedAt: new Date(),
        };
        set((state) => ({ shoppingItems: [...state.shoppingItems, newItem] }));
      },

      markItemPurchased: (itemId, userId, price) => {
        set((state) => ({
          shoppingItems: state.shoppingItems.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  purchased: true,
                  purchasedBy: userId,
                  purchasePrice: price,
                  purchasedAt: new Date(),
                }
              : item
          ),
        }));

        if (price && price > 0) {
          const item = get().shoppingItems.find((i) => i.id === itemId);
          const { currentApartment } = get();
          if (item && currentApartment) {
            get().addExpense({
              title: item.name,
              amount: price,
              paidBy: userId,
              participants: currentApartment.members.map((m) => m.id),
              category: 'groceries' as ExpenseCategory,
              description: 'מקניות משותפות',
            });
          }
        }
      },

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
