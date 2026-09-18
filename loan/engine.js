// Loan and EMI math. Educational estimates only, not financial advice.
// Monthly payment: P * r / (1 - (1 + r)^-n), with r the monthly rate.

export function monthlyRate(annualPercent) {
  const annual = Number(annualPercent);
  if (!Number.isFinite(annual) || annual < 0 || annual > 100) {
    throw new Error('Enter an annual rate from 0 to 100 percent.');
  }
  return annual / 100 / 12;
}

export function checkLoan(principal, annualPercent, years) {
  const amount = Number(principal);
  const term = Number(years);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    throw new Error('Enter a loan amount above zero, up to 100,000,000.');
  }
  monthlyRate(annualPercent);
  if (!Number.isFinite(term) || term <= 0 || term > 50) {
    throw new Error('Enter a term above zero, up to 50 years.');
  }
  return { amount, term };
}

export function monthlyPayment(principal, annualPercent, years) {
  const { amount, term } = checkLoan(principal, annualPercent, years);
  const months = Math.round(term * 12);
  const rate = monthlyRate(annualPercent);
  if (months < 1) throw new Error('The term is too short to price.');
  if (rate === 0) return amount / months;
  const factor = Math.pow(1 + rate, -months);
  return (amount * rate) / (1 - factor);
}

// EMI uses the same formula with the term already in months.
export function emi(principal, annualPercent, months) {
  const amount = Number(principal);
  const count = Number(months);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    throw new Error('Enter a loan amount above zero, up to 100,000,000.');
  }
  if (!Number.isInteger(count) || count < 1 || count > 600) {
    throw new Error('Enter whole months from 1 to 600.');
  }
  const rate = monthlyRate(annualPercent);
  if (rate === 0) return amount / count;
  return (amount * rate) / (1 - Math.pow(1 + rate, -count));
}

export function loanTotals(principal, annualPercent, years) {
  const payment = monthlyPayment(principal, annualPercent, years);
  const { amount, term } = checkLoan(principal, annualPercent, years);
  const months = Math.round(term * 12);
  const totalPaid = payment * months;
  return { payment, months, totalPaid, totalInterest: totalPaid - amount, principal: amount };
}

// Full schedule with an optional extra amount added to principal each month.
// The last payment is trimmed so the balance lands on zero.
export function schedule(principal, annualPercent, years, extraMonthly = 0) {
  const { amount } = checkLoan(principal, annualPercent, years);
  const extra = Number(extraMonthly);
  if (!Number.isFinite(extra) || extra < 0 || extra > amount) {
    throw new Error('Enter an extra monthly amount from 0 up to the loan amount.');
  }
  const base = monthlyPayment(amount, annualPercent, years);
  const rate = monthlyRate(annualPercent);
  let balance = amount;
  const rows = [];
  let paid = 0;
  let interest = 0;
  for (let month = 1; month <= 1200 && balance > 0.005; month++) {
    const interestPart = balance * rate;
    let principalPart = base - interestPart + extra;
    if (principalPart <= 0) throw new Error('The payment does not cover the monthly interest. Raise the payment or shorten the term.');
    if (principalPart > balance) principalPart = balance;
    const payment = interestPart + principalPart;
    balance -= principalPart;
    paid += payment;
    interest += interestPart;
    rows.push({
      month,
      payment,
      interest: interestPart,
      principal: principalPart,
      balance: Math.max(0, balance)
    });
    if (rows.length > 1200) throw new Error('The schedule ran past 1200 payments.');
  }
  return { rows, months: rows.length, totalPaid: paid, totalInterest: interest };
}

export function firstYear(scheduleResult) {
  return scheduleResult.rows.slice(0, 12);
}

export function yearlyRollup(scheduleResult) {
  const years = [];
  for (const row of scheduleResult.rows) {
    const index = Math.floor((row.month - 1) / 12);
    if (!years[index]) years[index] = { year: index + 1, payment: 0, interest: 0, principal: 0, balance: 0 };
    years[index].payment += row.payment;
    years[index].interest += row.interest;
    years[index].principal += row.principal;
    years[index].balance = row.balance;
  }
  return years;
}

// Flat rate explainer numbers: flat interest = P * flatRate * years.
export function flatRateCompare(principal, flatPercent, years) {
  const amount = Number(principal);
  const flat = Number(flatPercent);
  const term = Number(years);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    throw new Error('Enter a loan amount above zero, up to 100,000,000.');
  }
  if (!Number.isFinite(flat) || flat < 0 || flat > 100) {
    throw new Error('Enter a flat rate from 0 to 100 percent.');
  }
  if (!Number.isFinite(term) || term <= 0 || term > 50) {
    throw new Error('Enter a term above zero, up to 50 years.');
  }
  const totalInterest = amount * (flat / 100) * term;
  const months = Math.round(term * 12);
  return { totalInterest, monthly: (amount + totalInterest) / months, months };
}
