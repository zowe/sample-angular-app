This program and the accompanying materials are
made available under the terms of the Eclipse Public License v2.0 which accompanies
this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

SPDX-License-Identifier: EPL-2.0

Copyright Contributors to the Zowe Project.
# Using the Widget Library

This branch acts as a tutorial, intended as a workshop session, which will teach you how to add App to App communication to a Angular App. 
The code here is the completed version, and serves as a reference. To complete this tutorial, you should either build off of a sandbox you have been using to complete the prior tutorials in sequential order, or, you can just [clone the previous tutorial branch here](https://github.com/zowe/sample-app/tree/lab/step-3-app2app-complete) and work from that.

By the end of this tutorial you will:
1. Know how to install and import the widget library into your application
1. Know how to use the error reporting API on ZluxPopupManagerService
1. Know how to use the button widget from the widget library

Topics
1. [Install the Widget Library](#install-the-widget-library)
1. [Add Error Reporting](#add-error-reporting)
   1. [Add the Necessary Imports](#add-the-necessary-imports)
      1. [Import Widget Module Into Your Module](#import-module-into-your-module)
      1. [Add ZluxPopupManagerService as a Provider in Your Component](#add-zluxPopupManagerService-as-a-provider-in-your-component)
   1. []()

## Install the Widget Library
Run the following npm install script
```
npm install --save-dev git+ssh://github.com/zowe/zlux-widgets.git
```
If you prefer to download from git using https, then use git+https instead of git+ssh

Further instruction on npm install can be found [here](https://docs.npmjs.com/cli/install). Search for the section on "npm install &lt;git remote url&gt;"
# Add Error Reporting
## Add the Necessary Imports
To use the error reporting API you need to to do the following:
### Import Widget Module and Into Your Module
Add the following to app.module.ts
```
import { ZluxPopupManagerModule } from '@zlux/widgets';
```
### Add ZluxPopupManagerService as a Provider in Your Component
Import ZluxPopupManagerService:
```
import { ZluxPopupManagerService, ZluxErrorSeverity } from '@zlux/widgets';
```
The ZluxErrorSeverity is a set of constants you can use to control the severity of the warning seen by the user.

You will need to have an instance of the ZluxPopupManagerService made available to your component code, so add it as a "provider". in app.component.ts, Change
```
providers: [HelloService]
```
To
```
providers: [HelloService, ZluxPopupManagerService]
```
***NOTE***: Because you may want to use different loggers in different components (see [Connect Your Logger to the ZluxPopupManagerService](#connect-your-logger-to-the-zluxpopupmanagerservice)), you should usually add this provider declaration at the component level, and not the module level.

Now inject the service into your component instance by adding this to the constructor parameters:
```
private popupManager: ZluxPopupManagerService,
```
## Use the Error Reporting API
### Connect Your Logger to the ZluxPopupManagerService
The ZluxPopupManagerService integrates with the Logger API such that it will issue log messages whose log level depends on the ZluxErrorSeverity you use. You must provide the logger. The best place to do that is in the constructor body:
```
    this.popupManager.setLogger(log);
```
### Add the popup-manager Tag
In order for the error popup to become visisble when needed, you need to add the popup-manager tag to the template at the end:
```
<zlux-popup-manager>
</zlux-popup-manager>
```
### Invoke the Error Reporting API
When an error condition is detected, you can request to show an error dialog. For example, if the identifier in the "Application Identifier" field is not valid, it would be nice to tell the user
```
      let plugin = pluginManager.getPlugin(this.targetAppId);
      if (plugin) {
...
      } else {
        this.popupManager.reportError(
          ZluxErrorSeverity.WARNING,
          'Invalid Plugin Identifier',
          `No Plugin found for identifier ${this.targetAppId}`, popupOptions);
      }

```
## Test Your Changes
Build
```
npm run build
```
Reload your desktop page, and try entering an invalid application identifier. You should see an error popup. Also, if you look in the javascript console, you should see a corresponding error message.
```
[2018-09-23 17:30:15.321 org.zowe.zlux.sample.angular WARNING] - No Plugin found for identifier com.rs.mvd.tn3270s
```

This program and the accompanying materials are
made available under the terms of the Eclipse Public License v2.0 which accompanies
this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

SPDX-License-Identifier: EPL-2.0

Copyright Contributors to the Zowe Project.
