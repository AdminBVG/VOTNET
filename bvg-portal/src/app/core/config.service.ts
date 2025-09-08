import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments';

export interface AppConfig {
  storageRoot: string;
  smtp: { host: string; port: number; user: string; from: string; };
  azureAd: { tenantId: string; clientId: string; };
  branding: { logoUrl: string; };
  security?: { csp: string };
  signing?: { requireForCertification: boolean; defaultPfxPath?: string };
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private http = inject(HttpClient);
  private cfg = signal<AppConfig | null>(null);

  load(){
    if(!this.cfg()){
      this.http.get<AppConfig>(`/api/config/`).subscribe({ next: c => this.cfg.set(c) });
    }
  }

  logoUrl = computed(() => this.cfg()?.branding?.logoUrl || 'assets/bvg-logo.png');
  azureClientId = computed(() => this.cfg()?.azureAd?.clientId || environment.azureClientId);
  azureTenantId = computed(() => this.cfg()?.azureAd?.tenantId || environment.azureTenantId);
}

