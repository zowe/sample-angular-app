

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
import { map, catchError } from 'rxjs/operators';

/**
 * Production-grade Job Log Service for Zowe Desktop.
 *
 * Two modes of operation:
 *
 * 1. JES Mode (default, automatic):
 *    Uses z/OSMF REST Jobs API to list the current user's recent jobs
 *    and fetch their spool output. Same API that zlux-editor uses for
 *    JCL submission at: /ibmzosmf/api/v1/zosmf/restjobs/jobs
 *
 * 2. Dataset Mode (manual fallback):
 *    Uses ZSS dataset APIs (same as zlux-editor) to read PDS members.
 *
 * Security:
 *   - z/OSMF handles auth via the session cookie (same session as Desktop)
 *   - ZSS handles SAF/RACF authorization for dataset access
 *   - No credentials stored or transmitted by this service
 *   - Job listings respect z/OSMF RBAC (user sees only their own jobs)
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

/** Dataset metadata response from ZSS */
export interface DatasetMetadataResponse {
  datasets: Array<{
    name: string;
    members?: Array<{ name: string }>;
  }>;
}

/** Dataset contents response from ZSS */
export interface DatasetContentsResponse {
  records: string[];
  etag?: string;
}

/** Unified job entry for UI display */
export interface JobLogEntry {
  memberName: string;
  datasetName: string;
  fullPath: string;
  mode: 'jes' | 'dataset';
  retcode?: string;
  status?: string;
}

// ═══════════ Service ═══════════

@Injectable()
export class JobLogService {

  private static readonly ZOSMF_JOBS_URI = '/ibmzosmf/api/v1/zosmf/restjobs/jobs';
  private static readonly DEFAULT_JOB_PREFIX = 'ZWE*';
  private static readonly MAX_JOBS = 20;

  constructor(
    private http: HttpClient
  ) {}

  // ─── z/OSMF Headers ───

