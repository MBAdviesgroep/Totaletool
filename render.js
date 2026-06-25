function renderReport(d){
  const score = getBankScore(d);

  const html = `
  <div class="card">
    <h2>Executive summary</h2>
    <p>Object: ${d.address}</p>
    <p>Type: ${d.applicantType}</p>
    <p>Investering: €${d.totalInvestment}</p>
    <p>Besparing: €${d.annualSavings}</p>
    <p>CO₂: ${d.co2ReductionTotal} ton</p>
    <p>TVT: ${d.paybackPeriod.toFixed(1)} jaar</p>
    <p><strong>Bank score: ${score}</strong></p>
  </div>
  `;

  document.getElementById('output').innerHTML = html;
}
