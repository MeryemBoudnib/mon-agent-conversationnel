import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

// Import Angular core modules
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

// Import Angular Material
import { MatCardModule } from '@angular/material/card';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatIconModule } from '@angular/material/icon'; // ✅ AJOUTEZ CET IMPORT

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    importProvidersFrom(
      HttpClientModule,
      FormsModule,
      BrowserAnimationsModule,
      MatCardModule,
      MatToolbarModule,
      MatInputModule,
      MatButtonModule,
      MatListModule,
      MatIconModule // ✅ AJOUTEZ CE MODULE À LA LISTE
    )
  ]
};