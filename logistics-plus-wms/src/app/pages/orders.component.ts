import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { OrderRow, Pagination } from '../core/models';
import { StateBlockComponent } from '../shared/state-block.component';
import { PageHeaderComponent } from '../shared/page-header.component';

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, FormsModule, RouterLink, StateBlockComponent, PageHeaderComponent],
  template: `
    <wms-page-header eyebrow="FULFILLMENT PIPELINE" heading="Orders"
      subhead="Find orders and inspect database-backed fulfillment details.">
      <button class="btn btn-light" type="button" (click)="exportCsv()">⇩ Export CSV</button>
    </wms-page-header>

    <section class="panel filters">
      <form (ngSubmit)="apply()">
        <label>Status<input name="status" [(ngModel)]="draftStatus" maxlength="100" placeholder="Any status" /></label>
        <label>Customer ID<input name="customerId" [(ngModel)]="draftCustomerId" maxlength="100" placeholder="Any customer" /></label>
        <label>From<input name="from" type="date" [(ngModel)]="draftFrom" /></label>
        <label>To<input name="to" type="date" [(ngModel)]="draftTo" /></label>
        <button class="btn btn-primary" type="submit">Apply filters</button>
        <button class="btn btn-light" type="button" (click)="reset()">Reset</button>
      </form>
    </section>

    <section class="panel table-panel">
      <div class="panel-head">
        <div><h2>Order records</h2><p>Order number, customer, date, status and stored total</p></div>
        <span class="meta">{{ (pagination?.total ?? 0) | number }} records</span>
      </div>

      @if (loading) {
        <wms-state mode="loading" />
      } @else if (error) {
        <wms-state mode="error" [message]="error" (retry)="load()" />
      } @else if (!orders.length) {
        <wms-state mode="empty" title="No orders found"
          message="No database records match the selected filters. Adjust the filters or reset them." />
      } @else {
        <div class="table-wrap">
          <table>
            <caption class="sr-only">Order records</caption>
            <thead>
              <tr><th scope="col">Order #</th><th scope="col">Customer ID</th><th scope="col">Created</th><th scope="col">Status</th><th scope="col">Total</th><th scope="col"><span class="sr-only">Details</span></th></tr>
            </thead>
            <tbody>
              @for (order of orders; track order.id) {
                <tr>
                  <td class="sku">{{ order.orderNumber ?? order.id }}</td>
                  <td>{{ order.customerId ?? '—' }}</td>
                  <td>{{ order.createdAt ? (order.createdAt | date:'mediumDate') : '—' }}</td>
                  <td><span class="badge neutral">{{ order.status ?? 'Unspecified' }}</span></td>
                  <td>{{ order.totalAmount === null ? '—' : (order.totalAmount | currency:'USD':'symbol':'1.2-4') }}</td>
                  <td><a [routerLink]="['/orders', order.id]">Details →</a></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="pager">
          <span>Showing {{ rangeStart }}–{{ rangeEnd }} of {{ (pagination?.total ?? 0) | number }}</span>
          <div>
            <button class="btn btn-light" type="button" (click)="move(-1)" [disabled]="page <= 1">← Previous</button>
            <span>Page {{ page }} / {{ pagination?.totalPages || 1 }}</span>
            <button class="btn btn-light" type="button" (click)="move(1)" [disabled]="page >= (pagination?.totalPages || 1)">Next →</button>
          </div>
        </div>
      }
    </section>
  `
})
export class OrdersComponent implements OnInit {
  private readonly api = inject(ApiService);
  orders: OrderRow[] = [];
  pagination: Pagination | null = null;
  page = 1;
  pageSize = 20;
  status = '';
  customerId = '';
  from = '';
  to = '';
  draftStatus = '';
  draftCustomerId = '';
  draftFrom = '';
  draftTo = '';
  loading = false;
  error = '';

  ngOnInit(): void { this.load(); }
  get rangeStart(): number { return this.orders.length ? (this.page - 1) * this.pageSize + 1 : 0; }
  get rangeEnd(): number { return Math.min(this.page * this.pageSize, this.pagination?.total ?? 0); }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.orders({
      page: this.page, pageSize: this.pageSize, status: this.status,
      customerId: this.customerId, from: this.from, to: this.to
    }).subscribe({
      next: result => { this.orders = result.data; this.pagination = result.pagination; this.loading = false; },
      error: (failure: Error) => { this.error = failure.message; this.orders = []; this.loading = false; }
    });
  }

  apply(): void {
    if (this.draftFrom && this.draftTo && this.draftFrom > this.draftTo) {
      this.error = 'The start date must be on or before the end date.';
      return;
    }
    this.status = this.draftStatus.trim();
    this.customerId = this.draftCustomerId.trim();
    this.from = this.draftFrom;
    this.to = this.draftTo;
    this.page = 1;
    this.load();
  }

  reset(): void {
    this.status = this.customerId = this.draftStatus = this.draftCustomerId = '';
    this.from = this.to = this.draftFrom = this.draftTo = '';
    this.page = 1;
    this.load();
  }

  move(delta: number): void {
    const next = this.page + delta;
    if (next < 1 || next > (this.pagination?.totalPages ?? 1)) return;
    this.page = next;
    this.load();
  }

  exportCsv(): void {
    window.location.assign(this.api.exportUrl('orders', {
      status: this.status, customerId: this.customerId, from: this.from, to: this.to
    }));
  }
}
