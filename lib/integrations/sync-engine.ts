import {
  getProvider,
} from './provider-registry';

import {
  registerBuiltInProviders,
} from './providers';

import {
  createSyncRunId,
  startSyncRun,
  completeSyncRun,
  failSyncRun,
  getSyncState,
  markSyncStateSuccess,
  markSyncStateFailure,
} from './sync-store';

import type {
  SyncType,
} from './provider';


// ============================================================
// RUN SYNC
//
// Generic orchestration.
//
// Provider-specific logic stays inside provider adapters.
// ============================================================

export async function runIntegrationSync(
  input: {

    workspaceId: string;

    brandId: string;

    connectionId: string;

    providerId: string;

    providerAccountId?: string | null;

    entity: string;

    syncType: SyncType;

    startDate?: string | null;

    endDate?: string | null;

  }
) {

  registerBuiltInProviders();


  const provider =
    getProvider(
      input.providerId
    );


  if (
    !provider.entities.includes(
      input.entity
    )
  ) {

    throw new Error(
      `${input.entity} is not supported by ${provider.name}`
    );

  }


  const state =
    await getSyncState({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      connectionId:
        input.connectionId,

      provider:
        input.providerId,

      entity:
        input.entity,

    });


  const runId =
    createSyncRunId();


  const cursorBefore =
    state?.cursor
    ?
      String(
        state.cursor
      )
    :
      null;


  await startSyncRun({

    runId,

    workspaceId:
      input.workspaceId,

    brandId:
      input.brandId,

    connectionId:
      input.connectionId,

    provider:
      input.providerId,

    entity:
      input.entity,

    syncType:
      input.syncType,

    sourceStartAt:
      input.startDate,

    sourceEndAt:
      input.endDate,

    cursorBefore,

  });


  try {

    const context = {

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      connectionId:
        input.connectionId,

      providerAccountId:
        input.providerAccountId
        ??
        null,

      entity:
        input.entity,

      syncType:
        input.syncType,

      startDate:
        input.startDate
        ??
        null,

      endDate:
        input.endDate
        ??
        null,

      cursor:
        cursorBefore,

    };


    const result =
      input.syncType ===
      'backfill'

        ? await provider.backfill(
            context
          )

        : await provider.sync(
            context
          );


    if (
      result.status ===
      'failed'
    ) {

      throw new Error(
        `Provider returned failed status for ${input.providerId}/${input.entity}`
      );

    }


    await completeSyncRun({

      runId,

      status:
        result.status ===
        'partial'
          ? 'partial'
          : 'success',

      recordsFetched:
        result.recordsFetched,

      recordsLoaded:
        result.recordsLoaded,

      recordsRejected:
        result.recordsRejected,

      cursorAfter:
        result.cursorAfter
        ??
        cursorBefore,

    });


    await markSyncStateSuccess({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      connectionId:
        input.connectionId,

      provider:
        input.providerId,

      entity:
        input.entity,

      syncType:
        input.syncType,

      cursor:
        result.cursorAfter
        ??
        cursorBefore,

      latestSourceTimestamp:
        result.latestSourceTimestamp
        ??
        null,

    });


    return {

      ok:
        true,

      runId,

      provider:
        input.providerId,

      entity:
        input.entity,

      syncType:
        input.syncType,

      result,

    };


  } catch (
    error: any
  ) {

    const message =
      error?.message
      ||
      'Integration sync failed';


    await failSyncRun({

      runId,

      errorCode:
        error?.code
        ?
          String(
            error.code
          )
        :
          null,

      errorMessage:
        message,

    });


    await markSyncStateFailure({

      workspaceId:
        input.workspaceId,

      brandId:
        input.brandId,

      connectionId:
        input.connectionId,

      provider:
        input.providerId,

      entity:
        input.entity,

      errorMessage:
        message,

    });


    throw error;

  }

}