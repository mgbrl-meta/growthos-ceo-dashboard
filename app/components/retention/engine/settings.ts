export const defaultRetentionSettings = {
  businessGoal: 'Contribution Profit',

  scoringWeights: {
    profitWeight: 40,
    ltvWeight: 30,
    confidenceWeight: 20,
    easeWeight: 10,
  },

  channelCapacity: {
    whatsappPerMonth: 4,
    emailPerMonth: 4,
    smsRcsPerMonth: 4,
    maxTouchesPerCustomer: 6,
  },

  learningWindowDays: 30,

  confidenceThresholds: {
    low: 40,
    medium: 60,
    high: 80,
  },

  strategicPriorities: {
    winback: 70,
    crossSell: 90,
    replenishment: 100,
    subscription: 30,
    loyalty: 40,
    highLtvGrowth: 95,
  },

  productImportance: {
    rosemaryOilShot: 100,
    redensylSerum: 90,
    rosemaryShampoo: 80,
    scalpFood: 75,
  },
};