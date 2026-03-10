import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';

import { QuickBooksService } from '../../services/quickbooks.service';

export interface IntegrationConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'not_configured';
  category: 'accounting' | 'shipping' | 'storage' | 'ai' | 'email';
}

@Component({
  selector: 'app-integrations-panel',
  standalone: true,
  imports: [],
  templateUrl: './integrations-panel.component.html',
  styleUrl: './integrations-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationsPanelComponent implements OnInit {
  private readonly qbService = inject(QuickBooksService);

  readonly qbStatus = this.qbService.status;
  readonly qbLoading = this.qbService.loading;

  readonly qbStatusLabel = computed(() => {
    const status = this.qbStatus();
    if (!status) return 'not_configured' as const;
    return status.isConnected ? 'connected' as const : 'not_configured' as const;
  });

  readonly qbCompanyName = computed(() => this.qbStatus()?.companyName ?? null);

  readonly staticIntegrations: IntegrationConfig[] = [
    {
      id: 'minio',
      name: 'MinIO Storage',
      description: 'S3-compatible file storage',
      icon: 'cloud_upload',
      status: 'connected',
      category: 'storage',
    },
    {
      id: 'smtp',
      name: 'SMTP Email',
      description: 'Outbound email notifications and invoices',
      icon: 'email',
      status: 'connected',
      category: 'email',
    },
    {
      id: 'shipping',
      name: 'Shipping Carrier',
      description: 'Rate shopping and label generation (UPS, FedEx, etc.)',
      icon: 'local_shipping',
      status: 'not_configured',
      category: 'shipping',
    },
    {
      id: 'ollama',
      name: 'AI Assistant (Ollama)',
      description: 'Self-hosted AI for smart search and drafting',
      icon: 'psychology',
      status: 'not_configured',
      category: 'ai',
    },
  ];

  ngOnInit(): void {
    this.qbService.loadStatus();
  }

  connectQuickBooks(): void {
    this.qbService.connect();
  }

  disconnectQuickBooks(): void {
    this.qbService.disconnect();
  }

  testQuickBooks(): void {
    this.qbService.testConnection();
  }
}
