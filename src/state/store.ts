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
  DebtSettlement
} from '../types';

interface AppState {
  // User & Apartment
  currentUser?: User;
  currentApartment?: Apartment;
  
  // Cleaning
  cleaningTask?: CleaningTask;
  cleaningChecklist: CleaningChecklist[];
  cleaningCompletions: CleaningTaskCompletion[];
  
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
  initializeCleaning: (userIds: string[]) => void;
  markCleaned: (userId: string) => void;
  addCleaningTask: (name: string) => void;
  toggleCleaningTask: (taskId: string, completed: boolean) => void;
  checkOverdueTasks: () => void;
  
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
      
      // User & Apartment actions
      setCurrentUser: (user) => set({ currentUser: user }),
      
      createApartment: (name) => {
        const code = Math.random().toString(36).substr(2, 6).toUpperCase();
        const apartment: Apartment = {
          id: uuidv4(),
          name,
          code,
          members: get().currentUser ? [get().currentUser!] : [],
          createdAt: new Date(),
        };
        set({ currentApartment: apartment });
      },
      
      joinApartment: (code, userName) => {
        // In a real app, this would connect to a server
        // For now, we'll mock joining an existing apartment
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
      initializeCleaning: (userIds) => {
        const now = new Date();
        const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
        
        const cleaningTask: CleaningTask = {
          id: uuidv4(),
          currentTurn: userIds[0],
          queue: [...userIds],
          dueDate,
          intervalDays: 7,
          status: 'pending',
          history: [],
        };
        set({ cleaningTask });
      },
      
      markCleaned: (userId) => {
        const state = get();
        if (!state.cleaningTask) return;
        
        // Check if all tasks are completed
        const currentTaskCompletions = state.cleaningCompletions.filter(
          c => c.taskId === state.cleaningTask!.id
        );
        const completedTasks = currentTaskCompletions.filter(c => c.completed);
        
        if (completedTasks.length < state.cleaningChecklist.length) {
          // Not all tasks completed yet
          return;
        }
        
        const history: CleaningHistory = {
          id: uuidv4(),
          userId,
          cleanedAt: new Date(),
          status: 'completed',
        };
        
        const currentIndex = state.cleaningTask.queue.indexOf(userId);
        const nextIndex = (currentIndex + 1) % state.cleaningTask.queue.length;
        const nextDueDate = new Date(Date.now() + state.cleaningTask.intervalDays * 24 * 60 * 60 * 1000);
        
        // Mark current task as completed
        const completedTask: CleaningTask = {
          ...state.cleaningTask,
          status: 'completed',
          lastCleaned: new Date(),
          lastCleanedBy: userId,
          history: [...state.cleaningTask.history, history],
        };
        
        // Create new task for next person
        const newTask: CleaningTask = {
          id: uuidv4(),
          currentTurn: state.cleaningTask.queue[nextIndex],
          queue: [...state.cleaningTask.queue],
          dueDate: nextDueDate,
          intervalDays: state.cleaningTask.intervalDays,
          status: 'pending',
          history: [...completedTask.history],
        };
        
        set({ 
          cleaningTask: newTask,
          cleaningCompletions: [] // Reset completions for new task
        });
      },

      addCleaningTask: (name) => {
        const newTask: CleaningChecklist = {
          id: uuidv4(),
          name,
          isDefault: false,
          isCompleted: false,
        };
        set((state) => ({
          cleaningChecklist: [...state.cleaningChecklist, newTask]
        }));
      },

      toggleCleaningTask: (taskId, completed) => {
        const state = get();
        if (!state.cleaningTask) return;

        const existingCompletion = state.cleaningCompletions.find(
          c => c.taskId === state.cleaningTask!.id && c.checklistItemId === taskId
        );

        if (existingCompletion) {
          // Update existing completion
          set((state) => ({
            cleaningCompletions: state.cleaningCompletions.map(c =>
              c.id === existingCompletion.id
                ? { ...c, completed }
                : c
            )
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
            cleaningCompletions: [...state.cleaningCompletions, newCompletion]
          }));
        }
      },

      checkOverdueTasks: () => {
        const state = get();
        if (!state.cleaningTask || state.cleaningTask.status !== 'pending' || !state.cleaningTask.dueDate) return;

        const now = new Date();
        let dueDate: Date;
        
        try {
          dueDate = new Date(state.cleaningTask.dueDate);
          if (isNaN(dueDate.getTime())) return;
        } catch {
          return;
        }

        if (now > dueDate) {
          // Task is overdue, mark as skipped and create new task
          const history: CleaningHistory = {
            id: uuidv4(),
            userId: state.cleaningTask.currentTurn,
            cleanedAt: now,
            status: 'skipped',
          };

          const currentIndex = state.cleaningTask.queue.indexOf(state.cleaningTask.currentTurn);
          const nextIndex = (currentIndex + 1) % state.cleaningTask.queue.length;
          const nextDueDate = new Date(Date.now() + state.cleaningTask.intervalDays * 24 * 60 * 60 * 1000);

          // Mark current task as skipped
          const skippedTask: CleaningTask = {
            ...state.cleaningTask,
            status: 'skipped',
            history: [...state.cleaningTask.history, history],
          };

          // Create new task for next person
          const newTask: CleaningTask = {
            id: uuidv4(),
            currentTurn: state.cleaningTask.queue[nextIndex],
            queue: [...state.cleaningTask.queue],
            dueDate: nextDueDate,
            intervalDays: state.cleaningTask.intervalDays,
            status: 'pending',
            history: [...skippedTask.history],
          };

          set({ 
            cleaningTask: newTask,
            cleaningCompletions: [] // Reset completions for new task
          });
        }
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
        
        // Initialize balances
        currentApartment.members.forEach(member => {
          balances[member.id] = {
            userId: member.id,
            owes: {},
            owed: {},
            netBalance: 0,
          };
        });
        
        // Calculate balances from expenses
        expenses.forEach(expense => {
          const perPersonAmount = expense.amount / expense.participants.length;
          
          expense.participants.forEach(participantId => {
            if (participantId !== expense.paidBy) {
              // Participant owes money to the payer
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
        debtSettlements.forEach(settlement => {
          if (balances[settlement.fromUserId] && balances[settlement.toUserId]) {
            // Reduce the debt between the users
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
        Object.values(balances).forEach(balance => {
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
          shoppingItems: state.shoppingItems.map(item =>
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
        
        // If price is provided, automatically add as expense
        if (price && price > 0) {
          const item = get().shoppingItems.find(i => i.id === itemId);
          const { currentApartment } = get();
          if (item && currentApartment) {
            get().addExpense({
              title: item.name,
              amount: price,
              paidBy: userId,
              participants: currentApartment.members.map(m => m.id),
              category: 'groceries' as ExpenseCategory,
              description: 'מקניות משותפות',
            });
          }
        }
      },
      
      removeShoppingItem: (itemId) => {
        set((state) => ({
          shoppingItems: state.shoppingItems.filter(item => item.id !== itemId),
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
        expenses: state.expenses,
        debtSettlements: state.debtSettlements,
        shoppingItems: state.shoppingItems,
      }),
    }
  )
);