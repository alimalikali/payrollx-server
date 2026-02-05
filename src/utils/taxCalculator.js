/**
 * Pakistani Tax Calculator
 * FBR Tax Slabs for Tax Year 2024-25
 * Separate slabs for Filers and Non-Filers
 */

// FBR Tax Slabs for Salaried Individuals (Tax Year 2024-25)
// Annual income slabs
const TAX_SLABS_FILER = [
  { min: 0, max: 600000, rate: 0, fixed: 0 },
  { min: 600001, max: 1200000, rate: 2.5, fixed: 0 },
  { min: 1200001, max: 2200000, rate: 12.5, fixed: 15000 },
  { min: 2200001, max: 3200000, rate: 22.5, fixed: 140000 },
  { min: 3200001, max: 4100000, rate: 27.5, fixed: 365000 },
  { min: 4100001, max: Infinity, rate: 35, fixed: 612500 },
];

// Non-filers pay 10% higher tax
const TAX_SLABS_NON_FILER = [
  { min: 0, max: 600000, rate: 0, fixed: 0 },
  { min: 600001, max: 1200000, rate: 2.75, fixed: 0 },
  { min: 1200001, max: 2200000, rate: 13.75, fixed: 16500 },
  { min: 2200001, max: 3200000, rate: 24.75, fixed: 154000 },
  { min: 3200001, max: 4100000, rate: 30.25, fixed: 401500 },
  { min: 4100001, max: Infinity, rate: 38.5, fixed: 673750 },
];

/**
 * Calculate annual income tax
 * @param {number} annualIncome - Annual taxable income in PKR
 * @param {boolean} isFiler - Whether the employee is a tax filer
 * @returns {object} Tax calculation details
 */
const calculateAnnualTax = (annualIncome, isFiler = false) => {
  const slabs = isFiler ? TAX_SLABS_FILER : TAX_SLABS_NON_FILER;

  let tax = 0;
  let applicableSlab = null;

  for (const slab of slabs) {
    if (annualIncome >= slab.min && annualIncome <= slab.max) {
      applicableSlab = slab;
      if (slab.rate > 0) {
        const taxableAmount = annualIncome - slab.min + 1;
        tax = slab.fixed + (taxableAmount * slab.rate) / 100;
      }
      break;
    }
  }

  return {
    annualIncome,
    annualTax: Math.round(tax),
    monthlyTax: Math.round(tax / 12),
    effectiveRate: annualIncome > 0 ? ((tax / annualIncome) * 100).toFixed(2) : 0,
    slab: applicableSlab ? `${applicableSlab.min.toLocaleString()} - ${applicableSlab.max === Infinity ? 'Above' : applicableSlab.max.toLocaleString()}` : 'Exempt',
    isFiler,
  };
};

/**
 * Calculate monthly income tax
 * @param {number} monthlyGross - Monthly gross salary in PKR
 * @param {boolean} isFiler - Whether the employee is a tax filer
 * @returns {object} Tax calculation details
 */
const calculateMonthlyTax = (monthlyGross, isFiler = false) => {
  const annualIncome = monthlyGross * 12;
  const result = calculateAnnualTax(annualIncome, isFiler);

  return {
    monthlyGross,
    monthlyTax: result.monthlyTax,
    annualProjection: result.annualTax,
    effectiveRate: result.effectiveRate,
    slab: result.slab,
    isFiler,
  };
};

/**
 * Calculate EOBI contribution
 * Employer: Min wage * 5% (capped at Rs. 385)
 * Employee: Min wage * 1% (capped at Rs. 77)
 * Using simplified 0.75% of gross for employer contribution
 */
const calculateEOBI = (grossSalary) => {
  const employerContribution = Math.round(grossSalary * 0.0075);
  const employeeContribution = Math.round(grossSalary * 0.0015);

  return {
    employer: employerContribution,
    employee: employeeContribution,
    total: employerContribution + employeeContribution,
  };
};

/**
 * Calculate SESSI/PESSI contribution (Social Security)
 * 0.75% of gross salary (employer contribution only for wages up to Rs. 25,000)
 */
const calculateSESSI = (grossSalary) => {
  // SESSI applies to wages up to a certain limit
  const applicableSalary = Math.min(grossSalary, 25000);
  const contribution = Math.round(applicableSalary * 0.0075);

  return {
    employer: contribution,
    employee: 0, // SESSI is employer only
    total: contribution,
  };
};

/**
 * Calculate all deductions for a salary
 */
const calculateAllDeductions = (grossSalary, isFiler = false, additionalDeductions = {}) => {
  const tax = calculateMonthlyTax(grossSalary, isFiler);
  const eobi = calculateEOBI(grossSalary);
  const sessi = calculateSESSI(grossSalary);

  const {
    loanDeduction = 0,
    otherDeductions = 0,
  } = additionalDeductions;

  const totalDeductions =
    tax.monthlyTax +
    eobi.employee +
    loanDeduction +
    otherDeductions;

  return {
    incomeTax: tax.monthlyTax,
    taxSlab: tax.slab,
    effectiveTaxRate: tax.effectiveRate,
    eobi: eobi.employee,
    sessi: sessi.employee, // 0 as employee doesn't pay
    loanDeduction,
    otherDeductions,
    totalDeductions,
    netSalary: grossSalary - totalDeductions,
    employerContributions: {
      eobi: eobi.employer,
      sessi: sessi.employer,
    },
  };
};

/**
 * Get tax slab information
 */
const getTaxSlabInfo = (isFiler = true) => {
  const slabs = isFiler ? TAX_SLABS_FILER : TAX_SLABS_NON_FILER;

  return slabs.map(slab => ({
    minIncome: slab.min,
    maxIncome: slab.max === Infinity ? 'Above 4,100,000' : slab.max,
    rate: `${slab.rate}%`,
    fixedAmount: slab.fixed,
  }));
};

module.exports = {
  calculateAnnualTax,
  calculateMonthlyTax,
  calculateEOBI,
  calculateSESSI,
  calculateAllDeductions,
  getTaxSlabInfo,
  TAX_SLABS_FILER,
  TAX_SLABS_NON_FILER,
};
