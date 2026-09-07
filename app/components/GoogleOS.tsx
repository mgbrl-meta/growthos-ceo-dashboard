'use client';

import {
  useState,
} from 'react';

import GoogleSettings, {
  defaultSettings,
  GoogleSettingsState,
} from './google/GoogleSettings';

import GoogleOverview
  from './google/GoogleOverview';

import GoogleChannelMix
  from './google/GoogleChannelMix';

import GoogleCampaign
  from './google/GoogleCampaign';

import GoogleAdGroup
  from './google/GoogleAdGroup';

import GoogleSearchTerms
  from './google/GoogleSearchTerms';

import GoogleKeywords
  from './google/GoogleKeywords';

import GoogleFunnel
  from './google/GoogleFunnel';

import GoogleAlerts
  from './google/GoogleAlerts';


// ============================================================
// PROPS
//
// Navigation is controlled by:
//
// AppSidebar
//    ↓
// GrowthOSDashboard
//    ↓
// activeGoogleTab
//    ↓
// GoogleOS
// ============================================================

type Props = {

  startDate: string;

  endDate: string;

  compareStartDate?: string;

  compareEndDate?: string;

  activeGoogleTab: string;

};


// ============================================================
// GOOGLE OS
// ============================================================

export default function GoogleOS({

  startDate,

  endDate,

  compareStartDate,

  compareEndDate,

  activeGoogleTab,

}: Props) {


  // ==========================================================
  // GOOGLE SETTINGS
  // ==========================================================

  const [
    googleSettings,
    setGoogleSettings,
  ] =
    useState<GoogleSettingsState>(
      defaultSettings
    );


  // ==========================================================
  // RENDER
  //
  // Only the currently selected Google module is mounted.
  // ==========================================================

  return (

    <section className="space-y-3">


      {/* =====================================================
          SETTINGS
      ===================================================== */}

      {activeGoogleTab ===
        'Settings' && (

        <GoogleSettings

          settings={
            googleSettings
          }

          setSettings={
            setGoogleSettings
          }

        />

      )}


      {/* =====================================================
          OVERVIEW
      ===================================================== */}

      {activeGoogleTab ===
        'Overview' && (

        <GoogleOverview

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          CHANNEL MIX
      ===================================================== */}

      {activeGoogleTab ===
        'Channel Mix' && (

        <GoogleChannelMix

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          CAMPAIGN
      ===================================================== */}

      {activeGoogleTab ===
        'Campaign' && (

        <GoogleCampaign

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          AD GROUP
      ===================================================== */}

      {activeGoogleTab ===
        'Ad Group' && (

        <GoogleAdGroup

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          SEARCH TERMS
      ===================================================== */}

      {activeGoogleTab ===
        'Search Terms' && (

        <GoogleSearchTerms

          startDate={
            startDate
          }

          endDate={
            endDate
          }

          settings={
            googleSettings
          }

        />

      )}


      {/* =====================================================
          KEYWORDS
      ===================================================== */}

      {activeGoogleTab ===
        'Keywords' && (

        <GoogleKeywords

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          FUNNEL
      ===================================================== */}

      {activeGoogleTab ===
        'Funnel' && (

        <GoogleFunnel

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


      {/* =====================================================
          ALERTS
      ===================================================== */}

      {activeGoogleTab ===
        'Alerts' && (

        <GoogleAlerts

          startDate={
            startDate
          }

          endDate={
            endDate
          }

        />

      )}


    </section>

  );

}
