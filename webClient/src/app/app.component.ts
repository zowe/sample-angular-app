

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
  targetAppId: string = "TODO";
  callStatus: string = "Status will appear here.";
  requestText: string =
`TODO`;

  //filled in via radio buttons
  actionType: string = "Launch";
  targetMode: string = "PluginCreate";
  helloText: string;
  serverResponseMessage: string;

  constructor(
    @Inject(Angular2InjectionTokens.PLUGIN_DEFINITION) private pluginDefinition: ZLUX.ContainerPluginDefinition,
    @Inject(Angular2InjectionTokens.LOGGER) private log: ZLUX.ComponentLogger,    
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
    let message = '';
    this.log.warn((message = 'Unimplemented!'));
    this.callStatus = message;
  }
  
}


/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

