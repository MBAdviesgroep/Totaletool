function normalizeData(raw){
  const d = {...raw};

  if(d.annualSavings > d.currentEnergyCosts){
    d.annualSavings = d.currentEnergyCosts;
  }

  d.paybackPeriod = d.annualSavings > 0
    ? d.totalInvestment / d.annualSavings
    : null;

  d.breakEvenYear = Math.round(d.paybackPeriod);

  d.labelSteps = calculateLabelSteps(d.labelCurrent, d.labelTarget);

  return d;
}

function calculateLabelSteps(from, to){
  const order = ['G','F','E','D','C','B','A','A+','A++','A+++'];
  return Math.max(0, order.indexOf(to) - order.indexOf(from));
}

function getBankScore(d){
  let score = 0;
  if(d.labelSteps >= 3) score += 20;
  if(d.co2ReductionPercent >= 50) score += 20;
  if(d.paybackPeriod < 15) score += 20;
  return score;
}
