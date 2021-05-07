/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

import { Response, Request, Router } from 'express';
import express = require('express');
import { ZLUXServerFramework } from 'zlux-platform/server-framework';

class StorageDataService {
  private router: Router;

  constructor(private context: ZLUXServerFramework.DataServiceContext) {
    const storage = this.context.storage;
    const router = express.Router();
    this.router = router;
    context.addBodyParseMiddleware(router);

    router.post('/', (req: Request, res: Response) => {
      const storageType = req.query.storageType as ZLUXServerFramework.StorageLocationType;
      const dict = req.body;
      storage.setAll(dict, storageType).then(() => {
        res.sendStatus(204);
      }).catch(e => {
        res.status(500).json({
          err: e.message
        });
      });
    });

    router.get('/', (req: Request, res: Response) => {
      const storageType = req.query.storageType as ZLUXServerFramework.StorageLocationType;
      storage.getAll(storageType).then(dict => {
        res.status(200).json(dict);
      }).catch(e => {
        res.status(500).json({
          err: e.message
        });
      });
    });

    router.delete('/', (req: Request, res: Response) => {
      const storageType = req.query.storageType as ZLUXServerFramework.StorageLocationType;
      storage.deleteAll(storageType).then(() => {
        res.sendStatus(204);
      }).catch(e => {
        res.status(500).json({
          err: e.message
        });
      });
    });

    router.post('/:key', (req: Request, res: Response) => {
      const key = req.params.key;
      const storageType = req.query.storageType as ZLUXServerFramework.StorageLocationType;
      const { value } = req.body;
      storage.set(key, value, storageType).then(() => {
        res.sendStatus(204);
      }).catch(e => {
        res.status(500).json({
          err: e.message
        });
      });
    });

    router.get('/:key', (req: Request, res: Response) => {
      const key = req.params.key;
      const storageType = req.query.storageType as ZLUXServerFramework.StorageLocationType;
      storage.get(key, storageType).then(value => {
        res.status(200).json({ key, value });
      }).catch(e => {
        res.status(500).json({
          err: e.message
        });
      });
    });

    router.delete('/:key', (req: Request, res: Response) => {
      const key = req.params.key;
      const storageType = req.query.storageType as ZLUXServerFramework.StorageLocationType;
      storage.delete(key, storageType).then(() => {
        res.sendStatus(204);
      }).catch(e => {
        res.status(500).json({
          err: e.message
        });
      });
    });

  }

  getRouter(): Router {
    return this.router;
  }
}

export function storageRouter(context: ZLUXServerFramework.DataServiceContext): Promise<Router> {
  const dataService = new StorageDataService(context);
  return Promise.resolve(dataService.getRouter());
}


/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

