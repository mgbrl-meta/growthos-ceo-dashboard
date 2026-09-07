'use client';

import AttributionOverview
  from './attribution/AttributionOverview';

import AttributionJourneyExplorer
  from './attribution/AttributionJourneyExplorer';

import AttributionChannels
  from './attribution/AttributionChannels';

import AttributionCampaigns
  from './attribution/AttributionCampaigns';

import AttributionCreatives
  from './attribution/AttributionCreatives';

import AttributionNewRepeat
  from './attribution/AttributionNewRepeat';

import AttributionModels
  from './attribution/AttributionModels';

import AttributionDataQuality
  from './attribution/AttributionDataQuality';


// ============================================================
// PROPS
//
// Navigation is controlled by:
//
// AppSidebar
//    ↓
// GrowthOSDashboard
//    ↓
// activeTab
//    ↓
// AttributionOS
// ============================================================

type Props = {

  startDate: string;

  endDate: string;

  compareStartDate?: string;

  compareEndDate?: string;

  activeTab: string;

};


// ============================================================
// ATTRIBUTION OS
// ============================================================

export default function AttributionOS({

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

        <AttributionOverview

          startDate={
            startDate
          }

          endDate={
            endDate
          }

          compareStartDate={
            compareStartDate
          }

          compareEndDate={
            compareEndDate
          }

        />

      )}


      {/* =====================================================
          JOURNEY EXPLORER
      ===================================================== */}

      {activeTab ===
        'Journey Explorer' && (

        <AttributionJourneyExplorer

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          CHANNELS
      ===================================================== */}

      {activeTab ===
        'Channels' && (

        <AttributionChannels

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          CAMPAIGNS
      ===================================================== */}

      {activeTab ===
        'Campaigns' && (

        <AttributionCampaigns

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          CREATIVES
      ===================================================== */}

      {activeTab ===
        'Creatives' && (

        <AttributionCreatives

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          NEW VS REPEAT
      ===================================================== */}

      {activeTab ===
        'New vs Repeat' && (

        <AttributionNewRepeat

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          ATTRIBUTION MODELS
      ===================================================== */}

      {activeTab ===
        'Attribution Models' && (

        <AttributionModels

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          DATA QUALITY
      ===================================================== */}

      {activeTab ===
        'Data Quality' && (

        <AttributionDataQuality />

      )}


    </section>

  );

}
