This program and the accompanying materials are
made available under the terms of the Eclipse Public License v2.0 which accompanies
this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

SPDX-License-Identifier: EPL-2.0

Copyright Contributors to the Zowe Project.

# Sample Angular App

This branch acts as a tutorial, intended as a workshop session, which will teach you how to make use of the ZLUX configuration dataservice within an App.
The code here is the completed version, and serves as a reference. To complete this tutorial, you should either build off of a sandbox you have been using to complete the prior tutorials in sequential order, or, you can just [clone the previous tutorial branch here](https://github.com/zowe/sample-app/tree/lab/step-4-widgets-complete) and work from that.

By the end of this tutorial you will:
1. Know how to load user preferences and default settings.
1. Know how to update user preferences for future use

So, let's get started!

1. [Purpose of Configuration Dataservice](#purpose-of-configuration-dataservice)
1. [Setting Up for Rapid Development](#setting-up-for-rapid-development)
1. [Adding Support to the App](#adding-support-to-the-app)
1. [Adding Settings Retrieval](#adding-settings-retrieval)
1. [Adding Settings Storing](#adding-settings-storing)


## Purpose of Configuration Dataservice

When using a multi-user, hosted environment, there's often a need to save and retrieve settings for future use. And beyond that, it's also important that the settings that you save can be distinct from the settings of another user. Yet, such hosted environments are often administrated in a way to provide default settings either to be overridden, or not, dependent upon policy.

ZLUX, the framework for the Zowe UI, provides a solution for these requirements, called the Configuration Dataservice.
This dataservice takes advantage of the knowledge the framework has of Plugins, such as Apps, that are installed, to provide convenient use to developers and security and flexibility for administrators in that
the dataservice acts upon established authorization rules and resource definitions of Plugins in order to allow access to what you need as easily and securely as possible.

We'll now explore some simple use of the dataservice, but there are more features than we will touch on here, so if you are interested to learn more don't hesitate to check the wiki: [Configuration Dataservice](https://github.com/zowe/zlux/wiki/Configuration-Dataservice)

## Setting Up for Rapid Development

Before we get to implementing new features into this App, you should set up your environment to quickly build any changes you put in.
When building web content for ZLUX, Apps are packaged via Webpack, which can automatically scan for file changes on code to quickly repackage only what has changed.
To do this, you would simply run `npm run start`, but you may need to do a few tasks prior:

1. Open up a command prompt to `sample-angular-app/webClient`
1. Set the environment variable MVD_DESKTOP_DIR to the location of `zlux-app-manager/virtual-desktop`. Such as `set MVD_DESKTOP_DIR=../../zlux-app-manager/virtual-desktop`. This is needed whenever building individual App web code due to the core configuration files being located in **virtual-desktop**
1. Execute `npm install`. This installs all the dependencies we put into the **package.json** file above
1. Execute `npm run start`

## Adding Support to the App

The Configuration Dataservice allows for access to settings storage according to what a Plugin declares as being a **resource**. That is to say, the developer is able to determine what is a valid storage item such that unintended access to storage is avoided.

**Resources** are organized into a tree structure, where only leaf **resources** or **sub-resources** can have content stored within. Trying to access a non-leaf resource may instead allow for an aggregated action done on the subresources.

Let's add a definition for the **Resources** that we want to work with, by putting a new attribute into the App's **pluginDefinition.json**. Simply, add the following into `sample-angular-app/pluginDefinition.json`:

```json
  "configurationData": {
    "resources": {
      "requests": {
        "aggregationPolicy": "override",
        "subResources": {
          "app": {
            "aggregationPolicy": "override"
          }
        }
      }
    }
  }
```

The full JSON should now be:

```json
{
  "identifier": "org.zowe.zlux.sample.angular",
  "apiVersion": "1.0.0",
  "pluginVersion": "1.0.0",
  "pluginType": "application",
  "webContent": {
    "framework": "angular2",
    "launchDefinition": {
      "pluginShortNameKey": "sampleangular",
      "pluginShortNameDefault": "Angular Sample",
      "imageSrc": "assets/icon.png"
    },
    "descriptionKey": "Sample App Showcasing Angular Adapter",
    "descriptionDefault": "Sample App Showcasing Angular Adapter",
    "isSingleWindowApp": true,
    "defaultWindowStyle": {
      "width": 800,
      "height": 450,
      "x": 200,
      "y": 50
    }
  },
  "dataServices": [
    {
      "type": "router",
      "name": "hello",
      "filename": "helloWorld.js",
      "routerFactory": "helloWorldRouter",
      "dependenciesIncluded": true,
      "initializerLookupMethod": "external"
    }
  ],
  "configurationData": {
    "resources": {
      "requests": {
        "aggregationPolicy": "override",
        "subResources": {
          "app": {
            "aggregationPolicy": "override"
          }
        }
      }
    }
  }
}
```

After doing this, be sure to restart the ZLUX server, as these properties are only read when adding an App, such as at startup.

## Adding Settings Retrieval

At this point, the server should be able to support accessing & modifying settings for your App, but your App doesn't yet have any way to invoke these commands! Let's start by adding a way for the user to get preferences.

First, open and edit `sample-angular-app/webClient/src/app/app.component.html` to add a new button:

```typescript
      <zlux-button class="iframe-button shadowed" type="button" (click)="sendAppRequest()"
      i18n="send request to application|Send a request to another application on the desktop@@send-app-request">Send App Request</zlux-button> //this was already here
      <zlux-button class="iframe-button shadowed" type="button" (click)="getDefaultsFromServer()">Get from Server</zlux-button> // add this!
```

We'll tie some logic to that button by then editing `app.component.ts` in the same folder, adding a new method to the App Component, **getDefaultsFromServer**

```typescript
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
```

This method is making reference to `this.settingsService`, which doesn't exist yet. Let's make this Angular Service and hook it into the Component.
First, edit the top of `app.component.ts` to import it and reference it, by updating the **@Component** `providers` array:

```typescript
import { SettingsService } from './services/settings.service'; //the new import

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [HelloService, ZluxPopupManagerService, SettingsService]
})
```

And, we'll update the constructor to provide this service to the Component:

```typescript
   constructor(
     @Inject(Angular2InjectionTokens.PLUGIN_DEFINITION) private pluginDefinition: ZLUX.ContainerPluginDefinition,
    @Inject(Angular2InjectionTokens.LOGGER) private log: ZLUX.ComponentLogger,    
    @Inject(Angular2InjectionTokens.LAUNCH_METADATA) private launchMetadata: any,
    private popupManager: ZluxPopupManagerService,
    private helloService: HelloService,
    private settingsService: SettingsService) {    
    //is there a better way so that I can get this info into the HelloService constructor instead of calling a set method directly after creation???
    this.helloService.setDestination(ZoweZLUX.uriBroker.pluginRESTUri(this.pluginDefinition.getBasePlugin(), 'hello',""));
    this.settingsService.setPlugin(this.pluginDefinition.getBasePlugin()); //setup to allow the settingsService to use our Plugin metadata
    this.popupManager.setLogger(log);
    if (this.launchMetadata != null && this.launchMetadata.data != null && this.launchMetadata.data.type != null) {
      this.handleLaunchOrMessageObject(this.launchMetadata.data);
     }
  }
```

To finalize this portion, the Settings Service still needs to be created. Write a new file, `sample-angular-app/webClient/src/app/services/settings.service.ts` with the following contents:

```typescript
import { Injectable } from '@angular/core';
import { Http} from '@angular/http';
@Injectable()
export class SettingsService {
  private plugin:ZLUX.Plugin;
  
  constructor(private http: Http){}
  setPlugin(plugin: ZLUX.Plugin):void {
    this.plugin = plugin;
  }
  getDefaultsFromServer() {
    return this.http.get(ZoweZLUX.uriBroker.pluginConfigUri(this.plugin, 'requests/app', undefined));
  }
}
```

At this point, the App will have a new button that when pressed, will try to grab contents from the server to set the **parameters** and **app ID** inputs that are on the App.
The way it does this is here:

```typescript
//in settings.service.ts...
  getDefaultsFromServer() {
    return this.http.get(ZoweZLUX.uriBroker.pluginConfigUri(this.plugin, 'requests/app', undefined));
  }
  
//in app.component.ts...
  getDefaultsFromServer() {
    this.settingsService.getDefaultsFromServer().subscribe(res => {
    //...
```

ZLUX is providing a convenient object, the [**UriBroker**](https://github.com/zowe/zlux/wiki/URI-Broker), off of the global `ZoweZLUX`, which allows you to get a URI that you can use to access the storage for this App.
The **UriBroker** has several methods for different types of access, but the one you see here is for accessing the resource requested for this App, and to search by the scope of the current user.
When working from the user scope, you'll get the settings that were either saved by the user, or if not found, by some broader scope such as administratively set settings, or App defaults.

If you want to ensure that your App is always getting settings set by an administrator instead of by the user, an alternative URI you could have used could be generated via

`ZoweZLUX.uriBroker.pluginConfigForScopeUri(this.plugin, instance, 'requests/app', undefined);`

This would have instead retrieved settings that were set for the entire Zowe instance, rather than just the current user.

Now, if you try this button we added for getting settings, you'll see we are not done yet! There's nothing saved to begin with, so you'll get an error about there being no content to retrieve.
If you want to store some content, there's different ways you could do this:
1. Place the setting on the filesystem manually... you shouldn't need to do this, but if you ever did, you'd see that the Configuration Dataservice stores content within the **deploy** directories of the server, such as **instanceDir** or **productDir**. Within one, the configuration dataservice places content into `ZLUX/pluginStorage/\<pluginid\>/\<resource\>`
1. Programmatically allow for saving data... let's do this!

## Adding Settings Storing

Since we need to add storing after having added retrieving, we need to add another button, method, and attach the two as we did before.

Add a new button to **app.component.html**:

```typescript
      <zlux-button class="iframe-button shadowed" type="button" (click)="sendAppRequest()"
      i18n="send request to application|Send a request to another application on the desktop@@send-app-request">Send App Request</zlux-button> //this was already here
      <zlux-button class="iframe-button shadowed" type="button" (click)="getDefaultsFromServer()">Get from Server</zlux-button> //we added this a moment ago
      <zlux-button class="iframe-button shadowed" type="button" (click)="saveToServer()">Save to Server</zlux-button> //add this!
```

Now add a new method in **app.component.ts** to the App Component. We'll name it  **saveToServer**

```typescript
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
```

Which, again, is utilizing `this.settingsService` to initiate the HTTP requests. So, now add two new methods within **services/settings.service.ts**:

```typescript
  saveAppRequest(actionType: string, targetMode: string, parameters: string) {
    const requestBody = {
      "_objectType": "org.zowe.zlux.sample.setting.request.app.parameters",
      "_metaDataVersion": "1.0.0",
      "actionType": actionType,
      "appTarget": targetMode,
      "parameters": parameters
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
```

For demonstration purpose, the content is actually being saved slightly differently than it is being retrieved.
You can see we retrieve via a URI we get from calling:

```typescript
ZoweZLUX.uriBroker.pluginConfigUri(this.plugin, 'requests/app', undefined);
```

While, we save by getting two different URIs:

```typescript
ZoweZLUX.uriBroker.pluginConfigUri(this.plugin, 'requests/app', 'parameters');
ZoweZLUX.uriBroker.pluginConfigUri(this.plugin, 'requests/app', 'appid');
```

On the retrieval, the name of the object being retrieved is left as undefined. In this case, it means that the App will be retrieving not a leaf resource, but the parent of leafs.
This is known because when the App is saving data, it is saving `parameters` and `appid` as two JSON files.
Because the content stored in the configuration dataservice is JSON, it is able to aggregate certain things for convenience and also reduce the number of calls needed between the client and server.
So, the App is saving parameters and appid individually, but is retrieving the parent resource of both, and therefore the response from retrieval actually **includes** both **parameters** and **appid**, so only one call was needed.


OK, at this point the App should be able to save and retrieve settings by using the configuration dataservice! 
Go ahead and try it out, and you should see that if you save something to the server via the **Save to Server** button, that when changing the contents of **parameters** and the **App ID** fields, you can restore them to what you saved earlier by pressing **Get from Server**



This program and the accompanying materials are
made available under the terms of the Eclipse Public License v2.0 which accompanies
this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

SPDX-License-Identifier: EPL-2.0

Copyright Contributors to the Zowe Project.
