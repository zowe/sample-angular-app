# Sample angular app Changelog

All notable changes to the sample angular app will be documented in this file.

## 3.0.0

- AI DISCLAIMER: This upgrade was performed with Claude Opus 4.6.
- Upgraded to Angular 18.2.14 for Zowe V3 desktop compatibility.
- Replaced ts-loader and angular2-template-loader with @ngtools/webpack for AOT compilation.
- Switched webpack config to extend webpack5.base.js.
- Updated output path to web/v3/ with versioned entryPoint in pluginDefinition.json.
- Upgraded all dependencies: rxjs 7.8.1, typescript 5.4.5, zone.js 0.14.4, webpack 5.92.0.
- Removed legacy loaders (html-loader, exports-loader, file-loader) and NODE_OPTIONS workaround.
- Updated angular.json, removing deprecated options and using Angular 18 conventions.

## 2.0.1
- Bugfix: Schema file was not included, preventing installation as a component
- Bugfix: Manifest build content template was never resolved, so it has been removed.

## 2.0.0

- Breaking change: The app now uses angular 12, making it compatible with Zowe v2 desktop and incompatible with v1 desktop.
- Enhancement: The app now contains a manifest file so that it can be installed with `zwe components install`

## 1.2.0

- Enhancement: Added a new dataservice 'callservice', which serves as an example for how to use the callService API. This service simply calls the 'hello' service and returns the result wrapped in a JSON message.
