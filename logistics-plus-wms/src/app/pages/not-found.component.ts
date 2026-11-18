import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `<section class="panel not-found"><div class="eyebrow">404 · NOT FOUND</div><h1>That workspace does not exist</h1><p>Use the navigation to return to an available WMS area.</p><a class="btn btn-primary" routerLink="/dashboard">Go to dashboard</a></section>`
})
export class NotFoundComponent {}
