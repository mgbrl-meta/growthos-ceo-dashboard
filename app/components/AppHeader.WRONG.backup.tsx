'use client';

import {
  useEffect,
  useState,
} from 'react';

import MetaSettings
  from './meta/MetaSettings';

import MetaOverview
  from './meta/MetaOverview';

import MetaCampaignAnalysis
  from './meta/MetaCampaignAnalysis';

import MetaAdSetAnalysis
  from './meta/MetaAdSetAnalysis';

import MetaCreativeAnalysis
  from './meta/MetaCreativeAnalysis';

import MetaFunnelAnalysis
  from './meta/MetaFunnelAnalysis';

import MetaAlertsRecommendations
  from './meta/MetaAlertsRecommendations';


// ============================================================
// META SETTINGS TYPE
// ============================================================

type MetaParams = {

  targetRoas: number;

  targetCpa: number;

  scalePct: number;

  killPct: number;

  minSpend: number;

  minPurchases: number;

  maxCpa: number;

  minRoas: number;

  minCtr: number;

  maxFrequency: number;

  cpmIncreasePct: number;

};


// ============================================================
// COMPONENT PROPS
//
// Navigation is controlled by:
//
// AppSidebar
//    ↓
// GrowthOSDashboard
//    ↓
// activeMetaTab
//    ↓
// MetaOS
// ============================================================

type MetaOSProps = {

  activeMetaTab: string;

  start: string;

  end: string;

  compareStart: string;

  compareEnd: string;

};


// ============================================================
// DEFAULT META SETTINGS
// ============================================================

const DEFAULT_PARAMS: MetaParams = {

  targetRoas:
    0.8,

  targetCpa:
    1800,

  scalePct:
    10,

  killPct:
    15,

  minSpend:
    10000,

  minPurchases:
    3,

  maxCpa:
    2200,

  minRoas:
    0.7,

  minCtr:
    0.8,

  maxFrequency:
    2.5,

  cpmIncreasePct:
    20,

};


// ============================================================
// META OS
// ============================================================

export default function MetaOS({

  activeMetaTab,

  start,

  end,

  compareStart,

  compareEnd,

}: MetaOSProps) {


  // ==========================================================
  // META SETTINGS
  // ==========================================================

  const [
    params,
    setParams,
  ] =
    useState<MetaParams>(
      DEFAULT_PARAMS
    );


  // ==========================================================
  // CAMPAIGN FILTER STATE
  //
  // Shared between:
  //
  // Ad Set Analysis
  // Creative Analysis
  // Funnel Analysis
  // ==========================================================

  const [
    campaigns,
    setCampaigns,
  ] =
    useState<string[]>(
      []
    );


  const [
    selectedCampaign,
    setSelectedCampaign,
  ] =
    useState(
      ''
    );


  // ==========================================================
  // LOAD CAMPAIGN LIST
  // ==========================================================

  useEffect(
    () => {

      let cancelled =
        false;


      async function fetchCampaigns() {

        try {

          const response =
            await fetch(

              `/api/meta-os?tab=campaign-list&start=${encodeURIComponent(
                start
              )}&end=${encodeURIComponent(
                end
              )}`,

              {
                cache:
                  'no-store',
              }

            );


          if (
            !response.ok
          ) {

            throw new Error(
              `Meta campaign list request failed: ${response.status}`
            );

          }


          const json =
            await response.json();


          if (
            cancelled
          ) {

            return;

          }


          const names =
            Array.isArray(
              json
            )

              ? json
                  .map(
                    (
                      row: any
                    ) =>
                      String(
                        row?.campaign_name ||
                        ''
                      ).trim()
                  )
                  .filter(
                    Boolean
                  )

              : [];


          /*
           * Remove duplicate campaign names while
           * preserving original order.
           */
          const uniqueNames =
            Array.from(
              new Set(
                names
              )
            );


          setCampaigns(
            uniqueNames
          );


          setSelectedCampaign(
            previous => {

              if (
                uniqueNames.length ===
                0
              ) {

                return '';

              }


              if (
                previous &&
                uniqueNames.includes(
                  previous
                )
              ) {

                return previous;

              }


              return uniqueNames[0];

            }
          );


        } catch (
          error
        ) {

          if (
            cancelled
          ) {

            return;

          }


          console.error(
            'META_CAMPAIGN_LIST_ERROR',
            error
          );


          setCampaigns(
            []
          );


          setSelectedCampaign(
            ''
          );

        }

      }


      fetchCampaigns();


      return () => {

        cancelled =
          true;

      };

    },
    [
      start,
      end,
    ]
  );


  // ==========================================================
  // RENDER
  //
  // Only the selected Meta submodule is mounted.
  // ==========================================================

  return (

    <section className="space-y-6">


      {/* =====================================================
          SETTINGS
      ===================================================== */}

      {activeMetaTab ===
        'Settings' && (

        <MetaSettings

          params={
            params
          }

          setParams={
            setParams
          }

        />

      )}


      {/* =====================================================
          OVERVIEW
      ===================================================== */}

      {activeMetaTab ===
        'Overview' && (

        <MetaOverview

          start={
            start
          }

          end={
            end
          }

          compareStart={
            compareStart
          }

          compareEnd={
            compareEnd
          }

          params={
            params
          }

        />

      )}


      {/* =====================================================
          CAMPAIGN ANALYSIS
      ===================================================== */}

      {activeMetaTab ===
        'Campaign Analysis' && (

        <MetaCampaignAnalysis

          start={
            start
          }

          end={
            end
          }

          params={
            params
          }

        />

      )}


      {/* =====================================================
          AD SET ANALYSIS
      ===================================================== */}

      {activeMetaTab ===
        'Ad Set Analysis' && (

        <MetaAdSetAnalysis

          start={
            start
          }

          end={
            end
          }

          params={
            params
          }

          campaigns={
            campaigns
          }

          selectedCampaign={
            selectedCampaign
          }

          setSelectedCampaign={
            setSelectedCampaign
          }

        />

      )}


      {/* =====================================================
          CREATIVE ANALYSIS
      ===================================================== */}

      {activeMetaTab ===
        'Creative Analysis' && (

        <MetaCreativeAnalysis

          start={
            start
          }

          end={
            end
          }

          params={
            params
          }

          campaigns={
            campaigns
          }

          selectedCampaign={
            selectedCampaign
          }

          setSelectedCampaign={
            setSelectedCampaign
          }

        />

      )}


      {/* =====================================================
          FUNNEL ANALYSIS
      ===================================================== */}

      {activeMetaTab ===
        'Funnel Analysis' && (

        <MetaFunnelAnalysis

          start={
            start
          }

          end={
            end
          }

          compareStart={
            compareStart
          }

          compareEnd={
            compareEnd
          }

          campaigns={
            campaigns
          }

          selectedCampaign={
            selectedCampaign
          }

          setSelectedCampaign={
            setSelectedCampaign
          }

        />

      )}


      {/* =====================================================
          ALERTS & RECOMMENDATIONS
      ===================================================== */}

      {activeMetaTab ===
        'Alerts & Recommendations' && (

        <MetaAlertsRecommendations

          start={
            start
          }

          end={
            end
          }

          compareStart={
            compareStart
          }

          compareEnd={
            compareEnd
          }

          params={
            params
          }

        />

      )}


    </section>

  );

}