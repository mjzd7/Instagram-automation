// Simple test to verify treatment toggling logic
const fs = require('fs');
const path = require('path');

const TREATMENT_STATE_PATH = path.join(__dirname, 'scripts', 'treatment-state.json');

function loadTreatmentState() {
  if (!fs.existsSync(TREATMENT_STATE_PATH)) {
    return { nextTreatment: "light" };
  }
  try {
    const raw = fs.readFileSync(TREATMENT_STATE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { nextTreatment: "light" };
  }
}

function saveTreatmentState(state) {
  fs.writeFileSync(TREATMENT_STATE_PATH, JSON.stringify(state, null, 2));
}

// Test the toggling mechanism
console.log("Testing treatment toggling mechanism:");
console.log("================================");

for (let i = 0; i < 4; i++) {
  const state = loadTreatmentState();
  const currentTreatment = state.nextTreatment;
  const opacity = currentTreatment === "light" ? 0.05 : 0.4;
  
  console.log(`Test ${i + 1}:`);
  console.log(`  Current treatment: ${currentTreatment}`);
  console.log(`  Opacity: ${opacity}`);
  console.log(`  Description: ${currentTreatment === "light" ? "Nearly transparent (whitish)" : "Noticeable tint (dark)"}`);
  
  // Toggle for next time
  const nextState = {
    nextTreatment: currentTreatment === "light" ? "dark" : "light"
  };
  saveTreatmentState(nextState);
  
  console.log(`  Next treatment will be: ${nextState.nextTreatment}`);
  console.log("");
}

// Verify final state
const finalState = loadTreatmentState();
console.log(`Final state in file: ${JSON.stringify(finalState)}`);
