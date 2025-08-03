// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { AuthInterceptor } from './app/interceptors/auth.interceptor';


bootstrapApplication(AppComponent, {
  // keep everything else from your existing config…
  ...appConfig,
  providers: [
    // existing providers
    ...(appConfig.providers || []),
BrowserAnimationsModule,
    // 1) hook up HttpClient to pull interceptors from DI
    provideHttpClient(
      withInterceptorsFromDi()
    ),

    // 2) register your AuthInterceptor
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ]
})
.catch(err => console.error(err));
