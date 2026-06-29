
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
 * Job Log Service — fetches the logged-in user's recent jobs
 * via the z/OSMF REST Jobs API.
 *
 * Shows ONLY jobs owned by the current user (e.g. TS5038).
 * Uses prefix=* to show all job types the user has submitted.
 */

// ═══════════ Interfaces ═══════════

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

export interface ZosmfSpoolFile {
  id: number;
  ddname: string;
  'step-name': string;
  'proc-step': string;
  'byte-count': number;
  'record-count': number;
  'records-url': string;
}

export interface JobLogEntry {
  label: string;
  jobname: string;
  jobid: string;
  owner: string;
  status: string;
  retcode: string | null;
  jobUrl: string;
}

export interface JobLogResult {
  entries: JobLogEntry[];
  content: string;
  selectedLabel: string | null;
}

// ═══════════ Service ═══════════

@Injectable()
export class JobLogService {

  private static readonly ZOSMF_JOBS_URI = '/ibmzosmf/api/v1/zosmf/restjobs/jobs';
  private static readonly MAX_JOBS = 20;

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    return new HttpHeaders({
      'Accept': 'application/json',
      'X-CSRF-ZOSMF-HEADER': 'true'
    });
  }

  /**
   * List recent jobs for a specific owner.
   */
  listJobs(owner: string, prefix: string): Observable<JobLogEntry[]> {
    var ownerParam = (owner && owner.trim()) ? owner.trim().toUpperCase() : '*';
    var prefixParam = (prefix && prefix.trim()) ? prefix.trim().toUpperCase() : '*';

    var url = JobLogService.ZOSMF_JOBS_URI +
      '?owner=' + encodeURIComponent(ownerParam) +
      '&prefix=' + encodeURIComponent(prefixParam) +
      '&max-jobs=' + JobLogService.MAX_JOBS;

    return this.http.get<ZosmfJob[]>(url, { headers: this.headers() }).pipe(
      map(function(jobs: any) {
        if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
          return [];
        }
        var sorted = jobs.slice().sort(function(a: ZosmfJob, b: ZosmfJob) {
          if (a.jobid > b.jobid) return -1;
          if (a.jobid < b.jobid) return 1;
          return 0;
        });
        return sorted.map(function(job: ZosmfJob): JobLogEntry {
          // Always construct relative URL — job.url contains internal hostname:port
          // that isn't routable through the API Mediation Layer gateway.
          return {
            label: job.jobname + '(' + job.jobid + ')',
            jobname: job.jobname,
            jobid: job.jobid,
            owner: job.owner,
            status: job.status || '',
            retcode: job.retcode || null,
            jobUrl: JobLogService.ZOSMF_JOBS_URI + '/' + encodeURIComponent(job.jobname) + '/' + encodeURIComponent(job.jobid)
          };
        });
      }),
      catchError(function(err: any) {
        console.error('[JobLogService] listJobs failed:', err.status || 0);
        return of([]);
      })
    );
  }

  /**
   * Fetch JESMSGLG spool content for a job.
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

        var target = spoolFiles[0];
        for (var i = 0; i < spoolFiles.length; i++) {
          if (spoolFiles[i].ddname === 'JESMSGLG') { target = spoolFiles[i]; break; }
        }
        if (target === spoolFiles[0]) {
          for (var j = 0; j < spoolFiles.length; j++) {
            if (spoolFiles[j].ddname === 'JESYSMSG') { target = spoolFiles[j]; break; }
          }
        }

        // Always construct relative URL — records-url from z/OSMF contains
        // internal hostname:port that isn't routable through the gateway.
        var recordsUrl = jobUrl + '/files/' + target.id + '/records';

        return httpRef.get(recordsUrl, { headers: headers, responseType: 'text' }).pipe(
          catchError(function(err: any) {
            return of('Error (' + (err.status || 0) + '): Failed to read spool DD ' + target.ddname + '.');
          })
        );
      }),
      catchError(function(err: any) {
        var status = err.status || 0;
        if (status === 403) {
          return of('Error (403): Access denied. You may lack JESSPOOL READ authority.');
        }
        if (status === 404) {
          return of('Error (404): Job purged from JES spool.');
        }
        return of('Error (' + status + '): Failed to retrieve spool files.');
      })
    );
  }

  /**
   * Fetch user's most recent job and its spool content.
   */
  fetchUserJobs(owner: string): Observable<JobLogResult> {
    var self = this;
    return self.listJobs(owner, '*').pipe(
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
}

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/
