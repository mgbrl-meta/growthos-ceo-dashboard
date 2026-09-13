'use client';

import {
  CalendarDays,
  Check,
  ChevronDown,
  X,
} from 'lucide-react';

import {
  useEffect,
  useRef,
  useState,
} from 'react';


type Preset =
  | 'yesterday'
  | 'l7'
  | 'l14'
  | 'l30'
  | 'l90'
  | 'mtd'
  | 'lastMonth';


type DateControlProps = {

  start: string;

  end: string;

  compareStart: string;

  compareEnd: string;

  setStart: (
    value: string
  ) => void;

  setEnd: (
    value: string
  ) => void;

  setCompareStart: (
    value: string
  ) => void;

  setCompareEnd: (
    value: string
  ) => void;

  onApply: () => void;

  loading: boolean;

  setPreset: (
    preset: Preset
  ) => void;

  defaultPreset?:
    Preset;
};


const PRESETS: Array<{
  key: Preset;
  label: string;
}> = [

  {
    key: 'yesterday',
    label: 'Yesterday',
  },

  {
    key: 'l7',
    label: 'Last 7 Days',
  },

  {
    key: 'l14',
    label: 'Last 14 Days',
  },

  {
    key: 'l30',
    label: 'Last 30 Days',
  },

  {
    key: 'l90',
    label: 'Last 90 Days',
  },

  {
    key: 'mtd',
    label: 'This Month',
  },

  {
    key: 'lastMonth',
    label: 'Last Month',
  },

];


