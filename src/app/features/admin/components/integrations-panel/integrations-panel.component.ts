import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

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
export class IntegrationsPanelComponent {
  readonly integrations = signal<IntegrationConfig[]>([
    {
      id: 'quickbooks',
      name: 'QuickBooks Online',
      description: 'Accounting, invoicing, and payment sync',
      icon: 'account_balance',
      status: 'not_configured',
      category: 'accounting',
    },
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
  ]);
}
