import fs from 'fs';
import path from 'path';

import {
  auditWarehouse,
} from './auditor';


// ============================================================
// TYPES
// ============================================================

export type TableReference = {

  projectId:
    string;

  datasetId:
    string;

  tableId:
    string;

  fullName:
    string;

  file:
    string;

  line:
    number;

  snippet:
    string;

};


export type TableLineageSummary = {

  projectId:
    string;

  datasetId:
    string;

  tableId:
    string;

  fullName:
    string;

  referenceCount:
    number;

  files:
    string[];

  references:
    TableReference[];

};


// ============================================================
// CONFIG
// ============================================================

const PROJECT_ROOT =
  process.cwd();


const INCLUDED_EXTENSIONS =
  new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.sql',
    '.py',
  ]);


const EXCLUDED_FOLDERS =
  new Set([
    'node_modules',
    '.next',
    '.git',
    'dist',
    'build',
    '.vercel',
    '__pycache__',
  ]);


// ============================================================
// FILE DISCOVERY
// ============================================================

function walk(
  directory: string
): string[] {

  const output:
    string[] = [];


  const entries =
    fs.readdirSync(
      directory,
      {
        withFileTypes:
          true,
      }
    );


  for (
    const entry
    of entries
  ) {

    if (
      EXCLUDED_FOLDERS.has(
        entry.name
      )
    ) {

      continue;

    }


    const absolute =
      path.join(
        directory,
        entry.name
      );


    if (
      entry.isDirectory()
    ) {

      output.push(
        ...walk(
          absolute
        )
      );

      continue;

    }


    const extension =
      path.extname(
        entry.name
      );


    if (
      INCLUDED_EXTENSIONS.has(
        extension
      )
    ) {

      output.push(
        absolute
      );

    }

  }


  return output;

}


// ============================================================
// RELATIVE FILE PATH
// ============================================================

function relativePath(
  file: string
) {

  return path
    .relative(
      PROJECT_ROOT,
      file
    )
    .replaceAll(
      '\\',
      '/'
    );

}


// ============================================================
// LINEAGE SCAN
//
// IMPORTANT:
//
// Warehouse Audit provides the list of tables that actually
// exist.
//
// Repository scanning is therefore allowed to identify only
// those physical tables.
//
// This prevents false positives from arbitrary dotted strings.
// ============================================================

