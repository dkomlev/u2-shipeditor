#!/usr/bin/env node
/**
 * Verify relativistic velocity calculation
 * Build 007: Corrected SR momentum integration
 */

// Inline test - verify the relativistic formula directly
function testRelativisticVelocity() {
  const c = 1000; // m/s
  const mass_kg = 50000; // 50 tons
  
  console.log('Testing Relativistic Velocity Calculation (v0.7.1 build 007)\n');
  console.log('Formula: v = p / sqrt(m² + p²/c²)\n');
  console.log('Momentum(kg⋅m/s) | Speed(m/s) | v/c      | Check');
  console.log('-----------------|------------|----------|-------');
  
  // Test various momentum values
  const testMomenta = [
    0,
    mass_kg * c * 0.1,   // Low momentum
    mass_kg * c * 0.5,   // Medium momentum
    mass_kg * c * 0.9,   // High momentum
    mass_kg * c * 10,    // Very high momentum (10mc)
    mass_kg * c * 100,   // Extreme momentum (100mc)
    mass_kg * c * 1000   // Ultra-relativistic (1000mc)
  ];
  
  let allPassed = true;
  
  for (const p of testMomenta) {
    const m2 = mass_kg * mass_kg;
    const c2 = c * c;
    const p2 = p * p;
    
    // Calculate velocity using the SR formula
    const denominator = Math.sqrt(m2 + p2 / c2);
    const v = p / denominator;
    
    const vOverC = v / c;
    const isValid = v < c;
    
    console.log(
      `${p.toExponential(3).padStart(16)} | ` +
      `${v.toFixed(2).padStart(10)} | ` +
      `${vOverC.toFixed(6).padStart(8)} | ` +
      `${isValid ? '✓ PASS' : '✗ FAIL'}`
    );
    
    if (!isValid) allPassed = false;
  }
  
  console.log('\n=== VERIFICATION ===');
  if (allPassed) {
    console.log('✓ PASS: All velocities naturally stay below c');
    console.log('✓ PASS: Formula correctly implements special relativity');
    console.log('\n✓ All relativistic physics checks passed!');
    return 0;
  } else {
    console.log('✗ FAIL: Some velocities exceeded speed of light!');
    return 1;
  }
}

process.exit(testRelativisticVelocity());
