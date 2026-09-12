export type ClientEffectivePermission =
  | 'disabled'
  | 'viewer'
  | 'editor';


export type ClientEffectiveAccess = {

  role:
    string;

  workspaceId:
    string;

  brandId:
    string;

  modules:
    Record<
      string,
      {
        moduleId:
          string;

        routeKey:
          string | null;

        effectivePermission:
          ClientEffectivePermission;

        submodules:
          Record<
            string,
            {
              moduleId:
                string;

              submoduleId:
                string;

              label:
                string;

              effectivePermission:
                ClientEffectivePermission;
            }
          >;
      }
    >;
};
