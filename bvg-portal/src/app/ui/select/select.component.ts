import { Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { OverlayModule, CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition, Overlay } from '@angular/cdk/overlay';

type Option = { label: string; value: string } | string | number;

@Component({
  selector: 'ui-select',
  standalone: true,
  imports: [NgFor, NgIf, OverlayModule, CdkConnectedOverlay, CdkOverlayOrigin],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSelectComponent), multi: true }],
  template: `
  <div class="relative inline-block w-full" [class.w-44]="!block" [class.w-full]="block">
    <button type="button" class="select-btn" [attr.aria-expanded]="open" [disabled]="disabled" cdkOverlayOrigin #origin="cdkOverlayOrigin"
            (click)="toggle()" (keydown)="onButtonKeydown($event)">
      <span class="truncate">{{ selectedLabel() || placeholder }}</span>
      <span class="chevron" aria-hidden="true">â–¼</span>
    </button>

    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="open"
                 [cdkConnectedOverlayHasBackdrop]="true" (backdropClick)="close()" (detach)="close()"
                 [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayPanelClass]="'overlay-elevated'"
                 [cdkConnectedOverlayWidth]="overlayWidth" [cdkConnectedOverlayOffsetY]="4"
                 [cdkConnectedOverlayScrollStrategy]="scrollStrategy" [cdkConnectedOverlayPush]="true">
      <div class="panel" role="listbox" [attr.aria-activedescendant]="activeId">
        <div *ngIf="searchable" class="p-2 border-b border-gray-200">
          <input #searchInput type="text" class="search" [placeholder]="searchPlaceholder" (input)="onSearch($event)"/>
        </div>
        <div class="max-h-60 overflow-auto py-1">
          <div *ngFor="let opt of filteredOptions; let i = index"
               class="option" [class.active]="i===activeIndex" [id]="idFor(i)" role="option"
               [attr.aria-selected]="isSelected(opt)" (click)="select(opt)" (mousemove)="hover(i)">
            <span class="truncate">{{ displayLabel(opt) }}</span>
            <span class="check" *ngIf="isSelected(opt)">âœ”</span>
          </div>
          <div *ngIf="!filteredOptions.length" class="px-3 py-2 text-sm text-gray-500">Sin opciones</div>
        </div>
      </div>
    </ng-template>
  </div>
  `,
  styles: [`
    .select-btn{ @apply w-full justify-between text-left inline-flex items-center gap-2 rounded-xl border bg-white dark:bg-surface px-3 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary disabled:opacity-50 disabled:cursor-not-allowed; }
    .chevron{ @apply ml-2 opacity-60 text-xs; }
    .panel{ @apply bg-white dark:bg-surface rounded-xl shadow-xl border border-gray-200 min-w-[10rem]; }
    .search{ @apply w-full rounded-lg border border-gray-300 bg-white dark:bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30; }
    .option{ @apply px-3 py-2 text-sm flex items-center justify-between cursor-pointer; }
    .option:hover, .option.active{ @apply bg-brand-primary/10; }
    .check{ @apply text-brand-primary text-xs ml-3; }
  `]
})
export class UiSelectComponent implements ControlValueAccessor {
  @Input() options: Option[] = [];
  @Input() placeholder = 'Seleccione';
  @Input() searchPlaceholder = 'Buscarâ€¦';
  @Input() disabled = false;
  @Input() block = false;
  @Input() searchable = false;
  @Output() opened = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('origin') originRef?: CdkOverlayOrigin;

  open = false;
  value: any = '';
  filteredOptions: Option[] = [];
  activeIndex = -1;
  activeId: string | null = null;
  overlayWidth = 0;

  positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
  ];
  scrollStrategy = inject(Overlay).scrollStrategies.reposition();

  private onChange: (val: any) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(){ this.filteredOptions = [...this.options]; }

  writeValue(val: any): void { this.value = val; }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean): void { this.disabled = isDisabled; }

  toggle(){ if (this.disabled) return; this.open ? this.close() : this.openPanel(); }
  openPanel(){
    this.open = true; this.opened.emit();
    setTimeout(()=>{
      this.searchInput?.nativeElement?.focus();
      this.syncActiveToValue();
      try {
        const el = this.originRef?.elementRef?.nativeElement as HTMLElement | undefined;
        this.overlayWidth = el ? el.getBoundingClientRect().width : 0;
      } catch {}
    }, 0);
  }
  close(){ this.open = false; this.activeIndex = -1; this.activeId = null; this.closed.emit(); this.onTouched(); }

  onButtonKeydown(e: KeyboardEvent){
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if(!this.open) this.openPanel(); else this.moveActive(1); }
  }
  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent){
    if (!this.open) return;
    if (e.key === 'Escape'){ e.preventDefault(); this.close(); }
    if (e.key === 'ArrowDown'){ e.preventDefault(); this.moveActive(1); }
    if (e.key === 'ArrowUp'){ e.preventDefault(); this.moveActive(-1); }
    if (e.key === 'Enter'){ e.preventDefault(); const opt = this.filteredOptions[this.activeIndex]; if (opt!=null) this.select(opt); }
  }
  moveActive(delta: number){
    if (!this.filteredOptions.length) return;
    if (this.activeIndex<0) this.activeIndex = 0; else this.activeIndex = (this.activeIndex + delta + this.filteredOptions.length) % this.filteredOptions.length;
    this.activeId = this.idFor(this.activeIndex);
  }
  hover(i: number){ this.activeIndex = i; this.activeId = this.idFor(i); }

  onSearch(ev: Event){
    const q = (ev.target as HTMLInputElement).value.toLowerCase();
    this.filteredOptions = (this.options || []).filter(o => this.displayLabel(o).toLowerCase().includes(q));
    this.activeIndex = this.filteredOptions.length ? 0 : -1;
    this.activeId = this.activeIndex>=0 ? this.idFor(this.activeIndex) : null;
  }
  private syncActiveToValue(){
    const idx = this.filteredOptions.findIndex(o => this.displayValue(o) === this.value);
    this.activeIndex = idx >= 0 ? idx : 0;
    this.activeId = this.activeIndex>=0 ? this.idFor(this.activeIndex) : null;
  }

  select(opt: Option){
    const v = this.displayValue(opt);
    this.value = v; this.onChange(v); this.close();
  }

  isSelected(opt: Option){ return this.displayValue(opt) === this.value; }
  selectedLabel(){ const match = (this.options||[]).find(o=> this.displayValue(o)===this.value); return match ? this.displayLabel(match) : ''; }
  displayLabel(opt: Option){ return typeof opt === 'string' || typeof opt === 'number' ? String(opt) : opt.label; }
  displayValue(opt: Option){ return typeof opt === 'string' || typeof opt === 'number' ? String(opt) : opt.value; }
  idFor(i: number){ return `opt-${i}`; }
}




