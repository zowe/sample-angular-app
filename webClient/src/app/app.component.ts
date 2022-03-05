

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

import { Component, Inject, Optional } from '@angular/core';
import { Angular2InjectionTokens, ContextMenuItem, Angular2PluginViewportEvents } from 'pluginlib/inject-resources';

import { ZluxPopupManagerService, ZluxErrorSeverity } from '@zlux/widgets';

import { HelloService } from './services/hello.service';
import { SettingsService } from './services/settings.service';

import { LocaleService, TranslationService, Language } from 'angular-l10n';
import { catchError } from 'rxjs/operators';
import { zip, throwError } from 'rxjs';
import { StorageServer, StorageService, StorageType } from './services/storage.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [HelloService, ZluxPopupManagerService, SettingsService]
})

export class AppComponent {
  @Language() lang: string;

  targetAppId: string = "org.zowe.terminal.tn3270";
  callStatus: string;
  parameters: string =
`{"type":"connect",
  "connectionSettings":{
    "host":"localhost",
    "port":23,
    "deviceType":5,
    "alternateHeight":60,
    "alternateWidth":132,
    "oiaEnabled": true,
    "security": {
      "type":0
    }
}}`;

  //filled in via radio buttons
  actionType: string = "Launch";
  targetMode: string = "PluginCreate";
  items = ['a', 'b', 'c', 'd']
  helloText = '';
  serverResponseMessage: string;
  private menuItems: ContextMenuItem[];

  storageKey: string;
  storageValue: string;
  storageStatus: string = 'ready';
  storageServer: StorageServer = 'app-server';
  storageType?: StorageType;

  constructor(
    public locale: LocaleService,
    public translation: TranslationService,
    @Inject(Angular2InjectionTokens.PLUGIN_DEFINITION) private pluginDefinition: ZLUX.ContainerPluginDefinition,
    @Inject(Angular2InjectionTokens.LOGGER) private log: ZLUX.ComponentLogger,
    @Inject(Angular2InjectionTokens.LAUNCH_METADATA) private launchMetadata: any,
    @Optional() @Inject(Angular2InjectionTokens.VIEWPORT_EVENTS) private viewportEvents: Angular2PluginViewportEvents,
    private popupManager: ZluxPopupManagerService,
    private helloService: HelloService,
    private storageService: StorageService,
    private settingsService: SettingsService) {
    //is there a better way so that I can get this info into the HelloService constructor instead of calling a set method directly after creation???
    this.helloService.setDestination(ZoweZLUX.uriBroker.pluginRESTUri(this.pluginDefinition.getBasePlugin(), 'hello',""));
    this.settingsService.setPlugin(this.pluginDefinition.getBasePlugin());
    this.popupManager.setLogger(log);
    if (this.launchMetadata != null && this.launchMetadata.data != null && this.launchMetadata.data.type != null) {
      this.handleLaunchOrMessageObject(this.launchMetadata.data);
    }
  }

  handleLaunchOrMessageObject(data: any) {
    switch (data.type) {
    case 'setAppRequest':
      let actionType = data.actionType;
      let msg:string;
      if (actionType == 'Launch' || actionType == 'Message') {
        let mode = data.targetMode;
        if (mode == 'PluginCreate' || mode == 'PluginFindAnyOrCreate') {
          this.actionType = actionType;
          this.targetMode = mode;
          this.targetAppId = data.targetAppId;
          this.parameters = data.requestText;
        } else {
          msg = `Invalid target mode given (${mode})`;
          this.log.warn(msg);
          this.callStatus = msg;
        }
      } else {
        msg = `Invalid action type given (${actionType})`;
        this.log.warn(msg);
        this.callStatus = msg;
      }
      break;
    default:
      this.log.warn(`Unknown command (${data.type}) given in launch metadata.`);
    }
  }

  /* I expect a JSON here*/
  zluxOnMessage(eventContext: any): Promise<any> {
    return new Promise((resolve,reject)=> {
      if (eventContext != null && eventContext.data != null && eventContext.data.type != null) {
        resolve(this.handleLaunchOrMessageObject(eventContext.data));
      } else {
        let msg = 'Event context missing or malformed';
        this.log.warn('onMessage '+msg);
        return reject(msg);
      }
    });
  }


  provideZLUXDispatcherCallbacks(): ZLUX.ApplicationCallbacks {
    return {
      onMessage: (eventContext: any): Promise<any> => {
        return this.zluxOnMessage(eventContext);
      }
    }
  }

