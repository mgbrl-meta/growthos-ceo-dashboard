'use client';

import { useEffect, useMemo, useState } from 'react';

export default function Settings() {
  const [businessGoal, setBusinessGoal] = useState('Contribution Profit');

  const [profitWeight, setProfitWeight] = useState(40);
  const [ltvWeight, setLtvWeight] = useState(30);
  const [confidenceWeight, setConfidenceWeight] = useState(20);
  const [easeWeight, setEaseWeight] = useState(10);

  const [whatsappCapacity, setWhatsappCapacity] = useState(4);
  const [emailCapacity, setEmailCapacity] = useState(4);
  const [smsCapacity, setSmsCapacity] = useState(4);
  const [maxTouches, setMaxTouches] = useState(6);

  const [learningWindow, setLearningWindow] = useState(30);

  const [lowConfidence, setLowConfidence] = useState(40);
  const [mediumConfidence, setMediumConfidence] = useState(60);
  const [highConfidence, setHighConfidence] = useState(80);

  const [winback, setWinback] = useState(70);
  const [crossSell, setCrossSell] = useState(90);
  const [replenishment, setReplenishment] = useState(100);
  const [subscription, setSubscription] = useState(30);
  const [loyalty, setLoyalty] = useState(40);
  const [highLtvGrowth, setHighLtvGrowth] = useState(95);

  const [unmappedProducts, setUnmappedProducts] = useState<any[]>([]);
  const [mappedProducts, setMappedProducts] = useState<any[]>([]);
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, any>>({});
  const [savingSku, setSavingSku] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [routineMaster, setRoutineMaster] = useState<any[]>([]);
  const [savingRoutineSku, setSavingRoutineSku] = useState('');

  const [opportunitySettings, setOpportunitySettings] = useState<any[]>([]);
  const [savingOpportunityType, setSavingOpportunityType] = useState('');

  const [confidenceSuggestions, setConfidenceSuggestions] = useState<any[]>([]);
  const [applyingConfidenceType, setApplyingConfidenceType] = useState('');

  const [confidenceChangeLog, setConfidenceChangeLog] = useState<any[]>([]);

  const [settingsHealth, setSettingsHealth] = useState<any>(null);

  const [globalSettings, setGlobalSettings] = useState<any[]>([]);
  const [journeySettings, setJourneySettings] = useState<any[]>([]);
  const [journeyHealthSettings, setJourneyHealthSettings] = useState<any[]>([]);
  const [savingJourney, setSavingJourney] = useState(false);

  const [mappedDrafts, setMappedDrafts] = useState<Record<string, any>>({});
  const [savingMappedSku, setSavingMappedSku] = useState('');

  const totalWeight = useMemo(() => {
    return profitWeight + ltvWeight + confidenceWeight + easeWeight;
  }, [profitWeight, ltvWeight, confidenceWeight, easeWeight]);

  const loadProductData = async () => {
    setLoadingProducts(true);

    try {
      const unmappedRes = await fetch('/api/retention-os/unmapped-products');
      const unmappedJson = await unmappedRes.json();

      const unmappedRows = Array.isArray(unmappedJson)
        ? unmappedJson.slice(0, 20)
        : [];

      setUnmappedProducts(unmappedRows);

      const drafts: Record<string, any> = {};

      unmappedRows.forEach((row: any) => {
        drafts[row.sku] = {
          sku: row.sku,
          product_title:
            typeof row.product_title === 'object'
              ? row.product_title?.value || ''
              : row.product_title || '',
          category: '',
          routine: '',
          role: '',
          product_family: '',
          product_sub_category: '',
          product_type: 'Single',
          routine_step: '',
          replenishment_days: '',
          bundle_components: '',
          active: true,
        };
      });

      setMappingDrafts(drafts);

      const mappedRes = await fetch('/api/retention-os/mapped-products');
      const mappedJson = await mappedRes.json();

      const mappedRows = Array.isArray(mappedJson) ? mappedJson : [];

      setMappedProducts(mappedRows);

      const mappedDraftRows: Record<string, any> = {};

      mappedRows.forEach((row: any) => {
        mappedDraftRows[row.sku] = {
          sku: row.sku || '',
          product_title:
            typeof row.product_title === 'object'
              ? row.product_title?.value || ''
              : row.product_title || '',
          category: row.category || '',
          routine: row.routine || '',
          role: row.role || '',
          product_family: row.product_family || '',
          product_sub_category: row.product_sub_category || '',
          product_type: row.product_type || 'Single',
          routine_step: row.routine_step ?? '',
          replenishment_days: row.replenishment_days ?? '',
          bundle_components: row.bundle_components || '',
          active: row.active ?? true,
        };
      });

      setMappedDrafts(mappedDraftRows);

      const routineRes = await fetch('/api/retention-os/routine-master');
      const routineJson = await routineRes.json();

      setRoutineMaster(Array.isArray(routineJson) ? routineJson : []);

      const opportunitySettingsRes = await fetch('/api/retention-os/opportunity-settings');
      const opportunitySettingsJson = await opportunitySettingsRes.json();

      setOpportunitySettings(
        Array.isArray(opportunitySettingsJson) ? opportunitySettingsJson : []
      );

      const confidenceRes = await fetch('/api/retention-os/confidence-suggestions');
      const confidenceJson = await confidenceRes.json();

      setConfidenceSuggestions(
        Array.isArray(confidenceJson) ? confidenceJson : []
      );

      const confidenceLogRes = await fetch('/api/retention-os/confidence-change-log');
      const confidenceLogJson = await confidenceLogRes.json();

      setConfidenceChangeLog(
        Array.isArray(confidenceLogJson) ? confidenceLogJson : []
      );

      const healthRes = await fetch('/api/retention-os/settings-health');
      const healthJson = await healthRes.json();

      setSettingsHealth(healthJson || null);

      const globalRes = await fetch('/api/retention-os/global-settings');
      const globalJson = await globalRes.json();
      setGlobalSettings(Array.isArray(globalJson) ? globalJson : []);

      const journeyRes = await fetch('/api/retention-os/journey-settings');
      const journeyJson = await journeyRes.json();
      setJourneySettings(Array.isArray(journeyJson) ? journeyJson : []);

      const journeyHealthRes = await fetch(
        '/api/retention-os/journey-health-settings'
      );

      const journeyHealthJson = await journeyHealthRes.json();

      setJourneyHealthSettings(
        Array.isArray(journeyHealthJson)
          ? journeyHealthJson
          : []
      );

    } catch (error) {
      console.error('Product mapping load error', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadProductData();
  }, []);

  const updateDraft = (sku: string, key: string, value: string) => {
    setMappingDrafts((prev) => ({
      ...prev,
      [sku]: {
        ...prev[sku],
        [key]: value,
      },
    }));
  };

  const saveProductMapping = async (sku: string) => {
    const draft = mappingDrafts[sku];

    if (!draft?.category || !draft?.routine || !draft?.role) {
      alert('Please fill Category, Routine and Role.');
      return;
    }

    setSavingSku(sku);

    try {
      const res = await fetch('/api/retention-os/product-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.detail || json?.error || 'Save failed');
      }

      setUnmappedProducts((prev) => prev.filter((row) => row.sku !== sku));

      setMappingDrafts((prev) => {
        const next = { ...prev };
        delete next[sku];
        return next;
      });

      await loadProductData();

      alert('Product mapping saved.');
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : 'Failed to save product mapping.');
    } finally {
      setSavingSku('');
    }
  };

  

  const updateMappedDraft = (sku: string, key: string, value: any) => {
    setMappedDrafts((prev) => ({
      ...prev,
      [sku]: {
        ...prev[sku],
        [key]: value,
      },
    }));
  };

  const handleMappedCustomSelect = (
    sku: string,
    key: string,
    value: string
  ) => {
    if (value === '__add_new__') {
      const customValue = window.prompt(`Enter new ${key}`);

      if (customValue?.trim()) {
        updateMappedDraft(sku, key, customValue.trim());
      }

      return;
    }

    updateMappedDraft(sku, key, value);
  };

  const updateMappedProduct = async (sku: string) => {
    const draft = mappedDrafts[sku];

    if (!draft?.category || !draft?.routine || !draft?.role) {
      alert('Please fill Category, Routine and Role.');
      return;
    }

    setSavingMappedSku(sku);

    try {
      const res = await fetch('/api/retention-os/product-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || 'Update failed');
      }

      await loadProductData();

      alert('Product mapping updated.');
    } catch (error) {
      console.error(error);
      alert('Failed to update product mapping.');
    } finally {
      setSavingMappedSku('');
    }
  };

  const saveRoutineMapping = async (row: any) => {
    setSavingRoutineSku(row.sku);

    try {
      const res = await fetch('/api/retention-os/routine-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routine: row.routine,
          sku: row.sku,
          required: true,
          weight: row.role === 'Hero' ? 50 : row.role === 'Support' ? 30 : 20,
          active: true,
        }),
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || 'Save failed');

      await loadProductData();
      alert('Routine mapping saved.');
    } catch (error) {
      console.error(error);
      alert('Failed to save routine mapping.');
    } finally {
      setSavingRoutineSku('');
    }
  };

  const updateOpportunitySetting = (
    opportunityType: string,
    key: string,
    value: any
  ) => {
    setOpportunitySettings((prev) =>
      prev.map((row) =>
        row.opportunity_type === opportunityType
          ? { ...row, [key]: value }
          : row
      )
    );
  };

  const saveOpportunitySetting = async (row: any) => {
    setSavingOpportunityType(row.opportunity_type);

    try {
      const res = await fetch('/api/retention-os/opportunity-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(row),
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || 'Save failed');

      await loadProductData();
      alert('Opportunity setting saved.');
    } catch (error) {
      console.error(error);
      alert('Failed to save opportunity setting.');
    } finally {
      setSavingOpportunityType('');
    }
  };

  const applyConfidenceSuggestion = async (row: any) => {
    setApplyingConfidenceType(row.opportunity_type);

    try {
      const current = opportunitySettings.find(
        (s: any) => s.opportunity_type === row.opportunity_type
      );

      if (!current) {
        alert('Opportunity setting not found.');
        return;
      }

      const updated = {
        ...current,
        confidence: row.suggested_confidence,
      };

      const res = await fetch('/api/retention-os/opportunity-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || 'Save failed');

      await loadProductData();
      alert('Confidence suggestion applied.');
    } catch (error) {
      console.error(error);
      alert('Failed to apply confidence suggestion.');
    } finally {
      setApplyingConfidenceType('');
    }
  };

  const updateGlobalSetting = (settingName: string, value: string) => {
    setGlobalSettings((prev) =>
      prev.map((row) =>
        row.setting_name === settingName
          ? { ...row, setting_value: value }
          : row
      )
    );
  };

  const updateJourneySetting = (
    stageName: string,
    key: string,
    value: any
  ) => {
    setJourneySettings((prev) =>
      prev.map((row) =>
        row.stage_name === stageName ? { ...row, [key]: value } : row
      )
    );
  };

  const updateJourneyHealthSetting = (
    healthName: string,
    key: string,
    value: any
  ) => {
    setJourneyHealthSettings((prev) =>
      prev.map((row) =>
        row.health_name === healthName ? { ...row, [key]: value } : row
      )
    );
  };

  const saveJourneyConfiguration = async () => {
    setSavingJourney(true);

    try {
      const globalRes = await fetch('/api/retention-os/global-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalSettings),
      });

      if (!globalRes.ok) throw new Error('Global settings save failed');

      const journeyRes = await fetch('/api/retention-os/journey-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(journeySettings),
      });

      if (!journeyRes.ok) throw new Error('Journey settings save failed');

      const healthRes = await fetch('/api/retention-os/journey-health-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(journeyHealthSettings),
      });

      if (!healthRes.ok) throw new Error('Journey health settings save failed');

      await loadProductData();

      alert('Journey configuration saved.');
    } catch (error) {
      console.error(error);
      alert('Failed to save journey configuration.');
    } finally {
      setSavingJourney(false);
    }
  };

  const getGlobalSetting = (name: string, fallback: string) => {
    return (
      globalSettings.find((row) => row.setting_name === name)?.setting_value ||
      fallback
    );
  };

  const saveSettings = () => {
    console.log({
      businessGoal,
      scoringWeights: {
        profitWeight,
        ltvWeight,
        confidenceWeight,
        easeWeight,
      },
      channelCapacity: {
        whatsappCapacity,
        emailCapacity,
        smsCapacity,
        maxTouches,
      },
      learningWindow,
      confidenceThresholds: {
        lowConfidence,
        mediumConfidence,
        highConfidence,
      },
      strategicPriorities: {
        winback,
        crossSell,
        replenishment,
        subscription,
        loyalty,
        highLtvGrowth,
      },
    });

    alert('Settings saved locally for this session.');
  };

  const uniqueOptions = (key: string, defaults: string[]) => {
    const values = mappedProducts
      .map((row: any) => row[key])
      .filter(Boolean);

    return Array.from(new Set([...defaults, ...values]));
  };

  const productFamilyOptions = uniqueOptions('product_family', [
    'Oil Shots',
    'Hair Oil',
    'Shampoo',
    'Scalp Serum',
    'Conditioner',
    'Face Wash',
    'Moisturizer',
    'Bundle',
  ]);

  const categoryOptions = uniqueOptions('category', ['Hair', 'Skin', 'Body']);
  const routineOptions = uniqueOptions('routine', [
    'Hair Growth',
    'Hair Fall',
    'Dandruff',
    'Scalp Health',
    'Pigmentation',
    'Acne',
    'Barrier Repair',
  ]);

  const roleOptions = uniqueOptions('role', [
    'Hero',
    'Support',
    'Treatment',
    'Replenishment',
    'Bundle',
    'Trial',
  ]);

  const handleCustomSelect = (
    sku: string,
    key: string,
    value: string
  ) => {
    if (value === '__add_new__') {
      const customValue = window.prompt(`Enter new ${key}`);

      if (customValue?.trim()) {
        updateDraft(sku, key, customValue.trim());
      }

      return;
    }

    updateDraft(sku, key, value);
  };

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-600">
        Engine Settings
      </p>

      <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-950">
        Retention Brain Configuration
      </h2>

      <p className="mt-2 max-w-3xl text-sm text-slate-500">
        These settings define how Retention OS ranks opportunities, hypotheses,
        actions and learnings.
      </p>

      <div className="mt-6 space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-black text-slate-950">Business Goal</h3>

          <select
            value={businessGoal}
            onChange={(e) => setBusinessGoal(e.target.value)}
            className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold"
          >
            <option>Contribution Profit</option>
            <option>LTV Growth</option>
            <option>Repeat Revenue</option>
            <option>Repeat Rate</option>
          </select>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-950">
              Opportunity Scoring Weights
            </h3>

            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${totalWeight === 100
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
                }`}
            >
              Total {totalWeight}%
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <NumberInput label="Profit Weight" value={profitWeight} setValue={setProfitWeight} />
            <NumberInput label="LTV Weight" value={ltvWeight} setValue={setLtvWeight} />
            <NumberInput label="Confidence Weight" value={confidenceWeight} setValue={setConfidenceWeight} />
            <NumberInput label="Ease Weight" value={easeWeight} setValue={setEaseWeight} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-black text-slate-950">Channel Capacity</h3>

          <div className="mt-4 grid gap-4 md:grid-cols-4">
            <NumberInput label="WhatsApp / Month" value={whatsappCapacity} setValue={setWhatsappCapacity} />
            <NumberInput label="Email / Month" value={emailCapacity} setValue={setEmailCapacity} />
            <NumberInput label="SMS or RCS / Month" value={smsCapacity} setValue={setSmsCapacity} />
            <NumberInput label="Max Touches / Customer" value={maxTouches} setValue={setMaxTouches} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-black text-slate-950">Learning Window</h3>

          <select
            value={learningWindow}
            onChange={(e) => setLearningWindow(Number(e.target.value))}
            className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold"
          >
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
            <option value={60}>60 Days</option>
            <option value={90}>90 Days</option>
          </select>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-black text-slate-950">
            Confidence Thresholds
          </h3>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <NumberInput label="Low" value={lowConfidence} setValue={setLowConfidence} />
            <NumberInput label="Medium" value={mediumConfidence} setValue={setMediumConfidence} />
            <NumberInput label="High" value={highConfidence} setValue={setHighConfidence} />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="text-lg font-black text-slate-950">
            Strategic Priorities
          </h3>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Slider label="Winback" value={winback} setValue={setWinback} />
            <Slider label="Cross Sell" value={crossSell} setValue={setCrossSell} />
            <Slider label="Replenishment" value={replenishment} setValue={setReplenishment} />
            <Slider label="Subscription" value={subscription} setValue={setSubscription} />
            <Slider label="Loyalty" value={loyalty} setValue={setLoyalty} />
            <Slider label="High LTV Growth" value={highLtvGrowth} setValue={setHighLtvGrowth} />
          </div>
        </div>

        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">
                Product Mapping Alerts
              </p>

              <h3 className="mt-2 text-xl font-black text-slate-950">
                {unmappedProducts.length} Products Need Mapping
              </h3>

              <p className="mt-2 text-sm text-slate-600">
                These SKUs exist in Shopify orders but are not mapped to category,
                routine and role.
              </p>

              {loadingProducts && (
                <p className="mt-2 text-xs font-bold text-amber-700">
                  Loading product mapping data...
                </p>
              )}
            </div>

            <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-black text-amber-800">
              Needs Input
            </span>
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-amber-200 bg-white">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-amber-100 text-xs uppercase tracking-widest text-amber-800">
                <tr>
                  <th className="p-4">SKU</th>
                  <th className="p-4">Product</th>
                  <th className="p-4">Orders</th>
                  <th className="p-4">Customers</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Routine</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Product Type</th>
                  <th className="p-4">Product Family</th>
                  <th className="p-4">Sub Category</th>
                  <th className="p-4">Routine Step</th>
                  <th className="p-4">Replenishment Days</th>
                  <th className="p-4">Bundle Components</th>
                  <th className="p-4">Action</th>
                </tr>
              </thead>

              <tbody>
                {unmappedProducts.map((row: any, index: number) => (
                  <tr key={`unmapped-${row.sku}-${index}`} className="border-t border-amber-100">
                    <td className="p-4 font-black">{row.sku}</td>
                    <td className="p-4">{row.product_title}</td>
                    <td className="p-4">{row.orders}</td>
                    <td className="p-4">{row.customers}</td>

                    <td className="p-4">
                      <CustomSelect
                        value={mappingDrafts[row.sku]?.category || ''}
                        options={categoryOptions}
                        onChange={(value) =>
                          handleCustomSelect(row.sku, 'category', value)
                        }
                      />
                    </td>

                    <td className="p-4">
                      <CustomSelect
                        value={mappingDrafts[row.sku]?.routine || ''}
                        options={routineOptions}
                        onChange={(value) =>
                          handleCustomSelect(row.sku, 'routine', value)
                        }
                      />
                    </td>

                    <td className="p-4">
                      <CustomSelect
                        value={mappingDrafts[row.sku]?.role || ''}
                        options={roleOptions}
                        onChange={(value) => {
                          handleCustomSelect(row.sku, 'role', value);

                          if (value === 'Bundle') {
                            updateDraft(row.sku, 'product_type', 'Bundle');
                            updateDraft(row.sku, 'routine_step', '');
                          }
                        }}
                      />
                    </td>

                    <td className="p-4">
                      <select
                        value={mappingDrafts[row.sku]?.product_type || 'Single'}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateDraft(row.sku, 'product_type', value);

                          if (value === 'Bundle') {
                            updateDraft(row.sku, 'role', 'Bundle');
                            updateDraft(row.sku, 'routine_step', '');
                          } else {
                            updateDraft(row.sku, 'bundle_components', '');
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      >
                        <option>Single</option>
                        <option>Bundle</option>
                      </select>
                    </td>

                    <td className="p-4 min-w-[180px]">
                      <CustomSelect
                        value={mappingDrafts[row.sku]?.product_family || ''}
                        options={productFamilyOptions}
                        onChange={(value) =>
                          handleCustomSelect(row.sku, 'product_family', value)
                        }
                      />
                    </td>

                    <td className="p-3">
                      <input
                        value={mappingDrafts[row.sku]?.product_sub_category || ''}
                        onChange={(e) =>
                          updateDraft(
                            row.sku,
                            'product_sub_category',
                            e.target.value
                          )
                        }
                        placeholder="Rosemary / Onion / Vitamin C"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </td>

                    <td className="p-4">
                      <input
                        type="number"
                        value={mappingDrafts[row.sku]?.routine_step || ''}
                        disabled={mappingDrafts[row.sku]?.product_type === 'Bundle'}
                        onChange={(e) =>
                          updateDraft(row.sku, 'routine_step', e.target.value)
                        }
                        placeholder="1"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 disabled:bg-slate-100"
                      />
                    </td>

                    <td className="p-4">
                      <input
                        type="number"
                        value={mappingDrafts[row.sku]?.replenishment_days || ''}
                        onChange={(e) =>
                          updateDraft(row.sku, 'replenishment_days', e.target.value)
                        }
                        placeholder="30"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </td>

                    <td className="p-4">
                      <input
                        value={mappingDrafts[row.sku]?.bundle_components || ''}
                        disabled={mappingDrafts[row.sku]?.product_type !== 'Bundle'}
                        onChange={(e) =>
                          updateDraft(row.sku, 'bundle_components', e.target.value)
                        }
                        placeholder="RMOS8,RMSH200,RRSS30"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 disabled:bg-slate-100"
                      />
                    </td>

                    <td className="p-4">
                      <button
                        onClick={() => saveProductMapping(row.sku)}
                        disabled={savingSku === row.sku}
                        className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
                      >
                        {savingSku === row.sku ? 'Saving...' : 'Save Mapping'}
                      </button>
                    </td>
                  </tr>
                ))}

                {unmappedProducts.length === 0 && (
                  <tr>
                    <td
                      className="p-6 text-sm font-bold text-slate-500"
                      colSpan={14}
                    >
                      No unmapped products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                Existing Product Mappings
              </p>

              <h3 className="mt-2 text-xl font-black text-slate-950">
                {mappedProducts.length} Products Mapped
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Edit already mapped products and update Retention OS product intelligence.
              </p>
            </div>

            <button
              onClick={loadProductData}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1900px] text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3">SKU</th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Routine</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Product Type</th>
                  <th className="p-3">Product Family</th>
                  <th className="p-3">Sub Category</th>
                  <th className="p-3">Routine Step</th>
                  <th className="p-3">Replenishment Days</th>
                  <th className="p-3">Bundle Components</th>
                  <th className="p-3">Active</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {mappedProducts.map((row: any, index: number) => (
                  <tr key={`mapped-${row.sku}-${index}`} className="border-b align-top">
                    <td className="p-3 font-black">{row.sku}</td>

                    <td className="p-3 min-w-[260px]">
                      {row.product_title}
                    </td>

                    <td className="p-3 min-w-[160px]">
                      <CustomSelect
                        value={mappedDrafts[row.sku]?.category || ''}
                        options={categoryOptions}
                        onChange={(value) =>
                          handleMappedCustomSelect(row.sku, 'category', value)
                        }
                      />
                    </td>

                    <td className="p-3 min-w-[180px]">
                      <CustomSelect
                        value={mappedDrafts[row.sku]?.routine || ''}
                        options={routineOptions}
                        onChange={(value) =>
                          handleMappedCustomSelect(row.sku, 'routine', value)
                        }
                      />
                    </td>

                    <td className="p-3 min-w-[160px]">
                      <CustomSelect
                        value={mappedDrafts[row.sku]?.role || ''}
                        options={roleOptions}
                        onChange={(value) => {
                          handleMappedCustomSelect(row.sku, 'role', value);

                          if (value === 'Bundle') {
                            updateMappedDraft(row.sku, 'product_type', 'Bundle');
                            updateMappedDraft(row.sku, 'routine_step', '');
                          }
                        }}
                      />
                    </td>

                    <td className="p-3 min-w-[140px]">
                      <select
                        value={mappedDrafts[row.sku]?.product_type || 'Single'}
                        onChange={(e) => {
                          const value = e.target.value;

                          updateMappedDraft(row.sku, 'product_type', value);

                          if (value === 'Bundle') {
                            updateMappedDraft(row.sku, 'role', 'Bundle');
                            updateMappedDraft(row.sku, 'routine_step', '');
                          } else {
                            updateMappedDraft(row.sku, 'bundle_components', '');
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      >
                        <option>Single</option>
                        <option>Bundle</option>
                      </select>
                    </td>

                    <td className="p-3 min-w-[180px]">
                      <CustomSelect
                        value={mappedDrafts[row.sku]?.product_family || ''}
                        options={productFamilyOptions}
                        onChange={(value) =>
                          handleMappedCustomSelect(row.sku, 'product_family', value)
                        }
                      />
                    </td>

                    <td className="p-3 min-w-[180px]">
                      <input
                        value={mappedDrafts[row.sku]?.product_sub_category || ''}
                        onChange={(e) =>
                          updateMappedDraft(
                            row.sku,
                            'product_sub_category',
                            e.target.value
                          )
                        }
                        placeholder="Rosemary / Onion / Vitamin C"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </td>

                    <td className="p-3 min-w-[140px]">
                      <input
                        type="number"
                        value={mappedDrafts[row.sku]?.routine_step || ''}
                        disabled={mappedDrafts[row.sku]?.product_type === 'Bundle'}
                        onChange={(e) =>
                          updateMappedDraft(row.sku, 'routine_step', e.target.value)
                        }
                        placeholder="1"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 disabled:bg-slate-100"
                      />
                    </td>

                    <td className="p-3 min-w-[160px]">
                      <input
                        type="number"
                        value={mappedDrafts[row.sku]?.replenishment_days || ''}
                        onChange={(e) =>
                          updateMappedDraft(
                            row.sku,
                            'replenishment_days',
                            e.target.value
                          )
                        }
                        placeholder="30"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </td>

                    <td className="p-3 min-w-[260px]">
                      <input
                        value={mappedDrafts[row.sku]?.bundle_components || ''}
                        disabled={mappedDrafts[row.sku]?.product_type !== 'Bundle'}
                        onChange={(e) =>
                          updateMappedDraft(
                            row.sku,
                            'bundle_components',
                            e.target.value
                          )
                        }
                        placeholder="RMOS8,RMSH200,RRSS30"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 disabled:bg-slate-100"
                      />
                    </td>

                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={mappedDrafts[row.sku]?.active ?? true}
                        onChange={(e) =>
                          updateMappedDraft(row.sku, 'active', e.target.checked)
                        }
                      />
                    </td>

                    <td className="p-3">
                      <button
                        onClick={() => updateMappedProduct(row.sku)}
                        disabled={savingMappedSku === row.sku}
                        className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
                      >
                        {savingMappedSku === row.sku
                          ? 'Updating...'
                          : 'Update Mapping'}
                      </button>
                    </td>
                  </tr>
                ))}

                {mappedProducts.length === 0 && (
                  <tr>
                    <td className="p-6 text-sm font-bold text-slate-500" colSpan={13}>
                      No mapped products yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>


        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                Routine Master
              </p>

              <h3 className="mt-2 text-xl font-black text-slate-950">
                {routineMaster.length} Routine Products Mapped
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Assign mapped products into routine logic so Retention OS can calculate routine completion.
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3">SKU</th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Routine</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Suggested Weight</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {mappedProducts.map((row: any) => {
                  const alreadyMapped = routineMaster.some(
                    (r: any) => r.sku === row.sku && r.routine === row.routine
                  );

                  const weight =
                    row.role === 'Hero' ? 50 : row.role === 'Support' ? 30 : 20;

                  return (
                    <tr key={`${row.sku}-${row.routine}`} className="border-b">
                      <td className="p-3 font-black">{row.sku}</td>
                      <td className="p-3">{row.product_title}</td>
                      <td className="p-3">{row.routine}</td>
                      <td className="p-3">{row.role}</td>
                      <td className="p-3">{weight}</td>
                      <td className="p-3">
                        <button
                          onClick={() => saveRoutineMapping(row)}
                          disabled={alreadyMapped || savingRoutineSku === row.sku}
                          className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
                        >
                          {alreadyMapped
                            ? 'Mapped'
                            : savingRoutineSku === row.sku
                              ? 'Saving...'
                              : 'Add to Routine'}
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {mappedProducts.length === 0 && (
                  <tr>
                    <td className="p-6 text-sm font-bold text-slate-500" colSpan={6}>
                      Map products first to create routine logic.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
            Retention OS Health
          </p>

          <h3 className="mt-2 text-xl font-black text-slate-950">
            Settings Readiness
          </h3>

          <div className="mt-5 grid gap-4 md:grid-cols-5">
            <HealthCard
              label="Unmapped"
              value={settingsHealth?.unmapped_products || 0}
            />

            <HealthCard
              label="Mapped"
              value={settingsHealth?.mapped_products || 0}
            />

            <HealthCard
              label="Routine"
              value={settingsHealth?.routine_products || 0}
            />

            <HealthCard
              label="Settings"
              value={settingsHealth?.opportunity_settings || 0}
            />

            <HealthCard
              label="Opportunities"
              value={settingsHealth?.live_opportunities || 0}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
            Customer Journey Configuration
          </p>

          <h3 className="mt-2 text-xl font-black text-slate-950">
            Stage 1 Foundation Settings
          </h3>

          <p className="mt-2 text-sm text-slate-500">
            Configure how Retention OS defines real customers, journey stages and journey health.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Order Qualification Mode
              </p>

              <select
                value={getGlobalSetting('order_mode', 'DELIVERED_ORDERS')}
                onChange={(e) => updateGlobalSetting('order_mode', e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
              >
                <option value="ALL_ORDERS">All Orders</option>
                <option value="DELIVERED_ORDERS">Delivered Orders</option>
              </select>
            </label>

            <label className="block rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Customer Identity Mode
              </p>

              <select
                value={getGlobalSetting('customer_identity_mode', 'SHOPIFY_CUSTOMER')}
                onChange={(e) =>
                  updateGlobalSetting('customer_identity_mode', e.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold"
              >
                <option value="SHOPIFY_CUSTOMER">Shopify Customer</option>
                <option value="MASTER_CUSTOMER" disabled>
                  Master Customer later
                </option>
              </select>
            </label>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-black text-slate-950">
              Journey Stage Rules
            </h4>

            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="p-4">Stage</th>
                    <th className="p-4">Min Orders</th>
                    <th className="p-4">Max Orders</th>
                    <th className="p-4">Next Goal</th>
                    <th className="p-4">Active</th>
                  </tr>
                </thead>

                <tbody>
                  {journeySettings.map((row: any) => (
                    <tr key={row.stage_name} className="border-t border-slate-100">
                      <td className="p-4 font-black">{row.stage_name}</td>

                      <td className="p-4">
                        <input
                          type="number"
                          value={row.min_orders || 0}
                          onChange={(e) =>
                            updateJourneySetting(
                              row.stage_name,
                              'min_orders',
                              Number(e.target.value || 0)
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2"
                        />
                      </td>

                      <td className="p-4">
                        <input
                          type="number"
                          value={row.max_orders || 0}
                          onChange={(e) =>
                            updateJourneySetting(
                              row.stage_name,
                              'max_orders',
                              Number(e.target.value || 0)
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2"
                        />
                      </td>

                      <td className="p-4">
                        <input
                          value={row.next_goal || ''}
                          onChange={(e) =>
                            updateJourneySetting(
                              row.stage_name,
                              'next_goal',
                              e.target.value
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2"
                        />
                      </td>

                      <td className="p-4">
                        <select
                          value={row.active ? 'true' : 'false'}
                          onChange={(e) =>
                            updateJourneySetting(
                              row.stage_name,
                              'active',
                              e.target.value === 'true'
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2"
                        >
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-sm font-black text-slate-950">
              Journey Health Rules
            </h4>

            <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-widest text-slate-500">
                  <tr>
                    <th className="p-4">Health</th>
                    <th className="p-4">Min Days Since Last Order</th>
                    <th className="p-4">Max Days Since Last Order</th>
                    <th className="p-4">Active</th>
                  </tr>
                </thead>

                <tbody>
                  {journeyHealthSettings.map((row: any) => (
                    <tr key={row.health_name} className="border-t border-slate-100">
                      <td className="p-4 font-black">{row.health_name}</td>

                      <td className="p-4">
                        <input
                          type="number"
                          value={row.min_days || 0}
                          onChange={(e) =>
                            updateJourneyHealthSetting(
                              row.health_name,
                              'min_days',
                              Number(e.target.value || 0)
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2"
                        />
                      </td>

                      <td className="p-4">
                        <input
                          type="number"
                          value={row.max_days || 0}
                          onChange={(e) =>
                            updateJourneyHealthSetting(
                              row.health_name,
                              'max_days',
                              Number(e.target.value || 0)
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2"
                        />
                      </td>

                      <td className="p-4">
                        <select
                          value={row.active ? 'true' : 'false'}
                          onChange={(e) =>
                            updateJourneyHealthSetting(
                              row.health_name,
                              'active',
                              e.target.value === 'true'
                            )
                          }
                          className="w-full rounded-xl border border-slate-200 px-3 py-2"
                        >
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={saveJourneyConfiguration}
            disabled={savingJourney}
            className="mt-5 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white disabled:opacity-40"
          >
            {savingJourney ? 'Saving Journey...' : 'Save Journey Configuration'}
          </button>
        </div>

        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">
            Confidence Suggestions
          </p>

          <h3 className="mt-2 text-xl font-black text-slate-950">
            {confidenceSuggestions.length} Engine Confidence Updates Suggested
          </h3>

          <p className="mt-2 text-sm text-slate-600">
            These suggestions are generated from actual learning accuracy.
          </p>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-blue-200 bg-white">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="bg-blue-100 text-xs uppercase tracking-widest text-blue-800">
                <tr>
                  <th className="p-4">Opportunity</th>
                  <th className="p-4">Current</th>
                  <th className="p-4">Suggested</th>
                  <th className="p-4">Accuracy</th>
                  <th className="p-4">Recommendation</th>
                  <th className="p-4">Action</th>
                </tr>
              </thead>

              <tbody>
                {confidenceSuggestions.map((row: any) => (
                  <tr key={row.opportunity_type} className="border-t border-blue-100">
                    <td className="p-4 font-black">{row.opportunity_type}</td>
                    <td className="p-4">{row.current_confidence}%</td>
                    <td className="p-4 font-black text-blue-700">
                      {row.suggested_confidence}%
                    </td>
                    <td className="p-4">
                      {Math.round(Number(row.avg_profit_accuracy || 0) * 100)}%
                    </td>
                    <td className="p-4">{row.recommended_confidence_action}</td>
                    <td className="p-4">
                      <button
                        onClick={() => applyConfidenceSuggestion(row)}
                        disabled={applyingConfidenceType === row.opportunity_type}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
                      >
                        {applyingConfidenceType === row.opportunity_type
                          ? 'Applying...'
                          : 'Apply'}
                      </button>
                    </td>
                  </tr>
                ))}

                {confidenceSuggestions.length === 0 && (
                  <tr>
                    <td className="p-6 text-sm font-bold text-slate-500" colSpan={6}>
                      No confidence suggestions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
            Confidence Change Log
          </p>

          <h3 className="mt-2 text-xl font-black text-slate-950">
            Recent Confidence Updates
          </h3>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3">Opportunity</th>
                  <th className="p-3">Old</th>
                  <th className="p-3">New</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Created</th>
                </tr>
              </thead>

              <tbody>
                {confidenceChangeLog.map((row: any) => (
                  <tr key={row.change_id} className="border-b">
                    <td className="p-3 font-black">{row.opportunity_type}</td>
                    <td className="p-3">{row.old_confidence}%</td>
                    <td className="p-3 font-black text-blue-700">
                      {row.new_confidence}%
                    </td>
                    <td className="p-3">{row.reason}</td>
                    <td className="p-3">
                      {typeof row.created_at === 'object'
                        ? row.created_at?.value || ''
                        : row.created_at || ''}
                    </td>
                  </tr>
                ))}

                {confidenceChangeLog.length === 0 && (
                  <tr>
                    <td className="p-6 text-sm font-bold text-slate-500" colSpan={5}>
                      No confidence changes logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
              Opportunity Settings
            </p>

            <h3 className="mt-2 text-xl font-black text-slate-950">
              Retention Opportunity Assumptions
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Edit estimated AOV, profit, confidence and difficulty used by opportunity engines.
            </p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-3">Opportunity</th>
                  <th className="p-3">Estimated AOV</th>
                  <th className="p-3">Profit / Customer</th>
                  <th className="p-3">Confidence</th>
                  <th className="p-3">Difficulty</th>
                  <th className="p-3">Active</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>

              <tbody>
                {opportunitySettings.map((row: any) => (
                  <tr key={row.opportunity_type} className="border-b">
                    <td className="p-3 font-black">{row.opportunity_type}</td>

                    <td className="p-3">
                      <input
                        type="number"
                        value={row.estimated_aov || 0}
                        onChange={(e) =>
                          updateOpportunitySetting(
                            row.opportunity_type,
                            'estimated_aov',
                            Number(e.target.value || 0)
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </td>

                    <td className="p-3">
                      <input
                        type="number"
                        value={row.estimated_profit_per_customer || 0}
                        onChange={(e) =>
                          updateOpportunitySetting(
                            row.opportunity_type,
                            'estimated_profit_per_customer',
                            Number(e.target.value || 0)
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </td>

                    <td className="p-3">
                      <input
                        type="number"
                        value={row.confidence || 0}
                        onChange={(e) =>
                          updateOpportunitySetting(
                            row.opportunity_type,
                            'confidence',
                            Number(e.target.value || 0)
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </td>

                    <td className="p-3">
                      <select
                        value={row.difficulty || 'Medium'}
                        onChange={(e) =>
                          updateOpportunitySetting(
                            row.opportunity_type,
                            'difficulty',
                            e.target.value
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      >
                        <option>Low</option>
                        <option>Medium</option>
                        <option>High</option>
                      </select>
                    </td>

                    <td className="p-3">
                      <select
                        value={row.active ? 'true' : 'false'}
                        onChange={(e) =>
                          updateOpportunitySetting(
                            row.opportunity_type,
                            'active',
                            e.target.value === 'true'
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      >
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </td>

                    <td className="p-3">
                      <button
                        onClick={() => saveOpportunitySetting(row)}
                        disabled={savingOpportunityType === row.opportunity_type}
                        className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white disabled:opacity-40"
                      >
                        {savingOpportunityType === row.opportunity_type
                          ? 'Saving...'
                          : 'Save'}
                      </button>
                    </td>
                  </tr>
                ))}

                {opportunitySettings.length === 0 && (
                  <tr>
                    <td className="p-6 text-sm font-bold text-slate-500" colSpan={7}>
                      No opportunity settings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <button
          onClick={saveSettings}
          className="rounded-2xl bg-slate-950 px-6 py-4 text-sm font-black text-white shadow-lg"
        >
          Save Settings
        </button>
      </div>
    </section>
  );
}

function NumberInput({
  label,
  value,
  setValue,
}: {
  label: string;
  value: number;
  setValue: (value: number) => void;
}) {
  return (
    <label className="block">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>

      <input
        type="number"
        value={value}
        onChange={(e) => setValue(Number(e.target.value || 0))}
        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black"
      />
    </label>
  );
}

function Slider({
  label,
  value,
  setValue,
}: {
  label: string;
  value: number;
  setValue: (value: number) => void;
}) {
  return (
    <label className="block rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-slate-700">{label}</p>
        <p className="text-xs font-black text-blue-600">{value}</p>
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="mt-3 w-full"
      />
    </label>
  );
}

function HealthCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">
        {Number(value || 0).toLocaleString('en-IN')}
      </p>
    </div>
  );
}

function CustomSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [customMode, setCustomMode] = useState(false);

  return (
    <div>
      <select
        value={customMode ? '__add_new__' : value}
        onChange={(e) => {
          const selected = e.target.value;

          if (selected === '__add_new__') {
            setCustomMode(true);
            onChange('');
            return;
          }

          setCustomMode(false);
          onChange(selected);
        }}
        className="w-full rounded-xl border border-slate-200 px-3 py-2"
      >
        <option value="">Select</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}

        <option value="__add_new__">+ Add New</option>
      </select>

      {customMode && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter custom value"
          className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2"
        />
      )}
    </div>
  );
}