export default function DateControl({
  start,
  end,
  compareStart,
  compareEnd,
  setStart,
  setEnd,
  setCompareStart,
  setCompareEnd,
  onApply,
  loading,
  setPreset,
  defaultPreset =
    'l30',
}: DateControlProps) {


  const [
    open,
    setOpen,
  ] = useState(
    false
  );


  /*
   * Current Growth OS default range
   * is Last 30 Days.
   */
  const [
    activePreset,
    setActivePreset,
  ] = useState<Preset>(
    defaultPreset
  );


  useEffect(
    () => {

      setActivePreset(
        defaultPreset
      );

    },
    [
      defaultPreset,
    ]
  );


  /*
   * Temporary values allow the user
   * to edit dates without immediately
   * changing the dashboard.
   */
  const [
    draftStart,
    setDraftStart,
  ] = useState(
    start
  );


  const [
    draftEnd,
    setDraftEnd,
  ] = useState(
    end
  );


  const [
    draftCompareStart,
    setDraftCompareStart,
  ] = useState(
    compareStart
  );


  const [
    draftCompareEnd,
    setDraftCompareEnd,
  ] = useState(
    compareEnd
  );


  const containerRef =
    useRef<HTMLDivElement>(
      null
    );


  /*
   * Keep draft values synchronized
   * with global dashboard state.
   */
  useEffect(
    () => {

      if (!open) {

        setDraftStart(
          start
        );

        setDraftEnd(
          end
        );

        setDraftCompareStart(
          compareStart
        );

        setDraftCompareEnd(
          compareEnd
        );

      }

    },
    [
      start,
      end,
      compareStart,
      compareEnd,
      open,
    ],
  );


  /*
   * Close when clicking outside.
   */
  useEffect(
    () => {

      function handleOutsideClick(
        event: MouseEvent
      ) {

        if (

          containerRef.current &&

          !containerRef.current.contains(
            event.target as Node
          )

        ) {

          setOpen(
            false
          );

        }

      }


      document.addEventListener(
        'mousedown',
        handleOutsideClick
      );


      return () => {

        document.removeEventListener(
          'mousedown',
          handleOutsideClick
        );

      };

    },
    [],
  );


  function handlePreset(
    preset: Preset
  ) {

    setActivePreset(
      preset
    );


    /*
     * Existing page.tsx preset function
     * calculates current + comparison dates.
     */
    setPreset(
      preset
    );

  }


  function handleApply() {

    /*
     * Custom edits override the preset values.
     */
    setStart(
      draftStart
    );

    setEnd(
      draftEnd
    );

    setCompareStart(
      draftCompareStart
    );

    setCompareEnd(
      draftCompareEnd
    );


    /*
     * onApply currently reads state,
     * so allow React state to settle first.
     */
    setTimeout(
      () => {
        onApply();
      },
      0
    );


    setOpen(
      false
    );

  }


  function handleCancel() {

    setDraftStart(
      start
    );

    setDraftEnd(
      end
    );

    setDraftCompareStart(
      compareStart
    );

    setDraftCompareEnd(
      compareEnd
    );


    setOpen(
      false
    );

  }


  const presetLabel =
    PRESETS.find(
      item =>
        item.key ===
        activePreset
    )?.label ||
    'Date Range';


  return (

    <div
      ref={
        containerRef
      }
      className="relative"
    >


      {/* =====================================================
          SINGLE HEADER BUTTON
      ===================================================== */}

      <button
        type="button"

        onClick={() =>
          setOpen(
            !open
          )
        }

        className="
          flex
          h-8
          items-center
          gap-2
          rounded-xl
          border
          border-slate-200
          bg-white
          px-3.5
          text-[10px]
          font-bold
          text-slate-700
          shadow-sm
          transition

          hover:border-slate-300
          hover:bg-slate-50
        "
      >

        <CalendarDays
          size={15}
          strokeWidth={2}
          className="text-slate-500"
        />


        <span>
          {presetLabel}
        </span>


        <ChevronDown
          size={14}
          strokeWidth={2}
          className={`
            ml-1
            text-slate-400
            transition-transform

            ${
              open
                ? 'rotate-180'
                : ''
            }
          `}
        />

      </button>


      {/* =====================================================
          DATE RANGE POPUP
      ===================================================== */}

      {open && (

        <div
          className="
            absolute
            right-0
            top-[40px]
            z-[10000]
            w-[560px]
            overflow-hidden
            rounded-lg
            border
            border-slate-200
            bg-white
            shadow-sm
            shadow-slate-900/10
          "
        >


          {/* =================================================
              POPUP HEADER
          ================================================= */}

          <div
            className="
              flex
              items-center
              justify-between
              border-b
              border-slate-100
              px-3
              py-2.5
            "
          >

            <div>

              <p
                className="
                  text-[11px]
                  font-semibold
                  text-slate-950
                "
              >
                Date Range
              </p>


              <p
                className="
                  mt-0.5
                  text-[11px]
                  text-slate-400
                "
              >
                Select reporting and comparison periods
              </p>

            </div>


            <button
              type="button"

              onClick={() =>
                setOpen(
                  false
                )
              }

              className="
                flex
                h-8
                w-8
                items-center
                justify-center
                rounded-lg
                text-slate-400
                transition

                hover:bg-slate-100
                hover:text-slate-950
              "
            >

              <X
                size={16}
              />

            </button>

          </div>


          {/* =================================================
              POPUP BODY
          ================================================= */}

          <div className="grid grid-cols-[150px_1fr]">


            {/* ===============================================
                PRESETS
            =============================================== */}

            <div
              className="
                border-r
                border-slate-100
                bg-slate-50/70
                p-3
              "
            >

              <p
                className="
                  mb-2
                  px-2
                  text-[9px]
                  font-semibold
                  uppercase
                  tracking-[0.15em]
                  text-slate-400
                "
              >
                Quick ranges
              </p>


              <div className="space-y-1">

                {PRESETS.map(
                  item => {

                    const active =
                      activePreset ===
                      item.key;


                    return (

                      <button
                        key={
                          item.key
                        }

                        type="button"

                        onClick={() =>
                          handlePreset(
                            item.key
                          )
                        }

                        className={`
                          flex
                          w-full
                          items-center
                          justify-between
                          rounded-lg
                          px-2.5
                          py-2
                          text-left
                          text-[10px]
                          transition

                          ${
                            active

                              ? `
                                bg-white
                                font-semibold
                                text-slate-950
                                shadow-sm
                              `

                              : `
                                font-semibold
                                text-slate-500
                                hover:bg-white
                                hover:text-slate-950
                              `
                          }
                        `}
                      >

                        <span>
                          {item.label}
                        </span>


                        {active && (

                          <Check
                            size={13}
                            className="text-violet-600"
                          />

                        )}

                      </button>

                    );

                  }
                )}

              </div>

            </div>


            {/* ===============================================
                CUSTOM PERIODS
            =============================================== */}

            <div className="p-3">


              {/* CURRENT PERIOD */}

              <DateSection
                title="Current Period"

                start={
                  draftStart
                }

                end={
                  draftEnd
                }

                setStart={
                  value => {

                    setDraftStart(
                      value
                    );

                    setActivePreset(
                      activePreset
                    );

                  }
                }

                setEnd={
                  value => {

                    setDraftEnd(
                      value
                    );

                  }
                }
              />


              <div className="my-5 border-t border-slate-100" />


              {/* COMPARE PERIOD */}

              <DateSection
                title="Compare Period"

                start={
                  draftCompareStart
                }

                end={
                  draftCompareEnd
                }

                setStart={
                  setDraftCompareStart
                }

                setEnd={
                  setDraftCompareEnd
                }
              />


              <div
                className="
                  mt-3
                  rounded-xl
                  bg-slate-50
                  px-3
                  py-2.5
                "
              >

                <p className="text-[10px] leading-4 text-slate-500">

                  Growth OS compares the selected period with the comparison period for performance changes.

                </p>

              </div>

            </div>

          </div>


          {/* =================================================
              FOOTER
          ================================================= */}

          <div
            className="
              flex
              items-center
              justify-between
              border-t
              border-slate-100
              bg-white
              px-3
              py-2
            "
          >

            <div className="text-[10px] font-semibold text-slate-400">

              {formatDisplayDate(
                draftStart
              )}

              {' → '}

              {formatDisplayDate(
                draftEnd
              )}

            </div>


            <div className="flex items-center gap-2">


              <button
                type="button"

                onClick={
                  handleCancel
                }

                className="
                  h-9
                  rounded-lg
                  border
                  border-slate-200
                  bg-white
                  px-3
                  text-[10px]
                  font-bold
                  text-slate-600
                  transition

                  hover:bg-slate-50
                "
              >
                Cancel
              </button>


              <button
                type="button"

                disabled={
                  loading
                }

                onClick={
                  handleApply
                }

                className="
                  h-9
                  rounded-lg
                  bg-slate-950
                  px-3
                  text-[10px]
                  font-semibold
                  text-white
                  transition

                  hover:bg-slate-800

                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >

                {loading
                  ? 'Loading...'
                  : 'Apply'}

              </button>

            </div>

          </div>

        </div>

      )}

    </div>

  );

}


