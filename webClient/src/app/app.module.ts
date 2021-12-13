

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ZluxButtonModule, ZluxPopupManagerModule } from '@zlux/widgets';
import { L10nCache, L10nTranslationModule, L10nTranslationService } from 'angular-l10n';
import { AppComponent } from './app.component';
import { HelloService } from './services/hello.service';
import { StorageService } from './services/storage.service';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    // BrowserModule, /* remove this for within-MVD development */
    CommonModule,
    FormsModule,
    ZluxButtonModule,
    ZluxPopupManagerModule,
    {
      ngModule: L10nTranslationModule,
      providers: [ L10nCache, L10nTranslationService ] // New Cache and Translation Service
    }
  ],
  providers: [HelloService, StorageService],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(
    private translation: L10nTranslationService,
  ) {
    this.translation.init();
  }
}


/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

