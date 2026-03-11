import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ExpenseItem } from '../models/expense-item.model';
import { CreateExpenseRequest } from '../models/create-expense-request.model';
import { UpdateExpenseStatusRequest } from '../models/update-expense-status-request.model';
import { ExpenseStatus } from '../models/expense-status.type';
import { ExpenseSettings } from '../models/expense-settings.model';
import { RecurringExpense } from '../models/recurring-expense.model';
import { CreateRecurringExpenseRequest } from '../models/create-recurring-expense-request.model';
import { UpcomingExpense } from '../models/upcoming-expense.model';

@Injectable({ providedIn: 'root' })
export class ExpensesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/expenses`;

  getExpenses(userId?: number, status?: ExpenseStatus, search?: string): Observable<ExpenseItem[]> {
    let params = new HttpParams();
    if (userId) params = params.set('userId', userId);
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<ExpenseItem[]>(this.base, { params });
  }

  createExpense(request: CreateExpenseRequest): Observable<ExpenseItem> {
    return this.http.post<ExpenseItem>(this.base, request);
  }

  updateExpenseStatus(id: number, request: UpdateExpenseStatusRequest): Observable<ExpenseItem> {
    return this.http.patch<ExpenseItem>(`${this.base}/${id}/status`, request);
  }

  deleteExpense(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  getSettings(): Observable<ExpenseSettings> {
    return this.http.get<ExpenseSettings>(`${this.base}/settings`);
  }

  updateSettings(settings: ExpenseSettings): Observable<void> {
    return this.http.put<void>(`${this.base}/settings`, settings);
  }

  // ─── Recurring Expenses ───

  getRecurringExpenses(classification?: string): Observable<RecurringExpense[]> {
    let params = new HttpParams();
    if (classification) params = params.set('classification', classification);
    return this.http.get<RecurringExpense[]>(`${this.base}/recurring`, { params });
  }

  createRecurringExpense(request: CreateRecurringExpenseRequest): Observable<RecurringExpense> {
    return this.http.post<RecurringExpense>(`${this.base}/recurring`, request);
  }

  updateRecurringExpense(id: number, request: Partial<RecurringExpense>): Observable<RecurringExpense> {
    return this.http.patch<RecurringExpense>(`${this.base}/recurring/${id}`, request);
  }

  deleteRecurringExpense(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/recurring/${id}`);
  }

  getUpcomingExpenses(daysAhead = 90, classification?: string): Observable<UpcomingExpense[]> {
    let params = new HttpParams().set('daysAhead', daysAhead);
    if (classification) params = params.set('classification', classification);
    return this.http.get<UpcomingExpense[]>(`${this.base}/upcoming`, { params });
  }
}
