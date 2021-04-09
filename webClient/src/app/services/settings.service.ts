

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable()
export class SettingsService {
  private plugin:ZLUX.Plugin;
  
  constructor(private http: HttpClient){}

  setPlugin(plugin: ZLUX.Plugin):void {
    this.plugin = plugin;
  }

  getDefaultsFromServer() {
    return this.http.get<any>(ZoweZLUX.uriBroker.pluginConfigUri(this.plugin, 'requests/app', undefined));
  }

  saveAppRequest(actionType: string, targetMode: string, parameters: string, asEvent: boolean, eventName: string) {
    const requestBody = {
      "_objectType": "org.zowe.zlux.sample.setting.request.app.parameters",
      "_metaDataVersion": "1.1.0",
      "actionType": actionType,
      "appTarget": targetMode,
      "parameters": parameters,
      "asEvent": asEvent,
      "eventName": eventName
    }
    return this.http.put(ZoweZLUX.uriBroker.pluginConfigUri(this.plugin, 'requests/app', 'parameters'), requestBody);
  }

  saveAppId(appId: string) {
    const requestBody = {
      "_objectType": "org.zowe.zlux.sample.setting.request.app.appid",
      "_metaDataVersion": "1.0.0",
      "appId": appId
    }
    return this.http.put(ZoweZLUX.uriBroker.pluginConfigUri(this.plugin, 'requests/app', 'appid'), requestBody);
  }
}

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

