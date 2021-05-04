

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
@Injectable()
export class StorageService {
  private uri: string;

  constructor(
    @Inject(Angular2InjectionTokens.PLUGIN_DEFINITION) private pluginDefinition: ZLUX.ContainerPluginDefinition,
    private http: HttpClient
  ) {
    this.uri = ZoweZLUX.uriBroker.pluginRESTUri(this.pluginDefinition.getBasePlugin(), 'storage', '');
  }

  private makeKeyUri(key: string, storageType?: StorageType): string {
    let uri = this.uri;
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
    let uri = this.uri;
    if (!uri.endsWith('/')) {
      uri += '/';
    }
    if (storageType) {
      uri += `?storageType=${storageType}`;
    }
    return uri;
  }

  get(key: string, storageType?: StorageType): Observable<string> {
    const uri = this.makeKeyUri(key, storageType);
    return this.http.get<{ key: string, value: string }>(uri).pipe(map(body => body.value));
  }

  getAll(storageType?: StorageType): Observable<{[key:string]:string}> {
    const uri = this.makeAllUri(storageType);
    return this.http.get<{[key:string]:string}>(uri);
  }

  set(key: string, value: string, storageType?: StorageType): Observable<void> {
    const uri = this.makeKeyUri(key, storageType);
    return this.http.post<void>(uri, { value });
  }

  setAll(dict: {[key:string]:string}, storageType?: StorageType): Observable<void> {
    const uri = this.makeAllUri(storageType);
    return this.http.post<void>(uri, dict);
  }

  delete(key: string, storageType?: StorageType): Observable<void> {
    const uri = this.makeKeyUri(key, storageType);
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