  private getZosmfHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Accept': 'application/json',
      'X-CSRF-ZOSMF-HEADER': 'true'
    });
  }

  // ═══════════ JES MODE (Primary - Auto-detect) ═══════════

  /**
   * List recent jobs for the given owner/prefix using z/OSMF REST Jobs API.
   * Same API as zlux-editor menu-bar.config.ts line 72:
   *   /ibmzosmf/api/v1/zosmf/restjobs/jobs?owner=USER&prefix=ZWE*
   */
  listJobs(owner: string, prefix: string): Observable<JobLogEntry[]> {
    const ownerParam = owner ? owner.toUpperCase() : '*';
    const prefixParam = prefix ? prefix.toUpperCase() : JobLogService.DEFAULT_JOB_PREFIX;

    const url = JobLogService.ZOSMF_JOBS_URI +
      '?owner=' + encodeURIComponent(ownerParam) +
      '&prefix=' + encodeURIComponent(prefixParam) +
      '&max-jobs=' + JobLogService.MAX_JOBS;

    return this.http.get<ZosmfJob[]>(url, { headers: this.getZosmfHeaders() }).pipe(
      map((jobs: any) => {
        // z/OSMF may return an object with an error message instead of an array
        if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
          return [];
        }

        // Sort by jobid descending (higher JOB IDs = more recent)
        const sorted = jobs.slice().sort(function(a: ZosmfJob, b: ZosmfJob) {
          if (a.jobid > b.jobid) return -1;
          if (a.jobid < b.jobid) return 1;
          return 0;
        });

        return sorted.map(function(job: ZosmfJob) {
          return {
            memberName: job.jobname + '(' + job.jobid + ')',
            datasetName: (job.retcode || job.status || 'UNKNOWN'),
            fullPath: job.url || (JobLogService.ZOSMF_JOBS_URI + '/' + job.jobname + '/' + job.jobid),
            mode: 'jes' as 'jes',
            retcode: job.retcode || undefined,
            status: job.status || undefined
          };
        });
      }),
      catchError(function(err) {
        console.error('JobLog: z/OSMF Jobs API error', err);
        return of([]);
      })
    );
  }

  /**
   * Get spool content for a specific job.
   * Fetches the JESMSGLG DD (main system messages) by default.
   */
  getJobSpoolContent(jobUrl: string): Observable<string> {
    if (!jobUrl) return of('');

    const filesUrl = jobUrl + '/files';
    const headers = this.getZosmfHeaders();
    const httpRef = this.http;

    return new Observable(function(observer) {
      httpRef.get<ZosmfSpoolFile[]>(filesUrl, { headers: headers }).subscribe(
        function(spoolFiles) {
          if (!spoolFiles || !Array.isArray(spoolFiles) || spoolFiles.length === 0) {
            observer.next('No spool files found for this job.');
            observer.complete();
            return;
          }

          // Pick JESMSGLG (system messages) as default, fallback to first
          var targetSpool = spoolFiles[0];
          for (var i = 0; i < spoolFiles.length; i++) {
            if (spoolFiles[i].ddname === 'JESMSGLG') {
              targetSpool = spoolFiles[i];
              break;
            }
          }

          var recordsUrl = targetSpool['records-url'] ||
            (jobUrl + '/files/' + targetSpool.id + '/records');

          httpRef.get(recordsUrl, {
            headers: headers,
            responseType: 'text'
          }).subscribe(
            function(text) {
              observer.next(text || '');
              observer.complete();
            },
            function(err) {
              var status = err.status || 0;
              observer.next('Error (' + status + '): Failed to fetch spool content.');
              observer.complete();
            }
          );
        },
        function(err) {
          var status = err.status || 0;
          if (status === 403) {
            observer.next('Error: Access denied (403). You may not have permission to view this job.');
          } else if (status === 404) {
            observer.next('Error: Job not found (404). It may have been purged from the system.');
          } else {
            observer.next('Error (' + status + '): Failed to list spool files.');
          }
          observer.complete();
        }
      );
    });
  }

  // ═══════════ DATASET MODE (Manual Fallback) ═══════════

  /**
   * List members of a PDS dataset via ZSS (same as zlux-editor).
   */
  listDatasetMembers(datasetName: string): Observable<JobLogEntry[]> {
    if (!datasetName || !datasetName.trim()) {
      return of([]);
    }

    var dsName = datasetName.trim().toUpperCase();
    var requestUrl: string;

    try {
      requestUrl = ZoweZLUX.uriBroker.datasetMetadataUri(
        encodeURIComponent(dsName), undefined, undefined, true
      );
    } catch (e) {
      return of([]);
    }

    return this.http.get<DatasetMetadataResponse>(requestUrl).pipe(
      map(function(response: DatasetMetadataResponse) {
        if (!response || !response.datasets || response.datasets.length === 0) {
          return [];
        }

        var ds = response.datasets[0];
        if (!ds.members || ds.members.length === 0) {
          return [];
        }

        var entries: JobLogEntry[] = ds.members.map(function(m) {
          return {
            memberName: m.name.trim(),
            datasetName: ds.name.trim(),
            fullPath: ds.name.trim() + '(' + m.name.trim() + ')',
            mode: 'dataset' as 'dataset'
          };
        });

        entries.sort(function(a, b) {
          if (a.memberName > b.memberName) return -1;
          if (a.memberName < b.memberName) return 1;
          return 0;
        });

        return entries;
      }),
      catchError(function(err) {
        console.error('JobLog: Failed to list dataset members', err);
        return of([]);
      })
    );
  }

  /**
   * Fetch content of a specific PDS member via ZSS.
   */
  getDatasetMemberContent(fullPath: string): Observable<string> {
    if (!fullPath || !fullPath.trim()) {
      return of('');
    }

    var requestUrl: string;
    try {
      requestUrl = ZoweZLUX.uriBroker.datasetContentsUri(fullPath.trim());
    } catch (e) {
      return of('Error: Unable to construct dataset URI. ZSS agent may not be available.');
    }

    return this.http.get<DatasetContentsResponse>(requestUrl).pipe(
      map(function(response: DatasetContentsResponse) {
        if (!response || !response.records) {
          return '';
        }
        return response.records
          .map(function(record) { return record.replace(/\s+$/, ''); })
          .join('\n');
      }),
      catchError(function(err) {
        var status = err.status || 0;
        if (status === 403) {
          return of('Error: Access denied. You do not have READ access to this dataset.');
        }
        if (status === 404) {
          return of('Error: Dataset or member not found.');
        }
        return of('Error (' + status + '): Failed to fetch dataset content.');
      })
    );
  }

  // ═══════════ UNIFIED API ═══════════

  /**
   * Primary entry: Auto-fetch the logged-in user's recent Zowe jobs.
   */
  getMostRecentJobLog(owner: string, prefix: string): Observable<{ entries: JobLogEntry[]; content: string; selectedMember: string | null; mode: string }> {
    var self = this;
    return new Observable(function(observer) {
      self.listJobs(owner, prefix).subscribe(
        function(entries) {
          if (entries.length === 0) {
            observer.next({ entries: [], content: '', selectedMember: null, mode: 'jes' });
            observer.complete();
            return;
          }

          var mostRecent = entries[0];
          self.getJobSpoolContent(mostRecent.fullPath).subscribe(
            function(content) {
              observer.next({ entries: entries, content: content, selectedMember: mostRecent.memberName, mode: 'jes' });
              observer.complete();
            },
            function() {
              observer.next({ entries: entries, content: 'Error fetching spool content', selectedMember: mostRecent.memberName, mode: 'jes' });
              observer.complete();
            }
          );
        },
        function() {
          observer.next({ entries: [], content: '', selectedMember: null, mode: 'jes' });
          observer.complete();
        }
      );
    });
  }

  /**
   * Dataset mode entry: list PDS members and fetch most recent.
   */
  getMostRecentDatasetLog(datasetName: string): Observable<{ entries: JobLogEntry[]; content: string; selectedMember: string | null; mode: string }> {
    var self = this;
    return new Observable(function(observer) {
      self.listDatasetMembers(datasetName).subscribe(
        function(entries) {
          if (entries.length === 0) {
            observer.next({ entries: [], content: '', selectedMember: null, mode: 'dataset' });
            observer.complete();
            return;
          }

          var mostRecent = entries[0];
          self.getDatasetMemberContent(mostRecent.fullPath).subscribe(
            function(content) {
              observer.next({ entries: entries, content: content, selectedMember: mostRecent.memberName, mode: 'dataset' });
              observer.complete();
            },
            function() {
              observer.next({ entries: entries, content: 'Error fetching content', selectedMember: mostRecent.memberName, mode: 'dataset' });
              observer.complete();
            }
          );
        },
        function() {
          observer.next({ entries: [], content: '', selectedMember: null, mode: 'dataset' });
          observer.complete();
        }
      );
    });
  }

  /**
   * Fetch content for a selected entry (works for both modes).
   */
  getEntryContent(entry: JobLogEntry): Observable<string> {
    if (entry.mode === 'jes') {
      return this.getJobSpoolContent(entry.fullPath);
    } else {
      return this.getDatasetMemberContent(entry.fullPath);
    }
  }

  /**
   * Get the default job prefix.
   */
  getDefaultJobPrefix(): string {
    return JobLogService.DEFAULT_JOB_PREFIX;
  }

  /**
   * Validate a dataset name per MVS naming rules.
   */
  validateDatasetName(name: string): string | null {
    if (!name || !name.trim()) {
      return 'Dataset name cannot be empty';
    }
    var trimmed = name.trim().toUpperCase();
    if (trimmed.length > 44) {
      return 'Dataset name cannot exceed 44 characters';
    }
    var pattern = /^[A-Z#@$][A-Z0-9#@$\-]{0,7}(\.[A-Z#@$][A-Z0-9#@$\-]{0,7})*$/;
    if (!pattern.test(trimmed)) {
      return 'Invalid MVS dataset name format';
    }
    return null;
  }
}

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/
