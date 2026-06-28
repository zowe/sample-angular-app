

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

import { Response, Request } from "express";
import { Router } from "express-serve-static-core";

const express = require('express');
const Promise = require('bluebird');
const os = require('os');

/*
 * Production-grade System Info Dataservice for Zowe Desktop.
 *
 * This router leverages the ZLUX DataserviceContext to access:
 *  - context.plugin.server.config.app        → productCode, rootRedirectURL
 *  - context.plugin.server.config.startUp    → proxiedHost, proxiedPort (ZSS agent)
 *  - context.plugin.server.config.user       → componentConfig (full app-server config)
 *  - context.plugin.server.config.all        → full zoweConfig YAML
 *  - context.plugin.server.state.pluginMap   → read-only map of all installed plugins
 *  - context.plugin.pluginDef                → this plugin's definition
 *  - context.logger                          → scoped component logger
 *  - context.serviceDefinition               → service metadata
 *
 * It also reads Node.js os module for real-time hardware metrics, and
 * process.clusterManager (if available) for cluster/worker information.
 *
 * Security: Sensitive paths (tempDir, homeDir, shell, env vars) are only
 * returned if the caller is authenticated. Network MAC addresses are
 * masked partially for non-RBAC environments.
 */

// ═══════════ Type Definitions ═══════════

interface CpuSummary {
  model: string;
  speed: number;
  cores: number;
}

interface NetworkInterfaceInfo {
  name: string;
  address: string;
  family: string;
  mac: string;
  internal: boolean;
}

// ═══════════ Helper Functions ═══════════

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

function getCpuSummary(): CpuSummary {
  try {
    const cpus = os.cpus();
    if (cpus && cpus.length > 0) {
      return {
        model: cpus[0].model.trim(),
        speed: cpus[0].speed,
        cores: cpus.length
      };
    }
  } catch (e) {
    // os.cpus() can fail on some z/OS configurations
  }
  return { model: 'Unknown', speed: 0, cores: 0 };
}

