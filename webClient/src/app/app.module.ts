

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

import { CommonModule } from '@angular/common';
import { Inject, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ZluxButtonModule, ZluxPopupManagerModule } from '@zlux/widgets';
import { L10nCache, L10nConfig, L10nLoader, L10nLocale, L10nTranslationModule, L10nTranslationService, L10N_CONFIG, L10N_LOCALE } from 'angular-l10n';
import { Angular2InjectionTokens } from 'pluginlib/inject-resources';
import { AppComponent } from './app.component';
import { HelloService } from './services/hello.service';
import { StorageService } from './services/storage.service';





export const l10nConfig: L10nConfig = {
  format: 'language-region',
  providers: [
    { name: 'app', asset: 'my asset' },
  ],
  cache: true,
  keySeparator: '.',
  defaultLocale: { language: 'en-US' },
  schema: [],
};


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
      providers: [ L10nCache, L10nTranslationService ]
    }

  ],
  providers: [HelloService, StorageService],
  bootstrap: [AppComponent]
})
export class AppModule {
  constructor(
    private l10nLoader: L10nLoader,
    private translation: L10nTranslationService,
    @Inject(Angular2InjectionTokens.PLUGIN_DEFINITION) private pluginDefinition: ZLUX.ContainerPluginDefinition,
    //@Inject(Angular2InjectionTokens.L10N_CONFIG) private l10nConfigOld: Angular2L10nConfig,
    //@Inject(Angular2InjectionTokens.L10N_LOADER) private myl10nLoader: L10nTranslationLoader,
    @Inject(L10N_CONFIG) private l10nConfig: L10nConfig,
    @Inject(L10N_LOCALE) private l10nLocale: L10nLocale,
  ) {
    this.pluginDefinition;
    console.log(this.l10nLoader); //.init();
    this.translation.init();
    // this.translation.loadTranslation([{
    //   name: 'app', asset: '', options: { plugin: this.pluginDefinition.getBasePlugin() }
    // }], this.l10nConfig.defaultLocale).then(() => {console.log('loaded')});
    // this.l10nConfig.defaultLocale = this.l10nConfigOld.defaultLocale;
    // this.translationConfig.providers = this.l10nConfig.providers;
    console.log(`l10nConfig`, this.l10nConfig);

    console.log(`l10nLocale`, this.l10nLocale);
    //this.myl10nLoader.init();
  }
}


/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

