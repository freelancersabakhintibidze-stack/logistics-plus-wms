import { Component, OnInit, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ApiService } from '../core/api.service';
import { DashboardSummary } from '../core/models';
import { StateBlockComponent } from '../shared/state-block.component';
import { PageHeaderComponent } from '../shared/page-header.component';

@Component({
  standalone: true,
  imports: [DatePipe, DecimalPipe, StateBlockComponent, PageHeaderComponent],
  template: `
    <wms-page-header eyebrow="REPORTING & DIAGNOSTICS" heading="Reports"
      subhead="Database-derived operational rollups and schema mapping notes.">
      <button class="btn btn-light" type="button" (click)="load()">↻ Refresh</button>
    </wms-page-header>

    @if (loading && !data) { <wms-state mode="loading" /> }
    @if (error) { <wms-state mode="error" [message]="error" (retry)="load()" /> }

    @if (data) {
      <section class="kpis">
        <article class="kpi"><span>Total orders</span><strong>{{ data.totalOrders | number }}</strong></article>
        <article class="kpi"><span>Pending (inferred)</span><strong>{{ data.pendingOrders === null ? '—' : (data.pendingOrders | number) }}</strong></article>
        <article class="kpi"><span>Low stock rows</span><strong>{{ data.lowStockItems === null ? '—' : (data.lowStockItems | number) }}</strong></article>
        <article class="kpi"><span>Order value</span><strong>{{ data.totalOrderValue === null ? '—' : (data.totalOrderValue | number:'1.2-2') }}</strong></article>
      </section>

      <section class="panel table-panel">
        <div class="panel-head">
          <div><h2>Orders by status</h2><p>Aggregated from the current database status column</p></div>
          <span class="meta">Updated {{ data.asOf | date:'medium' }}</span>
        </div>
        @if (data.ordersByStatus.length) {
          <div class="table-wrap">
            <table>
              <caption class="sr-only">Order counts by status</caption>
              <thead><tr><th scope="col">Status</th><th scope="col">Order count</th></tr></thead>
              <tbody>@for (row of data.ordersByStatus; track row.status) {
                <tr><td>{{ row.status ?? 'Unspecified' }}</td><td>{{ row.count | number }}</td></tr>
              }</tbody>
            </table>
          </div>
        } @else {
          <wms-state mode="empty" title="Status report unavailable" message="No recognizable status column was discovered." />
        }
      </section>

      <section class="panel discover-panel">
        <div class="eyebrow">SCHEMA ADAPTATION</div>
        <h2>Data discovery and limitations</h2>
        <p>The API reads SQL Server metadata at runtime. Candidate table and field names are heuristics and must be confirmed against production.</p>
        <ul>
          @for (note of data.notes; track note) { <li>{{ note }}</li> }
          <li>Discovery reads metadata only; it issues no DDL and creates no database objects.</li>
          <li>Daily trends and top products require verified timestamp and order-line/product relationships.</li>
          <li>Order status updates are disabled until the authorized lifecycle and concurrency design are approved.</li>
        </ul>
        <small>See docs/DATA_DICTIONARY.md, docs/OPEN_ISSUES.md and openapi/openapi.yaml in the project package.</small>
      </section>
    }
  `
})
export class ReportsComponent implements OnInit {
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
}
