import { Component, OnInit, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { InventoryRow } from '../core/models';
import { StateBlockComponent } from '../shared/state-block.component';
import { PageHeaderComponent } from '../shared/page-header.component';

@Component({
  standalone: true,
  imports: [DecimalPipe, FormsModule, StateBlockComponent, PageHeaderComponent],
  template: `
    <wms-page-header eyebrow="STOCK CONTROL" heading="Inventory"
      subhead="Warehouse-level balances mapped to the fields that exist in your database.">
      <button class="btn btn-light" type="button" (click)="load()">↻ Refresh</button>
    </wms-page-header>

    <section class="panel filters">
      <form (ngSubmit)="apply()">
        <label>Warehouse ID
          <input name="warehouseId" [(ngModel)]="draftWarehouseId" maxlength="100" placeholder="All warehouses" />
        </label>
        <label>Low-stock threshold
          <input name="threshold" type="number" min="0" step="any" [(ngModel)]="draftThreshold" />
        </label>
        <label class="check"><input type="checkbox" name="lowStockOnly" [(ngModel)]="draftLowStockOnly" /> At or below threshold</label>
        <label class="check"><input type="checkbox" name="zeroStockOnly" [(ngModel)]="draftZeroStockOnly" /> Zero stock only</label>
        <button class="btn btn-primary" type="submit">Apply filters</button>
        <button class="btn btn-light" type="button" (click)="reset()">Reset</button>
      </form>
      <p class="help">
        Available = On hand − Reserved, and is only calculated when the schema exposes a reserved quantity column.
      </p>
    </section>

    <section class="panel table-panel">
      <div class="panel-head">
        <div><h2>Warehouse balances</h2><p>One row per discovered stock record</p></div>
        <span class="meta">{{ rows.length }} loaded · capped at 500 rows per request</span>
      </div>

      @if (loading) {
        <wms-state mode="loading" />
      } @else if (error) {
        <wms-state mode="error" [message]="error" (retry)="load()" />
      } @else if (!rows.length) {
        <wms-state mode="empty" title="No inventory records found"
          message="No matching stock records were returned. Check the warehouse value and the schema mapping." />
      } @else {
        <div class="table-wrap">
          <table>
            <caption class="sr-only">Inventory balances by warehouse</caption>
            <thead>
              <tr>
                <th scope="col">SKU</th><th scope="col">Product</th><th scope="col">Warehouse</th>
                <th scope="col">On hand</th><th scope="col">Reserved</th><th scope="col">Available</th><th scope="col">Stock</th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows; track (row.productId ?? '') + '|' + (row.warehouseId ?? '') + '|' + $index) {
                <tr>
                  <td class="sku">{{ row.sku ?? '—' }}</td>
                  <td><b>{{ row.productName ?? 'Unmapped product' }}</b></td>
                  <td>{{ row.warehouseName ?? row.warehouseId ?? '—' }}</td>
                  <td>{{ row.onHand === null ? '—' : (row.onHand | number:'1.0-4') }}</td>
                  <td>{{ row.reserved === null ? 'Not available' : (row.reserved | number:'1.0-4') }}</td>
                  <td>{{ row.available === null ? 'Not calculated' : (row.available | number:'1.0-4') }}</td>
                  <td><span class="badge" [class.bad]="row.onHand === 0" [class.warn]="isLow(row)" [class.good]="isHealthy(row)">{{ stockLabel(row) }}</span></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `
})
export class InventoryComponent implements OnInit {
  private readonly api = inject(ApiService);
  rows: InventoryRow[] = [];
  loading = false;
  error = '';
  warehouseId = '';
  threshold = 10;
  draftWarehouseId = '';
  draftThreshold = 10;
  draftLowStockOnly = false;
  draftZeroStockOnly = false;
  lowStockOnly = false;
  zeroStockOnly = false;

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.inventory({
      warehouseId: this.warehouseId,
      lowStockOnly: this.lowStockOnly,
      lowStockThreshold: this.threshold,
      zeroStockOnly: this.zeroStockOnly
    }).subscribe({
      next: result => { this.rows = result.data; this.loading = false; },
      error: (failure: Error) => { this.error = failure.message; this.rows = []; this.loading = false; }
    });
  }

  apply(): void {
    const parsed = Number(this.draftThreshold);
    if (!Number.isFinite(parsed) || parsed < 0) {
      this.error = 'The low-stock threshold must be a number greater than or equal to zero.';
      return;
    }
    this.warehouseId = this.draftWarehouseId.trim();
    this.threshold = parsed;
    this.lowStockOnly = this.draftLowStockOnly;
    this.zeroStockOnly = this.draftZeroStockOnly;
    this.load();
  }

  reset(): void {
    this.draftWarehouseId = '';
    this.draftThreshold = 10;
    this.draftLowStockOnly = false;
    this.draftZeroStockOnly = false;
    this.warehouseId = '';
    this.threshold = 10;
    this.lowStockOnly = false;
    this.zeroStockOnly = false;
    this.load();
  }

  isLow(row: InventoryRow): boolean { return row.onHand !== null && row.onHand > 0 && row.onHand <= this.threshold; }
  isHealthy(row: InventoryRow): boolean { return row.onHand !== null && row.onHand > this.threshold; }
  stockLabel(row: InventoryRow): string {
    if (row.onHand === null) return 'Unknown';
    if (row.onHand === 0) return 'Out of stock';
    return row.onHand <= this.threshold ? 'Low stock' : 'In stock';
  }
}
