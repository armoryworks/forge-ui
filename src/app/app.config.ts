import { APP_INITIALIZER, ApplicationConfig, isDevMode, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { Chart } from 'chart.js';
import { SankeyController, Flow } from 'chartjs-chart-sankey';
import { provideMarkdown } from 'ngx-markdown';
import { TranslateService, provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { firstValueFrom } from 'rxjs';

Chart.register(SankeyController, Flow);

import { routes } from './app.routes';
import { authInterceptor } from './shared/interceptors/auth.interceptor';
import { httpErrorInterceptor } from './shared/interceptors/http-error.interceptor';
import { dateTransformInterceptor } from './shared/interceptors/date-transform.interceptor';

function initTranslations(): () => Promise<void> {
  const translate = inject(TranslateService);
  return async () => {
    const saved = localStorage.getItem('language') || 'en';
    await firstValueFrom(translate.use(saved));
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, httpErrorInterceptor, dateTransformInterceptor])),
    provideCharts(withDefaultRegisterables()),
    provideMarkdown(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideTranslateService({
      defaultLanguage: 'en',
    }),
    provideTranslateHttpLoader({
      prefix: '/assets/i18n/',
      suffix: '.json',
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: initTranslations,
      multi: true,
    },
  ]
};
