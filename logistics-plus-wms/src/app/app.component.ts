import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'wms-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="sidebar" [class.open]="open">
        <a class="brand" routerLink="/dashboard" (click)="open = false">
          <span class="brand-mark">LP</span>
          <span class="brand-copy">
            <strong>LOGISTICS PLUS</strong>
            <small>WAREHOUSE SYSTEMS</small>
          </span>
        </a>

        <div class="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <a routerLink="/dashboard" routerLinkActive="active" (click)="open = false"><span aria-hidden="true">◫</span>Dashboard</a>
          <a routerLink="/products" routerLinkActive="active" (click)="open = false"><span aria-hidden="true">▦</span>Products</a>
          <a routerLink="/inventory" routerLinkActive="active" (click)="open = false"><span aria-hidden="true">▤</span>Inventory</a>
          <a routerLink="/orders" routerLinkActive="active" (click)="open = false"><span aria-hidden="true">▣</span>Orders</a>
          <a routerLink="/reports" routerLinkActive="active" (click)="open = false"><span aria-hidden="true">▥</span>Reports</a>
        </nav>

        <div class="sidebar-bottom">
          <div class="connection-card">
            <i aria-hidden="true"></i>
            <span><b>Enterprise data</b><small>Connection is deployment-managed</small></span>
          </div>
          <small class="version">WMS PORTAL · 1.0.0</small>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <button class="menu" type="button" (click)="open = !open" aria-label="Toggle navigation">☰</button>
          <div class="crumbs">Logistics Plus <b>/</b> <strong>Operations workspace</strong></div>
          <span class="secure"><i aria-hidden="true"></i> Secure workspace</span>
          <span class="avatar">LP</span>
        </header>

        <main><router-outlet /></main>

        <footer>
          <span>Logistics Plus LLC · Warehouse Operations</span>
          <span>Read-only by default · No schema changes</span>
        </footer>
      </div>
    </div>

    @if (open) {
      <button class="overlay" type="button" (click)="open = false" aria-label="Close navigation"></button>
    }
  `
})
export class AppComponent {
  open = false;
}
