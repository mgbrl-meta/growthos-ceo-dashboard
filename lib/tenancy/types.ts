// ============================================================
// GROWTH OS TENANCY TYPES
// ============================================================


export type WorkspaceStatus =
  | 'active'
  | 'inactive'
  | 'suspended';


export type BrandStatus =
  | 'active'
  | 'inactive'
  | 'archived';


export type Workspace = {

  workspaceId: string;

  workspaceName: string;

  workspaceSlug: string;

  status: WorkspaceStatus;

};


export type Brand = {

  brandId: string;

  workspaceId: string;

  brandName: string;

  brandSlug: string;

  status: BrandStatus;

  currency: string;

  timezone: string;

};


export type TenantContext = {

  workspaceId: string;

  workspaceName: string;

  workspaceSlug: string;

  brandId: string;

  brandName: string;

  brandSlug: string;

  currency: string;

  timezone: string;

};