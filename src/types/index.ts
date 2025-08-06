export interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
}

export interface Apartment {
  id: string;
  name: string;
  code: string;
  members: User[];
  createdAt: Date;
}

export interface CleaningTask {
  id: string;
  currentTurn: string; // user id
  queue: string[]; // array of user ids in rotation
  dueDate: Date;
  intervalDays: number;
  lastCleaned?: Date;
  lastCleanedBy?: string;
  status: 'pending' | 'completed' | 'skipped';
  history: CleaningHistory[];
}

export interface CleaningHistory {
  id: string;
  userId: string;
  cleanedAt: Date;
  status: 'completed' | 'skipped';
}

export interface CleaningChecklist {
  id: string;
  name: string;
  isDefault: boolean;
  isCompleted: boolean;
}

export interface CleaningTaskCompletion {
  id: string;
  taskId: string;
  checklistItemId: string;
  completed: boolean;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  paidBy: string; // user id
  participants: string[]; // array of user ids
  category: ExpenseCategory;
  date: Date;
  description?: string;
}

export type ExpenseCategory = 
  | 'groceries'
  | 'utilities'
  | 'rent'
  | 'cleaning'
  | 'internet'
  | 'other';

export interface ShoppingItem {
  id: string;
  name: string;
  addedBy: string; // user id
  addedAt: Date;
  purchased?: boolean;
  purchasedBy?: string;
  purchasePrice?: number;
  purchasedAt?: Date;
}

export interface Balance {
  userId: string;
  owes: { [userId: string]: number };
  owed: { [userId: string]: number };
  netBalance: number;
}

export interface DebtSettlement {
  id: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  date: Date;
  description?: string;
}