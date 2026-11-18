import { Component, Input } from '@angular/core';

@Component({
  selector: 'wms-page-header',
  standalone: true,
  template: `
    <section class="page-head">
      <div>
        <div class="eyebrow">{{ eyebrow }}</div>
        <h1>{{ heading }}</h1>
        <p class="subhead">{{ subhead }}</p>
      </div>
      <div class="head-actions"><ng-content /></div>
    </section>
  `
})
export class PageHeaderComponent {
  @Input() eyebrow = '';
  @Input() heading = '';
  @Input() subhead = '';
}
