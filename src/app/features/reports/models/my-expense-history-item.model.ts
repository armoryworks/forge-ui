export interface MyExpenseHistoryItem {
  id: number;
  category: string;
  description: string;
  amount: number;
  status: string;
  expenseDate: string;
  vendor: string | null;
}
