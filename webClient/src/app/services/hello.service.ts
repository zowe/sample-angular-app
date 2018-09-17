

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

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

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

