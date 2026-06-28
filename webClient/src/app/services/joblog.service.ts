

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html

  SPDX-License-Identifier: EPL-2.0

  Copyright Contributors to the Zowe Project.
*/

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

/**
 * Production-grade Job Log Service for Zowe Desktop.
 *
 * Fetches z/OSMF installation logs (RSOMGR.JOBLOG.*) using the same
 * ZSS dataset APIs that zlux-editor uses:
 *
 *   ZoweZLUX.uriBroker.datasetMetadataUri(dsName, detail, types, listMembers)
 *     → Lists PDS members (returns { datasets: [{ name, members: [...] }] })
 *
 *   ZoweZLUX.uriBroker.datasetContentsUri(fullName)
 *     → Returns dataset contents as { records: string[], etag: string }
 *
 * These route through the ZSS agent which handles:
 *   - SAF authentication (same session as Desktop login)
 *   - RACF authorization (user must have READ access to the dataset)
 *   - EBCDIC→ASCII conversion
 *
 * Security:
 *   - No credentials stored or transmitted by this service
 *   - Dataset name is user-configurable (not hardcoded)
 *   - SAF controls which datasets the logged-in user can access
 *   - No sensitive data cached beyond the component lifecycle
 */

// ═══════════ Interfaces ═══════════

export interface DatasetMember {
  name: string;
}

export interface DatasetMetadataResponse {
  datasets: Array<{
    name: string;
    csiEntryType?: string;
    dsorg?: { isPDSDir?: boolean; totalBlockSize?: number };
    recfm?: { V?: boolean; B?: boolean; F?: boolean };
    volser?: string;
    members?: DatasetMember[];
  }>;
}

export interface DatasetContentsResponse {
  records: string[];
  etag?: string;
}

export interface JobLogEntry {
  memberName: string;
  datasetName: string;
  fullPath: string;
}

export interface JobLogResult {
  entries: JobLogEntry[];
  content: string | null;
  selectedMember: string | null;
  error: string | null;
  loading: boolean;
}

// ═══════════ Service ═══════════

@Injectable()
export class JobLogService {

  // Default dataset pattern for z/OSMF installation logs
  private static readonly DEFAULT_DATASET_PATTERN = 'RSOMGR.JOBLOG';

  constructor(
    private http: HttpClient
  ) {}

  /**
   * List members of a PDS dataset.
   * Uses ZoweZLUX.uriBroker.datasetMetadataUri same as zlux-editor.
   *
   * @param datasetName - PDS name (e.g., "RSOMGR.JOBLOG")
   * @returns Observable of members array sorted by name descending (most recent first)
   */
  listMembers(datasetName: string): Observable<JobLogEntry[]> {
    if (!datasetName || !datasetName.trim()) {
      return of([]);
    }

    const dsName = datasetName.trim().toUpperCase();

    let requestUrl: string;
    try {
      // Same pattern as zlux-editor project-tree.component.ts line 58:
      // ZoweZLUX.uriBroker.datasetMetadataUri(node.data.path.trim(), undefined, undefined, true)
      requestUrl = ZoweZLUX.uriBroker.datasetMetadataUri(
        encodeURIComponent(dsName), undefined, undefined, true
      );
    } catch (e) {
      return of([]);
    }

    return this.http.get<DatasetMetadataResponse>(requestUrl).pipe(
      map((response: DatasetMetadataResponse) => {
        if (!response || !response.datasets || response.datasets.length === 0) {
          return [];
        }

        const ds = response.datasets[0];
        if (!ds.members || ds.members.length === 0) {
          return [];
        }

        // Build entries and sort by name descending (most recent job log first)
        const entries: JobLogEntry[] = ds.members.map(m => ({
          memberName: m.name.trim(),
          datasetName: ds.name.trim(),
          fullPath: ds.name.trim() + '(' + m.name.trim() + ')'
        }));

        // Sort descending by member name (job logs are typically named with
        // timestamps or incrementing IDs, so descending = most recent)
        entries.sort((a, b) => {
          if (a.memberName > b.memberName) return -1;
          if (a.memberName < b.memberName) return 1;
          return 0;
        });

        return entries;
      }),
      catchError((err) => {
        console.error('JobLog: Failed to list members for ' + dsName, err);
        return of([]);
      })
    );
  }

