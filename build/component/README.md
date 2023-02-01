his program and the accompanying materials are
made available under the terms of the Eclipse Public License v2.0 which accompanies
this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

SPDX-License-Identifier: EPL-2.0

Copyright Contributors to the Zowe Project.
# Sample Angular App

This is an angular component that can be included in applications to be able to locate & browse the hierarchy of files and datasets on z/OS through the Zowe ZSS server APIs. Using the Zowe context menu, there is also a growing support of CRUD & other actions.

**NOTE: Because this relies upon ZSS APIs, it must be used in an environment which handles session lifecycles, as you must log in to ZSS prior to using those APIs. One way to utilize this is to use this within a Zowe App, within the Zowe Desktop**

## Installing
You must set the @zowe registry scope to get this library, as it is not yet on npmjs.org

```
npm config set @zowe:registry https://zowe.jfrog.io/zowe/api/npm/npm-release/
zwe components install -c zowe.yaml --component (path or query) [--handler npm] [--registry https//localhost:1234/] [--dry-run]