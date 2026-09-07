'use client';

// ============================================================
// PRODUCT OS
//
// Navigation state is controlled by the global Growth OS
// sidebar. ProductOS only renders the selected Product page.
// ============================================================


// ============================================================
// PRODUCT MODULES
// ============================================================

import ProductOverview
  from './product/ProductOverview';

import SkuPerformance
  from './product/SkuPerformance';

import DemandTrends
  from './product/DemandTrends';

import InventoryHealth
  from './product/InventoryHealth';

import Forecasting
  from './product/Forecasting';

import SeasonalityEngine
  from './product/SeasonalityEngine';

import ProductInsights
  from './product/ProductInsights';

import ProductSettings
  from './product/ProductSettings';


// ============================================================
// PROPS
// ============================================================

type Props = {

  startDate: string;

  endDate: string;

  compareStartDate?: string;

  compareEndDate?: string;

  activeTab: string;

};


// ============================================================
// PRODUCT OS
// ============================================================

export default function ProductOS({

  startDate,

  endDate,

  compareStartDate,

  compareEndDate,

  activeTab,

}: Props) {

  return (

    <section className="space-y-3">


      {/* =====================================================
          OVERVIEW
      ===================================================== */}

      {activeTab ===
        'Overview' && (

        <ProductOverview

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          SKU PERFORMANCE
      ===================================================== */}

      {activeTab ===
        'SKU Performance' && (

        <SkuPerformance

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          DEMAND TRENDS
      ===================================================== */}

      {activeTab ===
        'Demand Trends' && (

        <DemandTrends

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          INVENTORY HEALTH
      ===================================================== */}

      {activeTab ===
        'Inventory Health' && (

        <InventoryHealth

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          FORECASTING
      ===================================================== */}

      {activeTab ===
        'Forecasting' && (

        <Forecasting

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          SEASONALITY
      ===================================================== */}

      {activeTab ===
        'Seasonality' && (

        <SeasonalityEngine

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          INSIGHTS
      ===================================================== */}

      {activeTab ===
        'Insights' && (

        <ProductInsights

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          SETTINGS
      ===================================================== */}

      {activeTab ===
        'Settings' && (

        <ProductSettings />

      )}


    </section>

  );

}
