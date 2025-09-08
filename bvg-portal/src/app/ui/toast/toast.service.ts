import { Injectable, Injector } from '@angular/core';
import { Overlay, OverlayConfig, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { UiToastContainerComponent } from './toast_container.component';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private host?: OverlayRef;
  private container?: UiToastContainerComponent;

  constructor(private overlay: Overlay, private injector: Injector) {}

  private ensureHost(){
    if (!this.host) {
      const cfg = new OverlayConfig({
        hasBackdrop: false,
        scrollStrategy: this.overlay.scrollStrategies.reposition(),
        positionStrategy: this.overlay.position().global().top('16px').right('16px')
      });
      this.host = this.overlay.create(cfg);
      const portal = new ComponentPortal(UiToastContainerComponent, null, this.injector);
      const ref = this.host.attach(portal);
      this.container = ref.instance;
    }
  }

  show(message: string, type: ToastType = 'info', duration = 2500){
    this.ensureHost();
    this.container?.push({ message, type, duration });
  }
}