  getDefaultsFromServer() {
    this.settingsService.getDefaultsFromServer().subscribe(res => {
      this.log.info(`JSON=${JSON.stringify(res)}`);
      if (res.contents.appid && res.contents.parameters) {
        let paramData = res.contents.parameters.data;
        this.parameters = paramData.parameters;
        this.actionType = paramData.actionType;
        this.targetMode = paramData.appTarget;
        this.targetAppId = res.contents.appid.data.appId;
      } else {
        this.log.warn(`Incomplete data. AppID or Parameters missing.`);
      }
    }, e => {
      this.log.warn(`Error on getting defaults, e=${e}`);
      this.callStatus = 'Error getting defaults';
    });
  }

  saveToServer(): void {
    zip(
      this.settingsService.saveAppRequest(this.actionType, this.targetMode, this.parameters)
        .pipe(catchError(err => {
          this.log.warn(`Error on saving parameters, e=${err}`);
          this.callStatus = 'Error saving parameters';
          return throwError(err);
        })),
      this.settingsService.saveAppId(this.targetAppId)
        .pipe(catchError(err => {
          this.log.warn(`Error on saving App ID, e=${err}`);
          this.callStatus = 'Error saving App ID';
          return throwError(err);
        })),
    ).subscribe(
      () => this.log.info(`Saved parameters and App ID`)
    )
  }

  sayHello(): void {
    this.helloService.sayHello(this.helloText)
    .subscribe((res:any) => {
      if (res != null) {
        this.serverResponseMessage =
        `${this.translation.translate('server_replied_with')}

        "${res.serverResponse}"`;
      } else {
        this.serverResponseMessage = "<Empty Reply from Server>";
      }
      this.log.info(res);
    });
  }

  sendAppRequest() {
    var parameters = null;
    const popupOptions = {
      blocking: true,
      buttons: [this.translation.translate('close')]
    };
    /*Parameters for Actions could be a number, string, or object. The actual event context of an Action that an App recieves will be an object with attributes filled in via these parameters*/
    try {
      if (this.parameters !== undefined && this.parameters.trim() !== "") {
        parameters = JSON.parse(this.parameters);
      }
    } catch (e) {
      //this.parameters was not JSON
    }
    if (this.targetAppId) {
      let message = '';
      /*
         With ZLUX, there's a global called ZoweZLUX which holds useful tools. So, a site
         Can determine what actions to take by knowing if it is or isnt embedded in ZLUX via IFrame.
      */
      /* PluginManager can be used to find what Plugins (Apps are a type of Plugin) are part of the current ZLUX instance.
         Once you know that the App you want is present, you can execute Actions on it by using the Dispatcher.
      */
      let dispatcher = ZoweZLUX.dispatcher;
      let pluginManager = ZoweZLUX.pluginManager;
      let plugin = pluginManager.getPlugin(this.targetAppId);
      if (plugin) {
        let type = dispatcher.constants.ActionType[this.actionType];
        let mode = dispatcher.constants.ActionTargetMode[this.targetMode];

        if (type != undefined && mode != undefined) {
          let actionTitle = 'Launch app from sample app';
          let actionID = 'org.zowe.zlux.sample.launch';
          let argumentFormatter = {data: {op:'deref',source:'event',path:['data']}};
          /*Actions can be made ahead of time, stored and registered at startup, but for example purposes we are making one on-the-fly.
            Actions are also typically associated with Recognizers, which execute an Action when a certain pattern is seen in the running App.
          */
          let action = dispatcher.makeAction(actionID, actionTitle, mode,type,this.targetAppId,argumentFormatter);
          let argumentData = {'data':(parameters ? parameters : this.parameters)};
          this.log.info((message = this.translation.translate('request_succeeded'))); // App request succeeded
          this.callStatus = message;
          /*Just because the Action is invoked does not mean the target App will accept it. We've made an Action on the fly,
            So the data could be in any shape under the "data" attribute and it is up to the target App to take action or ignore this request*/
          dispatcher.invokeAction(action,argumentData);
        } else {
          this.log.warn((message = 'Invalid target mode or action type specified'));
        }
      } else {
        this.popupManager.reportError(
          ZluxErrorSeverity.WARNING,
          this.translation.translate('invalid_plugin_identifier'), //
          `${this.translation.translate('no_plugin_found_for_identifier')} ${this.targetAppId}`, popupOptions);
      }

      this.callStatus = message;
    }
  }

