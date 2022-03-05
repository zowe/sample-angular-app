

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Angular2InjectionTokens } from 'pluginlib/inject-resources';

export type StorageType = 'ha' | 'cluster' | 'local';
export type StorageServer = 'zss' | 'app-server';
@Injectable()
export class StorageService {

  constructor(
    @Inject(Angular2InjectionTokens.PLUGIN_DEFINITION) private pluginDefinition: ZLUX.ContainerPluginDefinition,
    private http: HttpClient
  ) {
  }

  private getStorageApiUri(storageServer: StorageServer): string {
    const serviceName = (storageServer === 'zss') ? 'zssStorage' : 'appServerStorage';
    return ZoweZLUX.uriBroker.pluginRESTUri(this.pluginDefinition.getBasePlugin(), serviceName, '');
  }

  private makeKeyUri(key: string, storageServer: StorageServer, storageType?: StorageType): string {
    let uri = this.getStorageApiUri(storageServer);
    if (!uri.endsWith('/')) {
      uri += '/';
    }
    uri += key;
    if (storageType) {
      uri += `?storageType=${storageType}`;
    }
    return uri;
  }

  private makeAllUri(storageType?: StorageType): string {
    let uri = this.getStorageApiUri('app-server');
    if (!uri.endsWith('/')) {
      uri += '/';
    }
    if (storageType) {
      uri += `?storageType=${storageType}`;
    }
    return uri;
  }

  get(key: string, storageServer: StorageServer, storageType?: StorageType): Observable<string> {
    const uri = this.makeKeyUri(key, storageServer, storageType);
    return this.http.get<{ key: string, value: string }>(uri).pipe(map(body => body.value));
  }

  getAll(storageType?: StorageType): Observable<{[key:string]:string}> {
    const uri = this.makeAllUri(storageType);
    return this.http.get<{[key:string]:string}>(uri);
  }

  set(key: string, value: string, storageServer: StorageServer, storageType?: StorageType): Observable<void> {
    const uri = this.makeKeyUri(key, storageServer, storageType);
    return this.http.post<void>(uri, { value });
  }

  setAll(dict: {[key:string]:string}, storageType?: StorageType): Observable<void> {
    const uri = this.makeAllUri(storageType);
    return this.http.post<void>(uri, dict);
  }

  delete(key: string, storageServer: StorageServer, storageType?: StorageType): Observable<void> {
    const uri = this.makeKeyUri(key, storageServer, storageType);
    return this.http.delete<void>(uri);
  }

  deleteAll(storageType?: StorageType): Observable<void> {
    const uri = this.makeAllUri(storageType);
    return this.http.delete<void>(uri);
  }

}

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

