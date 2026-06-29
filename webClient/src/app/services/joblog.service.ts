

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';

/**
 * Job Log Service — fetches Zowe job spool output and USS log files.
 *
 * Two sources:
 *   1. JES Spool (z/OSMF REST Jobs API) — for active/recent jobs
 *   2. USS Log Files (ZSS unixFile API) — for persisted logs after JES purge
 *
 * Key design decisions:
 *   - owner defaults to '*' (wildcard) because Zowe STCs are owned by a
 *     service account (ZWESISTC), NOT the logged-in user.
 *   - prefix defaults to 'ZWE*' to target all Zowe-related jobs.
 *   - USS logs path defaults to common Zowe workspace log directory.
 *   - When JES spool is purged (404), the fallback is USS log files.
 */

// ═══════════ Interfaces ═══════════

/** z/OSMF REST Jobs API response item */
export interface ZosmfJob {
  jobname: string;
  jobid: string;
  owner: string;
  status: string;
  type: string;
  retcode: string | null;
  'class': string;
  'files-url': string;
  url: string;
}

/** z/OSMF spool file descriptor */
export interface ZosmfSpoolFile {
  id: number;
  ddname: string;
  'step-name': string;
  'proc-step': string;
  'byte-count': number;
  'record-count': number;
  'records-url': string;
}

/** Job entry for UI display */
export interface JobLogEntry {
  label: string;
  jobname: string;
  jobid: string;
  owner: string;
  status: string;
  retcode: string | null;
  jobUrl: string;
}

/** Result of fetching jobs + auto-selecting most recent spool */
export interface JobLogResult {
  entries: JobLogEntry[];
  content: string;
  selectedLabel: string | null;
}

/** USS log file entry */
export interface UssLogFile {
  name: string;
  path: string;
  size: number;
  lastModified: string;
}

/** USS directory listing response from ZSS */
export interface UssDirectoryResponse {
  entries: Array<{
    name: string;
    path: string;
    directory: boolean;
    size: number;
    mode: number;
    ccsid: number;
    lastModified?: string;
    createdAt?: string;
  }>;
}

// ═══════════ Service ═══════════

@Injectable()
export class JobLogService {

  private static readonly ZOSMF_JOBS_URI = '/ibmzosmf/api/v1/zosmf/restjobs/jobs';
  private static readonly DEFAULT_OWNER = '*';
  private static readonly DEFAULT_PREFIX = 'ZWE*';
  private static readonly MAX_JOBS = 25;

  constructor(private http: HttpClient) {}

  // ─── Configuration ───

  getDefaultOwner(): string { return JobLogService.DEFAULT_OWNER; }
  getDefaultPrefix(): string { return JobLogService.DEFAULT_PREFIX; }

  // ─── z/OSMF Headers (CSRF protection required) ───

  private headers(): HttpHeaders {
    return new HttpHeaders({
      'Accept': 'application/json',
      'X-CSRF-ZOSMF-HEADER': 'true'
    });
  }

  // ─── Public API ───

