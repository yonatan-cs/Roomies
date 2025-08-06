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
  CleaningHistory 
} from '../types';

interface AppState {
  // User & Apartment
  currentUser?: User;
  currentApartment?: Apartment;
  
  // Cleaning
  cleaningTask?: CleaningTask;
  
  // Expenses & Budget
  expenses: Expense[];
  
  // Shopping
  shoppingItems: ShoppingItem[];
  
  // Actions - User & Apartment
  setCurrentUser: (user: User) => void;
  createApartment: (name: string) => void;
  joinApartment: (code: string, userName: string) => void;
  
  // Actions - Cleaning
  initializeCleaning: (userIds: string[]) => void;
  markCleaned: (userId: string) => void;
  
  // Actions - Expenses
  addExpense: (expense: Omit<Expense, 'id' | 'date'>) => void;
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
      shoppingItems: [],
      
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
        const cleaningTask: CleaningTask = {
          id: uuidv4(),
          currentTurn: userIds[0],
          queue: [...userIds],
          history: [],
        };
        set({ cleaningTask });
      },
      
      markCleaned: (userId) => {
        const state = get();
        if (!state.cleaningTask) return;
        
        const history: CleaningHistory = {
          id: uuidv4(),
          userId,
          cleanedAt: new Date(),
        };
        
        const currentIndex = state.cleaningTask.queue.indexOf(userId);
        const nextIndex = (currentIndex + 1) % state.cleaningTask.queue.length;
        
        const updatedTask: CleaningTask = {
          ...state.cleaningTask,
          currentTurn: state.cleaningTask.queue[nextIndex],
          lastCleaned: new Date(),
          lastCleanedBy: userId,
          history: [...state.cleaningTask.history, history],
        };
        
        set({ cleaningTask: updatedTask });
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
      
      getBalances: () => {
        const { expenses, currentApartment } = get();
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
        expenses: state.expenses,
        shoppingItems: state.shoppingItems,
      }),
    }
  )
);