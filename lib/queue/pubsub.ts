import 'server-only';

import {
  PubSub,
} from '@google-cloud/pubsub';


// ============================================================
// GROWTH OS PUB/SUB CLIENT
//
// Used by Growth OS to enqueue asynchronous jobs.
//
// Current use:
//
// Shopify sync jobs
//
// Future:
//
// Shopify webhooks
// journey events
// reconciliation
// Meta
// Google
// Amazon
//
// IMPORTANT:
//
// No workspace / brand is configured here.
//
// Tenant identity belongs inside each signed application
// message:
//
// workspace_id
// brand_id
// connection_id
// integration_account_id
//
// Cloud Run should eventually use Application Default
// Credentials through its attached service account.
//
// Vercel/local development can use:
//
// GCP_CLIENT_EMAIL
// GCP_PRIVATE_KEY
// ============================================================


// ============================================================
// CLIENT
// ============================================================

let client:
  PubSub | null =
    null;


// ============================================================
// PROJECT
// ============================================================

export function getPubSubProjectId() {

  const projectId =
    String(
      process.env.GROWTHOS_PUBSUB_PROJECT
      ||
      process.env.GROWTHOS_DATA_PROJECT
      ||
      process.env.GCP_PROJECT_ID
      ||
      process.env.BQ_PROJECT_ID
      ||
      ''
    ).trim();


  if (!projectId) {

    throw new Error(
      'GROWTHOS_PUBSUB_PROJECT_MISSING'
    );

  }


  return projectId;

}


// ============================================================
// PUB/SUB CLIENT
// ============================================================

export function getPubSubClient() {

  if (client) {

    return client;

  }


  const projectId =
    getPubSubProjectId();


  const clientEmail =
    String(
      process.env.GCP_CLIENT_EMAIL
      ||
      ''
    ).trim();


  const privateKey =
    String(
      process.env.GCP_PRIVATE_KEY
      ||
      ''
    )
      .replace(
        /\\n/g,
        '\n'
      )
      .trim();


  // ==========================================================
  // EXPLICIT SERVICE ACCOUNT
  //
  // Used by Vercel/local environments when configured.
  // ==========================================================

  if (
    clientEmail
    &&
    privateKey
  ) {

    client =
      new PubSub({

        projectId,

        credentials: {

          client_email:
            clientEmail,

          private_key:
            privateKey,

        },

      });


    return client;

  }


  // ==========================================================
  // APPLICATION DEFAULT CREDENTIALS
  //
  // Preferred for future Cloud Run services.
  // ==========================================================

  client =
    new PubSub({

      projectId,

    });


  return client;

}


// ============================================================
// TOPIC
// ============================================================

export function getShopifySyncTopicName() {

  const topic =
    String(
      process.env.GROWTHOS_SHOPIFY_SYNC_TOPIC
      ||
      'growthos-shopify-sync-jobs'
    ).trim();


  if (!topic) {

    throw new Error(
      'GROWTHOS_SHOPIFY_SYNC_TOPIC_MISSING'
    );

  }


  return topic;

}


// ============================================================
// PUBLISH JSON
// ============================================================

export async function publishJsonMessage(
  input: {

    topic:
      string;

    payload:
      unknown;

    attributes?:
      Record<
        string,
        string
      >;

  }
) {

  const pubsub =
    getPubSubClient();


  const topicName =
    String(
      input.topic
      ||
      ''
    ).trim();


  if (!topicName) {

    throw new Error(
      'PUBSUB_TOPIC_MISSING'
    );

  }


  const data =
    Buffer.from(

      JSON.stringify(
        input.payload
      ),

      'utf8'

    );


  const attributes:
    Record<
      string,
      string
    > = {};


  for (
    const [
      key,
      value,
    ]
    of Object.entries(
      input.attributes
      ||
      {}
    )
  ) {

    attributes[
      key
    ] =
      String(
        value
      );

  }


  const messageId =
    await pubsub
      .topic(
        topicName
      )
      .publishMessage({

        data,

        attributes,

      });


  return {

    topic:
      topicName,

    messageId,

  };

}