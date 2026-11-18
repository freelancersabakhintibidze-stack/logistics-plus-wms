import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'wms-state',
  standalone: true,
  template: `
    @if (mode === 'loading') {
      <div class="state" role="status" aria-live="polite">
        <div class="skeleton"></div>
        <div class="skeleton"></div>
        <div class="skeleton short"></div>
        <p>Loading records from the enterprise database…</p>
      </div>
    } @else if (mode === 'error') {
      <div class="state error" role="alert">
        <strong>{{ title || 'Unable to load data' }}</strong>
        <p>{{ message }}</p>
        <button type="button" class="btn" (click)="retry.emit()">Retry</button>
      </div>
    } @else {
      <div class="state">
        <strong>{{ title || 'No matching records' }}</strong>
        <p>{{ message || 'Adjust or reset the filters to widen the result set.' }}</p>
      </div>
    }
  `,
  styles: [`
    .state { padding: 30px 22px; border: 1px dashed var(--border); border-radius: 12px; background: #fff; }
    .state p { color: var(--muted); font-size: 13px; margin: 10px 0 0; }
    .state strong { font-size: 14px; }
    .error { border-color: #e9b9b4; background: #fff8f7; }
    .skeleton { height: 14px; border-radius: 6px; background: linear-gradient(90deg, #eef2f7, #f8fafc, #eef2f7); margin-bottom: 11px; animation: pulse 1.3s ease-in-out infinite; }
    .skeleton.short { width: 42%; }
    @keyframes pulse { 0% { opacity: 1 } 50% { opacity: .5 } 100% { opacity: 1 } }
  `]
})
export class StateBlockComponent {
  @Input() mode: 'loading' | 'error' | 'empty' = 'loading';
  @Input() title = '';
  @Input() message = '';
  @Output() retry = new EventEmitter<void>();
}
