/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdarg.h>
#include <stdbool.h>
#include <sys/types.h>

#include "zowetypes.h"
#include "alloc.h"
#include "utils.h"
#include "charsets.h"
#include "bpxnet.h"
#include "socketmgmt.h"
#include "httpserver.h"
#include "json.h"
#include "logging.h"
#include "dataservice.h"
#include "http.h"
#include "storage.h"


typedef struct StorageServiceData_t {
  long loggingId;
} StorageServiceData;

static void respondWithUnsupportedMethodError(HttpResponse *response) {
  jsonPrinter *p = respondWithJsonPrinter(response);

  setResponseStatus(response, 405, "Method Not Allowed");
  setDefaultJSONRESTHeaders(response);
  writeHeader(response);

  jsonStart(p);
  {
    jsonAddString(p, "error", "This method is not supported");
  }
  jsonEnd(p);
  finishResponse(response);
}

static void respondWithBadRequestError(HttpResponse *response, const char *fmt, ...) {
  char buf[1024];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);
  jsonPrinter *p = respondWithJsonPrinter(response);
  setResponseStatus(response, 400, "Bad Request");
  setDefaultJSONRESTHeaders(response);
  writeHeader(response);
  jsonStart(p);
  jsonAddString(p, "error", buf);
  jsonEnd(p);
  finishResponse(response);
}

static void respondWithStorageError(HttpResponse *response, const char *fmt, ...) {
  char buf[1024];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);
  jsonPrinter *p = respondWithJsonPrinter(response);
  setResponseStatus(response, 500, "Internal Error");
  setDefaultJSONRESTHeaders(response);
  writeHeader(response);
  jsonStart(p);
  jsonAddString(p, "error", buf);
  jsonEnd(p);
  finishResponse(response);
}

static char* getKey(HttpRequest *request) {
  int keyStart = 5;
  char *encodedKey = stringListPrint(request->parsedFile, keyStart, 1, "/", 0);
  return cleanURLParamValue(request->slh, encodedKey);
}

static inline char *getStorageType(HttpRequest *request) {
  return getQueryParam(request, "storageType");
}

static inline bool isValidStorageType(const char *storageType) {
  return (0 == strcmp(storageType, "ha") || 0 == strcmp(storageType, "local"));
}

static Storage *getStorage(HttpService *service, const char *storageType) {
  DataService *dataService = (DataService*)service->userPointer;
  if (!storageType) {
    return dataService->remoteStorage ? dataService->remoteStorage : dataService->localStorage;
  }
  if (0 == strcmp(storageType, "ha")) {
    return dataService->remoteStorage ? dataService->remoteStorage : dataService->localStorage;
  }
  if (0 == strcmp(storageType, "local")) {
    return dataService->localStorage;
  }
  return NULL;
}

static char *getValue(HttpRequest *request) {
  char *inPtr = request->contentBody;
  char *nativeBody = copyStringToNative(request->slh, inPtr, strlen(inPtr));
  int inLen = nativeBody == NULL ? 0 : strlen(nativeBody);
  char errBuf[512];
  char *value = 0;

  Json *body = jsonParseUnterminatedString(request->slh, nativeBody, inLen, errBuf, sizeof(errBuf));
  if (body != NULL) {
    JsonObject *inputMessage = jsonAsObject(body);
    if (inputMessage) {
      value = jsonObjectGetString(inputMessage, "value");
    }
  }
  return value;
}

static void handleGet(Storage *storage, HttpResponse *response) {
  char *key = getKey(response->request);
  int status = 0;
  const char *value = storageGetString(storage, key, &status);
  if (status != STORAGE_STATUS_OK && status != STORAGE_STATUS_KEY_NOT_FOUND) {
    respondWithStorageError(response, storageGetStrStatus(storage, status));
    return;
  }
  jsonPrinter *out = respondWithJsonPrinter(response);
  setResponseStatus(response, 200, "OK");
  setDefaultJSONRESTHeaders(response);
  writeHeader(response);
  jsonStart(out);
  jsonAddString(out, "key", key);
  if (status == STORAGE_STATUS_OK) {
    jsonAddString(out, "value", (char*)value);
  } else {
    jsonAddNull(out, "value");
  }
  jsonEnd(out);
  finishResponse(response);
}

static void handleSet(Storage *storage, HttpResponse *response) {
  char *key = getKey(response->request);
  char *value = getValue(response->request);
  int status = 0;
  if (!value) {
    respondWithBadRequestError(response, "value wasn't found in request body");
    return;
  }
  storageSetString(storage, key, value, &status);
  if (status != STORAGE_STATUS_OK) {
    respondWithStorageError(response, storageGetStrStatus(storage, status));
    return;
  }
  setResponseStatus(response, 204, "No Content");
  writeHeader(response);
  finishResponse(response);
}

static void handleDelete(Storage *storage, HttpResponse *response) {
  char *key = getKey(response->request);
  int status = 0;
  storageRemove(storage, key, &status);
  if (status != STORAGE_STATUS_OK && status != STORAGE_STATUS_KEY_NOT_FOUND) {
    respondWithStorageError(response, storageGetStrStatus(storage, status));
    return;
  }
  setResponseStatus(response, 204, "No Content");
  writeHeader(response);
  finishResponse(response);
}

typedef void (*Handler)(Storage *storage, HttpResponse *response);

typedef struct {
  const char *method;
  Handler handler;
} Route;

static Route routes[] = {
  { methodGET, handleGet },
  { methodPOST, handleSet },
  { methodDELETE, handleDelete }
};

#define ROUTE_COUNT (sizeof(routes)/sizeof(routes[0]))

static Handler findRequestHandler(HttpRequest *request) {
  for (int i = 0; i < ROUTE_COUNT; i++) {
    if (0 == strcmp(request->method, routes[i].method)) {
      return routes[i].handler;
    }
  }
  return NULL;
}

static int serveStorage(HttpService *service, HttpResponse *response) {
  HttpRequest *request = response->request;
  DataService *dataService = (DataService*)service->userPointer;
  StorageServiceData *serviceData = (StorageServiceData*)dataService->extension;
  int urlLen = stringListLength(request->parsedFile);
  if (urlLen != 6) {
    respondWithBadRequestError(response, "Bad Request: URI not supported");
    return 0;
  }
  char *key = getKey(request);
  char *storageType = getStorageType(request);
  if (storageType && !isValidStorageType(storageType)) {
    respondWithBadRequestError(response, "Unrecognized storage type, known types are 'ha' and 'local'");
    return 0;
  }
  Storage *storage = getStorage(service, storageType);
  if (!storage) {
    respondWithStorageError(response, "Storage is unavailable, storage type - '%s'\n", storageType ? storageType : "<default>");
    return 0;
  }
  Handler handler = findRequestHandler(request);
  if (!handler) {
    respondWithUnsupportedMethodError(response);
    return 0;
  }
  handler(storage, response);
  return 0;
}

void storageServiceInstaller(DataService *dataService, HttpServer *server) {
  HttpService *httpService = makeHttpDataService(dataService, server);
  httpService->authType = SERVICE_AUTH_NATIVE_WITH_SESSION_TOKEN;
  httpService->serviceFunction = serveStorage;
  httpService->runInSubtask = TRUE;
  httpService->doImpersonation = TRUE;
  StorageServiceData *serviceData = (StorageServiceData*)safeMalloc(sizeof(StorageServiceData), "StorageServiceData");
  serviceData->loggingId = dataService->loggingIdentifier;
  httpService->userPointer = dataService;
  dataService->extension = serviceData;
}

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/
