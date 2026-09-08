'use client';

import {
  type ReactNode,
  useState,
} from 'react';

import {
  ChevronRight,
  Plus,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';

import {
  type AdminClient,
  type AdminUser,
  type UserModulePermission,
  type UserRole,
  type UserStatus,
  useAdminStore,
} from './AdminStore';


// ============================================================
// ROLE CONFIG
// ============================================================

const CLIENT_ROLES: {
  value: UserRole;
  label: string;
}[] = [

  {
    value:
      'client_owner',

    label:
      'Owner',
  },

  {
    value:
      'client_admin',

    label:
      'Admin',
  },

  {
    value:
      'manager',

    label:
      'Manager',
  },

  {
    value:
      'analyst',

    label:
      'Analyst',
  },

  {
    value:
      'operator',

    label:
      'Operator',
  },

  {
    value:
      'viewer',

    label:
      'Viewer',
  },

];


// ============================================================
// MAIN
// ============================================================

export default function AdminClientUsers({

  client,

}: {

  client:
    AdminClient;

}) {


  const {

    users,

    setUsers,

    modules,

    getPlan,

    getClientUsers,

    getClientUserCount,

    getClientModuleAccess,

    getUserModuleAccess,

  } =
    useAdminStore();


  // ==========================================================
  // LOCAL STATE
  // ==========================================================

  const [
    selectedUserId,
    setSelectedUserId,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    addOpen,
    setAddOpen,
  ] =
    useState(
      false
    );


  const [
    newName,
    setNewName,
  ] =
    useState(
      ''
    );


  const [
    newEmail,
    setNewEmail,
  ] =
    useState(
      ''
    );


  const [
    newRole,
    setNewRole,
  ] =
    useState<UserRole>(
      'viewer'
    );


  const [
    newStatus,
    setNewStatus,
  ] =
    useState<UserStatus>(
      'invited'
    );


  // ==========================================================
  // CLIENT DATA
  // ==========================================================

  const plan =
    getPlan(
      client.planId
    );


  const clientUsers =
    getClientUsers(
      client.id
    );


  const userCount =
    getClientUserCount(
      client.id
    );


  const userLimit =
    plan
      ?.maxUsers
    ??
    null;


  const atUserLimit =
    userLimit !==
      null
    &&
    userCount >=
      userLimit;


  const selectedUser =
    users.find(
      user =>
        user.id ===
        selectedUserId
      &&
        user.clientId ===
        client.id
    )
    ||
    null;


  // ==========================================================
  // CREATE USER
  // ==========================================================

  function createUser() {

    const name =
      newName.trim();


    const email =
      newEmail
        .trim()
        .toLowerCase();


    if (
      !name
      ||
      !email
      ||
      atUserLimit
    ) {

      return;

    }


    const idBase =
      email
        .replace(
          /[^a-z0-9]+/g,
          '-'
        )
        .replace(
          /^-|-$/g,
          ''
        );


    const user:
      AdminUser = {

      id:
        `${idBase}-${Date.now()}`,

      name,

      email,

      scope:
        'client',

      clientId:
        client.id,

      role:
        newRole,

      status:
        newStatus,

      modulePermissions:
        {},

      createdAt:
        new Date()
          .toLocaleDateString(
            'en-IN',
            {
              day:
                '2-digit',

              month:
                'short',

              year:
                'numeric',
            }
          ),

    };


    setUsers(
      previous => [
        user,
        ...previous,
      ]
    );


    resetForm();


    setAddOpen(
      false
    );


    setSelectedUserId(
      user.id
    );

  }


  // ==========================================================
  // UPDATE USER
  // ==========================================================

  function updateUser(
    updatedUser:
      AdminUser
  ) {

    setUsers(
      previous =>
        previous.map(
          user =>

            user.id ===
              updatedUser.id

              ? updatedUser

              : user
        )
    );

  }


  // ==========================================================
  // RESET
  // ==========================================================

  function resetForm() {

    setNewName(
      ''
    );


    setNewEmail(
      ''
    );


    setNewRole(
      'viewer'
    );


    setNewStatus(
      'invited'
    );

  }


  // ==========================================================
  // USER DETAIL
  // ==========================================================

  if (
    selectedUser
  ) {

    return (

      <ClientUserDetail

        user={
          selectedUser
        }

        client={
          client
        }

        onBack={() =>
          setSelectedUserId(
            null
          )
        }

        onChange={
          updateUser
        }

      />

    );

  }


  // ==========================================================
  // USER LIST
  // ==========================================================

  return (

    <div className="space-y-3">


      {/* =====================================================
          SUMMARY
      ===================================================== */}

      <section
        className="
          grid
          grid-cols-2
          gap-2

          md:grid-cols-4
        "
      >

        <SummaryCard

          label="Users"

          value={
            userCount
          }

        />


        <SummaryCard

          label="User Limit"

          value={
            userLimit ===
              null

              ? 'Unlimited'

              : userLimit
          }

        />


        <SummaryCard

          label="Active"

          value={
            clientUsers.filter(
              user =>
                user.status ===
                'active'
            ).length
          }

        />


        <SummaryCard

          label="Invited"

          value={
            clientUsers.filter(
              user =>
                user.status ===
                'invited'
            ).length
          }

        />

      </section>


      {/* =====================================================
          TOOLBAR
      ===================================================== */}

      <section
        className="
          gos-card

          flex
          items-center
          justify-between
          gap-3

          p-3
        "
      >

        <div>

          <h3
            className="
              text-[13px]
              font-semibold

              text-slate-950
            "
          >
            Workspace Users
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            {client.name}
            {' · '}
            {userCount}
            {' / '}
            {userLimit ===
              null

              ? 'Unlimited'

              : userLimit}
            {' users'}
          </p>

        </div>


        <button

          type="button"

          disabled={
            atUserLimit
          }

          onClick={() =>
            setAddOpen(
              true
            )
          }

          className="
            inline-flex
            h-8
            items-center
            gap-1.5

            rounded-[8px]

            bg-slate-950

            px-3

            text-[10px]
            font-semibold

            text-white

            disabled:cursor-not-allowed
            disabled:opacity-40
          "
        >

          <Plus
            size={14}
          />

          Add User

        </button>

      </section>


      {/* =====================================================
          LIMIT WARNING
      ===================================================== */}

      {atUserLimit && (

        <section
          className="
            rounded-[10px]

            border
            border-amber-200

            bg-amber-50

            px-3
            py-2.5
          "
        >

          <p
            className="
              text-[10px]
              font-semibold

              text-amber-800
            "
          >
            User limit reached
          </p>


          <p
            className="
              mt-0.5

              text-[9px]

              text-amber-700
            "
          >
            {plan?.name || 'Current plan'} allows {userLimit} users. Change the plan or user limit before adding another user.
          </p>

        </section>

      )}


      {/* =====================================================
          USER TABLE
      ===================================================== */}

      <section className="gos-panel !p-0">

        <div className="overflow-x-auto">

          <table
            className="
              min-w-[900px]
              w-full

              border-collapse
            "
          >

            <thead>

              <tr
                className="
                  border-b
                  border-slate-200

                  bg-slate-50
                "
              >

                <TableHeader>
                  User
                </TableHeader>

                <TableHeader>
                  Role
                </TableHeader>

                <TableHeader>
                  Status
                </TableHeader>

                <TableHeader>
                  Module Access
                </TableHeader>

                <TableHeader>
                  Overrides
                </TableHeader>

                <TableHeader>
                  Created
                </TableHeader>

                <TableHeader align="right">
                  Action
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {clientUsers.map(
                user => {

                  const moduleAccess =
                    modules.filter(
                      module =>
                        getUserModuleAccess(
                          user,
                          module.id
                        ).enabled
                    ).length;


                  const overrideCount =
                    Object
                      .values(
                        user.modulePermissions
                      )
                      .filter(
                        value =>
                          value !==
                          'inherit'
                      )
                      .length;


                  return (

                    <tr
                      key={
                        user.id
                      }

                      className="
                        border-b
                        border-slate-100

                        last:border-0

                        hover:bg-slate-50/70
                      "
                    >

                      <td className="px-3 py-2">

                        <div
                          className="
                            flex
                            items-center
                            gap-2.5
                          "
                        >

                          <div
                            className="
                              flex
                              h-8
                              w-8
                              shrink-0
                              items-center
                              justify-center

                              rounded-[8px]

                              bg-blue-50

                              text-blue-600
                            "
                          >

                            <UserRound
                              size={15}
                            />

                          </div>


                          <div className="min-w-0">

                            <div
                              className="
                                text-[11px]
                                font-semibold

                                text-slate-900
                              "
                            >
                              {user.name}
                            </div>


                            <div
                              className="
                                mt-0.5

                                max-w-[260px]

                                truncate

                                text-[9px]

                                text-slate-500
                              "
                            >
                              {user.email}
                            </div>

                          </div>

                        </div>

                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[10px]
                          font-medium

                          text-slate-700
                        "
                      >
                        {formatRole(
                          user.role
                        )}
                      </td>


                      <td className="px-3 py-2">

                        <UserStatusBadge
                          status={
                            user.status
                          }
                        />

                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[10px]
                          font-semibold

                          text-slate-800
                        "
                      >
                        {moduleAccess}
                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[10px]
                          font-semibold

                          text-slate-800
                        "
                      >
                        {overrideCount}
                      </td>


                      <td
                        className="
                          px-3
                          py-2

                          text-[9px]

                          text-slate-500
                        "
                      >
                        {user.createdAt}
                      </td>


                      <td className="px-3 py-2 text-right">

                        <button

                          type="button"

                          onClick={() =>
                            setSelectedUserId(
                              user.id
                            )
                          }

                          className="
                            inline-flex
                            h-7
                            items-center
                            gap-1

                            rounded-[7px]

                            border
                            border-slate-200

                            bg-white

                            px-2.5

                            text-[9px]
                            font-semibold

                            text-slate-700

                            hover:bg-slate-50
                          "
                        >

                          Manage

                          <ChevronRight
                            size={12}
                          />

                        </button>

                      </td>

                    </tr>

                  );

                }
              )}


              {clientUsers.length ===
                0 && (

                <tr>

                  <td
                    colSpan={
                      7
                    }

                    className="
                      px-4
                      py-10

                      text-center

                      text-[10px]

                      text-slate-500
                    "
                  >
                    No users have been added to this client.
                  </td>

                </tr>

              )}

            </tbody>

          </table>

        </div>

      </section>


      {/* =====================================================
          ADD USER MODAL
      ===================================================== */}

      {addOpen && (

        <div
          className="
            fixed
            inset-0
            z-[100]

            flex
            items-center
            justify-center

            bg-slate-950/40

            p-4

            backdrop-blur-[2px]
          "
        >

          <div
            className="
              w-full
              max-w-[540px]

              rounded-[14px]

              border
              border-slate-200

              bg-white

              shadow-xl
            "
          >

            <div
              className="
                flex
                items-center
                justify-between

                border-b
                border-slate-200

                px-4
                py-3
              "
            >

              <div>

                <h3
                  className="
                    text-[14px]
                    font-semibold

                    text-slate-950
                  "
                >
                  Add User
                </h3>


                <p
                  className="
                    mt-0.5

                    text-[9px]

                    text-slate-500
                  "
                >
                  Add a user directly to {client.name}.
                </p>

              </div>


              <button

                type="button"

                onClick={() => {

                  setAddOpen(
                    false
                  );


                  resetForm();

                }}

                className="
                  flex
                  h-7
                  w-7
                  items-center
                  justify-center

                  rounded-[7px]

                  text-slate-400

                  hover:bg-slate-100
                "
              >

                <X
                  size={15}
                />

              </button>

            </div>


            <div className="space-y-3 p-4">


              <FormField
                label="Name"
              >

                <input

                  value={
                    newName
                  }

                  onChange={
                    event =>
                      setNewName(
                        event.target.value
                      )
                  }

                  placeholder="User name"

                  className="gos-input w-full"

                />

              </FormField>


              <FormField
                label="Email"
              >

                <input

                  type="email"

                  value={
                    newEmail
                  }

                  onChange={
                    event =>
                      setNewEmail(
                        event.target.value
                      )
                  }

                  placeholder="name@company.com"

                  className="gos-input w-full"

                />

              </FormField>


              <div
                className="
                  grid
                  grid-cols-1
                  gap-3

                  md:grid-cols-2
                "
              >

                <FormField
                  label="Role"
                >

                  <select

                    value={
                      newRole
                    }

                    onChange={
                      event =>
                        setNewRole(
                          event.target.value as UserRole
                        )
                    }

                    className="gos-input w-full"

                  >

                    {CLIENT_ROLES.map(
                      role => (

                        <option
                          key={
                            role.value
                          }
                          value={
                            role.value
                          }
                        >
                          {role.label}
                        </option>

                      )
                    )}

                  </select>

                </FormField>


                <FormField
                  label="Status"
                >

                  <select

                    value={
                      newStatus
                    }

                    onChange={
                      event =>
                        setNewStatus(
                          event.target.value as UserStatus
                        )
                    }

                    className="gos-input w-full"

                  >

                    <option value="invited">
                      Invited
                    </option>

                    <option value="active">
                      Active
                    </option>

                    <option value="suspended">
                      Suspended
                    </option>

                  </select>

                </FormField>

              </div>

            </div>


            <div
              className="
                flex
                justify-end
                gap-2

                border-t
                border-slate-200

                px-4
                py-3
              "
            >

              <button

                type="button"

                onClick={() => {

                  setAddOpen(
                    false
                  );


                  resetForm();

                }}

                className="
                  h-8

                  rounded-[8px]

                  border
                  border-slate-200

                  px-3

                  text-[10px]
                  font-semibold

                  text-slate-600
                "
              >
                Cancel
              </button>


              <button

                type="button"

                disabled={
                  !newName.trim()
                  ||
                  !newEmail.trim()
                  ||
                  atUserLimit
                }

                onClick={
                  createUser
                }

                className="
                  h-8

                  rounded-[8px]

                  bg-slate-950

                  px-3

                  text-[10px]
                  font-semibold

                  text-white

                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >
                Add User
              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}


// ============================================================
// CLIENT USER DETAIL
// ============================================================

function ClientUserDetail({

  user,

  client,

  onBack,

  onChange,

}: {

  user:
    AdminUser;

  client:
    AdminClient;

  onBack:
    () => void;

  onChange:
    (
      user:
        AdminUser
    ) => void;

}) {


  const {

    modules,

    getClientModuleAccess,

    getUserModuleAccess,

  } =
    useAdminStore();


  // ==========================================================
  // MODULE PERMISSION
  // ==========================================================

  function setModulePermission(

    moduleId:
      string,

    permission:
      UserModulePermission

  ) {

    if (
      permission ===
      'inherit'
    ) {

      const next = {
        ...user.modulePermissions,
      };


      delete next[
        moduleId
      ];


      onChange({

        ...user,

        modulePermissions:
          next,

      });


      return;

    }


    onChange({

      ...user,

      modulePermissions: {

        ...user.modulePermissions,

        [moduleId]:
          permission,

      },

    });

  }


  const finalModuleCount =
    modules.filter(
      module =>
        getUserModuleAccess(
          user,
          module.id
        ).enabled
    ).length;


  // ==========================================================
  // UI
  // ==========================================================

  return (

    <div className="space-y-3">


      <section className="gos-panel !p-3">

        <div
          className="
            flex
            flex-col
            gap-3

            md:flex-row
            md:items-center
            md:justify-between
          "
        >

          <div
            className="
              flex
              items-center
              gap-3
            "
          >

            <button

              type="button"

              onClick={
                onBack
              }

              className="
                flex
                h-8
                w-8
                items-center
                justify-center

                rounded-[8px]

                border
                border-slate-200

                bg-white

                text-slate-500
              "
            >
              ←
            </button>


            <div
              className="
                flex
                h-9
                w-9
                items-center
                justify-center

                rounded-[9px]

                bg-blue-50

                text-blue-600
              "
            >

              <ShieldCheck
                size={17}
              />

            </div>


            <div>

              <h3
                className="
                  text-[14px]
                  font-semibold

                  text-slate-950
                "
              >
                {user.name}
              </h3>


              <p
                className="
                  mt-0.5

                  text-[9px]

                  text-slate-500
                "
              >
                {user.email}
                {' · '}
                {client.name}
              </p>

            </div>

          </div>


          <select

            value={
              user.status
            }

            onChange={
              event =>
                onChange({

                  ...user,

                  status:
                    event.target.value as UserStatus,

                })
            }

            className="gos-input"
          >

            <option value="active">
              Active
            </option>

            <option value="invited">
              Invited
            </option>

            <option value="suspended">
              Suspended
            </option>

          </select>

        </div>

      </section>


      <section
        className="
          grid
          grid-cols-2
          gap-2

          md:grid-cols-4
        "
      >

        <SummaryCard
          label="Role"
          value={
            formatRole(
              user.role
            )
          }
        />


        <SummaryCard
          label="Modules"
          value={
            finalModuleCount
          }
        />


        <SummaryCard
          label="Status"
          value={
            formatStatus(
              user.status
            )
          }
        />


        <SummaryCard
          label="Overrides"
          value={
            Object.keys(
              user.modulePermissions
            ).length
          }
        />

      </section>


      {/* =====================================================
          ROLE
      ===================================================== */}

      <section className="gos-panel !p-3.5">

        <h3 className="gos-section-title">
          User Settings
        </h3>


        <div
          className="
            mt-3

            grid
            grid-cols-1
            gap-3

            md:grid-cols-2
          "
        >

          <FormField
            label="Name"
          >

            <input

              value={
                user.name
              }

              onChange={
                event =>
                  onChange({

                    ...user,

                    name:
                      event.target.value,

                  })
              }

              className="gos-input w-full"

            />

          </FormField>


          <FormField
            label="Role"
          >

            <select

              value={
                user.role
              }

              onChange={
                event =>
                  onChange({

                    ...user,

                    role:
                      event.target.value as UserRole,

                  })
              }

              className="gos-input w-full"

            >

              {CLIENT_ROLES.map(
                role => (

                  <option
                    key={
                      role.value
                    }
                    value={
                      role.value
                    }
                  >
                    {role.label}
                  </option>

                )
              )}

            </select>

          </FormField>

        </div>

      </section>


      {/* =====================================================
          MODULE PERMISSION
      ===================================================== */}

      <section className="gos-panel !p-0">

        <div
          className="
            border-b
            border-slate-200

            px-3
            py-2.5
          "
        >

          <h3 className="gos-section-title">
            Module Permission
          </h3>


          <p
            className="
              mt-0.5

              text-[9px]

              text-slate-500
            "
          >
            User access cannot exceed this client's module entitlement.
          </p>

        </div>


        <div className="overflow-x-auto">

          <table
            className="
              min-w-[850px]
              w-full

              border-collapse
            "
          >

            <thead>

              <tr
                className="
                  border-b
                  border-slate-200

                  bg-slate-50
                "
              >

                <TableHeader>
                  Module
                </TableHeader>

                <TableHeader>
                  Client Access
                </TableHeader>

                <TableHeader>
                  User Permission
                </TableHeader>

                <TableHeader>
                  Final Access
                </TableHeader>

              </tr>

            </thead>


            <tbody>

              {modules.map(
                module => {

                  const clientAccess =
                    getClientModuleAccess(
                      client,
                      module.id
                    );


                  const userAccess =
                    getUserModuleAccess(
                      user,
                      module.id
                    );


                  return (

                    <tr
                      key={
                        module.id
                      }

                      className="
                        border-b
                        border-slate-100

                        last:border-0
                      "
                    >

                      <td
                        className="
                          px-3
                          py-2

                          text-[10px]
                          font-semibold

                          text-slate-900
                        "
                      >
                        {module.name}
                      </td>


                      <td className="px-3 py-2">

                        <AccessBadge
                          enabled={
                            clientAccess.enabled
                          }
                        />

                      </td>


                      <td className="px-3 py-2">

                        <select

                          value={
                            userAccess.permission
                          }

                          onChange={
                            event =>
                              setModulePermission(
                                module.id,
                                event.target.value as UserModulePermission
                              )
                          }

                          className="
                            h-7

                            rounded-[7px]

                            border
                            border-slate-300

                            bg-white

                            px-2

                            text-[9px]
                          "
                        >

                          <option value="inherit">
                            Inherit Client
                          </option>


                          <option
                            value="enabled"

                            disabled={
                              !clientAccess.enabled
                            }
                          >
                            Allow
                          </option>


                          <option value="disabled">
                            Deny
                          </option>

                        </select>

                      </td>


                      <td className="px-3 py-2">

                        <AccessBadge
                          enabled={
                            userAccess.enabled
                          }
                        />

                      </td>

                    </tr>

                  );

                }
              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>

  );

}


// ============================================================
// SMALL COMPONENTS
// ============================================================

function SummaryCard({

  label,

  value,

}: {

  label:
    string;

  value:
    string |
    number;

}) {

  return (

    <div
      className="
        gos-card

        min-h-[66px]

        px-3
        py-2.5
      "
    >

      <p className="gos-label">
        {label}
      </p>


      <p
        className="
          mt-1.5

          text-[18px]
          font-semibold
          tracking-[-0.03em]

          text-slate-950
        "
      >
        {value}
      </p>

    </div>

  );

}


function AccessBadge({

  enabled,

}: {

  enabled:
    boolean;

}) {

  return (

    <span
      className={`
        inline-flex

        rounded-full

        border

        px-2
        py-0.5

        text-[8px]
        font-semibold

        ${
          enabled

            ? `
              border-emerald-200
              bg-emerald-50
              text-emerald-700
            `

            : `
              border-slate-200
              bg-slate-100
              text-slate-500
            `
        }
      `}
    >
      {enabled
        ? 'Enabled'
        : 'Disabled'}
    </span>

  );

}


function UserStatusBadge({

  status,

}: {

  status:
    UserStatus;

}) {

  const cls =
    status ===
      'active'

      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'

      : status ===
          'invited'

        ? 'border-blue-200 bg-blue-50 text-blue-700'

        : 'border-red-200 bg-red-50 text-red-700';


  return (

    <span
      className={`
        inline-flex

        rounded-full

        border

        px-2
        py-0.5

        text-[8px]
        font-semibold

        ${cls}
      `}
    >
      {formatStatus(
        status
      )}
    </span>

  );

}


function FormField({

  label,

  children,

}: {

  label:
    string;

  children:
    ReactNode;

}) {

  return (

    <label className="block">

      <span
        className="
          mb-1.5
          block

          text-[9px]
          font-semibold
          uppercase
          tracking-[0.05em]

          text-slate-500
        "
      >
        {label}
      </span>


      {children}

    </label>

  );

}


function TableHeader({

  children,

  align =
    'left',

}: {

  children:
    ReactNode;

  align?:
    'left'
    |
    'right';

}) {

  return (

    <th
      className={`
        h-8

        px-3

        text-[9px]
        font-semibold
        uppercase
        tracking-[0.05em]

        text-slate-500

        ${
          align ===
            'right'

            ? 'text-right'

            : 'text-left'
        }
      `}
    >
      {children}
    </th>

  );

}


// ============================================================
// HELPERS
// ============================================================

function formatRole(
  role:
    UserRole
) {

  const labels:
    Record<
      UserRole,
      string
    > = {

    platform_admin:
      'Platform Admin',

    client_owner:
      'Owner',

    client_admin:
      'Admin',

    manager:
      'Manager',

    analyst:
      'Analyst',

    operator:
      'Operator',

    viewer:
      'Viewer',

  };


  return labels[
    role
  ];

}


function formatStatus(
  status:
    UserStatus
) {

  if (
    status ===
    'active'
  ) {

    return 'Active';

  }


  if (
    status ===
    'invited'
  ) {

    return 'Invited';

  }


  return 'Suspended';

}