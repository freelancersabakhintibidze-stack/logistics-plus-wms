import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { OrderDetail } from '../core/models';
import { StateBlockComponent } from '../shared/state-block.component';
import { PageHeaderComponent } from '../shared/page-header.component';

@Component({
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, StateBlockComponent, PageHeaderComponent],
  template: `
    <wms-page-header eyebrow="ORDER DETAIL" [heading]="order?.orderNumber || 'Order details'"
      subhead="Inspect existing order fields and discovered line-item data.">
      <a routerLink="/orders" class="btn btn-light">← Back to orders</a>
    </wms-page-header>

    @if (loading) {
      <wms-state mode="loading" />
    } @else if (error) {
      <wms-state mode="error" [message]="error" (retry)="load()" />
    } @else if (order) {
      <section class="kpis detail-kpis">
        <article class="kpi"><span>Order status</span><strong>{{ order.status ?? 'Unknown' }}</strong></article>
        <article class="kpi"><span>Customer ID</span><strong>{{ order.customerId ?? '—' }}</strong></article>
        <article class="kpi"><span>Created</span><strong>{{ order.createdAt ? (order.createdAt | date:'mediumDate') : '—' }}</strong></article>
        <article class="kpi"><span>Order total</span><strong>{{ order.totalAmount === null ? '—' : (order.totalAmount | currency:'USD':'symbol':'1.2-4') }}</strong></article>
      </section>

      <section class="panel table-panel">
        <div class="panel-head"><div><h2>Line items</h2><p>Rows from the existing order-line relation, if it was discovered</p></div></div>
        @if (order.items.length) {
          <div class="table-wrap">
            <table>
              <caption class="sr-only">Order line items</caption>
              <thead><tr><th scope="col">Product</th><th scope="col">Product ID</th><th scope="col">Quantity</th><th scope="col">Unit price</th><th scope="col">Subtotal</th></tr></thead>
              <tbody>
                @for (item of order.items; track item.productId ?? $index) {
                  <tr>
                    <td>{{ item.productName ?? 'Unmapped product' }}</td>
                    <td>{{ item.productId ?? '—' }}</td>
                    <td>{{ item.quantity ?? '—' }}</td>
                    <td>{{ item.unitPrice === null ? '—' : (item.unitPrice | currency:'USD':'symbol':'1.2-4') }}</td>
                    <td>{{ item.subtotal === null ? '—' : (item.subtotal | currency:'USD':'symbol':'1.2-4') }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="reconcile">
            Line item total: {{ order.lineItemTotal === null ? '—' : (order.lineItemTotal | currency:'USD':'symbol':'1.2-4') }}
            <span>·</span>
            Reconciles with header: {{ order.totalReconciled === null ? 'Not computable' : order.totalReconciled ? 'Yes' : 'No — investigate source values' }}
          </div>
        } @else {
          <div class="empty-note">No order-line relationship was discovered. Header fields are shown without invented details.</div>
        }
      </section>

      <div class="readonly-note detail-note">
        <b>Read-only detail view</b>
        <small>Status updates remain disabled until transition rules, permissions and concurrency controls are verified.</small>
      </div>
    }
  `
})
export class OrderDetailComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  order: OrderDetail | null = null;
  loading = false;
  error = '';

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = '';
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.api.order(id).subscribe({
      next: result => { this.order = result.data; this.loading = false; },
      error: (failure: Error) => { this.error = failure.message; this.loading = false; }
    });
  }
}
