import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ExpenseItem, CreateExpenseRequest, UpdateExpenseStatusRequest, ExpenseStatus } from '../models/expenses.model';

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
}