  generateTestMenuItems(translator: TranslationService): void {
    this.menuItems = [
        {
          "text": translator.translate('items'),
//        "icon": 'icon-person',
          "action": () => {
            this.log.info(translator.translate('items'));
          },
          "children": [
            {
              "text": translator.translate('item_1.1'),
//            "icon": 'icon-settings',
              "action": () => {
                this.log.info(translator.translate('item_1.1'));
              },
              "children": [
                {
                  "text": translator.translate('item_1.1.1'),
//                "icon": 'icon-person',
                  "action": () => {
                    this.log.info(translator.translate('item_1.1.1'));
                  }
                },
                {
                  "text": translator.translate('item_1.1.2'),
//                "icon": 'icon-person',
                  "action": () => {
                    this.log.info(translator.translate('item_1.1.2'));
                  }
                }
              ]
            },
            {
              "text": translator.translate('item_1.2'),
//            "icon": 'icon-person',
              "action": () => {
                this.log.info(translator.translate('item_1.2'));
              },
              "children": [
                {
                  "text": translator.translate('item_1.2.1'),
//                "icon": 'icon-person',
                  "action": () => {
                    this.log.info(translator.translate('item_1.2.1'));
                  }
                },
                {
                  "text": translator.translate('item_1.2.2'),
//                "icon": 'icon-person',
                  "action": () => {
                    this.log.info(translator.translate('item_1.2.2'));
                  }
                }
              ]
            }
          ]
        },
        {
          "text": translator.translate('disabled'),
          "disabled": true,
//        "icon": 'icon-person',
          "action": () => {
            this.log.info(translator.translate('disabled'));
          },
          "children": [
            {
              "text": translator.translate('disabled_1.1'),
//            "icon": 'icon-person',
              "action": () => {
                this.log.info(translator.translate('disabled_1.1'));
              }
            },
            {
              "text": translator.translate('disabled_1.2'),
//            "icon": 'icon-person',
              "action": () => {
                this.log.info(translator.translate('disabled_1.2'));
              }
            }
          ]
        },
        {
          "text": translator.translate('persisting_item'),
//        "icon": 'icon-settings',
          "action": () => {
            this.log.info(translator.translate('persisting_item'));
          },
          "preventCloseMenu": true,
          "children": [
            {
              "text": translator.translate('shortcut_item'),
//            "icon": 'icon-person',
              "shortcutText": 'F5',
              "action": () => {
                this.log.info(translator.translate('shortcut_item'));
              }
            },
            {
              "text": translator.translate('persisting_shortcut_item'),
//            "icon": 'icon-person',
              "shortcutText": 'F6',
              "action": () => {
                this.log.info(translator.translate('persisting_shortcut_item'));
              },
              "preventCloseMenu": true
            }
          ]
        }
      ];
  }

  onRightClick(event: MouseEvent): boolean {
    if (this.viewportEvents) {
      if (!this.menuItems) {this.generateTestMenuItems(this.translation);}
      this.viewportEvents.spawnContextMenu(event.clientX, event.clientY, this.menuItems, true);
    }
    return false;
  }

  storageGet(): void {
    this.storageStatus = 'waiting...';
    this.storageService.get(this.storageKey, this.storageServer, this.storageType)
      .subscribe(
        value => {
          this.storageValue = value;
          this.storageStatus = 'ok'
        }, err => this.handleStorageError(err));
  }

  storageSet(): void {
    this.storageStatus = 'waiting...';
    this.storageService.set(this.storageKey, this.storageValue, this.storageServer, this.storageType)
      .subscribe(() => {
        this.storageClearValue();
        this.storageStatus = 'ok'
      }, err => this.handleStorageError(err));
  }

  storageDelete(): void {
    this.storageStatus = 'waiting...';
    this.storageService.delete(this.storageKey, this.storageServer, this.storageType)
      .subscribe(() => {
        this.storageClearValue();
        this.storageStatus = 'ok'
      }, err => this.handleStorageError(err));
  }

  storageDeleteAll(): void {
    this.storageStatus = 'waiting...';
    this.storageService.deleteAll(this.storageType)
      .subscribe(() => {
        this.storageClearValue();
        this.storageStatus = 'ok'
      }, err => this.handleStorageError(err));
  }

  storageSetAll(): void {
    this.storageStatus = 'waiting...';
    this.storageService.setAll({ [this.storageKey]: this.storageValue }, this.storageType)
      .subscribe(() => {
        this.storageClearValue();
        this.storageStatus = 'ok'
      }, err => this.handleStorageError(err));
  }

  get zssServerSelected(): boolean {
    return this.storageServer === 'zss';
  }

  storageServerChanged(storageServer: StorageServer): void {
    if (storageServer === 'zss' && this.storageType === 'cluster') {
      this.storageType = undefined;
    }
  }

  private storageClearValue(): void {
    this.storageValue = '';
  }

  private handleStorageError(err: any): void {
    this.storageStatus = 'failed';
    if (err instanceof HttpErrorResponse) {
      if (err.error && err.error.err) {
        this.log.warn(`Storage error: ${err.error.err}`);
      } else {
        this.log.warn(`Storage error: ${err.error}`);
      }
    } else if (err instanceof Error) {
      this.log.warn(`Storage error: ${err.message}`);
    } else {
      this.log.warn(`Storage error: ${err}`);
    }
  }
}


/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

