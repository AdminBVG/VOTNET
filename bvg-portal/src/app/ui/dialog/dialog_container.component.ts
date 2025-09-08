import { Component, EventEmitter, Output, TemplateRef, Type, ViewChild, ViewContainerRef } from '@angular/core';
import { PortalModule, ComponentPortal, TemplatePortal } from '@angular/cdk/portal';

@Component({
  selector: 'app-ui-dialog-container',
  standalone: true,
  imports: [PortalModule],
  template: `
  <div class="bg-white dark:bg-surface rounded-2xl shadow-2xl w-[90vw] max-w-xl max-h-[85vh] overflow-auto">
    <div class="p-4 border-b border-gray-200 flex items-center justify-between">
      <ng-content select="[dialog-title]"></ng-content>
      <button class="text-gray-500 hover:text-gray-700" (click)="close()">✕</button>
    </div>
    <div class="p-4">
      <ng-template #vc></ng-template>
    </div>
    <div class="p-3 border-t border-gray-100">
      <ng-content select="[dialog-actions]"></ng-content>
    </div>
  </div>
  `
})
export class UiDialogContainerComponent {
  @Output() closed = new EventEmitter<void>();
  @ViewChild('vc', { read: ViewContainerRef, static: true }) vc!: ViewContainerRef;

  attachTemplate(tpl: TemplateRef<any>, ctx?: any){
    this.vc.clear();
    this.vc.createEmbeddedView(tpl, ctx ?? {});
  }
  attachComponent<T>(cmp: Type<T>){
    this.vc.clear();
    return this.vc.createComponent(cmp);
  }
  close(){ this.closed.emit(); }
}

