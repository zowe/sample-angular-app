

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

import { Injectable, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Angular2InjectionTokens } from 'pluginlib/inject-resources';

/*
 * Production-grade System Info Service for Zowe Desktop.
 *
 * Data sources:
 *  1. Our custom sysinfo dataservice (server-side os module + plugin context)
 *  2. Zowe's built-in GET /server/environment endpoint
 *  3. Zowe's built-in GET /plugins?type=all endpoint (installed plugin list)
 *  4. Zowe's built-in GET /auth endpoint (current session info)
 *  5. Client-side browser/screen/locale APIs
 *  6. ZoweZLUX global (pluginManager, uriBroker, dispatcher)
 */

// ═══════════ Server Response Interfaces ═══════════

export interface ServerInfo {
  hostname: string;
  platform: string;
  osType: string;
  osRelease: string;
  architecture: string;
  endianness: string;
  eol: string;
  totalMemoryMB: number;
  freeMemoryMB: number;
  usedMemoryMB: number;
  memoryUsagePercent: number;
  cpus: { model: string; speed: number; cores: number };
  uptimeSeconds: number;
  uptimeFormatted: string;
  loadAverage: number[];
  nodeVersion: string;
  nodeRelease: string;
  pid: number;
  ppid: number | null;
  processMemoryMB: { rss: number; heapTotal: number; heapUsed: number; external: number };
  userInfo: { username: string };
  networkInterfaces: NetworkInterface[];
  cluster: ClusterInfo;
}

export interface NetworkInterface {
  name: string;
  address: string;
  family: string;
  mac: string;
  internal: boolean;
}

export interface ClusterInfo {
  isCluster: boolean;
  isMaster: boolean;
  workersNum: number;
  cpuUsagePercent: number | null;
}

export interface ZoweInfo {
  version: string | null;
  productCode: string | null;
  rootRedirectURL: string | null;
  agent: { host: string | null; port: number | null; mediationLayer: any };
  externalDomains: string[];
  externalPort: number | null;
  mediationLayer: { enabled: boolean; gatewayHostname: string | null; gatewayPort: number | null };
  nodeEnv: string | null;
  launchComponents: string | null;
}

export interface PluginSummary {
  identifier: string;
  pluginVersion: string;
  pluginType: string;
  webContent: boolean;
  dataServices: number;
}

export interface PluginsInfo {
  total: number;
  applications: number;
  list: PluginSummary[];
}

export interface CurrentPluginInfo {
  identifier: string | null;
  version: string | null;
  type: string | null;
  framework: string | null;
  dataServices: string[];
}

export interface SystemInfoResponse {
  _objectType: string;
  _metaDataVersion: string;
  timestamp: string;
  server: ServerInfo;
  zowe: ZoweInfo;
  plugins: PluginsInfo;
  currentPlugin: CurrentPluginInfo;
}

// ═══════════ Zowe Built-in Endpoint Interfaces ═══════════

export interface ZoweServerEnvironment {
  timestamp?: string;
  platform?: string;
  arch?: string;
  osRelease?: string;
  cpus?: any[];
  freeMemory?: number;
  hostname?: string;
  PID?: number;
  PPID?: number;
  nodeVersion?: string;
  nodeRelease?: any;
  userEnvironment?: { [key: string]: string };
  agent?: any;
}

export interface ZoweAuthStatus {
  authenticated: boolean;
  categories?: {
    [category: string]: {
      authenticated: boolean;
      plugins: {
        [pluginId: string]: {
          authenticated: boolean;
          username: string;
          expms: number;
        };
      };
    };
  };
  expms?: number;
}

export interface ZowePluginDef {
  identifier: string;
  pluginVersion: string;
  pluginType: string;
  webContent?: any;
  dataServices?: any[];
}

// ═══════════ Client-Side Info ═══════════

export interface ClientInfo {
  userAgent: string;
  browserName: string;
  browserVersion: string;
  platform: string;
  language: string;
  languages: string[];
  cookiesEnabled: boolean;
  onLine: boolean;
  screenWidth: number;
  screenHeight: number;
  screenColorDepth: number;
  windowWidth: number;
  windowHeight: number;
  devicePixelRatio: number;
  timeZone: string;
  timeZoneOffset: number;
  connectionType: string;
  hardwareConcurrency: number;
  maxTouchPoints: number;
  darkMode: boolean;
}

// ═══════════ Service ═══════════

@Injectable()
export class SysInfoService {
  private sysinfoUri: string;
  private serverRootBase: string;

  constructor(
    @Inject(Angular2InjectionTokens.PLUGIN_DEFINITION) private pluginDefinition: ZLUX.ContainerPluginDefinition,
    private http: HttpClient
  ) {
    this.sysinfoUri = ZoweZLUX.uriBroker.pluginRESTUri(
      this.pluginDefinition.getBasePlugin(), 'sysinfo', ''
    );
    // Derive server root for built-in Zowe endpoints
    try {
      const uri = ZoweZLUX.uriBroker.serverRootUri('');
      this.serverRootBase = uri.endsWith('/') ? uri.slice(0, -1) : uri;
    } catch {
      this.serverRootBase = '';
    }
  }

  /**
   * Primary: fetch from our custom sysinfo dataservice.
   * This gets OS, CPU, memory, network, Zowe config, plugins, cluster info.
   */
  getServerInfo(): Observable<SystemInfoResponse> {
    return this.http.get<SystemInfoResponse>(this.sysinfoUri);
  }

