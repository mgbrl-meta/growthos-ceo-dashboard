import 'server-only';


// ============================================================
// SHOPIFY INGESTION FEATURE FLAGS
//
// PRODUCT REALTIME
//
// Capability exists:
// - Product webhook receiver
// - Product webhook registration
// - Product worker handler
// - Product canonical writer
//
// But Growth OS currently does NOT require realtime Product
// catalogue updates.
//
// Default is therefore OFF.
//
// Future activation:
//
// SHOPIFY_PRODUCTS_REALTIME_ENABLED=true
// ============================================================

export function isShopifyProductsRealtimeEnabled() {

  return (
    String(
      process.env
        .SHOPIFY_PRODUCTS_REALTIME_ENABLED
      ??
      ''
    )
      .trim()
      .toLowerCase()
    ===
    'true'
  );

}