/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

import { Response, Request, NextFunction } from 'express';
import { Router } from 'express-serve-static-core';
import express = require('express');

const USER_KEY_SEPARATOR = ':';

function getUsername(req: Request): string | undefined {
  return (req as any).username;
}

function namespacedKey(username: string, key: string): string {
  return `${username}${USER_KEY_SEPARATOR}${key}`;
}

function ownKeysOf(dict: { [key: string]: any }, username: string): { [shortKey: string]: string } {
  const prefix = namespacedKey(username, '');
  const result: { [shortKey: string]: string } = {};
  Object.keys(dict || {}).forEach(fullKey => {
    if (fullKey.startsWith(prefix)) {
      result[fullKey.substring(prefix.length)] = fullKey;
    }
  });
  return result;
}

class StorageDataService {
  private router: Router;

  constructor(private context: any) {
    const storage = this.context.storage;
    const router = express.Router();
    this.router = router;
    context.addBodyParseMiddleware(router);

    router.use((req: Request, res: Response, next: NextFunction) => {
      if (!getUsername(req)) {
        res.status(401).json({ err: 'No authenticated user for storage request' });
        return;
      }
      next();
    });

    router.post('/', (req: Request, res: Response) => {
      const username = getUsername(req);
      const storageType = req.query.storageType;
      const dict = req.body || {};
      storage.getAll(storageType).then(existing => {
        const own = ownKeysOf(existing, username);
        const toDelete = Object.keys(own).filter(shortKey => !(shortKey in dict));
        const toSet = Object.keys(dict);
        return Promise.all([
          ...toDelete.map(shortKey => storage.delete(own[shortKey], storageType)),
          ...toSet.map(shortKey => storage.set(namespacedKey(username, shortKey), dict[shortKey], storageType))
        ]);
      }).then(() => {
        res.sendStatus(204);
      }).catch(e => {
        res.status(500).json({
          err: e.message
        });
      });
    });

    router.get('/', (req: Request, res: Response) => {
      const username = getUsername(req);
      const storageType = req.query.storageType;
      storage.getAll(storageType).then(dict => {
        const own = ownKeysOf(dict, username);
        const result = {};
        Object.keys(own).forEach(shortKey => {
          result[shortKey] = dict[own[shortKey]];
        });
        res.status(200).json(result);
      }).catch(e => {
        res.status(500).json({
          err: e.message
        });
      });
    });

    router.delete('/', (req: Request, res: Response) => {
      const username = getUsername(req);
      const storageType = req.query.storageType;
      storage.getAll(storageType).then(existing => {
        const own = ownKeysOf(existing, username);
        return Promise.all(Object.keys(own).map(shortKey => storage.delete(own[shortKey], storageType)));
      }).then(() => {
        res.sendStatus(204);
      }).catch(e => {
        res.status(500).json({
          err: e.message
        });
      });
    });

    router.post('/:key', (req: Request, res: Response) => {
      const username = getUsername(req);
      const key = namespacedKey(username, req.params.key);
      const storageType = req.query.storageType;
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
      const username = getUsername(req);
      const key = namespacedKey(username, req.params.key);
      const storageType = req.query.storageType;
      storage.get(key, storageType).then(value => {
        res.status(200).json({ key: req.params.key, value });
      }).catch(e => {
        res.status(500).json({
          err: e.message
        });
      });
    });

    router.delete('/:key', (req: Request, res: Response) => {
      const username = getUsername(req);
      const key = namespacedKey(username, req.params.key);
      const storageType = req.query.storageType;
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

export function storageRouter(context: any): Promise<Router> {
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