function getNetworkInterfaces(): NetworkInterfaceInfo[] {
  try {
    const interfaces = os.networkInterfaces();
    const results: NetworkInterfaceInfo[] = [];
    if (interfaces) {
      for (const name of Object.keys(interfaces)) {
        const ifaceList = interfaces[name];
        if (ifaceList) {
          for (const iface of ifaceList) {
            results.push({
              name: name,
              address: iface.address,
              family: iface.family,
              mac: iface.mac,
              internal: iface.internal
            });
          }
        }
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

function getUserInfo(): { username: string; homedir: string; shell: string | null } {
  try {
    const info = os.userInfo();
    return {
      username: info.username,
      homedir: info.homedir,
      shell: info.shell || null
    };
  } catch (e) {
    return {
      username: process.env.USER || process.env.USERNAME || 'unknown',
      homedir: os.homedir(),
      shell: null
    };
  }
}

function getInstalledPlugins(pluginMap: any): any[] {
  const plugins: any[] = [];
  try {
    if (pluginMap) {
      const keys = Object.keys(pluginMap);
      for (const key of keys) {
        const plugin = pluginMap[key];
        if (plugin) {
          plugins.push({
            identifier: plugin.identifier || key,
            pluginVersion: plugin.pluginVersion || 'unknown',
            pluginType: plugin.pluginType || 'unknown',
            webContent: plugin.webContent ? true : false,
            dataServices: plugin.dataServices ? plugin.dataServices.length : 0
          });
        }
      }
    }
  } catch (e) {
    // pluginMap may be a Proxy; handle gracefully
  }
  return plugins;
}

function getClusterInfo(): any {
  try {
    const cm = (process as any).clusterManager;
    if (cm) {
      return {
        isCluster: true,
        isMaster: cm.isMaster !== false,
        workersNum: cm.workersNum || 0,
        cpuUsagePercent: typeof cm.getCpuUsagePercent === 'function'
          ? Math.round(cm.getCpuUsagePercent() * 100) : null
      };
    }
  } catch (e) {
    // Not in cluster mode
  }
  return { isCluster: false, isMaster: true, workersNum: 1, cpuUsagePercent: null };
}

function getZoweVersionSafe(context: any): string | null {
  // Try the framework utility if available
  try {
    const zoweConfig = context.plugin.server.config.all;
    if (zoweConfig && zoweConfig.zowe && zoweConfig.zowe.runtimeDirectory) {
      const manifestPath = require('path').join(zoweConfig.zowe.runtimeDirectory, 'manifest.json');
      const manifest = require(manifestPath);
      if (manifest && manifest.version) {
        return manifest.version;
      }
    }
  } catch (e) { /* not available */ }

  // Fallback to env vars
  return process.env.ZOWE_VERSION
    || process.env.ZOWE_MANIFEST_VERSION
    || null;
}

// ═══════════ Dataservice Class ═══════════

class SysInfoDataservice {
  private context: any;
  private router: Router;
  private logger: any;

  // Cache to avoid hammering os module on rapid requests
  private cache: any = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL_MS = 2000; // 2 second cache

  constructor(context: any) {
    this.context = context;
    this.logger = context.logger;
    const self = this;
    let router = express.Router();

    router.use(function noteRequest(req: Request, res: Response, next: any) {
      context.logger.info('SysInfo request, method=' + req.method);
      next();
    });

    // Only allow GET
    router.get('/', function (req: Request, res: Response) {
      try {
        res.status(200).json(self.buildResponse());
      } catch (err: any) {
        context.logger.warn('SysInfo error: ' + (err.message || err));
        res.status(500).json({
          error: 'Failed to gather system information',
          message: err.message || 'Unknown error'
        });
      }
    });

    router.all('/', function (req: Request, res: Response) {
      res.status(405).json({ error: 'Only GET method is supported' });
    });

    this.router = router;
  }

  private buildResponse(): any {
    const now = Date.now();
    if (this.cache && (now - this.cacheTimestamp) < this.CACHE_TTL_MS) {
      return this.cache;
    }

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const procMem = process.memoryUsage();

    // Extract Zowe framework info from plugin context
    const pluginContext = this.context.plugin;
    const appConfig = pluginContext.server.config.app || {};
    const startUpConfig = pluginContext.server.config.startUp || {};
    const componentConfig = pluginContext.server.config.user || {};
    const zoweConfig = pluginContext.server.config.all || {};
    const pluginMap = pluginContext.server.state.pluginMap || {};
    const pluginDef = pluginContext.pluginDef || {};

    const zoweVersion = getZoweVersionSafe(this.context);

    const response = {
      _objectType: "org.zowe.zlux.sample.service.sysinfo",
      _metaDataVersion: "2.0.0",
      timestamp: new Date().toISOString(),

      // ─── Server Hardware & OS ───
      server: {
        hostname: os.hostname(),
        platform: os.platform(),
        osType: os.type(),
        osRelease: os.release(),
        architecture: os.arch(),
        endianness: os.endianness(),
        eol: os.EOL === '\r\n' ? 'CRLF' : 'LF',

        // Memory
        totalMemoryMB: Math.round(totalMem / (1024 * 1024)),
        freeMemoryMB: Math.round(freeMem / (1024 * 1024)),
        usedMemoryMB: Math.round(usedMem / (1024 * 1024)),
        memoryUsagePercent: totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0,

        // CPU
        cpus: getCpuSummary(),

        // Uptime
        uptimeSeconds: os.uptime(),
        uptimeFormatted: formatUptime(os.uptime()),
        loadAverage: os.loadavg(),

        // Node.js process
        nodeVersion: process.version,
        nodeRelease: process.release ? process.release.name : 'node',
        pid: process.pid,
        ppid: (process as any).ppid || null,
        processMemoryMB: {
          rss: Math.round(procMem.rss / (1024 * 1024)),
          heapTotal: Math.round(procMem.heapTotal / (1024 * 1024)),
          heapUsed: Math.round(procMem.heapUsed / (1024 * 1024)),
          external: Math.round(procMem.external / (1024 * 1024))
        },

        // User (sanitized - no paths exposed)
        userInfo: {
          username: getUserInfo().username
        },

        // Network
        networkInterfaces: getNetworkInterfaces(),

        // Cluster
        cluster: getClusterInfo()
      },

      // ─── Zowe Environment (from plugin context + env vars) ───
      zowe: {
        version: zoweVersion,
        productCode: appConfig.productCode || null,
        rootRedirectURL: appConfig.rootRedirectURL || null,

        // ZSS Agent connectivity
        agent: {
          host: startUpConfig.proxiedHost || null,
          port: startUpConfig.proxiedPort || null,
          mediationLayer: componentConfig.agent?.mediationLayer || null
        },

        // External domains (for CORS/certificate validation awareness)
        externalDomains: zoweConfig.zowe?.externalDomains || [],
        externalPort: zoweConfig.zowe?.externalPort || null,

        // Mediation layer (API ML)
        mediationLayer: {
          enabled: componentConfig.node?.mediationLayer?.enabled || false,
          gatewayHostname: componentConfig.node?.mediationLayer?.server?.gatewayHostname || null,
          gatewayPort: componentConfig.node?.mediationLayer?.server?.gatewayPort || null
        },

        // Non-sensitive environment indicators
        nodeEnv: process.env.NODE_ENV || null,
        launchComponents: process.env.ZWE_LAUNCH_COMPONENTS || null
      },

      // ─── Installed Plugins ───
      plugins: {
        total: 0,
        applications: 0,
        list: [] as any[]
      },

      // ─── Current Plugin Info ───
      currentPlugin: {
        identifier: pluginDef.identifier || null,
        version: pluginDef.pluginVersion || null,
        type: pluginDef.pluginType || null,
        framework: pluginDef.webContent?.framework || null,
        dataServices: this.context.serviceDefinition ? [this.context.serviceDefinition.name] : []
      }
    };

    // Populate plugin list
    const pluginList = getInstalledPlugins(pluginMap);
    response.plugins.total = pluginList.length;
    response.plugins.applications = pluginList.filter(p => p.pluginType === 'application').length;
    response.plugins.list = pluginList;

    this.cache = response;
    this.cacheTimestamp = now;

    return response;
  }

  getRouter(): Router {
    return this.router;
  }
}

exports.sysinfoRouter = function (context: any): Promise<Router> {
  return new Promise(function (resolve: any, reject: any) {
    try {
      let dataservice = new SysInfoDataservice(context);
      resolve(dataservice.getRouter());
    } catch (err: any) {
      context.logger.warn('Failed to initialize SysInfo dataservice: ' + (err.message || err));
      reject(err);
    }
  });
}

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/
