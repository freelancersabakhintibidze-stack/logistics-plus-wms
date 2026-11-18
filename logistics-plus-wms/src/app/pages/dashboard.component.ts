import { Component, OnInit, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { DashboardSummary } from '../core/models';
import { StateBlockComponent } from '../shared/state-block.component';
import { PageHeaderComponent } from '../shared/page-header.component';

@Component({
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink, StateBlockComponent, PageHeaderComponent],
  template: `
    <wms-page-header eyebrow="OPERATIONS OVERVIEW" heading="Warehouse dashboard"
      subhead="A live snapshot of your fulfillment pipeline, drawn from the connected database.">
      <button class="btn btn-light" type="button" (click)="load()">↻ Refresh</button>
    </wms-page-header>

    @if (error) {
      <wms-state mode="error" [message]="error" (retry)="load()" />
    }

    @if (loading && !data) {
      <wms-state mode="loading" />
    }

    @if (data) {
      <section class="kpis">
        <article class="kpi">
          <span>Total orders</span>
          <strong>{{ data.totalOrders | number }}</strong>
          <small>Existing order records in scope</small>
        </article>
        <article class="kpi">
          <span>Pending orders</span>
          <strong>{{ data.pendingOrders === null ? '—' : (data.pendingOrders | number) }}</strong>
          <small>{{ data.pendingOrders === null ? 'Status column not mapped' : 'Inferred from stored status labels' }}</small>
        </article>
        <article class="kpi">
          <span>Low stock rows</span>
          <strong>{{ data.lowStockItems === null ? '—' : (data.lowStockItems | number) }}</strong>
          <small>Provisional threshold of 10 units</small>
        </article>
        <article class="kpi">
          <span>Total order value</span>
          <strong>{{ data.totalOrderValue === null ? '—' : (data.totalOrderValue | number:'1.2-2') }}</strong>
          <small>Authoritative total field, when discovered</small>
        </article>
      </section>

      <section class="columns">
        <article class="panel">
          <div class="panel-head">
            <div><h2>Order distribution</h2><p>Counts grouped by the stored order status</p></div>
            <a routerLink="/orders">View orders →</a>
          </div>
          @if (data.ordersByStatus.length) {
            @for (row of data.ordersByStatus; track row.status) {
              <div class="status-row">
                <span>{{ row.status || 'Unspecified' }}</span>
                <div class="track"><i [style.width.%]="width(row.count)"></i></div>
                <b>{{ row.count | number }}</b>
              </div>
            }
            <small class="disclaimer">Grouped from live records. No synthetic values are used.</small>
          } @else {
            <p class="inline-note">No recognizable status column was returned for the orders table.</p>
          }
        </article>

        <article class="panel">
          <div class="panel-head"><div><h2>Quick actions</h2><p>Jump into an operational workflow</p></div></div>
          <a class="quick" routerLink="/products"><span aria-hidden="true">▦</span><span><b>Find a product</b><small>Search the discovered catalog</small></span><em aria-hidden="true">→</em></a>
          <a class="quick" routerLink="/inventory"><span aria-hidden="true">▤</span><span><b>Check inventory</b><small>Inspect warehouse balances</small></span><em aria-hidden="true">→</em></a>
          <a class="quick" routerLink="/orders"><span aria-hidden="true">▣</span><span><b>Locate an order</b><small>Review order and line details</small></span><em aria-hidden="true">→</em></a>
          <div class="readonly-note">
            <b>Order status changes are disabled</b>
            <small>Enable only after the state graph, authorization and concurrency rules are verified.</small>
          </div>
        </article>
      </section>

      <div class="notice">
        <b aria-hidden="true">i</b>
        <span>
          <strong>Confirm schema mapping and operational thresholds</strong>
          <small>Table and column identifiers are discovered at runtime. Review Reports → data discovery before production use.</small>
        </span>
        <a routerLink="/reports">Review →</a>
      </div>

      <p class="asof">Last refreshed {{ data.asOf | date:'medium' }}</p>
    }
  `
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  data: DashboardSummary | null = null;
  loading = false;
  error = '';

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.dashboard().subscribe({
      next: result => { this.data = result.data; this.loading = false; },
      error: (failure: Error) => { this.error = failure.message; this.loading = false; }
    });
  }

  width(count: number): number {
    const values = this.data?.ordersByStatus.map(row => row.count) ?? [1];
    const max = Math.max(...values, 1);
    return Math.max(4, (100 * count) / max);
  }
}
