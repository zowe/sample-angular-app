

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

import { Component, Inject } from '@angular/core';
import { Angular2InjectionTokens } from 'pluginlib/inject-resources';

import { ZluxPopupManagerService, ZluxErrorSeverity } from '@zlux/widgets';

import { HelloService } from './services/hello.service';
import { SettingsService } from './services/settings.service';

import { LocaleService, TranslationService, Language } from 'angular-l10n';

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
  helloText: string;
  serverResponseMessage: string;

  constructor(
    public locale: LocaleService,
    public translation: TranslationService,
    @Inject(Angular2InjectionTokens.PLUGIN_DEFINITION) private pluginDefinition: ZLUX.ContainerPluginDefinition,
    @Inject(Angular2InjectionTokens.LOGGER) private log: ZLUX.ComponentLogger,    
    @Inject(Angular2InjectionTokens.LAUNCH_METADATA) private launchMetadata: any,
    private popupManager: ZluxPopupManagerService,
    private helloService: HelloService,
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
      if (res.status != 200) {
        this.log.warn(`Get defaults from server failed. Data missing or request invalid. Status=${res.status}`);
      }
      try {
        let responseJson = res.json();
        this.log.info(`JSON=${JSON.stringify(responseJson)}`);
        if (res.status == 200) {
          if (responseJson.contents.appid && responseJson.contents.parameters) {
            let paramData = responseJson.contents.parameters.data;
            this.parameters = paramData.parameters;
            this.actionType = paramData.actionType;
            this.targetMode = paramData.appTarget;
            this.targetAppId = responseJson.contents.appid.data.appId;
          } else {
            this.log.warn(`Incomplete data. AppID or Parameters missing.`);
          }
        }
      } catch (e) {
        this.log.warn(`Response was not JSON`);
      }
    }, e => {
      this.log.warn(`Error on getting defaults, e=${e}`);
      this.callStatus = 'Error getting defaults';
    });
  }

  saveToServer() {
    this.settingsService.saveAppRequest(this.actionType, this.targetMode, this.parameters).subscribe(res => {
      this.log.info(`Saved parameters with HTTP status=${res.status}`);
      if (res.status == 200 || res.status == 201) {
        this.settingsService.saveAppId(this.targetAppId).subscribe(res=> {
          this.log.info(`Saved App ID with HTTP status=${res.status}`);
        }, e=> {
          this.log.warn(`Error on saving App ID, e=${e}`);
          this.callStatus = 'Error saving App ID';
        });
      } else {
        this.log.warn(`Error on saving parameters, response status=${res.status}`);
      }
    }, e => {
      this.log.warn(`Error on saving parameters, e=${e}`);
      this.callStatus = 'Error saving parameters';
    });
  }

  sayHello() {
    this.helloService.sayHello(this.helloText)
    .subscribe(res => {
      const responseJson: any = res.json();
      if (responseJson != null && responseJson.serverResponse != null) {
        this.serverResponseMessage = 
        `${this.translation.translate('server_replied_with')}

        "${responseJson.serverResponse}"`;
      } else {
        this.serverResponseMessage = "<Empty Reply from Server>";
      }
      this.log.info(responseJson);
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
}


/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

