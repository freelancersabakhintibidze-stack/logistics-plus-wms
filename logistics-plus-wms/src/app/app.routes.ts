import { Routes } from '@angular/router';

// Feature routes are lazy-loaded so each workspace area ships as its own chunk.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: 'Dashboard — Logistics Plus WMS',
    loadComponent: () => import('./pages/dashboard.component').then(m => m.DashboardComponent)
  },
  {
    path: 'products',
    title: 'Products — Logistics Plus WMS',
    loadComponent: () => import('./pages/products.component').then(m => m.ProductsComponent)
  },
  {
    path: 'inventory',
    title: 'Inventory — Logistics Plus WMS',
    loadComponent: () => import('./pages/inventory.component').then(m => m.InventoryComponent)
  },
  {
    path: 'orders',
    title: 'Orders — Logistics Plus WMS',
    loadComponent: () => import('./pages/orders.component').then(m => m.OrdersComponent)
  },
  {
    path: 'orders/:id',
    title: 'Order detail — Logistics Plus WMS',
    loadComponent: () => import('./pages/order-detail.component').then(m => m.OrderDetailComponent)
  },
  {
    path: 'reports',
    title: 'Reports — Logistics Plus WMS',
    loadComponent: () => import('./pages/reports.component').then(m => m.ReportsComponent)
  },
  {
    path: 'not-found',
    title: 'Not found — Logistics Plus WMS',
    loadComponent: () => import('./pages/not-found.component').then(m => m.NotFoundComponent)
  },
  { path: '**', redirectTo: 'not-found' }
];