  /**
   * List recent jobs matching owner + prefix.
   * owner='*' returns jobs from ALL owners (necessary for Zowe STCs).
   */
  listJobs(owner: string, prefix: string): Observable<JobLogEntry[]> {
    var ownerParam = (owner && owner.trim()) ? owner.trim().toUpperCase() : JobLogService.DEFAULT_OWNER;
    var prefixParam = (prefix && prefix.trim()) ? prefix.trim().toUpperCase() : JobLogService.DEFAULT_PREFIX;

    var url = JobLogService.ZOSMF_JOBS_URI +
      '?owner=' + encodeURIComponent(ownerParam) +
      '&prefix=' + encodeURIComponent(prefixParam) +
      '&max-jobs=' + JobLogService.MAX_JOBS;

    return this.http.get<ZosmfJob[]>(url, { headers: this.headers() }).pipe(
      map(function(jobs: any) {
        if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
          return [];
        }
        // Sort by jobid descending — higher JOB IDs are more recent
        var sorted = jobs.slice().sort(function(a: ZosmfJob, b: ZosmfJob) {
          if (a.jobid > b.jobid) return -1;
          if (a.jobid < b.jobid) return 1;
          return 0;
        });
        return sorted.map(function(job: ZosmfJob): JobLogEntry {
          return {
            label: job.jobname + '(' + job.jobid + ')',
            jobname: job.jobname,
            jobid: job.jobid,
            owner: job.owner,
            status: job.status || '',
            retcode: job.retcode || null,
            jobUrl: job.url || (JobLogService.ZOSMF_JOBS_URI + '/' + job.jobname + '/' + job.jobid)
          };
        });
      }),
      catchError(function(err: any) {
        console.error('[JobLogService] listJobs failed:', err.status, err.message || '');
        return of([]);
      })
    );
  }

  /**
   * Fetch spool file content for a job. Reads JESMSGLG by default
   * (main system messages log), falling back to the first available DD.
   */
  getSpoolContent(jobUrl: string): Observable<string> {
    if (!jobUrl) { return of(''); }

    var filesUrl = jobUrl + '/files';
    var headers = this.headers();
    var httpRef = this.http;

    return httpRef.get<ZosmfSpoolFile[]>(filesUrl, { headers: headers }).pipe(
      switchMap(function(spoolFiles: any) {
        if (!spoolFiles || !Array.isArray(spoolFiles) || spoolFiles.length === 0) {
          return of('No spool files found for this job.');
        }

        // Prefer JESMSGLG > JESYSMSG > first available
        var target = spoolFiles[0];
        for (var i = 0; i < spoolFiles.length; i++) {
          if (spoolFiles[i].ddname === 'JESMSGLG') { target = spoolFiles[i]; break; }
        }
        if (target === spoolFiles[0]) {
          for (var j = 0; j < spoolFiles.length; j++) {
            if (spoolFiles[j].ddname === 'JESYSMSG') { target = spoolFiles[j]; break; }
          }
        }

        var recordsUrl = target['records-url'] ||
          (jobUrl + '/files/' + target.id + '/records');

        return httpRef.get(recordsUrl, { headers: headers, responseType: 'text' }).pipe(
          catchError(function(err: any) {
            return of('Error (' + (err.status || 0) + '): Failed to read spool DD ' + target.ddname + '.');
          })
        );
      }),
      catchError(function(err: any) {
        var status = err.status || 0;
        if (status === 403) {
          return of('Error (403): Access denied. You may lack JESSPOOL authority for this job.');
        }
        if (status === 404) {
          return of('Error (404): Job not found. It may have been purged from JES.');
        }
        return of('Error (' + status + '): Failed to retrieve spool files.');
      })
    );
  }

  /**
   * Convenience: list jobs + auto-fetch the most recent job's spool.
   */
  fetchMostRecent(owner: string, prefix: string): Observable<JobLogResult> {
    var self = this;
    return self.listJobs(owner, prefix).pipe(
      switchMap(function(entries: JobLogEntry[]) {
        if (entries.length === 0) {
          return of({ entries: [], content: '', selectedLabel: null } as JobLogResult);
        }
        var first = entries[0];
        return self.getSpoolContent(first.jobUrl).pipe(
          map(function(content: string): JobLogResult {
            return { entries: entries, content: content, selectedLabel: first.label };
          }),
          catchError(function(): Observable<JobLogResult> {
            return of({ entries: entries, content: 'Error reading spool output.', selectedLabel: first.label });
          })
        );
      })
    );
  }

  // ═══════════ USS LOG FILES (Fallback for purged jobs) ═══════════

  /**
   * List log files in the Zowe workspace logs directory via ZSS unixFile API.
   * USS logs persist even after JES spool is purged.
   * Filters to *.log files and sorts by name descending (most recent first).
   */
  listUssLogs(logsPath: string): Observable<UssLogFile[]> {
    if (!logsPath || !logsPath.trim()) { return of([]); }

    var cleanPath = logsPath.trim();
    if (!cleanPath.startsWith('/')) { cleanPath = '/' + cleanPath; }

    var requestUrl: string;
    try {
      requestUrl = ZoweZLUX.uriBroker.unixFileUri('contents', cleanPath + '?respondType=3');
    } catch (e) {
      // Fallback: construct manually if uriBroker not available
      requestUrl = '/unixfile/contents' + cleanPath + '?respondType=3';
    }

    return this.http.get<UssDirectoryResponse>(requestUrl).pipe(
      map(function(response: any) {
        if (!response || !response.entries || !Array.isArray(response.entries)) {
          return [];
        }
        // Filter to log files only, exclude directories
        var logFiles: UssLogFile[] = [];
        for (var i = 0; i < response.entries.length; i++) {
          var entry = response.entries[i];
          if (entry.directory) { continue; }
          var name = entry.name || '';
          if (name.indexOf('.log') > -1 || name.indexOf('.out') > -1 || name.indexOf('install') > -1) {
            logFiles.push({
              name: name,
              path: cleanPath + '/' + name,
              size: entry.size || 0,
              lastModified: entry.lastModified || entry.createdAt || ''
            });
          }
        }
        // Sort by name descending (log files typically have timestamps in names)
        logFiles.sort(function(a, b) {
          if (a.name > b.name) return -1;
          if (a.name < b.name) return 1;
          return 0;
        });
        return logFiles;
      }),
      catchError(function(err: any) {
        console.error('[JobLogService] listUssLogs failed:', err.status || 0);
        return of([]);
      })
    );
  }

  /**
   * Read a USS log file's content via ZSS.
   */
  getUssFileContent(filePath: string): Observable<string> {
    if (!filePath || !filePath.trim()) { return of(''); }

    var requestUrl: string;
    try {
      requestUrl = ZoweZLUX.uriBroker.unixFileUri('contents', filePath.trim());
    } catch (e) {
      requestUrl = '/unixfile/contents' + filePath.trim();
    }

    return this.http.get(requestUrl, { responseType: 'text' }).pipe(
      catchError(function(err: any) {
        var status = err.status || 0;
        if (status === 403) {
          return of('Error (403): Access denied. You lack READ permission to this USS path.');
        }
        if (status === 404) {
          return of('Error (404): File not found at ' + filePath + '.');
        }
        return of('Error (' + status + '): Failed to read USS file.');
      })
    );
  }

  /**
   * Get the default Zowe log directory path.
   * This is typically set from the server's environment info.
   */
  getDefaultLogPath(): string {
    return '/global/zowe/logs';
  }
}

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/