  /**
   * Fetch Zowe's built-in /server/environment (available with or without RBAC).
   * Returns platform, arch, and in RBAC mode: full env vars, PID, CPU, etc.
   */
  getZoweEnvironment(): Observable<ZoweServerEnvironment> {
    const url = `${this.serverRootBase}/server/environment`;
    return this.http.get<ZoweServerEnvironment>(url).pipe(
      catchError(() => of({} as ZoweServerEnvironment))
    );
  }

  /**
   * Fetch Zowe's built-in /plugins?type=all for the canonical plugin list.
   */
  getZowePlugins(): Observable<ZowePluginDef[]> {
    const url = `${this.serverRootBase}/plugins?type=all`;
    return this.http.get<{ pluginDefinitions: ZowePluginDef[] }>(url).pipe(
      map(res => res.pluginDefinitions || []),
      catchError(() => of([] as ZowePluginDef[]))
    );
  }

  /**
   * Fetch current auth session status from Zowe's built-in /auth endpoint.
   */
  getAuthStatus(): Observable<ZoweAuthStatus> {
    const url = `${this.serverRootBase}/auth`;
    return this.http.get<ZoweAuthStatus>(url).pipe(
      catchError(() => of({ authenticated: false } as ZoweAuthStatus))
    );
  }

  /**
   * Aggregated call: fetches all server-side data sources in parallel.
   */
  getAllServerData(): Observable<{
    sysinfo: SystemInfoResponse;
    zoweEnv: ZoweServerEnvironment;
    plugins: ZowePluginDef[];
    auth: ZoweAuthStatus;
  }> {
    return forkJoin({
      sysinfo: this.getServerInfo(),
      zoweEnv: this.getZoweEnvironment(),
      plugins: this.getZowePlugins(),
      auth: this.getAuthStatus()
    });
  }

  /**
   * Collect client-side browser, screen, and locale information.
   */
  getClientInfo(): ClientInfo {
    const nav = window.navigator;
    const conn = (nav as any).connection;
    const browserInfo = this.parseBrowser(nav.userAgent);

    return {
      userAgent: nav.userAgent,
      browserName: browserInfo.name,
      browserVersion: browserInfo.version,
      platform: nav.platform || 'Unknown',
      language: nav.language,
      languages: nav.languages ? [].slice.call(nav.languages) : [nav.language],
      cookiesEnabled: nav.cookieEnabled,
      onLine: nav.onLine,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      screenColorDepth: window.screen.colorDepth,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timeZoneOffset: new Date().getTimezoneOffset(),
      connectionType: conn ? conn.effectiveType || 'Unknown' : 'Unknown',
      hardwareConcurrency: nav.hardwareConcurrency || 0,
      maxTouchPoints: nav.maxTouchPoints || 0,
      darkMode: window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false
    };
  }

  // ─── ZLUX Desktop APIs ───

  getDesktopVersion(): string {
    try {
      return ZoweZLUX.pluginManager ? 'Zowe Desktop (ZLUX)' : 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  getServerRootUri(): string {
    try {
      return ZoweZLUX.uriBroker.serverRootUri('');
    } catch {
      return 'Unknown';
    }
  }

  getCurrentPluginVersion(): string {
    try {
      const basePlugin = this.pluginDefinition.getBasePlugin();
      return (basePlugin as any).getVersion ? (basePlugin as any).getVersion() : 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  getCurrentPluginId(): string {
    try {
      return this.pluginDefinition.getBasePlugin().getIdentifier();
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Extract the logged-in username from auth status response.
   */
  extractUsername(authStatus: ZoweAuthStatus): string {
    if (!authStatus || !authStatus.categories) return 'Unknown';
    const categories = authStatus.categories;
    const catKeys = categories ? Object.keys(categories) : [];
    for (let i = 0; i < catKeys.length; i++) {
      const cat = categories[catKeys[i]];
      if (cat && cat.plugins) {
        const pluginKeys = Object.keys(cat.plugins);
        for (let j = 0; j < pluginKeys.length; j++) {
          const pluginAuth = cat.plugins[pluginKeys[j]];
          if (pluginAuth.authenticated && pluginAuth.username) {
            return pluginAuth.username;
          }
        }
      }
    }
    return 'Unknown';
  }

  /**
   * Extract session expiration from auth status.
   */
  extractSessionExpiry(authStatus: ZoweAuthStatus): number | null {
    return authStatus.expms || null;
  }

  // ─── Browser Detection ───

  private parseBrowser(ua: string): { name: string; version: string } {
    let name = 'Unknown';
    let version = '';

    if (ua.indexOf('Firefox') > -1) {
      name = 'Firefox';
      const match = ua.match(/Firefox\/([\d.]+)/);
      version = match ? match[1] : '';
    } else if (ua.indexOf('Edg/') > -1) {
      name = 'Microsoft Edge';
      const match = ua.match(/Edg\/([\d.]+)/);
      version = match ? match[1] : '';
    } else if (ua.indexOf('Chrome') > -1) {
      name = 'Google Chrome';
      const match = ua.match(/Chrome\/([\d.]+)/);
      version = match ? match[1] : '';
    } else if (ua.indexOf('Safari') > -1) {
      name = 'Safari';
      const match = ua.match(/Version\/([\d.]+)/);
      version = match ? match[1] : '';
    } else if (ua.indexOf('MSIE') > -1 || ua.indexOf('Trident') > -1) {
      name = 'Internet Explorer';
      const match = ua.match(/(?:MSIE |rv:)([\d.]+)/);
      version = match ? match[1] : '';
    }

    return { name, version };
  }
}

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/