  /**
   * Fetch the content of a specific dataset member.
   * Uses ZoweZLUX.uriBroker.datasetContentsUri same as zlux-editor.
   *
   * @param fullPath - Full dataset path (e.g., "RSOMGR.JOBLOG(MEMBER1)")
   * @returns Observable of the text content as a single string
   */
  getMemberContent(fullPath: string): Observable<string> {
    if (!fullPath || !fullPath.trim()) {
      return of('');
    }

    let requestUrl: string;
    try {
      // Same pattern as zlux-editor editor-control.service.ts line 686:
      // ZoweZLUX.uriBroker.datasetContentsUri(fullName)
      requestUrl = ZoweZLUX.uriBroker.datasetContentsUri(fullPath.trim());
    } catch (e) {
      return of('Error: Unable to construct dataset URI. ZSS agent may not be available.');
    }

    return this.http.get<DatasetContentsResponse>(requestUrl).pipe(
      map((response: DatasetContentsResponse) => {
        if (!response || !response.records) {
          return '';
        }
        // Join records into a single text block, trimming trailing whitespace per line
        return response.records
          .map(record => record.replace(/\s+$/, ''))
          .join('\n');
      }),
      catchError((err) => {
        const status = err.status || 'Unknown';
        const msg = err.error || err.message || 'Unknown error';
        if (status === 403) {
          return of('Error: Access denied. Your user does not have READ access to this dataset.\n' +
            'Contact your system administrator to grant RACF READ access.');
        }
        if (status === 404) {
          return of('Error: Dataset or member not found. It may have been deleted or archived.');
        }
        if (status === 0) {
          return of('Error: Unable to reach the ZSS agent. The agent may be down or unreachable.');
        }
        return of('Error (' + status + '): ' + msg);
      })
    );
  }

  /**
   * Convenience: list members and auto-fetch the most recent one.
   */
  getMostRecentJobLog(datasetName: string): Observable<{ entries: JobLogEntry[]; content: string; selectedMember: string | null }> {
    return new Observable(observer => {
      this.listMembers(datasetName).subscribe(
        entries => {
          if (entries.length === 0) {
            observer.next({ entries: [], content: '', selectedMember: null });
            observer.complete();
            return;
          }

          const mostRecent = entries[0]; // Already sorted descending
          this.getMemberContent(mostRecent.fullPath).subscribe(
            content => {
              observer.next({ entries, content, selectedMember: mostRecent.memberName });
              observer.complete();
            },
            err => {
              observer.next({ entries, content: 'Error fetching content', selectedMember: mostRecent.memberName });
              observer.complete();
            }
          );
        },
        err => {
          observer.next({ entries: [], content: 'Error listing members', selectedMember: null });
          observer.complete();
        }
      );
    });
  }

  /**
   * Get the default dataset pattern.
   */
  getDefaultDatasetPattern(): string {
    return JobLogService.DEFAULT_DATASET_PATTERN;
  }

  /**
   * Validate a dataset name per MVS naming rules.
   * Returns null if valid, or an error message string.
   */
  validateDatasetName(name: string): string | null {
    if (!name || !name.trim()) {
      return 'Dataset name cannot be empty';
    }
    const trimmed = name.trim().toUpperCase();
    if (trimmed.length > 44) {
      return 'Dataset name cannot exceed 44 characters';
    }
    // Basic MVS dataset name validation
    const pattern = /^[A-Z#@$][A-Z0-9#@$\-]{0,7}(\.[A-Z#@$][A-Z0-9#@$\-]{0,7})*$/;
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
