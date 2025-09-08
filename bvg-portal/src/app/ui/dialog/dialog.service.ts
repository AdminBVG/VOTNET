import { Injectable, Injector, TemplateRef, Type } from '@angular/core';
import { Overlay, OverlayConfig, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal, TemplatePortal } from '@angular/cdk/portal';
import { UiDialogContainerComponent } from './dialog_container.component';

@Injectable({ providedIn: 'root' })
export class DialogService {
  constructor(private overlay: Overlay, private injector: Injector) {}

  openTemplate(tpl: TemplateRef<any>, context?: any){
    const ref = this.createHost();
    const portal = new ComponentPortal(UiDialogContainerComponent);
    const cmpRef = ref.attach(portal);
    cmpRef.instance.attachTemplate(tpl, context);
    cmpRef.instance.closed.subscribe(()=> ref.dispose());
    return { close: () => { try { cmpRef.instance.close(); } catch { ref.dispose(); } } };
  }

  openComponent<T>(cmp: Type<T>){
    const ref = this.createHost();
    const portal = new ComponentPortal(UiDialogContainerComponent);
    const cmpRef = ref.attach(portal);
    const inner = cmpRef.instance.attachComponent(cmp);
    cmpRef.instance.closed.subscribe(()=> ref.dispose());
    return { componentRef: inner, close: () => { try { cmpRef.instance.close(); } catch { ref.dispose(); } } };
  }

  private createHost(): OverlayRef {
    const cfg = new OverlayConfig({
      hasBackdrop: true,
      backdropClass: 'bg-black/40',
      panelClass: 'overlay-elevated',
      scrollStrategy: this.overlay.scrollStrategies.block(),
      positionStrategy: this.overlay.position().global().centerHorizontally().centerVertically()
    });
    const ref = this.overlay.create(cfg);
    ref.backdropClick().subscribe(()=> ref.dispose());
    // Close on ESC for accessibility
    ref.keydownEvents().subscribe(e => { if (e.key === 'Escape') { ref.dispose(); } });
    return ref;
  }
}

