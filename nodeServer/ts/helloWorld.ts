import { Response, Request } from "express";
import { Router } from "express-serve-static-core";

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

//import { Inject } from '@angular/core';
const express = require('express');
const Promise = require('bluebird');
const obfuscator = require ('../../zlux-shared/src/obfuscator/htmlObfuscator.js');

class HelloWorldDataservice{
  private context: any;
  private router: Router;
  
  constructor(context: any, process: any,
    //@Inject(Angular2InjectionTokens.LOGGER) private log: ZLUX.ComponentLogger
    ){
    let htmlObfuscator = new obfuscator.HtmlObfuscator();
    this.context = context;
        /* This code will get executed before clusterManager finishes creating the master storage */
        if (this.context.storage) {

          const randoNum = Math.floor(Math.random() * 100);
          const aSimpleObject = "I am a simple object"
          const aComplicatedObject = {
              "inner Key 1": 'I am a value one layer down',
              "inner Key 2": {
                  [randoNum]: 'I am a value multiple layers down'
              },
            };

          context.logger.info("Can helloWorld access the storage object at constructor time?\n", this.context.storage);
          this.context.storage.setStorageValue("Key 1", aSimpleObject);
          this.context.storage.setStorageValue("Key 2", aComplicatedObject);
          context.logger.info("Can helloWorld save storage (with layers) at constructor time?\n", this.context.storage);

        }
       
        /* This code will get executed after 5 seconds (after the clusterManager finishes creating master storage) */
        setTimeout(function () {
          if (process.clusterManager) {
            context.storage.getStorage().then(function (storage) {
              context.logger.info("Does helloWorld have the up-to-date storage data from all clusters?\n", storage);
            });
          } else {
            /* We do nothing here because if we are not in cluster mode, there is no master storage, only app storage */
          }
        }, 5000);
    let router = express.Router();
    router.use(function noteRequest(req: Request,res: Response,next: any) {
      context.logger.info('Saw request, method='+req.method);
      next();
    });
    context.addBodyParseMiddleware(router);
    router.post('/',function(req: Request,res: Response) {
      let messageFromClient = req.body ? req.body.messageFromClient : "<No/Empty Message Received from Client>"
      let safeMessage = htmlObfuscator.findAndReplaceHTMLEntities(messageFromClient);
      let responseBody = {
        "_objectType": "org.zowe.zlux.sample.service.hello",
        "_metaDataVersion": "1.0.0",
        "requestBody": req.body,
        "requestURL": req.originalUrl,
        "serverResponse": `Router received
        
        '${safeMessage}'
        
        from client`
      }
      res.status(200).json(responseBody);
    });
    this.router = router;
  }

  getRouter():Router{
    return this.router;
  }
}


exports.helloWorldRouter = function(context): Router {
  return new Promise(function(resolve, reject) {
    let dataservice = new HelloWorldDataservice(context, process);
    resolve(dataservice.getRouter());
  });
}


/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

