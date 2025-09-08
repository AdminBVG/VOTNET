import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfigService } from './core/config.service';
import { LiveService } from './core/live.service';
import { ToastService } from './ui/toast/toast.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  private cfg = inject(ConfigService);
  private live = inject(LiveService);
  private toast = inject(ToastService);
  title = 'bvg-portal';
  constructor(){
    this.cfg.load();
    this.live.onSystemNotification(n => {
      if (!n || !n.Message) return;
      this.toast.show(n.Message, 'info', 3000);
    });
  }
}

