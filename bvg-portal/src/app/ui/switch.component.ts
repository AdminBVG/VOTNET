import { Component, EventEmitter, forwardRef, HostBinding, Input, Output } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'ui-switch',
  standalone: true,
  template: `
  <button type="button" [attr.aria-checked]="checked" role="switch"
          (click)="toggle()" (keydown.enter)="toggle()" (keydown.space)="toggle()"
          [disabled]="disabled"
          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
          [class.bg-brand-primary]="checked" [class.bg-gray-300]="!checked">
    <span class="sr-only">Toggle</span>
    <span class="inline-block h-5 w-5 transform rounded-full bg-white transition" [class.translate-x-5]="checked" [class.translate-x-1]="!checked"></span>
  </button>
  `,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => UiSwitchComponent),
    multi: true
  }]
})
export class UiSwitchComponent implements ControlValueAccessor {
  @Input() checked = false;
  @Input() disabled = false;
  @Output() checkedChange = new EventEmitter<boolean>();

  private onChange: (val: boolean)=>void = () => {};
  private onTouched: ()=>void = () => {};

  toggle(){ if(this.disabled) return; this.checked = !this.checked; this.onChange(this.checked); this.checkedChange.emit(this.checked); this.onTouched(); }
  writeValue(val: any){ this.checked = !!val; }
  registerOnChange(fn: any){ this.onChange = fn; }
  registerOnTouched(fn: any){ this.onTouched = fn; }
  setDisabledState?(isDisabled: boolean): void { this.disabled = isDisabled; }
}

