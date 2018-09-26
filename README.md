This program and the accompanying materials are
made available under the terms of the Eclipse Public License v2.0 which accompanies
this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

SPDX-License-Identifier: EPL-2.0

Copyright Contributors to the Zowe Project.
# Internationalization in Angular Templates in Zowe ZLUX
This branch acts as a tutorial, intended as a workshop session, which will teach you how to add internationalization of templates to an Angular App. The code here is the completed version, and serves as a reference. To complete this tutorial, you should either build off of a sandbox you have been using to complete the prior tutorials in sequential order, or, you can just [clone the previous tutorial branch here](https://github.com/zowe/sample-app/tree/lab/step-1-hello-world-complete) and work from that.

This branch introduces you to internationalizing Angular templates, and shows facilities in Zowe ZLUX that support this.

Angular has a built-in facility for internationalizing Angular templates, documented here: https://angular.io/guide/i18n. That link goes into a lot more detail than will be covered in this tutorial. This tutorial gives a quick introduction to template translation in general, but focuses on how ZLUX provides access to the base Angular translation tools.

By the end of this tutorial you will:
1. Know how to set up an application in preparation for template translation
2. Know how to add translation tags to your templates
3. Know how to run the extraction tool to create translation files
4. Know how to add translations to those files
5. See those translations applied to your loaded application

Topics
1. [Brief Introduction to i18n Support in Angular Templates](#brief-introduction-to-i18n-support-in-angular-templates)
1. [Adding Angular Template Translation in ZLUX](#adding-angular-template-translation-in-zlux)
   1. [Supporting Scripts and Configurations](#supporting-scripts-and-configurations)
   1. [Add i18n Tags to the Template](#add-i18n-tags-to-the-template)
   1. [Run the i18n Script](#run-the-i18n-script)
   1. [Make a French Translation File and Add Translations](#make-a-french-translation-file-and-add-translations)
   1. [Deploy the Translation Files](#deploy-the-translation-files)

***SIDE NOTE*** You don't need to understand this note now, but if you read the Angular i18n documentation listed above, it talks about how to "[Merge the completed translation file into the app](https://angular.io/guide/i18n#merge-the-completed-translation-file-into-the-app)". The ZLUX integration with Angular i18n handles that merging for you using the the techniques in "[Merge with the JIT compiler](https://angular.io/guide/i18n#merge-with-the-jit-compiler)" 

## Brief Introduction to i18n Support in Angular Templates
Angular supports special attributes (i18n* ) within templates so that developers can express translation needs directly where they are working, instead of having to manually maintain a separate file. For example, say you have a simple span element with text:
```
<span>App Request Test</span>
```
If you want to indicate that it needs to be translated, you add the "i18n" attribute
```
<span i18n>App Request Test</span>
```
Angular provides an extraction tool (ng-xi18n, provided by the Angular cli) that extract the strings that are "marked" with an i18n tag, and creates files for translators. Angular can then take the translated files and incorporate them into your application so that the translated strings are presented in the UI.

This i18n attribute has a specialized syntax that allow the developer to provide addtional help to the translator, both for creating the initial translation, and for maintaining translations over time. The full syntax of the i18n attribute allows the developer to provide up to 4 pieces of information to the translator:
1. Original text
2. Meaning (useful if the original text is an abbreviation, for example)
3. A description (which can help the translator understand the context better)
4. A stable unique identifier

See also https://angular.io/guide/i18n#help-the-translator-with-a-description-and-meaning

Here is an example showing the full syntax
```
<span class="bigger-bold-text"
 i18n="test application requests|
 A set of widgets to test sending requests to other applications on the desktop
 @@app-request-test">App Request Test</span>

```
1. Original text: "App Request Test" in the body of the tag
2. Meaning: "test application requests" appears before the "|"
3. Description": "A set of widgets to test sending requests to other applications on the desktop" appears after the "|"
4. stable unique identifier: "app-request-test" appears after the "@@"

### Best Practice Recommendation
*Always provide the stable unique identifier (item 4)*
This way you can minimize translation effort when you revise your application, and you will also be able to reuse translation strings in different parts of your application. If you do not include an identifier, Angular will generate one automatically, and, if you edit the template and re-run ng-xi18n, many of the translated strings will get new automatic identifiers, and it will be hard for the translators to identify strings they have translated in previous versions.

## Adding Angular Template Translation in ZLUX
There are some subtleties about ZLUX support of template translation support that will be discussed later, but for now, let's go through the steps of adding translation support
### Supporting Scripts and Configurations
1. ***Add a special tsconfig*** that is used by the "i18n" script: tsconfig.ngx-i18n.json. This config file includes special additions to support the cli tools and to control the output
   ```
   {
     "extends": "../../zlux-app-manager/virtual-desktop/plugin-config/tsconfig.ngx-i18n.json",
    
     "include": [
       "./src"
     ],

     "compilerOptions": {
       "outDir": "./src/assets/i18n",
       "skipLibCheck": true
     }
   }
   ```
   The "include" and "outDir" are necessary to pick up the source files and to ensure that the output goes where ZLUX knows to find it. The the cli support is managed by the .json in the "extends" attribute, and the details are not important here.
   
   You will notice that the outDir is in the src tree. The reason for this is so that you can commit and track translations. The "npm run build" script will copy the translation files to the web/assets/i18n directory to make them available to ZLUX at runtime.
2. ***Add Entries to package.json***. 
   1. Import new packages (and adjust versions of other packages due to temporary package version requirements)
   ```
   npm install --save-dev copy-webpack-plugin@~4.5.2 @angular/cli@~6.0.8 @angular/compiler-cli@~6.0.9 typescript@~2.7.2 webpack@~4.4.0 zone.js@^0.8.26
   ```
   2. A new script, "i18n" that runs the ng-xi18n tool from the Angular CLI
   ```
      "i18n": "ng-xi18n -p tsconfig.ngx-i18n.json --i18nFormat=xlf  --outFile=messages.xlf",
   ```
   The --i18nFormat specifies the format currently supported by ZLUX, and the --outFile places the output in the file name that ZLUX is looking to load at runtime when integrating the translation into the final presentation.
   
***SIDE NOTE*** When you build your own plugin starting with the sample-app, all these steps are taken care of for you. The above section is included to help you understand the infrastructure underlying the creation of the translation files.
### Add i18n Tags to the Template
In webClient/src/app/app.component.html add i18n tags
```
  <div class="test-panel dataservice-test-panel">
    <div class="bottom-10">
      <span class="bigger-bold-text" i18n="test of dataservice requests@@dataservice-request-test">Dataservice Request Test</span>
    </div>
    <div>
      <input placeholder="Message" 
             i18n-placeholder="message|indicates that the user will enter a message@@appComponentMessage" [(ngModel)]="helloText"
      (keyup.enter)="sayHello()"/>
      <button (click)="sayHello()"
              i18n="run|Run the application@@appComponentRun">Run</button>
    </div>
    <div>
      <label i18n="response|the area where the response from the server will appear@@appComponentResponse">Response</label>
      <textarea class="server-response" placeholder="Response" 
                i18n-placeholder="@@appComponentResponse" >{{serverResponseMessage}}</textarea>
    </div>
  </div>
```
### Run the i18n Script
Extract the translation strings into a translation source file:
```
npm run i18n
```
### Make a French Translation File and Add Translations
In webClient/src/assets/i18n, copy messages.xlf to messages.fr.xlf
***NOTE*** Angular follows the Unicode LDML convention that uses stable identifiers (Unicode locale identifiers) based on the norm [BCP47](http://www.rfc-editor.org/rfc/bcp/bcp47.txt). For further discussion, see [Setting up the locale of your app](https://angular.io/guide/i18n#setting-up-the-locale-of-your-app)

In messages.fr.xlf, add "target" tags
```
        <source>Dataservice Request Test</source>
        <target>Test de Demande au Dataservice</target>
...
        <source>Message</source>
        <target>Message</target>
...
        <source>Run</source>
        <target>Exécuter</target>
...
        <source>Response</source>
        <target>Réponse</target>
```
### Deploy the Translation Files
```
npm run build
```
### Change the Language in Your Browser and Reload
# Open Topics
## Non-Template Translations
#### Server Provided Strings
Some data sources can produce output that contains string that should be translated. E.g., a REST service that returns tabular data, including the text for the column headings.
#### Programmatically Provided Strings
Sometimes it makes sense to include text in the typescript files instead of the Templates
### There are two main options
#### Server-Side translation
The browser sends the "Accept-Language:" HTTP header that indicates the preferred language(s). The server side can use that information to provide column headers appropriate to the browser client
#### Supplementary Translation Packages
There are two main npm packages that provide addtional support for non-template strings, ngx-translate, and angular-l10n. ZLUX does not provide particular support for either package, but either package can be used with a ZLUX application

This program and the accompanying materials are
made available under the terms of the Eclipse Public License v2.0 which accompanies
this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

SPDX-License-Identifier: EPL-2.0

Copyright Contributors to the Zowe Project.
