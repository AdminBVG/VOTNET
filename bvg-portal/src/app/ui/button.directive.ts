import { Directive, HostBinding, Input } from '@angular/core';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
type BtnSize = 'sm' | 'md' | 'lg';

@Directive({
  selector: '[uiBtn]','standalone': true
})
export class UiButtonDirective {
  @Input('uiBtn') variant: BtnVariant = 'primary';
  @Input() size: BtnSize = 'md';
  @Input() loading = false;
  @Input() block = false;

  @HostBinding('class') get classes() {
    const base = [
      'inline-flex', 'items-center', 'justify-center', 'gap-2', 'font-medium',
      'transition-colors', 'select-none', 'focus:outline-none', 'focus-visible:ring-2',
      'disabled:opacity-50', 'disabled:cursor-not-allowed', 'rounded-xl'
    ];

    const padding = this.size === 'sm' ? ['px-3','py-1.5','text-sm']
      : this.size === 'lg' ? ['px-5','py-3','text-base']
      : ['px-4','py-2.5','text-sm'];

    const block = this.block ? ['w-full'] : [];

    const ring = ['focus-visible:ring-brand-primary/40'];

    let variant: string[] = [];
    switch (this.variant) {
      case 'secondary':
        variant = ['bg-white','text-brand-primary','border','border-brand-primary/40','hover:bg-brand-primary/5'];
        break;
      case 'ghost':
        variant = ['bg-transparent','text-brand-primary','hover:bg-brand-primary/10'];
        break;
      case 'danger':
        variant = ['bg-red-600','text-white','hover:bg-red-700'];
        break;
      case 'link':
        variant = ['bg-transparent','text-brand-primary','underline','underline-offset-4','hover:text-brand-dark'];
        break;
      default:
        variant = ['bg-brand-primary','text-white','shadow-sm','hover:bg-brand-primary/90'];
    }

    return [...base, ...padding, ...variant, ...ring, ...block].join(' ');
  }

  @HostBinding('attr.aria-busy') get ariaBusy(){
    return this.loading ? 'true' : null;
  }
}

