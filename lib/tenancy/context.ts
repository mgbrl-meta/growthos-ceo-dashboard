import {
  bigquery,
} from '@/lib/bigquery';

import type {
  TenantContext,
} from './types';


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ID =
  process.env.GCP_PROJECT_ID
  ||
  process.env.BQ_PROJECT_ID
  ||
  '';


const DATASET_ID =
  process.env.GROWTHOS_CONTROL_DATASET
  ||
  'growthos_control';


// ============================================================
// INTERNAL VALIDATION
// ============================================================

function requireProjectId() {

  if (!PROJECT_ID) {

    throw new Error(
      'Tenant context requires GCP_PROJECT_ID or BQ_PROJECT_ID'
    );

  }


  return PROJECT_ID;

}


// ============================================================
// RESOLVE TENANT BY IDS
//
// Canonical resolver when workspace + brand identity is
// already known.
//
// Used by:
//
// authenticated Growth OS users
// Shopify installation mapping
// future Google / Meta account mapping
// admin workflows
// ============================================================

export async function resolveTenantContextById(
  workspaceId: string,
  brandId: string
):
  Promise<TenantContext> {

  const projectId =
    requireProjectId();


  const normalizedWorkspaceId =
    String(
      workspaceId
      ||
      ''
    ).trim();


  const normalizedBrandId =
    String(
      brandId
      ||
      ''
    ).trim();


  if (
    !normalizedWorkspaceId
    ||
    !normalizedBrandId
  ) {

    throw new Error(
      'Workspace and brand identity are required'
    );

  }


  const query = `

    SELECT

      w.workspace_id,
      w.workspace_name,
      w.workspace_slug,

      b.brand_id,
      b.brand_name,
      b.brand_slug,

      b.currency,
      b.timezone

    FROM
      \`${projectId}.${DATASET_ID}.workspaces\`
      AS w

    JOIN
      \`${projectId}.${DATASET_ID}.brands\`
      AS b

      ON
        b.workspace_id =
        w.workspace_id

    WHERE

      w.workspace_id =
        @workspace_id

      AND b.brand_id =
        @brand_id

      AND w.status =
        'active'

      AND b.status =
        'active'

    LIMIT 1

  `;


  const [
    rows,
  ] =
    await bigquery.query({

      query,

      params: {

        workspace_id:
          normalizedWorkspaceId,

        brand_id:
          normalizedBrandId,

      },

    });


  const row =
    rows?.[0];


  if (!row) {

    throw new Error(
      `Growth OS tenant could not be resolved: ${normalizedWorkspaceId}/${normalizedBrandId}`
    );

  }


  return {

    workspaceId:
      String(
        row.workspace_id
      ),

    workspaceName:
      String(
        row.workspace_name
      ),

    workspaceSlug:
      String(
        row.workspace_slug
      ),

    brandId:
      String(
        row.brand_id
      ),

    brandName:
      String(
        row.brand_name
      ),

    brandSlug:
      String(
        row.brand_slug
      ),

    currency:
      String(
        row.currency
        ||
        'INR'
      ),

    timezone:
      String(
        row.timezone
        ||
        'Asia/Kolkata'
      ),

  };

}


// ============================================================
// CURRENT TENANT CONTEXT
//
// CURRENT DEVELOPMENT:
//
// environment defaults
//        ↓
// resolveTenantContextById()
//
// FUTURE:
//
// authenticated user
//        ↓
// workspace membership
//        ↓
// selected workspace + brand
//
// API consumers should not need to know where tenant identity
// came from.
// ============================================================

export async function resolveTenantContext():
  Promise<TenantContext> {

  requireProjectId();


  const workspaceId =
    String(
      process.env.GROWTHOS_DEFAULT_WORKSPACE_ID
      ||
      ''
    ).trim();


  const brandId =
    String(
      process.env.GROWTHOS_DEFAULT_BRAND_ID
      ||
      ''
    ).trim();


  if (
    !workspaceId
    ||
    !brandId
  ) {

    throw new Error(
      'Default Growth OS tenant is not configured'
    );

  }


  return resolveTenantContextById(
    workspaceId,
    brandId
  );

}