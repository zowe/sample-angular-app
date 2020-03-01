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
          const key1 = "Key 1";
          const key2 = "Key 2";

          /* Access test */
          context.logger.info("Can helloWorld access the storage object at constructor time?\n", this.context.storage);
          
          /* Set by key */
          this.context.storage.setStorageByKey(key1, aSimpleObject);
          this.context.storage.setStorageByKey(key2, aComplicatedObject);
          context.logger.info("Can helloWorld save storage (with layers)?\n", this.context.storage);
      
          /* Delete by key */
          this.context.storage.deleteStorageByKey(key1);
          context.logger.info("Can helloWorld delete '" + key1 + "'?\n", this.context.storage);

          /* Set whole object */
          this.context.storage.setStorageAll({[randoNum]: "Replacement"});
          context.logger.info("Can helloWorld replace all its storage with key '" + randoNum + "'?\n", this.context.storage);

          /* Access by key */
          this.context.storage.setStorageByKey(randoNum, aSimpleObject);
          context.logger.info("Can helloWorld find storage by key '" + randoNum + "'?\n", this.context.storage.getStorageByKey(randoNum));
        }
       
        /* This code will get executed after 5 seconds (well after the clusterManager finishes creating master storage) */
        setTimeout(function () {
          if (process.clusterManager) {
            /* Here, you should see all storage data from the Sample Angular App x (# of clusters) */
            context.storage.setStorageByKey("Hello", "I am a late value to show things have not broken");
            context.storage.getStorageAll().then((storage) => {
              context.logger.info("Does helloWorld have the up-to-date storage data from all clusters?\n", storage);
            });
            /* Here, you should see all storage data on the cluster for all apps */
            process.clusterManager.getStorageCluster().then((storage) => {
              context.logger.info("Does clusterManager have storage data from all workers?\n", storage);
            })
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

