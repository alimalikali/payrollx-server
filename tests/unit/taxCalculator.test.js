/**
 * Tax Calculator Unit Tests
 */

const {
  calculateAnnualTax,
  calculateMonthlyTax,
  calculateEOBI,
  calculateSESSI,
  calculateAllDeductions,
} = require('../../src/utils/taxCalculator');

describe('Tax Calculator', () => {
  describe('calculateAnnualTax', () => {
    describe('Filer Tax Calculations', () => {
      it('should return 0 tax for income up to 600,000', () => {
        const result = calculateAnnualTax(500000, true);
        expect(result.annualTax).toBe(0);
        expect(result.slab).toContain('600,000');
      });

      it('should calculate 2.5% for income between 600,001 and 1,200,000', () => {
        const result = calculateAnnualTax(1000000, true);
        // Tax = (1000000 - 600000) * 2.5% = 10,000
        expect(result.annualTax).toBe(10000);
      });

      it('should calculate correct tax for income 2,000,000', () => {
        const result = calculateAnnualTax(2000000, true);
        // Tax = 15000 + (2000000 - 1200000) * 12.5% = 15000 + 100000 = 115000
        expect(result.annualTax).toBe(115000);
      });

      it('should calculate correct tax for high income (5,000,000)', () => {
        const result = calculateAnnualTax(5000000, true);
        // Tax = 612500 + (5000000 - 4100000) * 35% = 612500 + 315000 = 927500
        expect(result.annualTax).toBe(927500);
      });
    });

    describe('Non-Filer Tax Calculations', () => {
      it('should return 0 tax for income up to 600,000', () => {
        const result = calculateAnnualTax(500000, false);
        expect(result.annualTax).toBe(0);
      });

      it('should calculate higher tax for non-filers', () => {
        const filerTax = calculateAnnualTax(1000000, true);
        const nonFilerTax = calculateAnnualTax(1000000, false);
        expect(nonFilerTax.annualTax).toBeGreaterThan(filerTax.annualTax);
      });
    });

    it('should return isFiler flag correctly', () => {
      expect(calculateAnnualTax(1000000, true).isFiler).toBe(true);
      expect(calculateAnnualTax(1000000, false).isFiler).toBe(false);
    });

    it('should calculate effective tax rate', () => {
      const result = calculateAnnualTax(1200000, true);
      expect(result.effectiveRate).toBeDefined();
      expect(parseFloat(result.effectiveRate)).toBeGreaterThan(0);
    });
  });

  describe('calculateMonthlyTax', () => {
    it('should calculate monthly tax from gross salary', () => {
      const result = calculateMonthlyTax(100000, true); // 100k monthly = 1.2M annual
      expect(result.monthlyTax).toBeDefined();
      expect(result.monthlyGross).toBe(100000);
    });

    it('should project annual tax correctly', () => {
      const result = calculateMonthlyTax(100000, true);
      expect(result.annualProjection).toBe(result.monthlyTax * 12);
    });
  });

  describe('calculateEOBI', () => {
    it('should calculate employer contribution at 0.75%', () => {
      const result = calculateEOBI(100000);
      expect(result.employer).toBe(750); // 100000 * 0.0075
    });

    it('should calculate employee contribution at 0.15%', () => {
      const result = calculateEOBI(100000);
      expect(result.employee).toBe(150); // 100000 * 0.0015
    });

    it('should calculate total correctly', () => {
      const result = calculateEOBI(100000);
      expect(result.total).toBe(result.employer + result.employee);
    });
  });

  describe('calculateSESSI', () => {
    it('should calculate at 0.75% for salaries up to 25,000', () => {
      const result = calculateSESSI(20000);
      expect(result.employer).toBe(150); // 20000 * 0.0075
    });

    it('should cap at 25,000 for higher salaries', () => {
      const result = calculateSESSI(100000);
      expect(result.employer).toBe(188); // 25000 * 0.0075 (capped)
    });

    it('should have 0 employee contribution', () => {
      const result = calculateSESSI(100000);
      expect(result.employee).toBe(0);
    });
  });

  describe('calculateAllDeductions', () => {
    it('should calculate total deductions correctly', () => {
      const result = calculateAllDeductions(150000, true);

      expect(result.incomeTax).toBeDefined();
      expect(result.eobi).toBeDefined();
      expect(result.totalDeductions).toBeGreaterThan(0);
      expect(result.netSalary).toBe(150000 - result.totalDeductions);
    });

    it('should include additional deductions', () => {
      const result = calculateAllDeductions(150000, true, {
        loanDeduction: 5000,
        otherDeductions: 2000,
      });

      expect(result.loanDeduction).toBe(5000);
      expect(result.otherDeductions).toBe(2000);
    });

    it('should include employer contributions', () => {
      const result = calculateAllDeductions(150000, true);

      expect(result.employerContributions).toBeDefined();
      expect(result.employerContributions.eobi).toBeGreaterThan(0);
      expect(result.employerContributions.sessi).toBeGreaterThan(0);
    });
  });
});
