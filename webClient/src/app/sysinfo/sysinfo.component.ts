

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  SysInfoService,
  ClientInfo,
  ServerInfo,
  ZoweInfo,
  PluginsInfo,
  CurrentPluginInfo,
  ZoweServerEnvironment,
  ZoweAuthStatus,
  ZowePluginDef
} from '../services/sysinfo.service';
import { JobLogService, JobLogEntry } from '../services/joblog.service';

@Component({
  selector: 'app-sysinfo',
  templateUrl: './sysinfo.component.html',
  styleUrls: ['./sysinfo.component.css']
})
export class SysInfoComponent implements OnInit, OnDestroy {
  // Expose Math to template
  Math = Math;

  // State
  loading = true;
  error: string | null = null;
  activeTab: 'overview' | 'server' | 'client' | 'network' | 'zowe' | 'plugins' | 'diagnostics' = 'overview';

  // Server data (from our custom dataservice)
  serverInfo: ServerInfo | null = null;
  zoweInfo: ZoweInfo | null = null;
  pluginsInfo: PluginsInfo | null = null;
  currentPlugin: CurrentPluginInfo | null = null;
  timestamp: string = '';

  // Zowe built-in endpoint data
  zoweEnv: ZoweServerEnvironment | null = null;
  authStatus: ZoweAuthStatus | null = null;
  zowePluginDefs: ZowePluginDef[] = [];

  // Client data
  clientInfo: ClientInfo | null = null;

  // ZLUX data
  desktopVersion: string = '';
  serverRootUri: string = '';
  currentPluginId: string = '';
  currentPluginVersion: string = '';

  // Session
  loggedInUser: string = '';
  sessionExpiryMs: number | null = null;

  // Refresh timer
  private refreshInterval: any;

  // For live uptime display
  serverUptimeFormatted: string = '';
  private uptimeInterval: any;
  private baseUptime: number = 0;
  private uptimeBaseTimestamp: number = 0;

  // ─── Diagnostics / Job Log state ───
  jobLogMode: 'jes' | 'dataset' = 'jes';
  jobLogPrefix: string = 'ZWE*';
  jobLogDataset: string = '';
  jobLogEntries: JobLogEntry[] = [];
  jobLogContent: string = '';
  jobLogSelectedMember: string | null = null;
  jobLogLoading: boolean = false;
  jobLogError: string | null = null;
  jobLogCopied: boolean = false;
  jobLogValidationError: string | null = null;
  jobLogAutoFetched: boolean = false;

  constructor(private sysInfoService: SysInfoService, private jobLogService: JobLogService) {
    this.jobLogPrefix = this.jobLogService.getDefaultJobPrefix();
  }

  ngOnInit(): void {
    this.loadClientInfo();
    this.loadZluxInfo();
    this.loadAllServerData();

    // Auto-refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.loadAllServerData();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    if (this.uptimeInterval) clearInterval(this.uptimeInterval);
  }

  loadAllServerData(): void {
    this.sysInfoService.getAllServerData().subscribe(
      (data) => {
        // Custom dataservice response
        const r = data.sysinfo;
        this.serverInfo = r.server;
        this.zoweInfo = r.zowe;
        this.pluginsInfo = r.plugins;
        this.currentPlugin = r.currentPlugin;
        this.timestamp = r.timestamp;

        // Zowe built-in environment
        this.zoweEnv = data.zoweEnv;

        // Auth / session
        this.authStatus = data.auth;
        this.loggedInUser = this.sysInfoService.extractUsername(data.auth);
        this.sessionExpiryMs = this.sysInfoService.extractSessionExpiry(data.auth);

        // Plugin defs from Zowe's /plugins endpoint (canonical source)
        this.zowePluginDefs = data.plugins;

        this.loading = false;
        this.error = null;

        // Start live uptime counter
        this.baseUptime = r.server.uptimeSeconds;
        this.uptimeBaseTimestamp = Date.now();
        this.updateUptime();
        if (this.uptimeInterval) clearInterval(this.uptimeInterval);
        this.uptimeInterval = setInterval(() => this.updateUptime(), 1000);
      },
      (err: any) => {
        this.loading = false;
        this.error = 'Unable to connect to system info service. The server may be unavailable.';
        console.error('SysInfo error:', err);
      }
    );
  }

  loadClientInfo(): void {
    this.clientInfo = this.sysInfoService.getClientInfo();
  }

  loadZluxInfo(): void {
    this.desktopVersion = this.sysInfoService.getDesktopVersion();
    this.serverRootUri = this.sysInfoService.getServerRootUri();
    this.currentPluginId = this.sysInfoService.getCurrentPluginId();
    this.currentPluginVersion = this.sysInfoService.getCurrentPluginVersion();
  }

  setActiveTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
    if (tab === 'diagnostics') {
      this.onDiagnosticsTabActivated();
    }
  }

  refreshData(): void {
    this.loading = true;
    this.loadAllServerData();
    this.loadClientInfo();
  }

  private updateUptime(): void {
    const elapsed = Math.floor((Date.now() - this.uptimeBaseTimestamp) / 1000);
    const totalSeconds = this.baseUptime + elapsed;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    this.serverUptimeFormatted = parts.join(' ');
  }

  // ─── Helpers ───

  formatMemory(mb: number): string {
    if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
    return mb + ' MB';
  }

  getOSDisplayName(): string {
    if (!this.serverInfo) return 'Unknown';
    const platform = this.serverInfo.platform;
    const osType = this.serverInfo.osType;
    if (platform === 'os390' || osType === 'OS/390') return 'z/OS';
    if (platform === 'linux') return 'Linux';
    if (platform === 'darwin') return 'macOS';
    if (platform === 'win32') return 'Windows';
    if (platform === 'aix') return 'AIX';
    return osType || platform;
  }

  getOSIcon(): string {
    const osName = this.getOSDisplayName();
    switch (osName) {
      case 'z/OS': return 'os-zos';
      case 'Linux': return 'os-linux';
      case 'macOS': return 'os-macos';
      case 'Windows': return 'os-windows';
      default: return 'os-generic';
    }
  }

  getMemoryBarWidth(): number {
    return this.serverInfo ? this.serverInfo.memoryUsagePercent : 0;
  }

  getMemoryBarColor(): string {
    const pct = this.getMemoryBarWidth();
    if (pct > 90) return '#ff3b30';
    if (pct > 70) return '#ff9500';
    if (pct > 50) return '#ffcc00';
    return '#34c759';
  }

  getLoadAverageDisplay(): string {
    if (!this.serverInfo || !this.serverInfo.loadAverage) return 'N/A';
    return this.serverInfo.loadAverage.map(l => l.toFixed(2)).join(' / ');
  }

  getExternalInterfaces(): any[] {
    if (!this.serverInfo) return [];
    return this.serverInfo.networkInterfaces.filter(i => !i.internal && i.family === 'IPv4');
  }

  getAllInterfaces(): any[] {
    if (!this.serverInfo) return [];
    return this.serverInfo.networkInterfaces;
  }

  getFormattedTimestamp(): string {
    if (!this.timestamp) return '';
    try {
      return new Date(this.timestamp).toLocaleString();
    } catch {
      return this.timestamp;
    }
  }

  getConnectionStatusColor(): string {
    return this.clientInfo && this.clientInfo.onLine ? '#34c759' : '#ff3b30';
  }

  getSessionExpiryFormatted(): string {
    if (!this.sessionExpiryMs) return 'Unknown';
    const minutes = Math.floor(this.sessionExpiryMs / 60000);
    if (minutes >= 60) {
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hrs}h ${mins}m`;
    }
    return `${minutes}m`;
  }

  getAppPlugins(): ZowePluginDef[] {
    return this.zowePluginDefs.filter(p => p.pluginType === 'application');
  }

  getOtherPlugins(): ZowePluginDef[] {
    return this.zowePluginDefs.filter(p => p.pluginType !== 'application');
  }

  getMediationLayerStatus(): string {
    if (!this.zoweInfo) return 'Unknown';
    if (this.zoweInfo.mediationLayer.enabled) {
      const gw = this.zoweInfo.mediationLayer.gatewayHostname;
      const port = this.zoweInfo.mediationLayer.gatewayPort;
      return gw && port ? `Enabled (${gw}:${port})` : 'Enabled';
    }
    return 'Disabled';
  }

  getAgentStatus(): string {
    if (!this.zoweInfo || !this.zoweInfo.agent) return 'Unknown';
    const a = this.zoweInfo.agent;
    return a.host && a.port ? `${a.host}:${a.port}` : 'Not configured';
  }

  // ─── Diagnostics / Job Log Methods ───

  /**
   * Switch between JES (automatic) and Dataset (manual) modes.
   */
  setJobLogMode(mode: 'jes' | 'dataset'): void {
    this.jobLogMode = mode;
    this.jobLogEntries = [];
    this.jobLogContent = '';
    this.jobLogSelectedMember = null;
    this.jobLogError = null;
    this.jobLogValidationError = null;
    this.jobLogAutoFetched = false;
  }

  /**
   * Auto-fetch job logs when Diagnostics tab is selected.
   * Uses JES mode by default (auto-detect user's jobs).
   */
  onDiagnosticsTabActivated(): void {
    if (!this.jobLogAutoFetched && this.loggedInUser) {
      this.jobLogAutoFetched = true;
      this.fetchJobLog();
    }
  }

  /**
   * Fetch job log entries.
   * JES mode: auto-detects user's recent jobs via z/OSMF.
   * Dataset mode: reads members of specified PDS.
   */
  fetchJobLog(): void {
    this.jobLogLoading = true;
    this.jobLogError = null;
    this.jobLogContent = '';
    this.jobLogEntries = [];
    this.jobLogSelectedMember = null;
    this.jobLogCopied = false;
    this.jobLogValidationError = null;

    if (this.jobLogMode === 'jes') {
      // JES Mode: Use z/OSMF REST Jobs API (auto-detect)
      const owner = this.loggedInUser || '*';
      const prefix = this.jobLogPrefix || 'ZWE*';

      this.jobLogService.getMostRecentJobLog(owner, prefix).subscribe(
        (result) => {
          this.jobLogEntries = result.entries;
          this.jobLogContent = result.content;
          this.jobLogSelectedMember = result.selectedMember;
          this.jobLogLoading = false;
          if (result.entries.length === 0) {
            this.jobLogError = 'No jobs found for owner ' + owner.toUpperCase() +
              ' with prefix ' + prefix + '. Try a different prefix or switch to Dataset mode.';
          }
        },
        () => {
          this.jobLogLoading = false;
          this.jobLogError = 'Failed to fetch jobs from z/OSMF. Ensure z/OSMF is running and accessible.';
        }
      );
    } else {
      // Dataset Mode: Use ZSS dataset API (manual)
      const validationErr = this.jobLogService.validateDatasetName(this.jobLogDataset);
      if (validationErr) {
        this.jobLogValidationError = validationErr;
        this.jobLogLoading = false;
        return;
      }

      this.jobLogService.getMostRecentDatasetLog(this.jobLogDataset).subscribe(
        (result) => {
          this.jobLogEntries = result.entries;
          this.jobLogContent = result.content;
          this.jobLogSelectedMember = result.selectedMember;
          this.jobLogLoading = false;
          if (result.entries.length === 0) {
            this.jobLogError = 'No members found in dataset ' + this.jobLogDataset.toUpperCase() +
              '. Verify the dataset name and ensure you have READ access.';
          }
        },
        () => {
          this.jobLogLoading = false;
          this.jobLogError = 'Failed to fetch dataset. Ensure the ZSS agent is running and you have access.';
        }
      );
    }
  }

  /**
   * Load a specific entry's content (works for both JES and Dataset mode).
   */
  selectJobLogMember(entry: JobLogEntry): void {
    if (this.jobLogSelectedMember === entry.memberName) return;
    this.jobLogSelectedMember = entry.memberName;
    this.jobLogLoading = true;
    this.jobLogCopied = false;

    this.jobLogService.getEntryContent(entry).subscribe(
      (content) => {
        this.jobLogContent = content;
        this.jobLogLoading = false;
      },
      () => {
        this.jobLogContent = 'Error loading content.';
        this.jobLogLoading = false;
      }
    );
  }

  /**
   * Copy the current job log content to the clipboard.
   * Uses the modern Clipboard API with fallback for older browsers.
   */
  copyJobLogToClipboard(): void {
    if (!this.jobLogContent || this.jobLogContent.indexOf('Error') === 0) return;

    const textToCopy = this.buildClipboardContent();

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(
        () => { this.jobLogCopied = true; setTimeout(() => this.jobLogCopied = false, 3000); },
        () => { this.fallbackCopyToClipboard(textToCopy); }
      );
    } else {
      this.fallbackCopyToClipboard(textToCopy);
    }
  }

  /**
   * Build a structured clipboard output with metadata header.
   */
  private buildClipboardContent(): string {
    const source = this.jobLogMode === 'jes'
      ? ' Source: JES (' + (this.loggedInUser || 'Unknown') + ', prefix: ' + this.jobLogPrefix + ')'
      : ' Dataset: ' + (this.jobLogDataset || '').toUpperCase();
    const header = [
      '═══════════════════════════════════════════════════════════',
      ' Zowe Installation Diagnostic Log',
      source,
      ' Entry: ' + (this.jobLogSelectedMember || 'N/A'),
      ' Exported: ' + new Date().toISOString(),
      ' User: ' + (this.loggedInUser || 'Unknown'),
      ' Server: ' + (this.serverInfo ? this.serverInfo.hostname : 'Unknown'),
      '═══════════════════════════════════════════════════════════',
      ''
    ].join('\n');
    return header + this.jobLogContent;
  }

  /**
   * Fallback clipboard copy for browsers without Clipboard API.
   */
  private fallbackCopyToClipboard(text: string): void {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) {
        this.jobLogCopied = true;
        setTimeout(() => this.jobLogCopied = false, 3000);
      }
    } catch (e) {
      console.error('Clipboard fallback failed', e);
    }
  }

  /**
   * Get line count of current content (for display).
   */
  getJobLogLineCount(): number {
    if (!this.jobLogContent) return 0;
    return this.jobLogContent.split('\n').length;
  }

  /**
   * Check if the job log content is an error message.
   */
  isJobLogError(): boolean {
    return !!this.jobLogContent && this.jobLogContent.indexOf('Error') === 0;
  }
}

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/
