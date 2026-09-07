'use client';

import CommandCenter
  from './retention/CommandCenter';

import Settings
  from './retention/Settings';

import OpportunityBank
  from './retention/OpportunityBank';

import PatternDiscovery
  from './retention/PatternDiscovery';

import HypothesisLab
  from './retention/HypothesisLab';

import ActionTracker
  from './retention/ActionTracker';

import LearningLoop
  from './retention/LearningLoop';

import CustomerJourney
  from './retention/CustomerJourney';

import DailyPlanner
  from './retention/DailyPlanner';


// ============================================================
// PROPS
//
// Retention navigation is controlled by:
//
// AppSidebar
//    ↓
// GrowthOSDashboard
//    ↓
// activeTab
//    ↓
// RetentionOS
// ============================================================

type RetentionOSProps = {

  /**
   * Universal dashboard period END date.
   *
   * Example:
   * 2026-08-20
   */
  selectedDate?: string;

  /**
   * Current Retention OS screen selected
   * from the global Growth OS sidebar.
   */
  activeTab: string;

};


// ============================================================
// PLACEHOLDER
//
// Used only if a future sidebar item exists before its
// Retention screen has been implemented.
// ============================================================

function Placeholder({
  title,
}: {
  title: string;
}) {

  return (

    <section
      className="
        gos-panel
      "
    >

      <p
        className="
          text-[10px]
          font-semibold
          uppercase
          tracking-[0.22em]
          text-blue-600
        "
      >
        Retention OS
      </p>


      <h2
        className="
          mt-2
          text-[14px]
          font-semibold
          tracking-[-0.04em]
          text-slate-950
        "
      >
        {title}
      </h2>


      <p
        className="
          mt-2
          text-[11px]
          text-slate-500
        "
      >
        This module will be built next.
      </p>

    </section>

  );

}


// ============================================================
// RETENTION OS
// ============================================================

export default function RetentionOS({

  selectedDate,

  activeTab,

}: RetentionOSProps) {

  return (

    <div className="space-y-3">


      {/* =====================================================
          MISSION CONTROL / COMMAND CENTER
      ===================================================== */}

      {(
        activeTab ===
          'Mission Control'

        ||

        activeTab ===
          'Command Center'
      ) && (

        <CommandCenter />

      )}


      {/* =====================================================
          DAILY PLANNER
      ===================================================== */}

      {activeTab ===
        'Daily Planner' && (

        <DailyPlanner

          selectedDate={
            selectedDate
          }

        />

      )}


      {/* =====================================================
          OPPORTUNITY BANK
      ===================================================== */}

      {activeTab ===
        'Opportunity Bank' && (

        <OpportunityBank />

      )}


      {/* =====================================================
          PATTERN DISCOVERY
      ===================================================== */}

      {activeTab ===
        'Pattern Discovery' && (

        <PatternDiscovery />

      )}


      {/* =====================================================
          HYPOTHESIS LAB
      ===================================================== */}

      {activeTab ===
        'Hypothesis Lab' && (

        <HypothesisLab />

      )}


      {/* =====================================================
          ACTION TRACKER
      ===================================================== */}

      {activeTab ===
        'Action Tracker' && (

        <ActionTracker />

      )}


      {/* =====================================================
          LEARNING LOOP
      ===================================================== */}

      {activeTab ===
        'Learning Loop' && (

        <LearningLoop />

      )}


      {/* =====================================================
          CUSTOMER JOURNEY
      ===================================================== */}

      {activeTab ===
        'Customer Journey' && (

        <CustomerJourney />

      )}


      {/* =====================================================
          SETTINGS
      ===================================================== */}

      {activeTab ===
        'Settings' && (

        <Settings />

      )}


      {/* =====================================================
          UNKNOWN / FUTURE TAB
      ===================================================== */}

      {activeTab !==
        'Mission Control' &&

        activeTab !==
          'Command Center' &&

        activeTab !==
          'Daily Planner' &&

        activeTab !==
          'Opportunity Bank' &&

        activeTab !==
          'Pattern Discovery' &&

        activeTab !==
          'Hypothesis Lab' &&

        activeTab !==
          'Action Tracker' &&

        activeTab !==
          'Learning Loop' &&

        activeTab !==
          'Customer Journey' &&

        activeTab !==
          'Settings' && (

          <Placeholder
            title={
              activeTab
            }
          />

        )}


    </div>

  );

}
