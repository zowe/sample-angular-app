This program and the accompanying materials are
made available under the terms of the Eclipse Public License v2.0 which accompanies
this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

SPDX-License-Identifier: EPL-2.0

Copyright Contributors to the Zowe Project.
# Using the Widget Library

This branch acts as a tutorial, intended as a workshop session, which will teach you how to add App to App communication to a Angular App. 
The code here is the completed version, and serves as a reference. To complete this tutorial, you should either build off of a sandbox you have been using to complete the prior tutorials in sequential order, or, you can just [clone the previous tutorial branch here](https://github.com/zowe/sample-app/tree/lab/step-3-app2app-complete) and work from that.

By the end of this tutorial you will:
1. Know how to install the widget library into your application
1. Know how to use the error reporting service
1. Know how to use the button from the widget library

## Install the Widget Library
Run the following npm install script
```
npm install --save-dev git+ssh://github.com/zowe/zlux-widgets.git
```
If you prefer to download from git using https, then use git+https instead of git+ssh

Further instruction on npm install can be found [here](https://docs.npmjs.com/cli/install). Search for the section on "npm install &lt;git remote url&gt;"
## Add the Necessary Imports to Your Code
First at the module level. Add the following to app.module.ts
```
import { ZluxPopupManagerService, ZluxPopupManagerModule } from '@zlux/widgets';
```
You will need to have an instance of the ZluxPopupManagerService made available to your component code, so add it as a "provider":
```
providers: [HelloService, ZluxPopupManagerService]
```
Now import the classes you need into app.component.ts:
```
import { ZluxPopupManagerService, ZluxErrorSeverity } from '@zlux/widgets';
```
Now inject it into your component instance by adding this to the constructor:
```
private popupManager: ZluxPopupManagerService,
```


## Use the Error Reporting API


This program and the accompanying materials are
made available under the terms of the Eclipse Public License v2.0 which accompanies
this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

SPDX-License-Identifier: EPL-2.0

Copyright Contributors to the Zowe Project.