export async function scanWarehouseLineage() {

  // ==========================================================
  // PHYSICAL WAREHOUSE
  // ==========================================================

  const warehouse =
    await auditWarehouse();


  const physicalTables =
    warehouse.datasets.flatMap(
      dataset =>
        dataset.tables.map(
          table => ({

            projectId:
              table.projectId,

            datasetId:
              table.datasetId,

            tableId:
              table.tableId,

            fullName:
              `${table.projectId}.${table.datasetId}.${table.tableId}`,

            partialName:
              `${table.datasetId}.${table.tableId}`,

          })
        )
    );


  // ==========================================================
  // LOOKUP MAPS
  // ==========================================================

  const fullLookup =
    new Map(
      physicalTables.map(
        table => [
          table.fullName,
          table,
        ]
      )
    );


  const partialLookup =
    new Map(
      physicalTables.map(
        table => [
          table.partialName,
          table,
        ]
      )
    );


  // ==========================================================
  // DISCOVER SOURCE FILES
  // ==========================================================

  const files =
    walk(
      PROJECT_ROOT
    );


  const references:
    TableReference[] = [];


  // ==========================================================
  // PATTERNS
  // ==========================================================

  const fullRegex =
    /([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)/g;


  const partialRegex =
    /([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)/g;


  // ==========================================================
  // SCAN FILES
  // ==========================================================

  for (
    const file
    of files
  ) {

    let content:
      string;


    try {

      content =
        fs.readFileSync(
          file,
          'utf8'
        );

    } catch {

      continue;

    }


    const lines =
      content.split(
        /\r?\n/
      );


    lines.forEach(
      (
        line,
        index
      ) => {

        // ====================================================
        // FULLY QUALIFIED REFERENCES
        //
        // project.dataset.table
        // ====================================================

        fullRegex.lastIndex =
          0;


        let fullMatch:
          RegExpExecArray | null;


        while (
          (
            fullMatch =
              fullRegex.exec(
                line
              )
          )
          !== null
        ) {

          const candidate =
            `${fullMatch[1]}.${fullMatch[2]}.${fullMatch[3]}`;


          const physical =
            fullLookup.get(
              candidate
            );


          if (!physical) {

            continue;

          }


          references.push({

            projectId:
              physical.projectId,

            datasetId:
              physical.datasetId,

            tableId:
              physical.tableId,

            fullName:
              physical.fullName,

            file:
              relativePath(
                file
              ),

            line:
              index + 1,

            snippet:
              line.trim(),

          });

        }


        // ====================================================
        // DATASET.TABLE REFERENCES
        //
        // Only accepted if this exact physical table exists.
        // ====================================================

        partialRegex.lastIndex =
          0;


        let partialMatch:
          RegExpExecArray | null;


        while (
          (
            partialMatch =
              partialRegex.exec(
                line
              )
          )
          !== null
        ) {

          const candidate =
            `${partialMatch[1]}.${partialMatch[2]}`;


          const physical =
            partialLookup.get(
              candidate
            );


          if (!physical) {

            continue;

          }


          references.push({

            projectId:
              physical.projectId,

            datasetId:
              physical.datasetId,

            tableId:
              physical.tableId,

            fullName:
              physical.fullName,

            file:
              relativePath(
                file
              ),

            line:
              index + 1,

            snippet:
              line.trim(),

          });

        }

      }
    );

  }


  // ==========================================================
  // DEDUPLICATE
  // ==========================================================

  const uniqueReferences =
    new Map<
      string,
      TableReference
    >();


  for (
    const reference
    of references
  ) {

    const key =
      [
        reference.fullName,
        reference.file,
        reference.line,
      ].join(
        ':'
      );


    uniqueReferences.set(
      key,
      reference
    );

  }


  const cleanReferences =
    Array.from(
      uniqueReferences.values()
    );


  // ==========================================================
  // GROUP BY TABLE
  // ==========================================================

  const grouped =
    new Map<
      string,
      TableLineageSummary
    >();


  for (
    const reference
    of cleanReferences
  ) {

    const existing =
      grouped.get(
        reference.fullName
      );


    if (existing) {

      existing.referenceCount +=
        1;


      existing.references.push(
        reference
      );


      if (
        !existing.files.includes(
          reference.file
        )
      ) {

        existing.files.push(
          reference.file
        );

      }


      continue;

    }


    grouped.set(
      reference.fullName,
      {

        projectId:
          reference.projectId,

        datasetId:
          reference.datasetId,

        tableId:
          reference.tableId,

        fullName:
          reference.fullName,

        referenceCount:
          1,

        files: [
          reference.file,
        ],

        references: [
          reference,
        ],

      }
    );

  }


  const referencedTables =
    Array.from(
      grouped.values()
    )
      .sort(
        (
          a,
          b
        ) =>
          b.referenceCount -
          a.referenceCount
      );


  // ==========================================================
  // UNREFERENCED PHYSICAL TABLES
  //
  // IMPORTANT:
  //
  // "Unreferenced" only means not statically referenced by
  // this Growth OS repository.
  //
  // It does NOT mean safe to delete.
  //
  // External schedulers, Cloud Run, Apps Script and other
  // repositories may still use these tables.
  // ==========================================================

  const referencedSet =
    new Set(
      referencedTables.map(
        table =>
          table.fullName
      )
    );


  const unreferencedTables =
    physicalTables
      .filter(
        table =>
          !referencedSet.has(
            table.fullName
          )
      )
      .map(
        table => ({

          projectId:
            table.projectId,

          datasetId:
            table.datasetId,

          tableId:
            table.tableId,

          fullName:
            table.fullName,

        })
      );


  return {

    summary: {

      filesScanned:
        files.length,

      physicalTables:
        physicalTables.length,

      confirmedReferences:
        cleanReferences.length,

      referencedTables:
        referencedTables.length,

      unreferencedTables:
        unreferencedTables.length,

    },


    referencedTables,


    unreferencedTables,

  };

}