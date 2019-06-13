import { Response, Request } from "express";
import { Router } from "express-serve-static-core";



/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/

const express = require('express');
const Promise = require('bluebird');
const obfuscator = require ('../../zlux-shared/src/obfuscator/htmlObfuscator.js');

class HelloWorldDataservice{
  private context: any;
  private router: Router;
  
  constructor(context: any){
    let htmlObfuscator = new obfuscator.HtmlObfuscator();
    this.context = context;
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
    let dataservice = new HelloWorldDataservice(context);
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