/* =========================================================
   DATE SECTION
========================================================= */

function DateSection({
  title,
  start,
  end,
  setStart,
  setEnd,
}: {

  title: string;

  start: string;

  end: string;

  setStart: (
    value: string
  ) => void;

  setEnd: (
    value: string
  ) => void;

}) {

  return (

    <div>

      <p
        className="
          mb-3
          text-[10px]
          font-semibold
          uppercase
          tracking-[0.12em]
          text-slate-500
        "
      >
        {title}
      </p>


      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">


        <DateInput
          value={
            start
          }

          onChange={
            setStart
          }
        />


        <span className="text-[10px] text-slate-300">
          →
        </span>


        <DateInput
          value={
            end
          }

          onChange={
            setEnd
          }
        />

      </div>

    </div>

  );

}


/* =========================================================
   DATE INPUT
========================================================= */

function DateInput({
  value,
  onChange,
}: {

  value: string;

  onChange: (
    value: string
  ) => void;

}) {

  return (

    <div
      className="
        flex
        h-8
        items-center
        gap-2
        rounded-lg
        border
        border-slate-200
        bg-white
        px-3

        focus-within:border-violet-400
        focus-within:ring-2
        focus-within:ring-violet-100
      "
    >

      <CalendarDays
        size={14}
        className="shrink-0 text-slate-400"
      />


      <input
        type="date"

        value={
          value
        }

        onChange={
          event =>
            onChange(
              event.target.value
            )
        }

        className="
          min-w-0
          flex-1
          bg-transparent
          text-[10px]
          font-semibold
          text-slate-800
          outline-none
        "
      />

    </div>

  );

}


/* =========================================================
   DISPLAY FORMATTER
========================================================= */

function formatDisplayDate(
  value: string
) {

  if (!value) {
    return '—';
  }


  const [
    year,
    month,
    day,
  ] =
    value
      .split('-')
      .map(
        Number
      );


  return new Intl.DateTimeFormat(
    'en-IN',
    {
      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric',
    }
  ).format(
    new Date(
      year,
      month - 1,
      day
    )
  );

}
