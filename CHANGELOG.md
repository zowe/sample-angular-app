# Sample angular app Changelog

All notable changes to the sample angular app will be documented in this file.

## 2.0.1
- This action making a CHANGELOG note via special syntax from the GitHub PR commit message, like it could automatically update CHANGELOG.md with the message. First job checks if PR body has changelog note or not if it's not there then it asked them to add it and second job is to check if changelog note has been added in changelog.md file or not. (#116)

- Bugfix: Schema file was not included, preventing installation as a component
- Bugfix: Manifest build content template was never resolved, so it has been removed.

## 2.0.0

- Breaking change: The app now uses angular 12, making it compatible with Zowe v2 desktop and incompatible with v1 desktop.
- Enhancement: The app now contains a manifest file so that it can be installed with `zwe components install`

## 1.2.0

- Enhancement: Added a new dataservice 'callservice', which serves as an example for how to use the callService API. This service simply calls the 'hello' service and returns the result wrapped in a JSON message.
