import { Directive, HostBinding, Input, Optional } from '@angular/core';
import { NgControl } from '@angular/forms';

@Directive({
  selector: 'input[uiInput], textarea[uiInput], select[uiInput]','standalone': true
})
export class UiInputDirective {
  constructor(@Optional() private ngControl: NgControl){}

  @Input() invalid = false;

  @HostBinding('class') get classes(){
    const base = [
      'block','w-full','rounded-xl','border','bg-white','dark:bg-surface',
      'px-3','py-2.5','text-sm','placeholder:text-gray-400',
      'focus:outline-none','focus:ring-2','focus:ring-brand-primary/30','focus:border-brand-primary',
      'disabled:opacity-50','disabled:cursor-not-allowed'
    ];
    const isInvalid = this.invalid || !!(this.ngControl && this.ngControl.invalid && (this.ngControl.touched || this.ngControl.dirty));
    if (isInvalid) base.push('border-red-500','focus:ring-red-300'); else base.push('border-gray-300');
    return base.join(' ');
  }

  @HostBinding('attr.aria-invalid') get ariaInvalid(){
    const isInvalid = this.invalid || !!(this.ngControl && this.ngControl.invalid && (this.ngControl.touched || this.ngControl.dirty));
    return isInvalid ? 'true' : null;
  }
}

