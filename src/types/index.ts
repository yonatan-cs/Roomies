export interface User {
  id: string;
  name: string;
  display_name?: string;
  email: string;
  phone?: string;
  avatar?: string;
  current_apartment_id?: string;
}

export interface Apartment {
  id: string;
  name: string;
  description?: string;
  invite_code: string;
  members: User[];
  createdAt: Date;
}

export interface CleaningSettings {
  intervalDays: number; // length of one cleaning period
  anchorDow: number; // 0=Sun .. 6=Sat, period flips on this weekday
  preferredDayByUser: { [userId: string]: number | undefined }; // optional preferred day per user
  cycleStartAt?: Date; // optional anchor for custom cycles
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
  isCompleted?: boolean; // Legacy field for backward compatibility
}

// New type for individual checklist items
export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  completed_by?: string | null;
  completed_at?: string | null; // ISO timestamp
  order?: number | null;
  created_at?: string | null; // ISO timestamp
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
  purchaseDate?: Date; // Date when item was purchased
  category?: ExpenseCategory; // Category for expense creation
  note?: string; // Note for expense creation
  needsRepurchase?: boolean; // Flag for re-adding to shopping list
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
