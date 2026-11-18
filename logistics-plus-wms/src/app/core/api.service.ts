import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  ApiErrorPayload,
  DashboardSummary,
  InventoryRow,
  OrderDetail,
  OrderRow,
  PagedResponse,
  Product
} from './models';

export class ApiFailure extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message);
  }
}

export type QueryValues = Record<string, string | number | boolean | undefined | null>;

function buildParams(values: QueryValues): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
  }
  return params;
}

// Every transport error becomes a typed, user-safe failure. Server detail is
// never echoed into the UI, and stack traces never reach the browser.
function translate(error: HttpErrorResponse): ApiFailure {
  const payload = error.error as ApiErrorPayload | null;
  const code = payload?.error?.code ?? 'HTTP_' + error.status;
  if (error.status === 0) {
    return new ApiFailure('The API could not be reached. Check your network connection and retry.', 0, 'NETWORK_UNAVAILABLE');
  }
  if (code === 'AUTH_NOT_CONFIGURED') {
    return new ApiFailure('This deployment is not yet connected to the enterprise authentication gateway.', 503, code);
  }
  const message = payload?.error?.message ?? (error.status >= 500
    ? 'The server reported an unexpected error. No internal detail was exposed.'
    : 'The request was rejected (' + error.status + ').');
  return new ApiFailure(message, error.status, code);
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase + '/api';

  private safe<T>(source: Observable<T>): Observable<T> {
    return source.pipe(catchError((error: HttpErrorResponse) => throwError(() => translate(error))));
  }

  products(query: QueryValues): Observable<PagedResponse<Product>> {
    return this.safe(this.http.get<PagedResponse<Product>>(this.base + '/products', { params: buildParams(query) }));
  }

  inventory(query: QueryValues): Observable<PagedResponse<InventoryRow>> {
    return this.safe(this.http.get<PagedResponse<InventoryRow>>(this.base + '/inventory', { params: buildParams(query) }));
  }

  orders(query: QueryValues): Observable<PagedResponse<OrderRow>> {
    return this.safe(this.http.get<PagedResponse<OrderRow>>(this.base + '/orders', { params: buildParams(query) }));
  }

  order(id: string): Observable<{ data: OrderDetail }> {
    return this.safe(this.http.get<{ data: OrderDetail }>(this.base + '/orders/' + encodeURIComponent(id)));
  }

  dashboard(): Observable<{ data: DashboardSummary }> {
    return this.safe(this.http.get<{ data: DashboardSummary }>(this.base + '/reports/dashboard'));
  }

  // Export links are plain navigations so the browser handles the download and
  // the gateway carries the user's authenticated session.
  exportUrl(kind: 'products' | 'orders', query: QueryValues): string {
    return this.base + '/' + kind + '/export.csv?' + buildParams(query).toString();
  }
}
