import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfigService } from './core/config.service';
import { LiveService } from './core/live.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatSnackBarModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  private cfg = inject(ConfigService);
  private live = inject(LiveService);
  private snack = inject(MatSnackBar);
  title = 'bvg-portal';
  constructor(){
    this.cfg.load();
    this.live.onSystemNotification(n => {
      if (!n || !n.Message) return;
      this.snack.open(n.Message, 'OK', { duration: 3000 });
    });
  }
}
