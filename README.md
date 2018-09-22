This program and the accompanying materials are
made available under the terms of the Eclipse Public License v2.0 which accompanies
this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

SPDX-License-Identifier: EPL-2.0

Copyright Contributors to the Zowe Project.
# Sample Angular App

This branch acts as a tutorial, intended as a workshop session, which will teach you how to develop your own Zowe App from scratch.
This README contains code snippets and descriptions that you can piece together to complete the App that you will need to complete the tutorial.

By the end of this tutorial, you will:
1. Know how to create an App that shows up on the Desktop
1. Be introduced to Typescript programming
1. Be introduced to simple Angular web development

Further tutorials are present within this repository to expand upon what you learn here, adding new features to the App to teach about different aspects of Apps within Zowe.

**Note: This tutorial assumes you already have a Zowe installation ready to be run. If you do not, try setting one up via the README at [zlux-example-server](https://github.com/zowe/zlux-example-server) before continuing.**

So, let's get started!

1. [Constructing an App Skeleton](#constructing-an-app-skeleton)
1. [Defining your first Plugin](#defining-your-first-plugin)
1. [Constructing a Simple Angular UI](#constructing-a-simple-angular-ui)
    1. [Why Typescript?](#why-typescript)
1. [Packaging Your Web App](#packaging-your-web-app)
1. [Adding Your App to the Desktop](#adding-your-app-to-the-desktop)
    
## Constructing an App Skeleton
If you look within this repository, you'll see that a few boilerplate files already exist to help you get your first App running quickly. The structure of this repository follows the guidelines for Zowe App filesystem layout, which you can read more about [on this wiki](https://github.com/zowe/zlux/wiki/ZLUX-App-filesystem-structure) if you need.


## Defining your first Plugin
So, where do you start when making an App? In the Zowe framework, An App is a Plugin of type Application. Every Plugin is bound by their **pluginDefinition.json** file, which describes what properties it has.
Let's start by creating this file.

Make a file, **pluginDefinition.json**, at the root of the **sample-angular-app** folder.

The file should contain the following:
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
  ]
}
```

You might wonder why we chose the particular values that are put into this file. A description of each can again be found [in the wiki](https://github.com/zowe/zlux/wiki/Zlux-Plugin-Definition-&-Structure).

Of the many attributes here, you should be aware of the following:
* Our App has the unique identifier of `org.zowe.zlux.sample.angular`, which can be used to refer to it when running Zowe
* The App has a `webContent` attribute, because it will have a UI component visible in a browser.
    * The `webContent` section states that the App's code will conform to Zowe's Angular App structure, due to it stating `"framework": "angular2"`
    * The App has certain characteristics that the user will see, such as:
        * The default window size (`defaultWindowStyle`), 
        * An App icon that we provided in `sample-angular-app/webClient/src/assets/icon.png`, 
        * That we should see it in the browser as an App named `Angular Sample`, the value of `pluginShortNameDefault`.
        
## Constructing a Simple Angular UI
Angular Apps for Zowe are structured such that the source code exists within `webClient/src/app`. In here, you can create modules, components, templates and services in whatever hierarchy desired. For the App we are making here however, we'll keep it simple by adding a few files:
* app.module.ts
* app.component.html
* app.component.ts
* app.component.css

As well as a folder with one file, `services/hello.service.ts`.

In the Plugin's definition file, **pluginDefinition.json**, you can see that we defined a dataservice. So, for our App, we'll just start off by displaying some simple content that can test a successful connection to that service.

When making an Angular App, one of the first things you will want to do is to define a module, which helps organize logical units that are being imported, exported, or otherwise utilized within your UI.
So, fill in **app.module.ts** with the following:

```typescript
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';


import { AppComponent } from './app.component';
import {HelloService} from './services/hello.service';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    CommonModule,
    FormsModule
  ],
  providers: [HelloService],
  bootstrap: [AppComponent]
})
export class AppModule { }
```

What you'll see here is that we're pulling in some common Angular objects, but also making declaration of our primary Angular Component, AppComponent, and that we're also going to be providing a Service, HelloService, for use.
So, we'll need to define AppComponent and HelloService soon.

Components in Angular are logic that drives the UI of a module, which is constructed out of HTML and CSS.
Let's start with the HTML.

Fill in **app.component.html** with the following:
```html
<div class="app-component test-panel-container">
  <div class="test-panel plugin-test-panel">
    <div class="bottom-10">
      <span class="bigger-bold-text">Plug-in Request Test</span>
      <!-- Tests the sending of requests to other plugins. Defaults to send a message
           to itself (and responding) to show more parts of the API-->
      <button class="iframe-button shadowed" type="button" (click)="sendAppRequest()">Send App Request</button>
    </div>
    <span class="bold-text">Application Identifier: </span>
    <div>
      <div class="div-input">
        <input class="iframe-input input-height input-corner input-text shadowed" type="text" [(ngModel)]="targetAppId"/>
      </div>
      <div>
        <!-- Action types are used to determine what sort of Action is being taken on whatever App instance is the target. Launch simply creates a new instance with the context you provide, but Message can be used to communicate with an already open Instance to drive some action -->
        
        <label class="bold-text">Action Type: </label>
        <input type="radio" [(ngModel)]="actionType" name="actionType" value="Launch">
        <label for="actionLaunch">Launch</label>

        <input type="radio" [(ngModel)]="actionType" name="actionType" value="Message">
        <label for="actionMessage">Message</label>
      </div>
      <!-- App target modes are used to determine which instance of an App should be communicated with. You can create a new instance to send the Action to, or you could reuse an existing instance that is open. -->
      <div>
        <label class="bold-text">App Target Mode: </label>
        <input type="radio" [(ngModel)]="targetMode" name="targetMode" value="PluginCreate">
        <label for="targetCreate">Create New</label>

        <input type="radio" [(ngModel)]="targetMode" name="targetMode" value="PluginFindAnyOrCreate">
        <label for="targetReuse">Reuse Any Open</label>
      </div>      
      <span class="bold-text hide-it">Target App Window Title (this will become the title for the target window)</span>
      <div class="div-input hide-it">
        <input class="iframe-input input-height input-corner input-text shadowed" type="text" name="appWindowTitle" id="appWindowTitle" placeholder="app window title" value="My New Title"/>
      </div>
      <span class="div-input bold-text">Parameters:</span>
      <div class="div-textarea-input">
        <!-- The text here is merely an example which provides some connection details for the terminal app. It could be anything so long as the receiving App supports it.
             In this example App, the contents here will be put inside of a JSON with the contents as the "data" attribute. -->
        <textarea class="iframe-input input-corner input-text shadowed" rows="10" cols="50" [(ngModel)]="parameters" ></textarea>
      </div>
      <div style="width: 100%">
        <span>App Status or Message:</span>
        <p class="display-text shadowed disable-effect" id="status">{{callStatus}}</p>
      </div>
    </div>
  </div>
  <div class="test-panel dataservice-test-panel">
    <div class="bottom-10">
      <span class="bigger-bold-text">Dataservice Request Test</span>
    </div>
    <div>
      <input placeholder="Message" [(ngModel)]="helloText"
      (keyup.enter)="sayHello()"/>
      <button (click)="sayHello()">Run</button>
    </div>
    <div>
      <label>Response</label>
      <textarea class="server-response" placeholder="Response">{{serverResponseMessage}}</textarea>
    </div>
  </div>
</div>
```

Angular improves upon the basics of web UI by allowing for richer and/or more dynamic activities than you'd be able to easily do in HTML alone, and so these HTML templates help to describe how the UI should operate at runtime.
Some things that you can see above that are enhancements over typical HTML include:
* Square brackets [] and parenthesis () to describe that an attribute of an element takes input or provides output, respectively.
* Element text can be controlled by a variable via a statement inside double curly brackets {{}}
* Certain attributes of elements are interpreted by Angular for special actions, such as ngModel (get/set element value by variable), ngFor (act upon a dynamic set), ngIf (conditionally show elements)

Now that we've included the HTML template, we need to add a CSS file to define the classes referenced.

Fill in **app.component.css** with the following:

```css
.iframe-font {
  font-family: sans-serif;
  font-size: 0.8em;
}

.bold-text {
  font-weight: 600;
}

.bigger-bold-text {
  font-size: 1.1em;
  font-weight: 600;
}

.div-input {
  margin-top: 5px;
  margin-bottom: 10px;
  padding-top: 5px;
  padding-bottom: 5px;
  width: 300px;
}

.div-textarea-input {
  margin-top: 5px;
  margin-bottom: 5px;
  padding-top: 5px;
  padding-bottom: 5px;
  width: 95%;
}

.iframe-input {
  width: 100%;
  padding-left: 5px;
}

.input-corner {
  border-radius: 4px;
}

.input-height {
  height: 20px;
}

.input-text {
}

.iframe-button {
  border-radius: 4px;
  margin: 0px 4px 0px 4px;
  font-weight: 700;
}

.right-align {
  text-align: right;
  padding-right: 50px;
}

.shadowed {
  box-shadow: 3px 3px 10px;
}

.hide-it {
  display: none;
}

.bottom-10 {
  margin-bottom: 10px;
}

.display-text {
  border-radius: 4px;
  border: 1px solid grey;
  background-color: white;
  height: 18px;
  width: 96%;
}

.disable-effect {
  color: grey;
}

h1 {
  text-align: center;
}

.server-response {
  width: 100%;
  height: 180px;
}

.test-panel {
  padding: 5px 5px 5px 5px;
}

.test-panel-container {
  flex-direction: row;
  display: flex;
}

.plugin-test-panel {
  border-right: outset;
  flex-grow: 1;
}

.dataservice-test-panel {
  border-left: outset;
}
```

Then, we can start to fill in the actual logic by starting with the Component, which defines the variables and functions that were referenced in the HTML template.

Fill in **app.component.ts** with the following:

```typescript

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
  parameters: string =
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
```

### Why Typescript?
If you're new to web programming, typescript, javascript, or Angular, you can interpret this file in different ways.
Traditionally, javascript was the language for scripting logic within browsers. However, javascript is an interpreted language which was initially not class based, nor typed, leading to unmaintainable code at scale.
Browser vendors and standards groups have attempted to fix this by adding features to javascript, but have done so slowly and inconsistently between browsers, so trying to make use of new features can sometimes cause more trouble than it solves.
To fix both the problem of incompatibility and structure and feature set, typescript has been invented as a meta-language which allows you to write code that is highly structured, but requires a compilation step, or "transpilation",
in which the code you have written actually is translated to javascript of a chosen feature set in order to run in the environments you need.

In this way, Typescript allows you to write well-structured code without sacrificing portability on the web, so it is highly recommended and all of our documentation will prefer typescript over javascript. In fact, toolkits such as Angular
are only intended to be used with Typescript.

Anyway, when it comes to the Angular code you see above, you'll notice that our Component, AppComponent, has some syntax above the class definition to note that it is a Component which is linked to the template and style files we made prior,
and a Service we will make shortly.
We've imported some Angular code, and the Service, and the methods on the class share the names seen in the HTML template, as well as that the instance variables are being used to control attributes in the template too.

However, in the constructor you will see some of the first Zowe-specific objects.
```
    @Inject(Angular2InjectionTokens.PLUGIN_DEFINITION) private pluginDefinition: ZLUX.ContainerPluginDefinition,
    @Inject(Angular2InjectionTokens.LOGGER) private log: ZLUX.ComponentLogger,    
```
These two are objects that a Component can request for inclusion, and are provided by ZLUX - the Zowe UI framework, as contextual objects. The Plugin definition retrieved is specific to this Plugin - essentially the same as the **pluginDefinition.json** file from earlier, and the logger retrieved is part of a framework-wide logger that allows you to easily trace your code since the logger the Component is given has the same ID as the plugin - so it's unique to your code. Both the plugin definition and logger are shared for all the instances of the Plugin you have.

The second interesting Zowe-specific object type you see is here:
```
this.helloService.setDestination(ZoweZLUX.uriBroker.pluginRESTUri(this.pluginDefinition.getBasePlugin(), 'hello',""));
```
ZoweZLUX is a global object: it can be accessed anywhere in the code as it does not pertain to any specific plugin or instance, but helps you do routine tasks easily. This one takes the plugin definition to accomplish a task specific to your plugin - returning a URI that can be used for a network request without having to hardcode it.


However, we also see this is making use of HelloService, so we better define it now.

Fill in **services/hello.service.ts** with the following:

```typescript
import { Injectable } from '@angular/core';
import { Http} from '@angular/http';
import { Observable } from 'rxjs/Observable';

@Injectable()
export class HelloService {
  private destination:string;
  
  constructor(private http: Http){}

  setDestination(path: string):void {
    this.destination = path;
  }

  sayHello(text: string): Observable<any> {
    const requestBody = {
      "_objectType": "org.zowe.zlux.sample.angular.request.hello",
      "_metaDataVersion": "1.0.0",
      "messageFromClient": text
    }
    return this.http.post(this.destination, requestBody);
  }

}
```

This one is pretty simple - it's just making use of the HTTP object Angular provides to do a network request with minimal boilerplate. The response for the network request is asynchronous, so an Observable is returned which is an object that can be Subscribed to, such that zero or many parties can be notified of its completion.

One important thing that you can see here, though, is that the request body we use contains _objectType and _metaDataVersion. This is a formality we urge people to consider as adding type data to your messages will allow for more convenient framework abilities in the future to operate on that info.

## Packaging Your Web App

At this time, we've made the source for a Zowe App that should open up in the Desktop with a greeting to the planet.
Before we're ready to use it however, we have to transpile the typescript and package the App. This will require a few build tools first. We'll make an NPM package in order to facilitate this.

Let's create a **package.json** file, within `sample-angular-app/webClient` relative to your Zowe installation.
While a package.json can be created through other means such as `npm init` and packages can be added via commands such as `npm install --save-dev typescript@2.9.0`, we'll opt to save time by just pasting these contents in:

```json
{
  "name": "org.zowe.zlux.sample.angular.webclient",
  "version": "1.0.0",
  "scripts": {
    "start": "webpack --progress --colors --watch",
    "build": "webpack --progress --colors",
    "lint": "tslint -c tslint.json \"./**/*.ts\""
  },
  "private": true,
  "dependencies": {},
  "devDependencies": {
    "@angular/animations": "~6.0.9",
    "@angular/common": "~6.0.9",
    "@angular/compiler": "~6.0.9",
    "@angular/core": "~6.0.9",
    "@angular/forms": "~6.0.9",
    "@angular/http": "~6.0.9",
    "@angular/platform-browser": "~6.0.9",
    "@angular/platform-browser-dynamic": "~6.0.9",
    "@angular/language-service": "~6.0.9",
    "@angular/router": "~6.0.9",
    "angular2-template-loader": "~0.6.2",
    "codelyzer": "~4.4.2",
    "copy-webpack-plugin": "~4.5.2",
    "core-js": "~2.5.7",
    "css-loader": "~1.0.0",
    "exports-loader": "~0.7.0",
    "file-loader": "~1.1.11",
    "html-loader": "~0.5.5",
    "rxjs": "~6.2.2",
    "rxjs-compat": "~6.2.2",
    "source-map-loader": "~0.2.3",
    "ts-loader": "~4.4.2",
    "tslint": "~5.10.0",
    "typescript": "~2.9.0",
    "webpack": "~4.0.0",
    "webpack-cli": "~3.0.0",
    "webpack-config": "~7.5.0",
    "zone.js": "~0.8.26"
  }
}
```

Now we're really ready to build.
There's two usual ways you can build an App for Zowe:
1. `npm run build` which builds the App once
1. `npm run start` which builds once, and then monitors your filesystem to quickly rebuild any time your source code is updated - so the build program does not end until you quit it. This is recommended for rapid development

Let's just build the App once for now, this time.
1. Open up a command prompt to `sample-angular-app/webClient`
1. Set the environment variable MVD_DESKTOP_DIR to the location of `zlux-app-manager/virtual-desktop`. Such as `set MVD_DESKTOP_DIR=../../zlux-app-manager/virtual-desktop`. This is needed whenever building individual App web code due to the core configuration files being located in **virtual-desktop**
1. Execute `npm install`. This installs all the dependencies we put into the **package.json** file above
1. Execute `npm run build`

Incidentally, because a **dataservice** also exists in this plugin, we'll need to build that too. Dataservices are built independently of the web content, but we'll need to do it for the initial setup.
1. Change the command prompt to the directory `sample-angular-app/nodeServer`
1. Execute `npm install`. This installs the dependencies for the **nodeServer** content, which is not the same as the content in **webClient**. You'll see a different **package.json** in each.
1. Execute `npm run build`.

OK, after the first execution of the transpilation and packaging concludes, you should have `sample-angular-app/web` populated with files that can be served by the Zowe App Server for the UI, and incidentally also `sample-angular-app/lib` for the server-side logic for the dataservice we have just built.

### Adding Your App to the Desktop
At this point, your sample-angular-app folder contains files for an App that could be added to a Zowe instance. We'll add this to our own Zowe instance. First, ensure that the Zowe App server is not running. Then, navigate to the instance's root folder, `/zlux-example-server`.

Within, you'll see a folder, **plugins**. Take a look at one of the files within the folder. You can see that these are JSON files with the attributes **identifier** and **pluginLocation**. These files are what we call **Plugin Locators**, since they point to a Plugin to be included into the server.

Let's make one ourselves. Make a file `/zlux-example-server/plugins/org.zowe.zlux.sample.angular.json`, with these contents:
```json
{
  "identifier": "org.zowe.zlux.sample.angular",
  "pluginLocation": "../../sample-angular-app"
}
```

When the server runs, it will check for these sorts of files in its `pluginsDir`, a location known to the server via its specification in the [server configuration file](https://github.com/zowe/zlux/wiki/Configuration-for-zLUX-Proxy-Server-&-ZSS#app-configuration). In our case, this is `/zlux-example-server/deploy/instance/ZLUX/plugins/`.

You could place the JSON directly into that location, but the recommended way to place content into the deploy area is via running the server deployment process.
Simply:
1. Open up a (second) command prompt to `zlux-build`
1. `ant deploy`

Now you're ready to run the server and see your App.
1. `cd /zlux-example-server/bin`
1. `./nodeCluster.sh` ... if you're testing this in an environment where the ZSS server is not on the same system as the Zowe App Server, you'll instead need to do `./nodeCluster.sh -h \<zss host\> -P \<zss port\>`
1. Open your browser to `https://hostname:port`, where the hsotname and port are for the Zowe App Server.
1. Login with your credentials
1. Open the App folder in the left corner of the toolbar, and open the Angular Sample App.

Do you see on the right side of the App an input area, a button to send your input, and a text area to receive a response? Do you get back a response showing that your input was accepted? If so, you're in good shape, and have completed the lab!
We'll fill in the logic for the left side of the App if you complete lab 3, but you may be interested in moving on to lab 2 next, to learn how to add internationalization to this app.


This program and the accompanying materials are
made available under the terms of the Eclipse Public License v2.0 which accompanies
this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

SPDX-License-Identifier: EPL-2.0

Copyright Contributors to the Zowe Project.
