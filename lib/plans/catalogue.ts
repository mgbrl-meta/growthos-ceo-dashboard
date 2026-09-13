import 'server-only';

import {
  bigquery,
} from '@/lib/bigquery';

const PROJECT_ID =
  process.env.GCP_PROJECT_ID
  || process.env.BQ_PROJECT_ID
  || '';

const DATASET_ID =
  process.env.GROWTHOS_CONTROL_DATASET
  || 'growthos_control';

const LOCATION =
  process.env.GCP_BQ_LOCATION
  || 'asia-south1';

export type ClientPlanFeature = {
  moduleId: string;
  name: string;
  description: string | null;
};

export type ClientPlanCatalogueItem = {
  planId: string;
  name: string;
  description: string | null;
  status: string;
  monthlyOrderLimit: number | null;
  maxUsers: number | null;
  priceLabel: string | null;
  features: ClientPlanFeature[];
};

function requireProjectId() {
  if (!PROJECT_ID) {
    throw new Error('Growth OS plan catalogue requires GCP_PROJECT_ID or BQ_PROJECT_ID');
  }

  return PROJECT_ID;
}

// Client-safe plan catalogue.
// Commercial limits and included modules come directly from the Growth OS control plane.
// priceLabel stays nullable until Admin becomes the pricing source of truth.
export async function getClientPlanCatalogue(): Promise<ClientPlanCatalogueItem[]> {
  const projectId = requireProjectId();

  const [rows] = await bigquery.query({
    location: LOCATION,
    query: `
      SELECT
        p.plan_id,
        p.plan_name,
        p.description,
        p.status,
        p.monthly_order_limit,
        p.max_users,
        m.module_id,
        m.module_name,
        m.description AS module_description,
        m.category
      FROM \`${projectId}.${DATASET_ID}.plans\` AS p
      LEFT JOIN \`${projectId}.${DATASET_ID}.plan_modules\` AS pm
        ON pm.plan_id = p.plan_id
       AND COALESCE(pm.enabled, FALSE) = TRUE
      LEFT JOIN \`${projectId}.${DATASET_ID}.modules\` AS m
        ON m.module_id = pm.module_id
       AND LOWER(COALESCE(m.status, 'active')) = 'active'
      WHERE LOWER(COALESCE(p.status, 'active')) = 'active'
      ORDER BY
        CASE p.plan_id
          WHEN 'starter' THEN 1
          WHEN 'pro' THEN 2
          WHEN 'advanced' THEN 3
          WHEN 'enterprise' THEN 4
          ELSE 99
        END,
        p.monthly_order_limit,
        CASE m.category
          WHEN 'workspace' THEN 1
          WHEN 'growth' THEN 2
          WHEN 'customers' THEN 3
          WHEN 'commerce' THEN 4
          WHEN 'data' THEN 5
          WHEN 'system' THEN 6
          ELSE 99
        END,
        m.module_name
    `,
  });

  const planMap = new Map<string, ClientPlanCatalogueItem>();

  for (const row of (rows || []) as any[]) {
    const planId = String(row.plan_id || '').trim();
    if (!planId) continue;

    let plan = planMap.get(planId);
    if (!plan) {
      plan = {
        planId,
        name: String(row.plan_name || planId),
        description: row.description ?? null,
        status: String(row.status || 'active'),
        monthlyOrderLimit: row.monthly_order_limit ?? null,
        maxUsers: row.max_users ?? null,
        priceLabel: null,
        features: [],
      };
      planMap.set(planId, plan);
    }

    if (row.module_id) {
      plan.features.push({
        moduleId: String(row.module_id),
        name: String(row.module_name || row.module_id),
        description: row.module_description ?? null,
      });
    }
  }

  return Array.from(planMap.values());
}
