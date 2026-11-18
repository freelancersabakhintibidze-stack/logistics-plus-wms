import { Component, OnInit, inject } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { Pagination, Product } from '../core/models';
import { StateBlockComponent } from '../shared/state-block.component';
import { PageHeaderComponent } from '../shared/page-header.component';

@Component({
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, FormsModule, StateBlockComponent, PageHeaderComponent],
  template: `
    <wms-page-header eyebrow="CATALOG MANAGEMENT" heading="Products"
      subhead="Search, filter and review product records from the connected catalog.">
      <button class="btn btn-light" type="button" (click)="exportCsv()">⇩ Export CSV</button>
    </wms-page-header>

    <section class="panel filters">
      <form (ngSubmit)="apply()">
        <label class="search">
          <span aria-hidden="true">⌕</span>
          <input name="search" [(ngModel)]="draftSearch" maxlength="200"
                 placeholder="Search SKU or product name…" aria-label="Search SKU or product name" />
        </label>
        <label>Category ID
          <input name="categoryId" [(ngModel)]="draftCategoryId" maxlength="100" placeholder="Any category" />
        </label>
        <label>Sort by
          <select name="sort" [(ngModel)]="draftSort">
            <option value="sku">SKU</option>
            <option value="name">Product name</option>
            <option value="price">Unit price</option>
          </select>
        </label>
        <button class="btn btn-primary" type="submit">Apply filters</button>
        <button class="btn btn-light" type="button" (click)="reset()">Reset</button>
      </form>

      @if (search || categoryId) {
        <div class="chips">
          <span class="chips-label">ACTIVE FILTERS</span>
          @if (search) {
            <span class="chip">Search: {{ search }}<button type="button" (click)="clearSearch()" aria-label="Remove search filter">×</button></span>
          }
          @if (categoryId) {
            <span class="chip">Category: {{ categoryId }}<button type="button" (click)="clearCategory()" aria-label="Remove category filter">×</button></span>
          }
        </div>
      }
    </section>

    <section class="panel table-panel">
      <div class="panel-head">
        <div><h2>Product catalog</h2><p>SKU, title, category, unit price and active status</p></div>
        <span class="meta">{{ (pagination?.total ?? 0) | number }} records</span>
      </div>

      @if (loading) {
        <wms-state mode="loading" />
      } @else if (error) {
        <wms-state mode="error" [message]="error" (retry)="load()" />
      } @else if (!products.length) {
        <wms-state mode="empty" title="No products found"
          message="No database records match these filters. Try a broader search or reset the filters." />
      } @else {
        <div class="table-wrap">
          <table>
            <caption class="sr-only">Product catalog results</caption>
            <thead>
              <tr>
                <th scope="col"><button type="button" (click)="sortBy('sku')">SKU ↕</button></th>
                <th scope="col"><button type="button" (click)="sortBy('name')">Product ↕</button></th>
                <th scope="col">Category ID</th>
                <th scope="col"><button type="button" (click)="sortBy('price')">Unit price ↕</button></th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (product of products; track product.sku ?? product.name ?? $index) {
                <tr>
                  <td class="sku">{{ product.sku ?? '—' }}</td>
                  <td><b>{{ product.name ?? 'Unnamed product' }}</b></td>
                  <td>{{ product.categoryId ?? '—' }}</td>
                  <td>{{ product.unitPrice === null ? '—' : (product.unitPrice | currency:'USD':'symbol':'1.2-4') }}</td>
                  <td>
                    <span class="badge" [class.good]="isActive(product.active)" [class.neutral]="!isActive(product.active)">
                      {{ isActive(product.active) ? 'Active' : product.active === null ? 'Unknown' : 'Inactive' }}
                    </span>
                  </td>
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
            <button class="btn btn-light" type="button" (click)="move(1)"
              [disabled]="page >= (pagination?.totalPages || 1)">Next →</button>
          </div>
        </div>
      }
    </section>
  `
})
export class ProductsComponent implements OnInit {
  private readonly api = inject(ApiService);
  products: Product[] = [];
  pagination: Pagination | null = null;
  page = 1;
  pageSize = 20;
  search = '';
  categoryId = '';
  sort = 'sku';
  direction: 'asc' | 'desc' = 'asc';
  draftSearch = '';
  draftCategoryId = '';
  draftSort = 'sku';
  loading = false;
  error = '';

  ngOnInit(): void { this.load(); }

  get rangeStart(): number { return this.products.length ? (this.page - 1) * this.pageSize + 1 : 0; }
  get rangeEnd(): number { return Math.min(this.page * this.pageSize, this.pagination?.total ?? 0); }

  load(): void {
    this.loading = true;
    this.error = '';
    this.api.products({
      page: this.page,
      pageSize: this.pageSize,
      search: this.search,
      categoryId: this.categoryId,
      sort: this.sort,
      direction: this.direction
    }).subscribe({
      next: result => { this.products = result.data; this.pagination = result.pagination; this.loading = false; },
      error: (failure: Error) => { this.error = failure.message; this.products = []; this.loading = false; }
    });
  }

  apply(): void {
    this.search = this.draftSearch.trim();
    this.categoryId = this.draftCategoryId.trim();
    this.sort = this.draftSort;
    this.page = 1;
    this.load();
  }

  reset(): void {
    this.draftSearch = '';
    this.draftCategoryId = '';
    this.draftSort = 'sku';
    this.search = '';
    this.categoryId = '';
    this.sort = 'sku';
    this.direction = 'asc';
    this.page = 1;
    this.load();
  }

  clearSearch(): void { this.draftSearch = ''; this.search = ''; this.page = 1; this.load(); }
  clearCategory(): void { this.draftCategoryId = ''; this.categoryId = ''; this.page = 1; this.load(); }

  sortBy(key: string): void {
    if (this.sort === key) this.direction = this.direction === 'asc' ? 'desc' : 'asc';
    else { this.sort = key; this.direction = 'asc'; }
    this.draftSort = this.sort;
    this.load();
  }

  move(delta: number): void {
    const next = this.page + delta;
    if (next < 1 || next > (this.pagination?.totalPages ?? 1)) return;
    this.page = next;
    this.load();
  }

  isActive(value: unknown): boolean {
    return value === true || value === 1 || String(value).toLowerCase() === 'true' || String(value) === '1';
  }

  exportCsv(): void {
    // Active filters are forwarded so an export always matches the visible grid.
    window.location.assign(this.api.exportUrl('products', { search: this.search, categoryId: this.categoryId }));
  }
}
