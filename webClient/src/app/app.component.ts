

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

import { Component, Inject } from '@angular/core';

import { Angular2InjectionTokens } from 'pluginlib/inject-resources';

import { HelloService } from './services/hello.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [HelloService]
})

export class AppComponent {
  targetAppId: string = "com.rs.mvd.tn3270";
  callStatus: string = "Status will appear here.";
  requestText: string =
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
    @Inject(Angular2InjectionTokens.PLUGIN_DEFINITION) private pluginDefinition: ZLUX.ContainerPluginDefinition,
    @Inject(Angular2InjectionTokens.LOGGER) private log: ZLUX.ComponentLogger,    
    //@Inject(Angular2InjectionTokens.LAUNCH_METADATA) private launchMetadata: any,
    private helloService: HelloService) {
    //is there a better way so that I can get this info into the HelloService constructor instead of calling a set method directly after creation???
    this.helloService.setDestination(ZoweZLUX.uriBroker.pluginRESTUri(this.pluginDefinition.getBasePlugin(), 'hello',""));
  }

  sayHello() {
    this.helloService.sayHello(this.helloText)
    .subscribe(res => {
      const responseJson: any = res.json();
      if (responseJson != null && responseJson.serverResponse != null) {
        this.serverResponseMessage = 
        `Server replied with 
        
        "${responseJson.serverResponse}"`;
      } else {
        this.serverResponseMessage = "<Empty Reply from Server>";
      }
      this.log.info(responseJson);
    });
  }

  sendAppRequest() {
    var parameters = null;
    /*Parameters for Actions could be a number, string, or object. The actual event context of an Action that an App recieves will be an object with attributes filled in via these parameters*/
    try {
      if (this.requestText !== undefined && this.requestText.trim() !== "") {
        parameters = JSON.parse(this.requestText);
      }
    } catch (e) {
      //this.requestText was not JSON
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
          let argumentData = {'data':(parameters ? parameters : this.requestText)};
          this.log.info((message = 'App request succeeded'));
          this.callStatus = message;
          /*Just because the Action is invoked does not mean the target App will accept it. We've made an Action on the fly,
            So the data could be in any shape under the "data" attribute and it is up to the target App to take action or ignore this request*/
          dispatcher.invokeAction(action,argumentData);
        } else {
          this.log.warn((message = 'Invalid target mode or action type specified'));        
        }
      } else {
        this.log.warn((message = 'Could not find App with ID provided'));
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

